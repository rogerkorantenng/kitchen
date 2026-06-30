// webroot/HUD.js — top HUD overlay (HTML/CSS). pointer-events:none so taps reach Phaser.
// Shows: harbor + craving (left), day + shift timer (center), reputation + coins (right).

const HUD = (() => {
  function _fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return String(n);
  }

  let _coinShown = 0, _coinTarget = 0, _coinAnim = null;
  let _timerInterval = null;

  function _build() {
    const el = document.getElementById('hud-overlay');
    if (!el) return;
    el.innerHTML = `
      <div class="hud-bar">
        <div class="hud-left">
          <div id="hud-harbor" class="hud-harbor">⚓ r/Cooking</div>
          <div id="hud-craving" class="hud-craving"></div>
        </div>
        <div class="hud-center">
          <div id="hud-day" class="hud-day">DAY 1</div>
          <div id="hud-timer" class="hud-timer">1:00</div>
          <div id="hud-combo" class="hud-combo"></div>
          <div id="hud-rush" class="hud-rush"></div>
        </div>
        <div class="hud-right">
          <button id="hud-pause" class="hud-shop">⏸</button>
          <button id="hud-shop" class="hud-shop">🛒</button>
          <div class="hud-rc">
            <div id="hud-rep" class="hud-rep">⭐⭐⭐</div>
            <div class="hud-coins"><span class="hud-coin-i">🪙</span><span id="hud-coins">0</span></div>
          </div>
        </div>
      </div>
      <div class="hud-goal">
        <div class="hud-goal-track"><div id="hud-goal-fill" class="hud-goal-fill"></div></div>
        <span id="hud-goal-label" class="hud-goal-label">🎯 0 / 0</span>
      </div>`;
    // CSP-safe: bind the buttons via addEventListener (no inline onclick)
    const shopBtn = document.getElementById('hud-shop');
    if (shopBtn) shopBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dk:openShop')));
    const pauseBtn = document.getElementById('hud-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dk:pauseMenu')));
  }

  let _goal = 0, _shiftCoins = 0;
  function _updateGoal() {
    const fill = document.getElementById('hud-goal-fill'), lbl = document.getElementById('hud-goal-label');
    if (!fill || !lbl) return;
    const pct = _goal > 0 ? Math.min(1, _shiftCoins / _goal) : 0;
    fill.style.width = Math.round(pct * 100) + '%';
    fill.style.background = pct >= 1 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#f97316,#fbbf24)';
    lbl.textContent = (pct >= 1 ? '✅ ' : '🎯 ') + _fmt(_shiftCoins) + ' / ' + _fmt(_goal);
  }

  function _animateCoins() {
    if (_coinAnim) return;
    _coinAnim = setInterval(() => {
      const diff = _coinTarget - _coinShown;
      if (Math.abs(diff) < 1) { _coinShown = _coinTarget; clearInterval(_coinAnim); _coinAnim = null; }
      else _coinShown += diff * 0.28;
      const elc = document.getElementById('hud-coins');
      if (elc) elc.textContent = _fmt(_coinShown);
    }, 32);
  }

  function _startTimer(durationMs) {
    const endTime = Date.now() + durationMs;
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(() => {
      const rem = Math.max(0, endTime - Date.now());
      const secs = Math.ceil(rem / 1000);
      const el = document.getElementById('hud-timer');
      if (el) {
        el.textContent = `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
        el.classList.toggle('hud-timer-low', rem < 15000);
      }
      if (rem <= 0) clearInterval(_timerInterval);
    }, 200);
  }

  function _setRep(rep) {
    const el = document.getElementById('hud-rep');
    if (!el) return;
    const stars = Math.max(0, Math.min(5, Math.round(rep / 20)));
    el.textContent = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  // ── Events ────────────────────────────────────────────────────────────────────
  window.addEventListener('dk:coinsChanged', (ev) => {
    _coinTarget = ev.detail.coins; _animateCoins();
    if (ev.detail.shiftCoins != null) { _shiftCoins = ev.detail.shiftCoins; _updateGoal(); }
  });
  window.addEventListener('dk:repChanged',  (ev) => _setRep(ev.detail.rep));
  window.addEventListener('dk:comboChanged', (ev) => {
    const el = document.getElementById('hud-combo'); if (!el) return;
    const n = ev.detail.combo || 0;
    if (n >= 2) { el.textContent = '🔥 ×' + n; el.classList.add('on'); el.style.transform = 'scale(1.25)'; setTimeout(() => { el.style.transform = 'scale(1)'; }, 120); }
    else { el.textContent = ''; el.classList.remove('on'); }
  });
  window.addEventListener('dk:shiftStarted', (ev) => {
    _startTimer(ev.detail.durationMs);
    const d = document.getElementById('hud-day');
    if (d) d.textContent = 'DAY ' + (ev.detail.day || 1);
    _goal = ev.detail.goal || 0; _shiftCoins = 0; _updateGoal();
    const cb = document.getElementById('hud-combo'); if (cb) cb.textContent = '';
  });
  window.addEventListener('dk:shiftEnded', () => {
    if (_timerInterval) clearInterval(_timerInterval);
    const el = document.getElementById('hud-timer');
    if (el) { el.textContent = 'CLOSED'; el.classList.add('hud-timer-low'); }
  });
  window.addEventListener('dk:shiftPaused', () => {
    if (_timerInterval) clearInterval(_timerInterval);
    const el = document.getElementById('hud-timer');
    if (el) el.textContent = '⏸ ' + el.textContent;
  });
  window.addEventListener('dk:shiftResumed', (ev) => _startTimer(ev.detail.remainingMs));
  window.addEventListener('dk:rushStart', () => { const el = document.getElementById('hud-rush'); if (el) { el.textContent = '🔥 RUSH HOUR · 2× TIPS'; el.classList.add('on'); } });
  window.addEventListener('dk:rushEnd',   () => { const el = document.getElementById('hud-rush'); if (el) { el.textContent = ''; el.classList.remove('on'); } });
  window.addEventListener('dk:shiftEnded', () => { const el = document.getElementById('hud-rush'); if (el) { el.textContent = ''; el.classList.remove('on'); } });

  function _setHarbor(harborId, mults) {
    const h = document.getElementById('hud-harbor');
    const c = document.getElementById('hud-craving');
    if (h) h.textContent = `⚓ r/${harborId || 'Cooking'}`;
    if (c) c.textContent = (mults || []).slice(0, 2).map(m => `${m.label} ×${m.multiplier}`).join('  ');
  }
  window.addEventListener('devvit:INIT_RESPONSE', (ev) =>
    _setHarbor(ev.detail?.cravings?.harborId, ev.detail?.cravings?.cravings?.multipliers));
  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) =>
    _setHarbor(ev.detail?.harborId, ev.detail?.cravings?.multipliers));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _build);
  else _build();

  return {};
})();
