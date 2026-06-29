import type { Context } from '@devvit/public-api';
import type { SaveState } from '../../core/save-schema.js';
import { BALANCE } from '../../core/balance.config.js';
import { saveState } from './state.js';

type MetaUpgrade =
  | 'incomeMultiplierLevel'
  | 'offlineCapLevel'
  | 'offlineEffLevel'
  | 'cookSpeedLevel'
  | 'startingCoinsLevel'
  | 'royaltyBoostLevel';

interface MetaUpgradeDef {
  field: MetaUpgrade;
  maxLevel: number;
  costTable: readonly number[];
  label: string;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    field: 'incomeMultiplierLevel',
    maxLevel: 5,
    costTable: BALANCE.INCOME_MULT_COST,
    label: '+10% global income',
  },
  {
    field: 'offlineCapLevel',
    maxLevel: 4,
    costTable: BALANCE.OFFLINE_CAP_COST,
    label: '+4h offline cap',
  },
  {
    field: 'offlineEffLevel',
    maxLevel: 3,
    costTable: BALANCE.OFFLINE_EFF_COST,
    label: '+15% offline efficiency',
  },
  {
    field: 'cookSpeedLevel',
    maxLevel: 3,
    costTable: BALANCE.COOK_SPEED_COST,
    label: '-10% cook time',
  },
  {
    field: 'startingCoinsLevel',
    maxLevel: 3,
    costTable: BALANCE.STARTING_COINS_COST,
    label: 'More starting coins',
  },
  {
    field: 'royaltyBoostLevel',
    maxLevel: 2,
    costTable: BALANCE.ROYALTY_BOOST_COST,
    label: 'Recipe royalty boost',
  },
];

export async function buyMetaUpgrade(
  context: Context,
  state: SaveState,
  field: MetaUpgrade
): Promise<{ ok: boolean; reason?: string; state: SaveState }> {
  const def = META_UPGRADES.find((u) => u.field === field);
  if (!def) return { ok: false, reason: 'unknown-upgrade', state };

  const currentLevel = state[field] as number;
  if (currentLevel >= def.maxLevel) return { ok: false, reason: 'already-maxed', state };

  const cost = def.costTable[currentLevel];
  if (cost === undefined) return { ok: false, reason: 'cost-not-found', state };
  if (state.renown < cost) return { ok: false, reason: 'insufficient-renown', state };

  state.renown -= cost;
  (state[field] as number) += 1;

  await saveState(context, state);
  return { ok: true, state };
}

export async function buyExtraReroll(
  context: Context,
  state: SaveState
): Promise<{ ok: boolean; reason?: string; state: SaveState }> {
  if (state.extraRerollUnlocked) return { ok: false, reason: 'already-unlocked', state };
  if (state.renown < BALANCE.EXTRA_REROLL_COST) return { ok: false, reason: 'insufficient-renown', state };
  state.renown -= BALANCE.EXTRA_REROLL_COST;
  state.extraRerollUnlocked = true;
  await saveState(context, state);
  return { ok: true, state };
}

export async function getLeaderboard(
  context: Context,
  kind: 'renown' | 'creators'
): Promise<{ userId: string; username: string; score: number; rank: number }[]> {
  const key = kind === 'renown' ? 'leaderboard:renown' : 'leaderboard:creators';

  // Redis sorted set — ZREVRANGE with scores
  const entries = await context.redis.zRange(key, 0, 9, { reverse: true, by: 'rank' });
  if (!entries || entries.length === 0) return [];

  const result: { userId: string; username: string; score: number; rank: number }[] = [];
  let rank = 1;
  for (const entry of entries) {
    // entry is { member: string, score: number }
    const userId = typeof entry === 'string' ? entry : (entry as { member: string }).member;
    const score  = typeof entry === 'string' ? 0    : (entry as { member: string; score: number }).score;
    const nameKey = `username:${userId}`;
    const username = (await context.redis.get(nameKey)) ?? userId;
    result.push({ userId, username, score, rank: rank++ });
  }
  return result;
}

// Update Renown leaderboard after a New Voyage
export async function updateRenownLeaderboard(
  context: Context,
  userId: string,
  username: string,
  totalRenown: number
): Promise<void> {
  await context.redis.zAdd('leaderboard:renown', { member: userId, score: totalRenown });
  await context.redis.set(`username:${userId}`, username);
}
