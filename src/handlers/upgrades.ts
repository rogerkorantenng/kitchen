import type { Context } from '@devvit/public-api';
import type { SaveState, StationSlot, StationType } from '../../core/save-schema.js';
import { upgradeCost, computeIncomePerSec, computeRenownGained, canPrestige, startingCoinsAfterVoyage } from '../../core/economy.js';
import { BALANCE } from '../../core/balance.config.js';
import { saveState } from './state.js';

// Hire costs (one-time, per tier)
const HIRE_COOK_COST = 1000;
const HIRE_SERVER_COST = 1500;

// New station unlock cost (flat per tier for now)
const NEW_STATION_COST = 250;

const STATION_TYPES: StationType[] = ['grill', 'fryer', 'wok', 'bakery', 'prep', 'smoker'];

// Buy upgrade for an existing station
export async function buyUpgrade(
  context: Context,
  state: SaveState,
  stationId: string
): Promise<{ ok: boolean; reason?: string; state: SaveState }> {
  const station = state.stations.find((s) => s.id === stationId);
  if (!station) return { ok: false, reason: 'station-not-found', state };

  const cost = upgradeCost(station.level);
  if (state.coins < cost) return { ok: false, reason: 'insufficient-coins', state };

  state.coins -= cost;
  state.lifetimeCoinsThisRun += 0; // upgrades don't count as earned coins
  station.level += 1;

  // Recompute income snapshot
  state.incomePerSec = computeIncomePerSec(state.stations, state.incomeMultiplierLevel, () => 1);

  await saveState(context, state);
  return { ok: true, state };
}

// Unlock a new station slot
export async function buyNewStation(
  context: Context,
  state: SaveState,
  stationType: StationType
): Promise<{ ok: boolean; reason?: string; state: SaveState }> {
  const cost = NEW_STATION_COST * (state.stations.length + 1);
  if (state.coins < cost) return { ok: false, reason: 'insufficient-coins', state };

  // Find next open grid slot (left to right, top to bottom)
  const occupied = new Set(state.stations.map((s) => `${s.x},${s.y}`));
  let slotX = 0, slotY = 0, found = false;
  outer: for (let y = 0; y < BALANCE.GRID_ROWS; y++) {
    for (let x = 0; x < BALANCE.GRID_COLS; x++) {
      if (!occupied.has(`${x},${y}`)) { slotX = x; slotY = y; found = true; break outer; }
    }
  }
  if (!found) return { ok: false, reason: 'no-grid-space', state };

  state.coins -= cost;
  const newStation: StationSlot = {
    id: `station-${Date.now()}`,
    x: slotX,
    y: slotY,
    stationType,
    level: 0,
    hasCook: false,
    hasServer: false,
  };
  state.stations.push(newStation);
  state.incomePerSec = computeIncomePerSec(state.stations, state.incomeMultiplierLevel, () => 1);

  await saveState(context, state);
  return { ok: true, state };
}

// Hire a cook for a station (enables auto-cooking)
export async function hireCook(
  context: Context,
  state: SaveState,
  stationId: string
): Promise<{ ok: boolean; reason?: string; state: SaveState }> {
  const station = state.stations.find((s) => s.id === stationId);
  if (!station) return { ok: false, reason: 'station-not-found', state };
  if (station.hasCook) return { ok: false, reason: 'already-hired', state };

  const cost = HIRE_COOK_COST * (state.stations.indexOf(station) + 1);
  if (state.coins < cost) return { ok: false, reason: 'insufficient-coins', state };

  state.coins -= cost;
  station.hasCook = true;
  state.incomePerSec = computeIncomePerSec(state.stations, state.incomeMultiplierLevel, () => 1);

  await saveState(context, state);
  return { ok: true, state };
}

// Hire a server for a station (enables auto-serving)
export async function hireServer(
  context: Context,
  state: SaveState,
  stationId: string
): Promise<{ ok: boolean; reason?: string; state: SaveState }> {
  const station = state.stations.find((s) => s.id === stationId);
  if (!station) return { ok: false, reason: 'station-not-found', state };
  if (station.hasServer) return { ok: false, reason: 'already-hired', state };

  const cost = HIRE_SERVER_COST * (state.stations.indexOf(station) + 1);
  if (state.coins < cost) return { ok: false, reason: 'insufficient-coins', state };

  state.coins -= cost;
  station.hasServer = true;

  await saveState(context, state);
  return { ok: true, state };
}

// Trigger New Voyage prestige
// Uses a voyageInProgress lock key to prevent double-tap
export async function newVoyage(
  context: Context,
  state: SaveState
): Promise<{ ok: boolean; reason?: string; renownGained: number; state: SaveState }> {
  if (!canPrestige(state)) return { ok: false, reason: 'threshold-not-met', renownGained: 0, state };

  // Lock to prevent double-prestige from rapid double-taps
  const lockKey = `voyage-lock:${context.userId ?? 'anon'}`;
  const locked = await context.redis.get(lockKey);
  if (locked) return { ok: false, reason: 'already-in-progress', renownGained: 0, state };
  await context.redis.set(lockKey, '1', { expiration: new Date(Date.now() + 10_000) });

  const renownGained = computeRenownGained(state.lifetimeCoinsThisRun);
  const startingCoins = startingCoinsAfterVoyage(state.startingCoinsLevel);

  // Reset run, persist prestige gains
  state.coins = startingCoins;
  state.lifetimeCoinsThisRun = 0;
  state.stations = [];
  state.crew = [];
  state.renown += renownGained;
  state.voyageCount += 1;
  state.unlockedCuisineTiers = Math.min(state.unlockedCuisineTiers + 1, 5);
  state.incomePerSec = 0;
  state.rerollsToday = 0;

  await saveState(context, state);
  await context.redis.del(lockKey);

  return { ok: true, renownGained, state };
}

export { STATION_TYPES };
