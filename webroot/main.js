// webroot/main.js — Phaser launcher + Devvit bridge
// 2-frame deferred launch (Trapline pattern): browser must finish laying out
// #game-mount before Phaser measures container dimensions.

let _game = null;

function launchGame() {
  const mount = document.getElementById('game-mount');
  if (!mount || _game) return;
  const W = mount.clientWidth  || window.innerWidth;
  const H = mount.clientHeight || window.innerHeight;
  _game = new Phaser.Game({
    type:            Phaser.AUTO,
    width:           W,
    height:          H,
    backgroundColor: '#fdf6e3',
    parent:          'game-mount',
    scene:           [ChefScene],
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    input: { activePointers: 3 },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      launchGame();
      send('INIT', {});
      // Retry INIT if server is slow (Devvit cold start)
      let attempts = 0;
      const retry = setInterval(() => {
        attempts++;
        if (attempts >= 3 || window._dkInitDone) { clearInterval(retry); return; }
        send('INIT', {});
      }, 5000);
    });
  });
});

window.addEventListener('devvit:INIT_RESPONSE', () => { window._dkInitDone = true; });
