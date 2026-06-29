// The contract every platform adapter must implement.
// Zero platform imports. /client and /core talk only through this.

import type {
  SaveState,
  CravingResult,
  Dish,
  LeaderboardEntry,
  FeastProgress,
  RecipeDraft,
} from './save-schema.js';

export interface PlatformAPI {
  // State
  getState(): Promise<SaveState>;
  saveState(s: SaveState): Promise<void>;

  // Cravings — resolves harbor:{date}:{userId} override, falls back to global
  getTodayCravings(userId: string): Promise<{ harborId: string; cravings: CravingResult }>;

  // Recipes / UGC
  submitRecipe(r: RecipeDraft): Promise<void>;
  getRecipeBook(): Promise<Dish[]>;

  // Social
  getLeaderboard(kind: 'renown' | 'creators'): Promise<LeaderboardEntry[]>;

  // Community Feast — realtime subscription
  onCommunityProgress(cb: (p: FeastProgress) => void): () => void; // returns unsubscribe fn

  // Token economy
  getTradeTokenBalance(userId: string): Promise<number>;
  claimRoyalties(userId: string): Promise<{ tokensGranted: number }>;

  // Harbor reroll (costs 1 rerollsToday token from state)
  rerollHarbor(userId: string): Promise<{ harborId: string; cravings: CravingResult }>;
}
