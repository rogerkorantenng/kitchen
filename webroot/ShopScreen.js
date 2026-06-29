// webroot/ShopScreen.js
// Between-shift / end-of-day overlay: summary + upgrade & hiring shop.
// Shown when dk:shiftEnded fires; hidden on "Open for Day N+1".
// Coins are kept in sync with ChefController (the single source of truth).

const ShopScreen = (() => {
  let _coins = 0, _total = 0, _shiftEarned = 0, _served = 0, _rep = 60, _day = 1;
  let _tier = 1, _mode = 'end', _goalStars = 0, _goalAmt = 0;
  let _ups = { chefSpeed: 0, traySize: 0 };

  function _fmt(n) { n = Math.floor(n); return n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n); }
  function _sync() { window.CHEF_CTRL?.setCoins(_coins); }

  function show(detail) {
    _mode = 'end';
    _shiftEarned = detail.coins || 0;
    _total = detail.total || 0;
    _coins = _total;
    _served = detail.served || 0;
    _rep = detail.rep != null ? detail.rep : _rep;
    _day = detail.day || _day;
    _goalStars = detail.goalStars != null ? detail.goalStars : 0;
    _goalAmt = detail.goal || 0;
    const el = document.getElementById('shop-overlay');
    if (!el) return;
    el.style.display = 'block';
    _render(el);
  }
  // Open mid-shift (pauses the shift); purchases take effect immediately.
  function openInShift() {
    const ctrl = window.CHEF_CTRL; if (!ctrl) return;
    _mode = 'shift';
    _coins = ctrl.getCoins(); _total = _coins;
    _day = ctrl.getDay(); _rep = ctrl.getRep(); _tier = ctrl.getTier();
    const el = document.getElementById('shop-overlay'); if (!el) return;
    el.style.display = 'block';
    _render(el);
    ctrl.pauseShift();
  }
  function hide() { const el = document.getElementById('shop-overlay'); if (el) el.style.display = 'none'; }

  function _section(title) {
    return `<div class="shop-sec-title"><span></span>${title}<span></span></div>`;
  }

  function _render(el) {
    const stMgr = window.STATION_MGR;
    const stations = stMgr?.upgradableStations() || [];
    const stars = Math.max(0, Math.min(5, Math.round(_rep / 20)));

    el.innerHTML = `
      <div class="shop-root">
        <div class="shop-header">
          <div class="shop-h-title">${_mode === 'shift' ? '🛒 Upgrade Shop' : '🍳 Day ' + _day + ' Complete!'}</div>
          <div class="shop-h-earned">🪙 ${_fmt(_mode === 'shift' ? _coins : _shiftEarned)}</div>
          <div class="shop-h-stats">
            <span>${_mode === 'shift' ? '⏸ Day ' + _day : '🍽 ' + _served + ' served'}</span>
            <span>${_mode === 'shift'
              ? '⭐'.repeat(stars) + '☆'.repeat(5 - stars)
              : '⭐'.repeat(_goalStars) + '☆'.repeat(3 - _goalStars)}</span>
          </div>
          ${_mode === 'shift' ? '' : `<div class="shop-h-goal">${_goalStars >= 3 ? 'Goal smashed! 🎉' : _goalStars > 0 ? 'Keep going!' : 'Goal missed'} &nbsp;🪙 ${_fmt(_shiftEarned)} / ${_fmt(_goalAmt)}</div>`}
        </div>

        <div class="shop-avail-bar">
          <span>Coins to spend</span>
          <span id="shop-avail" class="shop-avail">🪙 ${_fmt(_coins)}</span>
        </div>

        <div class="shop-body">
          ${_section('UPGRADE STATIONS')}
          ${stations.map(_stationCard).join('') || '<div class="shop-empty">No stations yet</div>'}

          ${_section('HIRE STAFF — they work while you work')}
          ${_renderStaff(stations)}

          ${_section('CHEF UPGRADES')}
          ${Object.entries(SHOP_UPGRADES).map(_chefCard).join('')}

          ${_renderExpansion()}
        </div>

        <div class="shop-foot">
          ${_mode === 'shift'
            ? `<button onclick="window._shopResume()" class="shop-next">▶ Resume Cooking</button>`
            : `<button onclick="window._shopNext()" class="shop-next">▶ Open for Day ${_day + 1}</button>`}
        </div>
      </div>`;
  }

  function _stationCard(st) {
    const stMgr = window.STATION_MGR;
    const meta = STATION_DEFS[st.defId];
    const cost = stMgr.getUpgradeCost(st);
    const maxed = st.level >= 3;
    const can = _coins >= cost && !maxed;
    const next = maxed ? 'Fully upgraded' : 'Faster cooking';
    return `<div class="shop-card ${can?'aff':''}">
      <div class="shop-icon orange">${meta.emoji}</div>
      <div class="shop-info">
        <div class="shop-name">${meta.label}</div>
        <div class="shop-desc orange">Next: ${next}</div>
        <div class="shop-pips">${[0,1,2].map(i=>`<i class="${i<st.level?'on':''}"></i>`).join('')}</div>
      </div>
      <button onclick="window._shopUpgSt('${st.id}')" class="shop-buy ${can?'':'off'}" ${can?'':'disabled'}>
        ${maxed ? '✓ MAX' : '🪙 '+_fmt(cost)}</button>
    </div>`;
  }

  function _chefCard([key, def]) {
    const lvl = _ups[key] || 0;
    const cost = Math.floor(def.baseCost * Math.pow(1.8, lvl));
    const maxed = lvl >= def.maxLevel;
    const can = _coins >= cost && !maxed;
    return `<div class="shop-card green ${can?'aff':''}">
      <div class="shop-icon greenbg">${def.icon || '⬆'}</div>
      <div class="shop-info">
        <div class="shop-name">${def.label}</div>
        <div class="shop-desc green">${def.desc}</div>
        <div class="shop-pips">${Array.from({length:def.maxLevel},(_,i)=>`<i class="${i<lvl?'on green':''}"></i>`).join('')}</div>
      </div>
      <button onclick="window._shopUpgChef('${key}')" class="shop-buy green ${can?'':'off'}" ${can?'':'disabled'}>
        ${maxed ? '✓ MAX' : '🪙 '+_fmt(cost)}</button>
    </div>`;
  }

  function _renderStaff(stations) {
    const staff = window.CHEF_CTRL?.getStaff() || [];
    const cookStations = new Set(staff.filter(s => s.role === 'cook').map(s => s.stationId));
    const cookCount = staff.filter(s => s.role === 'cook').length;
    const waiterCount = staff.filter(s => s.role === 'waiter').length;

    let html = '';
    // one cook per cook/maker station (auto-runs it)
    stations.forEach(st => {
      const meta = STATION_DEFS[st.defId];
      const hired = cookStations.has(st.id);
      const cost = Math.floor(STAFF.cook.baseCost * Math.pow(STAFF.cook.costMult, cookCount));
      const can = !hired && _coins >= cost;
      html += `<div class="shop-card ${can?'aff':''}">
        <div class="shop-icon bluebg">${STAFF.cook.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">Cook · ${meta.label}</div>
          <div class="shop-desc blue">${hired ? '✓ Auto-cooking this station' : 'Keeps this station cooking'}</div>
        </div>
        ${hired ? '<button class="shop-buy off" disabled>✓ HIRED</button>'
          : `<button onclick="window._shopHireCook('${st.id}')" class="shop-buy blue ${can?'':'off'}" ${can?'':'disabled'}>🪙 ${_fmt(cost)}</button>`}
      </div>`;
    });
    // waiters (auto-serve)
    const wcost = Math.floor(STAFF.waiter.baseCost * Math.pow(STAFF.waiter.costMult, waiterCount));
    const wcan = _coins >= wcost;
    html += `<div class="shop-card ${wcan?'aff':''}">
      <div class="shop-icon bluebg">${STAFF.waiter.emoji}</div>
      <div class="shop-info">
        <div class="shop-name">Waiter ${waiterCount ? '×'+waiterCount : ''}</div>
        <div class="shop-desc blue">${STAFF.waiter.desc} — delivers ready dishes</div>
      </div>
      <button onclick="window._shopHireWaiter()" class="shop-buy blue ${wcan?'':'off'}" ${wcan?'':'disabled'}>🪙 ${_fmt(wcost)}</button>
    </div>`;
    return html;
  }

  function _renderExpansion() {
    const next = _tier + 1;
    if (next > 5) return '';
    const td = KITCHEN_TIERS[next];
    const can = _coins >= td.unlockCost;
    const pct = Math.min(1, _coins / td.unlockCost);
    return `${_section('EXPAND KITCHEN')}
      <div class="shop-expand ${can?'aff':''}">
        <div class="shop-icon">🏗</div>
        <div class="shop-info">
          <div class="shop-name">${td.label}</div>
          <div class="shop-desc">More stations • bigger floor • new recipes</div>
          ${!can ? `<div class="shop-bar"><div style="width:${Math.round(pct*100)}%"></div></div>
            <div class="shop-desc">🪙 ${_fmt(_coins)} / ${_fmt(td.unlockCost)}</div>` : ''}
        </div>
        <button onclick="window._shopExpand()" class="shop-buy ${can?'':'off'}" ${can?'':'disabled'}>
          ${can ? '🔓 Expand' : '🪙 '+_fmt(td.unlockCost)}</button>
      </div>`;
  }

  function _refresh() {
    const el = document.getElementById('shop-overlay');
    if (el && el.style.display !== 'none') _render(el);
  }

  // ── onclick handlers (global) ────────────────────────────────────────────────
  window._shopUpgSt = (id) => {
    const cost = window.STATION_MGR?.getUpgradeCost(id) || Infinity;
    if (_coins < cost) return;
    _coins -= cost; _total -= cost; _sync();
    window.STATION_MGR.upgradeStation(id); _refresh();
  };
  window._shopUpgChef = (key) => {
    const def = SHOP_UPGRADES[key]; if (!def) return;
    const lvl = _ups[key] || 0;
    const cost = Math.floor(def.baseCost * Math.pow(1.8, lvl));
    if (_coins < cost || lvl >= def.maxLevel) return;
    _coins -= cost; _total -= cost; _ups[key] = lvl + 1; _sync();
    if (key === 'chefSpeed') window.CHEF_CTRL?.upgradeChefSpeed(_ups[key]);
    if (key === 'traySize')  window.CHEF_CTRL?.upgradeTraySize(_ups[key]);
    _refresh();
  };
  window._shopHireCook = (stationId) => {
    const cookCount = (window.CHEF_CTRL?.countStaff('cook')) || 0;
    const cost = Math.floor(STAFF.cook.baseCost * Math.pow(STAFF.cook.costMult, cookCount));
    if (_coins < cost) return;
    _coins -= cost; _total -= cost; _sync();
    window.CHEF_CTRL?.hireCook(stationId); _refresh();
  };
  window._shopHireWaiter = () => {
    const wc = (window.CHEF_CTRL?.countStaff('waiter')) || 0;
    const cost = Math.floor(STAFF.waiter.baseCost * Math.pow(STAFF.waiter.costMult, wc));
    if (_coins < cost) return;
    _coins -= cost; _total -= cost; _sync();
    window.CHEF_CTRL?.hireWaiter(); _refresh();
  };
  window._shopExpand = () => {
    const next = _tier + 1; if (next > 5) return;
    const cost = KITCHEN_TIERS[next]?.unlockCost || Infinity;
    if (_coins < cost) return;
    _coins -= cost; _total -= cost; _tier = next; _sync();
    window.CHEF_CTRL?.setKitchenTier(next);
    window.CHEF_SCENE?.rebuildKitchen(next);
    window.STATION_MGR?.rebuildForTier(next);
    window.dispatchEvent(new CustomEvent('dk:kitchenExpanded', { detail: { tier: next } }));
    _refresh();
  };
  window._shopNext = () => {
    hide();
    _sync();
    _persist();
    window.CHEF_CTRL?.startShift(_tier);
    window.dispatchEvent(new CustomEvent('dk:shopClosed'));
  };

  function _persist() {
    const staff = window.CHEF_CTRL?.getStaff() || [];
    const cookStations = new Set(staff.filter(s => s.role === 'cook').map(s => s.stationId));
    const waiters = staff.filter(s => s.role === 'waiter').length;
    const stations = (window.STATION_MGR?.getStations() || []).map((st, i) => ({
      id: st.id, x: i, y: 0, stationType: st.defId, level: st.level,
      hasCook: cookStations.has(st.id), hasServer: false,
    }));
    const crew = Array.from({ length: waiters }, (_, i) => ({
      slotIndex: i, personality: 'steady', name: 'Waiter ' + (i+1), subredditOrigin: '',
    }));
    send('SAVE_STATE', { state: {
      saveVersion: 1, coins: _coins, renown: 0, tradeTokens: 0,
      lifetimeCoinsThisRun: _total, stations, crew,
      voyageCount: 0, unlockedCuisineTiers: _tier - 1,
      incomeMultiplierLevel: 0, offlineCapLevel: 0,
      offlineEffLevel: _ups.traySize || 0, cookSpeedLevel: _ups.chefSpeed || 0,
      startingCoinsLevel: 0, extraRerollUnlocked: false, royaltyBoostLevel: 0,
      streak: 0, lastStreakDate: '', rerollsToday: 0,
      lastSeen: Date.now(), incomePerSec: 0,
    }});
  }

  window._shopResume = () => {
    hide(); _sync(); _persist();
    window.CHEF_CTRL?.resumeShift();
    window.dispatchEvent(new CustomEvent('dk:shopClosed'));
  };

  // ── Listeners ─────────────────────────────────────────────────────────────────
  window.addEventListener('dk:shiftEnded', (ev) => { window.setTimeout(() => show(ev.detail), 1100); });
  window.addEventListener('dk:openShop', () => openInShift());
  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const st = ev.detail?.state || {};
    _coins = st.coins || 0; _total = _coins;
    _tier = Math.min(5, (st.unlockedCuisineTiers || 0) + 1);
    _ups.chefSpeed = st.cookSpeedLevel || 0;
    _ups.traySize = st.offlineEffLevel || 0;
  });

  return { show, hide, openInShift };
})();

window.SHOP_SCREEN = ShopScreen;
