// webroot/Characters.js — shared front-facing person renderer for customers AND staff.
// One consistent, detailed cartoon style with varied hair / accessories and
// expressive mood faces. Body + face are drawn separately so faces can re-render
// cheaply as mood changes without redrawing the whole character.

const DrawChar = (() => {
  const HAIR_STYLES = ['short', 'side', 'bun', 'spike', 'curly', 'long', 'cap'];

  function _hair(g, cx, hy, w, st) {
    const hc = st.hair;
    g.fillStyle(hc, 1);
    switch (st.hairStyle) {
      case 'bald':
        g.fillRoundedRect(cx - w*0.3, hy - w*0.34, w*0.6, w*0.12, { tl:14, tr:14, bl:0, br:0 });
        break;
      case 'cap': // hat/beanie
        g.fillStyle(st.hatColor || 0x3b82f6, 1);
        g.fillRoundedRect(cx - w*0.34, hy - w*0.38, w*0.68, w*0.2, { tl:16, tr:16, bl:4, br:4 });
        g.fillStyle(0x000000, 0.12); g.fillRoundedRect(cx - w*0.34, hy - w*0.22, w*0.68, w*0.05, 3);
        break;
      case 'bun':
        g.fillCircle(cx, hy - w*0.42, w*0.16);
        g.fillRoundedRect(cx - w*0.32, hy - w*0.36, w*0.64, w*0.24, { tl:16, tr:16, bl:0, br:0 });
        break;
      case 'spike':
        g.fillRoundedRect(cx - w*0.32, hy - w*0.34, w*0.64, w*0.2, { tl:10, tr:10, bl:0, br:0 });
        for (let i = -2; i <= 2; i++) g.fillTriangle(cx + i*w*0.13 - w*0.08, hy - w*0.3, cx + i*w*0.13 + w*0.08, hy - w*0.3, cx + i*w*0.13, hy - w*0.5);
        break;
      case 'curly':
        [-0.24,-0.08,0.08,0.24].forEach(o => g.fillCircle(cx + o*w, hy - w*0.32, w*0.12));
        g.fillRoundedRect(cx - w*0.32, hy - w*0.3, w*0.64, w*0.16, 8);
        break;
      case 'long':
        g.fillRect(cx - w*0.34, hy - w*0.2, w*0.1, w*0.5);
        g.fillRect(cx + w*0.24, hy - w*0.2, w*0.1, w*0.5);
        g.fillRoundedRect(cx - w*0.34, hy - w*0.4, w*0.68, w*0.28, { tl:18, tr:18, bl:0, br:0 });
        break;
      case 'side':
        g.fillRoundedRect(cx - w*0.33, hy - w*0.4, w*0.66, w*0.26, { tl:18, tr:6, bl:0, br:0 });
        g.fillTriangle(cx - w*0.33, hy - w*0.16, cx + w*0.1, hy - w*0.36, cx - w*0.33, hy - w*0.36);
        break;
      default: // short
        g.fillRoundedRect(cx - w*0.32, hy - w*0.4, w*0.64, w*0.26, { tl:16, tr:16, bl:0, br:0 });
        g.fillRect(cx - w*0.32, hy - w*0.2, w*0.06, w*0.16);
        g.fillRect(cx + w*0.26, hy - w*0.2, w*0.06, w*0.16);
    }
  }

  function _accessory(g, cx, hy, w, st) {
    if (st.accessory === 'glasses') {
      g.lineStyle(Math.max(1.5, w*0.03), 0x2a2a2a, 1);
      g.strokeCircle(cx - w*0.13, hy - w*0.02, w*0.11);
      g.strokeCircle(cx + w*0.13, hy - w*0.02, w*0.11);
      g.lineBetween(cx - w*0.02, hy - w*0.02, cx + w*0.02, hy - w*0.02);
    } else if (st.accessory === 'crown') {
      g.fillStyle(0xfbbf24, 1);
      g.fillTriangle(cx - w*0.2, hy - w*0.34, cx - w*0.12, hy - w*0.52, cx - w*0.04, hy - w*0.34);
      g.fillTriangle(cx - w*0.04, hy - w*0.34, cx, hy - w*0.56, cx + w*0.04, hy - w*0.34);
      g.fillTriangle(cx + w*0.04, hy - w*0.34, cx + w*0.12, hy - w*0.52, cx + w*0.2, hy - w*0.34);
      g.fillRect(cx - w*0.2, hy - w*0.36, w*0.4, w*0.06);
      g.fillStyle(0xef4444, 1); g.fillCircle(cx, hy - w*0.4, w*0.03);
    }
  }

  // Static body + head + hair + accessory (drawn into graphics g).
  function body(g, cx, hy, w, bottomY, st) {
    g.fillStyle(0x000000, 0.10); g.fillEllipse(cx, hy + w*0.34, w*0.55, w*0.1);
    const tTop = hy + w*0.16, tw = w*0.82;
    // shirt
    g.fillStyle(st.shirt, 1); g.fillRoundedRect(cx - tw/2, tTop, tw, Math.max(w*0.2, bottomY - tTop), 14);
    g.fillStyle(0x000000, 0.06); g.fillRoundedRect(cx + tw*0.1, tTop, tw*0.3, Math.max(w*0.2, bottomY - tTop), 14);
    g.fillStyle(st.shirtDark, 1); g.fillRoundedRect(cx - tw/2, tTop, tw, w*0.13, { tl:13, tr:13, bl:0, br:0 });
    // collar V
    g.fillStyle(st.skin, 1); g.fillTriangle(cx - w*0.1, tTop, cx + w*0.1, tTop, cx, tTop + w*0.14);
    if (st.apron) { g.fillStyle(0xfafafa, 0.9); g.fillRoundedRect(cx - tw*0.28, tTop + w*0.1, tw*0.56, Math.max(w*0.16, bottomY - tTop - w*0.1), 6); }
    if (st.bowtie) { g.fillStyle(0x222b3a, 1); g.fillTriangle(cx - w*0.12, tTop + w*0.05, cx, tTop + w*0.11, cx - w*0.12, tTop + w*0.17); g.fillTriangle(cx + w*0.12, tTop + w*0.05, cx, tTop + w*0.11, cx + w*0.12, tTop + w*0.17); g.fillCircle(cx, tTop + w*0.11, w*0.03); }
    // neck + head
    g.fillStyle(st.skin, 1); g.fillRect(cx - w*0.08, hy + w*0.05, w*0.16, w*0.16);
    g.fillEllipse(cx, hy, w*0.62, w*0.66);
    g.fillCircle(cx - w*0.3, hy + w*0.02, w*0.07); g.fillCircle(cx + w*0.3, hy + w*0.02, w*0.07);
    _hair(g, cx, hy, w, st);
    _accessory(g, cx, hy, w, st);
    // chef / waiter hats sit above hair
    if (st.hat === 'chef') {
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(cx - w*0.26, hy - w*0.44, w*0.52, w*0.12, 4);
      g.fillCircle(cx - w*0.14, hy - w*0.5, w*0.13); g.fillCircle(cx + w*0.14, hy - w*0.5, w*0.13); g.fillCircle(cx, hy - w*0.56, w*0.15);
      g.fillStyle(st.hatBand || 0xf97316, 1); g.fillRect(cx - w*0.26, hy - w*0.36, w*0.52, w*0.05);
    }
  }

  // Mood face (eyes, brows, mouth). Re-renderable cheaply.
  function face(g, cx, hy, w, mood) {
    g.clear();
    const eyeY = hy - w*0.02, eyeX = w*0.13;
    // brows
    g.fillStyle(0x2d1a08, 1);
    if (mood === 'angry') { g.fillRect(cx - eyeX - w*0.05, eyeY - w*0.13, w*0.12, w*0.03); g.fillRect(cx + eyeX - w*0.07, eyeY - w*0.13, w*0.12, w*0.03); }
    else if (mood === 'worried') { g.fillRect(cx - eyeX - w*0.05, eyeY - w*0.14, w*0.1, w*0.025); g.fillRect(cx + eyeX - w*0.05, eyeY - w*0.14, w*0.1, w*0.025); }
    // eyes
    if (mood === 'angry') {
      g.fillCircle(cx - eyeX, eyeY, w*0.05); g.fillCircle(cx + eyeX, eyeY, w*0.05);
    } else {
      g.fillCircle(cx - eyeX, eyeY, w*0.055); g.fillCircle(cx + eyeX, eyeY, w*0.055);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(cx - eyeX + w*0.02, eyeY - w*0.02, w*0.018); g.fillCircle(cx + eyeX + w*0.02, eyeY - w*0.02, w*0.018);
      g.fillStyle(0x2d1a08, 1);
    }
    // cheeks for happy
    if (mood === 'happy') { g.fillStyle(0xff9a9a, 0.35); g.fillCircle(cx - w*0.22, hy + w*0.1, w*0.06); g.fillCircle(cx + w*0.22, hy + w*0.1, w*0.06); g.fillStyle(0x2d1a08, 1); }
    // mouth
    g.lineStyle(w*0.03, 0x2d1a08, 1); g.beginPath();
    if (mood === 'happy')        g.arc(cx, hy + w*0.12, w*0.13, 0.2, Math.PI - 0.2, false);
    else if (mood === 'neutral') { g.moveTo(cx - w*0.1, hy + w*0.16); g.lineTo(cx + w*0.1, hy + w*0.16); }
    else                          g.arc(cx, hy + w*0.24, w*0.12, Math.PI + 0.25, Math.PI*2 - 0.25, false);
    g.strokePath();
    if (mood === 'worried' || mood === 'angry') { g.fillStyle(0x60a5fa, 0.85); g.fillEllipse(cx + w*0.24, hy - w*0.06, w*0.05, w*0.08); }
  }

  function randomStyle(seed) {
    const PAL = [
      { shirt:0xef5350, shirtDark:0xc62828, skin:0xfdd9b5, hair:0x4a2800 },
      { shirt:0x42a5f5, shirtDark:0x1565c0, skin:0xffe0b2, hair:0x1a1a1a },
      { shirt:0x66bb6a, shirtDark:0x2e7d32, skin:0xf6c89a, hair:0x6d4c2b },
      { shirt:0xab47bc, shirtDark:0x6a1b9a, skin:0xffd9b0, hair:0x2a1a05 },
      { shirt:0xffa726, shirtDark:0xe65100, skin:0xf3c79b, hair:0x1a1a1a },
      { shirt:0x26c6da, shirtDark:0x00838f, skin:0xfdd9b5, hair:0x4a2800 },
      { shirt:0xec407a, shirtDark:0xad1457, skin:0xffe0b2, hair:0x14110f },
      { shirt:0x8d6e63, shirtDark:0x5d4037, skin:0xf6c89a, hair:0x2a1a05 },
    ];
    const p = PAL[seed % PAL.length];
    const hs = HAIR_STYLES[(seed * 3) % HAIR_STYLES.length];
    const acc = (seed % 4 === 0) ? 'glasses' : 'none';
    return { ...p, hairStyle: hs, accessory: acc, hatColor: [0x3b82f6,0xef4444,0x16a34a,0x9333ea][seed % 4] };
  }

  return { body, face, randomStyle, HAIR_STYLES };
})();

window.DrawChar = DrawChar;
