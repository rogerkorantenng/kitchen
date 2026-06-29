import { describe, it, expect } from 'vitest';
import { areAdjacent, spawnCustomer, hasExpired, isValidSlot } from './simulation.js';
import type { StationSlot } from './simulation.js';

function makeSlot(id: string, x: number, y: number): StationSlot {
  return { id, x, y, stationType: 'grill', level: 0, hasCook: false, hasServer: false };
}

describe('areAdjacent', () => {
  it('returns true for orthogonal neighbors', () => {
    expect(areAdjacent(makeSlot('a', 0, 0), makeSlot('b', 1, 0))).toBe(true);
    expect(areAdjacent(makeSlot('a', 0, 0), makeSlot('b', 0, 1))).toBe(true);
  });

  it('returns false for diagonal neighbors', () => {
    expect(areAdjacent(makeSlot('a', 0, 0), makeSlot('b', 1, 1))).toBe(false);
  });

  it('returns false for non-adjacent slots', () => {
    expect(areAdjacent(makeSlot('a', 0, 0), makeSlot('b', 2, 0))).toBe(false);
  });
});

describe('spawnCustomer', () => {
  it('creates customer with correct patience for steady server', () => {
    const c = spawnCustomer('c1', 'grilled', false, 'steady');
    expect(c.patienceMs).toBe(12_000);
    expect(c.isVIP).toBe(false);
  });

  it('VIP has shorter patience than regular', () => {
    const vip = spawnCustomer('v1', 'spicy', true, 'steady');
    const reg = spawnCustomer('r1', 'spicy', false, 'steady');
    expect(vip.patienceMs).toBeLessThan(reg.patienceMs);
  });

  it('speed-demon server gives customers more patience', () => {
    const sd  = spawnCustomer('s1', 'grilled', false, 'speed-demon');
    const pf  = spawnCustomer('p1', 'grilled', false, 'perfectionist');
    expect(sd.patienceMs).toBeGreaterThan(pf.patienceMs);
  });
});

describe('hasExpired', () => {
  it('returns false immediately after spawn', () => {
    const c = spawnCustomer('c1', 'grilled', false, 'steady');
    expect(hasExpired(c)).toBe(false);
  });

  it('returns true when patience is in the past', () => {
    const c = spawnCustomer('c1', 'grilled', false, 'steady');
    c.spawnedAt = Date.now() - 100_000; // 100s ago
    expect(hasExpired(c)).toBe(true);
  });
});

describe('isValidSlot', () => {
  it('accepts valid slots', () => {
    expect(isValidSlot(0, 0)).toBe(true);
    expect(isValidSlot(3, 2)).toBe(true);
  });

  it('rejects out-of-bounds slots', () => {
    expect(isValidSlot(-1, 0)).toBe(false);
    expect(isValidSlot(4, 0)).toBe(false);
    expect(isValidSlot(0, 3)).toBe(false);
  });
});
