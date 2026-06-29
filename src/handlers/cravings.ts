import type { Context } from '@devvit/public-api';
import type { CravingResult } from '../../core/save-schema.js';
import { deriveCravings } from '../../core/craving-engine.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cravingKey(subredditId: string, date: string): string {
  return `cravings:${subredditId}:${date}`;
}

function harborKey(date: string): string {
  return `harbor:${date}`;
}

function harborOverrideKey(userId: string, date: string): string {
  return `harbor:${date}:${userId}`;
}

// Resolve which subreddit the player docks at today
async function resolveHarborId(context: Context, userId: string): Promise<string> {
  const date = today();
  // Check per-user reroll override first
  const override = await context.redis.get(harborOverrideKey(userId, date));
  if (override) return override;
  // Fall back to global daily harbor
  const global = await context.redis.get(harborKey(date));
  if (global) return global;
  // Bootstrap: no rollover ran yet (first day, dev environment)
  return 'Cooking';
}

// Get cached cravings for a subreddit, or derive live if missing
export async function getTodayCravings(
  context: Context,
  userId: string
): Promise<{ harborId: string; cravings: CravingResult }> {
  const date = today();
  const harborId = await resolveHarborId(context, userId);
  const key = cravingKey(harborId, date);

  const cached = await context.redis.get(key);
  if (cached) {
    return { harborId, cravings: JSON.parse(cached) };
  }

  // Cache miss — derive live (spike 1 validates this works in serverless context)
  let cravings: CravingResult;
  try {
    const posts = await context.reddit.getTopPosts({
      subredditName: harborId,
      timeframe: 'day',
      limit: 10,
      pageSize: 10,
    }).all();

    const titles = posts.map((p) => p.title);
    const flairs = posts
      .map((p) => (p as unknown as { linkFlairText?: string }).linkFlairText ?? '')
      .filter(Boolean);

    cravings = deriveCravings({ titles, flairs, subredditId: harborId, date });
  } catch {
    // API unavailable in this context — use description fallback
    cravings = deriveCravings({ titles: [], flairs: [], subredditId: harborId, date });
  }

  // Cache for the day
  await context.redis.set(key, JSON.stringify(cravings), { expiration: new Date(Date.now() + 25 * 60 * 60 * 1000) });

  return { harborId, cravings };
}

// Spend a reroll token and switch to a different harbor
export async function rerollHarbor(
  context: Context,
  userId: string
): Promise<{ harborId: string; cravings: CravingResult }> {
  const date = today();

  // 50 pool subreddits — pick one at random (deterministic: use userId + date as seed)
  const POOL = [
    'food', 'Cooking', 'MealPrepSunday', 'spicy', 'vegetarian', 'BBQ', 'sushi',
    'ramen', 'Pizza', 'tacos', 'Baking', 'AskCulinary', 'EatCheapAndHealthy',
    'GifRecipes', 'slowcooking', 'instantpot', 'fermentation', 'Coffee',
    'Sourdough', 'Breadit', 'smoking', 'grilling', 'IndianFood', 'mexicanfood',
    'chinesefood', 'thai', 'Korean', 'italian', 'frenchcooking', 'Keto',
    'castiron', 'wok', 'cheesemaking', 'Canning', 'mead', 'vegan', 'glutenfree',
    'WeightLossRecipes', '52weeksofcooking', 'Chefit', 'DutchOvenCooking',
    'MiddleEasternFood', 'HealthyFood', 'FoodPorn', 'TopSecretRecipes', 'Paleo',
    'cocktails', 'tea', 'diabetes_t2', 'AskCulinary',
  ];

  // Simple deterministic pick: hash userId+date to index
  const seed = [...`${userId}${date}`].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const currentHarbor = await resolveHarborId(context, userId);
  const candidates = POOL.filter((s) => s !== currentHarbor);
  const newHarbor = candidates[seed % candidates.length];

  // Write per-user override
  await context.redis.set(harborOverrideKey(userId, date), newHarbor, {
    expiration: new Date(Date.now() + 25 * 60 * 60 * 1000),
  });

  return getTodayCravings(context, userId);
}
