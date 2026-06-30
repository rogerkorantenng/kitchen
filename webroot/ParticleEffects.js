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

  // Big celebratory toast in the middle of the screen (combo milestones, goal hit).
  function bigToast(text, color) {
    const scene = window.CHEF_SCENE; if (!scene) return;
    const t = scene.add.text(scene.W / 2, scene.H * 0.4, text, {
      fontSize: '32px', fontStyle: 'bold', color: color || '#fbbf24', stroke: '#3a230f', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(6001).setScale(0.4).setAlpha(0);
    scene.tweens.add({ targets: t, scale: 1.1, alpha: 1, duration: 240, ease: 'Back.Out', onComplete: () => {
      scene.tweens.add({ targets: t, scale: 1, duration: 110, yoyo: true, hold: 520, onComplete: () => {
        scene.tweens.add({ targets: t, alpha: 0, y: t.y - 28, duration: 360, onComplete: () => t.destroy() });
      } });
    } });
  }
  function confettiRain() {
    const scene = window.CHEF_SCENE; if (!scene) return;
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * scene.W;
      const c = scene.add.text(x, -20, ['🎉','✨','⭐','💛','🧡'][i % 5], { fontSize: (14 + Math.random()*10) + 'px' })
        .setOrigin(0.5).setDepth(6000);
      scene.tweens.add({ targets: c, y: scene.H + 30, x: x + (Math.random()-0.5)*90, angle: (Math.random()-0.5)*360,
        duration: 1400 + Math.random()*900, delay: i*30, onComplete: () => c.destroy() });
    }
  }

  window.addEventListener('dk:coinEarned', (ev) => {
    coinArc(ev.detail.x, ev.detail.y);
    serveBurst(ev.detail.x, ev.detail.y);
    if (ev.detail.amount >= 30 && window.CHEF_SCENE) window.CHEF_SCENE.cameras.main.shake(120, 0.003);
  });
  window.addEventListener('dk:comboMilestone', (ev) => {
    bigToast('🔥 ' + ev.detail.combo + ' COMBO!', '#f97316');
    window.CHEF_SCENE?.cameras.main.shake(160, 0.005); window.SFX?.perfect();
  });
  window.addEventListener('dk:goalHit', () => {
    confettiRain(); bigToast('⭐ GOAL HIT!', '#22c55e'); window.SFX?.perfect();
  });
  window.addEventListener('dk:rushStart', () => {
    bigToast('🔥 RUSH HOUR!', '#ef4444');
    window.CHEF_SCENE?.cameras.main.shake(220, 0.004); window.SFX?.perfect();
  });

  return { coinArc, upgradeSlamBurst, serveBurst, bigToast, confettiRain };
})();

window.PARTICLE_FX = ParticleEffects;
