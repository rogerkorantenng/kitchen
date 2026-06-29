// webroot/ChefScene.js — Drift Kitchen Active Cooking Game
// Phaser 3 isometric kitchen. Warm, bright, Cooking Fever style.
//
// DEVVIT IFRAME RULES (Trapline proven):
//   1. 2-frame defer before Phaser measures container
//   2. Date.now() / window.setTimeout for timing — Phaser time distorted in iframes
//   3. Manual cleanup in shutdown()
//
// D-PAD: Direct position update every 150ms — NO tweens for d-pad movement.
//        Tweens are only for tap-to-walk (smooth walk to a destination).

class ChefScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ChefScene' });
    this.kitchenTier    = 1;
    this.chefPos        = { x: 0, y: 0 };
    this.chefDir        = 'down';
    this.chefGfx        = null;
    this.heldText       = null;
    this._walkTween     = null;   // only for tap-to-walk
    this.originX        = 0;
    this.originY        = 0;
    this.counterScreenY = 0;
    this.floorMinY      = 0;      // chef can't go above this
    window.CHEF_SCENE   = this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this._computeLayout();
    this._buildBackground();
    this._buildFloor();
    this._buildWalls();
    this._buildCounter();
    this._buildLanterns();
    this._buildChef();
    this._buildDpad();
    this.input.on('pointerdown', this._onTap, this);
    window.dispatchEvent(new CustomEvent('dk:sceneReady'));
  }

  _computeLayout() {
    const tier   = KITCHEN_TIERS[this.kitchenTier];
    this.originX = this.W / 2;
    this.originY = this.H * 0.20;
  }

  // ─── Background ────────────────────────────────────────────────────────────
  _buildBackground() {
    // Warm kitchen gradient
    const bg = this.add.graphics().setDepth(-20);
    bg.fillGradientStyle(0xfff5e6, 0xfff5e6, 0xffe8cc, 0xffe8cc, 1);
    bg.fillRect(0, 0, this.W, this.H);
  }

  // ─── Isometric floor ───────────────────────────────────────────────────────
  _buildFloor() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g = this.add.graphics().setDepth(-10);

    for (let row = 0; row < tier.rows; row++) {
      for (let col = 0; col < tier.cols; col++) {
        const { x, y } = isoToScreen(col, row, this.originX, this.originY);
        const fill = (col + row) % 2 === 0 ? 0xfdf6e3 : 0xf0e4cc;

        // Diamond tile
        g.fillStyle(fill, 1);
        g.fillPoints([
          { x: x + TILE_W/2, y },
          { x: x + TILE_W,   y: y + TILE_H/2 },
          { x: x + TILE_W/2, y: y + TILE_H },
          { x,               y: y + TILE_H/2 },
        ], true);

        // Subtle grout
        g.lineStyle(1, 0xd4b896, 0.35);
        g.strokePoints([
          { x: x + TILE_W/2, y },
          { x: x + TILE_W,   y: y + TILE_H/2 },
          { x: x + TILE_W/2, y: y + TILE_H },
          { x,               y: y + TILE_H/2 },
        ], true);
      }
    }

    // Store where the floor starts (in screen Y) so chef can't walk into wall
    const { y: floorStartY } = isoToScreen(0, 1, this.originX, this.originY);
    this.floorMinY = floorStartY + TILE_H * 0.5;
  }

  // ─── Back wall ─────────────────────────────────────────────────────────────
  _buildWalls() {
    const tier  = KITCHEN_TIERS[this.kitchenTier];
    const g     = this.add.graphics().setDepth(-8);
    const wallH = TILE_H * 2.4;

    // Back wall blocks (behind row -1)
    for (let col = 0; col < tier.cols; col++) {
      const { x, y } = isoToScreen(col, -1, this.originX, this.originY);

      // Wall face (front-facing)
      g.fillStyle(0x5c3d2e, 1);
      g.fillPoints([
        { x,               y: y + TILE_H/2 - wallH },
        { x: x + TILE_W/2, y: y + TILE_H - wallH   },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x,               y: y + TILE_H/2 },
      ], true);

      g.fillStyle(0x4a3728, 1);
      g.fillPoints([
        { x: x + TILE_W/2, y: y + TILE_H - wallH   },
        { x: x + TILE_W,   y: y + TILE_H/2 - wallH },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
      ], true);

      // Wall top (lit)
      g.fillStyle(0x7a5040, 1);
      g.fillPoints([
        { x: x + TILE_W/2, y: y - wallH },
        { x: x + TILE_W,   y: y + TILE_H/2 - wallH },
        { x: x + TILE_W/2, y: y + TILE_H - wallH   },
        { x,               y: y + TILE_H/2 - wallH },
      ], true);
    }

    // Wainscoting / baseboard at wall bottom
    g.lineStyle(2, 0x8b6040, 0.7);
    const l = isoToScreen(0,           -1, this.originX, this.originY);
    const r = isoToScreen(tier.cols,   -1, this.originX, this.originY);
    g.lineBetween(l.x, l.y + TILE_H/2, r.x, r.y + TILE_H/2);
  }

  // ─── Service counter ───────────────────────────────────────────────────────
  _buildCounter() {
    const tier      = KITCHEN_TIERS[this.kitchenTier];
    const g         = this.add.graphics().setDepth(-5);
    const counterH  = TILE_H * 0.85;

    for (let col = 0; col < tier.cols; col++) {
      const { x, y } = isoToScreen(col, 0, this.originX, this.originY);

      // Counter top face (lighter wood)
      g.fillStyle(0xb07840, 1);
      g.fillPoints([
        { x: x + TILE_W/2, y },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x,               y: y + TILE_H/2 },
      ], true);

      // Counter front-left
      g.fillStyle(0x8b5e3c, 1);
      g.fillPoints([
        { x,               y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x: x + TILE_W/2, y: y + TILE_H + counterH },
        { x,               y: y + TILE_H/2 + counterH },
      ], true);

      // Counter front-right (darker)
      g.fillStyle(0x704a2e, 1);
      g.fillPoints([
        { x: x + TILE_W/2, y: y + TILE_H },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W,   y: y + TILE_H/2 + counterH },
        { x: x + TILE_W/2, y: y + TILE_H + counterH },
      ], true);

      // Top edge shine
      g.lineStyle(1.5, 0xd4956a, 0.8);
      g.strokePoints([
        { x: x + TILE_W/2, y },
        { x: x + TILE_W,   y: y + TILE_H/2 },
        { x: x + TILE_W/2, y: y + TILE_H },
        { x,               y: y + TILE_H/2 },
      ], true);
    }

    // Store counter Y boundary
    const midCol = Math.floor(tier.cols / 2);
    const { y } = isoToScreen(midCol, 0, this.originX, this.originY);
    this.counterScreenY = y + TILE_H + counterH;
    window.DK_COUNTER_Y = this.counterScreenY;
  }

  // ─── Decorative lanterns ───────────────────────────────────────────────────
  _buildLanterns() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const g    = this.add.graphics().setDepth(-3);

    [0.15, 0.5, 0.85].forEach(pct => {
      const col = Math.round(pct * (tier.cols - 1));
      const { x, y } = isoToScreen(col, -1, this.originX, this.originY);
      const cx = x + TILE_W / 2;
      const cy = y - TILE_H * 0.6;

      // Warm glow
      g.fillStyle(0xfbbf24, 0.1); g.fillCircle(cx, cy + TILE_H * 0.5, TILE_W * 0.8);
      // Cord
      g.lineStyle(2, 0x8b5e3c, 0.9); g.lineBetween(cx, cy - TILE_H * 0.5, cx, cy - TILE_H * 0.1);
      // Lantern cap
      g.fillStyle(0xd4622a, 1);
      g.fillRect(cx - TILE_W * 0.14, cy - TILE_H * 0.1, TILE_W * 0.28, TILE_H * 0.1);
      // Lantern body
      g.fillStyle(0xf97316, 1);
      g.fillRoundedRect(cx - TILE_W * 0.12, cy, TILE_W * 0.24, TILE_H * 0.52, 4);
      // Inner glow
      g.fillStyle(0xfbbf24, 0.85);
      g.fillCircle(cx, cy + TILE_H * 0.26, TILE_W * 0.07);
      // Border
      g.lineStyle(1.5, 0xb34a10, 0.8);
      g.strokeRoundedRect(cx - TILE_W * 0.12, cy, TILE_W * 0.24, TILE_H * 0.52, 4);
    });
  }

  // ─── Chef sprite ───────────────────────────────────────────────────────────
  _buildChef() {
    const tier = KITCHEN_TIERS[this.kitchenTier];
    const startCol = Math.floor(tier.cols / 2);
    const startRow = Math.floor(tier.rows * 0.6);
    const { x, y } = isoToScreen(startCol, startRow, this.originX, this.originY);
    this.chefPos = { x: x + TILE_W / 2, y: y + TILE_H / 2 };

    this.chefGfx = this.add.graphics().setDepth(20);
    this.heldText = this.add.text(this.chefPos.x, this.chefPos.y - TILE_H, '', {
      fontSize: Math.round(TILE_W * 0.42) + 'px',
    }).setOrigin(0.5).setDepth(21).setVisible(false);

    this._drawChef(this.chefPos.x, this.chefPos.y, 'down');
    window.DK_CHEF_POS = { ...this.chefPos };
  }

  _drawChef(x, y, dir) {
    const g = this.chefGfx;
    g.clear();

    // Ground shadow
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x + 3, y + TILE_H * 0.44, TILE_W * 0.5, TILE_H * 0.14);

    // === LEGS ===
    g.fillStyle(0x1e3a5f, 1);
    if (dir === 'left' || dir === 'right') {
      g.fillRoundedRect(x - TILE_W*0.12, y + TILE_H*0.2, TILE_W*0.24, TILE_H*0.28, 4);
    } else {
      g.fillRoundedRect(x - TILE_W*0.18, y + TILE_H*0.2, TILE_W*0.14, TILE_H*0.28, 4);
      g.fillRoundedRect(x + TILE_W*0.04, y + TILE_H*0.2, TILE_W*0.14, TILE_H*0.28, 4);
    }
    // Shoes
    g.fillStyle(0x0f1f38, 1);
    if (dir === 'left' || dir === 'right') {
      g.fillRoundedRect(x - TILE_W*0.15, y + TILE_H*0.44, TILE_W*0.3, TILE_H*0.1, 3);
    } else {
      g.fillRoundedRect(x - TILE_W*0.2, y + TILE_H*0.44, TILE_W*0.16, TILE_H*0.1, 3);
      g.fillRoundedRect(x + TILE_W*0.04, y + TILE_H*0.44, TILE_W*0.16, TILE_H*0.1, 3);
    }

    // === BODY — white chef coat ===
    g.fillStyle(0xfafafa, 1);
    g.fillRoundedRect(x - TILE_W*0.23, y - TILE_H*0.08, TILE_W*0.46, TILE_H*0.32, 6);
    // Coat collar / lapels
    g.fillStyle(0xf0f0f0, 1);
    g.fillTriangle(x - TILE_W*0.08, y - TILE_H*0.08, x, y + TILE_H*0.04, x - TILE_W*0.22, y - TILE_H*0.08);
    g.fillTriangle(x + TILE_W*0.08, y - TILE_H*0.08, x, y + TILE_H*0.04, x + TILE_W*0.22, y - TILE_H*0.08);
    // Buttons
    g.fillStyle(0xf97316, 1);
    g.fillCircle(x - TILE_W*0.07, y + TILE_H*0.04, TILE_W*0.034);
    g.fillCircle(x + TILE_W*0.07, y + TILE_H*0.04, TILE_W*0.034);
    g.fillCircle(x - TILE_W*0.07, y + TILE_H*0.14, TILE_W*0.028);
    g.fillCircle(x + TILE_W*0.07, y + TILE_H*0.14, TILE_W*0.028);

    // === ARMS ===
    g.fillStyle(0xfafafa, 1);
    if (dir === 'left') {
      g.fillRoundedRect(x - TILE_W*0.4, y - TILE_H*0.02, TILE_W*0.2, TILE_H*0.12, 4);
      g.fillRoundedRect(x + TILE_W*0.22, y + TILE_H*0.04, TILE_W*0.14, TILE_H*0.1, 4);
    } else if (dir === 'right') {
      g.fillRoundedRect(x - TILE_W*0.36, y + TILE_H*0.04, TILE_W*0.14, TILE_H*0.1, 4);
      g.fillRoundedRect(x + TILE_W*0.2, y - TILE_H*0.02, TILE_W*0.2, TILE_H*0.12, 4);
    } else {
      g.fillRoundedRect(x - TILE_W*0.4, y + TILE_H*0.04, TILE_W*0.17, TILE_H*0.1, 4);
      g.fillRoundedRect(x + TILE_W*0.23, y + TILE_H*0.04, TILE_W*0.17, TILE_H*0.1, 4);
    }
    // Hands
    g.fillStyle(0xfde8c8, 1);
    if (dir === 'left') {
      g.fillCircle(x - TILE_W*0.4, y + TILE_H*0.04, TILE_W*0.07);
    } else if (dir === 'right') {
      g.fillCircle(x + TILE_W*0.4, y + TILE_H*0.04, TILE_W*0.07);
    } else {
      g.fillCircle(x - TILE_W*0.4, y + TILE_H*0.1, TILE_W*0.07);
      g.fillCircle(x + TILE_W*0.4, y + TILE_H*0.1, TILE_W*0.07);
    }

    // === NECK ===
    g.fillStyle(0xfde8c8, 1);
    g.fillRect(x - TILE_W*0.07, y - TILE_H*0.2, TILE_W*0.14, TILE_H*0.14);

    // === HEAD ===
    g.fillStyle(0xfde8c8, 1);
    g.fillRoundedRect(x - TILE_W*0.22, y - TILE_H*0.48, TILE_W*0.44, TILE_H*0.32, 8);
    // Ear
    if (dir === 'left') {
      g.fillCircle(x - TILE_W*0.22, y - TILE_H*0.34, TILE_W*0.07);
    } else if (dir === 'right') {
      g.fillCircle(x + TILE_W*0.22, y - TILE_H*0.34, TILE_W*0.07);
    }

    // === CHEF HAT ===
    // Brim
    g.fillStyle(0xfafafa, 1);
    g.fillRoundedRect(x - TILE_W*0.27, y - TILE_H*0.52, TILE_W*0.54, TILE_H*0.1, 3);
    // Tall part
    g.fillRoundedRect(x - TILE_W*0.19, y - TILE_H*0.82, TILE_W*0.38, TILE_H*0.34, 5);
    // Orange band
    g.fillStyle(0xf97316, 1);
    g.fillRect(x - TILE_W*0.19, y - TILE_H*0.54, TILE_W*0.38, TILE_H*0.07);
    // Hat shadow on brim
    g.fillStyle(0xe8e8e8, 1);
    g.fillRoundedRect(x - TILE_W*0.19, y - TILE_H*0.52, TILE_W*0.38, TILE_H*0.04, 2);

    // === FACE ===
    g.fillStyle(0x2d1a00, 1);
    if (dir === 'up') {
      // back of head — no face
    } else if (dir === 'left') {
      g.fillCircle(x - TILE_W*0.1, y - TILE_H*0.33, TILE_W*0.044);
      g.fillRoundedRect(x - TILE_W*0.16, y - TILE_H*0.22, TILE_W*0.14, TILE_H*0.045, 2);
    } else if (dir === 'right') {
      g.fillCircle(x + TILE_W*0.1, y - TILE_H*0.33, TILE_W*0.044);
      g.fillRoundedRect(x + TILE_W*0.02, y - TILE_H*0.22, TILE_W*0.14, TILE_H*0.045, 2);
    } else {
      // Eyes
      g.fillCircle(x - TILE_W*0.09, y - TILE_H*0.33, TILE_W*0.046);
      g.fillCircle(x + TILE_W*0.09, y - TILE_H*0.33, TILE_W*0.046);
      // Eye shine
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(x - TILE_W*0.08, y - TILE_H*0.35, TILE_W*0.016);
      g.fillCircle(x + TILE_W*0.1,  y - TILE_H*0.35, TILE_W*0.016);
      // Smile
      g.fillStyle(0x2d1a00, 1);
      g.lineStyle(TILE_W*0.026, 0x2d1a00, 1);
      g.beginPath(); g.arc(x, y - TILE_H*0.22, TILE_W*0.1, 0.25, Math.PI - 0.25, false); g.strokePath();
      // Rosy cheeks
      g.fillStyle(0xff9999, 0.35);
      g.fillCircle(x - TILE_W*0.16, y - TILE_H*0.27, TILE_W*0.05);
      g.fillCircle(x + TILE_W*0.16, y - TILE_H*0.27, TILE_W*0.05);
    }

    // Update held bubble position
    if (this.heldText?.visible) {
      this.heldText.setPosition(x, y - TILE_H * 0.95);
    }
    window.DK_CHEF_POS = { x, y };
  }

  // ─── D-pad (FIXED: direct position update, no tweens) ──────────────────────
  _buildDpad() {
    const W = this.W, H = this.H;
    // Position d-pad in bottom-right, big enough to tap easily
    const padCX = W - 85;
    const padCY = H - 110;
    const R     = 32;   // button radius in pixels

    const dirs = [
      { label:'▲', dx: 0, dy:-1, bx: padCX,      by: padCY - 70  },
      { label:'▼', dx: 0, dy: 1, bx: padCX,      by: padCY + 70  },
      { label:'◀', dx:-1, dy: 0, bx: padCX - 70, by: padCY       },
      { label:'▶', dx: 1, dy: 0, bx: padCX + 70, by: padCY       },
    ];

    // Background disc
    const bgDisc = this.add.graphics().setDepth(40);
    bgDisc.fillStyle(0x000000, 0.28); bgDisc.fillCircle(padCX, padCY, 95);
    bgDisc.fillStyle(0x000000, 0.15); bgDisc.fillCircle(padCX, padCY, 60);

    dirs.forEach(d => {
      // Button background — use zone for reliable hit detection in Devvit iframes
      const btnGfx = this.add.graphics().setDepth(41);
      const drawBtn = (active) => {
        btnGfx.clear();
        btnGfx.fillStyle(active ? 0xf97316 : 0xffffff, active ? 0.9 : 0.25);
        btnGfx.fillCircle(d.bx, d.by, R);
        btnGfx.lineStyle(1.5, 0xffffff, active ? 0.9 : 0.4);
        btnGfx.strokeCircle(d.bx, d.by, R);
      };
      drawBtn(false);

      // Arrow label
      const lbl = this.add.text(d.bx, d.by, d.label, {
        fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#00000066', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(42);

      // IMPORTANT: Use a Zone for reliable hit detection in Devvit iframes
      // Phaser Graphics.setInteractive() can fail silently in sandboxed iframes
      const zone = this.add.zone(d.bx, d.by, R * 2.2, R * 2.2).setInteractive().setDepth(43);

      let held = false, iv = null;

      const doMove = () => {
        const dir = d.dx < 0 ? 'left' : d.dx > 0 ? 'right' : d.dy < 0 ? 'up' : 'down';
        this.chefDir = dir;
        // DIRECT position update — no tween
        const stepX = d.dx * 18;  // pixels per step
        const stepY = d.dy * 10;  // smaller Y step due to isometric compression
        const minY  = this.floorMinY;
        const newX  = Math.max(30, Math.min(this.W - 30, this.chefPos.x + stepX));
        const newY  = Math.max(minY, Math.min(this.H - 30, this.chefPos.y + stepY));
        this.chefPos.x = newX;
        this.chefPos.y = newY;
        this._drawChef(newX, newY, dir);
        window.DK_CHEF_POS = { x: newX, y: newY };
      };

      zone.on('pointerdown', () => {
        drawBtn(true);
        held = true;
        doMove();
        iv = setInterval(() => { if (held) doMove(); }, 80); // fast repeat
      });

      const release = () => {
        drawBtn(false);
        held = false;
        clearInterval(iv);
      };
      zone.on('pointerup',   release);
      zone.on('pointerout',  release);
    });

    // ── Interact button (bottom-left) ─────────────────────────────────────────
    const actX = 75, actY = H - 95;
    const actR = 38;

    const actGfx = this.add.graphics().setDepth(41);
    const drawAct = (active) => {
      actGfx.clear();
      // Outer glow ring
      actGfx.fillStyle(0xf97316, active ? 0.3 : 0.12);
      actGfx.fillCircle(actX, actY, actR + 8);
      // Button body
      actGfx.fillStyle(active ? 0xff8c00 : 0xf97316, 1);
      actGfx.fillCircle(actX, actY, actR);
      // Inner shine
      actGfx.fillStyle(0xffffff, 0.2);
      actGfx.fillEllipse(actX - 8, actY - 12, actR * 0.9, actR * 0.5);
      // Border
      actGfx.lineStyle(2, 0xffffff, 0.5);
      actGfx.strokeCircle(actX, actY, actR);
    };
    drawAct(false);

    this.add.text(actX, actY - 4, '✋', {
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(42);

    this.add.text(actX, actY + actR + 8, 'ACTION', {
      fontSize: '8px', fontStyle: 'bold', color: 'rgba(255,255,255,0.7)',
      stroke: '#00000055', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(42);

    const actZone = this.add.zone(actX, actY, actR * 2.4, actR * 2.4).setInteractive().setDepth(43);
    actZone.on('pointerdown', () => {
      drawAct(true);
      window.dispatchEvent(new CustomEvent('dk:interact'));
    });
    actZone.on('pointerup',  () => drawAct(false));
    actZone.on('pointerout', () => drawAct(false));
  }

  // ─── Tap on floor = walk there ─────────────────────────────────────────────
  _onTap(ptr) {
    // Only walk if tap is below the counter (on the floor area)
    // and not on a button zone
    if (ptr.y > this.counterScreenY + TILE_H * 0.3 &&
        ptr.y < this.H - 160) {  // avoid tap on d-pad/interact area
      this._walkTo(ptr.x, ptr.y);
    }
  }

  // Tween-based smooth walk (tap-to-move only, NOT used for d-pad)
  _walkTo(tx, ty, onArrive) {
    const dx = tx - this.chefPos.x, dy = ty - this.chefPos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 8) { if (onArrive) onArrive(); return; }

    if (Math.abs(dx) > Math.abs(dy)) this.chefDir = dx > 0 ? 'right' : 'left';
    else this.chefDir = dy > 0 ? 'down' : 'up';

    if (this._walkTween) this._walkTween.stop();
    const proxy = { x: this.chefPos.x, y: this.chefPos.y };
    this._walkTween = this.tweens.add({
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

  // ─── Public API ────────────────────────────────────────────────────────────
  walkPlayerTo(tx, ty, onArrive) { this._walkTo(tx, ty, onArrive); }
  getPlayerPos()                 { return { ...this.chefPos }; }

  showFloatText(x, y, text, color = '#ffffff', size = 13) {
    const t = this.add.text(x, y, text, {
      fontSize: size + 'px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 900, ease: 'Power2', onComplete: () => t.destroy() });
  }

  setHeldItems(emojis) {
    if (!this.heldText) return;
    if (!emojis || emojis.length === 0) {
      this.heldText.setVisible(false);
    } else {
      this.heldText.setText(emojis.join(' ')).setVisible(true);
      this.heldText.setPosition(this.chefPos.x, this.chefPos.y - TILE_H * 0.95);
    }
  }

  rebuildKitchen(tier) {
    this.kitchenTier = tier;
    this.children.list.filter(o => o.depth < 5).forEach(o => o.destroy());
    this._computeLayout();
    this._buildBackground();
    this._buildFloor();
    this._buildWalls();
    this._buildCounter();
    this._buildLanterns();
    window.dispatchEvent(new CustomEvent('dk:kitchenRebuilt', { detail: { tier } }));
  }

  update() { /* event-driven */ }

  shutdown() {
    this.input.off('pointerdown', this._onTap, this);
  }
}
