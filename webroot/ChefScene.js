// webroot/ChefScene.js
// Phaser 3 scene: draws the isometric kitchen world.
// Handles: floor, walls, service counter, lanterns, chef sprite, d-pad + interact controls.
// Does NOT handle stations, customers, or game logic — those are in their own managers.
//
// Devvit iframe rules (proven by Trapline):
//   1. 2-frame deferred launch before Phaser measures container
//   2. Date.now() / window.setTimeout for all timing (Phaser time distorted in iframes)
//   3. Manual listener cleanup in shutdown()

class ChefScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ChefScene' });
    this.kitchenTier  = 1;
    this.chefPos      = { x: 0, y: 0 };
    this.chefDir      = 'down';
    this.chefGfx      = null;
    this.heldText     = null;
    this._moveTween   = null;
    this.originX      = 0;
    this.originY      = 0;
    this.counterScreenY = 0;
    window.CHEF_SCENE = this;
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this._setOrigin();
    this._buildFloor();
    this._buildWalls();
    this._buildCounter();
    this._buildLanterns();
    this._buildChef();
    this._buildDpad();
    this.input.on('pointerdown', this._onTap, this);
    window.dispatchEvent(new CustomEvent('dk:sceneReady'));
  }

  _setOrigin() {
    // Center the isometric grid horizontally, push down a bit from top
    const tier = KITCHEN_TIERS[this.kitchenTier];
    // The iso grid origin is the top-center of the diamond grid
    this.originX = this.W / 2;
    this.originY = this.H * 0.18;
  }

  // ── Isometric floor ─────────────────────────────────────────────────────────
  _buildFloor() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-10);
    for (let row = 0; row < tier.rows; row++) {
      for (let col = 0; col < tier.cols; col++) {
        const { x, y } = isoToScreen(col, row, this.originX, this.originY);
        const fill = (col + row) % 2 === 0 ? C.floorA : C.floorB;
        g.fillStyle(fill, 1);
        g.fillPoints([
          { x: x + TILE_W/2, y },
          { x: x + TILE_W,   y: y + TILE_H/2 },
          { x: x + TILE_W/2, y: y + TILE_H },
          { x,               y: y + TILE_H/2 },
        ], true);
        g.lineStyle(1, C.floorLine, 0.4);
        g.strokePoints([
          { x: x + TILE_W/2, y },
          { x: x + TILE_W,   y: y + TILE_H/2 },
          { x: x + TILE_W/2, y: y + TILE_H },
          { x,               y: y + TILE_H/2 },
        ], true);
      }
    }
  }

  // ── Back wall ────────────────────────────────────────────────────────────────
  _buildWalls() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-8);
    const wallH = TILE_H * 2.2;

    // Top wall row (behind row 0)
    g.fillStyle(C.wall, 1);
    for (let col = 0; col < tier.cols; col++) {
      const { x, y } = isoToScreen(col, -1, this.originX, this.originY);
      g.fillPoints([
        { x: x + TILE_W/2, y: y - wallH },
        { x: x + TILE_W,   y: y + TILE_H/2 - wallH },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x,               y: y + TILE_H/2 },
        { x,               y: y + TILE_H/2 - wallH },
      ], true);
    }
    // Wall top trim
    g.lineStyle(2, C.wallLight, 0.6);
    const leftPt  = isoToScreen(0, -1, this.originX, this.originY);
    const rightPt = isoToScreen(tier.cols, -1, this.originX, this.originY);
    g.lineBetween(leftPt.x, leftPt.y - wallH, rightPt.x, rightPt.y - wallH);
  }

  // ── Service counter ──────────────────────────────────────────────────────────
  _buildCounter() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-5);
    const counterDepth = TILE_H * 0.9;

    for (let col = 0; col < tier.cols; col++) {
      const { x, y } = isoToScreen(col, 0, this.originX, this.originY);
      // Top face
      g.fillStyle(C.counterTop, 1);
      g.fillPoints([
        { x: x + TILE_W/2, y },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x,               y: y + TILE_H/2 },
      ], true);
      // Front-left face
      g.fillStyle(C.counter, 1);
      g.fillPoints([
        { x,               y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x: x + TILE_W/2, y: y + TILE_H + counterDepth },
        { x,               y: y + TILE_H/2 + counterDepth },
      ], true);
      // Front-right face
      g.fillStyle(C.counterShadow, 1);
      g.fillPoints([
        { x: x + TILE_W/2, y: y + TILE_H },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W,   y: y + TILE_H/2 + counterDepth },
        { x: x + TILE_W/2, y: y + TILE_H + counterDepth },
      ], true);
      // Top edge highlight
      g.lineStyle(2, C.counterTop, 0.7);
      g.strokePoints([
        { x: x + TILE_W/2, y },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x,               y: y + TILE_H/2 },
      ], true);
    }

    // Store counter bottom Y for customer spawning boundary
    const midCol = Math.floor(tier.cols / 2);
    const { y: cy } = isoToScreen(midCol, 0, this.originX, this.originY);
    this.counterScreenY = cy + TILE_H + counterDepth;
    window.DK_COUNTER_Y = this.counterScreenY;
  }

  // ── Lanterns ─────────────────────────────────────────────────────────────────
  _buildLanterns() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-3);
    [0.2, 0.5, 0.8].forEach(pct => {
      const col = Math.round(pct * (tier.cols - 1));
      const { x, y } = isoToScreen(col, -1, this.originX, this.originY);
      const cx = x + TILE_W / 2, cy = y - TILE_H * 0.8;
      // Glow
      g.fillStyle(C.gold, 0.08); g.fillCircle(cx, cy + TILE_H * 0.3, TILE_W * 0.65);
      // Cord
      g.lineStyle(2, 0x8b5e3c, 0.8); g.lineBetween(cx, cy - TILE_H * 0.4, cx, cy);
      // Body
      g.fillStyle(C.orange, 1);
      g.fillRoundedRect(cx - TILE_W * 0.13, cy, TILE_W * 0.26, TILE_H * 0.58, 5);
      // Light
      g.fillStyle(C.gold, 0.9); g.fillCircle(cx, cy + TILE_H * 0.28, TILE_W * 0.08);
      // Border
      g.lineStyle(1.5, 0xd4622a, 0.6);
      g.strokeRoundedRect(cx - TILE_W * 0.13, cy, TILE_W * 0.26, TILE_H * 0.58, 5);
    });
  }

  // ── Chef sprite ───────────────────────────────────────────────────────────────
  _buildChef() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const startCol = Math.floor(tier.cols / 2);
    const startRow = Math.floor(tier.rows / 2) + 1;
    const { x, y } = isoToScreen(startCol, startRow, this.originX, this.originY);
    this.chefPos = { x: x + TILE_W / 2, y: y + TILE_H / 2 };

    this.chefGfx = this.add.graphics().setDepth(20);
    this.heldText = this.add.text(this.chefPos.x, this.chefPos.y - TILE_H, '', {
      fontSize: Math.round(TILE_W * 0.38) + 'px',
    }).setOrigin(0.5).setDepth(21).setVisible(false);

    this._drawChef(this.chefPos.x, this.chefPos.y, 'down');
    window.DK_CHEF_POS = { ...this.chefPos };
  }

  _drawChef(x, y, dir) {
    const g = this.chefGfx;
    g.clear();

    // Ground shadow
    g.fillStyle(C.black, 0.14);
    g.fillEllipse(x + 3, y + TILE_H * 0.42, TILE_W * 0.48, TILE_H * 0.14);

    // Legs
    g.fillStyle(0x1e3a5f, 1);
    if (dir === 'left' || dir === 'right') {
      g.fillRoundedRect(x - TILE_W*0.11, y + TILE_H*0.2, TILE_W*0.22, TILE_H*0.26, 3);
    } else {
      g.fillRoundedRect(x - TILE_W*0.17, y + TILE_H*0.2, TILE_W*0.13, TILE_H*0.26, 3);
      g.fillRoundedRect(x + TILE_W*0.04, y + TILE_H*0.2, TILE_W*0.13, TILE_H*0.26, 3);
    }

    // Body — white chef coat
    g.fillStyle(C.white, 1);
    g.fillRoundedRect(x - TILE_W*0.21, y - TILE_H*0.06, TILE_W*0.42, TILE_H*0.3, 5);
    // Buttons
    g.fillStyle(C.orange, 1);
    g.fillCircle(x - TILE_W*0.07, y + TILE_H*0.04, TILE_W*0.033);
    g.fillCircle(x + TILE_W*0.07, y + TILE_H*0.04, TILE_W*0.033);
    g.fillCircle(x - TILE_W*0.07, y + TILE_H*0.13, TILE_W*0.028);
    g.fillCircle(x + TILE_W*0.07, y + TILE_H*0.13, TILE_W*0.028);

    // Arms
    g.fillStyle(C.white, 1);
    if (dir === 'left') {
      g.fillRoundedRect(x - TILE_W*0.37, y - TILE_H*0.01, TILE_W*0.18, TILE_H*0.1, 3);
    } else if (dir === 'right') {
      g.fillRoundedRect(x + TILE_W*0.19, y - TILE_H*0.01, TILE_W*0.18, TILE_H*0.1, 3);
    } else {
      g.fillRoundedRect(x - TILE_W*0.37, y + TILE_H*0.05, TILE_W*0.16, TILE_H*0.09, 3);
      g.fillRoundedRect(x + TILE_W*0.21, y + TILE_H*0.05, TILE_W*0.16, TILE_H*0.09, 3);
    }

    // Neck
    g.fillStyle(0xfde8c8, 1);
    g.fillRect(x - TILE_W*0.06, y - TILE_H*0.17, TILE_W*0.12, TILE_H*0.12);

    // Head
    g.fillStyle(0xfde8c8, 1);
    g.fillRoundedRect(x - TILE_W*0.21, y - TILE_H*0.45, TILE_W*0.42, TILE_H*0.31, 7);

    // Chef hat — brim
    g.fillStyle(0xfafafa, 1);
    g.fillRoundedRect(x - TILE_W*0.25, y - TILE_H*0.49, TILE_W*0.5, TILE_H*0.1, 3);
    // Hat top
    g.fillRoundedRect(x - TILE_W*0.17, y - TILE_H*0.76, TILE_W*0.34, TILE_H*0.31, 4);
    // Hat orange band
    g.fillStyle(C.orange, 1);
    g.fillRect(x - TILE_W*0.17, y - TILE_H*0.5, TILE_W*0.34, TILE_H*0.06);

    // Face
    g.fillStyle(0x2d1a00, 1);
    if (dir === 'up') {
      // Back of head — no face
    } else if (dir === 'left') {
      g.fillCircle(x - TILE_W*0.1, y - TILE_H*0.3, TILE_W*0.04);
      g.fillRoundedRect(x - TILE_W*0.14, y - TILE_H*0.2, TILE_W*0.12, TILE_H*0.04, 2);
    } else if (dir === 'right') {
      g.fillCircle(x + TILE_W*0.1, y - TILE_H*0.3, TILE_W*0.04);
      g.fillRoundedRect(x + TILE_W*0.02, y - TILE_H*0.2, TILE_W*0.12, TILE_H*0.04, 2);
    } else {
      g.fillCircle(x - TILE_W*0.08, y - TILE_H*0.31, TILE_W*0.043);
      g.fillCircle(x + TILE_W*0.08, y - TILE_H*0.31, TILE_W*0.043);
      g.lineStyle(TILE_W*0.024, 0x2d1a00, 1);
      g.beginPath(); g.arc(x, y - TILE_H*0.21, TILE_W*0.09, 0.3, Math.PI - 0.3, false); g.strokePath();
    }

    // Apron stripe
    g.fillStyle(C.orange, 0.55);
    g.fillTriangle(x - TILE_W*0.08, y - TILE_H*0.16, x + TILE_W*0.08, y - TILE_H*0.16, x, y - TILE_H*0.03);

    if (this.heldText && this.heldText.visible) {
      this.heldText.setPosition(x, y - TILE_H * 0.88);
    }
    window.DK_CHEF_POS = { x, y };
  }

  // ── D-pad controls ────────────────────────────────────────────────────────────
  _buildDpad() {
    const W = this.W, H = this.H;
    const padX = W - TILE_W * 1.55;
    const padY = H - TILE_H * 3.0;
    const R    = TILE_W * 0.35;

    // Pad disc background
    const bg = this.add.graphics().setDepth(40);
    bg.fillStyle(C.black, 0.2); bg.fillCircle(padX, padY, TILE_W * 1.05);

    const dirs = [
      { label:'▲', dx: 0, dy:-1, bx: padX,              by: padY - TILE_H * 0.88 },
      { label:'▼', dx: 0, dy: 1, bx: padX,              by: padY + TILE_H * 0.88 },
      { label:'◀', dx:-1, dy: 0, bx: padX - TILE_W*0.88, by: padY               },
      { label:'▶', dx: 1, dy: 0, bx: padX + TILE_W*0.88, by: padY               },
    ];

    dirs.forEach(d => {
      const btn = this.add.graphics().setDepth(41);
      const draw = (active) => {
        btn.clear();
        btn.fillStyle(active ? C.orange : C.white, active ? 0.7 : 0.18);
        btn.fillCircle(d.bx, d.by, R);
      };
      draw(false);
      btn.setInteractive(new Phaser.Geom.Circle(d.bx, d.by, R), Phaser.Geom.Circle.Contains);
      this.add.text(d.bx, d.by, d.label, {
        fontSize: Math.round(TILE_W * 0.26) + 'px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(42);

      let held = false, iv = null;
      const step = () => {
        const newDir = d.dx < 0 ? 'left' : d.dx > 0 ? 'right' : d.dy < 0 ? 'up' : 'down';
        this.chefDir = newDir;
        const stepPx = TILE_W * 0.52;
        const minY   = (this.counterScreenY || 0) + TILE_H * 0.6;
        const nx = Math.max(TILE_W * 0.3, Math.min(this.W - TILE_W * 0.3, this.chefPos.x + d.dx * stepPx));
        const ny = Math.max(minY, Math.min(this.H - TILE_H * 0.4, this.chefPos.y + d.dy * stepPx));
        this.walkPlayerTo(nx, ny);
      };
      btn.on('pointerdown', () => { draw(true); held = true; step(); iv = setInterval(() => { if (held) step(); }, 155); });
      const rel = () => { draw(false); held = false; clearInterval(iv); };
      btn.on('pointerup', rel); btn.on('pointerout', rel);
    });

    // Interact button (bottom-left)
    const actX = TILE_W * 1.35, actY = H - TILE_H * 2.4;
    const actBtn = this.add.graphics().setDepth(41);
    actBtn.fillStyle(C.orange, 0.85); actBtn.fillCircle(actX, actY, R * 1.18);
    actBtn.setInteractive(new Phaser.Geom.Circle(actX, actY, R * 1.18), Phaser.Geom.Circle.Contains);
    this.add.text(actX, actY, '✋', { fontSize: Math.round(TILE_W * 0.35) + 'px' }).setOrigin(0.5).setDepth(42);
    this.add.text(actX, actY + R * 1.35, 'INTERACT', { fontSize: '7px', color: 'rgba(255,255,255,0.65)' }).setOrigin(0.5).setDepth(42);
    actBtn.on('pointerdown', () => {
      this.tweens.add({ targets: actBtn, scaleX: 0.87, scaleY: 0.87, duration: 70, yoyo: true });
      window.dispatchEvent(new CustomEvent('dk:interact'));
    });
  }

  // ── Tap to walk ──────────────────────────────────────────────────────────────
  _onTap(ptr) {
    const minY = (this.counterScreenY || 0) + TILE_H * 0.6;
    if (ptr.y > minY) {
      this.walkPlayerTo(ptr.x, ptr.y);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  walkPlayerTo(tx, ty, onArrive) {
    const dx = tx - this.chefPos.x, dy = ty - this.chefPos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 5) { if (onArrive) onArrive(); return; }

    if (Math.abs(dx) > Math.abs(dy)) this.chefDir = dx > 0 ? 'right' : 'left';
    else this.chefDir = dy > 0 ? 'down' : 'up';

    if (this._moveTween) this._moveTween.stop();
    const proxy = { x: this.chefPos.x, y: this.chefPos.y };
    this._moveTween = this.tweens.add({
      targets: proxy, x: tx, y: ty,
      duration: (dist / CHEF_SPEED_PX_S) * 1000, ease: 'Linear',
      onUpdate: () => {
        this.chefPos.x = proxy.x; this.chefPos.y = proxy.y;
        this._drawChef(proxy.x, proxy.y, this.chefDir);
      },
      onComplete: () => {
        this.chefPos = { x: tx, y: ty };
        window.DK_CHEF_POS = { ...this.chefPos };
        if (onArrive) onArrive();
      },
    });
  }

  getPlayerPos() { return { ...this.chefPos }; }

  showFloatText(x, y, text, color = '#ffffff', size = 13) {
    const t = this.add.text(x, y, text, {
      fontSize: size + 'px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 48, alpha: 0, duration: 900, ease: 'Power2', onComplete: () => t.destroy() });
  }

  setHeldItems(emojis) {
    if (!this.heldText) return;
    if (!emojis || emojis.length === 0) {
      this.heldText.setVisible(false);
    } else {
      this.heldText.setText(emojis.join('')).setVisible(true);
      this.heldText.setPosition(this.chefPos.x, this.chefPos.y - TILE_H * 0.88);
    }
  }

  rebuildKitchen(tier) {
    this.kitchenTier = tier;
    this.children.list.filter(o => o.depth < 5).forEach(o => o.destroy());
    this._setOrigin();
    this._buildFloor();
    this._buildWalls();
    this._buildCounter();
    this._buildLanterns();
    window.dispatchEvent(new CustomEvent('dk:kitchenRebuilt', { detail: { tier } }));
  }

  update() { /* event-driven — nothing needed */ }

  shutdown() {
    this.input.off('pointerdown', this._onTap, this);
  }
}
