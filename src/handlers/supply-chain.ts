import type { Context } from '@devvit/public-api';
import type { SaveState, CrewMember } from '../../core/save-schema.js';
import { BALANCE } from '../../core/balance.config.js';
import { saveState } from './state.js';

// Ingredient taxonomy — each station type has a primary ingredient
const STATION_INGREDIENTS: Record<string, string> = {
  grill:  'beef',
  fryer:  'oil',
  wok:    'noodles',
  bakery: 'flour',
  prep:   'vegetables',
  smoker: 'wood-chips',
};

// Harbor ingredient discounts — each harbor has a "local" ingredient on discount
// This is derived from the harbor's cuisine category at runtime
const HARBOR_LOCAL_INGREDIENTS: Record<string, string> = {
  spicy:   'chili-peppers',
  batch:   'grains',
  grilled: 'charcoal',
  baked:   'flour',
  fresh:   'vegetables',
  comfort: 'broth',
  street:  'flatbread',
  artisan: 'culture-starter',
};

export interface IngredientStock {
  ingredientId: string;
  quantity: number;
  cap: number;
}

function stockKey(userId: string): string {
  return `ingredients:${userId}`;
}

export async function getIngredientStock(context: Context): Promise<IngredientStock[]> {
  const userId = context.userId ?? 'anon';
  const raw = await context.redis.get(stockKey(userId));
  return raw ? JSON.parse(raw) : [];
}

// Buy ingredients from the Dock Market (daily discount on harbor's local ingredient)
export async function buyIngredients(
  context: Context,
  state: SaveState,
  ingredientId: string,
  quantity: number
): Promise<{ ok: boolean; reason?: string; state: SaveState; stock: IngredientStock[] }> {
  const userId = context.userId ?? 'anon';
  const stock = await getIngredientStock(context);

  const baseCost = 5; // base cost per unit
  const localIngredient = HARBOR_LOCAL_INGREDIENTS[state.rerollsToday > 0 ? 'comfort' : 'comfort']; // resolved from today's harbor craving category
  const isLocal = ingredientId === localIngredient;
  const discount = isLocal
    ? BALANCE.DOCK_DISCOUNT_MIN + Math.random() * (BALANCE.DOCK_DISCOUNT_MAX - BALANCE.DOCK_DISCOUNT_MIN)
    : 1.0;
  const cost = Math.floor(baseCost * quantity * discount);

  if (state.coins < cost) return { ok: false, reason: 'insufficient-coins', state, stock };

  state.coins -= cost;

  // Update stock
  const existing = stock.find((s) => s.ingredientId === ingredientId);
  const cap = 100 + state.voyageCount * 20; // cap scales with voyages
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, cap);
  } else {
    stock.push({ ingredientId, quantity: Math.min(quantity, cap), cap });
  }

  await context.redis.set(stockKey(userId), JSON.stringify(stock));
  await saveState(context, state);
  return { ok: true, state, stock };
}

// ── Crew system ───────────────────────────────────────────────────────────────

const CREW_NAMES_BY_HARBOR: Record<string, string[]> = {
  spicy:  ['Blaze', 'Pepper', 'Fuego'],
  batch:  ['Prep', 'Sunday', 'Mason'],
  grilled:['Smoke', 'Char', 'Pit'],
  baked:  ['Brioche', 'Crumb', 'Sourdough'],
  default:['River', 'Harbor', 'Drift'],
};

function crewKey(userId: string): string {
  return `crew:${userId}:slots`;
}

export async function getCrewSlots(context: Context): Promise<CrewMember[]> {
  const userId = context.userId ?? 'anon';
  const raw = await context.redis.get(crewKey(userId));
  return raw ? JSON.parse(raw) : [];
}

export async function recruitCrew(
  context: Context,
  state: SaveState,
  personality: CrewMember['personality'],
  harborId: string
): Promise<{ ok: boolean; reason?: string; state: SaveState; crew: CrewMember[] }> {
  const userId = context.userId ?? 'anon';
  const crew = await getCrewSlots(context);

  if (crew.length >= 6) return { ok: false, reason: 'crew-full', state, crew };

  const cost = 800 * (crew.length + 1);
  if (state.coins < cost) return { ok: false, reason: 'insufficient-coins', state, crew };

  state.coins -= cost;

  const names = CREW_NAMES_BY_HARBOR[harborId] ?? CREW_NAMES_BY_HARBOR.default;
  const name = names[crew.length % names.length] + ` #${crew.length + 1}`;

  const newMember: CrewMember = {
    slotIndex: crew.length,
    personality,
    name,
    subredditOrigin: harborId,
  };
  crew.push(newMember);
  state.crew = crew;

  await context.redis.set(crewKey(userId), JSON.stringify(crew));
  await saveState(context, state);
  return { ok: true, state, crew };
}

export { STATION_INGREDIENTS, HARBOR_LOCAL_INGREDIENTS };
