// webroot/ChefController.js
// Wires chef movement, tray, station interaction, customer delivery, shift timer.
// Manages coin totals and fires dk:shiftEnded when the shift clock runs out.

const ChefController = (() => {
  let _tray       = [];
  let _trayMax    = CHEF_TRAY_BASE;
  let _coins      = 0;
  let _shiftCoins = 0;
  let _shiftTimer = null;
  let _shiftActive = false;
  let _kitchenTier = 1;
  let _cravings   = [];

  // ── Craving multiplier ───────────────────────────────────────────────────────
  function _cravingMult(type) {
    const match = _cravings.find(c => {
      const cl = (c.category || '').toLowerCase();
      return cl === type ||
        (type === 'grill'  && cl === 'grilled') ||
        (type === 'fryer'  && (cl === 'street' || cl === 'fried')) ||
        (type === 'wok'    && (cl === 'comfort' || cl === 'noodles')) ||
        (type === 'bakery' && cl === 'baked') ||
        (type === 'smoker' && (cl === 'grilled' || cl === 'bbq'));
    });
    return match ? match.multiplier : 1;
  }

  // ── Interact — context-sensitive ────────────────────────────────────────────
  function _interact() {
    const scene  = window.CHEF_SCENE;
    const stMgr  = window.STATION_MGR;
    const custMgr = window.CUSTOMER_MGR;
    if (!scene || !stMgr || !custMgr) return;

    const pos = scene.getPlayerPos();

    // 1. Check nearest station (within 1.8 tiles)
    const stations = stMgr.getStations();
    let nearSt = null, nearStDist = TILE_W * 1.8;
    stations.forEach(st => {
      const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
      const d = Math.hypot(pos.x - (x + TILE_W/2), pos.y - (y + TILE_H/2));
      if (d < nearStDist) { nearSt = st; nearStDist = d; }
    });

    if (nearSt) {
      if (stMgr.isReady(nearSt.id) && _tray.length < _trayMax) {
        const dish = stMgr.pickUp(nearSt.id);
        if (dish) {
          _tray.push(dish);
          scene.setHeldItems(_tray.map(t => STATIONS[t]?.emoji || '?'));
          scene.showFloatText(pos.x, pos.y - TILE_H, 'Got ' + (STATIONS[dish]?.emoji || dish) + '!', '#38bdf8');
          // Try to deliver immediately if we now have a full order
          _tryDeliver(custMgr, scene, pos);
        }
        return;
      } else if (!stMgr.isCooking(nearSt.id) && !stMgr.isReady(nearSt.id)) {
        stMgr.startCooking(nearSt.id);
        scene.showFloatText(pos.x, pos.y - TILE_H, 'Cooking…', '#94a3b8');
        // Check if we can also upgrade mid-shift
        const upgCost = stMgr.getUpgradeCost(nearSt.id);
        if (_coins >= upgCost && nearSt.level < 4) {
          scene.showFloatText(pos.x, pos.y - TILE_H * 1.8, `💰 Upgrade ready! ×2 tap`, '#fbbf24', 10);
        }
        return;
      } else if (stMgr.isCooking(nearSt.id)) {
        scene.showFloatText(pos.x, pos.y - TILE_H, 'Still cooking…', '#8b949e');
        return;
      }
    }

    // 2. Try to deliver held items to a matching customer
    _tryDeliver(custMgr, scene, pos);
  }

  function _tryDeliver(custMgr, scene, pos) {
    if (_tray.length === 0) { scene.showFloatText(pos.x, pos.y - TILE_H, 'Nothing to deliver', '#8b949e', 11); return; }

    const customers = custMgr.getCustomers();
    let bestCust = null, bestDist = TILE_W * 3.5;
    customers.forEach(c => {
      if (!custMgr.matchesOrder(c.id, _tray)) return;
      const { x } = isoToScreen(c.col, 0, scene.originX, scene.originY);
      const d = Math.hypot(pos.x - (x + TILE_W/2), pos.y - (window.DK_COUNTER_Y || 0));
      if (d < bestDist) { bestCust = c; bestDist = d; }
    });

    if (bestCust) {
      _deliverTo(bestCust, custMgr, scene);
    } else {
      const wants = customers.length > 0
        ? 'Need: ' + customers[0].order.map(t => STATIONS[t]?.emoji || '?').join('')
        : 'No customers waiting';
      scene.showFloatText(pos.x, pos.y - TILE_H, wants, '#8b949e', 11);
    }
  }

  function _deliverTo(cust, custMgr, scene) {
    const elapsed     = Date.now() - cust.spawnedAt;
    const speedFactor = Math.max(0, 1 - elapsed / cust.patienceMs);
    const base        = custMgr.serveCustomer(cust.id, speedFactor);
    const cravBonus   = cust.order.reduce((max, t) => Math.max(max, _cravingMult(t)), 1);
    const earned      = Math.ceil(base * cravBonus);

    _coins      += earned;
    _shiftCoins += earned;
    _tray = [];
    scene.setHeldItems([]);
    _updateCoins();
    stMgr_updateIcons();

    const { x } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
    const cx = x + TILE_W / 2;
    const cy = (window.DK_COUNTER_Y || 150) - TILE_H * 0.8;
    const bonusStr = cravBonus > 1 ? ` ×${cravBonus}🔥` : '';
    scene.showFloatText(cx, cy, `+${earned}🪙${bonusStr}`, '#fbbf24', 15);

    // Coin arc
    window.dispatchEvent(new CustomEvent('dk:coinEarned', { detail: { amount: earned, x: cx, y: cy } }));

    // Server notification
    send('DISH_SERVED', { stationId: 'manual', category: cust.order[0] });
  }

  function stMgr_updateIcons() {
    window.STATION_MGR?.updateUpgradeIcons(_coins);
  }

  function _updateCoins() {
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins, shiftCoins: _shiftCoins } }));
  }

  // ── Mid-shift station upgrade ────────────────────────────────────────────────
  function _tryUpgradeNearby() {
    const scene = window.CHEF_SCENE;
    const stMgr = window.STATION_MGR;
    if (!scene || !stMgr) return false;
    const pos = scene.getPlayerPos();
    const stations = stMgr.getStations();
    let best = null, bestDist = TILE_W * 1.8;
    stations.forEach(st => {
      const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
      const d = Math.hypot(pos.x - (x + TILE_W/2), pos.y - (y + TILE_H/2));
      const cost = stMgr.getUpgradeCost(st.id);
      if (d < bestDist && _coins >= cost && st.level < 4) { best = st; bestDist = d; }
    });
    if (!best) return false;
    const cost = stMgr.getUpgradeCost(best.id);
    _coins -= cost;
    stMgr.upgradeStation(best.id);
    _updateCoins();
    send('BUY_UPGRADE', { stationId: best.id });
    return true;
  }

  // ── Station tapped directly ──────────────────────────────────────────────────
  window.addEventListener('dk:stationTapped', (ev) => {
    const scene = window.CHEF_SCENE;
    const stMgr = window.STATION_MGR;
    if (!scene) return;
    const st = stMgr?.getStations().find(s => s.id === ev.detail.id);
    if (!st) return;
    const { x, y } = isoToScreen(st.col, st.row, scene.originX, scene.originY);
    const tx = x + TILE_W / 2;
    const minY = (scene.counterScreenY || 0) + TILE_H * 0.65;
    const ty = Math.max(minY, y + TILE_H * 1.3);
    scene.walkPlayerTo(tx, ty, () => {
      // Try upgrade first (double-tap pattern), else interact
      if (!_tryUpgradeNearby()) _interact();
    });
  });

  // ── Customer tapped directly ─────────────────────────────────────────────────
  window.addEventListener('dk:customerTapped', (ev) => {
    const scene   = window.CHEF_SCENE;
    const custMgr = window.CUSTOMER_MGR;
    if (!scene || !custMgr) return;
    const cust = custMgr.getCustomers().find(c => c.id === ev.detail.id);
    if (!cust) return;
    const { x } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
    const tx = x + TILE_W / 2;
    const ty = (window.DK_COUNTER_Y || 200) + TILE_H * 0.35;
    if (custMgr.matchesOrder(cust.id, _tray)) {
      scene.walkPlayerTo(tx, ty, () => _deliverTo(cust, custMgr, scene));
    } else {
      scene.showFloatText(tx, (window.DK_COUNTER_Y || 150) - TILE_H,
        'Need: ' + cust.order.map(t => STATIONS[t]?.emoji || '?').join(''), '#8b949e', 11);
    }
  });

  // ── Interact button ──────────────────────────────────────────────────────────
  window.addEventListener('dk:interact', () => _interact());

  // ── Shift management ─────────────────────────────────────────────────────────
  function startShift(tier) {
    _kitchenTier = tier || _kitchenTier;
    _shiftActive = true;
    _shiftCoins  = 0;
    _tray = [];
    window.CHEF_SCENE?.setHeldItems([]);
    window.STATION_MGR?.resetForNewShift();
    window.CUSTOMER_MGR?.startSpawning(_kitchenTier);

    const durationMs = (SHIFT_DURATIONS[_kitchenTier] || 60) * 1000;
    const endTime    = Date.now() + durationMs;
    window.dispatchEvent(new CustomEvent('dk:shiftStarted', { detail: { durationMs, endTime } }));

    _shiftTimer = window.setTimeout(() => {
      _shiftActive = false;
      window.CUSTOMER_MGR?.stopSpawning();
      window.dispatchEvent(new CustomEvent('dk:shiftEnded', { detail: { coins: _shiftCoins, total: _coins } }));
    }, durationMs);
  }

  function endShift() {
    if (_shiftTimer) clearTimeout(_shiftTimer);
    _shiftActive = false;
    window.CUSTOMER_MGR?.stopSpawning();
  }

  function getCoins()  { return _coins; }
  function getHeld()   { return [..._tray]; }
  function getTier()   { return _kitchenTier; }

  function upgradeChefSpeed(level) {
    // Applied to CHEF_SPEED_PX_S via scene walk speed — stored for reference
    window._chefSpeedMult = 1 + level * 0.15;
  }

  function upgradeTraySize(level) {
    _trayMax = CHEF_TRAY_BASE + level;
  }

  function setKitchenTier(tier) { _kitchenTier = tier; }

  // ── Devvit server listeners ──────────────────────────────────────────────────
  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const { state, cravings } = ev.detail;
    _coins     = state?.coins || 0;
    _cravings  = cravings?.cravings?.multipliers || [];
    _kitchenTier = Math.min(5, (state?.unlockedCuisineTiers || 0) + 1);
    _trayMax   = CHEF_TRAY_BASE + (state?.offlineEffLevel || 0); // offlineEffLevel reused for tray
    _updateCoins();
    // Start first shift after scene is ready
    window.setTimeout(() => {
      if (window.CHEF_SCENE && window.STATION_MGR) startShift(_kitchenTier);
    }, 600);
  });

  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) => {
    _cravings = ev.detail?.cravings?.multipliers || [];
  });

  // Dev fallback: if no server response, start after scene ready
  window.addEventListener('dk:sceneReady', () => {
    window.setTimeout(() => {
      if (!window._dkInitDone) {
        _coins = 50;
        _updateCoins();
        startShift(1);
      }
    }, 4500);
  });

  return { startShift, endShift, getCoins, getHeld, getTier, upgradeChefSpeed, upgradeTraySize, setKitchenTier };
})();

window.CHEF_CTRL = ChefController;
