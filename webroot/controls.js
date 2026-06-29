// webroot/controls.js
// HTML-based d-pad and action button controller.
// Uses HTML touch events instead of Phaser input — more reliable in Devvit iframes.
// Stops event propagation so Reddit page doesn't scroll.

document.addEventListener('DOMContentLoaded', () => {

  // ── D-pad ───────────────────────────────────────────────────────────────────
  const dpadBtns = document.querySelectorAll('.dpad-btn');
  const activeButtons = new Map(); // button element → { dx, dy, interval }

  function startMove(btn) {
    if (activeButtons.has(btn)) return;
    const dx = parseInt(btn.dataset.dx, 10);
    const dy = parseInt(btn.dataset.dy, 10);

    // Visual press
    btn.style.background = 'rgba(249,115,22,0.7)';
    btn.style.transform = btn.style.transform.replace('scale(1)','') + ' scale(0.92)';

    // Notify ChefScene directly
    const move = () => {
      const scene = window.CHEF_SCENE;
      if (!scene) return;
      const stepX = dx * 16;
      const stepY = dy * 9;
      const dir   = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
      scene.chefDir = dir;
      const minY  = (scene.floorMinY || 0);
      const nx    = Math.max(20, Math.min(scene.W - 20, scene.chefPos.x + stepX));
      const ny    = Math.max(minY, Math.min(scene.H - 30, scene.chefPos.y + stepY));
      scene.chefPos.x = nx;
      scene.chefPos.y = ny;
      scene._drawChef(nx, ny, dir);
      window.DK_CHEF_POS = { x: nx, y: ny };
    };

    move(); // immediate first step
    const iv = setInterval(move, 75); // repeat while held
    activeButtons.set(btn, iv);
  }

  function stopMove(btn) {
    if (!activeButtons.has(btn)) return;
    clearInterval(activeButtons.get(btn));
    activeButtons.delete(btn);
    // Reset visual
    btn.style.background = 'rgba(255,255,255,0.22)';
    btn.style.transform = '';
  }

  dpadBtns.forEach(btn => {
    // Mouse events (desktop testing)
    btn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); startMove(btn); });
    btn.addEventListener('mouseup',   e => { e.stopPropagation(); stopMove(btn); });
    btn.addEventListener('mouseleave',e => { stopMove(btn); });

    // Touch events (mobile — the real platform)
    btn.addEventListener('touchstart', e => {
      e.stopPropagation();
      e.preventDefault(); // CRITICAL: prevents Reddit page scroll
      startMove(btn);
    }, { passive: false });

    btn.addEventListener('touchend', e => {
      e.stopPropagation();
      e.preventDefault();
      stopMove(btn);
    }, { passive: false });

    btn.addEventListener('touchcancel', e => { stopMove(btn); }, { passive: false });
  });

  // Stop all if pointer leaves window
  window.addEventListener('mouseup', () => {
    activeButtons.forEach((_, btn) => stopMove(btn));
  });

  // ── Action button ───────────────────────────────────────────────────────────
  const actionBtn = document.getElementById('btn-action');
  if (actionBtn) {
    const pressAction = (e) => {
      e.stopPropagation();
      e.preventDefault();
      actionBtn.style.transform = 'scale(0.90)';
      actionBtn.style.boxShadow = '0 2px 8px rgba(249,115,22,0.3)';
      window.setTimeout(() => {
        actionBtn.style.transform = '';
        actionBtn.style.boxShadow = '';
      }, 120);
      window.dispatchEvent(new CustomEvent('dk:interact'));
    };

    actionBtn.addEventListener('mousedown',  pressAction);
    actionBtn.addEventListener('touchstart', e => pressAction(e), { passive: false });
  }

  // ── Block Reddit scroll on entire controls overlay ──────────────────────────
  const overlay = document.getElementById('controls-overlay');
  if (overlay) {
    ['touchstart','touchmove','touchend','pointerdown'].forEach(evt => {
      overlay.addEventListener(evt, e => {
        e.stopPropagation();
        if (evt === 'touchmove') e.preventDefault();
      }, { passive: false });
    });
  }
});
