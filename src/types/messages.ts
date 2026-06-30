import type { SaveState, CravingResult, LeaderboardEntry, Dish, FeastProgress } from '../../core/save-schema.js';

// Client → Server (webview sends these to Devvit)
export type WebViewMessage =
  | { type: 'INIT'; data?: { anonId?: string } }
  | { type: 'GET_STATE' }
  | { type: 'SAVE_STATE'; data: { state: SaveState } }
  | { type: 'RESET_STATE'; data?: { __reqId?: number } }
  | { type: 'GET_CRAVINGS' }
  | { type: 'BUY_UPGRADE'; data: { stationId: string; __reqId?: number } }
  | { type: 'BUY_NEW_STATION'; data: { stationType: string; __reqId?: number } }
  | { type: 'HIRE_COOK'; data: { stationId: string; __reqId?: number } }
  | { type: 'HIRE_SERVER'; data: { stationId: string; __reqId?: number } }
  | { type: 'HIRE_CREW'; data: { stationType: string; __reqId?: number } }
  | { type: 'CLAIM_OFFLINE'; data: { __reqId?: number } }
  | { type: 'NEW_VOYAGE'; data: { __reqId?: number } }
  | { type: 'SUBMIT_RECIPE'; data: { name: string; emoji: string; blurb: string; category: string } }
  | { type: 'GET_RECIPE_BOOK' }
  | { type: 'GET_LEADERBOARD'; data: { kind: 'renown' | 'creators' } }
  | { type: 'REROLL_HARBOR'; data: { __reqId?: number } }
  | { type: 'GET_FEAST_PROGRESS' }
  | { type: 'DISH_SERVED'; data: { stationId: string; category: string } }
  | { type: 'BUY_META_UPGRADE'; data: { field: string; __reqId?: number } }
  | { type: 'BUY_EXTRA_REROLL'; data: { __reqId?: number } }
  | { type: 'BUY_INGREDIENTS'; data: { ingredientId: string; quantity: number; __reqId?: number } }
  | { type: 'RECRUIT_CREW'; data: { personality: string; __reqId?: number } }
  | { type: 'GET_CREW' }
  | { type: 'GET_STOCK' };

// Server → Client (Devvit sends these to webview)
export type DevvitMessage =
  | { type: 'INIT_RESPONSE'; data: { username: string; userId: string; state: SaveState; cravings: { harborId: string; cravings: CravingResult }; offlineEarned?: number } }
  | { type: 'STATE_RESPONSE'; data: { state: SaveState; __reqId?: number } }
  | { type: 'CRAVINGS_RESPONSE'; data: { harborId: string; cravings: CravingResult } }
  | { type: 'UPGRADE_RESPONSE'; data: { state: SaveState; ok: boolean; __reqId?: number } }
  | { type: 'OFFLINE_CLAIMED'; data: { coinsGranted: number; state: SaveState; __reqId?: number } }
  | { type: 'VOYAGE_COMPLETE'; data: { renownGained: number; state: SaveState; __reqId?: number } }
  | { type: 'RECIPE_SUBMITTED'; data: { ok: boolean; dishId?: string } }
  | { type: 'RECIPE_BOOK'; data: { dishes: Dish[] } }
  | { type: 'LEADERBOARD_DATA'; data: { entries: LeaderboardEntry[] } }
  | { type: 'HARBOR_REROLLED'; data: { harborId: string; cravings: CravingResult; __reqId?: number } }
  | { type: 'FEAST_PROGRESS'; data: FeastProgress };
