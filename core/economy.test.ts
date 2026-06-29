import { describe, it, expect } from 'vitest';
import {
  upgradeCost, dishPrice, computeOfflineEarnings,
  computeRenownGained, canPrestige, globalMultiplier,
} from './economy.js';
import { BALANCE } from './balance.config.js';
import { defaultState } from './save-schema.js';

describe('upgradeCost', () => {
  it('level 0 returns BASE_COST', () => {
    expect(upgradeCost(0)).toBe(BALANCE.BASE_COST);
  });

  it('grows geometrically with COST_GROWTH', () => {
    const l0 = upgradeCost(0);
    const l1 = upgradeCost(1);
    expect(l1 / l0).toBeCloseTo(BALANCE.COST_GROWTH, 2);
  });

  it('level 10 is significantly more expensive than level 0', () => {
    expect(upgradeCost(10)).toBeGreaterThan(upgradeCost(0) * 2);
  });
});

describe('dishPrice', () => {
  it('level 0 returns BASE_DISH_VALUE', () => {
    expect(dishPrice(0)).toBe(BALANCE.BASE_DISH_VALUE);
  });

  it('grows with value step', () => {
    // dishPrice rounds to 2dp, so compare with 1dp precision
    expect(dishPrice(1)).toBeCloseTo(BALANCE.BASE_DISH_VALUE * (1 + BALANCE.VALUE_STEP), 1);
  });
});

describe('computeOfflineEarnings', () => {
  it('returns 0 when incomePerSec is 0', () => {
    expect(computeOfflineEarnings(0, 3600000, 0, 0)).toBe(0);
  });

  it('caps at OFFLINE_CAP_MS for level 0 (8h)', () => {
    const cap = BALANCE.OFFLINE_CAP_MS_PER_LEVEL[0];
    const eff = BALANCE.OFFLINE_EFF_PER_LEVEL[0];
    const income = 1; // 1 coin/sec
    const longer = computeOfflineEarnings(income, cap * 2, 0, 0);
    const capped = computeOfflineEarnings(income, cap, 0, 0);
    expect(longer).toBe(capped); // longer than cap → same result
    expect(capped).toBe(Math.floor(income * (cap / 1000) * eff));
  });

  it('uses higher cap at level 4 (24h)', () => {
    const cap0 = BALANCE.OFFLINE_CAP_MS_PER_LEVEL[0];
    const cap4 = BALANCE.OFFLINE_CAP_MS_PER_LEVEL[4];
    const e0 = computeOfflineEarnings(1, cap4, 0, 0);
    const e4 = computeOfflineEarnings(1, cap4, 4, 0);
    expect(e4).toBeGreaterThan(e0); // higher cap → more earnings for same elapsed
  });
});

describe('computeRenownGained', () => {
  it('returns 0 for 0 coins', () => {
    expect(computeRenownGained(0)).toBe(0);
  });

  it('grows with lifetime coins', () => {
    const r1 = computeRenownGained(100_000);
    const r2 = computeRenownGained(1_000_000);
    expect(r2).toBeGreaterThan(r1);
  });

  it('first voyage at threshold yields a meaningful amount', () => {
    const renown = computeRenownGained(BALANCE.PRESTIGE_THRESHOLD);
    expect(renown).toBeGreaterThan(0);
  });
});

describe('canPrestige', () => {
  it('returns false below threshold', () => {
    const state = defaultState();
    state.lifetimeCoinsThisRun = BALANCE.PRESTIGE_THRESHOLD - 1;
    expect(canPrestige(state)).toBe(false);
  });

  it('returns true at or above threshold', () => {
    const state = defaultState();
    state.lifetimeCoinsThisRun = BALANCE.PRESTIGE_THRESHOLD;
    expect(canPrestige(state)).toBe(true);
  });
});

describe('globalMultiplier', () => {
  it('level 0 returns 1', () => {
    expect(globalMultiplier(0)).toBe(1);
  });

  it('level 5 returns 1.5', () => {
    expect(globalMultiplier(5)).toBeCloseTo(1.5, 2);
  });
});
