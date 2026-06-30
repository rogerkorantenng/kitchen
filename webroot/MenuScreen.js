// webroot/MenuScreen.js
// Start menu shown before the first shift: Play · Leaderboard · How to Play.
// The game boots here; tapping Play tells ChefController to begin the shift.
// CSP-safe: no inline onclick — one delegated listener bound with addEventListener.

const MenuScreen = (() => {
  let _view = 'main';            // 'main' | 'leaderboard' | 'howto' | 'reset' | 'feast'
  let _me = '';                  // current player's username (for "YOU" highlight)
  let _lb = null;                // cached leaderboard entries (null = loading)
  let _lbKind = 'renown';        // 'renown' (Top Chefs) | 'creators' (Top Creators)
  let _feast = null;             // cached community-feast progress (null = loading)
  let _myServes = 0;             // orders this player has completed this run
  let _shown = false;            // has the player left the menu yet this session?
  let _inGame = false;           // opened as a pause menu mid-shift? (Play → Resume)

  function _el() { return document.getElementById('menu-overlay'); }
  function _fmt(n) { n = Math.floor(n || 0); return n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n); }

  function show() {
    const el = _el(); if (!el) return;
    _shown = false; _view = 'main'; _inGame = false;
    el.style.display = 'block';
    _wire();
    _render();
  }
  // Opened from the in-game Pause button: freeze the shift and show the menu.
  // "Play" becomes "Resume" so the player drops right back into the same shift.
  function showPause() {
    const ctrl = window.CHEF_CTRL;
    if (ctrl?.isShiftActive?.()) { ctrl.pauseShift?.(); _inGame = true; } else { _inGame = false; }
    const el = _el(); if (!el) return;
    _shown = false; _view = 'main';
    el.style.display = 'block';
    _wire();
    _render();
  }
  function hide() {
    const el = _el(); if (!el) return;
    el.style.display = 'none';
    _shown = true;
  }

  function _wire() {
    const el = _el(); if (!el || el._dkWired) return;
    el._dkWired = true;
    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act]'); if (!btn) return;
      ev.preventDefault();
      const act = btn.dataset.act;
      if (act === 'play') {
        window.SFX?.coin?.();
        if (_inGame && window.CHEF_CTRL?.isPaused?.()) window.CHEF_CTRL.resumeShift();
        else window.CHEF_CTRL?.beginGame();
        _inGame = false; hide();
      }
      else if (act === 'leaderboard') { _view = 'leaderboard'; _render(); _fetchLeaderboard(); }
      else if (act === 'lbkind') { _lbKind = btn.dataset.kind; _render(); _fetchLeaderboard(); }
      else if (act === 'feast') { _view = 'feast'; _render(); _fetchFeast(); }
      else if (act === 'howto') { _view = 'howto'; _render(); }
      else if (act === 'reset') { _view = 'reset'; _render(); }
      else if (act === 'reset-confirm') { _doReset(); }
      else if (act === 'sound') { window.MUSIC?.toggle(); _render(); }
      else if (act === 'back') { _view = 'main'; _render(); }
    });
  }

  function _fetchLeaderboard() {
    _lb = null;                       // show loading
    const kind = _lbKind;
    try { send('GET_LEADERBOARD', { kind }); } catch (e) { /* dev/local */ }
    // dev/local fallback: no server will answer, so surface the empty state.
    window.setTimeout(() => { if (_lb === null && _view === 'leaderboard') { _lb = []; _render(); } }, 1800);
  }
  function _fetchFeast() {
    _feast = null;
    try { send('GET_FEAST_PROGRESS', {}); } catch (e) { /* dev/local */ }
    window.setTimeout(() => { if (_feast === null && _view === 'feast') { _feast = {}; _render(); } }, 1800);
  }

  // Wipe all saved progress and restart fresh. Server clears the save + drops the
  // player from the leaderboard; reloading re-inits into a brand-new game.
  function _doReset() {
    try { send('RESET_STATE', {}); } catch (e) { /* dev/local — nothing persisted */ }
    const el = _el();
    if (el) el.innerHTML = `<div class="menu-root"><div class="lb-loading" style="color:#fff">Resetting…</div></div>`;
    window.setTimeout(() => { try { location.reload(); } catch (e) { _view = 'main'; _render(); } }, 600);
  }

  // ── views ──────────────────────────────────────────────────────────────────
  function _render() {
    const el = _el(); if (!el) return;
    if (_view === 'leaderboard') el.innerHTML = _leaderboardHTML();
    else if (_view === 'howto')  el.innerHTML = _howtoHTML();
    else if (_view === 'reset')  el.innerHTML = _resetHTML();
    else if (_view === 'feast')  el.innerHTML = _feastHTML();
    else el.innerHTML = _mainHTML();
  }

  function _soundBtn() {
    const on = window.MUSIC ? window.MUSIC.isOn() : true;
    return `<button class="menu-sound" data-act="sound" title="Sound">${on ? '🔊' : '🔇'}</button>`;
  }

  function _mainHTML() {
    const playLabel = _inGame ? 'Resume' : 'Play';
    const sub = _inGame ? '⏸ Paused' : 'Cook · Serve · Earn · Upgrade';
    return `
      <div class="menu-root">
        ${_soundBtn()}
        <div class="menu-logo">🍳</div>
        <div class="menu-title">DRIFT <span class="accent">KITCHEN</span></div>
        <div class="menu-sub">${sub}</div>
        ${_feastBannerHTML()}
        <div class="menu-btns">
          <button class="menu-btn play" data-act="play"><span class="mb-ico">▶</span> ${playLabel}</button>
          <button class="menu-btn lb"   data-act="leaderboard"><span class="mb-ico">🏆</span> Leaderboard</button>
          <button class="menu-btn htp"  data-act="howto"><span class="mb-ico">❓</span> How to Play</button>
        </div>
        <button class="menu-reset" data-act="reset">⟲ Reset progress</button>
        <div class="menu-foot">${_inGame ? 'Resume to keep your current shift going' : 'Tap stations to cook · serve before customers leave'}</div>
      </div>`;
  }

  // Live subreddit-wide feast progress, shown as a tappable banner on the menu.
  function _feastBannerHTML() {
    const f = _feast;
    const prog = f && f.progress != null ? f.progress : null;
    const thr = (f && f.threshold) || 1000;
    const pct = prog != null ? Math.min(100, Math.round((prog / thr) * 100)) : 0;
    const label = prog != null ? `${_fmt(prog)} / ${_fmt(thr)} dishes` : 'Tap to see today’s goal';
    return `
      <button class="feast-banner" data-act="feast">
        <div class="feast-banner-top"><span>🍲 Community Feast</span><span class="feast-pct">${prog != null ? pct + '%' : '›'}</span></div>
        <div class="feast-track"><div class="feast-fill" style="width:${pct}%"></div></div>
        <div class="feast-sub">${label}</div>
      </button>`;
  }

  function _feastHTML() {
    const f = _feast;
    let body;
    if (_feast === null) {
      body = `<div class="lb-loading">Loading the feast…</div>`;
    } else {
      const prog = f.progress != null ? f.progress : 0;
      const thr = f.threshold || 1000;
      const pct = Math.min(100, Math.round((prog / thr) * 100));
      const done = prog >= thr;
      body = `
        <div class="feast-hero">${done ? '🎉' : '🍲'}</div>
        <div class="feast-headline">${done ? 'Feast complete!' : 'The whole subreddit is cooking together'}</div>
        <div class="feast-track big"><div class="feast-fill" style="width:${pct}%"></div></div>
        <div class="feast-nums">${_fmt(prog)} / ${_fmt(thr)} dishes served &nbsp;·&nbsp; ${pct}%</div>
        <div class="feast-you">🍽️ You’ve served <b>${_fmt(_myServes)}</b> this run</div>
        <div class="htp-tip">Every dish you serve adds to the community goal for r/Cooking. Hit the target together to unlock the weekly feast! 🔥</div>`;
    }
    return `
      <div class="menu-root">
        <div class="menu-panel">
          <div class="menu-panel-head">
            <div class="menu-panel-title">🍲 Community Feast</div>
            <button class="menu-panel-close" data-act="back">✕</button>
          </div>
          <div class="menu-panel-body" style="text-align:center">${body}</div>
          <div class="menu-panel-foot">
            <button class="menu-btn play" data-act="play"><span class="mb-ico">▶</span> ${_inGame ? 'Resume' : 'Play'}</button>
          </div>
        </div>
      </div>`;
  }

  function _resetHTML() {
    return `
      <div class="menu-root">
        <div class="menu-panel">
          <div class="menu-panel-head">
            <div class="menu-panel-title">⟲ Reset Progress</div>
            <button class="menu-panel-close" data-act="back">✕</button>
          </div>
          <div class="menu-panel-body">
            <div class="lb-empty" style="padding:18px 6px 8px">
              This erases <b>everything</b> — coins, station upgrades, hired staff,
              kitchen expansions and your leaderboard score — and starts a brand-new game.
              <br><br>This can't be undone.
            </div>
          </div>
          <div class="menu-panel-foot" style="display:flex;gap:10px">
            <button class="menu-btn" style="background:linear-gradient(135deg,#9ca3af,#6b7280);flex:1" data-act="back">Cancel</button>
            <button class="menu-btn" style="background:linear-gradient(135deg,#ef4444,#b91c1c);flex:1" data-act="reset-confirm">Reset</button>
          </div>
        </div>
      </div>`;
  }

  function _leaderboardHTML() {
    const creators = _lbKind === 'creators';
    const scoreIcon = creators ? '🍳' : '🪙';
    let body;
    if (_lb === null) {
      body = `<div class="lb-loading">Loading ${creators ? 'Top Creators' : 'Top Chefs'}…</div>`;
    } else if (_lb.length === 0) {
      body = creators
        ? `<div class="lb-empty">No creators yet.<br>Design a dish in the kitchen — when others cook it, you climb this board! 🧑‍🍳</div>`
        : `<div class="lb-empty">No chefs ranked yet.<br>Play a shift and bank some coins to claim the #1 spot! 🏆</div>`;
    } else {
      body = _lb.map((e, i) => {
        const rank = e.rank || (i + 1);
        const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const badge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const isMe = _me && e.username === _me;
        return `<div class="lb-row ${isMe ? 'me' : ''}">
          <div class="lb-rank ${medal}">${badge}</div>
          <div class="lb-name">${_escape(e.username || 'Chef')}${isMe ? '<span class="you">YOU</span>' : ''}</div>
          <div class="lb-score">${scoreIcon} ${_fmt(e.score)}</div>
        </div>`;
      }).join('');
    }
    return `
      <div class="menu-root">
        <div class="menu-panel">
          <div class="menu-panel-head">
            <div class="menu-panel-title">🏆 Leaderboard</div>
            <button class="menu-panel-close" data-act="back">✕</button>
          </div>
          <div class="lb-tabs">
            <button class="lb-tab ${creators ? '' : 'on'}" data-act="lbkind" data-kind="renown">🍳 Top Chefs</button>
            <button class="lb-tab ${creators ? 'on' : ''}" data-act="lbkind" data-kind="creators">🧑‍🍳 Top Creators</button>
          </div>
          <div class="menu-panel-body">${body}</div>
          <div class="menu-panel-foot">
            <button class="menu-btn play" data-act="play"><span class="mb-ico">▶</span> ${_inGame ? 'Resume' : 'Play'}</button>
          </div>
        </div>
      </div>`;
  }

  function _howtoHTML() {
    const steps = [
      ['🥩', 'Grab ingredients', 'Tap a bin (buns, patties…) to pick up an ingredient — or drag it straight onto a station.'],
      ['🔥', 'Cook it', 'Drop raw food on the grill or fryer. It cooks, then turns ready — but leave it too long and it burns!'],
      ['🍽️', 'Plate & assemble', 'Stack cooked items on a plate to build the dish — e.g. patty + bun makes a burger.'],
      ['🧑', 'Serve customers', 'Read each order ticket, then tap (or drag) the finished dish onto that customer before their patience runs out.'],
    ];
    return `
      <div class="menu-root">
        <div class="menu-panel">
          <div class="menu-panel-head">
            <div class="menu-panel-title">❓ How to Play</div>
            <button class="menu-panel-close" data-act="back">✕</button>
          </div>
          <div class="menu-panel-body">
            ${steps.map(([ico, t, p], i) => `
              <div class="htp-step">
                <div class="htp-num">${i + 1}</div>
                <div class="htp-txt"><b>${ico} ${t}</b><p>${p}</p></div>
              </div>`).join('')}
            <div class="htp-tip">💰 <b>Earn coins</b> from every order. Spend them at the 🛒 shop to <b>upgrade stations</b> (cook more at once), <b>hire staff</b> who cook & serve for you, and <b>expand</b> your kitchen.</div>
            <div class="htp-tip">⚡ <b>Combo & speed bonuses:</b> serve fast and back-to-back to multiply your tips!</div>
          </div>
          <div class="menu-panel-foot">
            <button class="menu-btn play" data-act="play"><span class="mb-ico">▶</span> Play</button>
          </div>
        </div>
      </div>`;
  }

  function _escape(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ── server hookups ───────────────────────────────────────────────────────────
  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    _me = ev.detail?.username || _me;
    // prime the feast banner so it shows live progress on the very first menu view
    _fetchFeast();
  });
  window.addEventListener('devvit:LEADERBOARD_DATA', (ev) => {
    if (_view !== 'leaderboard') return;
    _lb = ev.detail?.entries || [];
    _render();
  });
  window.addEventListener('devvit:FEAST_PROGRESS', (ev) => {
    _feast = ev.detail || {};
    if (_view === 'feast' || _view === 'main') _render();
  });
  // count this player's completed orders → "you've served N" on the feast screen
  window.addEventListener('dk:custServed', () => { _myServes++; });

  // In-game Pause button (HUD) opens this menu with the shift frozen.
  window.addEventListener('dk:pauseMenu', showPause);

  // Show the menu as soon as the page is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }

  return { show, showPause, hide };
})();

window.MENU_SCREEN = MenuScreen;
