// All tunable constants in one place. Zero platform imports.
// Adjust these during playtesting — no code changes needed elsewhere.

export const BALANCE = {
  // Economy scaling
  BASE_COST: 10,
  COST_GROWTH: 1.10,
  BASE_DISH_VALUE: 1,
  VALUE_STEP: 0.15,
  BATCH_BASE: 1,

  // Offline earnings
  OFFLINE_CAP_MS_PER_LEVEL: [
    8 * 60 * 60 * 1000,   // level 0 (baseline) = 8h
    12 * 60 * 60 * 1000,  // level 1
    16 * 60 * 60 * 1000,  // level 2
    20 * 60 * 60 * 1000,  // level 3
    24 * 60 * 60 * 1000,  // level 4
  ] as const,

  OFFLINE_EFF_PER_LEVEL: [0.50, 0.65, 0.75, 0.85] as const,

  // Prestige
  PRESTIGE_THRESHOLD: 1_000_000, // coins to unlock New Voyage button
  RENOWN_K: 10,
  RENOWN_SCALE: 20_000,

  // Craving multipliers
  CRAZE_MULT: 8,
  CRAVED_MULT_HIGH: 5,
  CRAVED_MULT_LOW: 3,
  BASE_MULT: 1,

  // Craving thresholds
  CRAZE_HIT_THRESHOLD: 2,  // ≥2 keyword hits → craze
  CRAVED_HIT_THRESHOLD: 1, // ≥1 keyword hit → craved

  // Supply chain
  DOCK_DISCOUNT_MIN: 0.5,
  DOCK_DISCOUNT_MAX: 0.7,
  EMERGENCY_SUPPLY_PENALTY: 1.3,

  // Community Feast
  FEAST_BOOTSTRAP_THRESHOLD: 1_000, // servings (week 1 default, tuned post-launch)
  FEAST_SUCCESS_BUFF: 1.5,          // ×1.5 income for 24h on success
  FEAST_CONSOLATION_TOKENS: 5,
  FEAST_SUCCESS_TOKENS: 15,
  FEAST_REALTIME_INTERVAL_MS: 30_000, // publish every 30s, not per-dish

  // Streak rewards
  STREAK_DAILY_TOKENS: 2,
  STREAK_WEEKLY_TOKENS: 10,
  STREAK_MONTHLY_TOKENS: 30,

  // Meta upgrade trees (Renown cost per level)
  INCOME_MULT_COST: [50, 120, 250, 500, 1000],
  INCOME_MULT_PER_LEVEL: 0.10, // +10% per level

  OFFLINE_CAP_COST: [30, 80, 180, 400],
  OFFLINE_EFF_COST: [40, 100, 250],

  COOK_SPEED_COST: [60, 150, 350],
  COOK_SPEED_REDUCTION: 0.10, // -10% cook time per level

  STARTING_COINS_COST: [20, 60, 150],
  STARTING_COINS_PER_LEVEL: [500, 1500, 5000] as const,

  EXTRA_REROLL_COST: 200,
  ROYALTY_BOOST_COST: [80, 200],
  ROYALTY_BOOST_PER_LEVEL: [0.25, 0.60] as const,

  // Trade token spend paths
  TOKEN_BARGE_SKIN: 50,
  TOKEN_HARBOR_REROLL: 10,
  TOKEN_OFFLINE_EXTEND: 25,
  TOKEN_MENU_REROLL: 5,

  // UGC
  RECIPE_PROMOTIONS_PER_DAY: 3,
  RARITY_RARE_THRESHOLD: 50,      // upvotes
  RARITY_LEGENDARY_THRESHOLD: 200, // upvotes
  ROYALTY_PER_SALE: 0.1,          // Trade Tokens (rounds up at claim)

  // Balance targets (used in tests/QA)
  FIRST_UPGRADE_TARGET_MS: 20_000,    // affordable in <20s
  FIRST_STATION_TARGET_MS: 120_000,   // <2 min
  FIRST_VOYAGE_TARGET_MIN: 30,        // 30-45 min play
  FIRST_VOYAGE_TARGET_MAX: 45,

  // Grid
  GRID_COLS: 4,
  GRID_ROWS: 3,
} as const;

export type BalanceConfig = typeof BALANCE;
