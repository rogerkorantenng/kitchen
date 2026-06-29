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
        <!-- Header with gradient -->
        <div style="
          background:linear-gradient(180deg,#5c3a1e 0%,#4a2e16 100%);
          padding:20px 16px 16px;
          text-align:center;
          border-bottom:3px solid #f97316;
          position:sticky;top:0;z-index:10;
          box-shadow:0 4px 20px rgba(0,0,0,0.4);
        ">
          <div style="font-size:26px;font-weight:900;color:#f97316;text-shadow:0 2px 8px rgba(249,115,22,0.4);">
            🍳 Shift Complete!
          </div>
          <div style="font-size:32px;font-weight:900;color:#fbbf24;margin:8px 0;text-shadow:0 2px 10px rgba(251,191,36,0.4);">
            🪙 ${_fmt(_shiftEarned)}
          </div>
          <div style="font-size:11px;color:#d4b896;opacity:0.8;">
            Total earned: 🪙 ${_fmt(_total)}
          </div>
        </div>

        <!-- Available coins bar -->
        <div style="
          display:flex;align-items:center;justify-content:center;gap:8px;
          padding:10px 16px;
          background:linear-gradient(90deg,#fff8f0,#fdf6e3);
          border-bottom:2px solid #d4b896;
          font-family:system-ui,sans-serif;
        ">
          <span style="font-size:12px;color:#8b5e3c;font-weight:600;">Available:</span>
          <span id="shop-avail" style="
            font-size:17px;font-weight:900;color:#f97316;
            background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);
            border-radius:16px;padding:2px 12px;
          ">🪙 ${_fmt(_coins)}</span>
        </div>

        <!-- Station upgrades -->
        <div style="padding:14px 14px 0;font-family:system-ui,sans-serif;">
          <div style="
            font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;
            color:#8b5e3c;margin-bottom:10px;
            display:flex;align-items:center;gap:8px;
          ">
            <div style="flex:1;height:1px;background:#d4b896;"></div>
            STATIONS
            <div style="flex:1;height:1px;background:#d4b896;"></div>
          </div>
          ${stations.length === 0 ? '<div style="color:#8b5e3c;font-size:12px;text-align:center;padding:8px;">No stations yet</div>' : ''}
          ${stations.map(st => {
            const meta  = STATIONS[st.type];
            const cost  = stMgr.getUpgradeCost(st.id);
            const maxed = st.level >= 4;
            const can   = _coins >= cost && !maxed;
            const lvlDescs = ['Basic cook','Faster (−20%)','Auto-cooks!','×2 output','Gold ✦ (−30%)'];
            const nextDesc = maxed ? 'Fully upgraded!' : (lvlDescs[st.level + 1] || 'Upgrade');
            return `<div style="
              display:flex;align-items:center;gap:12px;
              background:linear-gradient(135deg,#fff8f0,#fdf6e3);
              border:1.5px solid ${can?'rgba(249,115,22,0.4)':'#d4b896'};
              border-radius:14px;
              padding:10px 12px;
              margin-bottom:8px;
              box-shadow:0 2px 8px rgba(0,0,0,0.06);
            ">
              <div style="
                width:42px;height:42px;
                background:rgba(249,115,22,0.1);border:1.5px solid rgba(249,115,22,0.2);
                border-radius:12px;
                display:flex;align-items:center;justify-content:center;
                font-size:22px;flex-shrink:0;
              ">${meta.emoji}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:800;color:#1a0f00;">${meta.label}</div>
                <div style="font-size:9px;color:#f97316;font-weight:600;margin-top:1px;">
                  Next: ${nextDesc}
                </div>
                <div style="display:flex;gap:3px;margin-top:5px;">
                  ${[0,1,2,3,4].map(i=>`<div style="
                    width:12px;height:12px;border-radius:3px;
                    background:${i<=st.level?'#f97316':'#d4b896'};
                    box-shadow:${i<=st.level?'0 1px 4px rgba(249,115,22,0.4)':'none'};
                  "></div>`).join('')}
                </div>
              </div>
              <button onclick="window._shopUpgSt('${st.id}')" style="
                background:${can?'linear-gradient(135deg,#f97316,#e55c00)':'#d4b896'};
                color:#fff;border:none;border-radius:10px;
                padding:8px 12px;font-size:11px;font-weight:800;
                cursor:${can?'pointer':'not-allowed'};min-width:66px;
                box-shadow:${can?'0 3px 10px rgba(249,115,22,0.4)':'none'};
              " ${!can?'disabled':''}>
                ${maxed ? '✓ MAX' : '🪙 '+_fmt(cost)}
              </button>
            </div>`;
          }).join('')}
        </div>

        <!-- Chef upgrades -->
        <div style="padding:8px 14px 0;font-family:system-ui,sans-serif;">
          <div style="
            font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;
            color:#8b5e3c;margin-bottom:10px;
            display:flex;align-items:center;gap:8px;
          ">
            <div style="flex:1;height:1px;background:#d4b896;"></div>
            CHEF UPGRADES
            <div style="flex:1;height:1px;background:#d4b896;"></div>
          </div>
          ${Object.entries(SHOP_UPGRADES).map(([key, def]) => {
            const lvl  = _ups[key] || 0;
            const cost = Math.floor(def.baseCost * Math.pow(1.8, lvl));
            const maxed= lvl >= def.maxLevel;
            const can  = _coins >= cost && !maxed;
            const icons = { chefSpeed:'⚡', traySize:'🛒' };
            return `<div style="
              display:flex;align-items:center;gap:12px;
              background:linear-gradient(135deg,#f0fff4,#e8f8ef);
              border:1.5px solid ${can?'rgba(34,197,94,0.4)':'#d4b896'};
              border-radius:14px;padding:10px 12px;margin-bottom:8px;
              box-shadow:0 2px 8px rgba(0,0,0,0.06);
            ">
              <div style="
                width:42px;height:42px;
                background:rgba(34,197,94,0.1);border:1.5px solid rgba(34,197,94,0.2);
                border-radius:12px;display:flex;align-items:center;justify-content:center;
                font-size:22px;flex-shrink:0;
              ">${icons[key]||'⬆'}</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:800;color:#1a0f00;">${def.label}</div>
                <div style="font-size:9px;color:#22c55e;font-weight:600;margin-top:1px;">${def.desc}</div>
                <div style="display:flex;gap:3px;margin-top:5px;">
                  ${Array.from({length:def.maxLevel},(_,i)=>`<div style="
                    width:12px;height:12px;border-radius:3px;
                    background:${i<lvl?'#22c55e':'#d4b896'};
                    box-shadow:${i<lvl?'0 1px 4px rgba(34,197,94,0.4)':'none'};
                  "></div>`).join('')}
                </div>
              </div>
              <button onclick="window._shopUpgChef('${key}')" style="
                background:${can?'linear-gradient(135deg,#22c55e,#16a34a)':'#d4b896'};
                color:#fff;border:none;border-radius:10px;
                padding:8px 12px;font-size:11px;font-weight:800;
                cursor:${can?'pointer':'not-allowed'};min-width:66px;
                box-shadow:${can?'0 3px 10px rgba(34,197,94,0.4)':'none'};
              " ${!can?'disabled':''}>
                ${maxed ? '✓ MAX' : '🪙 '+_fmt(cost)}
              </button>
            </div>`;
          }).join('')}
        </div>

        <!-- Kitchen expansion -->
        ${_renderExpansion()}

        <!-- Next shift -->
        <div style="padding:14px 14px 24px;font-family:system-ui,sans-serif;">
          <button onclick="window._shopNext()" style="
            width:100%;padding:16px;
            background:linear-gradient(135deg,#f97316,#e55c00);
            color:#fff;border:none;border-radius:16px;
            font-size:17px;font-weight:900;cursor:pointer;
            box-shadow:0 4px 20px rgba(249,115,22,0.5);
            letter-spacing:0.5px;
            border-bottom:3px solid rgba(0,0,0,0.2);
          ">
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
    const pct = Math.min(1, _coins / td.unlockCost);
    return `
      <div style="padding:8px 14px 0;font-family:system-ui,sans-serif;">
        <div style="
          font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;
          color:#8b5e3c;margin-bottom:10px;
          display:flex;align-items:center;gap:8px;
        ">
          <div style="flex:1;height:1px;background:#d4b896;"></div>
          EXPAND KITCHEN
          <div style="flex:1;height:1px;background:#d4b896;"></div>
        </div>
        <div style="
          background:linear-gradient(135deg,${can?'#fff8e8':'#fff8f0'},${can?'#ffecc8':'#fdf6e3'});
          border:2px solid ${can?'#f97316':'#d4b896'};
          border-radius:16px;padding:12px 14px;
          box-shadow:${can?'0 4px 16px rgba(249,115,22,0.2)':'none'};
        ">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:30px;">🏗</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:800;color:#1a0f00;">${td.label}</div>
              <div style="font-size:9px;color:#8b5e3c;margin-top:2px;">More stations • Bigger kitchen • New recipes</div>
              ${!can ? `<div style="margin-top:6px;background:#e8e0d8;border-radius:4px;height:6px;overflow:hidden;">
                <div style="height:100%;width:${Math.round(pct*100)}%;background:linear-gradient(90deg,#f97316,#fbbf24);border-radius:4px;"></div>
              </div>
              <div style="font-size:8px;color:#8b5e3c;margin-top:3px;">🪙 ${_fmt(_coins)} / ${_fmt(td.unlockCost)}</div>` : ''}
            </div>
            <button onclick="window._shopExpand()" style="
              background:${can?'linear-gradient(135deg,#f97316,#e55c00)':'#d4b896'};
              color:#fff;border:none;border-radius:12px;
              padding:10px 14px;font-size:12px;font-weight:800;
              cursor:${can?'pointer':'not-allowed'};
              box-shadow:${can?'0 3px 12px rgba(249,115,22,0.4)':'none'};
              white-space:nowrap;
            " ${!can?'disabled':''}>
              ${can ? '🔓 Expand!' : '🪙 '+_fmt(td.unlockCost)}
            </button>
          </div>
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
