// webroot/CustomerManager.js
// Expressive customers with unique looks, animated patience bars, clear order bubbles.

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
    const delay = 3000 + Math.random() * 3000;
    _spawnTimer = window.setTimeout(() => {
      const active = Object.values(_customers).filter(c => !c.served && !c.leaving).length;
      if (active < 4) _spawnOne();
      _scheduleNext();
    }, delay);
  }

  function _spawnOne() {
    const scene = window.CHEF_SCENE;
    if (!scene) return;

    // Pick valid combo
    const pools = ['basic'];
    if (_kitchenTier >= 2) pools.push('full');
    if (_kitchenTier >= 4) pools.push('premium');
    const poolType = pools[Math.floor(Math.random() * pools.length)];
    const comboList = COMBOS[poolType] || COMBOS.basic;
    const stationIds = (window.STATION_MGR?.getStations() || []).map(s => s.id);
    const validCombos = comboList.filter(c => c.every(t => stationIds.includes(t)));
    if (!validCombos.length) return;
    const order = validCombos[Math.floor(Math.random() * validCombos.length)];

    // Free counter column
    const tier = KITCHEN_TIERS[_kitchenTier] || KITCHEN_TIERS[1];
    const usedCols = Object.values(_customers).filter(c => !c.served && !c.leaving).map(c => c.col);
    const freeCols = Array.from({length:tier.cols},(_,i)=>i).filter(c=>!usedCols.includes(c));
    if (!freeCols.length) return;
    const col = freeCols[Math.floor(Math.random() * freeCols.length)];

    const roll = Math.random();
    const type = roll < 0.08 ? 'vip' : roll < 0.25 ? 'impatient' : 'regular';

    const id = 'c'+(++_cid);
    const cust = {
      id, col, order, type,
      served: false, leaving: false,
      spawnedAt: Date.now(),
      patienceMs: CUSTOMER_PATIENCE[type] || CUSTOMER_PATIENCE.regular,
    };
    _customers[id] = cust;
    _drawCustomer(cust);

    window.setTimeout(() => {
      if (!cust.served && !cust.leaving) { cust.leaving = true; _custLeave(cust, false); }
    }, cust.patienceMs);
  }

  // Customer appearance styles — makes each customer visually distinct
  const CUSTOMER_STYLES = [
    { body:0xff6b6b, dark:0xcc4444, hair:0x4a2800, skin:0xfde8c8 }, // red shirt
    { body:0x6bb3ff, dark:0x3a7acc, hair:0x1a1a1a, skin:0xffe0b2 }, // blue shirt
    { body:0x6bcb77, dark:0x3a9a44, hair:0x8b4513, skin:0xfcd5b4 }, // green shirt
    { body:0xf9c74f, dark:0xd4a017, hair:0x1a1a1a, skin:0xfde8c8 }, // yellow shirt
    { body:0xc77dff, dark:0x9a4dcc, hair:0x4a2800, skin:0xffe0b2 }, // purple shirt
    { body:0xff9f43, dark:0xcc6a1a, hair:0x1a1a1a, skin:0xfcd5b4 }, // orange shirt
    { body:0x48dbfb, dark:0x1aadcc, hair:0x8b4513, skin:0xfde8c8 }, // cyan shirt
    { body:0xff6b9d, dark:0xcc3a6a, hair:0x1a1a1a, skin:0xffe0b2 }, // pink shirt
  ];

  function _drawCustomer(cust) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;

    const { x, y } = isoToScreen(cust.col, 0, scene.originX, scene.originY);
    const cx = x + TILE_W / 2;
    const counterY = window.DK_COUNTER_Y || (y + TILE_H * 1.5);
    const cy = counterY - TILE_H * 0.7;
    const objs = {};
    const style = CUSTOMER_STYLES[(_cid - 1) % CUSTOMER_STYLES.length];

    // Shadow
    const shadow = scene.add.graphics().setDepth(17);
    shadow.fillStyle(0x000000, 0.1);
    shadow.fillEllipse(cx+2, cy + TILE_H*0.42, TILE_W*0.42, TILE_H*0.12);
    objs.shadow = shadow;

    // Customer body
    const sprite = scene.add.graphics().setDepth(18);

    // Legs
    sprite.fillStyle(0x374151, 1);
    sprite.fillRoundedRect(cx-TILE_W*0.15, cy+TILE_H*0.22, TILE_W*0.12, TILE_H*0.26, 3);
    sprite.fillRoundedRect(cx+TILE_W*0.03, cy+TILE_H*0.22, TILE_W*0.12, TILE_H*0.26, 3);

    // Shoes
    sprite.fillStyle(0x1f2937, 1);
    sprite.fillRoundedRect(cx-TILE_W*0.18, cy+TILE_H*0.44, TILE_W*0.16, TILE_H*0.1, 3);
    sprite.fillRoundedRect(cx+TILE_W*0.02, cy+TILE_H*0.44, TILE_W*0.16, TILE_H*0.1, 3);

    // Body / shirt
    sprite.fillStyle(style.body, 1);
    sprite.fillRoundedRect(cx-TILE_W*0.2, cy-TILE_H*0.06, TILE_W*0.4, TILE_H*0.32, 6);
    // Shirt detail line
    sprite.lineStyle(1, style.dark, 0.4);
    sprite.lineBetween(cx, cy-TILE_H*0.04, cx, cy+TILE_H*0.26);

    // Arms
    sprite.fillStyle(style.body, 1);
    sprite.fillRoundedRect(cx-TILE_W*0.34, cy+TILE_H*0.02, TILE_W*0.15, TILE_H*0.12, 4);
    sprite.fillRoundedRect(cx+TILE_W*0.19, cy+TILE_H*0.02, TILE_W*0.15, TILE_H*0.12, 4);

    // Hands
    sprite.fillStyle(style.skin, 1);
    sprite.fillCircle(cx-TILE_W*0.34, cy+TILE_H*0.1, TILE_W*0.065);
    sprite.fillCircle(cx+TILE_W*0.34, cy+TILE_H*0.1, TILE_W*0.065);

    // Neck
    sprite.fillStyle(style.skin, 1);
    sprite.fillRect(cx-TILE_W*0.07, cy-TILE_H*0.18, TILE_W*0.14, TILE_H*0.14);

    // Head
    sprite.fillStyle(style.skin, 1);
    sprite.fillRoundedRect(cx-TILE_W*0.21, cy-TILE_H*0.48, TILE_W*0.42, TILE_H*0.32, 8);

    // Hair
    sprite.fillStyle(style.hair, 1);
    sprite.fillArc(cx, cy-TILE_H*0.4, TILE_W*0.21, 180, 360, false);
    sprite.fillRoundedRect(cx-TILE_W*0.21, cy-TILE_H*0.48, TILE_W*0.42, TILE_H*0.12, 8);

    // Eyes
    sprite.fillStyle(0x1f2937, 1);
    sprite.fillCircle(cx-TILE_W*0.09, cy-TILE_H*0.32, TILE_W*0.042);
    sprite.fillCircle(cx+TILE_W*0.09, cy-TILE_H*0.32, TILE_W*0.042);
    // Eye shine
    sprite.fillStyle(0xffffff, 0.9);
    sprite.fillCircle(cx-TILE_W*0.08, cy-TILE_H*0.34, TILE_W*0.014);
    sprite.fillCircle(cx+TILE_W*0.1, cy-TILE_H*0.34, TILE_W*0.014);
    // Smile
    sprite.lineStyle(TILE_W*0.025, 0x2d1a00, 1);
    sprite.beginPath(); sprite.arc(cx, cy-TILE_H*0.21, TILE_W*0.09, 0.2, Math.PI-0.2, false); sprite.strokePath();

    // VIP crown
    if (cust.type === 'vip') {
      sprite.fillStyle(0xfbbf24, 1);
      sprite.fillTriangle(cx-TILE_W*0.14, cy-TILE_H*0.52, cx, cy-TILE_H*0.68, cx+TILE_W*0.14, cy-TILE_H*0.52);
      sprite.fillCircle(cx, cy-TILE_H*0.68, 4);
      sprite.fillStyle(0xff6b6b, 1); sprite.fillCircle(cx-TILE_W*0.14, cy-TILE_H*0.52, 3);
      sprite.fillStyle(0x6bcb77, 1); sprite.fillCircle(cx+TILE_W*0.14, cy-TILE_H*0.52, 3);
    }
    // Impatient: sweat drops
    if (cust.type === 'impatient') {
      sprite.fillStyle(0x60a5fa, 0.8);
      sprite.fillEllipse(cx+TILE_W*0.24, cy-TILE_H*0.4, 6, 8);
    }
    objs.sprite = sprite;

    // Order bubble — white card with rounded corners
    const orderCount = cust.order.length;
    const bubbleW = Math.max(54, orderCount * 28 + 16);
    const bubbleY = cy - TILE_H * 1.15;

    const bubble = scene.add.graphics().setDepth(19);
    // Drop shadow
    bubble.fillStyle(0x000000, 0.12);
    bubble.fillRoundedRect(cx-bubbleW/2+2, bubbleY+2, bubbleW, TILE_H*0.44, 10);
    // White card
    bubble.fillStyle(0xffffff, 1);
    bubble.fillRoundedRect(cx-bubbleW/2, bubbleY, bubbleW, TILE_H*0.44, 10);
    // Colored top strip
    bubble.fillStyle(style.body, 1);
    bubble.fillRoundedRect(cx-bubbleW/2, bubbleY, bubbleW, 5, {tl:10,tr:10,bl:0,br:0});
    // Border
    bubble.lineStyle(1.5, 0xe5e7eb, 1);
    bubble.strokeRoundedRect(cx-bubbleW/2, bubbleY, bubbleW, TILE_H*0.44, 10);
    // Tail
    bubble.fillStyle(0xffffff, 1);
    bubble.fillTriangle(cx-6, bubbleY+TILE_H*0.44, cx+6, bubbleY+TILE_H*0.44, cx, bubbleY+TILE_H*0.58);
    objs.bubble = bubble;

    // Order emojis
    cust.order.forEach((type, i) => {
      const totalW = orderCount * 26;
      const ex = cx - totalW/2 + i*26 + 13;
      objs['emo'+i] = scene.add.text(ex, bubbleY+TILE_H*0.22, STATIONS[type]?.emoji||'?', {
        fontSize: Math.round(TILE_W*0.24)+'px',
      }).setOrigin(0.5).setDepth(20);
    });

    // Patience bar — thin colored strip below customer
    const barW = TILE_W * 0.7;
    const barBg = scene.add.graphics().setDepth(19);
    barBg.fillStyle(0x000000, 0.2);
    barBg.fillRoundedRect(cx-barW/2, cy+TILE_H*0.56, barW, 5, 2);
    objs.barBg = barBg;
    objs.barFill = scene.add.graphics().setDepth(20);
    objs._cx = cx; objs._cy = cy; objs._barW = barW;

    // Tap zone
    const zone = scene.add.zone(cx, cy-TILE_H*0.1, TILE_W*1.1, TILE_H*1.8).setInteractive().setDepth(21);
    zone.on('pointerdown', () => window.dispatchEvent(new CustomEvent('dk:customerTapped', {detail:{id:cust.id}})));
    objs.zone = zone;

    cust.objs = objs;
  }

  // Update patience bars
  setInterval(() => {
    const now = Date.now();
    Object.values(_customers).forEach(c => {
      if (c.served || c.leaving || !c.objs?.barFill) return;
      const pct = Math.max(0, 1 - (now-c.spawnedAt)/c.patienceMs);
      const col = pct>0.6 ? 0x22c55e : pct>0.3 ? 0xf59e0b : 0xef4444;
      const o = c.objs;
      o.barFill.clear();
      o.barFill.fillStyle(col, 1);
      o.barFill.fillRoundedRect(o._cx-o._barW/2, o._cy+TILE_H*0.56, o._barW*pct, 5, 2);
    });
  }, 50);

  function _custLeave(cust, served) {
    cust.leaving = true;
    const objs = cust.objs||{};
    const targets = Object.values(objs).filter(o=>o&&typeof o.setAlpha==='function');
    if (window.CHEF_SCENE && targets.length) {
      window.CHEF_SCENE.tweens.add({ targets, alpha:0, duration:320, onComplete:()=>_destroyCust(cust.id) });
    } else { _destroyCust(cust.id); }

    if (!served && window.CHEF_SCENE) {
      const s = window.CHEF_SCENE;
      const {x} = isoToScreen(cust.col, 0, s.originX, s.originY);
      s.showFloatText(x+TILE_W/2, (window.DK_COUNTER_Y||150)-TILE_H*0.6, '😤 Left!', '#ef4444', 12);
    }
  }

  function _destroyCust(id) {
    const c = _customers[id];
    if (c?.objs) Object.values(c.objs).forEach(o=>{try{o?.destroy?.();}catch{}});
    delete _customers[id];
  }

  function getCustomers() { return Object.values(_customers).filter(c=>!c.served&&!c.leaving); }

  function matchesOrder(custId, heldItems) {
    const c = _customers[custId];
    if (!c||heldItems.length!==c.order.length) return false;
    return [...heldItems].sort().every((v,i)=>[...c.order].sort()[i]===v);
  }

  function serveCustomer(custId, speedFactor) {
    const c = _customers[custId];
    if (!c||c.served) return 0;
    c.served = true;
    const base = c.order.reduce((s,t)=>s+(STATIONS[t]?.baseCoins||5),0);
    const earned = Math.ceil(base*(1+speedFactor*0.6));
    _custLeave(c, true);
    if (_onCoinEarned) {
      const s = window.CHEF_SCENE;
      const {x} = isoToScreen(c.col,0,s?.originX||0,s?.originY||0);
      _onCoinEarned(earned, x+TILE_W/2, window.DK_COUNTER_Y||150);
    }
    return earned;
  }

  function resetForNewShift() {
    Object.keys(_customers).forEach(_destroyCust);
    stopSpawning();
  }

  window.addEventListener('dk:sceneReady', ()=>{ /* ready, waiting for shift start */ });

  return { startSpawning, stopSpawning, getCustomers, matchesOrder, serveCustomer, resetForNewShift, setOnCoinEarned };
})();

window.CUSTOMER_MGR = CustomerManager;
