// webroot/ChefScene.js — Drift Kitchen, FRONT-FACING tap-to-cook scene (Cooking-Fever style).
//
// Layout (screen space, no camera tricks):
//   ┌──────────────────────────────┐
//   │   DINING  — customers + order │  top ~44%
//   │   tickets behind the counter  │
//   ├──────────────────────────────┤  service ledge
//   │   KITCHEN — tappable cooking  │  bottom ~56%
//   │   stations + serving tray     │
//   └──────────────────────────────┘
//
// No movement / no d-pad: you tap a station to cook, tap ready food to plate it,
// tap a customer to serve. StationManager / CustomerManager own their own sprites
// and tap-zones positioned via the slot helpers below.

class ChefScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ChefScene' });
    this.kitchenTier = 1;
    this._bg = [];
    this._hand = null;
    window.CHEF_SCENE = this;
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.cameras.main.setBackgroundColor('#f4d9b0');
    this._computeLayout();
    this._drawBackground();
    this._buildHand();
    this.scale.on('resize', this._onResize, this);
    window.dispatchEvent(new CustomEvent('dk:sceneReady'));
  }

  _onResize(g) {
    this.W = g.width; this.H = g.height;
    this._computeLayout();
    this._drawBackground();
    this._layoutHand();
    window.dispatchEvent(new CustomEvent('dk:relayout'));
  }

  // ─── Layout metrics ──────────────────────────────────────────────────────────
  _computeLayout() {
    const W = this.W, H = this.H;
    this.diningH    = Math.round(H * 0.36);   // bottom of dining zone (the service ledge)
    this.ledgeH     = Math.round(H * 0.045);
    this.kitchenTop = this.diningH + this.ledgeH;
    this.handCY     = H - Math.round(H * 0.072);
    this.gridTop    = this.kitchenTop + Math.round(H * 0.075);
    this.gridBottom = this.handCY - Math.round(H * 0.05);
    this.stationCY  = (this.gridTop + this.gridBottom) / 2;     // (bg compat)
    this.stationBand = this.gridBottom - this.gridTop;
    this._gridCache = null;
  }

  // Grid of n station slots laid out within the kitchen area (rows centred).
  gridSlots(n) {
    if (this._gridCache && this._gridCache.n === n) return this._gridCache.slots;
    const W = this.W, marginX = W * 0.03;
    const cols = W < 560 ? (n <= 6 ? 3 : 4) : Math.min(n, 6);
    const rows = Math.ceil(n / cols);
    const cellW = (W - marginX * 2) / cols;
    const cellH = (this.gridBottom - this.gridTop) / rows;
    const w = Math.min(cellW * 0.84, cellH * 0.8, W * 0.26);
    const h = w * 0.92;
    const slots = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const rowCount = (r === rows - 1) ? (n - cols * (rows - 1)) : cols;
      const startX = (W - rowCount * cellW) / 2;
      slots.push({ cx: startX + cellW * (c + 0.5), cy: this.gridTop + cellH * (r + 0.5), w, h });
    }
    this._gridCache = { n, slots };
    return slots;
  }
  stationSlot(i, n) { return this.gridSlots(n)[i]; }

  // Customer slot center (head) + ticket anchor.
  customerSlot(i, n) {
    const margin = this.W * 0.05;
    const usable = this.W - margin * 2;
    const cell = usable / n;
    const cx = margin + cell * (i + 0.5);
    const headCY = this.diningH - Math.round(this.H * 0.055);
    const w = Math.min(cell * 0.82, this.W * 0.2);
    return { cx, headCY, ticketCY: this.diningH - this.H * 0.205, w };
  }

  handCenter() { return { cx: this.W / 2, cy: this.handCY, w: this.W * 0.5 }; }
  trayCenter() { return this.handCenter(); } // alias (fly-anim source)
  coinScreenPos() { return { x: this.W - this.W * 0.12, y: this.H * 0.045 }; }

  // ─── Background ──────────────────────────────────────────────────────────────
  _drawBackground() {
    this._bg.forEach(o => { try { o.destroy(); } catch (_) {} });
    this._bg = [];
    const W = this.W, H = this.H, add = (o) => { this._bg.push(o); return o; };
    const g = add(this.add.graphics().setDepth(-100));

    // Dining wall — warm gradient
    g.fillGradientStyle(0xf6e2c0, 0xf6e2c0, 0xe9c79a, 0xe9c79a, 1);
    g.fillRect(0, 0, W, this.diningH);

    // soft window panels in the back
    const winY = this.diningH * 0.22, winH = this.diningH * 0.42;
    for (let i = 0; i < 4; i++) {
      const x = W * (0.06 + i * 0.24), w = W * 0.18;
      g.fillStyle(0xbfe0e8, 0.45); g.fillRoundedRect(x, winY, w, winH, 8);
      g.fillStyle(0xffffff, 0.12); g.fillRoundedRect(x, winY, w, winH * 0.4, 8);
      g.lineStyle(3, 0x8a6a45, 0.5); g.strokeRoundedRect(x, winY, w, winH, 8);
      g.lineBetween(x + w/2, winY, x + w/2, winY + winH);
    }
    // bokeh warmth
    [[0.2,0.12],[0.55,0.2],[0.8,0.1],[0.4,0.3]].forEach(([px,py]) => {
      g.fillStyle(0xfff0c8, 0.16); g.fillCircle(W*px, this.diningH*py, W*0.05);
    });

    // hanging lamps over the counter
    const lampN = Math.max(3, Math.round(W / 160));
    for (let i = 0; i < lampN; i++) {
      const lx = W * (i + 0.5) / lampN, ly = this.diningH * 0.12;
      g.lineStyle(2, 0x5c3a1e, 0.8); g.lineBetween(lx, 0, lx, ly);
      g.fillStyle(0xffce6b, 0.2); g.fillCircle(lx, ly + 14, 34);
      g.fillStyle(0x1f2937, 1); g.fillEllipse(lx, ly, 30, 14);
      g.fillStyle(0xffd98a, 1); g.fillEllipse(lx, ly + 6, 22, 10);
    }

    // potted plants in the dining corners (life, away from customer slots)
    [[W*0.045, 0x2e7d32], [W*0.955, 0x388e3c]].forEach(([px, leaf]) => {
      const py = this.diningH - 6;
      g.fillStyle(0xa9743f, 0.95); g.fillRoundedRect(px - 12, py - 20, 24, 22, { tl:2, tr:2, bl:8, br:8 });
      g.fillStyle(0x8a5a30, 0.95); g.fillRect(px - 12, py - 20, 24, 5);
      g.fillStyle(leaf, 0.9);
      [[-9,-24],[9,-24],[0,-34],[-5,-18],[6,-18]].forEach(([ox, oy]) => g.fillEllipse(px + ox, py + oy, 16, 24));
    });

    // ── Service ledge (counter customers stand behind) ──
    const ly0 = this.diningH;
    g.fillStyle(0x7a4a28, 1); g.fillRect(0, ly0, W, this.ledgeH);
    g.fillStyle(0xb07a45, 1); g.fillRect(0, ly0, W, this.ledgeH * 0.45);
    g.fillStyle(0xe8c389, 1); g.fillRect(0, ly0, W, this.ledgeH * 0.14);
    g.fillStyle(0x000000, 0.18); g.fillRect(0, ly0 + this.ledgeH - 3, W, 3);

    // ── Kitchen ──
    const ky = this.kitchenTop;
    g.fillGradientStyle(0xf3e7d4, 0xf3e7d4, 0xe7d3b4, 0xe7d3b4, 1);
    g.fillRect(0, ky, W, H - ky);
    // tiled backsplash strip
    const tileY = ky + (H - ky) * 0.04, th = (H - ky) * 0.1, tw = W * 0.07;
    for (let x = 0; x < W; x += tw) {
      g.fillStyle(0xfff7ea, 0.5); g.fillRoundedRect(x + 2, tileY, tw - 4, th, 4);
    }
    // stainless counter surface the stations sit on
    const cy0 = this.gridTop - this.H * 0.03;
    g.fillStyle(0xcfd6dd, 1); g.fillRect(0, cy0, W, H - cy0);
    g.fillStyle(0xe6ebf0, 1); g.fillRect(0, cy0, W, 6);
    g.fillStyle(0xb9c2cc, 1); g.fillRect(0, cy0 + 6, W, (H - cy0) * 0.12);
    g.fillStyle(0x000000, 0.05);
    for (let x = 0; x < W; x += W * 0.16) g.fillRect(x, cy0 + 10, 1, H - cy0);

    // front counter lip below the tray (wood)
    const lipY = H - this.H * 0.03;
    g.fillStyle(0x8a5a30, 1); g.fillRect(0, lipY, W, H - lipY);
    g.fillStyle(0xc89456, 1); g.fillRect(0, lipY, W, 4);
  }

  // ─── Held item ("hand") + drag ghost ─────────────────────────────────────────
  _buildHand() {
    this.handGfx = this.add.graphics().setDepth(60);
    this.handText = this.add.text(0, 0, '', { fontSize: Math.round(this.W * 0.07) + 'px' }).setOrigin(0.5).setDepth(61);
    this.handHint = this.add.text(0, 0, '', { fontSize: '11px', fontStyle: 'bold', color: '#8b5e3c' }).setOrigin(0.5).setDepth(61);
    this.ghost = this.add.text(0, 0, '', { fontSize: Math.round(this.W * 0.08) + 'px' }).setOrigin(0.5).setDepth(5200).setVisible(false);
    this._layoutHand();
    this.setHand(this._hand || null);
  }
  _layoutHand() { this._handBox = this.handCenter(); this.setHand(this._hand || null); }

  setHand(itemEmoji) {
    this._hand = itemEmoji || null;
    const t = this._handBox || this.handCenter();
    const g = this.handGfx; if (!g) return;
    g.clear();
    const w = t.w, h = this.H * 0.085, x = t.cx - w/2, y = t.cy - h/2;
    g.fillStyle(0x000000, 0.12); g.fillRoundedRect(x + 3, y + 4, w, h, 18);
    g.fillStyle(this._hand ? 0xfff3d6 : 0xeef1f4, 1); g.fillRoundedRect(x, y, w, h, 18);
    g.fillStyle(0xffffff, 0.7); g.fillRoundedRect(x + 6, y + 4, w - 12, h * 0.34, 14);
    g.lineStyle(2.5, this._hand ? 0xf0c27a : 0xc6cdd4, 1); g.strokeRoundedRect(x, y, w, h, 18);
    if (this._hand) {
      this.handHint.setVisible(false);
      this.handText.setText(this._hand).setPosition(t.cx, t.cy).setVisible(true);
    } else {
      this.handText.setVisible(false);
      this.handHint.setText('Tap an ingredient to pick it up 🥩').setPosition(t.cx, t.cy).setVisible(true);
    }
  }
  showGhost(emoji) { if (this.ghost) this.ghost.setText(emoji).setVisible(true); }
  moveGhost(x, y) { if (this.ghost) this.ghost.setPosition(x, y); }
  hideGhost() { if (this.ghost) this.ghost.setVisible(false); }

  // ─── Flying plated dish (the "serve" animation) ──────────────────────────────
  flyDish(fromX, fromY, toX, toY, dishId, cb) {
    const plate = this.add.graphics().setDepth(3500).setPosition(fromX, fromY);
    plate.fillStyle(0x000000, 0.15); plate.fillEllipse(0, 5, 42, 14);
    plate.fillStyle(0xffffff, 1); plate.fillEllipse(0, 0, 40, 15);
    plate.fillStyle(0xe6ebf0, 1); plate.fillEllipse(0, -1, 28, 10);
    let food;
    if (window.DishArt && DishArt.has(dishId)) {
      food = this.add.graphics().setDepth(3501).setPosition(fromX, fromY - 8);
      DishArt.draw(food, 0, 0, 14, dishId);
    } else {
      food = this.add.text(fromX, fromY - 8, (window.ITEMS && ITEMS[dishId]?.emoji) || dishId || '🍽️', { fontSize: '24px' }).setOrigin(0.5).setDepth(3501);
    }
    const midX = (fromX + toX) / 2, midY = Math.min(fromY, toY) - 84;
    const ctrl = { t: 0 };
    this.tweens.add({
      targets: ctrl, t: 1, duration: 460, ease: 'Sine.InOut',
      onUpdate: () => {
        const t = ctrl.t, it = 1 - t;
        const x = it*it*fromX + 2*it*t*midX + t*t*toX;
        const y = it*it*fromY + 2*it*t*midY + t*t*toY;
        plate.setPosition(x, y); food.setPosition(x, y - 8).setRotation(Math.sin(t * Math.PI) * 0.25);
      },
      onComplete: () => {
        this.tweens.add({ targets: [plate, food], scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 220,
          onComplete: () => { plate.destroy(); food.destroy(); if (cb) cb(); } });
      },
    });
  }

  // ─── Float text ──────────────────────────────────────────────────────────────
  showFloatText(x, y, text, color = '#ffffff', size = 14) {
    const t = this.add.text(x, y, text, {
      fontSize: size + 'px', fontStyle: 'bold', color,
      stroke: '#3a230f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(4000);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 950, ease: 'Power2',
      onComplete: () => t.destroy() });
  }

  rebuildKitchen(tier) {
    this.kitchenTier = tier;
    this._computeLayout();
    this._drawBackground();
    window.dispatchEvent(new CustomEvent('dk:kitchenRebuilt', { detail: { tier } }));
  }

  update() { /* tap-driven; no per-frame movement */ }

  shutdown() { this.scale.off('resize', this._onResize, this); }
}

window.ChefScene = ChefScene;
