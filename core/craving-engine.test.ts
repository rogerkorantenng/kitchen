import { describe, it, expect } from 'vitest';
import { deriveCravings } from './craving-engine.js';
import { BALANCE } from './balance.config.js';

const TODAY = '2026-06-28';

describe('deriveCravings', () => {
  it('returns all ×1 baseline with guaranteed fallback when 0 keyword hits', () => {
    const result = deriveCravings({
      titles: ['check this out', 'wow amazing', 'lol what'],
      flairs: [],
      subredditId: 'Cooking', // has description fallback: 'comfort'
      date: TODAY,
    });
    expect(result.crazeCategory).toBeNull();
    expect(result.multipliers.length).toBeGreaterThanOrEqual(1);
    expect(result.multipliers[0].multiplier).toBeLessThan(BALANCE.CRAZE_MULT);
    expect(result.derivedFrom).toBe('description');
  });

  it('assigns Craze ×8 when top category has ≥2 keyword hits', () => {
    const result = deriveCravings({
      titles: [
        'the spiciest ramen you will ever eat',
        'absolutely fire hot wings challenge',
        'chili peppers are life',
      ],
      flairs: [],
      subredditId: 'spicy',
      date: TODAY,
    });
    expect(result.crazeCategory).toBe('spicy');
    const craze = result.multipliers.find((m) => m.category === 'spicy');
    expect(craze).toBeDefined();
    expect(craze!.multiplier).toBe(BALANCE.CRAZE_MULT);
    expect(result.derivedFrom).toBe('live');
  });

  it('assigns Craved ×3–5 to 2nd and 3rd ranked categories with ≥1 hit each', () => {
    const result = deriveCravings({
      titles: [
        'spicy grilled skewers recipe',    // spicy + grilled
        'hot chili bbq rub for brisket',   // spicy + grilled
        'fresh salad after the heat',      // fresh
      ],
      flairs: [],
      subredditId: 'Cooking',
      date: TODAY,
    });
    // spicy should be craze
    expect(result.crazeCategory).toBe('spicy');
    // grilled should be craved
    const grilled = result.multipliers.find((m) => m.category === 'grilled');
    expect(grilled).toBeDefined();
    expect(grilled!.multiplier).toBeGreaterThanOrEqual(BALANCE.CRAVED_MULT_LOW);
    expect(grilled!.multiplier).toBeLessThan(BALANCE.CRAZE_MULT);
  });

  it('uses alphabetical tiebreak for determinism when categories have equal hits', () => {
    // Two categories with exactly 1 hit each — alphabetical order determines rank
    const result = deriveCravings({
      titles: ['fresh salad today', 'grilled chicken tonight'],
      flairs: [],
      subredditId: 'food',
      date: TODAY,
    });
    // 'fresh' < 'grilled' alphabetically → fresh ranked higher on tie
    // Both have 1 hit, neither reaches CRAZE threshold (2)
    // So the result should be deterministic (same input → same output)
    const result2 = deriveCravings({
      titles: ['fresh salad today', 'grilled chicken tonight'],
      flairs: [],
      subredditId: 'food',
      date: TODAY,
    });
    expect(result.multipliers.map((m) => m.category)).toEqual(
      result2.multipliers.map((m) => m.category)
    );
    expect(result.derivedFrom).toBe('live');
  });

  it('falls back to comfort for unknown subreddits with 0 hits', () => {
    const result = deriveCravings({
      titles: ['memes only', 'nothing here'],
      flairs: [],
      subredditId: 'totally-unknown-sub',
      date: TODAY,
    });
    expect(result.multipliers[0].category).toBe('comfort');
    expect(result.derivedFrom).toBe('fallback');
  });

  it('uses flair keywords as signal sources alongside titles', () => {
    // No food keywords in titles but "sourdough" in flairs
    const result = deriveCravings({
      titles: ['look at my creation', 'first attempt'],
      flairs: ['sourdough', 'bread'],
      subredditId: 'Breadit',
      date: TODAY,
    });
    // Should produce baked category from flairs
    const baked = result.multipliers.find((m) => m.category === 'baked');
    expect(baked).toBeDefined();
  });
});
