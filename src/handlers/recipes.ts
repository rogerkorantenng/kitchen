import type { Context } from '@devvit/public-api';
import type { Dish, DishCategory } from '../../core/save-schema.js';
import { BALANCE } from '../../core/balance.config.js';

const ALLOWED_CATEGORIES: DishCategory[] = [
  'spicy','batch','grilled','baked','fresh','comfort','street','artisan',
];

const ALLOWED_EMOJIS = [
  '🥩','🍟','🥡','🍞','🥗','🍖','🍜','🌮','🍕','🍣','🥘',
  '🍲','🥟','🫕','🥚','🥞','🧆','🧇','🥓','🍳','🫙','🍱',
  '🧋','🍵','🥤','🍺','🥂','🫖','☕','🧃','🥛','🍶',
  '🍰','🎂','🍮','🍯','🍭','🍬','🍫','🍩','🍪','🧁',
  '🌽','🥕','🧅','🧄','🫑','🥦','🫘','🥜',
  '🍇','🍓','🍒','🍑','🥭','🍍','🥥','🍋','🍊','🍎',
];

function sanitize(text: string, maxLen: number): string {
  return text
    .replace(/[<>"'&]/g, '') // strip HTML chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function tradeCaravanPostKey(date: string): string {
  return `caravan-post:${date}`;
}

export async function submitRecipe(
  context: Context,
  name: string,
  emoji: string,
  blurb: string,
  category: string
): Promise<{ ok: boolean; reason?: string; dishId?: string }> {
  const userId = context.userId ?? 'anon';

  // Validate inputs
  const cleanName = sanitize(name, 30);
  const cleanBlurb = sanitize(blurb, 80);
  if (!cleanName) return { ok: false, reason: 'empty-name' };
  if (!ALLOWED_EMOJIS.includes(emoji)) return { ok: false, reason: 'invalid-emoji' };
  if (!ALLOWED_CATEGORIES.includes(category as DishCategory)) return { ok: false, reason: 'invalid-category' };

  // Rate limit: one submission per day per user
  const limitKey = `recipe-limit:${userId}:${today()}`;
  const existing = await context.redis.get(limitKey);
  if (existing) return { ok: false, reason: 'already-submitted-today' };

  const user = await context.reddit.getCurrentUser();
  const username = user?.username ?? 'Anonymous';

  const dishId = `dish-${userId}-${Date.now()}`;
  const dish = {
    dishId,
    name: cleanName,
    emoji,
    blurb: cleanBlurb,
    category: category as DishCategory,
    creatorId: userId,
    creatorUsername: username,
    rarity: 'common' as const,
    creatorStatus: 'active' as const,
    promotedAt: '',
    submittedAt: today(),
  };

  // Store submission
  await context.redis.set(`submission:${dishId}`, JSON.stringify(dish));

  // Add to today's submissions sorted set with score 0 (upvotes will increment)
  await context.redis.zAdd(`submissions:${today()}`, { member: dishId, score: 0 });

  // Rate limit marker (expires after 25h)
  await context.redis.set(limitKey, '1', { expiration: new Date(Date.now() + 25 * 60 * 60 * 1000) });

  // Mirror as comment on the Trade Caravan post
  await mirrorAsComment(context, dish);

  return { ok: true, dishId };
}

async function mirrorAsComment(context: Context, dish: ReturnType<typeof Object.assign>): Promise<void> {
  try {
    const date = today();
    const postIdRaw = await context.redis.get(tradeCaravanPostKey(date));
    if (!postIdRaw) return; // No caravan post yet — skip comment

    const postId = postIdRaw.trim();
    const commentText = [
      `**${dish.emoji} ${dish.name}** — *${dish.category}*`,
      dish.blurb,
      `Submitted by u/${dish.creatorUsername} | ID: \`${dish.dishId}\``,
      '',
      '*Upvote to promote to the Recipe Book!*',
    ].join('\n');

    await context.reddit.submitComment({ id: postId, text: commentText });
  } catch {
    // Non-fatal — comment mirror failure doesn't block the submission
  }
}

export async function getRecipeBook(context: Context): Promise<Dish[]> {
  const raw = await context.redis.hGetAll('recipebook:items');
  if (!raw) return [];
  return Object.values(raw).map((v) => JSON.parse(v as string) as Dish);
}

// Update upvote score for a submitted dish (called by scheduler after tallying Reddit upvotes)
export async function updateSubmissionScore(
  context: Context,
  dishId: string,
  upvotes: number
): Promise<void> {
  const date = today();
  await context.redis.zAdd(`submissions:${date}`, { member: dishId, score: upvotes });
}

// Grant royalty tokens when a promoted dish sells
export async function grantRoyalty(
  context: Context,
  creatorId: string,
  royaltyBoostLevel: number
): Promise<void> {
  const boost = 1 + (BALANCE.ROYALTY_BOOST_PER_LEVEL[royaltyBoostLevel - 1] ?? 0);
  const tokens = BALANCE.ROYALTY_PER_SALE * boost;
  // Accumulate fractional tokens — pay out when ≥1
  const accKey = `royalty:accrued:${creatorId}`;
  const currentRaw = await context.redis.get(accKey) ?? '0';
  const current = parseFloat(currentRaw) + tokens;
  if (current >= 1) {
    const whole = Math.floor(current);
    await context.redis.incrBy(`royalty:tokens:${creatorId}`, whole);
    await context.redis.set(accKey, String(current - whole));
    await context.redis.zIncrBy('leaderboard:creators', creatorId, whole);
  } else {
    await context.redis.set(accKey, String(current));
  }
}
