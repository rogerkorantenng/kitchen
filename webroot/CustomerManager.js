// webroot/CustomerManager.js
// Spawns customers at the service counter, shows order bubbles + patience bars.
// Handles delivery matching for multi-item combo orders.

const CustomerManager = (() => {
  const _customers = {};
  let _cid = 0;
  let _spawnTimer = null;
  let _kitchenTier = 1;
  let _onCoinEarned = null;

  function setOnCoinEarned(cb) { _onCoinEarned = cb; }

  function startSpawning(tier) {
    _kitchenTier = tier;
    stopSpawning();
    _scheduleNext();
  }

  function stopSpawning() {
    if (_spawnTimer) { clearTimeout(_spawnTimer); _spawnTimer = null; }
  }

  function _scheduleNext() {
    const delay = SPAWN_INTERVAL_MS + Math.random() * 2000;
    _spawnTimer = window.setTimeout(() => {
      const active = Object.values(_customers).filter(c => !c.served && !c.leaving).length;
      if (active < 4) _spawnOne();
      _scheduleNext();
    }, delay);
  }

  function _spawnOne() {
    const scene = window.CHEF_SCENE;
    if (!scene) return;

    // Pick a valid combo for this tier
    const comboPools = ['basic'];
    if (_kitchenTier >= 2) comboPools.push('full');
    if (_kitchenTier >= 4) comboPools.push('premium');
    const poolType  = comboPools[Math.floor(Math.random() * comboPools.length)];
    const comboList = COMBOS[poolType] || COMBOS.basic;
    const stationIds = (window.STATION_MGR?.getStations() || []).map(s => s.id);
    const validCombos = comboList.filter(c => c.every(t => stationIds.includes(t)));
    if (!validCombos.length) return;
    const order = validCombos[Math.floor(Math.random() * validCombos.length)];

    // Find free counter column
    const tier = KITCHEN_TIERS[_kitchenTier] || KITCHEN_TIERS[1];
    const usedCols = Object.values(_customers).filter(c => !c.served && !c.leaving).map(c => c.col);
    const freeCols = Array.from({ length: tier.cols }, (_, i) => i).filter(c => !usedCols.includes(c));
    if (!freeCols.length) return;
    const col = freeCols[Math.floor(Math.random() * freeCols.length)];

    // Determine customer type
    const roll = Math.random();
    const type = roll < 0.08 ? 'vip' : roll < 0.28 ? 'impatient' : 'regular';

    const id   = 'c' + (++_cid);
    const cust = {
      id, col, order, type,
      served:     false,
      leaving:    false,
      spawnedAt:  Date.now(),
      patienceMs: CUSTOMER_PATIENCE[type] || CUSTOMER_PATIENCE.regular,
    };
    _customers[id] = cust;
    _drawCustomer(cust);

    // Patience timeout
    window.setTimeout(() => {
      if (!cust.served && !cust.leaving) {
        cust.leaving = true;
        _custLeave(cust, false);
      }
    }, cust.patienceMs);
  }

  function _drawCustomer(cust) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;

    // Position: just in front of the counter (row -0.5 effectively)
    const { x, y } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
    const cx = x + TILE_W / 2;
    // Place at counter screen Y
    const counterY = window.DK_COUNTER_Y || (y + TILE_H * 1.2);
    const cy = counterY - TILE_H * 0.55;
    const objs = {};

    // Unique hue per customer
    const hue   = (_cid * 53) % 360;
    const body  = Phaser.Display.Color.HSLToColor(hue / 360, 0.68, 0.52).color;
    const dark  = Phaser.Display.Color.HSLToColor(hue / 360, 0.68, 0.32).color;

    // Shadow
    const shadow = scene.add.graphics().setDepth(17);
    shadow.fillStyle(C.black, 0.12);
    shadow.fillEllipse(cx + 2, cy + TILE_H * 0.36, TILE_W * 0.44, TILE_H * 0.13);
    objs.shadow = shadow;

    // Body
    const sprite = scene.add.graphics().setDepth(18);
    // Torso
    sprite.fillStyle(body, 1);
    sprite.fillRoundedRect(cx - TILE_W * 0.16, cy - TILE_H * 0.06, TILE_W * 0.32, TILE_H * 0.42, 5);
    // Head
    sprite.fillStyle(0xfde8c8, 1);
    sprite.fillRoundedRect(cx - TILE_W * 0.19, cy - TILE_H * 0.42, TILE_W * 0.38, TILE_H * 0.3, 6);
    // Hair
    sprite.fillStyle(dark, 1);
    sprite.fillArc(cx, cy - TILE_H * 0.34, TILE_W * 0.19, 180, 360, false);
    // Eyes
    sprite.fillStyle(0x2d1a00, 1);
    sprite.fillCircle(cx - TILE_W * 0.07, cy - TILE_H * 0.28, TILE_W * 0.038);
    sprite.fillCircle(cx + TILE_W * 0.07, cy - TILE_H * 0.28, TILE_W * 0.038);
    // VIP crown
    if (cust.type === 'vip') {
      sprite.fillStyle(C.gold, 1);
      sprite.fillTriangle(cx - TILE_W*0.12, cy - TILE_H*0.52, cx, cy - TILE_H*0.66, cx + TILE_W*0.12, cy - TILE_H*0.52);
    }
    // Impatient — red tinge
    if (cust.type === 'impatient') {
      sprite.fillStyle(C.red, 0.25);
      sprite.fillCircle(cx, cy - TILE_H * 0.28, TILE_W * 0.22);
    }
    objs.sprite = sprite;

    // Order bubble
    const bubbleW = Math.max(TILE_W * 0.55, cust.order.length * TILE_W * 0.32 + TILE_W * 0.18);
    const bubbleX = cx - bubbleW / 2;
    const bubbleY = cy - TILE_H * 1.05;

    const bubble = scene.add.graphics().setDepth(19);
    bubble.fillStyle(C.white, 0.96);
    bubble.fillRoundedRect(bubbleX, bubbleY, bubbleW, TILE_H * 0.44, 7);
    bubble.lineStyle(1.5, 0xdddddd, 1);
    bubble.strokeRoundedRect(bubbleX, bubbleY, bubbleW, TILE_H * 0.44, 7);
    // Bubble tail
    bubble.fillStyle(C.white, 0.96);
    bubble.fillTriangle(cx - TILE_W*0.07, bubbleY + TILE_H*0.44, cx + TILE_W*0.07, bubbleY + TILE_H*0.44, cx, bubbleY + TILE_H*0.6);
    objs.bubble = bubble;

    // Order emojis inside bubble
    cust.order.forEach((type, i) => {
      const ex = cx - (cust.order.length - 1) * TILE_W * 0.14 + i * TILE_W * 0.28;
      objs['emo' + i] = scene.add.text(ex, bubbleY + TILE_H * 0.22, STATIONS[type]?.emoji || '?', {
        fontSize: Math.round(TILE_W * 0.26) + 'px',
      }).setOrigin(0.5).setDepth(20);
    });

    // Patience bar
    const barW = TILE_W * 0.68;
    const barBg = scene.add.graphics().setDepth(19);
    barBg.fillStyle(C.black, 0.3);
    barBg.fillRoundedRect(cx - barW / 2, cy + TILE_H * 0.38, barW, 6, 3);
    objs.barBg  = barBg;
    objs.barFill = scene.add.graphics().setDepth(20);
    objs._cx    = cx;
    objs._cy    = cy;
    objs._barW  = barW;

    // Interactive zone — tap to deliver
    const zone = scene.add.zone(cx, cy, TILE_W * 1.1, TILE_H * 1.8).setInteractive().setDepth(21);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:customerTapped', { detail: { id: cust.id } })));
    objs.zone = zone;

    cust.objs = objs;
  }

  // Update patience bars every 50ms
  setInterval(() => {
    const now = Date.now();
    Object.values(_customers).forEach(cust => {
      if (cust.served || cust.leaving || !cust.objs?.barFill) return;
      const pct = Math.max(0, 1 - (now - cust.spawnedAt) / cust.patienceMs);
      const col = pct > 0.5 ? C.green : pct > 0.25 ? C.gold : C.red;
      const o = cust.objs;
      o.barFill.clear();
      o.barFill.fillStyle(col, 1);
      o.barFill.fillRoundedRect(o._cx - o._barW / 2, o._cy + TILE_H * 0.38, o._barW * pct, 6, 3);
    });
  }, 50);

  function _custLeave(cust, served) {
    cust.leaving = true;
    const objs = cust.objs || {};
    const targets = Object.values(objs).filter(o => o && typeof o.setAlpha === 'function');
    if (window.CHEF_SCENE && targets.length) {
      window.CHEF_SCENE.tweens.add({
        targets, alpha: 0, duration: 350,
        onComplete: () => _destroyCust(cust.id),
      });
    } else {
      _destroyCust(cust.id);
    }
    if (!served && window.CHEF_SCENE) {
      const scene = window.CHEF_SCENE;
      const { x } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
      scene.showFloatText(x + TILE_W / 2, (window.DK_COUNTER_Y || 150) - TILE_H * 0.5, '😤 Left!', '#ef4444');
    }
  }

  function _destroyCust(id) {
    const c = _customers[id];
    if (c?.objs) Object.values(c.objs).forEach(o => { try { o?.destroy?.(); } catch {} });
    delete _customers[id];
  }

  function getCustomers() {
    return Object.values(_customers).filter(c => !c.served && !c.leaving);
  }

  function matchesOrder(custId, heldItems) {
    const c = _customers[custId];
    if (!c || heldItems.length !== c.order.length) return false;
    const a = [...heldItems].sort(), b = [...c.order].sort();
    return a.every((v, i) => v === b[i]);
  }

  function serveCustomer(custId, speedFactor) {
    const c = _customers[custId];
    if (!c || c.served) return 0;
    c.served = true;
    const baseCoins = c.order.reduce((s, t) => s + (STATIONS[t]?.baseCoins || 5), 0);
    const earned = Math.ceil(baseCoins * (1 + speedFactor * 0.6));
    _custLeave(c, true);
    if (_onCoinEarned) {
      const scene = window.CHEF_SCENE;
      const { x } = isoToScreen(c.col, 0, scene?.originX || 0, scene?.originY || 0);
      _onCoinEarned(earned, x + TILE_W / 2, window.DK_COUNTER_Y || 150);
    }
    return earned;
  }

  function resetForNewShift() {
    Object.keys(_customers).forEach(_destroyCust);
    stopSpawning();
  }

  return { startSpawning, stopSpawning, getCustomers, matchesOrder, serveCustomer, resetForNewShift, setOnCoinEarned };
})();

window.CUSTOMER_MGR = CustomerManager;
