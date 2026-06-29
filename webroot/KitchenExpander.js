// webroot/KitchenExpander.js
// Visual expansion animation when kitchen tier increases.

const KitchenExpander = (() => {
  function playExpansion(tier) {
    const scene = window.CHEF_SCENE;
    if (!scene) return;
    const W = scene.W, H = scene.H;

    // White flash (screen space — ignore camera zoom/scroll)
    const flash = scene.add.graphics().setDepth(5050).setScrollFactor(0);
    flash.fillStyle(C.white, 0.85); flash.fillRect(0, 0, W, H);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });

    // Sparkles
    for (let i = 0; i < 22; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H * 0.7;
      const em = ['✨','⭐','🌟'][i % 3];
      const sz = 14 + Math.random() * 16;
      const sp = scene.add.text(px, py, em, { fontSize: Math.round(sz) + 'px' })
        .setOrigin(0.5).setDepth(5051).setScrollFactor(0).setAlpha(0);
      scene.tweens.add({
        targets: sp, alpha: 1, y: py - 35 - Math.random() * 40,
        duration: 450, delay: Math.random() * 400,
        onComplete: () => scene.tweens.add({ targets: sp, alpha: 0, duration: 350, onComplete: () => sp.destroy() }),
      });
    }

    // Big message
    const msg = scene.add.text(W / 2, H * 0.42, '🏗 Kitchen Expanded!', {
      fontSize: '21px', fontStyle: 'bold', color: '#f97316',
      stroke: '#ffffff', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(5052).setScrollFactor(0).setAlpha(0);
    scene.tweens.add({ targets: msg, alpha: 1, duration: 280 });
    scene.tweens.add({ targets: msg, alpha: 0, duration: 400, delay: 1400, onComplete: () => msg.destroy() });

    const tierLabel = KITCHEN_TIERS[tier]?.label || 'New Kitchen';
    const sub = scene.add.text(W / 2, H * 0.5, tierLabel, {
      fontSize: '14px', color: '#4a3728', stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5052).setScrollFactor(0).setAlpha(0);
    scene.tweens.add({ targets: sub, alpha: 1, duration: 280, delay: 150 });
    scene.tweens.add({ targets: sub, alpha: 0, duration: 400, delay: 1400, onComplete: () => sub.destroy() });
  }

  window.addEventListener('dk:kitchenExpanded', (ev) => playExpansion(ev.detail.tier));

  return { playExpansion };
})();

window.KITCHEN_EXPANDER = KitchenExpander;
