# Drift Kitchen — Active Cooking Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete active cooking game on Reddit Devvit Web where a chef runs between stations assembling multi-item orders, serves impatient customers, upgrades stations mid-shift, and expands the kitchen as coins accumulate.

**Architecture:** Phaser 3 canvas handles the game world (chef, stations, customers, animations). HTML/CSS overlays handle all UI chrome (HUD, shop, modals). Devvit server (already built) handles Redis persistence, craving derivation, and UGC recipes. Files are split by single responsibility — one file per system.

**Tech Stack:** Phaser 3.87 (bundled as phaser.min.js), vanilla JS (no bundler — Devvit WebRoot serves static files), Devvit Web TypeScript server (already complete), Redis via Devvit context.

## Global Constraints

- All webroot files are plain `.js` loaded via `<script>` tags — no ES modules, no import/export
- `Date.now()` and `window.setTimeout` for all timing — Phaser's internal time is distorted in Devvit iframes (proven by Trapline)
- Phaser canvas launches with 2-frame `requestAnimationFrame` defer before measuring container (prevents 0×0 canvas on mobile in Devvit iframes — Trapline pattern)
- Manual `keydown`/`keyup` listener cleanup before `game.destroy(true)` — Phaser does not reliably clean these inside iframes
- `rpc.js` handles all Devvit postMessage communication (sequence-numbered, already written — do not modify)
- `devvit upload` to push changes; playtest URL: `https://www.reddit.com/r/drift_kitchen_dev/?playtest=drift-kitchen`
- Visual style: warm cream/wood kitchen, NOT dark. Colors in constants.js must match spec palette
- No agents — all implementation inline, sequential

---

## File Structure

```
webroot/
  index.html          — full-screen canvas mount + HTML overlay skeleton (MODIFY)
  constants.js        — all game constants: tiles, costs, station defs, colors (REPLACE)
  ChefScene.js        — Phaser scene: floor, counter, walls, chef movement (REPLACE)
  StationManager.js   — station state machine: cooking, ready, upgrade slam (CREATE)
  CustomerManager.js  — customer spawn, order bubbles, patience bars, delivery (CREATE)
  ChefController.js   — tray logic, interact resolution, d-pad input (CREATE)
  KitchenExpander.js  — kitchen tier state, expansion animation, unlock gates (CREATE)
  HUD.js              — HTML overlay: coin counter, shift timer, harbor/craving banner (CREATE)
  ShopScreen.js       — HTML overlay: between-shift upgrade shop + kitchen expansion buy (CREATE)
  ParticleEffects.js  — coin arcs, upgrade slam, steam — pure visual sugar (CREATE)
  main.js             — Phaser launcher + Devvit message bridge (REPLACE)

src/ (server — DO NOT modify unless noted)
  main.tsx            — message router (no changes needed for Week 1-2)
  handlers/state.ts   — save/load (already complete)
  handlers/cravings.ts — craving derivation (already complete)
  core/craving-engine.ts — keyword matching (already complete, 31 tests passing)
```

---

## Task 1: constants.js — Full game constants

**Files:**
- Replace: `webroot/constants.js`

**Interfaces:**
- Produces: `TILE_W`, `TILE_H`, `ISO_ORIGIN`, `STATIONS`, `UPGRADE_COSTS`, `KITCHEN_TIERS`, `COMBOS`, `C` (colors), `SHIFT_DURATIONS`
- Consumed by: every other webroot file

- [ ] **Step 1: Replace constants.js with full spec values**

```javascript
// webroot/constants.js — ALL game constants. Every other file reads from here.

// ─── Isometric tile geometry ──────────────────────────────────────────────────
// 2.5D isometric: tiles are diamond-shaped drawn at (x-y)*TW/2, (x+y)*TH/2
const TILE_W = 80;   // full tile width in pixels
const TILE_H = 44;   // full tile height in pixels (half of width for classic iso look)
const ISO_COLS = 9;  // kitchen width in tiles
const ISO_ROWS = 7;  // kitchen depth in tiles (walkable area)

// Convert grid coords to screen coords (top-left of tile)
function isoToScreen(col, row, originX, originY) {
  return {
    x: originX + (col - row) * (TILE_W / 2),
    y: originY + (col + row) * (TILE_H / 2),
  };
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  // Kitchen surfaces
  floorA:    0xfdf6e3,  // warm cream tile A
  floorB:    0xf5e6d3,  // warm cream tile B
  floorLine: 0xd4b896,  // tile grout lines
  wall:      0x4a3728,  // deep warm dark wood
  wallLight: 0x5a4538,  // wall highlight
  counter:   0x8b5e3c,  // rich wood brown counter
  counterTop:0xa0714d,  // counter top edge
  counterShadow: 0x6b4a2e,

  // Station colors (one per type)
  grill:   0x8b2500,
  fryer:   0x1e3a5f,
  wok:     0x1a3a1a,
  bakery:  0x5c3a1e,
  drinks:  0x1a3a4a,
  prep:    0x2a4a1a,
  smoker:  0x3a3a3a,
  dessert: 0x8b1a5c,

  // Game colors
  orange:  0xf97316,
  gold:    0xfbbf24,
  green:   0x22c55e,
  red:     0xef4444,
  blue:    0x38bdf8,
  purple:  0x818cf8,
  white:   0xffffff,
  black:   0x000000,
  muted:   0x8b949e,
  text:    0x1a0f00,
  textLight: 0xe6edf3,
  bg:      0xfdf6e3,

  // UI overlay colors (CSS hex strings)
  uiBg:    '#1a0f00',
  uiPanel: '#fdf6e3',
  uiOrange:'#f97316',
  uiGold:  '#fbbf24',
  uiGreen: '#22c55e',
  uiRed:   '#ef4444',
  uiMuted: '#8b949e',
};

// ─── Stations ─────────────────────────────────────────────────────────────────
const STATIONS = {
  grill:  { emoji:'🥩', label:'Grill',   cookMs:3000, baseCoins:10, color:C.grill,   role:'main',    dish:'Steak'     },
  drinks: { emoji:'🥤', label:'Drinks',  cookMs:500,  baseCoins:2,  color:C.drinks,  role:'drink',   dish:'Cola'      },
  fryer:  { emoji:'🍟', label:'Fryer',   cookMs:2500, baseCoins:6,  color:C.fryer,   role:'side',    dish:'Fries'     },
  wok:    { emoji:'🥡', label:'Wok',     cookMs:2000, baseCoins:8,  color:C.wok,     role:'main',    dish:'Noodles'   },
  bakery: { emoji:'🍞', label:'Bakery',  cookMs:4000, baseCoins:12, color:C.bakery,  role:'main',    dish:'Bread'     },
  prep:   { emoji:'🥗', label:'Prep',    cookMs:1500, baseCoins:5,  color:C.prep,    role:'side',    dish:'Salad'     },
  smoker: { emoji:'🍖', label:'Smoker',  cookMs:5000, baseCoins:18, color:C.smoker,  role:'premium', dish:'Ribs'      },
  dessert:{ emoji:'🍰', label:'Dessert', cookMs:3000, baseCoins:14, color:C.dessert, role:'dessert', dish:'Cake'      },
};

// Upgrade cost per level: baseCost × 1.8^currentLevel
const UPGRADE_BASE_COSTS = {
  grill:80, fryer:60, wok:60, drinks:30, bakery:100, prep:50, smoker:150, dessert:120,
};

// Station layout per kitchen tier (col positions on the back wall)
const STATION_LAYOUT = {
  1: ['grill', 'drinks'],                                    // tier 1: 2 stations
  2: ['grill', 'fryer', 'drinks'],                           // tier 2: add fryer
  3: ['grill', 'fryer', 'wok', 'drinks'],                    // tier 3: add wok
  4: ['grill', 'fryer', 'wok', 'bakery', 'prep', 'drinks'],  // tier 4
  5: ['grill', 'fryer', 'wok', 'bakery', 'prep', 'smoker', 'dessert', 'drinks'], // tier 5
};

// ─── Kitchen expansion tiers ──────────────────────────────────────────────────
const KITCHEN_TIERS = {
  1: { cols:5, rows:4, unlockCost:0,      label:'Tiny Kitchen'  },
  2: { cols:6, rows:5, unlockCost:500,    label:'Small Kitchen' },
  3: { cols:7, rows:5, unlockCost:2000,   label:'Mid Kitchen'   },
  4: { cols:8, rows:6, unlockCost:8000,   label:'Big Kitchen'   },
  5: { cols:9, rows:7, unlockCost:25000,  label:'Grand Kitchen' },
};

// ─── Customer order combos ────────────────────────────────────────────────────
// Each combo is an array of station types the customer wants
const COMBOS = {
  basic: [   // unlocked from start
    ['grill', 'drinks'],
    ['fryer', 'drinks'],
    ['wok',   'drinks'],
  ],
  full: [    // unlocked at tier 2
    ['grill', 'fryer', 'drinks'],
    ['wok',   'fryer', 'drinks'],
    ['bakery','prep',  'drinks'],
  ],
  premium: [ // unlocked at tier 4
    ['smoker','prep',  'drinks', 'dessert'],
    ['grill', 'bakery','drinks', 'dessert'],
  ],
};

// ─── Shift configuration ──────────────────────────────────────────────────────
const SHIFT_DURATIONS = [0, 60, 75, 75, 90, 90]; // seconds, indexed by tier
const CUSTOMER_PATIENCE = {
  regular:   15000,
  impatient: 8000,
  vip:       20000,
};
const SPAWN_INTERVAL_MS = 4000; // ms between customer spawns (base)

// ─── Chef ─────────────────────────────────────────────────────────────────────
const CHEF_SPEED_PX_S  = 160;  // pixels per second walk speed
const CHEF_TRAY_BASE   = 3;    // max items chef can carry

// ─── Upgrade shop (between-shift) ─────────────────────────────────────────────
const SHOP_UPGRADES = {
  chefSpeed:  { label:'Chef Speed',   desc:'+15% walk speed',      baseCost:100, maxLevel:3, perLevel:0.15 },
  traySize:   { label:'Bigger Tray',  desc:'+1 carry capacity',    baseCost:250, maxLevel:2, perLevel:1    },
  kitchenTier:{ label:'Expand Kitchen',desc:'Unlock next kitchen', baseCost:0,  maxLevel:5, perLevel:0    }, // cost from KITCHEN_TIERS
};
```

- [ ] **Step 2: Verify constants load in browser (open index.html in browser, check console for errors)**

Open `webroot/index.html` in a browser. Open DevTools console. Should see no errors. Type `STATIONS.grill` — should return the grill object.

- [ ] **Step 3: Commit**

```bash
cd /home/rogerkorantenng/dev/Hackathons/drift-kitchen
git add webroot/constants.js
git commit -m "feat: replace constants with full spec values — all 8 stations, tiers, combos"
```

---

## Task 2: ChefScene.js — Isometric kitchen world

**Files:**
- Replace: `webroot/ChefScene.js`

**Interfaces:**
- Consumes: `TILE_W`, `TILE_H`, `isoToScreen()`, `C`, `KITCHEN_TIERS` from constants.js
- Produces: `window.CHEF_SCENE` (reference to running scene for other managers to call)
- Exposes methods: `ChefScene.getPlayerPos()`, `ChefScene.walkPlayerTo(x, y, onArrive)`, `ChefScene.drawPlayerAt(x, y, dir)`, `ChefScene.showFloatText(x, y, text, color)`

- [ ] **Step 1: Write ChefScene.js — isometric floor, walls, counter, chef sprite, d-pad**

```javascript
// webroot/ChefScene.js
// Phaser 3 scene: draws the isometric kitchen world.
// Handles: floor rendering, wall, service counter, chef sprite, d-pad controls.
// Does NOT handle stations, customers, or game logic — those are in their own files.

class ChefScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ChefScene' });
    this.kitchenTier = 1;
    this.chefPos   = { x: 0, y: 0 };  // screen px position of chef
    this.chefDir   = 'down';
    this.chefGfx   = null;
    this.heldText  = null;   // emoji stack above chef head
    this._moveTween = null;
    this.originX   = 0;      // iso grid screen origin
    this.originY   = 0;
    window.CHEF_SCENE = this;  // expose for other managers
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;

    // Set iso origin so grid is centered
    const tier = KITCHEN_TIERS[this.kitchenTier];
    this.originX = this.W / 2;
    this.originY = this.H * 0.15;

    this._buildFloor();
    this._buildWalls();
    this._buildCounter();
    this._buildLanterns();
    this._buildChef();
    this._buildDpad();

    this.input.on('pointerdown', this._onTap, this);

    // Notify other managers that the scene is ready
    window.dispatchEvent(new CustomEvent('dk:sceneReady'));
  }

  // ── Isometric floor ─────────────────────────────────────────────────────────
  _buildFloor() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-10);

    for (let row = 0; row < tier.rows; row++) {
      for (let col = 0; col < tier.cols; col++) {
        const { x, y } = isoToScreen(col, row, this.originX, this.originY);
        const TW = TILE_W, TH = TILE_H;
        // Alternating warm cream colors
        const fillColor = (col + row) % 2 === 0 ? C.floorA : C.floorB;
        g.fillStyle(fillColor, 1);
        // Diamond tile shape
        g.fillPoints([
          { x: x + TW/2, y },
          { x: x + TW,   y: y + TH/2 },
          { x: x + TW/2, y: y + TH },
          { x,           y: y + TH/2 },
        ], true);
        // Grout lines
        g.lineStyle(1, C.floorLine, 0.5);
        g.strokePoints([
          { x: x + TW/2, y },
          { x: x + TW,   y: y + TH/2 },
          { x: x + TW/2, y: y + TH },
          { x,           y: y + TH/2 },
        ], true);
      }
    }
  }

  // ── Back wall ────────────────────────────────────────────────────────────────
  _buildWalls() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-8);

    // Left wall face (vertical diamond row on left edge)
    g.fillStyle(C.wall, 1);
    for (let row = 0; row < tier.rows; row++) {
      const { x, y } = isoToScreen(-1, row, this.originX, this.originY);
      const TW = TILE_W, TH = TILE_H;
      const wallH = TH * 2;
      // Wall block
      g.fillPoints([
        { x: x + TW/2, y: y - wallH },
        { x: x + TW,   y: y + TH/2 - wallH },
        { x: x + TW,   y: y + TH/2 },
        { x: x + TW/2, y: y + TH },
        { x,           y: y + TH/2 },
        { x,           y: y + TH/2 - wallH },
      ], true);
    }

    // Top wall row (behind row 0)
    g.fillStyle(C.wallLight, 1);
    for (let col = 0; col < tier.cols; col++) {
      const { x, y } = isoToScreen(col, -1, this.originX, this.originY);
      const TW = TILE_W, TH = TILE_H;
      const wallH = TH * 2;
      g.fillPoints([
        { x: x + TW/2, y: y - wallH },
        { x: x + TW,   y: y + TH/2 - wallH },
        { x: x + TW,   y: y + TH/2 },
        { x: x + TW/2, y: y + TH },
        { x,           y: y + TH/2 },
        { x,           y: y + TH/2 - wallH },
      ], true);
    }
  }

  // ── Service counter ──────────────────────────────────────────────────────────
  // Counter runs along row 0 (in front of the back wall, behind the customer row)
  _buildCounter() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-5);

    for (let col = 0; col < tier.cols; col++) {
      const { x, y } = isoToScreen(col, 0, this.originX, this.originY);
      const TW = TILE_W, TH = TILE_H;
      const counterH = TH;
      // Counter top face
      g.fillStyle(C.counterTop, 1);
      g.fillPoints([
        { x: x + TW/2, y },
        { x: x + TW,   y: y + TH/2 },
        { x: x + TW/2, y: y + TH },
        { x,           y: y + TH/2 },
      ], true);
      // Counter front face (darker)
      g.fillStyle(C.counter, 1);
      g.fillPoints([
        { x,           y: y + TH/2 },
        { x: x + TW/2, y: y + TH },
        { x: x + TW/2, y: y + TH + counterH },
        { x,           y: y + TH/2 + counterH },
      ], true);
      g.fillPoints([
        { x: x + TW/2, y: y + TH },
        { x: x + TW,   y: y + TH/2 },
        { x: x + TW,   y: y + TH/2 + counterH },
        { x: x + TW/2, y: y + TH + counterH },
      ], true);
    }
    // Store counter Y for customer spawning
    const { y: counterScreenY } = isoToScreen(Math.floor(KITCHEN_TIERS[this.kitchenTier].cols/2), 0, this.originX, this.originY);
    this.counterScreenY = counterScreenY + TILE_H;
    window.DK_COUNTER_Y = this.counterScreenY;
  }

  // ── Lanterns ─────────────────────────────────────────────────────────────────
  _buildLanterns() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const positions = [0.2, 0.5, 0.8].map(p => Math.floor(p * tier.cols));
    const g = this.add.graphics().setDepth(-3);

    positions.forEach(col => {
      const { x: lx, y: ly } = isoToScreen(col, -1, this.originX, this.originY);
      const cx = lx + TILE_W / 2;
      const cy = ly - TILE_H * 0.5;
      // Glow
      g.fillStyle(C.gold, 0.08); g.fillCircle(cx, cy, TILE_W * 0.7);
      // Cord
      g.lineStyle(2, 0x8b5e3c, 0.8); g.lineBetween(cx, cy - TILE_H, cx, cy - TILE_H * 0.3);
      // Body
      g.fillStyle(C.orange, 1);
      g.fillRoundedRect(cx - TILE_W * 0.12, cy - TILE_H * 0.5, TILE_W * 0.24, TILE_H * 0.55, 5);
      // Light
      g.fillStyle(C.gold, 0.9); g.fillCircle(cx, cy - TILE_H * 0.22, TILE_W * 0.07);
      g.lineStyle(1.5, 0xd4622a, 0.6);
      g.strokeRoundedRect(cx - TILE_W * 0.12, cy - TILE_H * 0.5, TILE_W * 0.24, TILE_H * 0.55, 5);
    });
  }

  // ── Chef sprite ───────────────────────────────────────────────────────────────
  _buildChef() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    // Start chef in center of walkable area (row 3, center col)
    const startCol = Math.floor(tier.cols / 2);
    const startRow = Math.floor(tier.rows / 2);
    const { x, y } = isoToScreen(startCol, startRow, this.originX, this.originY);
    this.chefPos = { x: x + TILE_W / 2, y: y + TILE_H / 2 };

    this.chefGfx = this.add.graphics().setDepth(20);
    this.heldText = this.add.text(this.chefPos.x, this.chefPos.y - TILE_H, '', {
      fontSize: Math.round(TILE_W * 0.4) + 'px',
    }).setOrigin(0.5).setDepth(21).setVisible(false);

    this._drawChef(this.chefPos.x, this.chefPos.y, 'down');
    window.DK_CHEF_POS = this.chefPos;
  }

  _drawChef(x, y, dir) {
    const g = this.chefGfx;
    const TW = TILE_W, TH = TILE_H;
    g.clear();

    // Shadow on floor
    g.fillStyle(C.black, 0.15);
    g.fillEllipse(x + 2, y + TH * 0.42, TW * 0.5, TH * 0.15);

    // Legs (dark blue trousers)
    g.fillStyle(0x1e3a5f, 1);
    if (dir === 'left' || dir === 'right') {
      g.fillRoundedRect(x - TW * 0.12, y + TH * 0.18, TW * 0.24, TH * 0.28, 3);
    } else {
      g.fillRoundedRect(x - TW * 0.18, y + TH * 0.18, TW * 0.13, TH * 0.28, 3);
      g.fillRoundedRect(x + TW * 0.04, y + TH * 0.18, TW * 0.13, TH * 0.28, 3);
    }

    // Body — white chef coat
    g.fillStyle(C.white, 1);
    g.fillRoundedRect(x - TW * 0.22, y - TH * 0.08, TW * 0.44, TH * 0.3, 5);
    // Double-breasted buttons
    g.fillStyle(C.orange, 1);
    g.fillCircle(x - TW * 0.07, y + TH * 0.02, TW * 0.035);
    g.fillCircle(x + TW * 0.07, y + TH * 0.02, TW * 0.035);
    g.fillCircle(x - TW * 0.07, y + TH * 0.1, TW * 0.03);
    g.fillCircle(x + TW * 0.07, y + TH * 0.1, TW * 0.03);

    // Arms
    g.fillStyle(C.white, 1);
    if (dir === 'left') {
      g.fillRoundedRect(x - TW * 0.38, y - TH * 0.02, TW * 0.18, TH * 0.1, 3);
    } else if (dir === 'right') {
      g.fillRoundedRect(x + TW * 0.2, y - TH * 0.02, TW * 0.18, TH * 0.1, 3);
    } else {
      g.fillRoundedRect(x - TW * 0.38, y + TH * 0.04, TW * 0.16, TH * 0.09, 3);
      g.fillRoundedRect(x + TW * 0.22, y + TH * 0.04, TW * 0.16, TH * 0.09, 3);
    }

    // Neck
    g.fillStyle(0xfde8c8, 1);
    g.fillRect(x - TW * 0.06, y - TH * 0.18, TW * 0.12, TH * 0.12);

    // Head
    g.fillStyle(0xfde8c8, 1);
    g.fillRoundedRect(x - TW * 0.22, y - TH * 0.46, TW * 0.44, TH * 0.32, 7);

    // Chef hat — brim
    g.fillStyle(0xfafafa, 1);
    g.fillRoundedRect(x - TW * 0.26, y - TH * 0.5, TW * 0.52, TH * 0.1, 3);
    // Hat tall part
    g.fillRoundedRect(x - TW * 0.18, y - TH * 0.78, TW * 0.36, TH * 0.32, 4);
    // Orange hat band
    g.fillStyle(C.orange, 1);
    g.fillRect(x - TW * 0.18, y - TH * 0.51, TW * 0.36, TH * 0.06);

    // Face
    g.fillStyle(0x2d1a00, 1);
    if (dir === 'up') {
      // Back of head — no face
    } else if (dir === 'left') {
      g.fillCircle(x - TW * 0.1, y - TH * 0.32, TW * 0.04);
      g.fillRoundedRect(x - TW * 0.15, y - TH * 0.22, TW * 0.12, TH * 0.04, 2);
    } else if (dir === 'right') {
      g.fillCircle(x + TW * 0.1, y - TH * 0.32, TW * 0.04);
      g.fillRoundedRect(x + TW * 0.03, y - TH * 0.22, TW * 0.12, TH * 0.04, 2);
    } else {
      // Front
      g.fillCircle(x - TW * 0.09, y - TH * 0.32, TW * 0.045);
      g.fillCircle(x + TW * 0.09, y - TH * 0.32, TW * 0.045);
      g.lineStyle(TW * 0.025, 0x2d1a00, 1);
      g.beginPath(); g.arc(x, y - TH * 0.23, TW * 0.09, 0.3, Math.PI - 0.3, false); g.strokePath();
    }

    // Apron
    g.fillStyle(C.orange, 0.6);
    g.fillTriangle(x - TW * 0.08, y - TH * 0.18, x + TW * 0.08, y - TH * 0.18, x, y - TH * 0.04);

    // Update held item bubble position
    if (this.heldText && this.heldText.visible) {
      this.heldText.setPosition(x, y - TH * 0.9);
    }
    window.DK_CHEF_POS = { x, y };
  }

  // ── D-pad controls ────────────────────────────────────────────────────────────
  _buildDpad() {
    const W = this.W, H = this.H;
    const padX = W - TILE_W * 1.6;
    const padY = H - TILE_H * 3.0;
    const R    = TILE_W * 0.36;

    const dirs = [
      { label:'▲', dx: 0,  dy:-1, bx: padX,          by: padY - TILE_H * 0.9  },
      { label:'▼', dx: 0,  dy: 1, bx: padX,          by: padY + TILE_H * 0.9  },
      { label:'◀', dx:-1,  dy: 0, bx: padX - TILE_W * 0.9, by: padY           },
      { label:'▶', dx: 1,  dy: 0, bx: padX + TILE_W * 0.9, by: padY           },
    ];

    // Pad background disc
    const padBg = this.add.graphics().setDepth(40);
    padBg.fillStyle(C.black, 0.22); padBg.fillCircle(padX, padY, TILE_W);

    dirs.forEach(d => {
      const btn = this.add.graphics().setDepth(41);
      const drawBtn = (active) => {
        btn.clear();
        btn.fillStyle(active ? C.orange : C.white, active ? 0.7 : 0.2);
        btn.fillCircle(d.bx, d.by, R);
      };
      drawBtn(false);
      btn.setInteractive(new Phaser.Geom.Circle(d.bx, d.by, R), Phaser.Geom.Circle.Contains);

      this.add.text(d.bx, d.by, d.label, {
        fontSize: Math.round(TILE_W * 0.28) + 'px', color:'#ffffff',
      }).setOrigin(0.5).setDepth(42);

      let held = false, iv = null;
      const step = () => {
        const newDir = d.dx < 0 ? 'left' : d.dx > 0 ? 'right' : d.dy < 0 ? 'up' : 'down';
        this.chefDir = newDir;
        // Move on the floor (avoid going behind counter row 0)
        const stepPx = TILE_W * 0.55;
        const nx = Math.max(20, Math.min(this.W - 20, this.chefPos.x + d.dx * stepPx));
        const ny = Math.max(this.counterScreenY + TILE_H * 0.5, Math.min(this.H - TILE_H * 0.5, this.chefPos.y + d.dy * stepPx));
        this.walkPlayerTo(nx, ny);
      };

      btn.on('pointerdown', () => { drawBtn(true); held=true; step(); iv=setInterval(()=>{ if(held) step(); }, 160); });
      const rel = () => { drawBtn(false); held=false; clearInterval(iv); };
      btn.on('pointerup', rel); btn.on('pointerout', rel);
    });

    // Interact button (left side)
    const actX = TILE_W * 1.4, actY = H - TILE_H * 2.5;
    const actBtn = this.add.graphics().setDepth(41);
    actBtn.fillStyle(C.orange, 0.85); actBtn.fillCircle(actX, actY, R * 1.15);
    actBtn.setInteractive(new Phaser.Geom.Circle(actX, actY, R * 1.15), Phaser.Geom.Circle.Contains);
    this.add.text(actX, actY, '✋', { fontSize: Math.round(TILE_W * 0.36)+'px' }).setOrigin(0.5).setDepth(42);
    this.add.text(actX, actY + R * 1.3, 'INTERACT', { fontSize:'7px', color:'rgba(255,255,255,0.6)' }).setOrigin(0.5).setDepth(42);
    actBtn.on('pointerdown', () => {
      this.tweens.add({ targets: actBtn, scaleX:0.88, scaleY:0.88, duration:70, yoyo:true });
      window.dispatchEvent(new CustomEvent('dk:interact'));
    });
  }

  // ── Tap to walk ──────────────────────────────────────────────────────────────
  _onTap(ptr) {
    // Only walk if tap is on the floor area (below counter)
    if (ptr.y > (this.counterScreenY || 0) + TILE_H * 0.3) {
      this.walkPlayerTo(ptr.x, ptr.y);
    }
  }

  // ── Public movement API ───────────────────────────────────────────────────────
  walkPlayerTo(tx, ty, onArrive) {
    const dx = tx - this.chefPos.x;
    const dy = ty - this.chefPos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 6) { if (onArrive) onArrive(); return; }

    // Set facing direction
    if (Math.abs(dx) > Math.abs(dy)) this.chefDir = dx > 0 ? 'right' : 'left';
    else this.chefDir = dy > 0 ? 'down' : 'up';

    if (this._moveTween) this._moveTween.stop();
    const dur = (dist / CHEF_SPEED_PX_S) * 1000;
    const proxy = { x: this.chefPos.x, y: this.chefPos.y };
    this._moveTween = this.tweens.add({
      targets: proxy, x: tx, y: ty, duration: dur, ease: 'Linear',
      onUpdate: () => {
        this.chefPos.x = proxy.x; this.chefPos.y = proxy.y;
        this._drawChef(proxy.x, proxy.y, this.chefDir);
      },
      onComplete: () => {
        this.chefPos = { x: tx, y: ty }; window.DK_CHEF_POS = this.chefPos;
        if (onArrive) onArrive();
      },
    });
  }

  getPlayerPos() { return { ...this.chefPos }; }

  // ── Float text ────────────────────────────────────────────────────────────────
  showFloatText(x, y, text, color = '#ffffff', size = 13) {
    const t = this.add.text(x, y, text, {
      fontSize: size + 'px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 900, ease: 'Power2', onComplete: () => t.destroy() });
  }

  // ── Set carried item display ──────────────────────────────────────────────────
  setHeldItems(emojis) {
    if (!emojis || emojis.length === 0) {
      this.heldText.setVisible(false);
    } else {
      this.heldText.setText(emojis.join('')).setVisible(true);
    }
  }

  // ── Rebuild kitchen (called when tier changes) ────────────────────────────────
  rebuildKitchen(tier) {
    this.kitchenTier = tier;
    // Destroy all graphics and rebuild
    this.children.list.filter(o => o.depth < 5).forEach(o => o.destroy());
    const tierData = KITCHEN_TIERS[tier];
    this.originX = this.W / 2;
    this.originY = this.H * 0.15;
    this._buildFloor();
    this._buildWalls();
    this._buildCounter();
    this._buildLanterns();
    window.dispatchEvent(new CustomEvent('dk:kitchenRebuilt', { detail: { tier, tierData } }));
  }

  update() {
    // Nothing needed in update loop — all game logic is event-driven
  }

  shutdown() {
    this.input.off('pointerdown', this._onTap, this);
  }
}
```

- [ ] **Step 2: Update main.js to launch this scene**

```javascript
// webroot/main.js
let _game = null;

function launchGame() {
  const mount = document.getElementById('game-mount');
  if (!mount || _game) return;
  const W = mount.clientWidth  || window.innerWidth;
  const H = mount.clientHeight || window.innerHeight;
  _game = new Phaser.Game({
    type: Phaser.AUTO, width: W, height: H,
    backgroundColor: '#fdf6e3',
    parent: 'game-mount',
    scene: [ChefScene],
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    input: { activePointers: 3 },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      launchGame();
      send('INIT', {});
      let attempts = 0;
      const retry = setInterval(() => {
        attempts++;
        if (attempts >= 3 || window._dkInitDone) { clearInterval(retry); return; }
        send('INIT', {});
      }, 5000);
    });
  });
});

window.addEventListener('devvit:INIT_RESPONSE', () => { window._dkInitDone = true; });
```

- [ ] **Step 3: Update index.html to mount full-screen**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Drift Kitchen</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#fdf6e3; }
    #game-mount { position:fixed; inset:0; }
    #game-mount canvas { width:100% !important; height:100% !important; display:block; }
    #hud-overlay { position:fixed; top:0; left:0; right:0; pointer-events:none; z-index:100; }
    #shop-overlay { position:fixed; inset:0; z-index:200; display:none; }
  </style>
</head>
<body>
  <div id="game-mount"></div>
  <div id="hud-overlay"></div>
  <div id="shop-overlay"></div>

  <script src="phaser.min.js"></script>
  <script src="rpc.js"></script>
  <script src="constants.js"></script>
  <script src="ChefScene.js"></script>
  <script src="StationManager.js"></script>
  <script src="CustomerManager.js"></script>
  <script src="ChefController.js"></script>
  <script src="KitchenExpander.js"></script>
  <script src="HUD.js"></script>
  <script src="ShopScreen.js"></script>
  <script src="ParticleEffects.js"></script>
  <script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Upload and verify kitchen renders**

```bash
cd /home/rogerkorantenng/dev/Hackathons/drift-kitchen
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

Expected: `Automatically bumped app version` + `done` + `✨ Visit...`

Open `https://www.reddit.com/r/drift_kitchen_dev/?playtest=drift-kitchen` — should see warm cream checkered isometric floor, dark wood back wall, wooden service counter, lanterns, chef sprite with hat.

- [ ] **Step 5: Commit**

```bash
git add webroot/ChefScene.js webroot/main.js webroot/index.html
git commit -m "feat: isometric kitchen world — floor, walls, counter, lanterns, chef sprite, d-pad"
```

---

## Task 3: StationManager.js — Station state machine

**Files:**
- Create: `webroot/StationManager.js`

**Interfaces:**
- Consumes: `STATIONS`, `UPGRADE_BASE_COSTS`, `STATION_LAYOUT`, `C`, `isoToScreen()` from constants.js; `window.CHEF_SCENE` for visual methods
- Produces: `window.STATION_MGR` with methods: `getStations()`, `startCooking(id)`, `isReady(id)`, `pickUp(id)`, `upgradeStation(id)`, `canUpgrade(id, coins)`, `getUpgradeCost(id)`, `resetForNewShift()`

- [ ] **Step 1: Create StationManager.js**

```javascript
// webroot/StationManager.js
// Manages all station state: cooking timers, ready state, upgrade levels.
// Draws station visuals on the Phaser scene.
// Listens for dk:sceneReady to draw, dk:interact to handle chef interaction.

const StationManager = (() => {
  const _stations = {};   // id → { type, col, row, level, cooking, cookStart, ready, objs }
  let _kitchenTier = 1;

  // Called when scene is ready — draw all stations for current tier
  function _init(tier) {
    _kitchenTier = tier;
    Object.keys(_stations).forEach(id => _destroyStation(id));
    const layout = STATION_LAYOUT[tier] || STATION_LAYOUT[1];
    const tierData = KITCHEN_TIERS[tier];

    // Spread stations evenly along back row (row 1, wall-adjacent)
    const spacing = tierData.cols / (layout.length + 1);
    layout.forEach((type, i) => {
      const col = Math.round(spacing * (i + 1));
      const id  = type;
      _stations[id] = {
        id, type, col, row: 1,
        level: _stations[id]?.level || 0,
        cooking: false, cookStart: 0, ready: false, objs: {},
      };
      _drawStation(_stations[id]);
    });
  }

  function _drawStation(st) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const meta = STATIONS[st.type];
    const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
    const TW = TILE_W, TH = TILE_H;
    const cx = x + TW / 2, cy = y + TH / 2;
    const objs = {};

    // Station body — isometric box
    const body = scene.add.graphics().setDepth(10);
    const sideColor = Phaser.Display.Color.ValueToColor(meta.color).darken(25).color;
    // Top face
    body.fillStyle(meta.color, 1);
    body.fillPoints([
      { x: cx,           y: cy - TH * 0.4 },
      { x: cx + TW * 0.5,y: cy - TH * 0.15 },
      { x: cx,           y: cy + TH * 0.1  },
      { x: cx - TW * 0.5,y: cy - TH * 0.15 },
    ], true);
    // Front face
    body.fillStyle(sideColor, 1);
    body.fillPoints([
      { x: cx - TW * 0.5, y: cy - TH * 0.15 },
      { x: cx,             y: cy + TH * 0.1  },
      { x: cx,             y: cy + TH * 0.45 },
      { x: cx - TW * 0.5, y: cy + TH * 0.2  },
    ], true);
    // Right face (slightly darker)
    body.fillStyle(Phaser.Display.Color.ValueToColor(meta.color).darken(15).color, 1);
    body.fillPoints([
      { x: cx,             y: cy + TH * 0.1  },
      { x: cx + TW * 0.5, y: cy - TH * 0.15 },
      { x: cx + TW * 0.5, y: cy + TH * 0.2  },
      { x: cx,             y: cy + TH * 0.45 },
    ], true);
    // Shine on top
    body.fillStyle(C.white, 0.15);
    body.fillPoints([
      { x: cx,             y: cy - TH * 0.4  },
      { x: cx + TW * 0.25, y: cy - TH * 0.27 },
      { x: cx,             y: cy - TH * 0.15 },
      { x: cx - TW * 0.25, y: cy - TH * 0.27 },
    ], true);
    objs.body = body;

    // Emoji on top face
    objs.emoji = scene.add.text(cx, cy - TH * 0.22, meta.emoji, {
      fontSize: Math.round(TW * 0.38) + 'px',
    }).setOrigin(0.5).setDepth(11);

    // Level indicator
    objs.levelText = scene.add.text(cx + TW * 0.38, cy - TH * 0.42, 'Lv' + (st.level + 1), {
      fontSize: '8px', color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(12);

    // Cook progress ring (hidden until cooking)
    const ring = scene.add.graphics().setDepth(12).setVisible(false);
    objs.ring = ring; objs._cx = cx; objs._cy = cy;

    // READY badge (hidden)
    const badge = scene.add.graphics().setDepth(13).setVisible(false);
    badge.fillStyle(C.green, 1);
    badge.fillRoundedRect(cx - TW * 0.36, cy - TH * 0.72, TW * 0.72, 20, 5);
    objs.badge = badge;
    objs.badgeText = scene.add.text(cx, cy - TH * 0.62, '✓ READY', {
      fontSize: '9px', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5).setDepth(14).setVisible(false);

    // Upgrade icon (shown when player has enough coins)
    objs.upgradeIcon = scene.add.text(cx, cy - TH * 0.9, '', {
      fontSize: Math.round(TW * 0.3) + 'px',
    }).setOrigin(0.5).setDepth(14);

    // Tap zone
    const zone = scene.add.zone(cx, cy, TW * 0.9, TH * 1.4).setInteractive().setDepth(15);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:stationTapped', { detail: { id: st.id } })));
    objs.zone = zone;

    st.objs = objs;
  }

  function _destroyStation(id) {
    const st = _stations[id];
    if (!st || !st.objs) return;
    Object.values(st.objs).forEach(o => { try { o?.destroy?.(); } catch {} });
    st.objs = {};
  }

  function _updateProgressRing(st) {
    const o = st.objs; if (!o.ring) return;
    if (!st.cooking) { o.ring.setVisible(false); return; }
    o.ring.setVisible(true);
    const cookMs = _getCookMs(st);
    const pct = Math.min((Date.now() - st.cookStart) / cookMs, 1);
    o.ring.clear();
    o.ring.lineStyle(4, C.orange, 0.9);
    o.ring.beginPath();
    o.ring.arc(o._cx, o._cy - TILE_H * 0.25, TILE_W * 0.3, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2, false);
    o.ring.strokePath();
  }

  function _getCookMs(st) {
    let ms = STATIONS[st.type].cookMs;
    if (st.level >= 1) ms *= 0.8;
    if (st.level >= 4) ms *= 0.7;
    return Math.max(600, ms);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  function getStations() { return Object.values(_stations); }

  function startCooking(id) {
    const st = _stations[id];
    if (!st || st.cooking || st.ready) return false;
    st.cooking = true; st.cookStart = Date.now(); st.ready = false;
    const cookMs = _getCookMs(st);
    window.setTimeout(() => {
      st.ready = true; st.cooking = false;
      const o = st.objs;
      if (o.ring) o.ring.setVisible(false);
      if (o.badge) o.badge.setVisible(true);
      if (o.badgeText) o.badgeText.setVisible(true);
      // Bounce emoji
      if (o.emoji && window.CHEF_SCENE) {
        window.CHEF_SCENE.tweens.add({ targets: o.emoji, y: o.emoji.y - 6, duration: 120, yoyo: true });
      }
    }, cookMs);
    return true;
  }

  function isReady(id) { return _stations[id]?.ready === true; }

  function pickUp(id) {
    const st = _stations[id];
    if (!st || !st.ready) return null;
    st.ready = false; st.cooking = false;
    const o = st.objs;
    if (o.badge) o.badge.setVisible(false);
    if (o.badgeText) o.badgeText.setVisible(false);
    if (o.ring) { o.ring.setVisible(false); o.ring.clear(); }
    return st.type;  // return the dish type picked up
  }

  function getUpgradeCost(id) {
    const st = _stations[id];
    if (!st) return Infinity;
    return Math.floor(UPGRADE_BASE_COSTS[st.type] * Math.pow(1.8, st.level));
  }

  function canUpgrade(id, coins) { return st => getUpgradeCost(id) <= coins && (_stations[id]?.level || 0) < 4; }

  function upgradeStation(id) {
    const st = _stations[id];
    if (!st || st.level >= 4) return;
    st.level++;
    if (st.objs.levelText) st.objs.levelText.setText('Lv' + (st.level + 1));
    // Flash body gold
    if (st.objs.body && window.CHEF_SCENE) {
      window.CHEF_SCENE.tweens.add({ targets: st.objs.body, alpha: 0.3, duration: 100, yoyo: true, repeat: 3 });
    }
    window.CHEF_SCENE?.showFloatText(st.objs._cx, st.objs._cy - TILE_H, '⬆ Upgraded!', '#fbbf24');
  }

  function updateUpgradeIcons(coins) {
    Object.values(_stations).forEach(st => {
      if (!st.objs.upgradeIcon) return;
      const cost = getUpgradeCost(st.id);
      if (coins >= cost && st.level < 4) {
        st.objs.upgradeIcon.setText('💰').setVisible(true);
      } else {
        st.objs.upgradeIcon.setVisible(false);
      }
    });
  }

  function tickCookProgress() {
    Object.values(_stations).forEach(st => { if (st.cooking) _updateProgressRing(st); });
  }

  function resetForNewShift() {
    Object.values(_stations).forEach(st => {
      st.cooking = false; st.ready = false;
      if (st.objs.badge) st.objs.badge.setVisible(false);
      if (st.objs.badgeText) st.objs.badgeText.setVisible(false);
      if (st.objs.ring) { st.objs.ring.setVisible(false); st.objs.ring.clear(); }
    });
  }

  function rebuildForTier(tier) { _init(tier); }

  // ── Listeners ───────────────────────────────────────────────────────────────
  window.addEventListener('dk:sceneReady', () => _init(_kitchenTier));
  window.addEventListener('dk:kitchenRebuilt', (ev) => _init(ev.detail.tier));

  // Tick progress rings every frame via setInterval (not Phaser update — works even outside scene)
  setInterval(tickCookProgress, 50);

  return { getStations, startCooking, isReady, pickUp, getUpgradeCost, upgradeStation, updateUpgradeIcons, resetForNewShift, rebuildForTier };
})();

window.STATION_MGR = StationManager;
```

- [ ] **Step 2: Upload and verify stations render on scene**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

Open playtest — should see 2 station boxes (Grill + Drinks) rendered as isometric 3D blocks on the back row with emoji on top.

- [ ] **Step 3: Commit**

```bash
git add webroot/StationManager.js
git commit -m "feat: StationManager — iso station rendering, cook timers, upgrade levels"
```

---

## Task 4: CustomerManager.js — Customer spawning and order system

**Files:**
- Create: `webroot/CustomerManager.js`

**Interfaces:**
- Consumes: `STATIONS`, `COMBOS`, `CUSTOMER_PATIENCE`, `C`, `isoToScreen()` from constants.js; `window.CHEF_SCENE`; `window.DK_COUNTER_Y`
- Produces: `window.CUSTOMER_MGR` with methods: `startSpawning()`, `stopSpawning()`, `getCustomers()`, `matchesOrder(custId, heldItems)`, `serveCustomer(custId)`, `resetForNewShift()`

- [ ] **Step 1: Create CustomerManager.js**

```javascript
// webroot/CustomerManager.js
// Spawns customers at the counter, shows order bubbles and patience bars.
// Handles delivery matching: checks if chef's tray matches customer's order.

const CustomerManager = (() => {
  const _customers = {};
  let _cid = 0;
  let _spawnInterval = null;
  let _kitchenTier = 1;
  let _onCoinEarned = null;  // callback(amount, x, y)

  function setOnCoinEarned(cb) { _onCoinEarned = cb; }

  function startSpawning(tier) {
    _kitchenTier = tier;
    stopSpawning();
    _spawnInterval = setInterval(() => {
      const active = Object.values(_customers).filter(c => !c.served && !c.leaving).length;
      if (active < 4) _spawnOne();
    }, SPAWN_INTERVAL_MS);
  }

  function stopSpawning() {
    if (_spawnInterval) { clearInterval(_spawnInterval); _spawnInterval = null; }
  }

  function _spawnOne() {
    const scene = window.CHEF_SCENE;
    if (!scene) return;

    // Pick a combo for this tier
    const tier1 = _kitchenTier >= 4 ? 'premium' : _kitchenTier >= 2 ? 'full' : 'basic';
    const comboPools = ['basic'];
    if (_kitchenTier >= 2) comboPools.push('full');
    if (_kitchenTier >= 4) comboPools.push('premium');
    const comboType = comboPools[Math.floor(Math.random() * comboPools.length)];
    const comboList = COMBOS[comboType] || COMBOS.basic;
    // Filter combos to stations that exist in current layout
    const stationIds = (window.STATION_MGR?.getStations() || []).map(s => s.id);
    const validCombos = comboList.filter(c => c.every(t => stationIds.includes(t)));
    if (!validCombos.length) return;
    const order = validCombos[Math.floor(Math.random() * validCombos.length)];

    // Pick an empty counter column
    const tier = KITCHEN_TIERS[_kitchenTier] || KITCHEN_TIERS[1];
    const usedCols = Object.values(_customers).filter(c => !c.served && !c.leaving).map(c => c.col);
    const freeCols = Array.from({length: tier.cols}, (_, i) => i).filter(c => !usedCols.includes(c));
    if (!freeCols.length) return;
    const col = freeCols[Math.floor(Math.random() * freeCols.length)];

    // Determine type
    const roll = Math.random();
    const custType = roll < 0.1 ? 'vip' : roll < 0.3 ? 'impatient' : 'regular';

    const id = 'c' + (++_cid);
    const cust = { id, col, order, type: custType, served: false, leaving: false, spawnedAt: Date.now(),
      patienceMs: CUSTOMER_PATIENCE[custType] || CUSTOMER_PATIENCE.regular };
    _customers[id] = cust;
    _drawCustomer(cust);

    // Schedule patience timeout
    window.setTimeout(() => {
      if (!cust.served && !cust.leaving) {
        cust.leaving = true;
        _custLeave(cust, false);
      }
    }, cust.patienceMs);
  }

  function _drawCustomer(cust) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const { x, y } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
    const cx = x + TILE_W / 2;
    const cy = (window.DK_COUNTER_Y || y) - TILE_H * 0.3;
    const objs = {};

    // Unique body color per customer
    const hue = (cust.id.charCodeAt(1) * 53) % 360;
    const bodyColor = Phaser.Display.Color.HSLToColor(hue / 360, 0.65, 0.5).color;
    const darkColor = Phaser.Display.Color.HSLToColor(hue / 360, 0.65, 0.3).color;

    // Shadow
    const shadow = scene.add.graphics().setDepth(17);
    shadow.fillStyle(C.black, 0.12); shadow.fillEllipse(cx + 2, cy + TILE_H * 0.35, TILE_W * 0.45, TILE_H * 0.14);
    objs.shadow = shadow;

    // Body
    const sprite = scene.add.graphics().setDepth(18);
    sprite.fillStyle(bodyColor, 1);
    sprite.fillRoundedRect(cx - TILE_W * 0.17, cy - TILE_H * 0.08, TILE_W * 0.34, TILE_H * 0.42, 5);
    sprite.fillStyle(0xfde8c8, 1); sprite.fillRoundedRect(cx - TILE_W * 0.2, cy - TILE_H * 0.42, TILE_W * 0.4, TILE_H * 0.3, 6);
    sprite.fillStyle(darkColor, 1); sprite.fillArc(cx, cy - TILE_H * 0.34, TILE_W * 0.2, 180, 360, false);
    sprite.fillStyle(0x2d1a00, 1);
    sprite.fillCircle(cx - TILE_W * 0.07, cy - TILE_H * 0.3, TILE_W * 0.04);
    sprite.fillCircle(cx + TILE_W * 0.07, cy - TILE_H * 0.3, TILE_W * 0.04);
    // VIP crown
    if (cust.type === 'vip') {
      sprite.fillStyle(C.gold, 1);
      sprite.fillTriangle(cx - TILE_W * 0.12, cy - TILE_H * 0.56, cx, cy - TILE_H * 0.7, cx + TILE_W * 0.12, cy - TILE_H * 0.56);
    }
    objs.sprite = sprite;

    // Order bubble (white rounded box above head)
    const orderY = cy - TILE_H * 1.1;
    const bubble = scene.add.graphics().setDepth(19);
    const bubbleW = TILE_W * 0.35 * cust.order.length + TILE_W * 0.2;
    bubble.fillStyle(C.white, 0.97);
    bubble.fillRoundedRect(cx - bubbleW / 2, orderY - TILE_H * 0.3, bubbleW, TILE_H * 0.42, 7);
    bubble.lineStyle(1.5, 0xdddddd, 1); bubble.strokeRoundedRect(cx - bubbleW / 2, orderY - TILE_H * 0.3, bubbleW, TILE_H * 0.42, 7);
    bubble.fillTriangle(cx - TILE_W * 0.08, orderY + TILE_H * 0.12, cx + TILE_W * 0.08, orderY + TILE_H * 0.12, cx, orderY + TILE_H * 0.28);
    objs.bubble = bubble;

    // Order emojis
    cust.order.forEach((type, i) => {
      const ex = cx - (cust.order.length - 1) * TILE_W * 0.17 + i * TILE_W * 0.34;
      const et = scene.add.text(ex, orderY - TILE_H * 0.1, STATIONS[type]?.emoji || '?', {
        fontSize: Math.round(TILE_W * 0.28) + 'px',
      }).setOrigin(0.5).setDepth(20);
      objs['emo' + i] = et;
    });

    // Patience bar
    const barW = TILE_W * 0.7;
    const barBg = scene.add.graphics().setDepth(19);
    barBg.fillStyle(C.black, 0.35); barBg.fillRoundedRect(cx - barW / 2, cy + TILE_H * 0.36, barW, 6, 3);
    objs.barBg = barBg;
    const barFill = scene.add.graphics().setDepth(20);
    objs.barFill = barFill; objs._cx = cx; objs._cy = cy; objs._barW = barW;

    // Interactive zone
    const zone = scene.add.zone(cx, cy, TILE_W, TILE_H * 1.5).setInteractive().setDepth(21);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:customerTapped', { detail: { id: cust.id } })));
    objs.zone = zone;

    cust.objs = objs;
  }

  // Call each frame to update patience bars
  function tick() {
    const now = Date.now();
    Object.values(_customers).forEach(cust => {
      if (cust.served || cust.leaving || !cust.objs?.barFill) return;
      const pct = Math.max(0, 1 - (now - cust.spawnedAt) / cust.patienceMs);
      const col = pct > 0.5 ? C.green : pct > 0.25 ? C.gold : C.red;
      const o = cust.objs;
      o.barFill.clear();
      o.barFill.fillStyle(col, 1);
      o.barFill.fillRoundedRect(o._cx - o._barW / 2, o._cy + TILE_H * 0.36, o._barW * pct, 6, 3);
    });
  }
  setInterval(tick, 50);

  function _custLeave(cust, served) {
    cust.leaving = true;
    const objs = cust.objs || {};
    const targets = Object.values(objs).filter(o => o && typeof o.setAlpha === 'function');
    if (window.CHEF_SCENE && targets.length) {
      window.CHEF_SCENE.tweens.add({ targets, alpha: 0, duration: 350, onComplete: () => _destroyCust(cust.id) });
    } else {
      _destroyCust(cust.id);
    }
    if (!served && window.CHEF_SCENE) {
      const x = isoToScreen(cust.col, 0, window.CHEF_SCENE.originX, window.CHEF_SCENE.originY).x + TILE_W / 2;
      window.CHEF_SCENE.showFloatText(x, (window.DK_COUNTER_Y || 100) - TILE_H * 0.5, '😤 Left!', '#ef4444');
    }
    // Schedule next spawn
    if (_spawnInterval) window.setTimeout(() => {
      const active = Object.values(_customers).filter(c => !c.served && !c.leaving).length;
      if (active < 4) _spawnOne();
    }, 1500);
  }

  function _destroyCust(id) {
    const cust = _customers[id];
    if (cust?.objs) Object.values(cust.objs).forEach(o => { try { o?.destroy?.(); } catch {} });
    delete _customers[id];
  }

  function getCustomers() { return Object.values(_customers).filter(c => !c.served && !c.leaving); }

  function matchesOrder(custId, heldItems) {
    const cust = _customers[custId];
    if (!cust) return false;
    if (heldItems.length !== cust.order.length) return false;
    const held = [...heldItems].sort();
    const want = [...cust.order].sort();
    return held.every((h, i) => h === want[i]);
  }

  function serveCustomer(custId, speedFactor) {
    const cust = _customers[custId];
    if (!cust || cust.served) return 0;
    cust.served = true;
    // Compute coins: base × tip multiplier × craving multiplier
    const baseCoins = cust.order.reduce((s, t) => s + (STATIONS[t]?.baseCoins || 5), 0);
    const tip = 1 + speedFactor * 0.6;
    const earned = Math.ceil(baseCoins * tip);
    _custLeave(cust, true);
    if (_onCoinEarned) {
      const cx = isoToScreen(cust.col, 0, window.CHEF_SCENE?.originX || 0, window.CHEF_SCENE?.originY || 0).x + TILE_W / 2;
      _onCoinEarned(earned, cx, window.DK_COUNTER_Y || 100);
    }
    return earned;
  }

  function resetForNewShift() {
    Object.keys(_customers).forEach(_destroyCust);
    stopSpawning();
  }

  window.addEventListener('dk:sceneReady', () => {/* scene ready, waiting for shift start */});

  return { startSpawning, stopSpawning, getCustomers, matchesOrder, serveCustomer, resetForNewShift, setOnCoinEarned };
})();

window.CUSTOMER_MGR = CustomerManager;
```

- [ ] **Step 2: Upload and verify customers spawn after a brief wait**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

Open playtest — within 4 seconds of opening the game, a colorful customer should appear at the counter with an order bubble showing food emojis and a green patience bar.

- [ ] **Step 3: Commit**

```bash
git add webroot/CustomerManager.js
git commit -m "feat: CustomerManager — customer spawning, order bubbles, patience bars, delivery matching"
```

---

## Task 5: ChefController.js — Tray, interact, and game loop

**Files:**
- Create: `webroot/ChefController.js`

**Interfaces:**
- Consumes: `window.CHEF_SCENE`, `window.STATION_MGR`, `window.CUSTOMER_MGR`, `CHEF_TRAY_BASE`, `C`
- Produces: `window.CHEF_CTRL` with methods: `startShift()`, `endShift()`, `getCoins()`, `getHeld()`
- Fires events: `dk:shiftEnded` `{ detail: { coins } }`

- [ ] **Step 1: Create ChefController.js**

```javascript
// webroot/ChefController.js
// Wires together chef movement, tray logic, station interaction, and customer delivery.
// Manages the shift timer and fires dk:shiftEnded when done.

const ChefController = (() => {
  let _tray      = [];     // array of dish type strings
  let _trayMax   = CHEF_TRAY_BASE;
  let _coins     = 0;
  let _shiftCoins = 0;
  let _shiftTimer = null;
  let _shiftActive = false;
  let _speedMult = 1.0;
  let _kitchenTier = 1;

  // Devvit server state
  let _serverCoins = 0;
  let _cravings = [];

  function _getCravingMult(type) {
    const match = _cravings.find(c => {
      const cl = (c.category || '').toLowerCase();
      return cl === type || (type === 'grill' && cl === 'grilled') ||
        (type === 'fryer' && cl === 'street') || (type === 'wok' && cl === 'comfort');
    });
    return match ? match.multiplier : 1;
  }

  // ── Interact (called by d-pad ✋ button or station/customer tap) ──────────────
  function _interact() {
    const scene = window.CHEF_SCENE;
    const stMgr = window.STATION_MGR;
    const custMgr = window.CUSTOMER_MGR;
    if (!scene || !stMgr || !custMgr) return;

    const chefPos = scene.getPlayerPos();

    // Find nearest station (within 1.5 tiles)
    const stations = stMgr.getStations();
    let nearestStation = null, nearestDist = TILE_W * 2.0;
    stations.forEach(st => {
      const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
      const sx = x + TILE_W / 2, sy = y + TILE_H / 2;
      const d = Math.hypot(chefPos.x - sx, chefPos.y - sy);
      if (d < nearestDist) { nearestStation = st; nearestDist = d; }
    });

    if (nearestStation) {
      if (stMgr.isReady(nearestStation.id) && _tray.length < _trayMax) {
        // Pick up finished dish
        const dish = stMgr.pickUp(nearestStation.id);
        if (dish) {
          _tray.push(dish);
          scene.setHeldItems(_tray.map(t => STATIONS[t]?.emoji || '?'));
          scene.showFloatText(chefPos.x, chefPos.y - TILE_H, 'Picked up!', '#38bdf8');
          _tryDeliverNearest(chefPos, custMgr, scene);
        }
        return;
      } else if (!nearestStation.cooking && !nearestStation.ready) {
        // Start cooking
        stMgr.startCooking(nearestStation.id);
        scene.showFloatText(chefPos.x, chefPos.y - TILE_H, 'Cooking…', '#94a3b8');
        return;
      } else if (nearestStation.cooking) {
        scene.showFloatText(chefPos.x, chefPos.y - TILE_H, 'Still cooking…', '#94a3b8');
        return;
      }
    }

    // Try to deliver to a customer
    _tryDeliverNearest(chefPos, custMgr, scene);
  }

  function _tryDeliverNearest(chefPos, custMgr, scene) {
    if (_tray.length === 0) return;
    const customers = custMgr.getCustomers();
    let best = null, bestDist = TILE_W * 3;
    customers.forEach(c => {
      if (!custMgr.matchesOrder(c.id, _tray)) return;
      const { x } = isoToScreen(c.col, 0, scene.originX, scene.originY);
      const cx = x + TILE_W / 2;
      const d = Math.hypot(chefPos.x - cx, chefPos.y - (window.DK_COUNTER_Y || 0));
      if (d < bestDist) { best = c; bestDist = d; }
    });
    if (best) {
      _deliver(best, custMgr, scene);
    } else if (_tray.length > 0) {
      scene.showFloatText(chefPos.x, chefPos.y - TILE_H, 'No matching customer', '#8b949e', 11);
    }
  }

  function _deliver(cust, custMgr, scene) {
    const elapsed = Date.now() - cust.spawnedAt;
    const speedFactor = Math.max(0, 1 - elapsed / cust.patienceMs);
    const baseEarned = custMgr.serveCustomer(cust.id, speedFactor);
    // Apply craving multiplier (per dish in order)
    const cravingBonus = cust.order.reduce((max, t) => Math.max(max, _getCravingMult(t)), 1);
    const earned = Math.ceil(baseEarned * cravingBonus);

    _coins += earned;
    _shiftCoins += earned;
    _serverCoins += earned;
    _tray = [];
    scene.setHeldItems([]);

    const cx = isoToScreen(cust.col, 0, scene.originX, scene.originY).x + TILE_W / 2;
    const bonus = cravingBonus > 1 ? ` ×${cravingBonus}🔥` : '';
    scene.showFloatText(cx, (window.DK_COUNTER_Y || 100) - TILE_H * 0.8, `+${earned}🪙${bonus}`, '#fbbf24', 14);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins, shiftCoins: _shiftCoins } }));
    window.STATION_MGR?.updateUpgradeIcons(_coins);

    // Tell server
    send('DISH_SERVED', { stationId: 'manual', category: cust.order[0] });
  }

  // ── Station tapped directly ────────────────────────────────────────────────
  window.addEventListener('dk:stationTapped', (ev) => {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const st = window.STATION_MGR?.getStations().find(s => s.id === ev.detail.id);
    if (!st) return;
    const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
    scene.walkPlayerTo(x + TILE_W / 2, y + TILE_H * 1.4, () => _interact());
  });

  // ── Customer tapped directly ───────────────────────────────────────────────
  window.addEventListener('dk:customerTapped', (ev) => {
    const scene = window.CHEF_SCENE;
    const custMgr = window.CUSTOMER_MGR;
    if (!scene || !custMgr) return;
    const cust = custMgr.getCustomers().find(c => c.id === ev.detail.id);
    if (!cust) return;
    if (custMgr.matchesOrder(cust.id, _tray)) {
      const { x } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
      scene.walkPlayerTo(x + TILE_W / 2, (window.DK_COUNTER_Y || 200) + TILE_H * 0.3, () => _deliver(cust, custMgr, scene));
    } else {
      scene.showFloatText(isoToScreen(cust.col, 0, scene.originX, scene.originY).x + TILE_W/2,
        (window.DK_COUNTER_Y||200) - TILE_H, "Need: " + cust.order.map(t => STATIONS[t]?.emoji||'?').join(''), '#8b949e', 11);
    }
  });

  // ── Interact button ────────────────────────────────────────────────────────
  window.addEventListener('dk:interact', () => _interact());

  // ── Mid-shift station upgrade ──────────────────────────────────────────────
  function tryUpgradeNearest() {
    const scene = window.CHEF_SCENE;
    const stMgr = window.STATION_MGR;
    if (!scene || !stMgr) return;
    const chefPos = scene.getPlayerPos();
    const stations = stMgr.getStations();
    let nearest = null, nearestDist = TILE_W * 1.8;
    stations.forEach(st => {
      const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
      const d = Math.hypot(chefPos.x - (x + TILE_W/2), chefPos.y - (y + TILE_H/2));
      if (d < nearestDist && stMgr.getUpgradeCost(st.id) <= _coins && st.level < 4) {
        nearest = st; nearestDist = d;
      }
    });
    if (nearest) {
      const cost = stMgr.getUpgradeCost(nearest.id);
      _coins -= cost; _shiftCoins -= Math.min(_shiftCoins, cost);
      stMgr.upgradeStation(nearest.id);
      window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins, shiftCoins: _shiftCoins } }));
      // Tell server to save upgrade
      send('BUY_UPGRADE', { stationId: nearest.id });
    }
  }

  // ── Shift management ───────────────────────────────────────────────────────
  function startShift(tier) {
    _kitchenTier = tier || 1;
    _shiftActive = true;
    _shiftCoins  = 0;
    _tray = [];
    const scene = window.CHEF_SCENE;
    if (scene) scene.setHeldItems([]);
    window.CUSTOMER_MGR?.startSpawning(_kitchenTier);
    window.STATION_MGR?.resetForNewShift();
    const shiftMs = (SHIFT_DURATIONS[_kitchenTier] || 60) * 1000;
    const endTime = Date.now() + shiftMs;
    window.dispatchEvent(new CustomEvent('dk:shiftStarted', { detail: { durationMs: shiftMs, endTime } }));
    _shiftTimer = window.setTimeout(() => {
      _shiftActive = false;
      window.CUSTOMER_MGR?.stopSpawning();
      window.dispatchEvent(new CustomEvent('dk:shiftEnded', { detail: { coins: _shiftCoins, total: _coins } }));
    }, shiftMs);
  }

  function endShift() {
    if (_shiftTimer) clearTimeout(_shiftTimer);
    _shiftActive = false;
    window.CUSTOMER_MGR?.stopSpawning();
  }

  function getCoins() { return _coins; }
  function getHeld()  { return [..._tray]; }

  function setFromServer(state, cravings) {
    _coins = state?.coins || 0;
    _serverCoins = _coins;
    _cravings = cravings || [];
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins, shiftCoins: 0 } }));
  }

  function upgradeChefSpeed(level) { _speedMult = 1 + level * 0.15; }
  function upgradeTraySize(level)  { _trayMax = CHEF_TRAY_BASE + level; }

  // Devvit server listeners
  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const { state, cravings } = ev.detail;
    setFromServer(state, cravings?.cravings?.multipliers);
    window.dispatchEvent(new CustomEvent('dk:sceneReady')); // may already have fired
    window.setTimeout(() => {
      startShift(1);
    }, 500);
  });

  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) => {
    _cravings = ev.detail?.cravings?.multipliers || [];
  });

  window.CUSTOMER_MGR?.setOnCoinEarned?.((amount, x, y) => {
    // Coin arcs handled in ParticleEffects.js
    window.dispatchEvent(new CustomEvent('dk:coinEarned', { detail: { amount, x, y } }));
  });

  return { startShift, endShift, getCoins, getHeld, setFromServer, upgradeChefSpeed, upgradeTraySize, tryUpgradeNearest };
})();

window.CHEF_CTRL = ChefController;
```

- [ ] **Step 2: Upload and test the full cook-and-deliver loop**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

Test: open playtest → walk to Grill station → press ✋ → see "Cooking…" → wait 3s → READY badge appears → press ✋ again → emoji appears above chef head → tap the customer at the counter → coins pop → customer leaves happy.

- [ ] **Step 3: Commit**

```bash
git add webroot/ChefController.js
git commit -m "feat: ChefController — tray management, interact, delivery, shift timer"
```

---

## Task 6: HUD.js — HTML overlay HUD

**Files:**
- Create: `webroot/HUD.js`

**Interfaces:**
- Consumes: DOM `#hud-overlay`, events `dk:coinsChanged`, `dk:shiftStarted`, `dk:shiftEnded`, Devvit `INIT_RESPONSE` (harbor/craving data)
- Produces: visible HUD bar with coin count, shift timer, harbor name, craving badges

- [ ] **Step 1: Create HUD.js**

```javascript
// webroot/HUD.js
// HTML/CSS overlay HUD — top bar with coins, timer, harbor banner, craving badges.
// Injected into #hud-overlay div. Pure HTML/CSS — no Phaser.

const HUD = (() => {
  function _build() {
    const el = document.getElementById('hud-overlay');
    if (!el) return;
    el.innerHTML = `
      <div id="hud-bar" style="
        display:flex; align-items:center; justify-content:space-between;
        padding:6px 12px; background:rgba(26,15,0,0.88);
        backdrop-filter:blur(4px); border-bottom:2px solid #f97316;
        font-family:system-ui,sans-serif; pointer-events:none; gap:8px;
      ">
        <div style="min-width:0;">
          <div id="hud-harbor" style="font-size:11px;font-weight:700;color:#38bdf8;">⚓ r/Cooking</div>
          <div id="hud-craving" style="font-size:9px;color:#fbbf24;margin-top:1px;"></div>
        </div>
        <div style="text-align:center;flex-shrink:0;">
          <div id="hud-timer" style="font-size:14px;font-weight:800;color:#e6edf3;">⏱ 1:00</div>
        </div>
        <div style="
          background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.3);
          border-radius:20px; padding:3px 10px; flex-shrink:0;
        ">
          <span style="font-size:13px;font-weight:800;color:#fbbf24;">🪙 <span id="hud-coins">0</span></span>
        </div>
      </div>
    `;
  }

  function _fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return String(n);
  }

  let _endTime = 0, _timerInterval = null;

  function _startTimer(durationMs) {
    _endTime = Date.now() + durationMs;
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(() => {
      const rem = Math.max(0, _endTime - Date.now());
      const s = Math.ceil(rem / 1000);
      const m = Math.floor(s / 60);
      const timerEl = document.getElementById('hud-timer');
      if (timerEl) {
        timerEl.textContent = `⏱ ${m}:${String(s % 60).padStart(2,'0')}`;
        timerEl.style.color = rem < 15000 ? '#ef4444' : '#e6edf3';
      }
      if (rem <= 0) clearInterval(_timerInterval);
    }, 250);
  }

  // ── Event listeners ─────────────────────────────────────────────────────────
  window.addEventListener('dk:coinsChanged', (ev) => {
    const el = document.getElementById('hud-coins');
    if (el) el.textContent = _fmt(ev.detail.coins);
  });

  window.addEventListener('dk:shiftStarted', (ev) => {
    _startTimer(ev.detail.durationMs);
  });

  window.addEventListener('dk:shiftEnded', () => {
    if (_timerInterval) clearInterval(_timerInterval);
    const timerEl = document.getElementById('hud-timer');
    if (timerEl) { timerEl.textContent = '⏱ Done!'; timerEl.style.color = '#f97316'; }
  });

  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const harborEl  = document.getElementById('hud-harbor');
    const cravingEl = document.getElementById('hud-craving');
    const harborId  = ev.detail?.cravings?.harborId || 'Cooking';
    const mults     = ev.detail?.cravings?.cravings?.multipliers || [];
    if (harborEl)  harborEl.textContent  = `⚓ r/${harborId}`;
    if (cravingEl) cravingEl.textContent = mults.slice(0,2).map(c => `${c.label} ×${c.multiplier}`).join('  ');
  });

  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) => {
    const harborEl  = document.getElementById('hud-harbor');
    const cravingEl = document.getElementById('hud-craving');
    if (harborEl)  harborEl.textContent  = `⚓ r/${ev.detail.harborId}`;
    if (cravingEl) cravingEl.textContent = (ev.detail.cravings?.multipliers || []).slice(0,2).map(c=>`${c.label} ×${c.multiplier}`).join('  ');
  });

  // Build immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _build);
  } else {
    _build();
  }

  return {};
})();
```

- [ ] **Step 2: Upload and verify HUD renders**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

Open playtest — top bar should show: harbor name (blue), craving text (gold), shift timer (white), coin counter (gold pill). Timer should count down when a shift is active.

- [ ] **Step 3: Commit**

```bash
git add webroot/HUD.js
git commit -m "feat: HUD — HTML overlay with coin counter, shift timer, harbor banner, cravings"
```

---

## Task 7: ShopScreen.js — Between-shift upgrade shop

**Files:**
- Create: `webroot/ShopScreen.js`

**Interfaces:**
- Consumes: DOM `#shop-overlay`, events `dk:shiftEnded`, `dk:coinsChanged`; `window.CHEF_CTRL`, `window.STATION_MGR`; `STATIONS`, `SHOP_UPGRADES`, `KITCHEN_TIERS` from constants.js
- Produces: HTML/CSS shop screen shown after each shift, fires `dk:shopClosed` when player clicks Next Shift

- [ ] **Step 1: Create ShopScreen.js**

```javascript
// webroot/ShopScreen.js
// HTML/CSS upgrade shop shown between shifts.
// Shows: shift summary, station upgrades, chef upgrades, kitchen expansion.

const ShopScreen = (() => {
  let _coins      = 0;
  let _kitchenTier = 1;
  let _upgrades   = { chefSpeed: 0, traySize: 0 };
  let _shiftCoins = 0;
  let _totalCoins = 0;

  function _fmt(n) {
    n = Math.floor(n);
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return String(n);
  }

  function show(shiftCoins, totalCoins) {
    _shiftCoins = shiftCoins; _totalCoins = totalCoins; _coins = totalCoins;
    const el = document.getElementById('shop-overlay');
    if (!el) return;
    el.style.display = 'flex';
    el.style.cssText += ';flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;';
    _render(el);
  }

  function hide() {
    const el = document.getElementById('shop-overlay');
    if (el) el.style.display = 'none';
  }

  function _render(el) {
    const stMgr = window.STATION_MGR;
    const stations = stMgr?.getStations() || [];

    el.innerHTML = `
      <div style="
        width:100%; min-height:100%;
        background:linear-gradient(180deg,#fdf6e3 0%,#f5e6d3 100%);
        font-family:system-ui,sans-serif; padding:0 0 40px;
      ">
        <!-- Summary header -->
        <div style="background:#4a3728;padding:16px;text-align:center;border-bottom:3px solid #f97316;">
          <div style="font-size:20px;font-weight:900;color:#f97316;">🍳 Shift Complete!</div>
          <div style="font-size:24px;font-weight:800;color:#fbbf24;margin:6px 0;">🪙 ${_fmt(_shiftCoins)}</div>
          <div style="font-size:11px;color:#d4b896;">Total: 🪙 ${_fmt(_totalCoins)}</div>
        </div>

        <!-- Available coins -->
        <div style="text-align:center;padding:10px;font-size:13px;color:#4a3728;font-weight:700;">
          Available to spend: <span id="shop-avail" style="color:#f97316;">🪙 ${_fmt(_coins)}</span>
        </div>

        <!-- Station upgrades -->
        <div style="padding:0 12px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b5e3c;margin-bottom:8px;">STATIONS</div>
          ${stations.map(st => {
            const meta = STATIONS[st.type];
            const cost = stMgr.getUpgradeCost(st.id);
            const maxed = st.level >= 4;
            const canAff = _coins >= cost && !maxed;
            return `<div style="
              display:flex;align-items:center;gap:10px;
              background:#fff8f0;border:1px solid #d4b896;border-radius:10px;
              padding:8px 10px;margin-bottom:6px;
            ">
              <span style="font-size:20px;">${meta.emoji}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:700;color:#1a0f00;">${meta.label}</div>
                <div style="font-size:9px;color:#8b5e3c;">${_levelDesc(st.level)}</div>
                <div style="display:flex;gap:3px;margin-top:4px;">
                  ${[0,1,2,3,4].map(i=>`<div style="width:10px;height:10px;border-radius:50%;background:${i<=st.level?'#f97316':'#d4b896'};"></div>`).join('')}
                </div>
              </div>
              <button onclick="window._shopUpgradeStation('${st.id}')" style="
                background:${canAff?'#f97316':'#d4b896'};color:#fff;border:none;
                border-radius:8px;padding:6px 10px;font-size:10px;font-weight:700;cursor:pointer;
                min-width:60px;
              " ${!canAff?'disabled':''}>
                ${maxed ? 'MAX' : '🪙'+_fmt(cost)}
              </button>
            </div>`;
          }).join('')}
        </div>

        <!-- Chef upgrades -->
        <div style="padding:0 12px;margin-top:8px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b5e3c;margin-bottom:8px;">CHEF</div>
          ${Object.entries(SHOP_UPGRADES).filter(([k])=>k!=='kitchenTier').map(([key, def]) => {
            const level = _upgrades[key] || 0;
            const cost  = Math.floor(def.baseCost * Math.pow(1.8, level));
            const maxed = level >= def.maxLevel;
            const canAff = _coins >= cost && !maxed;
            return `<div style="
              display:flex;align-items:center;gap:10px;
              background:#fff8f0;border:1px solid #d4b896;border-radius:10px;
              padding:8px 10px;margin-bottom:6px;
            ">
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:700;color:#1a0f00;">${def.label}</div>
                <div style="font-size:9px;color:#8b5e3c;">${def.desc}</div>
                <div style="display:flex;gap:3px;margin-top:4px;">
                  ${Array.from({length:def.maxLevel},(_,i)=>`<div style="width:10px;height:10px;border-radius:50%;background:${i<level?'#f97316':'#d4b896'};"></div>`).join('')}
                </div>
              </div>
              <button onclick="window._shopUpgradeChef('${key}')" style="
                background:${canAff?'#22c55e':'#d4b896'};color:#fff;border:none;
                border-radius:8px;padding:6px 10px;font-size:10px;font-weight:700;cursor:pointer;min-width:60px;
              " ${!canAff?'disabled':''}>${maxed?'MAX':'🪙'+_fmt(cost)}</button>
            </div>`;
          }).join('')}
        </div>

        <!-- Kitchen expansion -->
        ${_renderExpansion()}

        <!-- Next shift button -->
        <div style="padding:16px 12px 0;">
          <button onclick="window._shopNextShift()" style="
            width:100%;padding:14px;background:#f97316;color:#fff;
            border:none;border-radius:14px;font-size:15px;font-weight:800;cursor:pointer;
          ">▶ Next Shift</button>
        </div>
      </div>
    `;
  }

  function _levelDesc(level) {
    const descs = ['Basic', 'Faster cook (−20%)', 'Auto-cooks!', 'Double output', 'Gold upgrade (−30%)'];
    return 'Upgrade ' + (level + 1) + '/5: ' + (descs[level] || descs[0]);
  }

  function _renderExpansion() {
    const nextTier = _kitchenTier + 1;
    if (nextTier > 5) return '';
    const tierData = KITCHEN_TIERS[nextTier];
    const canAff = _coins >= tierData.unlockCost;
    return `
      <div style="padding:0 12px;margin-top:8px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b5e3c;margin-bottom:8px;">EXPAND KITCHEN</div>
        <div style="background:#fff8f0;border:2px solid ${canAff?'#f97316':'#d4b896'};border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <div style="font-size:24px;">🏗</div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:700;color:#1a0f00;">${tierData.label}</div>
            <div style="font-size:9px;color:#8b5e3c;">Bigger kitchen + new stations</div>
          </div>
          <button onclick="window._shopExpandKitchen()" style="
            background:${canAff?'#f97316':'#d4b896'};color:#fff;border:none;
            border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer;
          " ${!canAff?'disabled':''}>🪙${_fmt(tierData.unlockCost)}</button>
        </div>
      </div>
    `;
  }

  function _refreshCoinsDisplay() {
    const el = document.getElementById('shop-avail');
    if (el) el.textContent = '🪙 ' + _fmt(_coins);
    // Re-render fully to update button states
    const overlay = document.getElementById('shop-overlay');
    if (overlay && overlay.style.display !== 'none') _render(overlay);
  }

  // ── Global handlers (called by onclick in HTML) ────────────────────────────
  window._shopUpgradeStation = (id) => {
    const stMgr = window.STATION_MGR;
    const cost = stMgr?.getUpgradeCost(id);
    if (_coins < cost) return;
    _coins -= cost; _totalCoins -= cost;
    stMgr.upgradeStation(id);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins } }));
    _refreshCoinsDisplay();
  };

  window._shopUpgradeChef = (key) => {
    const def = SHOP_UPGRADES[key]; if (!def) return;
    const level = _upgrades[key] || 0;
    if (level >= def.maxLevel) return;
    const cost = Math.floor(def.baseCost * Math.pow(1.8, level));
    if (_coins < cost) return;
    _coins -= cost; _totalCoins -= cost;
    _upgrades[key] = level + 1;
    if (key === 'chefSpeed')  window.CHEF_CTRL?.upgradeChefSpeed(_upgrades[key]);
    if (key === 'traySize')   window.CHEF_CTRL?.upgradeTraySize(_upgrades[key]);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins } }));
    _refreshCoinsDisplay();
  };

  window._shopExpandKitchen = () => {
    const nextTier = _kitchenTier + 1;
    const tierData = KITCHEN_TIERS[nextTier];
    if (!tierData || _coins < tierData.unlockCost) return;
    _coins -= tierData.unlockCost; _totalCoins -= tierData.unlockCost;
    _kitchenTier = nextTier;
    window.CHEF_SCENE?.rebuildKitchen(nextTier);
    window.STATION_MGR?.rebuildForTier(nextTier);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins } }));
    window.dispatchEvent(new CustomEvent('dk:kitchenExpanded', { detail: { tier: nextTier } }));
    _refreshCoinsDisplay();
  };

  window._shopNextShift = () => {
    hide();
    // Save to server
    send('SAVE_STATE', { state: {
      saveVersion:1, coins:_coins, renown:0, tradeTokens:0,
      lifetimeCoinsThisRun:_totalCoins, stations:[], crew:[],
      voyageCount:0, unlockedCuisineTiers:_kitchenTier-1, incomeMultiplierLevel:0,
      offlineCapLevel:_upgrades.chefSpeed||0, offlineEffLevel:0,
      cookSpeedLevel:_upgrades.chefSpeed||0, startingCoinsLevel:0,
      extraRerollUnlocked:false, royaltyBoostLevel:0,
      streak:0, lastStreakDate:'', rerollsToday:0,
      lastSeen:Date.now(), incomePerSec:0,
    }});
    window.CHEF_CTRL?.startShift(_kitchenTier);
    window.dispatchEvent(new CustomEvent('dk:shopClosed'));
  };

  // ── Event listeners ─────────────────────────────────────────────────────────
  window.addEventListener('dk:shiftEnded', (ev) => {
    window.setTimeout(() => show(ev.detail.coins, ev.detail.total), 1200);
  });

  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    _coins = ev.detail?.state?.coins || 0;
    _totalCoins = _coins;
    _kitchenTier = (ev.detail?.state?.unlockedCuisineTiers || 0) + 1;
    _upgrades.chefSpeed = ev.detail?.state?.cookSpeedLevel || 0;
  });

  return { show, hide };
})();

window.SHOP_SCREEN = ShopScreen;
```

- [ ] **Step 2: Upload and verify shop appears after shift ends**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

Play for 60 seconds. When the timer hits 0, the shop screen should appear with a warm cream background, station upgrade cards, chef upgrade cards, and a "Next Shift" button. Tapping upgrades should update available coins.

- [ ] **Step 3: Commit**

```bash
git add webroot/ShopScreen.js
git commit -m "feat: ShopScreen — between-shift HTML/CSS upgrade shop with station, chef, kitchen expansion"
```

---

## Task 8: KitchenExpander.js — Expansion animation

**Files:**
- Create: `webroot/KitchenExpander.js`

**Interfaces:**
- Consumes: `window.CHEF_SCENE`, `KITCHEN_TIERS`, events `dk:kitchenExpanded`
- Produces: expansion flash/sparkle animation when kitchen tier increases

- [ ] **Step 1: Create KitchenExpander.js**

```javascript
// webroot/KitchenExpander.js
// Plays the kitchen expansion animation when the player buys a new tier.
// Pure visual effect — no game state.

const KitchenExpander = (() => {
  function playExpansion(tier) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const W = scene.W, H = scene.H;

    // White flash overlay
    const flash = scene.add.graphics().setDepth(50);
    flash.fillStyle(0xffffff, 0.8); flash.fillRect(0, 0, W, H);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });

    // Sparkle particles around edges
    for (let i = 0; i < 20; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H * 0.6;
      const star = scene.add.text(px, py, ['⭐','✨','🌟'][i%3], {
        fontSize: Math.round(16 + Math.random() * 18) + 'px',
      }).setOrigin(0.5).setDepth(51).setAlpha(0);
      scene.tweens.add({
        targets: star, alpha: 1, y: py - 40 - Math.random()*40, duration: 500,
        delay: Math.random() * 400,
        onComplete: () => scene.tweens.add({ targets:star, alpha:0, duration:400, onComplete:()=>star.destroy() }),
      });
    }

    // Big text
    const msg = scene.add.text(W/2, H/2, '🏗 Kitchen Expanded!', {
      fontSize:'20px', fontStyle:'bold', color:'#f97316',
      stroke:'#ffffff', strokeThickness:5,
    }).setOrigin(0.5).setDepth(52).setAlpha(0);
    scene.tweens.add({ targets:msg, alpha:1, duration:300 });
    scene.tweens.add({ targets:msg, alpha:0, duration:400, delay:1200, onComplete:()=>msg.destroy() });
  }

  window.addEventListener('dk:kitchenExpanded', (ev) => playExpansion(ev.detail.tier));

  return { playExpansion };
})();

window.KITCHEN_EXPANDER = KitchenExpander;
```

- [ ] **Step 2: Commit (no upload needed — pure visual add)**

```bash
git add webroot/KitchenExpander.js
git commit -m "feat: KitchenExpander — flash + sparkle animation on kitchen tier unlock"
```

---

## Task 9: ParticleEffects.js — Coin arcs and upgrade slam

**Files:**
- Create: `webroot/ParticleEffects.js`

**Interfaces:**
- Consumes: `window.CHEF_SCENE`, events `dk:coinEarned`, Phaser tweens
- Produces: coin arc animation from customer to HUD, upgrade slam burst

- [ ] **Step 1: Create ParticleEffects.js**

```javascript
// webroot/ParticleEffects.js
// Visual effects: coin arcs from delivery point to HUD, upgrade slam burst.

const ParticleEffects = (() => {
  function coinArc(fromX, fromY) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    // Coin emoji flies from delivery position toward HUD coin counter (top-right)
    const coin = scene.add.text(fromX, fromY, '🪙', {
      fontSize: Math.round(TILE_W * 0.3) + 'px',
    }).setOrigin(0.5).setDepth(35);
    const targetX = scene.W - 60, targetY = 20;
    scene.tweens.add({
      targets: coin, x: targetX, y: targetY,
      duration: 550, ease: 'Power2',
      onComplete: () => coin.destroy(),
    });
  }

  function upgradeSlamBurst(cx, cy) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist  = TILE_W * 0.7;
      const star  = scene.add.text(cx, cy, '⭐', { fontSize:'12px' }).setOrigin(0.5).setDepth(35);
      scene.tweens.add({
        targets: star,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0, duration: 500,
        onComplete: () => star.destroy(),
      });
    }
  }

  window.addEventListener('dk:coinEarned', (ev) => coinArc(ev.detail.x, ev.detail.y));

  return { coinArc, upgradeSlamBurst };
})();

window.PARTICLE_FX = ParticleEffects;
```

- [ ] **Step 2: Upload everything together**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
```

- [ ] **Step 3: Commit**

```bash
git add webroot/ParticleEffects.js
git commit -m "feat: ParticleEffects — coin arc to HUD, upgrade slam burst"
```

---

## Task 10: Full integration test and bug fixes

**Files:**
- Modify: any file needed based on observed bugs

- [ ] **Step 1: Play through a complete shift**

Open playtest. Do the following:
1. Walk to Grill station (d-pad or tap) → press ✋ → see "Cooking…"
2. Wait ~3s → READY badge → press ✋ → emoji appears above chef
3. Walk to Drinks → press ✋ → second emoji added to tray
4. Walk to customer with matching order → press ✋ → coins pop, customer leaves happy
5. Wait for shift to end → shop screen appears
6. Buy one upgrade → tap "Next Shift"
7. Verify second shift starts with timer reset

- [ ] **Step 2: Fix any bugs found during integration test**

Common issues to check:
- `window.DK_COUNTER_Y` not set before CustomerManager spawns → fix: add null check in `_drawCustomer`
- `isoToScreen` called before scene creates → fix: check `window.CHEF_SCENE?.originX` is non-zero
- Chef can walk behind counter → fix: clamp `ty` in `walkPlayerTo` to `counterScreenY + TILE_H * 0.5`

- [ ] **Step 3: Final upload and commit**

```bash
npx devvit upload 2>&1 | grep -E "done|Error|version|✨"
git add -p  # stage only intentional fixes
git commit -m "fix: integration test fixes — counter clamping, iso origin guards"
```

---

## Task 11: Devvit server — wire upgrade purchases

**Files:**
- Modify: `src/handlers/upgrades.ts`
- Modify: `src/main.tsx` (add BUY_STATION_UPGRADE message handler)

- [ ] **Step 1: Verify BUY_UPGRADE already handled in main.tsx**

```bash
grep -n "BUY_UPGRADE\|buyUpgrade" /home/rogerkorantenng/dev/Hackathons/drift-kitchen/src/main.tsx | head -10
```

Expected: lines showing `case 'BUY_UPGRADE'` already wired.

- [ ] **Step 2: If missing, add case to main.tsx switch**

Find the switch block and add if not present:

```typescript
case 'BUY_UPGRADE': {
  const reqId = msg.data.__reqId;
  const state = await getState(context);
  const result = await buyUpgrade(context, state, msg.data.stationId);
  postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
  break;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (clean).

- [ ] **Step 4: Commit if changes made**

```bash
git add src/main.tsx
git commit -m "fix: ensure BUY_UPGRADE case wired in server message router"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All spec sections have corresponding tasks:
  - ✅ Isometric kitchen + expansion → Tasks 1, 2, 8
  - ✅ Stations + upgrades → Task 3
  - ✅ Customers + orders + patience → Task 4
  - ✅ Chef tray + interact + delivery → Task 5
  - ✅ HUD → Task 6
  - ✅ Between-shift shop → Task 7
  - ✅ Particle effects → Task 9
  - ✅ Integration → Task 10
  - ✅ Server side already built → Task 11 verifies

- [x] **No placeholders:** All steps have actual code, not "implement X"

- [x] **Type consistency:** `isoToScreen(col, row, originX, originY)` used consistently. `window.CHEF_SCENE`, `window.STATION_MGR`, `window.CUSTOMER_MGR`, `window.CHEF_CTRL` are the stable global references.

- [x] **Devvit iframe constraints respected:** `Date.now()`/`window.setTimeout` throughout, 2-frame launch in main.js, no Phaser time API
