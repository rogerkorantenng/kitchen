// webroot/Tutorial.js — first-run interactive walkthrough.
// On a brand-new player's first shift, freeze the game and spotlight each station
// in turn with a tip card. Finishes (or Skip) → resume the shift, remember it's done.
// CSP-safe: one delegated addEventListener, no inline handlers.

const Tutorial = (() => {
  const KEY = 'dk_tutorial_done';
  let _step = 0, _active = false;

  const STEPS = [
    { id: 'meat',  text: '👋 Welcome to your kitchen! Tap a <b>bin</b> like <b>MEAT</b> to grab an ingredient — or drag it onto a station.' },
    { id: 'grill', text: '🔥 Drop raw food on the <b>GRILL</b> to cook it. It turns ready with a ✓ — but leave it too long and it <b>burns</b>!' },
    { id: 'plate', text: '🍽️ Stack cooked items on a <b>PLATE</b> to build a dish. Grilled patty + bun makes a burger.' },
    { id: 'soda',  text: '🥤 Drinks brew on their own — just grab a ready cup from the <b>SODA</b> or <b>COFFEE</b> machine.' },
    { id: 'trash', text: '🗑️ Grabbed the wrong thing? Drop it in the <b>TRASH</b> to start over.' },
    { id: null,    text: '🧑 Now serve each finished dish to the customer who ordered it — before their patience runs out. Let’s cook!' },
  ];

  function _el() { return document.getElementById('tutorial-overlay'); }
  function _isDone() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function _markDone() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }

  function _stationRect(id) {
    const list = window.STATION_MGR?.getStations?.() || [];
    const inst = list.find(s => s.defId === id) || list.find(s => s.kind === id);
    if (!inst || inst._cx == null) return null;
    return { x: inst._cx - inst._w * 0.62, y: inst._cy - inst._h * 0.72, w: inst._w * 1.24, h: inst._h * 1.6 };
  }

  function _wire() {
    const el = _el(); if (!el || el._dkWired) return;
    el._dkWired = true;
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      ev.preventDefault();
      if (b.dataset.act === 'tut-next') _next();
      else if (b.dataset.act === 'tut-skip') _finish();
    });
  }

  function _render() {
    const el = _el(); if (!el) return;
    el.style.display = 'block';
    const s = STEPS[_step];
    const rect = s.id ? _stationRect(s.id) : null;
    const last = _step === STEPS.length - 1;
    const spotlight = rect
      ? `<div class="tut-ring" style="left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px"></div>`
      : `<div class="tut-backdrop"></div>`;
    // keep the card clear of the spotlight: stations sit low, so card goes up top
    const pos = rect ? (rect.y > window.innerHeight * 0.45 ? 'top' : 'bottom') : 'center';
    el.innerHTML = `
      ${spotlight}
      <div class="tut-card tut-${pos}">
        <div class="tut-text">${s.text}</div>
        <div class="tut-dots">${STEPS.map((_, i) => `<i class="${i === _step ? 'on' : ''}"></i>`).join('')}</div>
        <div class="tut-row">
          <button class="tut-skip" data-act="tut-skip">${_step === 0 ? 'Skip' : ''}</button>
          <button class="tut-next" data-act="tut-next">${last ? "Let’s cook! 🍳" : 'Next ›'}</button>
        </div>
      </div>`;
  }

  function _next() { _step++; if (_step >= STEPS.length) _finish(); else _render(); }
  function _finish() {
    _active = false; _markDone();
    const el = _el(); if (el) el.style.display = 'none';
    window.CHEF_CTRL?.resumeShift?.();
  }

  function start() {
    if (_active || _isDone()) return;
    if (!(window.STATION_MGR?.getStations?.() || []).length) return;
    _active = true; _step = 0;
    _wire();
    window.CHEF_CTRL?.pauseShift?.();   // freeze customers while they read
    _render();
  }

  // Kick off on the player's first shift (stations are drawn by then).
  window.addEventListener('dk:shiftStarted', () => {
    if (_isDone()) return;
    window.setTimeout(start, 350);
  });

  return { start, _finish, isDone: _isDone };
})();

window.TUTORIAL = Tutorial;
