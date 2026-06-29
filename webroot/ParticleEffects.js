// webroot/ParticleEffects.js
// Coin arcs from delivery point to HUD coin counter.
// Upgrade slam burst particles.

const ParticleEffects = (() => {
  function coinArc(fromX, fromY) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const targetX = scene.W - 60, targetY = 22;
    const coin = scene.add.text(fromX, fromY, '🪙', {
      fontSize: Math.round(TILE_W * 0.28) + 'px',
    }).setOrigin(0.5).setDepth(35);
    scene.tweens.add({
      targets: coin, x: targetX, y: targetY,
      duration: 520, ease: 'Power2',
      onComplete: () => coin.destroy(),
    });
  }

  function upgradeSlamBurst(cx, cy) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const dist  = TILE_W * 0.65;
      const em    = ['⭐','✨','💫'][i % 3];
      const star  = scene.add.text(cx, cy, em, { fontSize: '11px' }).setOrigin(0.5).setDepth(35);
      scene.tweens.add({
        targets: star,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0, duration: 480,
        delay: i * 20,
        onComplete: () => star.destroy(),
      });
    }
  }

  window.addEventListener('dk:coinEarned', (ev) => coinArc(ev.detail.x, ev.detail.y));

  return { coinArc, upgradeSlamBurst };
})();

window.PARTICLE_FX = ParticleEffects;
