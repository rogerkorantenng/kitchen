// Pure economy functions — ZERO platform imports.

import { BALANCE } from './balance.config.js';
import type { SaveState, StationSlot } from './save-schema.js';

// Cost to upgrade a station to level n
export function upgradeCost(baseLevel: number): number {
  return Math.floor(BALANCE.BASE_COST * Math.pow(BALANCE.COST_GROWTH, baseLevel));
}

// Dish price for a station at level n
export function dishPrice(level: number): number {
  return Math.floor(BALANCE.BASE_DISH_VALUE * Math.pow(1 + BALANCE.VALUE_STEP, level) * 100) / 100;
}

// Cook speed in ms (lower = faster)
export function cookTimeMs(baseMs: number, cookSpeedLevel: number): number {
  const reduction = cookSpeedLevel * BALANCE.COOK_SPEED_REDUCTION;
  return Math.max(500, baseMs * (1 - reduction));
}

// Global income multiplier from Renown upgrades
export function globalMultiplier(incomeMultLevel: number): number {
  return 1 + incomeMultLevel * BALANCE.INCOME_MULT_PER_LEVEL;
}

// Income per second across all stations
export function computeIncomePerSec(
  stations: StationSlot[],
  incomeMultLevel: number,
  cravingMult: (category: string) => number
): number {
  const base = stations.reduce((sum, s) => {
    const price = dishPrice(s.level);
    const cookMs = cookTimeMs(3000, 0); // 3s base cook time
    const perSec = price / (cookMs / 1000);
    return sum + perSec * cravingMult(s.stationType);
  }, 0);
  return base * globalMultiplier(incomeMultLevel);
}

// Offline earnings when player returns
export function computeOfflineEarnings(
  incomePerSec: number,
  elapsedMs: number,
  offlineCapLevel: number,
  offlineEffLevel: number
): number {
  const cap = BALANCE.OFFLINE_CAP_MS_PER_LEVEL[offlineCapLevel] ?? BALANCE.OFFLINE_CAP_MS_PER_LEVEL[0];
  const eff = BALANCE.OFFLINE_EFF_PER_LEVEL[offlineEffLevel] ?? BALANCE.OFFLINE_EFF_PER_LEVEL[0];
  const cappedElapsed = Math.min(elapsedMs, cap);
  return Math.floor(incomePerSec * (cappedElapsed / 1000) * eff);
}

// Renown earned on New Voyage
export function computeRenownGained(lifetimeCoins: number): number {
  return Math.floor(BALANCE.RENOWN_K * Math.sqrt(lifetimeCoins / BALANCE.RENOWN_SCALE));
}

// Whether the player can trigger New Voyage
export function canPrestige(state: SaveState): boolean {
  return state.lifetimeCoinsThisRun >= BALANCE.PRESTIGE_THRESHOLD;
}

// Starting coins after a New Voyage
export function startingCoinsAfterVoyage(startingCoinsLevel: number): number {
  const table = BALANCE.STARTING_COINS_PER_LEVEL;
  return table[startingCoinsLevel] ?? 0;
}

// Renown cost for a meta-upgrade
export function metaUpgradeCost(
  upgrade: keyof typeof BALANCE,
  currentLevel: number
): number | null {
  const raw = BALANCE[upgrade];
  if (!Array.isArray(raw)) return null;
  const table = raw as unknown as readonly number[];
  return table[currentLevel] ?? null; // null = maxed
}
