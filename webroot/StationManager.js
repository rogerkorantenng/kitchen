// webroot/StationManager.js
// Stations rendered as detailed cooking appliances — not just colored boxes.
// Each station has its own visual identity: grill bars, fryer basket, wok ring, etc.

const StationManager = (() => {
  const _stations = {};
  let _kitchenTier = 1;

  // Saved upgrade levels persist across kitchen rebuilds
  const _savedLevels = {};

  function _init(tier) {
    _kitchenTier = tier;
    Object.keys(_stations).forEach(id => _destroyStation(id));

    const layout   = STATION_LAYOUT[tier] || STATION_LAYOUT[1];
    const tierData = KITCHEN_TIERS[tier];
    const spacing  = tierData.cols / (layout.length + 1);

    layout.forEach((type, i) => {
      const col = Math.round(spacing * (i + 1));
      const id  = type;
      _stations[id] = {
        id, type, col, row: 1,
        level:    _savedLevels[id] || 0,
        cooking:  false,
        cookStart:0,
        ready:    false,
        objs:     {},
      };
      _drawStation(_stations[id]);
    });
  }

  // ── Station visuals ──────────────────────────────────────────────────────────
  function _drawStation(st) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;

    const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
    const cx = x + TILE_W / 2;
    const cy = y;
    const objs = {};

    // Draw the base appliance
    _drawAppliance(scene, objs, st.type, cx, cy, st.level);

    // Cook progress ring
    const ring = scene.add.graphics().setDepth(12).setVisible(false);
    objs.ring = ring; objs._cx = cx; objs._cy = cy;

    // READY badge — green pill
    const badge = scene.add.graphics().setDepth(13).setVisible(false);
    badge.fillStyle(0x22c55e, 1);
    badge.fillRoundedRect(cx - 28, cy - TILE_H * 1.1, 56, 18, 9);
    badge.lineStyle(1.5, 0x16a34a, 1);
    badge.strokeRoundedRect(cx - 28, cy - TILE_H * 1.1, 56, 18, 9);
    objs.badge = badge;

    objs.badgeText = scene.add.text(cx, cy - TILE_H * 1.02, '✓ READY', {
      fontSize: '8px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(14).setVisible(false);

    // Upgrade coin pulse
    objs.upgradeIcon = scene.add.text(cx, cy - TILE_H * 1.4, '', {
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(14);

    // Interaction zone
    const zone = scene.add.zone(cx, cy - TILE_H * 0.2, TILE_W * 0.9, TILE_H * 1.5).setInteractive().setDepth(15);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:stationTapped', { detail: { id: st.id } })));
    objs.zone = zone;

    st.objs = objs;
  }

  function _drawAppliance(scene, objs, type, cx, cy, level) {
    const g = scene.add.graphics().setDepth(10);
    objs.body = g;

    const TW = TILE_W, TH = TILE_H;
    const boxH = TH * 0.9; // height of the appliance box front face

    // ── Helper: draw isometric box ───────────────────────────────────────────
    function isoBox(topColor, leftColor, rightColor) {
      // Top face
      g.fillStyle(topColor, 1);
      g.fillPoints([
        { x: cx,           y: cy - TH * 0.4 },
        { x: cx + TW * 0.5, y: cy - TH * 0.15 },
        { x: cx,           y: cy + TH * 0.1  },
        { x: cx - TW * 0.5, y: cy - TH * 0.15 },
      ], true);
      // Left face
      g.fillStyle(leftColor, 1);
      g.fillPoints([
        { x: cx - TW * 0.5, y: cy - TH * 0.15 },
        { x: cx,           y: cy + TH * 0.1  },
        { x: cx,           y: cy + TH * 0.1 + boxH },
        { x: cx - TW * 0.5, y: cy - TH * 0.15 + boxH },
      ], true);
      // Right face
      g.fillStyle(rightColor, 1);
      g.fillPoints([
        { x: cx,           y: cy + TH * 0.1  },
        { x: cx + TW * 0.5, y: cy - TH * 0.15 },
        { x: cx + TW * 0.5, y: cy - TH * 0.15 + boxH },
        { x: cx,           y: cy + TH * 0.1 + boxH   },
      ], true);
    }

    if (type === 'grill') {
      // Dark cast-iron grill
      isoBox(0x2a2a2a, 0x1a1a1a, 0x222222);
      // Grill grates (parallel lines across top face)
      g.lineStyle(2, 0x444444, 1);
      for (let i = -3; i <= 3; i++) {
        const px = cx + i * (TW * 0.14);
        g.lineBetween(px, cy - TH * 0.38, px + TW * 0.15, cy + TH * 0.08);
      }
      // Heat glow on top
      g.fillStyle(0xff4500, 0.18);
      g.fillPoints([
        { x: cx, y: cy - TH * 0.4 }, { x: cx + TW*0.5, y: cy - TH*0.15 },
        { x: cx, y: cy + TH*0.1 }, { x: cx - TW*0.5, y: cy - TH*0.15 },
      ], true);
      // Chrome knobs on front face
      g.fillStyle(0x888888, 1);
      g.fillCircle(cx - TW*0.15, cy + TH*0.35, 4);
      g.fillCircle(cx + TW*0.15, cy + TH*0.35, 4);
      g.fillStyle(0xcccccc, 1);
      g.fillCircle(cx - TW*0.15, cy + TH*0.35, 2.5);
      g.fillCircle(cx + TW*0.15, cy + TH*0.35, 2.5);
      // Level glow: gold trim if level 4
      if (level >= 4) { g.lineStyle(2, 0xfbbf24, 0.8); g.strokePoints([{x:cx,y:cy-TH*0.4},{x:cx+TW*0.5,y:cy-TH*0.15},{x:cx,y:cy+TH*0.1},{x:cx-TW*0.5,y:cy-TH*0.15}], true); }

    } else if (type === 'drinks') {
      // Bright teal drinks machine
      isoBox(0x0891b2, 0x0e7490, 0x0c6e84);
      // Screen / display on top
      g.fillStyle(0x67e8f9, 0.9);
      g.fillRoundedRect(cx - TW*0.2, cy - TH*0.32, TW*0.4, TH*0.28, 3);
      // Cup slots
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(cx - TW*0.12, cy - TH*0.06, 5);
      g.fillCircle(cx + TW*0.12, cy - TH*0.06, 5);
      // Dispenser nozzle
      g.fillStyle(0x374151, 1);
      g.fillRect(cx - 4, cy + TH*0.08, 8, 10);
      // Buttons on front
      g.fillStyle(0xff6b6b, 1); g.fillCircle(cx - TW*0.18, cy + TH*0.32, 4);
      g.fillStyle(0xffd93d, 1); g.fillCircle(cx, cy + TH*0.32, 4);
      g.fillStyle(0x6bcb77, 1); g.fillCircle(cx + TW*0.18, cy + TH*0.32, 4);

    } else if (type === 'fryer') {
      // Stainless steel fryer
      isoBox(0xd1d5db, 0xa3a3a3, 0xb0b0b0);
      // Oil surface (golden yellow)
      g.fillStyle(0xfbbf24, 0.85);
      g.fillPoints([
        { x: cx, y: cy - TH*0.35 }, { x: cx + TW*0.44, y: cy - TH*0.12 },
        { x: cx, y: cy + TH*0.08 }, { x: cx - TW*0.44, y: cy - TH*0.12 },
      ], true);
      // Basket handle
      g.lineStyle(3, 0x888888, 1);
      g.lineBetween(cx - TW*0.1, cy - TH*0.4, cx - TW*0.1, cy - TH*0.65);
      g.lineBetween(cx - TW*0.1, cy - TH*0.65, cx + TW*0.1, cy - TH*0.65);
      g.lineBetween(cx + TW*0.1, cy - TH*0.65, cx + TW*0.1, cy - TH*0.4);
      // Temperature dial
      g.fillStyle(0x374151, 1);
      g.fillCircle(cx, cy + TH*0.35, 7);
      g.fillStyle(0xf97316, 1);
      g.fillCircle(cx + 2, cy + TH*0.34, 3);

    } else if (type === 'wok') {
      // Round wok on gas burner
      isoBox(0x1c1c1c, 0x111111, 0x161616);
      // Burner ring
      g.lineStyle(3, 0x555555, 1);
      g.strokeEllipse(cx, cy - TH*0.15, TW*0.65, TH*0.35);
      // Wok bowl (concave ellipse)
      g.fillStyle(0x2d2d2d, 1);
      g.fillEllipse(cx, cy - TH*0.12, TW*0.55, TH*0.28);
      // Food in wok (colorful)
      g.fillStyle(0xf97316, 0.7); g.fillEllipse(cx - 4, cy - TH*0.14, 10, 6);
      g.fillStyle(0x22c55e, 0.7); g.fillEllipse(cx + 4, cy - TH*0.11, 8, 5);
      g.fillStyle(0xfbbf24, 0.7); g.fillEllipse(cx, cy - TH*0.08, 7, 4);
      // Wok handle
      g.lineStyle(3, 0x888888, 1);
      g.lineBetween(cx + TW*0.25, cy - TH*0.12, cx + TW*0.48, cy - TH*0.02);
      // Flame glow
      g.fillStyle(0xff6b00, 0.15);
      g.fillEllipse(cx, cy - TH*0.12, TW*0.6, TH*0.3);

    } else if (type === 'bakery') {
      // Warm cream oven
      isoBox(0xf5f0e8, 0xddd0b8, 0xe8dcc8);
      // Oven door window
      g.fillStyle(0x1a1a2e, 0.85);
      g.fillRoundedRect(cx - TW*0.25, cy - TH*0.22, TW*0.5, TH*0.22, 4);
      g.fillStyle(0xff9f43, 0.3);
      g.fillRoundedRect(cx - TW*0.22, cy - TH*0.2, TW*0.44, TH*0.18, 3);
      // Door handle
      g.fillStyle(0x888888, 1);
      g.fillRoundedRect(cx - TW*0.15, cy + TH*0.04, TW*0.3, 5, 2);
      // Temperature display
      g.fillStyle(0xff6b6b, 0.8);
      g.fillRoundedRect(cx + TW*0.14, cy - TH*0.3, TW*0.12, TH*0.1, 2);

    } else if (type === 'prep') {
      // Stainless prep counter / cutting board
      isoBox(0xe8f5e9, 0xc8e6c9, 0xd4eecd);
      // Cutting board wood grain lines
      g.lineStyle(1, 0xddd0b0, 0.6);
      for (let i = 0; i < 4; i++) {
        g.lineBetween(cx - TW*0.35 + i*TW*0.18, cy - TH*0.36, cx - TW*0.2 + i*TW*0.18, cy + TH*0.06);
      }
      // Knife
      g.fillStyle(0x888888, 1);
      g.fillRect(cx - TW*0.08, cy - TH*0.38, 3, TH*0.32);
      g.fillStyle(0x4a3728, 1);
      g.fillRect(cx - TW*0.09, cy - TH*0.08, 5, TH*0.12);
      // Veggies on board
      g.fillStyle(0x22c55e, 0.9); g.fillEllipse(cx - TW*0.2, cy - TH*0.18, 10, 7);
      g.fillStyle(0xff6b6b, 0.9); g.fillEllipse(cx + TW*0.1, cy - TH*0.14, 9, 7);
      g.fillStyle(0xfbbf24, 0.9); g.fillEllipse(cx - TW*0.05, cy - TH*0.08, 8, 6);

    } else if (type === 'smoker') {
      // Black barrel smoker
      isoBox(0x1a0a00, 0x100500, 0x150800);
      // Barrel bands
      g.lineStyle(2, 0x3d1a00, 1);
      g.lineBetween(cx - TW*0.5, cy - TH*0.02, cx + TW*0.5, cy - TH*0.02);
      g.lineBetween(cx - TW*0.48, cy + TH*0.28, cx + TW*0.48, cy + TH*0.28);
      // Smoke vent chimney
      g.fillStyle(0x2d2d2d, 1);
      g.fillRect(cx + TW*0.25, cy - TH*0.5, 6, TH*0.18);
      // Glowing coals (visible through top crack)
      g.fillStyle(0xff4500, 0.7);
      g.fillEllipse(cx, cy - TH*0.32, TW*0.3, TH*0.1);
      g.fillStyle(0xffa500, 0.5);
      g.fillEllipse(cx, cy - TH*0.3, TW*0.18, TH*0.06);
      // Door latch
      g.fillStyle(0x888888, 1);
      g.fillCircle(cx + TW*0.3, cy + TH*0.12, 4);

    } else if (type === 'dessert') {
      // Pink pastel dessert station
      isoBox(0xfce7f3, 0xf9a8d4, 0xfbb6ce);
      // Cake stand
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(cx, cy - TH*0.28, TW*0.4, TH*0.18);
      g.fillStyle(0xff85a1, 1);
      g.fillEllipse(cx, cy - TH*0.32, TW*0.32, TH*0.14);
      // Frosting drips
      g.fillStyle(0xffffff, 0.9);
      [-TW*0.1, 0, TW*0.1].forEach(ox => {
        g.fillEllipse(cx + ox, cy - TH*0.2, 8, 10);
      });
      // Sprinkles
      g.fillStyle(0xf97316, 1); g.fillRect(cx - TW*0.06, cy - TH*0.3, 5, 2);
      g.fillStyle(0x22c55e, 1); g.fillRect(cx + TW*0.04, cy - TH*0.34, 4, 2);
      g.fillStyle(0x818cf8, 1); g.fillRect(cx, cy - TH*0.27, 3, 2);
      // Pedestal
      g.fillStyle(0xfce7f3, 1);
      g.fillRect(cx - 5, cy - TH*0.12, 10, TH*0.15);
      g.fillEllipse(cx, cy + TH*0.05, TW*0.25, TH*0.1);
    }

    // Label below
    objs.nameLabel = scene.add.text(cx, cy + TILE_H * 0.65, STATIONS[type]?.label.toUpperCase() || '', {
      fontSize: '7px', fontStyle: 'bold', color: '#4a3728',
      stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);

    // Gold trim for max level
    if (_savedLevels[type] >= 4 && type !== 'grill') {
      g.lineStyle(1.5, 0xfbbf24, 0.6);
      g.strokePoints([
        { x: cx, y: cy - TILE_H*0.4 }, { x: cx+TILE_W*0.5, y: cy-TILE_H*0.15 },
        { x: cx, y: cy+TILE_H*0.1 }, { x: cx-TILE_W*0.5, y: cy-TILE_H*0.15 },
      ], true);
    }
  }

  function _destroyStation(id) {
    const st = _stations[id];
    if (!st?.objs) return;
    Object.values(st.objs).forEach(o => { try { o?.destroy?.(); } catch {} });
    st.objs = {};
  }

  function _updateRing(st) {
    const o = st.objs;
    if (!o?.ring || !st.cooking) { o?.ring?.setVisible(false); return; }
    o.ring.setVisible(true);
    const pct = Math.min((Date.now() - st.cookStart) / _getCookMs(st), 1);
    o.ring.clear();
    // Dark track
    o.ring.lineStyle(5, 0x000000, 0.15);
    o.ring.beginPath(); o.ring.arc(o._cx, o._cy - TILE_H*0.15, TILE_W*0.3, 0, Math.PI*2); o.ring.strokePath();
    // Orange progress
    o.ring.lineStyle(5, 0xf97316, 1);
    o.ring.beginPath(); o.ring.arc(o._cx, o._cy - TILE_H*0.15, TILE_W*0.3, -Math.PI/2, -Math.PI/2 + pct*Math.PI*2); o.ring.strokePath();
    // Steam particles while cooking
    if (pct > 0.3 && Math.random() < 0.15) {
      const steam = window.CHEF_SCENE?.add.text(
        o._cx + (Math.random()-0.5)*20, o._cy - TILE_H*0.5, '〰️', { fontSize:'10px', alpha:0.7 }
      ).setDepth(15);
      if (steam && window.CHEF_SCENE) {
        window.CHEF_SCENE.tweens.add({ targets:steam, y:steam.y-18, alpha:0, duration:600, onComplete:()=>steam.destroy() });
      }
    }
  }

  function _getCookMs(st) {
    let ms = STATIONS[st.type]?.cookMs || 3000;
    if (st.level >= 1) ms *= 0.8;
    if (st.level >= 4) ms *= 0.7;
    return Math.max(600, ms);
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function getStations() { return Object.values(_stations); }

  function startCooking(id) {
    const st = _stations[id];
    if (!st || st.cooking || st.ready) return false;
    st.cooking = true; st.cookStart = Date.now();
    window.setTimeout(() => {
      if (!_stations[id]) return;
      st.ready = true; st.cooking = false;
      const o = st.objs;
      if (o.ring) o.ring.setVisible(false);
      if (o.badge) o.badge.setVisible(true);
      if (o.badgeText) o.badgeText.setVisible(true);
      if (o.body && window.CHEF_SCENE) {
        window.CHEF_SCENE.tweens.add({ targets:o.body, scaleX:1.06, scaleY:1.06, duration:100, yoyo:true });
      }
    }, _getCookMs(st));
    return true;
  }

  function isReady(id)   { return _stations[id]?.ready === true; }
  function isCooking(id) { return _stations[id]?.cooking === true; }

  function pickUp(id) {
    const st = _stations[id];
    if (!st?.ready) return null;
    st.ready = false; st.cooking = false;
    const o = st.objs;
    if (o.badge)     o.badge.setVisible(false);
    if (o.badgeText) o.badgeText.setVisible(false);
    if (o.ring)      { o.ring.setVisible(false); o.ring.clear(); }
    return st.type;
  }

  function getUpgradeCost(id) {
    const st = _stations[id];
    if (!st) return Infinity;
    return Math.floor((UPGRADE_BASE_COSTS[st.type]||80) * Math.pow(1.8, st.level));
  }

  function upgradeStation(id) {
    const st = _stations[id];
    if (!st || st.level >= 4) return;
    st.level++;
    _savedLevels[id] = st.level;
    if (st.objs.nameLabel) st.objs.nameLabel.setText(STATIONS[st.type]?.label.toUpperCase()||'');
    // Rebuild station visual with new level
    _destroyStation(id);
    _drawStation(st);
    window.CHEF_SCENE?.showFloatText(st.objs._cx, st.objs._cy - TILE_H, '⬆ Upgraded!', '#fbbf24');
    if (window.PARTICLE_FX) window.PARTICLE_FX.upgradeSlamBurst(st.objs._cx, st.objs._cy - TILE_H * 0.2);
  }

  function updateUpgradeIcons(coins) {
    Object.values(_stations).forEach(st => {
      if (!st.objs.upgradeIcon) return;
      const cost = getUpgradeCost(st.id);
      st.objs.upgradeIcon.setText(coins >= cost && st.level < 4 ? '💰' : '').setVisible(true);
    });
  }

  function resetForNewShift() {
    Object.values(_stations).forEach(st => {
      st.cooking = false; st.ready = false;
      const o = st.objs;
      if (o.badge)     o.badge.setVisible(false);
      if (o.badgeText) o.badgeText.setVisible(false);
      if (o.ring)      { o.ring.setVisible(false); o.ring.clear(); }
    });
  }

  function rebuildForTier(tier) { _init(tier); }

  // Ring tick
  setInterval(() => Object.values(_stations).forEach(_updateRing), 50);

  window.addEventListener('dk:sceneReady',     () => _init(_kitchenTier));
  window.addEventListener('dk:kitchenRebuilt', (ev) => _init(ev.detail.tier));

  return { getStations, startCooking, isReady, isCooking, pickUp, getUpgradeCost, upgradeStation, updateUpgradeIcons, resetForNewShift, rebuildForTier };
})();

window.STATION_MGR = StationManager;
