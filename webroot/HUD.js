// webroot/HUD.js
// HTML/CSS overlay HUD — top bar: coins, timer, harbor, craving badges.
// Injected into #hud-overlay. Pointer-events: none so Phaser gets all taps.

const HUD = (() => {
  function _fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return String(n);
  }

  function _build() {
    const el = document.getElementById('hud-overlay');
    if (!el) return;
    el.innerHTML = `
      <div style="
        display:flex; align-items:center; gap:8px;
        padding:5px 12px;
        background:rgba(26,15,0,0.86);
        backdrop-filter:blur(3px);
        border-bottom:2px solid #f97316;
        font-family:system-ui,sans-serif;
        pointer-events:none;
      ">
        <!-- Harbor + craving -->
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div id="hud-harbor" style="font-size:11px;font-weight:700;color:#38bdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ⚓ r/Cooking
          </div>
          <div id="hud-craving" style="font-size:9px;color:#fbbf24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">
          </div>
        </div>

        <!-- Shift timer -->
        <div style="text-align:center;flex-shrink:0;">
          <div id="hud-timer" style="font-size:15px;font-weight:900;color:#e6edf3;letter-spacing:1px;">
            ⏱ 1:00
          </div>
        </div>

        <!-- Coins pill -->
        <div style="
          background:rgba(251,191,36,0.14);
          border:1px solid rgba(251,191,36,0.35);
          border-radius:20px;padding:3px 10px;flex-shrink:0;
        ">
          <span style="font-size:14px;font-weight:800;color:#fbbf24;">🪙 <span id="hud-coins">0</span></span>
        </div>
      </div>
    `;
  }

  let _timerInterval = null;

  function _startTimer(durationMs) {
    const endTime = Date.now() + durationMs;
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(() => {
      const rem  = Math.max(0, endTime - Date.now());
      const secs = Math.ceil(rem / 1000);
      const m    = Math.floor(secs / 60);
      const s    = secs % 60;
      const el   = document.getElementById('hud-timer');
      if (el) {
        el.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
        el.style.color = rem < 15000 ? '#ef4444' : '#e6edf3';
      }
      if (rem <= 0) clearInterval(_timerInterval);
    }, 250);
  }

  // ── Event listeners ─────────────────────────────────────────────────────────
  window.addEventListener('dk:coinsChanged', (ev) => {
    const el = document.getElementById('hud-coins');
    if (el) el.textContent = _fmt(ev.detail.coins);
  });

  window.addEventListener('dk:shiftStarted', (ev) => _startTimer(ev.detail.durationMs));

  window.addEventListener('dk:shiftEnded', () => {
    if (_timerInterval) clearInterval(_timerInterval);
    const el = document.getElementById('hud-timer');
    if (el) { el.textContent = '⏱ Done!'; el.style.color = '#f97316'; }
  });

  window.addEventListener('devvit:INIT_RESPONSE', (ev) => {
    const harborId = ev.detail?.cravings?.harborId || 'Cooking';
    const mults    = ev.detail?.cravings?.cravings?.multipliers || [];
    const h = document.getElementById('hud-harbor');
    const c = document.getElementById('hud-craving');
    if (h) h.textContent = `⚓ r/${harborId}`;
    if (c) c.textContent = mults.slice(0, 2).map(m => `${m.label} ×${m.multiplier}`).join('  ');
  });

  window.addEventListener('devvit:CRAVINGS_RESPONSE', (ev) => {
    const h = document.getElementById('hud-harbor');
    const c = document.getElementById('hud-craving');
    if (h) h.textContent = `⚓ r/${ev.detail.harborId}`;
    if (c) c.textContent = (ev.detail.cravings?.multipliers || []).slice(0, 2)
      .map(m => `${m.label} ×${m.multiplier}`).join('  ');
  });

  // Build as soon as DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _build);
  } else {
    _build();
  }

  return {};
})();
