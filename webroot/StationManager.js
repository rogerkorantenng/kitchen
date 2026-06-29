// webroot/StationManager.js
// Manages all station state: cooking timers, ready state, upgrade levels.
// Draws station visuals as isometric 3D boxes on the Phaser scene.

const StationManager = (() => {
  const _stations = {};  // id → station object
  let _kitchenTier = 1;

  function _init(tier) {
    _kitchenTier = tier;
    // Destroy existing visuals
    Object.keys(_stations).forEach(id => _destroyStation(id));
    // Clear station records (but keep upgrade levels)
    const savedLevels = {};
    Object.values(_stations).forEach(st => { savedLevels[st.id] = st.level; });

    const layout = STATION_LAYOUT[tier] || STATION_LAYOUT[1];
    const tierData = KITCHEN_TIERS[tier];
    const spacing = tierData.cols / (layout.length + 1);

    layout.forEach((type, i) => {
      const col = Math.round(spacing * (i + 1));
      const id  = type;
      _stations[id] = {
        id, type, col, row: 1,
        level:    savedLevels[id] || 0,
        cooking:  false,
        cookStart:0,
        ready:    false,
        objs:     {},
      };
      _drawStation(_stations[id]);
    });
  }

  function _drawStation(st) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const meta = STATIONS[st.type];
    const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
    const objs = {};
    const cx = x + TILE_W / 2;
    const cy = y + TILE_H / 2;

    // Box depth and sizes
    const boxH = TILE_H * 0.75;

    // Darken helper
    const darken = (hex, amt) => {
      const c = Phaser.Display.Color.ValueToColor(hex);
      return Phaser.Display.Color.GetColor(
        Math.max(0, c.red   - amt),
        Math.max(0, c.green - amt),
        Math.max(0, c.blue  - amt)
      );
    };

    const body = scene.add.graphics().setDepth(10);

    // Top face (diamond)
    body.fillStyle(meta.color, 1);
    body.fillPoints([
      { x: cx,           y: cy - TILE_H * 0.38 },
      { x: cx + TILE_W * 0.48, y: cy - TILE_H * 0.14 },
      { x: cx,           y: cy + TILE_H * 0.1  },
      { x: cx - TILE_W * 0.48, y: cy - TILE_H * 0.14 },
    ], true);

    // Front-left face
    body.fillStyle(darken(meta.color, 40), 1);
    body.fillPoints([
      { x: cx - TILE_W * 0.48, y: cy - TILE_H * 0.14 },
      { x: cx,                 y: cy + TILE_H * 0.1   },
      { x: cx,                 y: cy + TILE_H * 0.1 + boxH  },
      { x: cx - TILE_W * 0.48, y: cy - TILE_H * 0.14 + boxH },
    ], true);

    // Front-right face
    body.fillStyle(darken(meta.color, 20), 1);
    body.fillPoints([
      { x: cx,                 y: cy + TILE_H * 0.1   },
      { x: cx + TILE_W * 0.48, y: cy - TILE_H * 0.14  },
      { x: cx + TILE_W * 0.48, y: cy - TILE_H * 0.14 + boxH },
      { x: cx,                 y: cy + TILE_H * 0.1 + boxH   },
    ], true);

    // Shine on top face
    body.fillStyle(C.white, 0.14);
    body.fillPoints([
      { x: cx,                 y: cy - TILE_H * 0.38 },
      { x: cx + TILE_W * 0.22, y: cy - TILE_H * 0.25 },
      { x: cx,                 y: cy - TILE_H * 0.12 },
      { x: cx - TILE_W * 0.22, y: cy - TILE_H * 0.25 },
    ], true);

    // Edge lines
    body.lineStyle(1, C.black, 0.15);
    body.strokePoints([
      { x: cx,           y: cy - TILE_H * 0.38 },
      { x: cx + TILE_W * 0.48, y: cy - TILE_H * 0.14 },
      { x: cx,           y: cy + TILE_H * 0.1 },
      { x: cx - TILE_W * 0.48, y: cy - TILE_H * 0.14 },
    ], true);

    objs.body = body;

    // Emoji on top face
    objs.emoji = scene.add.text(cx, cy - TILE_H * 0.16, meta.emoji, {
      fontSize: Math.round(TILE_W * 0.36) + 'px',
    }).setOrigin(0.5).setDepth(11);

    // Station name label
    objs.nameLabel = scene.add.text(cx, cy + TILE_H * 0.22, meta.label.toUpperCase(), {
      fontSize: '7px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#00000066', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);

    // Level indicator (top-right)
    objs.levelText = scene.add.text(cx + TILE_W * 0.42, cy - TILE_H * 0.42, 'Lv' + (st.level + 1), {
      fontSize: '8px', color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(12);

    // Cook progress arc (hidden until cooking)
    const ring = scene.add.graphics().setDepth(12).setVisible(false);
    objs.ring = ring;
    objs._cx = cx; objs._cy = cy;

    // READY badge (hidden)
    const badge = scene.add.graphics().setDepth(13).setVisible(false);
    badge.fillStyle(C.green, 1);
    badge.fillRoundedRect(cx - TILE_W * 0.35, cy - TILE_H * 0.7, TILE_W * 0.7, 20, 5);
    objs.badge = badge;
    objs.badgeText = scene.add.text(cx, cy - TILE_H * 0.6, '✓ READY', {
      fontSize: '9px', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5).setDepth(14).setVisible(false);

    // Upgrade pulse icon (shown when player has enough coins)
    objs.upgradeIcon = scene.add.text(cx, cy - TILE_H * 0.88, '', {
      fontSize: Math.round(TILE_W * 0.28) + 'px',
    }).setOrigin(0.5).setDepth(14);

    // Tap zone
    const zone = scene.add.zone(cx, cy, TILE_W * 0.95, TILE_H * 1.6).setInteractive().setDepth(15);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:stationTapped', { detail: { id: st.id } })));
    objs.zone = zone;

    st.objs = objs;
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
    const cookMs = _getCookMs(st);
    const pct    = Math.min((Date.now() - st.cookStart) / cookMs, 1);
    o.ring.clear();
    // Background arc
    o.ring.lineStyle(5, C.black, 0.2);
    o.ring.beginPath(); o.ring.arc(o._cx, o._cy - TILE_H * 0.14, TILE_W * 0.28, 0, Math.PI * 2, false); o.ring.strokePath();
    // Progress arc
    o.ring.lineStyle(4, C.orange, 0.95);
    o.ring.beginPath(); o.ring.arc(o._cx, o._cy - TILE_H * 0.14, TILE_W * 0.28, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2, false); o.ring.strokePath();
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
    const cookMs = _getCookMs(st);
    window.setTimeout(() => {
      if (!_stations[id]) return;
      st.ready = true; st.cooking = false;
      const o = st.objs;
      if (o.ring) o.ring.setVisible(false);
      if (o.badge) o.badge.setVisible(true);
      if (o.badgeText) o.badgeText.setVisible(true);
      // Bounce emoji on ready
      if (o.emoji && window.CHEF_SCENE) {
        window.CHEF_SCENE.tweens.add({ targets: o.emoji, y: o.emoji.y - 7, duration: 130, yoyo: true });
      }
    }, cookMs);
    return true;
  }

  function isReady(id)    { return _stations[id]?.ready === true; }
  function isCooking(id)  { return _stations[id]?.cooking === true; }

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
    return Math.floor((UPGRADE_BASE_COSTS[st.type] || 80) * Math.pow(1.8, st.level));
  }

  function upgradeStation(id) {
    const st = _stations[id];
    if (!st || st.level >= 4) return;
    st.level++;
    if (st.objs.levelText) st.objs.levelText.setText('Lv' + (st.level + 1));
    // Flash gold
    if (st.objs.body && window.CHEF_SCENE) {
      window.CHEF_SCENE.tweens.add({ targets: st.objs.body, alpha: 0.2, duration: 90, yoyo: true, repeat: 4 });
    }
    window.CHEF_SCENE?.showFloatText(st.objs._cx, st.objs._cy - TILE_H, '⬆ Upgraded!', '#fbbf24');
    if (window.PARTICLE_FX) window.PARTICLE_FX.upgradeSlamBurst(st.objs._cx, st.objs._cy - TILE_H * 0.2);
  }

  function updateUpgradeIcons(coins) {
    Object.values(_stations).forEach(st => {
      if (!st.objs.upgradeIcon) return;
      const cost = getUpgradeCost(st.id);
      if (coins >= cost && st.level < 4) {
        st.objs.upgradeIcon.setText('💰').setVisible(true);
      } else {
        st.objs.upgradeIcon.setText('').setVisible(false);
      }
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

  // Tick progress rings at ~20fps (Date.now() based — not Phaser time)
  setInterval(() => Object.values(_stations).forEach(_updateRing), 50);

  // Init when scene is ready
  window.addEventListener('dk:sceneReady',     () => _init(_kitchenTier));
  window.addEventListener('dk:kitchenRebuilt', (ev) => _init(ev.detail.tier));

  return { getStations, startCooking, isReady, isCooking, pickUp, getUpgradeCost, upgradeStation, updateUpgradeIcons, resetForNewShift, rebuildForTier };
})();

window.STATION_MGR = StationManager;
