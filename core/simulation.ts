// Simulation types and helpers — ZERO platform imports.
// Adjacency bonuses: Week 6. Grid: 4 cols × 3 rows per deck.

import type { StationType } from './save-schema.js';
import { BALANCE } from './balance.config.js';

// Grid slot — coordinates present from day 1, adjacency bonuses unused until Week 6
export interface StationSlot {
  id: string;
  x: number; // 0..3
  y: number; // 0..2
  stationType: StationType;
  level: number;
  hasCook: boolean;
  hasServer: boolean;
}

export interface Customer {
  id: string;
  orderCategory: string;
  patienceMs: number;      // total patience budget
  spawnedAt: number;       // Date.now() when spawned
  isVIP: boolean;
  tipMultiplier: number;   // 1.0 baseline, higher for VIPs served fast
}

export interface CookTimer {
  stationId: string;
  startedAt: number;       // Date.now()
  durationMs: number;
  category: string;
}

// Base patience per customer type (ms)
export const BASE_PATIENCE = {
  regular: 12_000,
  vip: 6_000,
  bigOrder: 15_000,
} as const;

// Crew personality modifiers applied to customer queue timer
export const PERSONALITY_PATIENCE_MOD = {
  'speed-demon':   1.2,  // faster service → customers wait less → modifier > 1 (more time tolerance)
  perfectionist:  0.9,  // slower service → customers less tolerant
  steady:         1.0,
} as const;

// Whether two stations are adjacent (orthogonally) — for Week 6 adjacency bonuses
export function areAdjacent(a: StationSlot, b: StationSlot): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

// Spawn a customer (client-side — uses Date.now() not Phaser time)
export function spawnCustomer(
  id: string,
  category: string,
  isVIP: boolean,
  serverPersonality: 'speed-demon' | 'perfectionist' | 'steady'
): Customer {
  const base = isVIP ? BASE_PATIENCE.vip : BASE_PATIENCE.regular;
  const mod = PERSONALITY_PATIENCE_MOD[serverPersonality];
  return {
    id,
    orderCategory: category,
    patienceMs: base * mod,
    spawnedAt: Date.now(),
    isVIP,
    tipMultiplier: isVIP ? 1.5 : 1.0,
  };
}

// Whether a customer has run out of patience
export function hasExpired(customer: Customer): boolean {
  return Date.now() - customer.spawnedAt > customer.patienceMs;
}

// Grid helpers
export function slotKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isValidSlot(x: number, y: number): boolean {
  return x >= 0 && x < BALANCE.GRID_COLS && y >= 0 && y < BALANCE.GRID_ROWS;
}
