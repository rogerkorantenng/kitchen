// webroot/ParticleEffects.js — game "juice": coin arcs, sparkles, screen shake.
// The front-facing scene has no camera zoom/scroll, so all coordinates are screen px.

const ParticleEffects = (() => {
  function coinArc(fromX, fromY) {
    const scene = window.CHEF_SCENE; if (!scene) return;
    const tgt = scene.coinScreenPos ? scene.coinScreenPos() : { x: scene.W - 52, y: 30 };
    for (let i = 0; i < 3; i++) {
      const coin = scene.add.text(fromX + (Math.random()-0.5)*22, fromY, '🪙', { fontSize: '20px' })
        .setOrigin(0.5).setDepth(5000);
      const midX = fromX + (tgt.x - fromX) * 0.4 + (Math.random()-0.5)*40;
      const midY = fromY - 60 - Math.random()*30;
      scene.tweens.add({
        targets: coin, x: midX, y: midY, duration: 230, delay: i*55, ease: 'Sine.Out',
        onComplete: () => scene.tweens.add({
          targets: coin, x: tgt.x, y: tgt.y, scaleX: 0.4, scaleY: 0.4,
          duration: 320, ease: 'Back.In', onComplete: () => coin.destroy(),
        }),
      });
    }
  }

  function upgradeSlamBurst(cx, cy) {
    const scene = window.CHEF_SCENE; if (!scene) return;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const star = scene.add.text(cx, cy, ['⭐','✨','💫'][i % 3], { fontSize: '13px' })
        .setOrigin(0.5).setDepth(4000);
      scene.tweens.add({ targets: star, x: cx + Math.cos(a)*60, y: cy + Math.sin(a)*60,
        alpha: 0, duration: 520, delay: i*18, onComplete: () => star.destroy() });
    }
    scene.cameras.main.shake(140, 0.004);
  }

  function serveBurst(x, y) {
    const scene = window.CHEF_SCENE; if (!scene) return;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI/2 + (Math.random()-0.5) * 1.4;
      const p = scene.add.text(x, y, ['🎉','💛','⭐'][i % 3], { fontSize: '13px' })
        .setOrigin(0.5).setDepth(4000);
      scene.tweens.add({ targets: p, x: x + Math.cos(a)*30, y: y + Math.sin(a)*36,
        alpha: 0, duration: 600, onComplete: () => p.destroy() });
    }
  }

  window.addEventListener('dk:coinEarned', (ev) => {
    coinArc(ev.detail.x, ev.detail.y);
    serveBurst(ev.detail.x, ev.detail.y);
    if (ev.detail.amount >= 30 && window.CHEF_SCENE) window.CHEF_SCENE.cameras.main.shake(120, 0.003);
  });

  return { coinArc, upgradeSlamBurst, serveBurst };
})();

window.PARTICLE_FX = ParticleEffects;
