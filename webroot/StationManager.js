// webroot/StationManager.js — FRONT-FACING cooking stations on the kitchen line.
// Tap a station to cook; when ready a plated dish appears to tap-and-plate.
// Keeps the cook state machine (cooking/ready/level) — only the visuals are face-on.

const StationManager = (() => {
  const _stations = {};
  let _kitchenTier = 1;
  let _total = 1;
  const _savedLevels = {};
  let _cookStations = new Set();

  function _scene() { return window.CHEF_SCENE; }

  function _init(tier) {
    _kitchenTier = tier;
    Object.keys(_stations).forEach(id => _destroyStation(id));
    const layout = STATION_LAYOUT[tier] || STATION_LAYOUT[1];
    _total = layout.length;
    layout.forEach((type, i) => {
      _stations[type] = {
        id: type, type, slotIndex: i, level: _savedLevels[type] || 0,
        cooking: false, cookStart: 0, ready: false, objs: {},
      };
      _drawStation(_stations[type]);
    });
  }

  function _relayout() {
    Object.values(_stations).forEach(st => { _destroyStation(st.id); _drawStation(st); });
  }

  // ── Visuals ───────────────────────────────────────────────────────────────────
  function _drawStation(st) {
    const scene = _scene(); if (!scene) return;
    const slot = scene.stationSlot(st.slotIndex, _total);
    const { cx, cy, w, h } = slot;
    st._cx = cx; st._cy = cy; st._w = w; st._h = h;
    const objs = {};

    const body = scene.add.graphics().setDepth(20);
    _drawAppliance(body, st.type, cx, cy, w, h, st.level);
    objs.body = body;

    // name label on the counter
    objs.name = scene.add.text(cx, cy + h * 0.62, STATIONS[st.type].label.toUpperCase(), {
      fontSize: Math.max(8, Math.round(w * 0.1)) + 'px', fontStyle: 'bold',
      color: '#5c3a1e', stroke: '#fff7ea', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22);

    // level pips
    objs.pips = scene.add.graphics().setDepth(22);
    _drawPips(objs.pips, st, cx, cy, w, h);

    // cook badge (auto-cook)
    objs.cook = scene.add.text(cx - w * 0.42, cy - h * 0.5, '👨‍🍳', {
      fontSize: Math.round(w * 0.22) + 'px',
    }).setOrigin(0.5).setDepth(24).setVisible(_cookStations.has(st.id));

    // progress bar (front of station)
    objs.prog = scene.add.graphics().setDepth(23).setVisible(false);

    // ready dish + badge (above station)
    objs.dish = scene.add.text(cx, cy - h * 0.62, STATIONS[st.type].emoji, {
      fontSize: Math.round(w * 0.42) + 'px',
    }).setOrigin(0.5).setDepth(25).setVisible(false);
    objs.dishPlate = scene.add.graphics().setDepth(24).setVisible(false);
    objs.ready = scene.add.text(cx, cy - h * 0.92, 'TAP ✓', {
      fontSize: '10px', fontStyle: 'bold', color: '#fff', stroke: '#16a34a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(26).setVisible(false);

    // affordable-upgrade coin pulse
    objs.upg = scene.add.text(cx + w * 0.42, cy - h * 0.5, '', {
      fontSize: Math.round(w * 0.2) + 'px',
    }).setOrigin(0.5).setDepth(24);

    // tap zone
    const zone = scene.add.zone(cx, cy, w * 1.05, h * 1.5).setInteractive().setDepth(27);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:stationTapped', { detail: { id: st.id } })));
    objs.zone = zone;

    st.objs = objs;
    if (st.ready) _showReady(st);
  }

  function _drawPips(g, st, cx, cy, w, h) {
    g.clear();
    const n = 5, pw = w * 0.1, gap = pw * 0.4, total = n * pw + (n - 1) * gap;
    let x = cx - total / 2;
    const y = cy + h * 0.4;
    for (let i = 0; i < n; i++) {
      g.fillStyle(i <= st.level ? 0xf97316 : 0x000000, i <= st.level ? 1 : 0.18);
      g.fillRoundedRect(x, y, pw, pw * 0.55, 2);
      x += pw + gap;
    }
  }

  // Front-facing appliance art per type, inside box centred at (cx,cy) size w×h.
  function _drawAppliance(g, type, cx, cy, w, h, level) {
    const L = cx - w/2, R = cx + w/2, T = cy - h/2, B = cy + h/2;
    const meta = STATIONS[type];

    // cabinet base (shared)
    g.fillStyle(0x000000, 0.14); g.fillEllipse(cx, B - h*0.02, w * 0.96, h * 0.16);
    g.fillStyle(0x9aa3ac, 1); g.fillRoundedRect(L, cy - h*0.1, w, h*0.6, 8);
    g.fillStyle(0xb6bec6, 1); g.fillRoundedRect(L, cy - h*0.1, w, h*0.18, 8);

    const topY = cy - h*0.1;
    if (type === 'grill') {
      g.fillStyle(0x2c2c2c, 1); g.fillRoundedRect(L+ w*0.04, T + h*0.1, w*0.92, h*0.42, 7);
      g.fillStyle(0xff5a1f, 0.25); g.fillRoundedRect(L+ w*0.08, T + h*0.14, w*0.84, h*0.34, 6);
      g.lineStyle(2, 0x4a4a4a, 1);
      for (let i = 1; i < 6; i++) { const gx = L + w*0.08 + (w*0.84) * i/6; g.lineBetween(gx, T+h*0.14, gx, T+h*0.48); }
      // food
      g.fillStyle(0x7a3b1d, 1); g.fillEllipse(cx - w*0.16, T+h*0.32, w*0.18, h*0.1);
      g.fillStyle(0x7a3b1d, 1); g.fillEllipse(cx + w*0.16, T+h*0.34, w*0.18, h*0.1);
    } else if (type === 'fryer') {
      g.fillStyle(0xd7dde2, 1); g.fillRoundedRect(L+w*0.04, T+h*0.1, w*0.92, h*0.42, 7);
      [-0.22, 0.22].forEach(o => {
        g.fillStyle(0xe8b23a, 1); g.fillRoundedRect(cx + w*o - w*0.16, T+h*0.18, w*0.32, h*0.28, 4);
        g.fillStyle(0xffd76a, 0.8); g.fillRoundedRect(cx + w*o - w*0.13, T+h*0.2, w*0.26, h*0.1, 3);
        g.lineStyle(2, 0x9aa3ac, 1); g.lineBetween(cx + w*o, T+h*0.1, cx + w*o, T - h*0.02);
      });
    } else if (type === 'wok') {
      g.fillStyle(0x1c1c1c, 1); g.fillRoundedRect(L+w*0.04, T+h*0.12, w*0.92, h*0.4, 8);
      g.fillStyle(0xff6b00, 0.3); g.fillEllipse(cx, T+h*0.3, w*0.6, h*0.18);
      g.fillStyle(0x2d2d2d, 1); g.fillEllipse(cx, T+h*0.28, w*0.56, h*0.22);
      g.fillStyle(0xf97316, 0.8); g.fillEllipse(cx - w*0.06, T+h*0.26, w*0.12, h*0.06);
      g.fillStyle(0x22c55e, 0.8); g.fillEllipse(cx + w*0.07, T+h*0.3, w*0.1, h*0.05);
    } else if (type === 'drinks') {
      g.fillStyle(0x0e7490, 1); g.fillRoundedRect(L+w*0.06, T+h*0.05, w*0.88, h*0.5, 8);
      g.fillStyle(0x67e8f9, 0.9); g.fillRoundedRect(L+w*0.14, T+h*0.12, w*0.72, h*0.18, 4);
      [-0.2,0,0.2].forEach((o,i) => { g.fillStyle([0xff6b6b,0xffd93d,0x6bcb77][i],1); g.fillCircle(cx+w*o, T+h*0.42, w*0.05); });
      g.fillStyle(0x374151, 1); g.fillRect(cx - w*0.04, T+h*0.5, w*0.08, h*0.12);
    } else if (type === 'bakery') {
      g.fillStyle(0xead9bf, 1); g.fillRoundedRect(L+w*0.04, T+h*0.05, w*0.92, h*0.5, 8);
      g.fillStyle(0x12131f, 0.9); g.fillRoundedRect(L+w*0.14, T+h*0.14, w*0.72, h*0.3, 6);
      g.fillStyle(0xff9f43, 0.45); g.fillRoundedRect(L+w*0.17, T+h*0.17, w*0.66, h*0.24, 5);
      g.fillStyle(0xffcf8a, 0.9); g.fillEllipse(cx - w*0.12, T+h*0.3, w*0.12, h*0.06);
      g.fillStyle(0xffcf8a, 0.9); g.fillEllipse(cx + w*0.12, T+h*0.3, w*0.12, h*0.06);
      g.fillStyle(0x8a8f96, 1); g.fillRoundedRect(L+w*0.2, T+h*0.47, w*0.6, h*0.04, 2);
    } else if (type === 'prep') {
      g.fillStyle(0xcdb088, 1); g.fillRoundedRect(L+w*0.06, T+h*0.16, w*0.88, h*0.36, 6);
      g.fillStyle(0x22c55e, 0.95); g.fillEllipse(cx - w*0.2, T+h*0.3, w*0.12, h*0.07);
      g.fillStyle(0xff6b6b, 0.95); g.fillEllipse(cx + w*0.04, T+h*0.32, w*0.11, h*0.07);
      g.fillStyle(0xfbbf24, 0.95); g.fillEllipse(cx + w*0.22, T+h*0.28, w*0.1, h*0.06);
      g.fillStyle(0xcfd6dd, 1); g.fillRect(cx - w*0.3, T+h*0.18, w*0.04, h*0.3);
    } else if (type === 'smoker') {
      g.fillStyle(0x1a0a00, 1); g.fillRoundedRect(L+w*0.06, T+h*0.08, w*0.88, h*0.48, 10);
      g.lineStyle(2, 0x3d1a00, 1); g.lineBetween(L+w*0.06, cy-h*0.12, R-w*0.06, cy-h*0.12);
      g.fillStyle(0xff4500, 0.7); g.fillEllipse(cx, T+h*0.22, w*0.4, h*0.08);
      g.fillStyle(0x2d2d2d, 1); g.fillRect(R - w*0.2, T - h*0.02, w*0.08, h*0.18);
    } else if (type === 'dessert') {
      g.fillStyle(0xfce7f3, 1); g.fillRoundedRect(L+w*0.06, T+h*0.08, w*0.88, h*0.48, 10);
      g.fillStyle(0xffffff, 1); g.fillEllipse(cx, T+h*0.34, w*0.5, h*0.1);
      g.fillStyle(0xff85a1, 1); g.fillEllipse(cx, T+h*0.26, w*0.36, h*0.12);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(cx, T+h*0.2, w*0.05);
    }

    // gold trim at max level
    if (level >= 4) { g.lineStyle(3, 0xfbbf24, 0.9); g.strokeRoundedRect(L, cy - h*0.1, w, h*0.6, 8); }
    // glossy counter reflection
    g.fillStyle(0xffffff, 0.08); g.fillRoundedRect(L, topY, w, h*0.06, 6);
  }

  function _destroyStation(id) {
    const st = _stations[id]; if (!st?.objs) return;
    Object.values(st.objs).forEach(o => { try { o?.destroy?.(); } catch (_) {} });
    st.objs = {};
  }

  function _getCookMs(st) {
    let ms = STATIONS[st.type]?.cookMs || 3000;
    if (st.level >= 1) ms *= 0.82;
    if (st.level >= 3) ms *= 0.8;
    ms *= (window._cookSpeedMult || 1);   // "Prep Speed" shop upgrade
    return Math.max(400, ms);
  }

  function _showReady(st) {
    const scene = _scene(); const o = st.objs; if (!o.dish) return;
    o.prog.setVisible(false);
    o.dish.setVisible(true); o.ready.setVisible(true);
    o.dishPlate.clear().setVisible(true);
    o.dishPlate.fillStyle(0xffffff, 1);
    o.dishPlate.fillEllipse(st._cx, st._cy - st._h * 0.52, st._w * 0.5, st._h * 0.13);
    if (scene) scene.tweens.add({ targets: [o.dish], y: st._cy - st._h * 0.7, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  function _hideReady(st) {
    const o = st.objs; if (!o.dish) return;
    const scene = _scene(); if (scene) scene.tweens.killTweensOf(o.dish);
    o.dish.setVisible(false); o.ready.setVisible(false); o.dishPlate.setVisible(false);
    o.dish.setY(st._cy - st._h * 0.62);
  }

  // progress + steam tick
  setInterval(() => {
    Object.values(_stations).forEach(st => {
      const o = st.objs; if (!o.prog) return;
      if (!st.cooking) { o.prog.setVisible(false); return; }
      const pct = Math.min((Date.now() - st.cookStart) / _getCookMs(st), 1);
      o.prog.setVisible(true).clear();
      const w = st._w, x = st._cx - w*0.42, y = st._cy + st._h*0.28, bw = w*0.84;
      o.prog.fillStyle(0x000000, 0.25); o.prog.fillRoundedRect(x, y, bw, 7, 3);
      o.prog.fillStyle(0xf97316, 1); o.prog.fillRoundedRect(x, y, bw * pct, 7, 3);
      if (pct > 0.25 && Math.random() < 0.16) {
        const s = _scene()?.add.text(st._cx + (Math.random()-0.5)*st._w*0.4, st._cy - st._h*0.3, '〰️',
          { fontSize: Math.round(st._w*0.16)+'px' }).setDepth(25).setAlpha(0.7);
        if (s) _scene().tweens.add({ targets: s, y: s.y - 26, alpha: 0, duration: 700, onComplete: () => s.destroy() });
      }
    });
  }, 60);

  // ── Public API ───────────────────────────────────────────────────────────────
  function getStations() { return Object.values(_stations); }
  function startCooking(id) {
    const st = _stations[id];
    if (!st || st.cooking || st.ready) return false;
    st.cooking = true; st.cookStart = Date.now();
    window.setTimeout(() => {
      if (!_stations[id]) return;
      st.ready = true; st.cooking = false; _showReady(st);
    }, _getCookMs(st));
    return true;
  }
  function isReady(id)   { return _stations[id]?.ready === true; }
  function isCooking(id) { return _stations[id]?.cooking === true; }
  function pickUp(id) {
    const st = _stations[id];
    if (!st?.ready) return null;
    st.ready = false; _hideReady(st);
    return st.type;
  }
  function getUpgradeCost(id) {
    const st = _stations[id]; if (!st) return Infinity;
    return Math.floor((UPGRADE_BASE_COSTS[st.type] || 80) * Math.pow(1.8, st.level));
  }
  function upgradeStation(id) {
    const st = _stations[id];
    if (!st || st.level >= 4) return;
    st.level++; _savedLevels[id] = st.level;
    _destroyStation(id); _drawStation(st);
    if (window.PARTICLE_FX) window.PARTICLE_FX.upgradeSlamBurst(st._cx, st._cy);
    _scene()?.showFloatText(st._cx, st._cy - st._h*0.8, '⬆ Upgraded!', '#fbbf24');
  }
  function updateUpgradeIcons(coins) {
    Object.values(_stations).forEach(st => {
      if (!st.objs.upg) return;
      st.objs.upg.setText(coins >= getUpgradeCost(st.id) && st.level < 4 ? '💰' : '');
    });
  }
  function setCookStations(ids) {
    _cookStations = new Set(ids || []);
    Object.values(_stations).forEach(st => st.objs.cook?.setVisible(_cookStations.has(st.id)));
  }
  function resetForNewShift() {
    Object.values(_stations).forEach(st => { st.cooking = false; st.ready = false; _hideReady(st); });
  }
  function rebuildForTier(tier) { _init(tier); }

  window.addEventListener('dk:sceneReady',     () => _init(_kitchenTier));
  window.addEventListener('dk:kitchenRebuilt', (ev) => _init(ev.detail.tier));
  window.addEventListener('dk:relayout',       () => _relayout());

  return { getStations, startCooking, isReady, isCooking, pickUp, getUpgradeCost,
    upgradeStation, updateUpgradeIcons, setCookStations, resetForNewShift, rebuildForTier };
})();

window.STATION_MGR = StationManager;
