// All game state types. Zero platform imports — pure TypeScript.

export type StationType =
  | 'grill'
  | 'fryer'
  | 'wok'
  | 'bakery'
  | 'prep'
  | 'smoker';

export type DishCategory =
  | 'spicy'
  | 'batch'
  | 'grilled'
  | 'baked'
  | 'fresh'
  | 'comfort'
  | 'street'
  | 'artisan';

// Grid slot for a station — adjacency bonuses active Week 6
export interface StationSlot {
  id: string;
  x: number; // 0..3 (4-col grid per deck)
  y: number; // 0..2 (3-row grid per deck)
  stationType: StationType;
  level: number;
  hasCook: boolean;   // auto-cooks when true
  hasServer: boolean; // auto-serves when true
}

export interface CrewMember {
  slotIndex: number;
  personality: 'speed-demon' | 'perfectionist' | 'steady';
  name: string;
  subredditOrigin: string;
}

export interface CravingMultiplier {
  category: DishCategory;
  multiplier: number; // 1, 3, 5, or 8
  label: string;      // e.g. "Spice Seekers" — shown on harbor banner
}

export interface CravingResult {
  multipliers: CravingMultiplier[];
  crazeCategory: DishCategory | null; // the ×8 craze, if any
  derivedFrom: 'live' | 'cached' | 'fallback' | 'description';
  subredditId: string;
  date: string; // YYYY-MM-DD
}

export interface SaveState {
  saveVersion: number;

  // Economy
  coins: number;
  renown: number;
  tradeTokens: number;
  lifetimeCoinsThisRun: number;

  // Kitchen
  stations: StationSlot[];
  crew: CrewMember[];

  // Prestige
  voyageCount: number;
  unlockedCuisineTiers: number; // 0 = tier 1 only, 1 = tier 2 unlocked, etc.

  // Meta upgrades (Renown spend)
  incomeMultiplierLevel: number;   // 0-5
  offlineCapLevel: number;         // 0-4 → 8h/12h/16h/20h/24h
  offlineEffLevel: number;         // 0-3 → 50/65/75/85%
  cookSpeedLevel: number;          // 0-3
  startingCoinsLevel: number;      // 0-3
  extraRerollUnlocked: boolean;
  royaltyBoostLevel: number;       // 0-2

  // Daily state
  streak: number;
  lastStreakDate: string;          // YYYY-MM-DD
  rerollsToday: number;
  lastSeen: number;               // unix ms — written on every getState() load

  // Income snapshot for offline calc
  incomePerSec: number;           // snapshotted at last save
}

export interface Dish {
  dishId: string;
  name: string;
  emoji: string;
  blurb: string;
  category: DishCategory;
  creatorId: string;
  creatorUsername: string;
  rarity: 'common' | 'rare' | 'legendary';
  creatorStatus: 'active' | 'deleted';
  promotedAt: string; // ISO date
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

export interface FeastProgress {
  progress: number;
  threshold: number;
  status: 'active' | 'completed' | 'failed';
  weekId: string;
}

export interface RecipeDraft {
  name: string;
  emoji: string;
  blurb: string;
  category: DishCategory;
}

export function defaultState(): SaveState {
  return {
    saveVersion: 1,
    coins: 50,  // starter coins so first upgrade is affordable immediately
    renown: 0,
    tradeTokens: 0,
    lifetimeCoinsThisRun: 0,
    // Every new player starts with one free Grill station
    stations: [{
      id: 'station-starter',
      x: 0, y: 0,
      stationType: 'grill' as StationType,
      level: 0,
      hasCook: false,
      hasServer: false,
    }],
    crew: [],
    voyageCount: 0,
    unlockedCuisineTiers: 0,
    incomeMultiplierLevel: 0,
    offlineCapLevel: 0,
    offlineEffLevel: 0,
    cookSpeedLevel: 0,
    startingCoinsLevel: 0,
    extraRerollUnlocked: false,
    royaltyBoostLevel: 0,
    streak: 0,
    lastStreakDate: '',
    rerollsToday: 0,
    lastSeen: Date.now(),
    incomePerSec: 0.33, // starter grill at level 0: 1 coin / 3s
  };
}

// Migrate old save versions forward
export function migrateSave(raw: Partial<SaveState>): SaveState {
  const base = defaultState();
  const merged = { ...base, ...raw, saveVersion: 1 };
  // Give starter station to any player who has none (fresh save or pre-starter migration)
  if (!merged.stations || merged.stations.length === 0) {
    merged.stations = base.stations;
    merged.coins = Math.max(merged.coins, base.coins);
    merged.incomePerSec = base.incomePerSec;
  }
  return merged;
}
