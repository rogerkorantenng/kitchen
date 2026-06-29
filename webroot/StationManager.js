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
  let _cookSet = new Set(); // station ids that have a hired cook (they don't burn)
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
      _list.push({
        id: defId + '#' + counts[defId], defId, kind: def.kind, def,
        slotIndex: i, level: _levels[defId + '#' + counts[defId]] || 0,
        state: 'idle', item: null, output: null, cookStart: 0,
        contents: [], dish: null, objs: {},
      });
    });
    // draw AFTER the list is fully built so gridSlots(_list.length) is the final size
    _list.forEach(_draw);
  }
  function _relayout() { _list.forEach(inst => { _destroy(inst); _draw(inst); }); }

  function _slot(inst) { return _scene().gridSlots(_list.length)[inst.slotIndex]; }

  // ── Drawing ─────────────────────────────────────────────────────────────────
  function _draw(inst) {
    const scene = _scene(); if (!scene) return;
    const s = _slot(inst);
    inst._cx = s.cx; inst._cy = s.cy; inst._w = s.w; inst._h = s.h;
    const o = {};
    o.glow = scene.add.graphics().setDepth(18).setVisible(false);
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
    o.burn = scene.add.graphics().setDepth(24).setVisible(false);
    inst.objs = o;
    _refresh(inst);
  }

  function _drawBody(g, inst) {
    const { _cx: cx, _cy: cy, _w: w, _h: h } = inst;
    g.fillStyle(0x000000, 0.14); g.fillEllipse(cx, cy + h*0.46, w*0.92, h*0.16);
    if (inst.defId === 'grill') _artGrill(g, cx, cy, w, h);
    else if (inst.defId === 'fryer') _artFryer(g, cx, cy, w, h);
    else if (inst.defId === 'coffee') _artCoffee(g, cx, cy, w, h);
    else if (inst.defId === 'soda') _artSoda(g, cx, cy, w, h);
    else if (inst.kind === 'bin') _artBin(g, cx, cy, w, h);
    else if (inst.kind === 'plate') _artPlate(g, cx, cy, w, h);
    else _artGeneric(g, inst, cx, cy, w, h);
  }

  function _artBin(g, cx, cy, w, h) {
    const L = cx - w/2, T = cy - h/2;
    g.fillStyle(0x8a5a30, 1); g.fillRoundedRect(L + w*0.08, T + h*0.28, w*0.84, h*0.6, 8);
    g.fillStyle(0xa9743f, 1); g.fillRoundedRect(L + w*0.08, T + h*0.28, w*0.84, h*0.16, 8);
    g.fillStyle(0x000000, 0.12);
    for (let i = 1; i < 4; i++) g.fillRect(L + w*0.08 + w*0.84*i/4, T + h*0.3, 2, h*0.56);
    g.fillStyle(0xfff3d6, 0.9); g.fillRoundedRect(L + w*0.2, T + h*0.12, w*0.6, h*0.2, 6);
  }
  function _artPlate(g, cx, cy, w, h) {
    g.fillStyle(0xd8dde3, 1); g.fillEllipse(cx, cy + h*0.16, w*0.86, h*0.3);
    g.fillStyle(0xffffff, 1); g.fillEllipse(cx, cy + h*0.1, w*0.78, h*0.26);
    g.fillStyle(0xeef1f4, 1); g.fillEllipse(cx, cy + h*0.07, w*0.5, h*0.16);
  }
  function _artGeneric(g, inst, cx, cy, w, h) {
    const L = cx - w/2, T = cy - h/2, col = inst.def.color || 0x9aa3ac;
    g.fillStyle(0x9aa3ac, 1); g.fillRoundedRect(L, cy - h*0.06, w, h*0.56, 8);
    g.fillStyle(col, 1); g.fillRoundedRect(L + w*0.06, T + h*0.06, w*0.88, h*0.4, 7);
  }

  // ── Realistic appliances ─────────────────────────────────────────────────────
  function _artGrill(g, cx, cy, w, h) {
    const L = cx - w/2, R = cx + w/2, T = cy - h/2;
    // legs
    g.fillStyle(0x222222, 1); g.fillRect(L + w*0.16, cy + h*0.22, w*0.05, h*0.28); g.fillRect(R - w*0.21, cy + h*0.22, w*0.05, h*0.28);
    // charcoal body
    g.fillStyle(0x383838, 1); g.fillRoundedRect(L + w*0.06, cy - h*0.16, w*0.88, h*0.42, 6);
    g.fillStyle(0x2a2a2a, 1); g.fillRoundedRect(L + w*0.06, cy + h*0.08, w*0.88, h*0.18, 6);
    // ember trough
    g.fillStyle(0xff5a1f, 0.95); g.fillRoundedRect(L + w*0.1, cy - h*0.13, w*0.8, h*0.16, 4);
    g.fillStyle(0xffd24a, 0.8); g.fillRoundedRect(L + w*0.16, cy - h*0.11, w*0.68, h*0.07, 3);
    // flames between grates
    g.fillStyle(0xff8c1a, 0.9);
    for (let i = 0; i < 5; i++) { const fx = L + w*0.2 + i*w*0.15; g.fillTriangle(fx - w*0.045, cy - h*0.14, fx + w*0.045, cy - h*0.14, fx, cy - h*0.32); }
    // chrome rim
    g.fillStyle(0xb8c0c8, 1); g.fillRoundedRect(L + w*0.04, cy - h*0.22, w*0.92, h*0.05, 3);
    // grates (bars)
    g.fillStyle(0x4a4a4a, 1);
    for (let i = 0; i < 6; i++) { const gx = L + w*0.12 + i*w*0.135; g.fillRoundedRect(gx, cy - h*0.2, w*0.055, h*0.45, 2); }
    g.fillStyle(0xffffff, 0.12);
    for (let i = 0; i < 6; i++) { const gx = L + w*0.12 + i*w*0.135; g.fillRect(gx, cy - h*0.2, w*0.02, h*0.45); }
    // side handle
    g.lineStyle(Math.max(2, w*0.035), 0x888888, 1); g.beginPath(); g.moveTo(R - w*0.04, cy - h*0.02); g.lineTo(R + w*0.02, cy - h*0.02); g.strokePath();
  }
  function _artFryer(g, cx, cy, w, h) {
    const L = cx - w/2, R = cx + w/2, T = cy - h/2;
    g.fillStyle(0xc7ced4, 1); g.fillRoundedRect(L + w*0.06, cy - h*0.2, w*0.88, h*0.66, 6);   // stainless body
    g.fillStyle(0xe6ebef, 1); g.fillRoundedRect(L + w*0.06, cy - h*0.2, w*0.88, h*0.1, 6);     // top sheen
    g.fillStyle(0xaab2b9, 1); g.fillRoundedRect(L + w*0.06, cy + h*0.2, w*0.88, h*0.26, 6);    // lower
    g.fillStyle(0x6b6b6b, 1); g.fillRoundedRect(L + w*0.12, cy - h*0.18, w*0.76, h*0.3, 4);    // vat
    g.fillStyle(0xe8b23a, 1); g.fillRoundedRect(L + w*0.14, cy - h*0.16, w*0.72, h*0.24, 3);   // oil
    g.fillStyle(0xffd76a, 0.85); g.fillEllipse(cx, cy - h*0.08, w*0.5, h*0.06);                // sheen
    g.fillStyle(0xfff0b0, 0.85); g.fillCircle(cx - w*0.1, cy - h*0.04, w*0.028); g.fillCircle(cx + w*0.12, cy - h*0.02, w*0.022); g.fillCircle(cx, cy - h*0.06, w*0.018);
    // basket handles
    g.lineStyle(Math.max(2, w*0.04), 0x8a9097, 1);
    g.beginPath(); g.moveTo(cx - w*0.16, cy - h*0.16); g.lineTo(cx - w*0.28, cy - h*0.42); g.strokePath();
    g.beginPath(); g.moveTo(cx + w*0.16, cy - h*0.16); g.lineTo(cx + w*0.28, cy - h*0.42); g.strokePath();
    g.fillStyle(0x5b5b5b, 1); g.fillRoundedRect(cx - w*0.34, cy - h*0.46, w*0.12, h*0.05, 2); g.fillRoundedRect(cx + w*0.22, cy - h*0.46, w*0.12, h*0.05, 2);
    // control panel
    g.fillStyle(0x2b2f36, 1); g.fillRoundedRect(L + w*0.14, cy + h*0.24, w*0.72, h*0.14, 3);
    g.fillStyle(0xff5252, 1); g.fillCircle(L + w*0.24, cy + h*0.31, w*0.032);
    g.fillStyle(0x9aa3ac, 1); g.fillCircle(R - w*0.22, cy + h*0.31, w*0.045); g.fillStyle(0x2b2f36, 1); g.fillRect(R - w*0.225, cy + h*0.27, w*0.012, h*0.05);
  }
  function _artCoffee(g, cx, cy, w, h) {
    const L = cx - w/2, R = cx + w/2, T = cy - h/2;
    g.fillStyle(0x5a3725, 1); g.fillRoundedRect(L + w*0.1, cy - h*0.22, w*0.8, h*0.68, 6);     // body
    g.fillStyle(0x6f4632, 1); g.fillRoundedRect(L + w*0.1, cy - h*0.22, w*0.8, h*0.14, 6);
    g.fillStyle(0xcfd6dd, 1); g.fillRoundedRect(L + w*0.08, cy - h*0.3, w*0.84, h*0.12, 5);     // chrome top
    g.fillStyle(0xeef2f5, 1); g.fillRoundedRect(L + w*0.12, cy - h*0.28, w*0.4, h*0.04, 2);
    g.fillStyle(0x9aa3ac, 1); g.fillRoundedRect(cx - w*0.1, cy - h*0.04, w*0.2, h*0.1, 2);      // group head
    g.fillStyle(0x6b6b6b, 1); g.fillRect(cx - w*0.03, cy + h*0.04, w*0.06, h*0.06);             // spout
    g.fillStyle(0xffffff, 1); g.fillRoundedRect(cx - w*0.08, cy + h*0.12, w*0.16, h*0.12, { tl:2, tr:2, bl:6, br:6 }); // cup
    g.lineStyle(Math.max(2, w*0.03), 0xffffff, 1); g.strokeCircle(cx + w*0.12, cy + h*0.18, w*0.05);
    g.fillStyle(0x6f4e37, 1); g.fillEllipse(cx, cy + h*0.13, w*0.14, h*0.03);
    g.lineStyle(Math.max(2, w*0.03), 0x9aa3ac, 1); g.beginPath(); g.moveTo(R - w*0.14, cy - h*0.04); g.lineTo(R - w*0.07, cy + h*0.08); g.strokePath(); // steam wand
    g.fillStyle(0x2b2f36, 1); g.fillCircle(L + w*0.2, cy, w*0.03); g.fillStyle(0x22c55e, 1); g.fillCircle(L + w*0.2, cy, w*0.014);
    g.fillStyle(0xffffff, 1); g.fillCircle(L + w*0.27, cy, w*0.032); g.lineStyle(1.5, 0x2b2f36, 1); g.strokeCircle(L + w*0.27, cy, w*0.032);
  }
  function _artSoda(g, cx, cy, w, h) {
    const L = cx - w/2, R = cx + w/2, T = cy - h/2;
    g.fillStyle(0x0e7490, 1); g.fillRoundedRect(L + w*0.1, cy - h*0.24, w*0.8, h*0.7, 6);
    g.fillStyle(0x0891b2, 1); g.fillRoundedRect(L + w*0.1, cy - h*0.24, w*0.8, h*0.16, 6);
    g.fillStyle(0x67e8f9, 0.95); g.fillRoundedRect(L + w*0.16, cy - h*0.2, w*0.68, h*0.1, 3);   // display
    g.fillStyle(0x2b2f36, 1); [-0.2, 0, 0.2].forEach(o => g.fillRect(cx + o*w - w*0.015, cy, w*0.03, h*0.08));   // nozzles
    g.fillStyle(0x9aa3ac, 1); [-0.2, 0, 0.2].forEach(o => g.fillRoundedRect(cx + o*w - w*0.02, cy - h*0.08, w*0.04, h*0.06, 2)); // levers
    g.fillStyle(0xef4444, 1); g.fillRoundedRect(cx - w*0.08, cy + h*0.12, w*0.16, h*0.16, { tl:2, tr:2, bl:6, br:6 }); // cup
    g.fillStyle(0xffffff, 0.85); g.fillRect(cx - w*0.06, cy + h*0.15, w*0.12, h*0.04);
    [0xff6b6b, 0xffd93d, 0x6bcb77].forEach((c, i) => { g.fillStyle(c, 1); g.fillCircle(L + w*0.22 + i*w*0.1, cy + h*0.34, w*0.028); });
  }

  // round sesame burger bun (used for the Buns bin so it doesn't look like a loaf)
  function _drawBun(g, cx, cy, r) {
    g.fillStyle(0xc98a4e, 1); g.fillEllipse(cx, cy + r*0.5, r*2.1, r*0.7);
    g.fillStyle(0xe3a85f, 1); g.fillEllipse(cx, cy + r*0.05, r*2.0, r*1.25);
    g.fillStyle(0xf0c887, 1); g.fillEllipse(cx, cy - r*0.12, r*1.6, r*0.85);
    g.fillStyle(0xfff3da, 1);
    [[-0.45,-0.05],[0.05,-0.35],[0.5,0.0],[-0.1,0.12],[0.32,0.18]].forEach(([dx, dy]) => g.fillEllipse(cx + dx*r, cy + dy*r, r*0.22, r*0.13));
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
    if (o.burn) { o.burn.clear(); o.burn.setVisible(false); }
    _drawPips(inst);
    if (inst.kind === 'bin') {
      if (inst.defId === 'buns') {
        o.item.setVisible(false);
        const sc = _scene();
        if (sc) { if (!o.icon) o.icon = sc.add.graphics().setDepth(24); o.icon.clear(); _drawBun(o.icon, inst._cx, inst._cy - inst._h*0.16, inst._w*0.24); }
      } else {
        if (o.icon) o.icon.clear();
        o.item.setText(inst.def.emoji).setVisible(true).setY(inst._cy - inst._h*0.18);
      }
    } else if (inst.kind === 'plate') {
      if (inst.dish) { o.item.setText(ITEMS[inst.dish].emoji).setVisible(true); o.hint.setStroke('#16a34a', 3).setText('TAKE ✓').setVisible(true); }
      else if (inst.contents.length) o.item.setText(inst.contents.map(c => ITEMS[c].emoji).join('')).setVisible(true);
      else o.item.setText('').setVisible(false);
      o.item.setY(inst._cy - inst._h*0.06);
    } else { // cook / maker
      o.item.setY(inst._cy - inst._h*0.12);
      const scene = _scene();
      if (inst.state === 'burnt') {
        if (scene) scene.tweens.killTweensOf(o.item);
        o.item.setVisible(false);
        const cx = inst._cx, cy = inst._cy - inst._h*0.12, r = inst._w*0.17;
        o.burn.clear();
        o.burn.fillStyle(0x14110d, 1); o.burn.fillEllipse(cx, cy, r*2.1, r*1.3);
        o.burn.fillStyle(0x3a2a1a, 1); o.burn.fillEllipse(cx, cy - r*0.12, r*1.5, r*0.9);
        o.burn.fillStyle(0xff4500, 0.75); o.burn.fillCircle(cx - r*0.5, cy + r*0.1, r*0.2); o.burn.fillCircle(cx + r*0.55, cy, r*0.15);
        o.burn.setVisible(true);
        o.hint.setStroke('#b91c1c', 3).setText('🗑 BIN').setVisible(true);
      } else if (inst.state === 'ready') {
        const it = inst.kind === 'cook' ? inst.output : inst.def.makes;
        o.item.setText(ITEMS[it].emoji).setVisible(true);
        o.hint.setStroke('#16a34a', 3).setText('TAKE ✓').setVisible(true);
        if (scene) { scene.tweens.killTweensOf(o.item); scene.tweens.add({ targets: o.item, y: inst._cy - inst._h*0.28, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
      } else if (inst.state === 'cooking') {
        if (scene) scene.tweens.killTweensOf(o.item);
        o.item.setText(inst.kind === 'cook' ? ITEMS[inst.item].emoji : inst.def.emoji).setVisible(true).setY(inst._cy - inst._h*0.12);
      } else {
        if (scene) scene.tweens.killTweensOf(o.item);
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
  // how long a cooked dish can sit on the grill/fryer before it burns
  function _burnMs(inst) { return Math.max(4500, _cookMs(inst) * 1.7); }
  function _clearTimers(inst) { if (inst._burnTimer) { clearTimeout(inst._burnTimer); inst._burnTimer = null; } }

  // progress / burn / smoke tick
  setInterval(() => {
    _list.forEach(inst => {
      const o = inst.objs; if (!o.prog) return;
      const w = inst._w, x = inst._cx - w*0.42, y = inst._cy + inst._h*0.26, bw = w*0.84;
      if (inst.state === 'cooking') {
        const pct = Math.min((Date.now() - inst.cookStart) / _cookMs(inst), 1);
        o.prog.clear();
        o.prog.fillStyle(0x000000, 0.25); o.prog.fillRoundedRect(x, y, bw, 6, 3);
        o.prog.fillStyle(0xf97316, 1); o.prog.fillRoundedRect(x, y, bw*pct, 6, 3);
        if (pct > 0.25 && Math.random() < 0.14) _smoke(inst, '〰️', 0.7, 650);
      } else if (inst.state === 'ready' && inst.kind === 'cook' && inst._burnTimer) {
        // burn warning: green → orange → red as it approaches burning
        const pct = Math.min((Date.now() - (inst.readyAt || 0)) / _burnMs(inst), 1);
        const col = pct < 0.5 ? 0x22c55e : pct < 0.8 ? 0xf59e0b : 0xef4444;
        o.prog.clear();
        o.prog.fillStyle(0x000000, 0.25); o.prog.fillRoundedRect(x, y, bw, 6, 3);
        o.prog.fillStyle(col, 1); o.prog.fillRoundedRect(x, y, bw*pct, 6, 3);
        if (pct > 0.7 && Math.random() < 0.2) _smoke(inst, '💨', 0.5, 700);
      } else if (inst.state === 'burnt') {
        o.prog.clear();
        if (Math.random() < 0.25) _smoke(inst, '💨', 0.6, 850);
      } else {
        o.prog.clear();
      }
    });
  }, 60);
  function _smoke(inst, ch, alpha, dur) {
    const s = _scene()?.add.text(inst._cx + (Math.random()-0.5)*inst._w*0.4, inst._cy - inst._h*0.28, ch, { fontSize: Math.round(inst._w*0.18)+'px' }).setDepth(26).setAlpha(alpha);
    if (s) _scene().tweens.add({ targets: s, y: s.y - 26, alpha: 0, duration: dur, onComplete: () => s.destroy() });
  }

  function _finish(inst) {
    inst.state = 'ready'; inst.readyAt = Date.now();
    _refresh(inst);
    window.SFX?.ready();
    const o = inst.objs, scene = _scene();
    if (o.body && scene) scene.tweens.add({ targets: o.body, scaleX: 1.06, scaleY: 1.06, duration: 110, yoyo: true });
    // cook stations burn if a finished dish is left too long — but a hired cook tends it
    if (inst.kind === 'cook' && !_cookSet.has(inst.id)) {
      _clearTimers(inst);
      inst._burnTimer = window.setTimeout(() => {
        if (inst.state === 'ready') {
          inst.state = 'burnt'; _refresh(inst);
          window.SFX?.fail();
          window.dispatchEvent(new CustomEvent('dk:burnt', { detail: { id: inst.id } }));
        }
      }, _burnMs(inst));
    }
  }

  // ── Drop-target highlighting (during drag) ───────────────────────────────────
  function _canAccept(inst, item) {
    if (inst.kind === 'cook') return inst.state === 'idle' && inst.def.accepts && !!inst.def.accepts[item];
    if (inst.kind === 'plate') return !inst.dish && inst.contents.length < 3 && !ITEMS[item]?.dish;
    return false;
  }
  function _clearGlow(inst) {
    const o = inst.objs; if (!o.glow) return;
    if (o._glowTween) { o._glowTween.remove(); o._glowTween = null; }
    o.glow.clear(); o.glow.setAlpha(1).setVisible(false);
  }
  function setDropHighlight(item) {
    const scene = _scene();
    _list.forEach(inst => {
      const o = inst.objs; if (!o.glow) return;
      if (_canAccept(inst, item)) {
        const x = inst._cx - inst._w*0.6, y = inst._cy - inst._h*0.62, w = inst._w*1.2, h = inst._h*1.24;
        o.glow.clear();
        o.glow.fillStyle(0x22c55e, 0.22); o.glow.fillRoundedRect(x, y, w, h, 14);
        o.glow.lineStyle(3, 0x22c55e, 0.95); o.glow.strokeRoundedRect(x, y, w, h, 14);
        o.glow.setVisible(true).setAlpha(0.6);
        if (scene && !o._glowTween) o._glowTween = scene.tweens.add({ targets: o.glow, alpha: 1, duration: 380, yoyo: true, repeat: -1 });
      } else _clearGlow(inst);
    });
  }
  function clearDropHighlight() { _list.forEach(_clearGlow); }

  // ── Public model API ─────────────────────────────────────────────────────────
  function getStations() { return _list; }
  function stationAt(x, y) {
    return _list.find(i => Math.abs(x - i._cx) <= i._w*0.52 && Math.abs(y - i._cy) <= i._h*0.6) || null;
  }

  function startCook(inst, item) {
    if (inst.kind !== 'cook' || inst.state !== 'idle') return false;
    const out = inst.def.accepts && inst.def.accepts[item];
    if (!out) return false;
    inst.state = 'cooking'; inst.item = item; inst.output = out; inst.cookStart = Date.now();
    _refresh(inst); window.SFX?.sizzle();
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
    if (inst.state === 'burnt') {
      // bin the ruined food — clears the station, nothing useful picked up
      _clearTimers(inst);
      inst.state = 'idle'; inst.item = null; inst.output = null; _refresh(inst);
      _scene()?.showFloatText(inst._cx, inst._cy - inst._h*0.7, '🔥 Binned', '#ef4444', 12);
      window.SFX?.place();
      return null;
    }
    if (inst.state === 'ready') {
      const it = inst.kind === 'cook' ? inst.output : inst.def.makes;
      _clearTimers(inst);
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
        window.SFX?.assemble();
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
    _list.forEach(inst => { _clearTimers(inst); inst.state = 'idle'; inst.item = null; inst.output = null; inst.contents = []; inst.dish = null; _refresh(inst); });
  }
  function rebuildForTier(tier) { _init(tier); }
  function setCookStations(ids) { _cookSet = new Set(ids || []); }

  window.addEventListener('dk:sceneReady',     () => _init(_kitchenTier));
  window.addEventListener('dk:kitchenRebuilt', (ev) => _init(ev.detail.tier));
  window.addEventListener('dk:relayout',       () => _relayout());

  return { getStations, stationAt, startCook, startMake, takeFrom, putTo,
    servableSources, idleMakers, upgradableStations, getUpgradeCost, upgradeStation,
    setDropHighlight, clearDropHighlight, resetForNewShift, rebuildForTier, setCookStations };
})();

window.STATION_MGR = StationManager;
