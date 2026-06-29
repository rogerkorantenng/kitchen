// webroot/controls.js — D-pad + Action button
// HTML touch events, NOT Phaser — required for Devvit iframe reliability.
//
// THE SCROLL FIX:
// Devvit iframes pass touchmove events to the Reddit parent, causing page scroll.
// The ONLY fix is document-level touchmove preventDefault in the webroot document.
// stopPropagation alone does NOT cross iframe boundaries.

(function() {
  // ── NUCLEAR scroll prevention ────────────────────────────────────────────────
  // Block ALL touchmove on this document. The webroot is a full-screen game —
  // there is no legitimate scroll anywhere. This stops Reddit from scrolling.
  document.addEventListener('touchmove', function(e) {
    e.preventDefault();
  }, { passive: false });

  // Also block touchstart default (prevents 300ms click delay + some scroll initiation)
  document.addEventListener('touchstart', function(e) {
    // Don't preventDefault on all touchstart — breaks button tap detection.
    // Only prevent on elements that are NOT interactive controls.
    if (!e.target.closest('#controls-overlay') &&
        !e.target.closest('#shop-overlay') &&
        !e.target.closest('#hud-overlay')) {
      // Game canvas area — prevent default scroll
      e.preventDefault();
    }
  }, { passive: false });


  // ── D-pad state ───────────────────────────────────────────────────────────────
  const held = new Set(); // active button elements
  const intervals = new Map();

  function moveChef(dx, dy) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    scene.chefDir = dir;
    const nx = Math.max(20,          Math.min(scene.W - 20, scene.chefPos.x + dx * 14));
    const ny = Math.max(scene.floorMinY || 120, Math.min(scene.H - 20,  scene.chefPos.y + dy * 8));
    scene.chefPos.x = nx;
    scene.chefPos.y = ny;
    scene._drawChef(nx, ny, dir);
    window.DK_CHEF_POS = { x: nx, y: ny };
  }

  function pressBtn(btn) {
    if (held.has(btn)) return;
    held.add(btn);
    const dx = parseInt(btn.dataset.dx, 10);
    const dy = parseInt(btn.dataset.dy, 10);

    btn.classList.add('dpad-active');
    moveChef(dx, dy);
    intervals.set(btn, setInterval(() => moveChef(dx, dy), 70));
  }

  function releaseBtn(btn) {
    if (!held.has(btn)) return;
    held.delete(btn);
    clearInterval(intervals.get(btn));
    intervals.delete(btn);
    btn.classList.remove('dpad-active');
  }

  function releaseAll() {
    held.forEach(btn => releaseBtn(btn));
  }

  document.addEventListener('DOMContentLoaded', function() {

    // ── Wire d-pad buttons ──────────────────────────────────────────────────────
    document.querySelectorAll('.dpad-btn').forEach(btn => {
      btn.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        btn.setPointerCapture(e.pointerId); // keep tracking even if finger drifts
        pressBtn(btn);
      });

      btn.addEventListener('pointerup', function(e) {
        e.preventDefault();
        releaseBtn(btn);
      });

      btn.addEventListener('pointercancel', function(e) {
        releaseBtn(btn);
      });

      btn.addEventListener('pointerleave', function(e) {
        // Only release if pointer is actually gone (not just moved to center)
        if (!btn.hasPointerCapture(e.pointerId)) releaseBtn(btn);
      });
    });

    window.addEventListener('pointerup', releaseAll);

    // ── Action button ───────────────────────────────────────────────────────────
    const actionBtn = document.getElementById('btn-action');
    if (actionBtn) {
      actionBtn.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        actionBtn.style.transform = 'scale(0.88)';
        window.setTimeout(() => { actionBtn.style.transform = ''; }, 140);
        window.dispatchEvent(new CustomEvent('dk:interact'));
      });
    }
  });
})();
