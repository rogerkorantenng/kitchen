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
        </div>
        <div class="hud-right">
          <div id="hud-rep" class="hud-rep">⭐⭐⭐</div>
          <div class="hud-coins"><span class="hud-coin-i">🪙</span><span id="hud-coins">0</span></div>
        </div>
      </div>`;
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
  window.addEventListener('dk:coinsChanged', (ev) => { _coinTarget = ev.detail.coins; _animateCoins(); });
  window.addEventListener('dk:repChanged',  (ev) => _setRep(ev.detail.rep));
  window.addEventListener('dk:shiftStarted', (ev) => {
    _startTimer(ev.detail.durationMs);
    const d = document.getElementById('hud-day');
    if (d) d.textContent = 'DAY ' + (ev.detail.day || 1);
  });
  window.addEventListener('dk:shiftEnded', () => {
    if (_timerInterval) clearInterval(_timerInterval);
    const el = document.getElementById('hud-timer');
    if (el) { el.textContent = 'CLOSED'; el.classList.add('hud-timer-low'); }
  });

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
