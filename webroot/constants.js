// webroot/constants.js — ALL game constants. Every other file reads from here.
// Loaded as a plain <script> (no modules) — everything is a global.

// ─── Isometric tile geometry ──────────────────────────────────────────────────
// 2.5D isometric: tiles are drawn as diamonds.
// isoToScreen converts grid (col, row) → WORLD (x, y) given an origin point.
// The scene fixes the origin and uses a fitted CAMERA to frame the kitchen,
// so these are stable world coordinates regardless of screen size.
const TILE_W = 84;   // full tile width in pixels (world units)
const TILE_H = 46;   // full tile height in pixels
const ISO_Y_FACTOR = TILE_H / TILE_W; // vertical squash for iso-correct diagonal movement

function isoToScreen(col, row, originX, originY) {
  return {
    x: originX + (col - row) * (TILE_W / 2),
    y: originY + (col + row) * (TILE_H / 2),
  };
}

// World anchor for the iso grid. Fixed — the camera moves, not the origin.
const ISO_ORIGIN_X = 0;
const ISO_ORIGIN_Y = 0;

// Camera framing padding (world px) around the kitchen bounds.
const CAM_PAD_X = 70;
const CAM_PAD_TOP = 64;     // leave room under the HUD
const CAM_PAD_BOTTOM = 150; // leave room above the control bar

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  // Kitchen surfaces (warm, bright — NOT dark)
  floorA:        0xfff3df,
  floorB:        0xf6e6cb,
  floorEdge:     0xe7d2ad,
  floorLine:     0xdcc39a,
  wall:          0x7a563a,
  wallLight:     0x916a48,
  wallTop:       0xa9805a,
  counter:       0xb9824e,
  counterTop:    0xd8a868,
  counterShadow: 0x8a5e34,
  counterTrim:   0xf0c98a,

  // Station accent colors (Phaser hex)
  grill:   0x8b2500,
  fryer:   0x1e3a5f,
  wok:     0x1a3a1a,
  bakery:  0x5c3a1e,
  drinks:  0x0891b2,
  prep:    0x2a4a1a,
  smoker:  0x3a3a3a,
  dessert: 0x8b1a5c,

  // Game UI colors (Phaser hex)
  orange:  0xf97316,
  orangeD: 0xc2410c,
  gold:    0xfbbf24,
  green:   0x22c55e,
  greenD:  0x16a34a,
  red:     0xef4444,
  blue:    0x38bdf8,
  purple:  0x818cf8,
  white:   0xffffff,
  black:   0x000000,
  cream:   0xfff7ea,
  muted:   0x8b949e,

  // HTML/CSS versions (strings)
  uiOrange: '#f97316',
  uiGold:   '#fbbf24',
  uiGreen:  '#22c55e',
  uiRed:    '#ef4444',
  uiBlue:   '#38bdf8',
  uiMuted:  '#8b949e',
  uiText:   '#3a230f',
  uiBg:     '#fff3df',
  uiPanel:  '#fffaf2',
  uiBorder: '#e7d2ad',
  uiWood:   '#5c3a1e',
};

// ─── Stations ─────────────────────────────────────────────────────────────────
const STATIONS = {
  grill:  { emoji:'🥩', label:'Grill',   cookMs:3000, baseCoins:10, color:C.grill,   role:'main',    dish:'Steak'   },
  drinks: { emoji:'🥤', label:'Drinks',  cookMs:1000, baseCoins:3,  color:C.drinks,  role:'drink',   dish:'Cola'    },
  fryer:  { emoji:'🍟', label:'Fryer',   cookMs:2500, baseCoins:6,  color:C.fryer,   role:'side',    dish:'Fries'   },
  wok:    { emoji:'🥡', label:'Wok',     cookMs:2200, baseCoins:8,  color:C.wok,     role:'main',    dish:'Noodles' },
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
  2: { cols:6, rows:5, unlockCost:600,   label:'Small Kitchen' },
  3: { cols:7, rows:5, unlockCost:2400,  label:'Mid Kitchen'   },
  4: { cols:8, rows:6, unlockCost:9000,  label:'Big Kitchen'   },
  5: { cols:9, rows:7, unlockCost:28000, label:'Grand Kitchen' },
};

// ─── Customer order combos ────────────────────────────────────────────────────
const COMBOS = {
  basic: [
    ['grill', 'drinks'],
    ['fryer', 'drinks'],
    ['wok',   'drinks'],
    ['grill'],
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

// ─── Customer types ───────────────────────────────────────────────────────────
const CUSTOMER_PATIENCE = {
  regular:   18000,
  impatient: 11000,
  vip:       24000,
};
// Pay multiplier per customer type (VIP tips bigger)
const CUSTOMER_PAY_MULT = { regular: 1, impatient: 1.15, vip: 1.6 };

const SPAWN_INTERVAL_MS = 4000;
const MAX_WAITING = 5;

// ─── Shift / day progression ──────────────────────────────────────────────────
// Shift length grows slightly with tier; difficulty scales by day.
const SHIFT_DURATIONS = [0, 70, 80, 80, 90, 95]; // seconds, indexed by tier

// ─── Chef / movement ──────────────────────────────────────────────────────────
const CHEF_SPEED_PX_S = 235;  // world px per second
const CHEF_TRAY_BASE  = 3;
const STAFF_SPEED_PX_S = 175;

// ─── Tips / reputation ────────────────────────────────────────────────────────
const TIP_SPEED_BONUS = 0.7;   // up to +70% for instant serve (scaled by remaining patience)
const REP_PER_SERVE   = 1;
const REP_PER_WALKOUT = -2;

// ─── Staff (autonomous workers) ───────────────────────────────────────────────
// Cooks keep a station producing; waiters auto-deliver ready dishes to customers.
const STAFF = {
  cook:   { label:'Cook',   emoji:'👨‍🍳', desc:'Auto-cooks a station for you', baseCost:600,  costMult:1.6, coat:0xfafafa, hat:0xf97316 },
  waiter: { label:'Waiter', emoji:'🧑‍💼', desc:'Auto-serves ready dishes',      baseCost:900,  costMult:1.6, coat:0x38bdf8, hat:0x0e7490 },
};

// ─── Between-shift shop upgrades (chef) ───────────────────────────────────────
const SHOP_UPGRADES = {
  chefSpeed: { label:'Prep Speed',  desc:'-12% cook time per level', baseCost:120, maxLevel:4, perLevel:0.12, icon:'⚡' },
  traySize:  { label:'Bigger Tray', desc:'+1 carry capacity',        baseCost:260, maxLevel:3, perLevel:1,    icon:'🛒' },
};
