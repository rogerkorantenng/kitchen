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
        display:flex; align-items:center; gap:6px;
        padding:8px 14px;
        background:linear-gradient(180deg,rgba(74,55,40,0.97) 0%,rgba(74,55,40,0.92) 100%);
        border-bottom:3px solid #f97316;
        font-family:'Segoe UI',system-ui,sans-serif;
        pointer-events:none;
        box-shadow:0 4px 16px rgba(0,0,0,0.35);
      ">
        <!-- Harbor + craving -->
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div id="hud-harbor" style="
            font-size:12px;font-weight:800;color:#38bdf8;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            text-shadow:0 1px 4px rgba(0,0,0,0.5);
          ">⚓ r/Cooking</div>
          <div id="hud-craving" style="
            font-size:9px;color:#fbbf24;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            margin-top:2px;opacity:0.9;
          "></div>
        </div>

        <!-- Shift timer (center) -->
        <div style="
          flex-shrink:0;
          background:rgba(0,0,0,0.3);
          border:1px solid rgba(255,255,255,0.15);
          border-radius:20px;
          padding:4px 14px;
        ">
          <div id="hud-timer" style="
            font-size:16px;font-weight:900;color:#ffffff;
            letter-spacing:1px;text-shadow:0 1px 6px rgba(0,0,0,0.6);
          ">⏱ 1:00</div>
        </div>

        <!-- Coins pill -->
        <div style="
          flex-shrink:0;
          background:linear-gradient(135deg,rgba(251,191,36,0.25),rgba(251,191,36,0.12));
          border:2px solid rgba(251,191,36,0.6);
          border-radius:22px;
          padding:4px 14px;
          box-shadow:0 2px 8px rgba(251,191,36,0.2);
        ">
          <span style="font-size:15px;font-weight:900;color:#fbbf24;text-shadow:0 1px 4px rgba(0,0,0,0.4);">
            🪙 <span id="hud-coins">0</span>
          </span>
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
