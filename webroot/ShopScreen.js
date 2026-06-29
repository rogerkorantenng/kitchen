// webroot/ShopScreen.js
// Between-shift HTML/CSS upgrade shop.
// Shown when dk:shiftEnded fires. Hides when player clicks Next Shift.

const ShopScreen = (() => {
  let _coins      = 0;
  let _total      = 0;
  let _shiftEarned = 0;
  let _tier       = 1;
  let _ups        = { chefSpeed: 0, traySize: 0 };

  function _fmt(n) {
    n = Math.floor(n);
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return String(n);
  }

  function show(shiftEarned, total) {
    _shiftEarned = shiftEarned;
    _total = total;
    _coins = total;
    const el = document.getElementById('shop-overlay');
    if (!el) return;
    el.style.display = 'block';
    _render(el);
  }

  function hide() {
    const el = document.getElementById('shop-overlay');
    if (el) el.style.display = 'none';
  }

  function _render(el) {
    const stMgr = window.STATION_MGR;
    const stations = stMgr?.getStations() || [];

    el.innerHTML = `
      <div style="
        min-height:100%;
        background:linear-gradient(180deg,#fdf6e3 0%,#f5e6d3 100%);
        font-family:system-ui,sans-serif;
        padding-bottom:40px;
      ">
        <!-- Header -->
        <div style="background:#4a3728;padding:18px 16px;text-align:center;border-bottom:3px solid #f97316;position:sticky;top:0;z-index:10;">
          <div style="font-size:22px;font-weight:900;color:#f97316;">🍳 Shift Complete!</div>
          <div style="font-size:26px;font-weight:800;color:#fbbf24;margin:5px 0;">🪙 ${_fmt(_shiftEarned)}</div>
          <div style="font-size:11px;color:#d4b896;">Lifetime total: 🪙 ${_fmt(_total)}</div>
        </div>

        <!-- Available coins -->
        <div style="text-align:center;padding:10px 16px;font-size:13px;color:#4a3728;font-weight:700;background:#fff8f0;border-bottom:1px solid #d4b896;">
          Spend now: <span id="shop-avail" style="color:#f97316;font-size:15px;font-weight:800;">🪙 ${_fmt(_coins)}</span>
        </div>

        <!-- Station upgrades -->
        <div style="padding:12px 14px 0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b5e3c;margin-bottom:8px;">STATIONS</div>
          ${stations.length === 0 ? '<div style="color:#8b5e3c;font-size:12px;">No stations yet</div>' : ''}
          ${stations.map(st => {
            const meta  = STATIONS[st.type];
            const cost  = stMgr.getUpgradeCost(st.id);
            const maxed = st.level >= 4;
            const can   = _coins >= cost && !maxed;
            const lvlDescs = ['Basic','Faster (−20%)','Auto-cook!','×2 output','Gold (−30%)'];
            return `<div style="display:flex;align-items:center;gap:10px;background:#fff8f0;border:1px solid #d4b896;border-radius:10px;padding:8px 10px;margin-bottom:7px;">
              <span style="font-size:22px;flex-shrink:0;">${meta.emoji}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:700;color:#1a0f00;">${meta.label}</div>
                <div style="font-size:9px;color:#8b5e3c;">${lvlDescs[st.level] || 'MAX'}</div>
                <div style="display:flex;gap:3px;margin-top:4px;">
                  ${[0,1,2,3,4].map(i=>`<div style="width:10px;height:10px;border-radius:50%;background:${i<=st.level?'#f97316':'#d4b896'};"></div>`).join('')}
                </div>
              </div>
              <button onclick="window._shopUpgSt('${st.id}')"
                style="background:${can?'#f97316':'#d4b896'};color:#fff;border:none;border-radius:8px;padding:7px 11px;font-size:10px;font-weight:700;cursor:${can?'pointer':'not-allowed'};min-width:62px;"
                ${!can?'disabled':''}>
                ${maxed ? 'MAX ✓' : '🪙'+_fmt(cost)}
              </button>
            </div>`;
          }).join('')}
        </div>

        <!-- Chef upgrades -->
        <div style="padding:8px 14px 0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b5e3c;margin-bottom:8px;">CHEF</div>
          ${Object.entries(SHOP_UPGRADES).map(([key, def]) => {
            const lvl  = _ups[key] || 0;
            const cost = Math.floor(def.baseCost * Math.pow(1.8, lvl));
            const maxed= lvl >= def.maxLevel;
            const can  = _coins >= cost && !maxed;
            return `<div style="display:flex;align-items:center;gap:10px;background:#fff8f0;border:1px solid #d4b896;border-radius:10px;padding:8px 10px;margin-bottom:7px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:700;color:#1a0f00;">${def.label}</div>
                <div style="font-size:9px;color:#8b5e3c;">${def.desc}</div>
                <div style="display:flex;gap:3px;margin-top:4px;">
                  ${Array.from({length:def.maxLevel},(_,i)=>`<div style="width:10px;height:10px;border-radius:50%;background:${i<lvl?'#f97316':'#d4b896'};"></div>`).join('')}
                </div>
              </div>
              <button onclick="window._shopUpgChef('${key}')"
                style="background:${can?'#22c55e':'#d4b896'};color:#fff;border:none;border-radius:8px;padding:7px 11px;font-size:10px;font-weight:700;cursor:${can?'pointer':'not-allowed'};min-width:62px;"
                ${!can?'disabled':''}>
                ${maxed ? 'MAX ✓' : '🪙'+_fmt(cost)}
              </button>
            </div>`;
          }).join('')}
        </div>

        <!-- Kitchen expansion -->
        ${_renderExpansion()}

        <!-- Next shift -->
        <div style="padding:14px 14px 0;">
          <button onclick="window._shopNext()"
            style="width:100%;padding:15px;background:#f97316;color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(249,115,22,0.4);">
            ▶ Next Shift
          </button>
        </div>
      </div>
    `;
  }

  function _renderExpansion() {
    const next = _tier + 1;
    if (next > 5) return '';
    const td  = KITCHEN_TIERS[next];
    const can = _coins >= td.unlockCost;
    return `
      <div style="padding:8px 14px 0;">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b5e3c;margin-bottom:8px;">EXPAND KITCHEN</div>
        <div style="background:#fff8f0;border:2px solid ${can?'#f97316':'#d4b896'};border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:26px;">🏗</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:#1a0f00;">${td.label}</div>
            <div style="font-size:9px;color:#8b5e3c;">Bigger kitchen + new stations unlock</div>
          </div>
          <button onclick="window._shopExpand()"
            style="background:${can?'#f97316':'#d4b896'};color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;cursor:${can?'pointer':'not-allowed'};"
            ${!can?'disabled':''}>
            🪙${_fmt(td.unlockCost)}
          </button>
        </div>
      </div>`;
  }

  function _refresh() {
    const el = document.getElementById('shop-overlay');
    if (el && el.style.display !== 'none') _render(el);
    const av = document.getElementById('shop-avail');
    if (av) av.textContent = '🪙 ' + _fmt(_coins);
  }

  // ── onclick handlers (global so HTML onclick="" can reach them) ─────────────
  window._shopUpgSt = (id) => {
    const stMgr = window.STATION_MGR;
    const cost = stMgr?.getUpgradeCost(id) || Infinity;
    if (_coins < cost) return;
    _coins -= cost; _total -= cost;
    stMgr.upgradeStation(id);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins } }));
    _refresh();
  };

  window._shopUpgChef = (key) => {
    const def = SHOP_UPGRADES[key]; if (!def) return;
    const lvl  = _ups[key] || 0;
    const cost = Math.floor(def.baseCost * Math.pow(1.8, lvl));
    if (_coins < cost || lvl >= def.maxLevel) return;
    _coins -= cost; _total -= cost;
    _ups[key] = lvl + 1;
    if (key === 'chefSpeed') window.CHEF_CTRL?.upgradeChefSpeed(_ups[key]);
    if (key === 'traySize')  window.CHEF_CTRL?.upgradeTraySize(_ups[key]);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins } }));
    _refresh();
  };

  window._shopExpand = () => {
    const next = _tier + 1; if (next > 5) return;
    const cost = KITCHEN_TIERS[next]?.unlockCost || Infinity;
    if (_coins < cost) return;
    _coins -= cost; _total -= cost;
    _tier = next;
    window.CHEF_CTRL?.setKitchenTier(next);
    window.CHEF_SCENE?.rebuildKitchen(next);
    window.STATION_MGR?.rebuildForTier(next);
    window.dispatchEvent(new CustomEvent('dk:coinsChanged', { detail: { coins: _coins } }));
    window.dispatchEvent(new CustomEvent('dk:kitchenExpanded', { detail: { tier: next } }));
    _refresh();
  };

  window._shopNext = () => {
    hide();
    // Save to server
    send('SAVE_STATE', { state: {
      saveVersion:1, coins:_coins, renown:0, tradeTokens:0,
      lifetimeCoinsThisRun:_total, stations:[], crew:[],
      voyageCount:0, unlockedCuisineTiers: _tier - 1,
      incomeMultiplierLevel:0, offlineCapLevel:0,
      offlineEffLevel:_ups.traySize || 0,
      cookSpeedLevel:_ups.chefSpeed || 0,
      startingCoinsLevel:0, extraRerollUnlocked:false, royaltyBoostLevel:0,
      streak:0, lastStreakDate:'', rerollsToday:0,
      lastSeen:Date.now(), incomePerSec:0,
    }});
    window.CHEF_CTRL?.startShift(_tier);
    window.dispatchEvent(new CustomEvent('dk:shopClosed'));
  };

  // ── Listeners ───────────────────────────────────────────────────────────────
  window.addEventListener('dk:shiftEnded', (ev) => {
    window.setTimeout(() => show(ev.detail.coins, ev.detail.total), 1300);
  });

  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    _coins = ev.detail?.state?.coins || 0;
    _total = _coins;
    _tier  = Math.min(5, (ev.detail?.state?.unlockedCuisineTiers || 0) + 1);
    _ups.chefSpeed = ev.detail?.state?.cookSpeedLevel || 0;
    _ups.traySize  = ev.detail?.state?.offlineEffLevel || 0;
  });

  return { show, hide };
})();

window.SHOP_SCREEN = ShopScreen;
