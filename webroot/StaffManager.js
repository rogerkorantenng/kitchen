// webroot/StaffManager.js — autonomous + VISIBLE staff for the assembly kitchen.
//   COOK   → runs its station: makers auto-brew; grills/fryers auto-pull a raw
//            ingredient from a matching bin and cook it (a patty/fries appears ready).
//   WAITER → carries finished dishes (drinks, fries, assembled burgers) to the
//            customers who ordered them, with a hop + a plated dish flying over.
// Burger ASSEMBLY stays player-driven for now (the skill dish).

const StaffManager = (() => {
  let _staff = [];
  let _active = false;
  let _cookAv = {};
  let _waiterAv = [];

  function _scene() { return window.CHEF_SCENE; }
  function waiterCount() { return _staff.filter(s => s.role === 'waiter').length; }
  function _announce() {
    window.dispatchEvent(new CustomEvent('dk:staffChanged', { detail: {
      waiters: waiterCount(), cooks: _staff.filter(s => s.role === 'cook').length } }));
  }

  function _cookStyle(seed) {
    const b = DrawChar.randomStyle(seed);
    return { skin: b.skin, hair: b.hair, hairStyle: 'short', shirt: 0xffffff, shirtDark: 0xe9e9e9, hat: 'chef', hatBand: 0xf97316, apron: true };
  }
  function _waiterStyle(seed) {
    const b = DrawChar.randomStyle(seed + 5);
    return { skin: b.skin, hair: b.hair, hairStyle: b.hairStyle, shirt: 0x2b3445, shirtDark: 0x171d28, bowtie: true };
  }

  function _makeAvatar(x, y, w, style, depth) {
    const scene = _scene();
    const g = scene.add.graphics().setDepth(depth);
    DrawChar.body(g, 0, 0, w, w * 0.95, style);
    g.setPosition(x, y);
    const av = { gfx: g, x, y, w };
    av.bob = scene.tweens.add({ targets: g, y: y - 4, duration: 850 + Math.random()*400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return av;
  }

  function _clearAvatars() {
    Object.values(_cookAv).forEach(a => { a.bob?.remove(); a.gfx.destroy(); });
    _waiterAv.forEach(a => { a.bob?.remove(); a.gfx.destroy(); });
    _cookAv = {}; _waiterAv = [];
  }

  function _buildAvatars() {
    const scene = _scene(), stMgr = window.STATION_MGR;
    if (!scene || !stMgr) return;
    _clearAvatars();
    _staff.filter(s => s.role === 'cook').forEach((s, i) => {
      const st = stMgr.getStations().find(x => x.id === s.stationId);
      if (!st || st._cx == null) return;
      const w = Math.min(st._w * 0.5, 46);
      _cookAv[s.stationId] = _makeAvatar(st._cx - st._w * 0.44, st._cy - st._h * 0.3, w, _cookStyle(i + 1), 19);
    });
    const n = waiterCount();
    const passY = scene.kitchenTop + scene.H * 0.02;
    for (let i = 0; i < n; i++) {
      const w = Math.min(scene.W * 0.1, 54);
      const x = scene.W * (i + 1) / (n + 1);
      _waiterAv.push(_makeAvatar(x, passY, w, _waiterStyle(i + 1), 34));
    }
  }

  function addCook(stationId) { _staff.push({ role: 'cook', stationId }); _announce(); _buildAvatars(); }
  function addWaiter() { _staff.push({ role: 'waiter' }); _announce(); _buildAvatars(); }
  function restore(list) { _staff = (list || []).map(s => ({ ...s })); _announce(); _buildAvatars(); }
  function beginShift() { _active = true; }
  function endShift() { _active = false; }

  function _hop(av) {
    const scene = _scene(); if (!scene) return;
    scene.tweens.add({ targets: av.gfx, scaleX: 1.12, scaleY: 0.9, duration: 110, yoyo: true });
  }

  function _tick() {
    if (!_active) return;
    const stMgr = window.STATION_MGR, custMgr = window.CUSTOMER_MGR, ctrl = window.CHEF_CTRL;
    if (!stMgr || !custMgr || !ctrl) return;

    // cooks run their assigned station
    _staff.filter(s => s.role === 'cook').forEach(s => {
      const inst = stMgr.getStations().find(i => i.id === s.stationId);
      if (!inst) return;
      if (inst.kind === 'maker' && inst.state === 'idle') stMgr.startMake(inst);
      else if (inst.kind === 'cook' && inst.state === 'idle') {
        const accepts = Object.keys(inst.def.accepts || {});
        const bin = stMgr.getStations().find(b => b.kind === 'bin' && accepts.includes(b.def.gives));
        if (bin) stMgr.startCook(inst, bin.def.gives);
      }
    });

    // waiters deliver finished dishes
    _waiterAv.forEach(av => {
      const sources = stMgr.servableSources();
      for (const src of sources) {
        const cust = custMgr.getCustomers().find(c => custMgr.customerNeeds(c.id, src.dish));
        if (cust) {
          const item = stMgr.takeFrom(src.inst);
          if (item) { ctrl.deliverDish(cust.id, item, { x: av.x, y: av.y + av.w * 0.3 }); _hop(av); break; }
        }
      }
    });
  }

  setInterval(_tick, 500);
  window.addEventListener('dk:sceneReady',     _buildAvatars);
  window.addEventListener('dk:relayout',       _buildAvatars);
  window.addEventListener('dk:kitchenRebuilt', _buildAvatars);

  return { addCook, addWaiter, restore, beginShift, endShift, waiterCount };
})();

window.STAFF_MGR = StaffManager;
