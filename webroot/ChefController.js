// webroot/ChefController.js — the economy brain for the tap-to-cook game.
// Tap a station → cook / plate. Tap a customer → serve matching tray items.
// Owns coins, reputation, day/shift, the tray, and the shared deliverDish() used
// by both the player and the auto-staff.

const ChefController = (() => {
  let _hand = null;        // item id currently held in hand
  let _dragging = false;
  let _combo = 0, _lastServe = 0, _goal = 0;
  let _coins = 0, _shiftCoins = 0, _served = 0;
  let _rep = 60, _day = 1, _kitchenTier = 1;
  let _shiftTimer = null, _shiftActive = false, _paused = false;
  let _endTime = 0, _remainingMs = 0;
  let _cravings = [];
  let _staff = [];
  let _chefSpeedLevel = 0;
  let _playPressed = false, _pendingStart = null;

  // The game now boots into a start menu. Setup (kitchen rebuild, coin/staff
  // hydrate) runs as soon as the server/dev-fallback is ready, but the first
  // shift only begins when the player taps "Play" on the menu.
  function _armStart(starter) {
    if (_playPressed) starter();
    else _pendingStart = starter;
  }
  function beginGame() {
    _playPressed = true;
    const f = _pendingStart; _pendingStart = null;
    if (f) f();
  }

  const _DISH_CRAVE = { burger: 'grilled', fries: 'street', cola: 'sweet', coffee: 'comfort' };
  function _cravingMult(dish) {
    const cat = _DISH_CRAVE[dish]; if (!cat) return 1;
    const m = _cravings.find(c => {
      const cl = (c.category || '').toLowerCase();
      return cl === cat || (cat === 'street' && cl === 'fried') || (cat === 'grilled' && cl === 'bbq');
    });
    return m ? m.multiplier : 1;
  }

  function _setHand(item) {
    _hand = item || null;
    window.CHEF_SCENE?.setHand(_hand ? ITEMS[_hand].emoji : null);
    if (_hand) { window.STATION_MGR?.setDropHighlight(_hand); window.CUSTOMER_MGR?.setServeHighlight(_hand); }
    else { window.STATION_MGR?.clearDropHighlight(); window.CUSTOMER_MGR?.clearServeHighlight(); }
  }
  function _updateCoins() { window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins, shiftCoins: _shiftCoins } })); }
  function _setRep(v) { _rep = Math.max(0, Math.min(100, v)); window.dispatchEvent(new CustomEvent('dk:repChanged', { detail: { rep: _rep } })); }

  // ── SHARED: deliver one dish to a customer + award (player taps + auto-waiter) ─
  // `from` = {x,y} source of the dish (player tray or a waiter), for the fly animation.
  function deliverDish(custId, dish, from) {
    const custMgr = window.CUSTOMER_MGR, scene = window.CHEF_SCENE;
    if (!custMgr || !scene) return { accepted: false };
    const res = custMgr.deliverItem(custId, dish);
    if (!res.accepted) return res;
    const sp = custMgr.getServePoint(custId) || { x: scene.W/2, y: scene.diningH };
    const ly = (sp.y || scene.diningH) - 18;
    // animate the plated dish flying to the customer
    const tray = scene.trayCenter ? scene.trayCenter() : { cx: scene.W/2, cy: scene.H*0.9 };
    const fx = from ? from.x : tray.cx, fy = from ? from.y : tray.cy;
    scene.flyDish(fx, fy, sp.x, sp.y + 8, dish, () => {
      if (res.complete && window.PARTICLE_FX) window.PARTICLE_FX.serveBurst(sp.x, sp.y);
    });
    if (!res.complete) return res;
    // combo: consecutive serves within 8s build a multiplier
    if (Date.now() - _lastServe > 8000) _combo = 0;
    _combo++; _lastServe = Date.now();
    const comboMult = Math.min(3, 1 + (_combo - 1) * 0.2);
    const craving = (res.order || []).reduce((m, t) => Math.max(m, _cravingMult(t)), 1);
    const perfect = res.speedFactor > 0.7;
    let earned = Math.ceil(res.baseEarned * craving * comboMult * (perfect ? 1.25 : 1));
    _coins += earned; _shiftCoins += earned; _served++;
    _setRep(_rep + REP_PER_SERVE); _updateCoins();
    window.SFX?.serve(_combo); if (perfect) window.SFX?.perfect();
    const bonus = craving > 1 ? ` ×${craving}🔥` : '';
    scene.showFloatText(sp.x, ly, `+${earned}🪙${bonus}`, '#fbbf24', 17);
    if (_combo >= 2) scene.showFloatText(sp.x, ly - 22, `COMBO ×${_combo}`, '#f97316', 14);
    if (perfect) scene.showFloatText(sp.x, ly - 40, '⭐ PERFECT', '#22c55e', 13);
    window.dispatchEvent(new CustomEvent('dk:comboChanged', { detail: { combo: _combo } }));
    window.dispatchEvent(new CustomEvent('dk:coinEarned', { detail: { amount: earned, x: sp.x, y: ly } }));
    send('DISH_SERVED', { stationId: 'serve', category: (res.order && res.order[0]) || 'grill' });
    return res;
  }

  // ── Interaction: tap-to-pick → tap-target, OR drag-and-drop ──────────────────
  // Grab on pointer-down (take into hand), place on pointer-up over a target.
  function _hit(x, y) {
    const st = window.STATION_MGR?.stationAt(x, y);
    if (st) return { kind: 'station', inst: st };
    const c = window.CUSTOMER_MGR?.customerAt(x, y);
    if (c) return { kind: 'customer', cust: c };
    return null;
  }

  function _onDown(p) {
    const scene = window.CHEF_SCENE, stMgr = window.STATION_MGR;
    // tap your hands (the bottom tray) to drop / discard whatever you're holding
    const hb = scene.handCenter ? scene.handCenter() : null;
    if (_hand && hb && Math.abs(p.x - hb.cx) <= hb.w / 2 && Math.abs(p.y - hb.cy) <= scene.H * 0.05) {
      _setHand(null); window.SFX?.place(); _dragging = false; return;
    }
    const t = _hit(p.x, p.y);
    // bins ALWAYS hand you their ingredient — swapping out whatever you were holding
    if (t && t.kind === 'station' && t.inst.kind === 'bin') {
      _setHand(t.inst.def.gives); _dragging = true;
      scene.showGhost(ITEMS[_hand].emoji); scene.moveGhost(p.x, p.y); window.SFX?.pickup();
      return;
    }
    if (_hand == null && t && t.kind === 'station') {
      const item = stMgr.takeFrom(t.inst);
      if (item) { _setHand(item); _dragging = true; scene.showGhost(ITEMS[item].emoji); scene.moveGhost(p.x, p.y); window.SFX?.pickup(); }
      else if (t.inst.kind === 'maker') {
        // tap a drink machine → start a brew; if it's already at capacity, say so
        // (it also auto-brews on its own, so a drink is always on the way).
        if (stMgr.canPlace(t.inst)) { stMgr.startMake(t.inst); window.SFX?.place(); }
        else { scene.showFloatText(t.inst._cx, t.inst._cy - t.inst._h * 0.7, '⏳ Brewing…', '#0891b2', 12); }
      }
    } else {
      _dragging = false;
    }
  }
  function _onMove(p) { if (_dragging && _hand) window.CHEF_SCENE.moveGhost(p.x, p.y); }
  function _onUp(p) {
    const scene = window.CHEF_SCENE;
    scene.hideGhost();
    if (_hand) {
      const t = _hit(p.x, p.y);
      let ok = false, rejected = false;
      if (t && t.kind === 'station') {
        ok = window.STATION_MGR.putTo(t.inst, _hand);
        if (ok) window.SFX?.place(); else rejected = true;
      } else if (t && t.kind === 'customer') {
        if (ITEMS[_hand].dish && window.CUSTOMER_MGR.customerNeeds(t.cust.id, _hand)) {
          deliverDish(t.cust.id, _hand, { x: p.x, y: p.y }); ok = true;
        } else {
          rejected = true;
          const need = t.cust.order.filter((d, j) => !t.cust.delivered[j]).map(d => DISHES[d]?.emoji || '?').join('');
          const sp = window.CUSTOMER_MGR.getServePoint(t.cust.id);
          if (sp) scene.showFloatText(sp.x, sp.y - 18, need ? 'Wants ' + need : '…', '#8b949e', 12);
        }
      }
      if (ok) _setHand(null);
      else if (rejected) { window.SFX?.error(); scene.cameras.main.shake(70, 0.0022); scene.showFloatText(p.x, p.y - 14, '✗', '#ef4444', 14); }
    }
    _dragging = false;
  }

  window.addEventListener('dk:sceneReady', () => {
    const scene = window.CHEF_SCENE; if (!scene || scene._dkInputWired) return;
    scene._dkInputWired = true;
    scene.input.on('pointerdown', _onDown);
    scene.input.on('pointermove', _onMove);
    scene.input.on('pointerup', _onUp);
    scene.input.on('gameout', () => { scene.hideGhost(); _dragging = false; });
  });

  // ── Shift / day ──────────────────────────────────────────────────────────────
  function _computeGoal() { return Math.round((48 + 34 * _kitchenTier) * (1 + (_day - 1) * 0.3)); }
  function _goalStars() {
    const r = _goal > 0 ? _shiftCoins / _goal : 0;
    return r >= 1 ? 3 : r >= 0.65 ? 2 : r >= 0.35 ? 1 : 0;
  }
  function _finishShift() {
    _shiftActive = false; _paused = false;
    window.CUSTOMER_MGR?.stopSpawning();
    window.STAFF_MGR?.endShift();
    window.dispatchEvent(new CustomEvent('dk:shiftEnded', { detail: {
      coins: _shiftCoins, total: _coins, served: _served, rep: _rep, day: _day,
      goal: _goal, goalStars: _goalStars() } }));
    _save();
    _day++;
  }
  function startShift(tier) {
    _kitchenTier = tier || _kitchenTier;
    _shiftActive = true; _paused = false; _shiftCoins = 0; _served = 0; _combo = 0; _goal = _computeGoal(); _setHand(null);
    window.STATION_MGR?.resetForNewShift();
    window.CUSTOMER_MGR?.startSpawning(_kitchenTier, _day);
    window.STAFF_MGR?.beginShift();
    const durationMs = (SHIFT_DURATIONS[_kitchenTier] || 70) * 1000;
    _endTime = Date.now() + durationMs;
    window.dispatchEvent(new CustomEvent('dk:shiftStarted', { detail: { durationMs, day: _day, tier: _kitchenTier, goal: _goal } }));
    if (_shiftTimer) clearTimeout(_shiftTimer);
    _shiftTimer = window.setTimeout(_finishShift, durationMs);
  }
  function endShift() { if (_shiftTimer) clearTimeout(_shiftTimer); _shiftActive = false; window.CUSTOMER_MGR?.stopSpawning(); }

  // Pause/resume so the player can shop mid-shift without losing customers.
  function pauseShift() {
    if (!_shiftActive || _paused) return;
    _paused = true; _remainingMs = Math.max(0, _endTime - Date.now());
    if (_shiftTimer) clearTimeout(_shiftTimer);
    window.CUSTOMER_MGR?.pause(); window.STAFF_MGR?.endShift();
    window.dispatchEvent(new CustomEvent('dk:shiftPaused', { detail: { remainingMs: _remainingMs } }));
  }
  function resumeShift() {
    if (!_shiftActive || !_paused) return;
    _paused = false; _endTime = Date.now() + _remainingMs;
    window.CUSTOMER_MGR?.resume(); window.STAFF_MGR?.beginShift();
    if (_shiftTimer) clearTimeout(_shiftTimer);
    _shiftTimer = window.setTimeout(_finishShift, _remainingMs);
    window.dispatchEvent(new CustomEvent('dk:shiftResumed', { detail: { remainingMs: _remainingMs } }));
  }

  window.addEventListener('dk:custWalkout', () => { _setRep(_rep + REP_PER_WALKOUT); _combo = 0; window.SFX?.fail(); window.dispatchEvent(new CustomEvent('dk:comboChanged', { detail: { combo: 0 } })); });
  window.addEventListener('dk:burnt', () => { _setRep(_rep - 1); });

  // ── Staff ────────────────────────────────────────────────────────────────────
  function _cookIds() { return _staff.filter(s => s.role === 'cook').map(s => s.stationId); }
  function _syncCookBadges() { window.STATION_MGR?.setCookStations(_cookIds()); }
  function hireCook(stationId) { _staff.push({ role: 'cook', stationId }); window.STAFF_MGR?.addCook(stationId); _syncCookBadges(); _save(); }
  function hireWaiter() { _staff.push({ role: 'waiter' }); window.STAFF_MGR?.addWaiter(); _save(); }

  // ── Persistence: SAVE_STATE is the source of truth so coins/upgrades/staff stick
  //   even if the player never opens the shop (the old inline-onclick shop was the
  //   only saver, which the Devvit CSP blocked → "money didn't flow" across reloads).
  function _save() {
    const stMgr = window.STATION_MGR;
    const cookStations = new Set(_staff.filter(s => s.role === 'cook').map(s => s.stationId));
    const waiters = _staff.filter(s => s.role === 'waiter').length;
    const stations = (stMgr?.getStations() || []).filter(s => s.kind === 'cook' || s.kind === 'maker').map((st, i) => ({
      id: st.id, x: i, y: 0, stationType: st.defId, level: st.level, hasCook: cookStations.has(st.id), hasServer: false,
    }));
    const crew = Array.from({ length: waiters }, (_, i) => ({ slotIndex: i, personality: 'steady', name: 'Waiter ' + (i + 1), subredditOrigin: '' }));
    send('SAVE_STATE', { state: {
      saveVersion: 1, coins: _coins, renown: 0, tradeTokens: 0, lifetimeCoinsThisRun: _coins,
      stations, crew, voyageCount: 0, unlockedCuisineTiers: _kitchenTier - 1,
      incomeMultiplierLevel: 0, offlineCapLevel: 0, offlineEffLevel: 0, cookSpeedLevel: _chefSpeedLevel,
      startingCoinsLevel: 0, extraRerollUnlocked: false, royaltyBoostLevel: 0,
      streak: 0, lastStreakDate: '', rerollsToday: 0, lastSeen: Date.now(), incomePerSec: 0,
    } });
  }
  setInterval(() => { if (_shiftActive && !_paused) _save(); }, 15000); // periodic autosave
  function getStaff() { return _staff.slice(); }
  function countStaff(role) { return _staff.filter(s => s.role === role).length; }

  // ── Accessors ────────────────────────────────────────────────────────────────
  function getCoins() { return _coins; }
  function setCoins(n) { _coins = Math.max(0, Math.floor(n)); _updateCoins(); }
  function getTier() { return _kitchenTier; }
  function getRep() { return _rep; }
  function getDay() { return _day; }
  function setKitchenTier(t) { _kitchenTier = t; }
  function upgradeChefSpeed(level) { _chefSpeedLevel = level || 0; window._cookSpeedMult = Math.max(0.4, 1 - _chefSpeedLevel * 0.12); } // prep speed
  function upgradeTraySize() { /* no tray in the assembly model */ }

  // ── Server hydrate ───────────────────────────────────────────────────────────
  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const st = ev.detail?.state || {};
    _coins = st.coins || 0;
    _cravings = ev.detail?.cravings?.cravings?.multipliers || [];
    _kitchenTier = Math.min(5, (st.unlockedCuisineTiers || 0) + 1);
    upgradeChefSpeed(st.cookSpeedLevel || 0);
    (st.crew || []).forEach(() => _staff.push({ role: 'waiter' }));
    (st.stations || []).forEach(s => { if (s.hasCook) _staff.push({ role: 'cook', stationId: s.id }); });
    _updateCoins(); _setRep(_rep);
    window.setTimeout(() => {
      if (window.CHEF_SCENE && window.STATION_MGR) {
        window.STATION_MGR.restoreLevels?.(st.stations);   // restore upgrade levels
        window.CHEF_SCENE.rebuildKitchen?.(_kitchenTier);  // rebuild to saved tier (re-inits stations w/ levels)
        window.STAFF_MGR?.restore(_staff); _syncCookBadges();
        _armStart(() => startShift(_kitchenTier));
      }
    }, 500);
  });
  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) => { _cravings = ev.detail?.cravings?.multipliers || []; });

  // Dev fallback (local Playwright / standalone — no Devvit server)
  window.addEventListener('dk:sceneReady', () => {
    window.setTimeout(() => {
      if (!window._dkInitDone) { _coins = 80; _updateCoins(); window.STAFF_MGR?.restore(_staff); _syncCookBadges(); _armStart(() => startShift(1)); }
    }, 1400);
  });

  return { startShift, beginGame, endShift, pauseShift, resumeShift, deliverDish, getCoins, setCoins, getTier, getRep, getDay,
    setKitchenTier, upgradeChefSpeed, upgradeTraySize, hireCook, hireWaiter, getStaff, countStaff };
})();

window.CHEF_CTRL = ChefController;
