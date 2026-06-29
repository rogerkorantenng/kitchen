// webroot/constants.js — ALL game constants. Every other file reads from here.

// ─── Isometric tile geometry ──────────────────────────────────────────────────
// 2.5D isometric: tiles are drawn as diamonds
// isoToScreen converts grid (col, row) → screen (x, y) given an origin point
const TILE_W = 80;   // full tile width in pixels
const TILE_H = 44;   // full tile height in pixels

function isoToScreen(col, row, originX, originY) {
  return {
    x: originX + (col - row) * (TILE_W / 2),
    y: originY + (col + row) * (TILE_H / 2),
  };
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  // Kitchen surfaces
  floorA:        0xfdf6e3,
  floorB:        0xf5e6d3,
  floorLine:     0xd4b896,
  wall:          0x4a3728,
  wallLight:     0x5a4538,
  counter:       0x8b5e3c,
  counterTop:    0xa0714d,
  counterShadow: 0x6b4a2e,

  // Station accent colors
  grill:   0x8b2500,
  fryer:   0x1e3a5f,
  wok:     0x1a3a1a,
  bakery:  0x5c3a1e,
  drinks:  0x1a3a4a,
  prep:    0x2a4a1a,
  smoker:  0x3a3a3a,
  dessert: 0x8b1a5c,

  // Game UI colors (Phaser hex)
  orange:  0xf97316,
  gold:    0xfbbf24,
  green:   0x22c55e,
  red:     0xef4444,
  blue:    0x38bdf8,
  purple:  0x818cf8,
  white:   0xffffff,
  black:   0x000000,
  muted:   0x8b949e,

  // HTML/CSS versions (strings)
  uiOrange: '#f97316',
  uiGold:   '#fbbf24',
  uiGreen:  '#22c55e',
  uiRed:    '#ef4444',
  uiMuted:  '#8b949e',
  uiText:   '#1a0f00',
  uiBg:     '#fdf6e3',
  uiPanel:  '#fff8f0',
  uiBorder: '#d4b896',
};

// ─── Stations ─────────────────────────────────────────────────────────────────
const STATIONS = {
  grill:  { emoji:'🥩', label:'Grill',   cookMs:3000, baseCoins:10, color:C.grill,   role:'main',    dish:'Steak'   },
  drinks: { emoji:'🥤', label:'Drinks',  cookMs:500,  baseCoins:2,  color:C.drinks,  role:'drink',   dish:'Cola'    },
  fryer:  { emoji:'🍟', label:'Fryer',   cookMs:2500, baseCoins:6,  color:C.fryer,   role:'side',    dish:'Fries'   },
  wok:    { emoji:'🥡', label:'Wok',     cookMs:2000, baseCoins:8,  color:C.wok,     role:'main',    dish:'Noodles' },
  bakery: { emoji:'🍞', label:'Bakery',  cookMs:4000, baseCoins:12, color:C.bakery,  role:'main',    dish:'Bread'   },
  prep:   { emoji:'🥗', label:'Prep',    cookMs:1500, baseCoins:5,  color:C.prep,    role:'side',    dish:'Salad'   },
  smoker: { emoji:'🍖', label:'Smoker',  cookMs:5000, baseCoins:18, color:C.smoker,  role:'premium', dish:'Ribs'    },
  dessert:{ emoji:'🍰', label:'Dessert', cookMs:3000, baseCoins:14, color:C.dessert, role:'dessert', dish:'Cake'    },
};

// Upgrade base cost per station type; actual cost = base × 1.8^currentLevel
const UPGRADE_BASE_COSTS = {
  grill:80, fryer:60, wok:60, drinks:30, bakery:100, prep:50, smoker:150, dessert:120,
};

// Which station types appear at each kitchen tier
const STATION_LAYOUT = {
  1: ['grill', 'drinks'],
  2: ['grill', 'fryer', 'drinks'],
  3: ['grill', 'fryer', 'wok', 'drinks'],
  4: ['grill', 'fryer', 'wok', 'bakery', 'prep', 'drinks'],
  5: ['grill', 'fryer', 'wok', 'bakery', 'prep', 'smoker', 'dessert', 'drinks'],
};

// ─── Kitchen expansion tiers ──────────────────────────────────────────────────
const KITCHEN_TIERS = {
  1: { cols:5, rows:4, unlockCost:0,     label:'Tiny Kitchen'  },
  2: { cols:6, rows:5, unlockCost:500,   label:'Small Kitchen' },
  3: { cols:7, rows:5, unlockCost:2000,  label:'Mid Kitchen'   },
  4: { cols:8, rows:6, unlockCost:8000,  label:'Big Kitchen'   },
  5: { cols:9, rows:7, unlockCost:25000, label:'Grand Kitchen' },
};

// ─── Customer order combos ────────────────────────────────────────────────────
const COMBOS = {
  basic: [
    ['grill', 'drinks'],
    ['fryer', 'drinks'],
    ['wok',   'drinks'],
  ],
  full: [
    ['grill', 'fryer', 'drinks'],
    ['wok',   'fryer', 'drinks'],
    ['bakery','prep',  'drinks'],
  ],
  premium: [
    ['smoker','prep',  'drinks', 'dessert'],
    ['grill', 'bakery','drinks', 'dessert'],
  ],
};

// ─── Customer patience ────────────────────────────────────────────────────────
const CUSTOMER_PATIENCE = {
  regular:   15000,
  impatient:  8000,
  vip:       20000,
};
const SPAWN_INTERVAL_MS = 4000;

// ─── Shift durations (seconds, indexed by kitchen tier) ──────────────────────
const SHIFT_DURATIONS = [0, 60, 75, 75, 90, 90];

// ─── Chef ─────────────────────────────────────────────────────────────────────
const CHEF_SPEED_PX_S = 160;
const CHEF_TRAY_BASE  = 3;

// ─── Between-shift shop upgrades ─────────────────────────────────────────────
const SHOP_UPGRADES = {
  chefSpeed: { label:'Chef Speed',  desc:'+15% walk speed per level', baseCost:100, maxLevel:3, perLevel:0.15 },
  traySize:  { label:'Bigger Tray', desc:'+1 carry capacity',         baseCost:250, maxLevel:2, perLevel:1    },
};
