// webroot/CustomerManager.js — FRONT-FACING customers behind the service counter.
// Each has a paper order ticket (item icons + checkmarks) and a patience bar.
// Orders assemble incrementally so the player AND auto-waiters can both fill them.

const CustomerManager = (() => {
  const _customers = {};
  let _cid = 0;
  let _spawnTimer = null;
  let _kitchenTier = 1;
  let _difficulty = 1;
  const SLOTS = 4;

  const STYLES = [
    { body:0xef5350, dark:0xc62828, hair:0x4a2800, skin:0xfdd9b5 },
    { body:0x42a5f5, dark:0x1565c0, hair:0x1a1a1a, skin:0xffe0b2 },
    { body:0x66bb6a, dark:0x2e7d32, hair:0x6d4c2b, skin:0xf6c89a },
    { body:0xab47bc, dark:0x6a1b9a, hair:0x2a1a05, skin:0xffd9b0 },
    { body:0xffa726, dark:0xe65100, hair:0x1a1a1a, skin:0xf3c79b },
    { body:0x26c6da, dark:0x00838f, hair:0x4a2800, skin:0xfdd9b5 },
    { body:0xec407a, dark:0xad1457, hair:0x1a1a1a, skin:0xffe0b2 },
  ];

  function _scene() { return window.CHEF_SCENE; }

  function startSpawning(tier, difficulty) {
    _kitchenTier = tier; _difficulty = difficulty || 1;
    stopSpawning(); _scheduleNext(900);
  }
  function stopSpawning() { if (_spawnTimer) { clearTimeout(_spawnTimer); _spawnTimer = null; } }

  function _scheduleNext(forced) {
    const base = SPAWN_INTERVAL_MS / Math.sqrt(_difficulty);
    const delay = forced != null ? forced : base * 0.7 + Math.random() * base * 0.6;
    _spawnTimer = window.setTimeout(() => {
      if (getCustomers().length < SLOTS) _spawnOne();
      _scheduleNext();
    }, delay);
  }

  function _spawnOne() {
    if (!_scene()) return;
    const pools = ['basic'];
    if (_kitchenTier >= 2) pools.push('full');
    if (_kitchenTier >= 4) pools.push('premium');
    const pool = COMBOS[pools[Math.floor(Math.random()*pools.length)]] || COMBOS.basic;
    const stationIds = (window.STATION_MGR?.getStations() || []).map(s => s.id);
    const valid = pool.filter(c => c.every(t => stationIds.includes(t)));
    if (!valid.length) return;
    const order = valid[Math.floor(Math.random()*valid.length)].slice();

    const used = new Set(getCustomers().map(c => c.slot));
    const free = [];
    for (let i = 0; i < SLOTS; i++) if (!used.has(i)) free.push(i);
    if (!free.length) return;
    const slot = free[Math.floor(Math.random()*free.length)];

    const roll = Math.random();
    const type = roll < 0.1 ? 'vip' : roll < 0.28 ? 'impatient' : 'regular';
    const patience = (CUSTOMER_PATIENCE[type] || 18000) / Math.sqrt(_difficulty);

    const id = 'c' + (++_cid);
    const cust = {
      id, slot, order, type, delivered: order.map(() => false),
      served: false, leaving: false, spawnedAt: Date.now(), patienceMs: patience,
      mood: 'happy', styleIdx: (_cid - 1) % STYLES.length,
    };
    _customers[id] = cust;
    _drawCustomer(cust);
    // entrance pop
    if (cust.objs.group) _scene().tweens.add({ targets: cust.objs.group, alpha: { from: 0, to: 1 }, duration: 250 });

    window.setTimeout(() => {
      if (!cust.served && !cust.leaving) {
        window.dispatchEvent(new CustomEvent('dk:custWalkout', { detail: { id } }));
        _leave(cust, false);
      }
    }, patience);
  }

  function _slot(cust) { return _scene().customerSlot(cust.slot, SLOTS); }

  function _drawCustomer(cust) {
    const scene = _scene(); if (!scene) return;
    const s = _slot(cust);
    const cx = s.cx, hy = s.headCY, w = Math.min(s.w, 96);
    const st = STYLES[cust.styleIdx];
    const objs = {};
    const ledge = scene.diningH;

    // torso (rises from behind the counter)
    const torso = scene.add.graphics().setDepth(10);
    torso.fillStyle(st.body, 1);
    torso.fillRoundedRect(cx - w*0.34, hy + w*0.16, w*0.68, ledge - (hy + w*0.16) + 4, 12);
    torso.fillStyle(0x000000, 0.07); torso.fillRoundedRect(cx + w*0.08, hy + w*0.16, w*0.26, ledge - (hy + w*0.16), 12);
    // shoulders/collar
    torso.fillStyle(st.dark, 1); torso.fillRoundedRect(cx - w*0.34, hy + w*0.16, w*0.68, w*0.1, 8);
    objs.torso = torso;

    // head
    const head = scene.add.graphics().setDepth(11);
    head.fillStyle(0x000000, 0.1); head.fillEllipse(cx, hy + w*0.26, w*0.5, w*0.12);
    head.fillStyle(st.skin, 1); head.fillCircle(cx, hy, w*0.3);
    head.fillStyle(st.hair, 1);
    head.fillRoundedRect(cx - w*0.3, hy - w*0.34, w*0.6, w*0.26, { tl:14, tr:14, bl:0, br:0 });
    head.fillRect(cx - w*0.3, hy - w*0.16, w*0.06, w*0.22);
    head.fillRect(cx + w*0.24, hy - w*0.16, w*0.06, w*0.22);
    // ears
    head.fillStyle(st.skin, 1);
    head.fillCircle(cx - w*0.3, hy, w*0.06); head.fillCircle(cx + w*0.3, hy, w*0.06);
    if (cust.type === 'vip') {
      head.fillStyle(0xfbbf24, 1);
      head.fillTriangle(cx - w*0.18, hy - w*0.34, cx, hy - w*0.52, cx + w*0.18, hy - w*0.34);
      head.fillCircle(cx, hy - w*0.52, w*0.04);
    }
    objs.head = head;

    objs.face = scene.add.graphics().setDepth(12);
    objs._cx = cx; objs._hy = hy; objs._w = w;
    _drawFace(cust, objs, 'happy');

    // order ticket + patience
    objs.ticket = scene.add.graphics().setDepth(14);
    objs._emo = []; objs._chk = [];
    _drawTicket(scene, cust, objs, cx, s.ticketCY, w);
    objs.bar = scene.add.graphics().setDepth(15);

    objs.group = [objs.torso, objs.head, objs.face, objs.ticket, objs.bar];
    // tap zone
    const zone = scene.add.zone(cx, (hy + ledge) / 2, w * 1.1, (ledge - hy) + w*0.6).setInteractive().setDepth(16);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:customerTapped', { detail: { id: cust.id } })));
    objs.zone = zone;

    cust.objs = objs;
  }

  function _drawFace(cust, o, mood) {
    const g = o.face, cx = o._cx, hy = o._hy, w = o._w;
    g.clear();
    g.fillStyle(0x2d1a08, 1);
    if (mood === 'angry') {
      g.fillRect(cx - w*0.16, hy - w*0.06, w*0.1, 3); g.fillRect(cx + w*0.06, hy - w*0.06, w*0.1, 3);
      g.fillCircle(cx - w*0.11, hy + w*0.0, w*0.045); g.fillCircle(cx + w*0.11, hy + w*0.0, w*0.045);
    } else {
      g.fillCircle(cx - w*0.11, hy - w*0.02, w*0.05); g.fillCircle(cx + w*0.11, hy - w*0.02, w*0.05);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(cx - w*0.095, hy - w*0.035, w*0.016); g.fillCircle(cx + w*0.125, hy - w*0.035, w*0.016);
      g.fillStyle(0x2d1a08, 1);
    }
    g.lineStyle(w*0.025, 0x2d1a08, 1); g.beginPath();
    if (mood === 'happy')        g.arc(cx, hy + w*0.1, w*0.11, 0.2, Math.PI - 0.2, false);
    else if (mood === 'neutral') { g.moveTo(cx - w*0.08, hy + w*0.13); g.lineTo(cx + w*0.08, hy + w*0.13); }
    else                          g.arc(cx, hy + w*0.2, w*0.1, Math.PI + 0.25, Math.PI*2 - 0.25, false);
    g.strokePath();
    if (mood === 'worried' || mood === 'angry') { g.fillStyle(0x60a5fa, 0.85); g.fillEllipse(cx + w*0.2, hy - w*0.08, w*0.05, w*0.08); }
  }

  function _drawTicket(scene, cust, o, cx, ty, w) {
    const n = cust.order.length, cell = Math.max(22, w * 0.34);
    const tw = n * cell + 16, th = cell + 14;
    const g = o.ticket; g.clear();
    g.fillStyle(0x000000, 0.14); g.fillRoundedRect(cx - tw/2 + 2, ty + 2, tw, th, 8);
    g.fillStyle(0xfffaf0, 1); g.fillRoundedRect(cx - tw/2, ty, tw, th, 8);
    const st = STYLES[cust.styleIdx];
    g.fillStyle(st.body, 1); g.fillRoundedRect(cx - tw/2, ty, tw, 5, { tl:8, tr:8, bl:0, br:0 });
    g.lineStyle(1.5, 0xe7d8c0, 1); g.strokeRoundedRect(cx - tw/2, ty, tw, th, 8);
    // speech tail toward head
    g.fillStyle(0xfffaf0, 1); g.fillTriangle(cx - 7, ty + th, cx + 7, ty + th, cx, ty + th + 10);
    cust.order.forEach((type, i) => {
      const ex = cx - (n*cell)/2 + i*cell + cell/2, ey = ty + th/2 + 2;
      if (!o._emo[i]) o._emo[i] = scene.add.text(ex, ey, STATIONS[type]?.emoji || '?',
        { fontSize: Math.round(cell*0.62) + 'px' }).setOrigin(0.5).setDepth(15);
      o._emo[i].setPosition(ex, ey).setAlpha(cust.delivered[i] ? 0.25 : 1);
      if (cust.delivered[i] && !o._chk[i]) o._chk[i] = scene.add.text(ex + cell*0.22, ey - cell*0.22, '✅',
        { fontSize: Math.round(cell*0.4) + 'px' }).setOrigin(0.5).setDepth(16);
    });
  }

  // patience + mood tick
  setInterval(() => {
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
      const base = c.order.reduce((s, t) => s + (STATIONS[t]?.baseCoins || 5), 0);
      baseEarned = Math.ceil(base * (CUSTOMER_PAY_MULT[c.type] || 1) * (1 + speedFactor * TIP_SPEED_BONUS));
      window.dispatchEvent(new CustomEvent('dk:custServed', { detail: { id, type: c.type } }));
      if (_scene()) _scene().tweens.add({ targets: c.objs.head, y: '-=8', duration: 130, yoyo: true });
      _leave(c, true);
    }
    return { accepted: true, complete, speedFactor, baseEarned, slot: c.slot, order: c.order.slice() };
  }
  function resetForNewShift() { Object.keys(_customers).forEach(_destroy); stopSpawning(); }

  window.addEventListener('dk:relayout', _relayout);

  return { startSpawning, stopSpawning, getCustomers, getServePoint, customerNeeds, matchesOrder, deliverItem, resetForNewShift };
})();

window.CUSTOMER_MGR = CustomerManager;
