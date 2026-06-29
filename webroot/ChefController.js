// webroot/ChefController.js — the economy brain for the tap-to-cook game.
// Tap a station → cook / plate. Tap a customer → serve matching tray items.
// Owns coins, reputation, day/shift, the tray, and the shared deliverDish() used
// by both the player and the auto-staff.

const ChefController = (() => {
  let _tray = [];
  let _trayMax = CHEF_TRAY_BASE;
  let _coins = 0, _shiftCoins = 0, _served = 0;
  let _rep = 60, _day = 1, _kitchenTier = 1;
  let _shiftTimer = null, _shiftActive = false;
  let _cravings = [];
  let _staff = [];

  function _cravingMult(type) {
    const m = _cravings.find(c => {
      const cl = (c.category || '').toLowerCase();
      return cl === type ||
        (type === 'grill'  && cl === 'grilled') ||
        (type === 'fryer'  && (cl === 'street' || cl === 'fried')) ||
        (type === 'wok'    && (cl === 'comfort' || cl === 'noodles')) ||
        (type === 'bakery' && cl === 'baked') ||
        (type === 'smoker' && (cl === 'grilled' || cl === 'bbq'));
    });
    return m ? m.multiplier : 1;
  }

  function _refreshTray() { window.CHEF_SCENE?.setHeldItems(_tray.map(t => STATIONS[t]?.emoji || '?')); }
  function _updateCoins() { window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins, shiftCoins: _shiftCoins } })); }
  function _setRep(v) { _rep = Math.max(0, Math.min(100, v)); window.dispatchEvent(new CustomEvent('dk:repChanged', { detail: { rep: _rep } })); }

  // ── SHARED: deliver one dish to a customer + award (player taps + auto-waiter) ─
  function deliverDish(custId, dish) {
    const custMgr = window.CUSTOMER_MGR, scene = window.CHEF_SCENE;
    if (!custMgr || !scene) return { accepted: false };
    const res = custMgr.deliverItem(custId, dish);
    if (!res.accepted) return res;
    const sp = custMgr.getServePoint(custId) || { x: scene.W/2, y: scene.diningH };
    const ly = (sp.y || scene.diningH) - 18;
    if (!res.complete) { scene.showFloatText(sp.x, ly, '✓', '#22c55e', 14); return res; }
    const craving = (res.order || []).reduce((m, t) => Math.max(m, _cravingMult(t)), 1);
    const earned = Math.ceil(res.baseEarned * craving);
    _coins += earned; _shiftCoins += earned; _served++;
    _setRep(_rep + REP_PER_SERVE); _updateCoins();
    window.STATION_MGR?.updateUpgradeIcons(_coins);
    const bonus = craving > 1 ? ` ×${craving}🔥` : '';
    scene.showFloatText(sp.x, ly, `+${earned}🪙${bonus}`, '#fbbf24', 17);
    window.dispatchEvent(new CustomEvent('dk:coinEarned', { detail: { amount: earned, x: sp.x, y: ly } }));
    send('DISH_SERVED', { stationId: 'serve', category: (res.order && res.order[0]) || 'grill' });
    return res;
  }

  // ── Tap a station ────────────────────────────────────────────────────────────
  window.addEventListener('dk:stationTapped', (ev) => {
    const stMgr = window.STATION_MGR, scene = window.CHEF_SCENE;
    if (!stMgr || !scene) return;
    const st = stMgr.getStations().find(s => s.id === ev.detail.id); if (!st) return;
    if (stMgr.isReady(st.id)) {
      if (_tray.length < _trayMax) {
        const dish = stMgr.pickUp(st.id);
        if (dish) { _tray.push(dish); _refreshTray();
          scene.showFloatText(st._cx, st._cy - st._h * 0.8, STATIONS[dish]?.emoji || '✓', '#38bdf8', 16); }
      } else scene.showFloatText(st._cx, st._cy - st._h * 0.8, 'Tray full!', '#ef4444', 12);
    } else if (!stMgr.isCooking(st.id)) {
      stMgr.startCooking(st.id);
    } else {
      scene.showFloatText(st._cx, st._cy - st._h * 0.6, '⏳', '#94a3b8', 13);
    }
  });

  // ── Tap a customer → serve matching tray items ───────────────────────────────
  window.addEventListener('dk:customerTapped', (ev) => {
    const custMgr = window.CUSTOMER_MGR, scene = window.CHEF_SCENE;
    if (!custMgr || !scene) return;
    const id = ev.detail.id;
    let any = false;
    for (let i = _tray.length - 1; i >= 0; i--) {
      if (custMgr.customerNeeds(id, _tray[i]) && deliverDish(id, _tray[i]).accepted) { _tray.splice(i, 1); any = true; }
    }
    if (any) _refreshTray();
    else {
      const sp = custMgr.getServePoint(id);
      if (sp) {
        const c = custMgr.getCustomers().find(x => x.id === id);
        const need = c ? c.order.filter((t, j) => !c.delivered[j]).map(t => STATIONS[t]?.emoji || '?').join('') : '';
        scene.showFloatText(sp.x, sp.y - 18, need ? 'Wants ' + need : '…', '#8b949e', 12);
      }
    }
  });

  // ── Shift / day ──────────────────────────────────────────────────────────────
  function startShift(tier) {
    _kitchenTier = tier || _kitchenTier;
    _shiftActive = true; _shiftCoins = 0; _served = 0; _tray = []; _refreshTray();
    window.STATION_MGR?.resetForNewShift();
    window.CUSTOMER_MGR?.startSpawning(_kitchenTier, _day);
    window.STAFF_MGR?.beginShift();
    const durationMs = (SHIFT_DURATIONS[_kitchenTier] || 70) * 1000;
    window.dispatchEvent(new CustomEvent('dk:shiftStarted', { detail: { durationMs, day: _day, tier: _kitchenTier } }));
    if (_shiftTimer) clearTimeout(_shiftTimer);
    _shiftTimer = window.setTimeout(() => {
      _shiftActive = false;
      window.CUSTOMER_MGR?.stopSpawning();
      window.STAFF_MGR?.endShift();
      window.dispatchEvent(new CustomEvent('dk:shiftEnded', { detail: { coins: _shiftCoins, total: _coins, served: _served, rep: _rep, day: _day } }));
      _day++;
    }, durationMs);
  }
  function endShift() { if (_shiftTimer) clearTimeout(_shiftTimer); _shiftActive = false; window.CUSTOMER_MGR?.stopSpawning(); }

  window.addEventListener('dk:custWalkout', () => _setRep(_rep + REP_PER_WALKOUT));

  // ── Staff ────────────────────────────────────────────────────────────────────
  function _cookIds() { return _staff.filter(s => s.role === 'cook').map(s => s.stationId); }
  function _syncCookBadges() { window.STATION_MGR?.setCookStations(_cookIds()); }
  function hireCook(stationId) { _staff.push({ role: 'cook', stationId }); window.STAFF_MGR?.addCook(stationId); _syncCookBadges(); send('HIRE_COOK', { stationId }); }
  function hireWaiter() { _staff.push({ role: 'waiter' }); window.STAFF_MGR?.addWaiter(); send('HIRE_SERVER', { stationId: 'any' }); }
  function getStaff() { return _staff.slice(); }
  function countStaff(role) { return _staff.filter(s => s.role === role).length; }

  // ── Accessors ────────────────────────────────────────────────────────────────
  function getCoins() { return _coins; }
  function setCoins(n) { _coins = Math.max(0, Math.floor(n)); _updateCoins(); window.STATION_MGR?.updateUpgradeIcons(_coins); }
  function getTier() { return _kitchenTier; }
  function getRep() { return _rep; }
  function getDay() { return _day; }
  function setKitchenTier(t) { _kitchenTier = t; }
  function upgradeChefSpeed(level) { window._cookSpeedMult = Math.max(0.4, 1 - level * 0.12); } // prep speed
  function upgradeTraySize(level) { _trayMax = CHEF_TRAY_BASE + level; }

  // ── Server hydrate ───────────────────────────────────────────────────────────
  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const st = ev.detail?.state || {};
    _coins = st.coins || 0;
    _cravings = ev.detail?.cravings?.cravings?.multipliers || [];
    _kitchenTier = Math.min(5, (st.unlockedCuisineTiers || 0) + 1);
    upgradeTraySize(st.offlineEffLevel || 0);
    (st.crew || []).forEach(() => _staff.push({ role: 'waiter' }));
    (st.stations || []).forEach(s => { if (s.hasCook) _staff.push({ role: 'cook', stationId: s.stationType }); });
    _updateCoins(); _setRep(_rep);
    window.setTimeout(() => {
      if (window.CHEF_SCENE && window.STATION_MGR) {
        window.STAFF_MGR?.restore(_staff); _syncCookBadges(); startShift(_kitchenTier);
      }
    }, 500);
  });
  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) => { _cravings = ev.detail?.cravings?.multipliers || []; });

  // Dev fallback (local Playwright / standalone — no Devvit server)
  window.addEventListener('dk:sceneReady', () => {
    window.setTimeout(() => {
      if (!window._dkInitDone) { _coins = 80; _updateCoins(); window.STAFF_MGR?.restore(_staff); _syncCookBadges(); startShift(1); }
    }, 1400);
  });

  return { startShift, endShift, deliverDish, getCoins, setCoins, getTier, getRep, getDay,
    setKitchenTier, upgradeChefSpeed, upgradeTraySize, hireCook, hireWaiter, getStaff, countStaff };
})();

window.CHEF_CTRL = ChefController;
