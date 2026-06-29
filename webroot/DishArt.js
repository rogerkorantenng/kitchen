// webroot/DishArt.js — code-drawn appetizing food, used for the serve animation
// (and anywhere we want a dish to look tastier than a flat emoji).
// draw(g, cx, cy, r, id): renders a dish centred at (cx,cy) sized to radius r.

const DishArt = (() => {
  function draw(g, cx, cy, r, id) {
    switch (id) {
      case 'burger':   return _burger(g, cx, cy, r);
      case 'hotdog':   return _hotdog(g, cx, cy, r);
      case 'fries':    return _fries(g, cx, cy, r);
      case 'salad':    return _salad(g, cx, cy, r);
      case 'coffee':   return _coffee(g, cx, cy, r);
      case 'cola':     return _cola(g, cx, cy, r);
      case 'patty':    return _patty(g, cx, cy, r);
      case 'sausage':  return _sausageItem(g, cx, cy, r);
      default: return false; // caller falls back to emoji
    }
  }
  function has(id) { return ['burger','hotdog','fries','salad','coffee','cola','patty','sausage'].includes(id); }

  function _burger(g, x, y, r) {
    // bottom bun
    g.fillStyle(0xd9a05b, 1); g.fillRoundedRect(x - r, y + r*0.35, r*2, r*0.5, { tl:4, tr:4, bl:r*0.5, br:r*0.5 });
    // patty
    g.fillStyle(0x6b3b1e, 1); g.fillRoundedRect(x - r*1.02, y + r*0.12, r*2.04, r*0.32, 5);
    // cheese
    g.fillStyle(0xf6b73c, 1); g.fillTriangle(x - r*0.9, y + r*0.1, x + r*0.9, y + r*0.1, x - r*0.5, y + r*0.42);
    g.fillTriangle(x + r*0.9, y + r*0.1, x + r*0.2, y + r*0.42, x - r*0.2, y + r*0.42);
    // lettuce
    g.fillStyle(0x67c14e, 1);
    for (let i = -3; i <= 3; i++) g.fillCircle(x + i*r*0.28, y + r*0.02, r*0.2);
    // top bun (dome)
    g.fillStyle(0xe8b56a, 1); g.fillEllipse(x, y - r*0.18, r*2.0, r*1.1);
    g.fillStyle(0xf0c887, 1); g.fillEllipse(x, y - r*0.24, r*1.7, r*0.85);
    // sesame
    g.fillStyle(0xfff3da, 1);
    [[-0.4,-0.3],[0.1,-0.45],[0.45,-0.2],[-0.15,-0.15],[0.3,-0.05]].forEach(([dx,dy]) => g.fillEllipse(x + dx*r, y + dy*r, r*0.16, r*0.1));
    return true;
  }
  function _hotdog(g, x, y, r) {
    g.fillStyle(0xe8b56a, 1); g.fillRoundedRect(x - r, y - r*0.45, r*2, r*0.9, r*0.45);     // bun
    g.fillStyle(0xc23b22, 1); g.fillRoundedRect(x - r*0.95, y - r*0.28, r*1.9, r*0.5, r*0.25); // sausage
    g.lineStyle(r*0.12, 0xf6c945, 1); g.beginPath();                                          // mustard
    g.moveTo(x - r*0.8, y - r*0.05);
    for (let i = 0; i <= 8; i++) g.lineTo(x - r*0.8 + i*r*0.2, y - r*0.05 + (i%2?1:-1)*r*0.1);
    g.strokePath();
    return true;
  }
  function _fries(g, x, y, r) {
    g.fillStyle(0xf4d03f, 1);  // fries behind
    for (let i = -2; i <= 2; i++) g.fillRoundedRect(x + i*r*0.34 - r*0.07, y - r*1.1, r*0.16, r*1.2, 2);
    g.fillStyle(0xe2382b, 1);  // red carton
    g.fillTriangle(x - r*0.95, y - r*0.45, x + r*0.95, y - r*0.45, x + r*0.7, y + r*0.9);
    g.fillTriangle(x - r*0.95, y - r*0.45, x + r*0.7, y + r*0.9, x - r*0.7, y + r*0.9);
    g.fillStyle(0xffffff, 0.85); g.fillRoundedRect(x - r*0.5, y - r*0.2, r*1.0, r*0.5, 3); // logo band
    return true;
  }
  function _salad(g, x, y, r) {
    // leaves heaped above the bowl
    [[-0.5,-0.2,0x4caf50],[0.0,-0.4,0x66bb6a],[0.5,-0.2,0x43a047],[-0.25,-0.05,0x81c784],[0.28,-0.05,0x2e7d32]]
      .forEach(([dx,dy,c]) => { g.fillStyle(c,1); g.fillCircle(x+dx*r, y+dy*r, r*0.42); });
    g.fillStyle(0xff5252,1); g.fillCircle(x - r*0.2, y - r*0.1, r*0.18); // tomato
    g.fillStyle(0xff5252,1); g.fillCircle(x + r*0.35, y - r*0.25, r*0.16);
    // white bowl in front
    g.fillStyle(0xffffff, 1); g.fillEllipse(x, y + r*0.35, r*2.1, r*0.7);
    g.fillStyle(0xe9eef3, 1); g.fillEllipse(x, y + r*0.28, r*1.8, r*0.5);
    return true;
  }
  function _coffee(g, x, y, r) {
    g.fillStyle(0xffffff, 1); g.fillEllipse(x, y + r*0.7, r*1.6, r*0.4);        // saucer
    g.fillStyle(0xfafafa, 1); g.fillRoundedRect(x - r*0.7, y - r*0.5, r*1.4, r*1.1, { tl:6, tr:6, bl:r*0.5, br:r*0.5 });
    g.lineStyle(r*0.16, 0xffffff, 1); g.strokeCircle(x + r*0.85, y + r*0.05, r*0.35); // handle
    g.fillStyle(0x6f4e37, 1); g.fillEllipse(x, y - r*0.42, r*1.16, r*0.32);     // coffee
    g.fillStyle(0xc9a987, 1); g.fillEllipse(x, y - r*0.44, r*0.7, r*0.2);       // foam heart
    return true;
  }
  function _cola(g, x, y, r) {
    g.fillStyle(0xef4444, 1); g.fillTriangle(x - r*0.7, y - r*0.7, x + r*0.7, y - r*0.7, x + r*0.5, y + r*0.9);
    g.fillTriangle(x - r*0.7, y - r*0.7, x + r*0.5, y + r*0.9, x - r*0.5, y + r*0.9);
    g.fillStyle(0xffffff, 0.85); g.fillRoundedRect(x - r*0.55, y - r*0.3, r*1.05, r*0.4, 3);
    g.lineStyle(r*0.14, 0xf6c945, 1); g.lineBetween(x + r*0.2, y - r*1.1, x + r*0.45, y - r*0.4); // straw
    return true;
  }
  function _patty(g, x, y, r) {
    g.fillStyle(0x6b3b1e, 1); g.fillEllipse(x, y, r*1.7, r*0.9);
    g.fillStyle(0x53301a, 1); g.fillEllipse(x, y + r*0.08, r*1.5, r*0.6);
    return true;
  }
  function _sausageItem(g, x, y, r) {
    g.fillStyle(0xc23b22, 1); g.fillRoundedRect(x - r, y - r*0.3, r*2, r*0.6, r*0.3);
    return true;
  }

  return { draw, has };
})();

window.DishArt = DishArt;
