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
    this._tray = [];
    window.CHEF_SCENE = this;
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.cameras.main.setBackgroundColor('#f4d9b0');
    this._computeLayout();
    this._drawBackground();
    this._buildTray();
    this.scale.on('resize', this._onResize, this);
    window.dispatchEvent(new CustomEvent('dk:sceneReady'));
  }

  _onResize(g) {
    this.W = g.width; this.H = g.height;
    this._computeLayout();
    this._drawBackground();
    this._layoutTray();
    window.dispatchEvent(new CustomEvent('dk:relayout'));
  }

  // ─── Layout metrics ──────────────────────────────────────────────────────────
  _computeLayout() {
    const W = this.W, H = this.H;
    this.diningH   = Math.round(H * 0.44);   // bottom of dining zone (the service ledge)
    this.ledgeH    = Math.round(H * 0.05);
    this.kitchenTop= this.diningH + this.ledgeH;
    this.trayCY    = H - Math.round(H * 0.07);
    // station band sits between the kitchen counter top and the tray
    this.stationBand = (this.trayCY - this.kitchenTop);
    this.stationCY = this.kitchenTop + this.stationBand * 0.40;
  }

  // Station slot rect: i of n across the kitchen counter.
  stationSlot(i, n) {
    const margin = this.W * 0.04;
    const usable = this.W - margin * 2;
    const cell = usable / n;
    const w = Math.min(cell * 0.88, this.W * 0.42, this.stationBand * 0.62);
    const h = w * 0.9;
    return { cx: margin + cell * (i + 0.5), cy: this.stationCY, w, h };
  }

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

  trayCenter() { return { cx: this.W / 2, cy: this.trayCY, w: this.W * 0.62 }; }
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
    const cy0 = this.stationCY + this.stationBand * 0.18;
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

  // ─── Serving tray (the plate in your hands) ──────────────────────────────────
  _buildTray() {
    this.trayGfx = this.add.graphics().setDepth(60);
    this.trayText = this.add.text(0, 0, '', { fontSize: Math.round(this.W * 0.05) + 'px' })
      .setOrigin(0.5).setDepth(61);
    this.trayHint = this.add.text(0, 0, '', {
      fontSize: '11px', fontStyle: 'bold', color: '#8b5e3c',
    }).setOrigin(0.5).setDepth(61);
    this._layoutTray();
    this.setHeldItems(this._tray);
  }
  _layoutTray() {
    const t = this.trayCenter();
    this._trayBox = t;
    this.setHeldItems(this._tray);
  }

  setHeldItems(emojis) {
    this._tray = emojis || [];
    const t = this._trayBox || this.trayCenter();
    const g = this.trayGfx; if (!g) return;
    g.clear();
    const w = t.w, h = this.H * 0.075, x = t.cx - w/2, y = t.cy - h/2;
    // plate / tray
    g.fillStyle(0x000000, 0.12); g.fillRoundedRect(x + 3, y + 4, w, h, 16);
    g.fillStyle(0xe9eef3, 1); g.fillRoundedRect(x, y, w, h, 16);
    g.fillStyle(0xffffff, 0.7); g.fillRoundedRect(x + 6, y + 4, w - 12, h * 0.36, 12);
    g.lineStyle(2, 0xc6cdd4, 1); g.strokeRoundedRect(x, y, w, h, 16);
    if (!this._tray.length) {
      this.trayText.setVisible(false);
      this.trayHint.setText('Tap a station to cook 🍳').setPosition(t.cx, t.cy).setVisible(true);
    } else {
      this.trayHint.setVisible(false);
      this.trayText.setText(this._tray.join('  ')).setPosition(t.cx, t.cy).setVisible(true);
    }
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
