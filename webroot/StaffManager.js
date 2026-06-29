// webroot/StaffManager.js — autonomous staff for the tap-to-cook game ("hire people
// who work while you work"). No walking NPCs — staff are automation:
//   COOK   → keeps its assigned station cooking (auto-taps it).
//   WAITER → plates ready dishes and serves customers who ordered them.
// Cooks show a 👨‍🍳 badge on their station; waiter count is reported to the HUD.

const StaffManager = (() => {
  let _staff = [];     // { role, stationId? }
  let _active = false;

  function addCook(stationId) { _staff.push({ role: 'cook', stationId }); _announce(); }
  function addWaiter() { _staff.push({ role: 'waiter' }); _announce(); }
  function restore(list) { _staff = (list || []).map(s => ({ ...s })); _announce(); }
  function beginShift() { _active = true; }
  function endShift() { _active = false; }
  function waiterCount() { return _staff.filter(s => s.role === 'waiter').length; }
  function _announce() { window.dispatchEvent(new CustomEvent('dk:staffChanged', { detail: { waiters: waiterCount(), cooks: _staff.filter(s => s.role === 'cook').length } })); }

  function _tick() {
    if (!_active) return;
    const stMgr = window.STATION_MGR, custMgr = window.CUSTOMER_MGR, ctrl = window.CHEF_CTRL;
    if (!stMgr || !custMgr || !ctrl) return;

    // Cooks keep their stations producing
    _staff.filter(s => s.role === 'cook').forEach(s => {
      if (!stMgr.isCooking(s.stationId) && !stMgr.isReady(s.stationId)) stMgr.startCooking(s.stationId);
    });

    // Waiters: each plates one ready dish that a customer wants, and serves it
    const waiters = _staff.filter(s => s.role === 'waiter').length;
    for (let w = 0; w < waiters; w++) {
      const ready = stMgr.getStations().filter(st => stMgr.isReady(st.id));
      let done = false;
      for (const st of ready) {
        const cust = custMgr.getCustomers().find(c => custMgr.customerNeeds(c.id, st.type));
        if (cust) {
          const dish = stMgr.pickUp(st.id);
          if (dish) { ctrl.deliverDish(cust.id, dish); done = true; break; }
        }
      }
      if (!done) break;
    }
  }

  setInterval(_tick, 500);

  return { addCook, addWaiter, restore, beginShift, endShift, waiterCount };
})();

window.STAFF_MGR = StaffManager;
