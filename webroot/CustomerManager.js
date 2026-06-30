// webroot/CustomerManager.js — FRONT-FACING customers behind the service counter.
// Each has a paper order ticket (item icons + checkmarks) and a patience bar.
// Orders assemble incrementally so the player AND auto-waiters can both fill them.

const CustomerManager = (() => {
  const _customers = {};
  let _cid = 0;
  let _spawnTimer = null;
  let _kitchenTier = 1;
  let _difficulty = 1;
  let _paused = false, _pauseAt = 0;
  let _rush = false;
  const SLOTS = 4;

  function _scene() { return window.CHEF_SCENE; }

  function startSpawning(tier, difficulty) {
    _kitchenTier = tier; _difficulty = difficulty || 1; _paused = false; _rush = false;
    stopSpawning(); _scheduleNext(900);
  }
  function stopSpawning() { if (_spawnTimer) { clearTimeout(_spawnTimer); _spawnTimer = null; } }

  function _scheduleNext(forced) {
    let base = SPAWN_INTERVAL_MS / Math.pow(_difficulty, 0.4);
    if (_rush) base *= RUSH_SPAWN_FACTOR;     // customers pour in during a rush
    const delay = forced != null ? forced : base * 0.7 + Math.random() * base * 0.6;
    _spawnTimer = window.setTimeout(() => {
      if (getCustomers().length < SLOTS) _spawnOne();
      _scheduleNext();
    }, delay);
  }

  // Rush Hour — driven by ChefController's shift clock.
  function startRush() {
    if (_paused) return;
    _rush = true;
    stopSpawning(); _scheduleNext(200);       // immediately ramp the queue
  }
  function endRush() { _rush = false; }
  function isRushing() { return _rush; }

  function _spawnOne() {
    if (!_scene()) return;
    const pool = ORDER_POOLS[Math.min(5, _kitchenTier)] || ORDER_POOLS[1];
    const order = pool[Math.floor(Math.random() * pool.length)].slice();

    const used = new Set(getCustomers().map(c => c.slot));
    const free = [];
    for (let i = 0; i < SLOTS; i++) if (!used.has(i)) free.push(i);
    if (!free.length) return;
    const slot = free[Math.floor(Math.random()*free.length)];

    const roll = Math.random();
    const type = roll < 0.07 ? 'critic' : roll < 0.16 ? 'vip' : roll < 0.34 ? 'impatient' : 'regular';
    const patience = (CUSTOMER_PATIENCE[type] || 32000) / Math.pow(_difficulty, 0.3);

    const id = 'c' + (++_cid);
    const style = DrawChar.randomStyle(_cid);
    if (type === 'vip') { style.accessory = 'crown'; style.shirt = 0x7e57c2; style.shirtDark = 0x4527a0; }
    if (type === 'critic') { style.accessory = 'glasses'; style.shirt = 0x1f2937; style.shirtDark = 0x0b1220; }
    const cust = {
      id, slot, order, type, delivered: order.map(() => false),
      served: false, leaving: false, spawnedAt: Date.now(), patienceMs: patience,
      mood: 'happy', style,
    };
    _customers[id] = cust;
    _drawCustomer(cust);
    // entrance pop
    if (cust.objs.group) _scene().tweens.add({ targets: cust.objs.group, alpha: { from: 0, to: 1 }, duration: 250 });

    cust._walkout = window.setTimeout(() => {
      if (!cust.served && !cust.leaving) {
        window.dispatchEvent(new CustomEvent('dk:custWalkout', { detail: { id } }));
        _leave(cust, false);
      }
    }, patience);
  }

  // Pause/resume freezes patience (timers + bars) while the shop is open mid-shift.
  function pause() {
    if (_paused) return;
    _paused = true; _pauseAt = Date.now();
    Object.values(_customers).forEach(c => { if (c._walkout) { clearTimeout(c._walkout); c._walkout = null; } });
    stopSpawning();
  }
  function resume() {
    if (!_paused) return;
    const d = Date.now() - _pauseAt; _paused = false;
    Object.values(_customers).forEach(c => {
      if (c.served || c.leaving) return;
      c.spawnedAt += d;
      const rem = Math.max(0, c.patienceMs - (Date.now() - c.spawnedAt));
      c._walkout = window.setTimeout(() => {
        if (!c.served && !c.leaving) { window.dispatchEvent(new CustomEvent('dk:custWalkout', { detail: { id: c.id } })); _leave(c, false); }
      }, rem);
    });
    _scheduleNext();
  }

  function _slot(cust) { return _scene().customerSlot(cust.slot, SLOTS); }

  function _drawCustomer(cust) {
    const scene = _scene(); if (!scene) return;
    const s = _slot(cust);
    const cx = s.cx, hy = s.headCY, w = Math.min(s.w, 100);
    const ledge = scene.diningH;
    const objs = {};

    objs.body = scene.add.graphics().setDepth(11);
    DrawChar.body(objs.body, cx, hy, w, ledge - 2, cust.style);

    objs.face = scene.add.graphics().setDepth(12);
    objs._cx = cx; objs._hy = hy; objs._w = w;
    DrawChar.face(objs.face, cx, hy, w, 'happy');

    objs.ticket = scene.add.graphics().setDepth(14);
    objs._emo = []; objs._chk = [];
    _drawTicket(scene, cust, objs, cx, s.ticketCY, w);
    objs.bar = scene.add.graphics().setDepth(15);

    // special-customer badge floating above the head (VIP / food critic)
    if (cust.type === 'vip' || cust.type === 'critic') {
      const isCrit = cust.type === 'critic';
      objs.badge = scene.add.text(cx, hy - w * 0.62, isCrit ? '🎩 CRITIC' : '👑 VIP', {
        fontSize: Math.max(9, Math.round(w * 0.16)) + 'px', fontStyle: 'bold',
        color: '#fff', stroke: isCrit ? '#7c2d12' : '#6d28d9', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(16);
      scene.tweens.add({ targets: objs.badge, y: objs.badge.y - 3, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    objs.group = [objs.body, objs.face, objs.ticket, objs.bar];
    if (objs.badge) objs.group.push(objs.badge);
    objs._hitW = w * 1.2; objs._hitTop = hy - w * 0.5; objs._hitBot = ledge + w * 0.1;
    cust.objs = objs;
  }

  function _drawFace(cust, o, mood) { DrawChar.face(o.face, o._cx, o._hy, o._w, mood); }

  function _drawTicket(scene, cust, o, cx, ty, w) {
    const n = cust.order.length, cell = Math.max(22, w * 0.34);
    const tw = n * cell + 16, th = cell + 14;
    const g = o.ticket; g.clear();
    g.fillStyle(0x000000, 0.14); g.fillRoundedRect(cx - tw/2 + 2, ty + 2, tw, th, 8);
    g.fillStyle(0xfffaf0, 1); g.fillRoundedRect(cx - tw/2, ty, tw, th, 8);
    g.fillStyle(cust.style.shirt, 1); g.fillRoundedRect(cx - tw/2, ty, tw, 5, { tl:8, tr:8, bl:0, br:0 });
    g.lineStyle(1.5, 0xe7d8c0, 1); g.strokeRoundedRect(cx - tw/2, ty, tw, th, 8);
    // speech tail toward head
    g.fillStyle(0xfffaf0, 1); g.fillTriangle(cx - 7, ty + th, cx + 7, ty + th, cx, ty + th + 10);
    cust.order.forEach((type, i) => {
      const ex = cx - (n*cell)/2 + i*cell + cell/2, ey = ty + th/2 + 2;
      if (!o._emo[i]) o._emo[i] = scene.add.text(ex, ey, DISHES[type]?.emoji || '?',
        { fontSize: Math.round(cell*0.62) + 'px' }).setOrigin(0.5).setDepth(15);
      o._emo[i].setPosition(ex, ey).setAlpha(cust.delivered[i] ? 0.25 : 1);
      if (cust.delivered[i] && !o._chk[i]) o._chk[i] = scene.add.text(ex + cell*0.22, ey - cell*0.22, '✅',
        { fontSize: Math.round(cell*0.4) + 'px' }).setOrigin(0.5).setDepth(16);
    });
  }

  // patience + mood tick
  setInterval(() => {
    if (_paused) return;
    const now = Date.now();
    Object.values(_customers).forEach(c => {
      if (c.served || c.leaving || !c.objs?.bar) return;
      const o = c.objs, s = _slot(c);
      const pct = Math.max(0, 1 - (now - c.spawnedAt) / c.patienceMs);
      const col = pct > 0.6 ? 0x22c55e : pct > 0.3 ? 0xf59e0b : 0xef4444;
      const bw = o._w * 0.7, bx = o._cx - bw/2, by = s.ticketCY - 9;
      o.bar.clear();
      o.bar.fillStyle(0x000000, 0.18); o.bar.fillRoundedRect(bx, by, bw, 5, 2);
      o.bar.fillStyle(col, 1); o.bar.fillRoundedRect(bx, by, bw * pct, 5, 2);
      const mood = pct > 0.6 ? 'happy' : pct > 0.35 ? 'neutral' : pct > 0.15 ? 'worried' : 'angry';
      if (mood !== c.mood) { c.mood = mood; _drawFace(c, o, mood); }
    });
  }, 60);

  function _leave(cust, served) {
    if (cust.leaving) return;
    cust.leaving = true;
    const o = cust.objs || {}, scene = _scene();
    const targets = [...(o.group || []), ...(o._emo || []), ...(o._chk || [])].filter(Boolean);
    if (scene && targets.length) scene.tweens.add({ targets, alpha: 0, y: '-=12', duration: 300, onComplete: () => _destroy(cust.id) });
    else _destroy(cust.id);
    if (!served && scene) { const s = _slot(cust); scene.showFloatText(s.cx, s.headCY - s.w*0.4, '😤 Left!', '#ef4444', 13); }
  }
  function _destroy(id) {
    const c = _customers[id];
    if (c?.objs) {
      if (c.objs._glowTween) { try { c.objs._glowTween.remove(); } catch (_) {} }
      Object.values(c.objs).forEach(o => { if (o && o.destroy) try { o.destroy(); } catch (_) {} });
      (c.objs._emo || []).forEach(o => { try { o?.destroy?.(); } catch (_) {} });
      (c.objs._chk || []).forEach(o => { try { o?.destroy?.(); } catch (_) {} });
    }
    delete _customers[id];
  }

  function _relayout() {
    Object.values(_customers).forEach(c => { if (!c.leaving) { _destroyKeep(c); _drawCustomer(c); } });
  }
  function _destroyKeep(c) {
    if (c?.objs) {
      Object.values(c.objs).forEach(o => { if (o && o.destroy) try { o.destroy(); } catch (_) {} });
      (c.objs._emo || []).forEach(o => { try { o?.destroy?.(); } catch (_) {} });
      (c.objs._chk || []).forEach(o => { try { o?.destroy?.(); } catch (_) {} });
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  function getCustomers() { return Object.values(_customers).filter(c => !c.served && !c.leaving); }
  function getServePoint(id) {
    const c = _customers[id]; if (!c) return null;
    const s = _slot(c); return { x: s.cx, y: s.headCY, slot: c.slot };
  }
  function customerNeeds(id, dish) {
    const c = _customers[id]; if (!c || c.served || c.leaving) return false;
    return c.order.some((t, i) => t === dish && !c.delivered[i]);
  }
  function matchesOrder(id, held) {
    const c = _customers[id]; if (!c) return false;
    return c.order.some((t, i) => !c.delivered[i] && held.includes(t));
  }
  function customerAt(x, y) {
    return getCustomers().find(c => {
      const o = c.objs; if (!o) return false;
      return Math.abs(x - o._cx) <= o._hitW / 2 && y >= o._hitTop && y <= o._hitBot;
    }) || null;
  }

  function _clearCustGlow(c) {
    const o = c.objs; if (!o) return;
    if (o._glowTween) { o._glowTween.remove(); o._glowTween = null; }
    if (o.glow) { o.glow.clear(); o.glow.setVisible(false); }
  }
  function setServeHighlight(item) {
    const scene = _scene(); if (!scene || !ITEMS[item]?.dish) { clearServeHighlight(); return; }
    getCustomers().forEach(c => {
      const o = c.objs; if (!o) return;
      if (customerNeeds(c.id, item)) {
        if (!o.glow) { o.glow = scene.add.graphics().setDepth(9); o.group.push(o.glow); }
        o.glow.clear();
        o.glow.fillStyle(0x22c55e, 0.16); o.glow.fillCircle(o._cx, o._hy, o._w * 0.52);
        o.glow.lineStyle(4, 0x22c55e, 0.95); o.glow.strokeCircle(o._cx, o._hy, o._w * 0.52);
        o.glow.setVisible(true).setAlpha(0.6);
        if (!o._glowTween) o._glowTween = scene.tweens.add({ targets: o.glow, alpha: 1, duration: 380, yoyo: true, repeat: -1 });
      } else _clearCustGlow(c);
    });
  }
  function clearServeHighlight() { Object.values(_customers).forEach(_clearCustGlow); }
  function deliverItem(id, dish) {
    const c = _customers[id];
    if (!c || c.served || c.leaving) return { accepted: false };
    const idx = c.order.findIndex((t, i) => t === dish && !c.delivered[i]);
    if (idx < 0) return { accepted: false };
    c.delivered[idx] = true;
    _drawTicket(_scene(), c, c.objs, c.objs._cx, _slot(c).ticketCY, c.objs._w);
    const complete = c.delivered.every(Boolean);
    let baseEarned = 0, speedFactor = 0;
    if (complete) {
      c.served = true;
      const elapsed = Date.now() - c.spawnedAt;
      speedFactor = Math.max(0, 1 - elapsed / c.patienceMs);
      const base = c.order.reduce((s, t) => s + (DISHES[t]?.coins || 5), 0);
      baseEarned = Math.ceil(base * (CUSTOMER_PAY_MULT[c.type] || 1) * (1 + speedFactor * TIP_SPEED_BONUS));
      window.dispatchEvent(new CustomEvent('dk:custServed', { detail: { id, type: c.type } }));
      if (_scene()) _scene().tweens.add({ targets: c.objs.head, y: '-=8', duration: 130, yoyo: true });
      _leave(c, true);
    }
    return { accepted: true, complete, speedFactor, baseEarned, slot: c.slot, order: c.order.slice(), custType: c.type };
  }
  function resetForNewShift() { Object.keys(_customers).forEach(_destroy); stopSpawning(); }

  window.addEventListener('dk:relayout', _relayout);
  window.addEventListener('dk:rushStart', startRush);
  window.addEventListener('dk:rushEnd', endRush);

  return { startSpawning, stopSpawning, pause, resume, getCustomers, customerAt, getServePoint, customerNeeds, matchesOrder, deliverItem, setServeHighlight, clearServeHighlight, resetForNewShift, startRush, endRush, isRushing };
})();

window.CUSTOMER_MGR = CustomerManager;
