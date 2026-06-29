import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import { deriveCravings } from '../../core/craving-engine.js';
import { BALANCE } from '../../core/balance.config.js';

// Full list of 50 food-adjacent pool subreddits (NSFW pre-screened out)
const POOL: string[] = [
  'food', 'Cooking', 'MealPrepSunday', 'spicy', 'vegetarian', 'BBQ', 'sushi',
  'ramen', 'Pizza', 'tacos', 'Baking', 'AskCulinary', 'Chefit', 'EatCheapAndHealthy',
  '52weeksofcooking', 'GifRecipes', 'slowcooking', 'instantpot', 'fermentation',
  'Coffee', 'tea', 'Keto', 'vegan', 'glutenfree', 'WeightLossRecipes', 'Sourdough',
  'Breadit', 'cheesemaking', 'Canning', 'DutchOvenCooking', 'wok', 'castiron',
  'smoking', 'grilling', 'IndianFood', 'mexicanfood', 'chinesefood', 'thai',
  'Korean', 'italian', 'frenchcooking', 'MiddleEasternFood', 'HealthyFood',
  'FoodPorn', 'TopSecretRecipes', 'Paleo', 'cocktails', 'mead', 'diabetes_t2',
  'AskCulinary',
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekId(): string {
  const msPerWeek = 7 * 24 * 3600 * 1000;
  return `week-${Math.floor(Date.now() / msPerWeek)}`;
}

// Step 1 — Prefetch all 50 pool subreddits (called at 00:00 UTC)
// Concurrency cap of 5 via a simple semaphore to stay within scheduler limits.
export async function prefetchAllCravings(context: Context): Promise<void> {
  const date = todayStr();
  const CONCURRENCY = 5;
  const failedKey = `cravings:failed:${date}`;

  for (let i = 0; i < POOL.length; i += CONCURRENCY) {
    const batch = POOL.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (subId) => {
        const cacheKey = `cravings:${subId}:${date}`;
        const existing = await context.redis.get(cacheKey);
        if (existing) return; // already cached (e.g. from yesterday's stagger)

        try {
          const posts = await context.reddit.getTopPosts({
            subredditName: subId,
            timeframe: 'day',
            limit: 10,
            pageSize: 10,
          }).all();

          const titles = posts.map((p) => p.title);
          const flairs = posts
            .map((p) => (p as unknown as { linkFlairText?: string }).linkFlairText ?? '')
            .filter(Boolean);

          const cravings = deriveCravings({ titles, flairs, subredditId: subId, date });
          await context.redis.set(cacheKey, JSON.stringify(cravings), {
            expiration: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25h TTL
          });
        } catch {
          // Mark as failed — Devvit Redis has no native set; store as JSON array
          const existingFailed = await context.redis.get(failedKey);
          const failedArr: string[] = existingFailed ? JSON.parse(existingFailed) : [];
          if (!failedArr.includes(subId)) {
            failedArr.push(subId);
            await context.redis.set(failedKey, JSON.stringify(failedArr));
          }
          // Carry forward yesterday's cravings if available
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const prev = await context.redis.get(`cravings:${subId}:${yesterday}`);
          if (prev) {
            await context.redis.set(cacheKey, prev, {
              expiration: new Date(Date.now() + 25 * 60 * 60 * 1000),
            });
          }
        }
      })
    );
  }
}

// Step 2 — Daily rollover (called at 00:05 UTC)
export async function dailyRollover(context: Context): Promise<void> {
  const date = todayStr();
  const failedRaw = await context.redis.get(`cravings:failed:${date}`);
  const failed: string[] = failedRaw ? JSON.parse(failedRaw) : [];

  // Select global harbor: pick from pool subs with warm cravings
  const candidates = POOL.filter((s) => !failed.includes(s));
  const seed = [...date].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const harborId = candidates[seed % candidates.length];
  await context.redis.set(`harbor:${date}`, harborId, {
    expiration: new Date(Date.now() + 25 * 60 * 60 * 1000),
  });

  // Create the daily "Today's Harbor" interactive post
  try {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const cravingsRaw = await context.redis.get(`cravings:${harborId}:${date}`);
    const cravings = cravingsRaw ? JSON.parse(cravingsRaw) : null;
    const craze = cravings?.crazeCategory ? `🔥 Today's craze: ${cravings.crazeCategory}` : '';

    await context.reddit.submitPost({
      title: `⚓ Drift Kitchen — Day ${date} | Harbor: r/${harborId} ${craze}`,
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#0d1117">
          <text size="large" weight="bold" color="#f97316">DRIFT KITCHEN</text>
          <text size="medium" color="#e6edf3">r/{harborId} has docked!</text>
          <text size="small" color="#8b8b8b">{craze}</text>
        </vstack>
      ),
    });
  } catch {
    // Non-fatal — post creation failure doesn't block other rollover steps
  }

  // Settle streaks — reset rerollsToday for all users who played today
  // (Approximate: iterate active users from leaderboard; full user scan is a future improvement)
  // For now: streak is handled per-user on next login

  // Promote top recipe submissions from yesterday
  await promoteRecipes(context);

  // Advance Community Feast
  await advanceFeast(context);
}

async function promoteRecipes(context: Context): Promise<void> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const submissionsKey = `submissions:${yesterday}`;

  // Get top N submissions by upvote score (stored as sorted set)
  const top = await context.redis.zRange(submissionsKey, 0, BALANCE.RECIPE_PROMOTIONS_PER_DAY - 1, {
    reverse: true, by: 'rank',
  });

  for (const entry of top ?? []) {
    const dishId = typeof entry === 'string' ? entry : (entry as { member: string }).member;
    const score  = typeof entry === 'string' ? 0    : (entry as { member: string; score: number }).score;
    const dishRaw = await context.redis.get(`submission:${dishId}`);
    if (!dishRaw) continue;

    const dish = JSON.parse(dishRaw);

    // Assign rarity
    let rarity: 'common' | 'rare' | 'legendary' = 'common';
    if (score >= BALANCE.RARITY_LEGENDARY_THRESHOLD) rarity = 'legendary';
    else if (score >= BALANCE.RARITY_RARE_THRESHOLD)  rarity = 'rare';

    dish.rarity = rarity;
    dish.creatorStatus = 'active';

    // Promote into Recipe Book
    await context.redis.hSet('recipebook:items', { [dishId]: JSON.stringify(dish) });

    // Update creator leaderboard
    await context.redis.zIncrBy('leaderboard:creators', dish.creatorId ?? 'anon', Number(score));
  }
}

async function advanceFeast(context: Context): Promise<void> {
  const wId = weekId();
  const progressRaw = await context.redis.get(`feast:goal:${wId}:progress`) ?? '0';
  const progress = parseInt(progressRaw, 10);
  const threshold = BALANCE.FEAST_BOOTSTRAP_THRESHOLD;

  if (progress >= threshold) {
    await context.redis.hSet(`feast:goal:${wId}`, { status: 'completed', progress: String(progress), threshold: String(threshold) });
  } else {
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) {
      // Sunday: close the week
      await context.redis.hSet(`feast:goal:${wId}`, { status: 'failed', progress: String(progress), threshold: String(threshold) });
    }
  }
}

export { POOL, todayStr, weekId };
