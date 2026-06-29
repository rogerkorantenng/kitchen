import type { Context } from '@devvit/public-api';
import type { SaveState } from '../../core/save-schema.js';
import { migrateSave } from '../../core/save-schema.js';
import { computeOfflineEarnings } from '../../core/economy.js';

function stateKey(userId: string): string {
  return `user:${userId}:state`;
}

// Load state, compute offline earnings, write lastSeen = now.
// Writing lastSeen on EVERY load (not only on blur) because
// visibilitychange/blur does not fire reliably in Devvit iframes on Reddit mobile.
export async function getState(context: Context): Promise<SaveState> {
  const userId = context.userId ?? 'anon';
  const raw = await context.redis.get(stateKey(userId));
  const parsed: Partial<SaveState> = raw ? JSON.parse(raw) : {};
  const state = migrateSave(parsed);

  const now = Date.now();
  const elapsed = now - (state.lastSeen || now);

  if (elapsed > 0 && state.incomePerSec > 0) {
    const earned = computeOfflineEarnings(
      state.incomePerSec,
      elapsed,
      state.offlineCapLevel,
      state.offlineEffLevel
    );
    state.coins += earned;
    state.lifetimeCoinsThisRun += earned;
  }

  state.lastSeen = now;
  await context.redis.set(stateKey(userId), JSON.stringify(state));

  return state;
}

// Explicit save — called on purchases, upgrades, prestige, offline-claim
export async function saveState(context: Context, state: SaveState): Promise<void> {
  const userId = context.userId ?? 'anon';
  state.lastSeen = Date.now();
  await context.redis.set(stateKey(userId), JSON.stringify(state));
}

// Increment feast counter (cheap Redis op on every dish served — realtime publish batched separately)
export async function incrementFeast(context: Context, weekId: string, amount = 1): Promise<void> {
  await context.redis.incrBy(`feast:goal:${weekId}:progress`, amount);
}
