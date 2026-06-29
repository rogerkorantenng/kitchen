// Pure function — ZERO platform imports.
// Input: raw post titles + flairs from Reddit (fetched by /adapters/devvit)
// Output: CravingResult with multipliers and a guaranteed non-trivial craving

import type { CravingResult, CravingMultiplier, DishCategory } from './save-schema.js';
import { BALANCE } from './balance.config.js';

// 8 dish categories with trigger keywords
// Keyword matching: titles lowercased, split on whitespace + punctuation, each
// token checked against this dictionary. No external NLP calls.
const KEYWORD_DICT: Record<DishCategory, string[]> = {
  spicy: [
    'spicy', 'hot', 'chili', 'chile', 'jalapeño', 'jalapeno', 'sriracha',
    'fire', 'heat', 'pepper', 'habanero', 'cayenne', 'scorpion', 'ghost',
    'burn', 'burning', 'flame',
  ],
  batch: [
    'meal', 'prep', 'batch', 'weekly', 'containers', 'portions', 'planning',
    'sunday', 'prepped', 'mealprep', 'bulk', 'make-ahead',
  ],
  grilled: [
    'grill', 'grilled', 'bbq', 'barbecue', 'smoke', 'smoked', 'smoky',
    'char', 'charred', 'brisket', 'ribs', 'pit', 'charcoal', 'skewer',
    'kebab',
  ],
  baked: [
    'bake', 'baked', 'oven', 'sourdough', 'bread', 'pastry', 'flour',
    'dough', 'rise', 'loaf', 'crumb', 'crust', 'brioche', 'focaccia',
    'croissant', 'muffin', 'biscuit',
  ],
  fresh: [
    'vegetarian', 'vegan', 'fresh', 'raw', 'salad', 'plant', 'veggie',
    'vegetables', 'greens', 'harvest', 'garden', 'crisp', 'light',
    'dairy-free', 'gluten-free',
  ],
  comfort: [
    'comfort', 'cozy', 'warming', 'hearty', 'slow-cooker', 'braise',
    'braised', 'stew', 'soup', 'casserole', 'creamy', 'rich', 'warm',
    'homestyle', 'nostalgic',
  ],
  street: [
    'street', 'quick', 'handheld', 'wrap', 'taco', 'dumpling', 'dim',
    'sum', 'bao', 'burger', 'sandwich', 'roll', 'flatbread', 'pita',
    'quesadilla',
  ],
  artisan: [
    'ferment', 'fermented', 'craft', 'artisan', 'cure', 'cured', 'pickle',
    'pickled', 'culture', 'lacto', 'kimchi', 'miso', 'koji', 'charcuterie',
    'aged',
  ],
};

// Human-readable flavor labels per category (shown on harbor banner)
const CATEGORY_LABELS: Record<DishCategory, string> = {
  spicy:   'The Spice Seekers',
  batch:   'Sunday Meal Preppers',
  grilled: 'Pit Masters',
  baked:   'The Breadheads',
  fresh:   'Garden Brigade',
  comfort: 'Cozy Kitchen Crew',
  street:  'Street Food Faithful',
  artisan: 'Craft & Culture Guild',
};

// Subreddit description keywords (curated at pool curation time, stored in config)
// This is the fallback: if live titles produce 0 hits, at least one craving
// is guaranteed from the sub's identity.
export const SUBREDDIT_DESCRIPTION_CATEGORIES: Record<string, DishCategory> = {
  food:              'comfort',
  Cooking:           'comfort',
  MealPrepSunday:    'batch',
  spicy:             'spicy',
  vegetarian:        'fresh',
  vegan:             'fresh',
  BBQ:               'grilled',
  sushi:             'fresh',
  ramen:             'comfort',
  Pizza:             'baked',
  tacos:             'street',
  Baking:            'baked',
  AskCulinary:       'comfort',
  Chefit:            'artisan',
  EatCheapAndHealthy:'batch',
  '52weeksofcooking':'artisan',
  GifRecipes:        'street',
  slowcooking:       'comfort',
  instantpot:        'comfort',
  fermentation:      'artisan',
  mead:              'artisan',
  Coffee:            'artisan',
  Sourdough:         'baked',
  Breadit:           'baked',
  cheesemaking:      'artisan',
  smoking:           'grilled',
  grilling:          'grilled',
  IndianFood:        'spicy',
  mexicanfood:       'street',
  chinesefood:       'street',
  thai:              'spicy',
  Korean:            'spicy',
  italian:           'baked',
  frenchcooking:     'artisan',
  Keto:              'fresh',
  WeightLossRecipes: 'fresh',
  castiron:          'grilled',
  wok:               'street',
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.\-!?:;"'()/\\]+/)
    .filter((t) => t.length > 1);
}

function countHits(tokens: string[]): Record<DishCategory, number> {
  const counts: Record<DishCategory, number> = {
    spicy: 0, batch: 0, grilled: 0, baked: 0,
    fresh: 0, comfort: 0, street: 0, artisan: 0,
  };
  for (const token of tokens) {
    for (const [cat, keywords] of Object.entries(KEYWORD_DICT) as [DishCategory, string[]][]) {
      if (keywords.includes(token)) {
        counts[cat]++;
      }
    }
  }
  return counts;
}

export interface CravingInput {
  titles: string[];
  flairs: string[];
  subredditId: string;
  date: string; // YYYY-MM-DD
}

export function deriveCravings(input: CravingInput): CravingResult {
  const { titles, flairs, subredditId, date } = input;

  // Tokenize all titles + flairs together
  const allText = [...titles, ...flairs].join(' ');
  const tokens = tokenize(allText);
  const counts = countHits(tokens);

  // Rank categories by hit count, alphabetical tiebreak for determinism
  const ranked = (Object.entries(counts) as [DishCategory, number][])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const multipliers: CravingMultiplier[] = [];
  let crazeCategory: DishCategory | null = null;
  let derivedFrom: CravingResult['derivedFrom'] = 'live';

  const [first, second, third] = ranked;

  if (first[1] >= BALANCE.CRAZE_HIT_THRESHOLD) {
    // Craze: top category with ≥2 hits
    crazeCategory = first[0];
    multipliers.push({
      category: first[0],
      multiplier: BALANCE.CRAZE_MULT,
      label: CATEGORY_LABELS[first[0]],
    });
    if (second && second[1] >= BALANCE.CRAVED_HIT_THRESHOLD) {
      multipliers.push({
        category: second[0],
        multiplier: BALANCE.CRAVED_MULT_HIGH,
        label: CATEGORY_LABELS[second[0]],
      });
    }
    if (third && third[1] >= BALANCE.CRAVED_HIT_THRESHOLD) {
      multipliers.push({
        category: third[0],
        multiplier: BALANCE.CRAVED_MULT_LOW,
        label: CATEGORY_LABELS[third[0]],
      });
    }
  } else if (first[1] >= BALANCE.CRAVED_HIT_THRESHOLD) {
    // No craze but some hits — craved dishes
    multipliers.push({
      category: first[0],
      multiplier: BALANCE.CRAVED_MULT_HIGH,
      label: CATEGORY_LABELS[first[0]],
    });
    if (second && second[1] >= BALANCE.CRAVED_HIT_THRESHOLD) {
      multipliers.push({
        category: second[0],
        multiplier: BALANCE.CRAVED_MULT_LOW,
        label: CATEGORY_LABELS[second[0]],
      });
    }
  } else {
    // Zero keyword hits — guaranteed fallback from subreddit description
    const fallbackCat = SUBREDDIT_DESCRIPTION_CATEGORIES[subredditId];
    if (fallbackCat) {
      multipliers.push({
        category: fallbackCat,
        multiplier: BALANCE.CRAVED_MULT_LOW,
        label: CATEGORY_LABELS[fallbackCat],
      });
      derivedFrom = 'description';
    } else {
      // Unknown sub — pick comfort as universal fallback
      multipliers.push({
        category: 'comfort',
        multiplier: BALANCE.CRAVED_MULT_LOW,
        label: CATEGORY_LABELS.comfort,
      });
      derivedFrom = 'fallback';
    }
  }

  return {
    multipliers,
    crazeCategory,
    derivedFrom,
    subredditId,
    date,
  };
}
