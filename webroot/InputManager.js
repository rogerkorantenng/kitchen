// webroot/InputManager.js — iframe scroll-lock + focus only.
//
// The game is tap-driven (Phaser handles taps on stations/customers), so there is
// no movement input. But the Devvit iframe still needs the page kept from scrolling:
// blocking document-level touchmove is the one reliable way to stop the parent
// Reddit page from scrolling under the game.

(function () {
  document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => { e.preventDefault(); }, { passive: false });

  function grabFocus() { try { window.focus(); } catch (_) {} }
  window.addEventListener('load', grabFocus);
  document.addEventListener('pointerdown', grabFocus, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) grabFocus(); });
})();
