// webroot/StationManager.js — FRONT-FACING kitchen with a real food-assembly model.
//   bin   → infinite source of a raw/base item (tap/drag to grab)
//   cook  → place a raw item; it cooks ON the machine into a cooked item
//   maker → tap to start; brews a finished drink (coffee / soda)
//   plate → drop items; matching combos auto-assemble into a finished dish
//
// Interaction is driven by ChefController via takeFrom()/putTo()/startMake().
// Stations expose their screen rect so the controller can hit-test taps & drags.

const StationManager = (() => {
  let _list = [];          // ordered station instances
  let _kitchenTier = 1;
  const _levels = {};      // stable id -> upgrade level (cook/maker speed)

  function _scene() { return window.CHEF_SCENE; }

  function _init(tier) {
    _kitchenTier = tier;
    _list.forEach(_destroy);
    _list = [];
    const ids = KITCHEN_STATIONS[tier] || KITCHEN_STATIONS[1];
    const counts = {};
    ids.forEach((defId, i) => {
      counts[defId] = (counts[defId] || 0) + 1;
      const def = STATION_DEFS[defId];
      const inst = {
        id: defId + '#' + counts[defId], defId, kind: def.kind, def,
        slotIndex: i, level: _levels[defId + '#' + counts[defId]] || 0,
        state: 'idle', item: null, output: null, cookStart: 0,
        contents: [], dish: null, objs: {},
      };
      _list.push(inst);
      _draw(inst);
    });
  }
  function _relayout() { _list.forEach(inst => { _destroy(inst); _draw(inst); }); }

  function _slot(inst) { return _scene().gridSlots(_list.length)[inst.slotIndex]; }

  // ── Drawing ─────────────────────────────────────────────────────────────────
  function _draw(inst) {
    const scene = _scene(); if (!scene) return;
    const s = _slot(inst);
    inst._cx = s.cx; inst._cy = s.cy; inst._w = s.w; inst._h = s.h;
    const o = {};
    o.body = scene.add.graphics().setDepth(20);
    _drawBody(o.body, inst);
    o.label = scene.add.text(s.cx, s.cy + s.h * 0.6, inst.def.label.toUpperCase(), {
      fontSize: Math.max(7, Math.round(s.w * 0.12)) + 'px', fontStyle: 'bold',
      color: '#5c3a1e', stroke: '#fff7ea', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22);
    o.item = scene.add.text(s.cx, s.cy - s.h * 0.1, '', { fontSize: Math.round(s.w * 0.4) + 'px' }).setOrigin(0.5).setDepth(24);
    o.hint = scene.add.text(s.cx, s.cy - s.h * 0.62, '', { fontSize: '9px', fontStyle: 'bold', color: '#fff', stroke: '#16a34a', strokeThickness: 3 }).setOrigin(0.5).setDepth(25).setVisible(false);
    o.prog = scene.add.graphics().setDepth(23);
    o.pips = scene.add.graphics().setDepth(22);
    inst.objs = o;
    _refresh(inst);
  }

  function _drawBody(g, inst) {
    const { _cx: cx, _cy: cy, _w: w, _h: h } = inst;
    const L = cx - w/2, T = cy - h/2;
    g.fillStyle(0x000000, 0.12); g.fillEllipse(cx, cy + h*0.46, w*0.92, h*0.16);
    if (inst.kind === 'bin') {
      g.fillStyle(0x8a5a30, 1); g.fillRoundedRect(L + w*0.08, T + h*0.28, w*0.84, h*0.6, 8);
      g.fillStyle(0xa9743f, 1); g.fillRoundedRect(L + w*0.08, T + h*0.28, w*0.84, h*0.16, 8);
      g.fillStyle(0x000000, 0.12);
      for (let i = 1; i < 4; i++) g.fillRect(L + w*0.08 + w*0.84*i/4, T + h*0.3, 2, h*0.56);
      g.fillStyle(0xfff3d6, 0.9); g.fillRoundedRect(L + w*0.2, T + h*0.12, w*0.6, h*0.2, 6); // ingredient tray
    } else if (inst.kind === 'plate') {
      g.fillStyle(0xd8dde3, 1); g.fillEllipse(cx, cy + h*0.16, w*0.86, h*0.3);
      g.fillStyle(0xffffff, 1); g.fillEllipse(cx, cy + h*0.1, w*0.78, h*0.26);
      g.fillStyle(0xeef1f4, 1); g.fillEllipse(cx, cy + h*0.07, w*0.5, h*0.16);
    } else {
      // cook / maker appliance
      const col = inst.def.color || 0x9aa3ac;
      g.fillStyle(0x9aa3ac, 1); g.fillRoundedRect(L, cy - h*0.06, w, h*0.56, 8);
      g.fillStyle(0xb6bec6, 1); g.fillRoundedRect(L, cy - h*0.06, w, h*0.16, 8);
      const c = Phaser.Display.Color.IntegerToColor(col);
      g.fillStyle(col, 1); g.fillRoundedRect(L + w*0.06, T + h*0.06, w*0.88, h*0.4, 7);
      g.fillStyle(0xffffff, 0.18); g.fillRoundedRect(L + w*0.1, T + h*0.1, w*0.8, h*0.12, 5);
      if (inst.kind === 'cook') {
        g.lineStyle(2, 0x000000, 0.25);
        for (let i = 1; i < 5; i++) { const gx = L + w*0.1 + w*0.8*i/5; g.lineBetween(gx, T+h*0.12, gx, T+h*0.42); }
      } else { // maker spout + cups
        g.fillStyle(0x2b2f36, 1); g.fillRect(cx - w*0.04, T + h*0.42, w*0.08, h*0.1);
        g.fillStyle(0xffffff, 0.8); g.fillRoundedRect(cx - w*0.16, T + h*0.5, w*0.1, h*0.08, 2); g.fillRoundedRect(cx + w*0.06, T + h*0.5, w*0.1, h*0.08, 2);
      }
    }
    // emoji badge (what this station is)
    if (inst.kind === 'bin') { /* big ingredient shown via item layer */ }
  }

  function _drawPips(inst) {
    const g = inst.objs.pips; if (!g) return; g.clear();
    if (inst.kind !== 'cook' && inst.kind !== 'maker') return;
    const { _cx: cx, _cy: cy, _w: w, _h: h } = inst;
    const n = 3, pw = w*0.1, gap = pw*0.4, total = n*pw + (n-1)*gap;
    let x = cx - total/2; const y = cy + h*0.38;
    for (let i = 0; i < n; i++) { g.fillStyle(i < inst.level ? 0xf97316 : 0x000000, i < inst.level ? 1 : 0.16); g.fillRoundedRect(x, y, pw, pw*0.5, 2); x += pw + gap; }
  }

  function _refresh(inst) {
    const o = inst.objs; if (!o.item) return;
    o.hint.setVisible(false); o.prog.clear();
    _drawPips(inst);
    if (inst.kind === 'bin') {
      o.item.setText(inst.def.emoji).setVisible(true).setY(inst._cy - inst._h*0.18);
    } else if (inst.kind === 'plate') {
      if (inst.dish) { o.item.setText(ITEMS[inst.dish].emoji).setVisible(true); o.hint.setText('TAKE ✓').setVisible(true); }
      else if (inst.contents.length) o.item.setText(inst.contents.map(c => ITEMS[c].emoji).join('')).setVisible(true);
      else o.item.setText('').setVisible(false);
      o.item.setY(inst._cy - inst._h*0.06);
    } else { // cook / maker
      o.item.setY(inst._cy - inst._h*0.12);
      if (inst.state === 'ready') {
        const it = inst.kind === 'cook' ? inst.output : inst.def.makes;
        o.item.setText(ITEMS[it].emoji).setVisible(true);
        o.hint.setText('TAKE ✓').setVisible(true);
        const scene = _scene();
        if (scene) { scene.tweens.killTweensOf(o.item); scene.tweens.add({ targets: o.item, y: inst._cy - inst._h*0.28, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
      } else if (inst.state === 'cooking') {
        o.item.setText(inst.kind === 'cook' ? ITEMS[inst.item].emoji : inst.def.emoji).setVisible(true);
      } else {
        const scene = _scene(); if (scene) scene.tweens.killTweensOf(o.item);
        o.item.setText(inst.kind === 'maker' ? inst.def.emoji : '').setVisible(inst.kind === 'maker').setY(inst._cy - inst._h*0.12);
      }
    }
  }

  function _destroy(inst) {
    if (!inst.objs) return;
    const scene = _scene();
    Object.values(inst.objs).forEach(o => { try { scene?.tweens?.killTweensOf(o); o?.destroy?.(); } catch (_) {} });
    inst.objs = {};
  }

  function _cookMs(inst) {
    let ms = (inst.def.time || 3000) * (window._cookSpeedMult || 1);
    if (inst.level >= 1) ms *= 0.8;
    if (inst.level >= 2) ms *= 0.8;
    return Math.max(350, ms);
  }

  // progress tick
  setInterval(() => {
    _list.forEach(inst => {
      const o = inst.objs; if (!o.prog || inst.state !== 'cooking') return;
      const pct = Math.min((Date.now() - inst.cookStart) / _cookMs(inst), 1);
      o.prog.clear();
      const w = inst._w, x = inst._cx - w*0.42, y = inst._cy + inst._h*0.26, bw = w*0.84;
      o.prog.fillStyle(0x000000, 0.25); o.prog.fillRoundedRect(x, y, bw, 6, 3);
      o.prog.fillStyle(0xf97316, 1); o.prog.fillRoundedRect(x, y, bw*pct, 6, 3);
      if (pct > 0.25 && Math.random() < 0.14) {
        const s = _scene()?.add.text(inst._cx + (Math.random()-0.5)*inst._w*0.4, inst._cy - inst._h*0.3, '〰️', { fontSize: Math.round(inst._w*0.16)+'px' }).setDepth(26).setAlpha(0.7);
        if (s) _scene().tweens.add({ targets: s, y: s.y - 22, alpha: 0, duration: 650, onComplete: () => s.destroy() });
      }
    });
  }, 60);

  function _finish(inst) {
    inst.state = 'ready';
    _refresh(inst);
  }

  // ── Public model API ─────────────────────────────────────────────────────────
  function getStations() { return _list; }
  function stationAt(x, y) {
    return _list.find(i => Math.abs(x - i._cx) <= i._w*0.6 && Math.abs(y - i._cy) <= i._h*0.75) || null;
  }

  function startCook(inst, item) {
    if (inst.kind !== 'cook' || inst.state !== 'idle') return false;
    const out = inst.def.accepts && inst.def.accepts[item];
    if (!out) return false;
    inst.state = 'cooking'; inst.item = item; inst.output = out; inst.cookStart = Date.now();
    _refresh(inst);
    window.setTimeout(() => { if (inst.state === 'cooking') _finish(inst); }, _cookMs(inst));
    return true;
  }
  function startMake(inst) {
    if (inst.kind !== 'maker' || inst.state !== 'idle') return false;
    inst.state = 'cooking'; inst.cookStart = Date.now();
    _refresh(inst);
    window.setTimeout(() => { if (inst.state === 'cooking') _finish(inst); }, _cookMs(inst));
    return true;
  }

  // remove & return an item that can be picked up here (null if none)
  function takeFrom(inst) {
    if (inst.kind === 'bin') return inst.def.gives;
    if (inst.kind === 'plate') {
      if (inst.dish) { const d = inst.dish; inst.dish = null; _refresh(inst); return d; }
      if (inst.contents.length) { const c = inst.contents.pop(); _refresh(inst); return c; }
      return null;
    }
    if (inst.state === 'ready') {
      const it = inst.kind === 'cook' ? inst.output : inst.def.makes;
      inst.state = 'idle'; inst.item = null; inst.output = null; _refresh(inst);
      return it;
    }
    return null;
  }

  // try to place `item` into a station; returns true if consumed
  function putTo(inst, item) {
    if (inst.kind === 'cook') return startCook(inst, item);
    if (inst.kind === 'plate') {
      if (inst.dish || inst.contents.length >= 3 || ITEMS[item]?.dish) return false;
      inst.contents.push(item);
      _checkRecipe(inst); _refresh(inst);
      return true;
    }
    return false;
  }

  function _checkRecipe(inst) {
    const have = inst.contents.slice().sort().join(',');
    for (const r of RECIPES) {
      if (r.need.slice().sort().join(',') === have) {
        inst.contents = []; inst.dish = r.makes;
        if (window.PARTICLE_FX) window.PARTICLE_FX.upgradeSlamBurst(inst._cx, inst._cy);
        _scene()?.showFloatText(inst._cx, inst._cy - inst._h*0.6, ITEMS[r.makes].emoji + '!', '#22c55e', 16);
        return;
      }
    }
  }

  // Finished dishes available to grab (for auto-waiters): plates with a dish + ready makers
  function servableSources() {
    const out = [];
    _list.forEach(inst => {
      if (inst.kind === 'plate' && inst.dish) out.push({ inst, dish: inst.dish });
      else if (inst.kind === 'maker' && inst.state === 'ready') out.push({ inst, dish: inst.def.makes });
      else if (inst.kind === 'cook' && inst.state === 'ready' && ITEMS[inst.output]?.dish) out.push({ inst, dish: inst.output });
    });
    return out;
  }
  function idleMakers() { return _list.filter(i => i.kind === 'maker' && i.state === 'idle'); }

  // ── Upgrades (cook/maker speed) ──────────────────────────────────────────────
  function upgradableStations() { return _list.filter(i => i.kind === 'cook' || i.kind === 'maker'); }
  function getUpgradeCost(instOrId) {
    const inst = typeof instOrId === 'string' ? _list.find(i => i.id === instOrId) : instOrId;
    if (!inst) return Infinity;
    const base = inst.kind === 'cook' ? 90 : 60;
    return Math.floor(base * Math.pow(1.9, inst.level));
  }
  function upgradeStation(id) {
    const inst = _list.find(i => i.id === id); if (!inst || inst.level >= 3) return;
    inst.level++; _levels[inst.id] = inst.level; _refresh(inst);
    if (window.PARTICLE_FX) window.PARTICLE_FX.upgradeSlamBurst(inst._cx, inst._cy);
  }

  function resetForNewShift() {
    _list.forEach(inst => { inst.state = 'idle'; inst.item = null; inst.output = null; inst.contents = []; inst.dish = null; _refresh(inst); });
  }
  function rebuildForTier(tier) { _init(tier); }
  function setCookStations() { /* badges handled by visible cook avatars */ }

  window.addEventListener('dk:sceneReady',     () => _init(_kitchenTier));
  window.addEventListener('dk:kitchenRebuilt', (ev) => _init(ev.detail.tier));
  window.addEventListener('dk:relayout',       () => _relayout());

  return { getStations, stationAt, startCook, startMake, takeFrom, putTo,
    servableSources, idleMakers, upgradableStations, getUpgradeCost, upgradeStation,
    resetForNewShift, rebuildForTier, setCookStations };
})();

window.STATION_MGR = StationManager;
