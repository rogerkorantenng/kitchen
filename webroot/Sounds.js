// webroot/Sounds.js — asset-free WebAudio sound effects (synthesised, no files).
// Browsers require a user gesture to start audio, so the context is created/resumed
// on the first pointer interaction.

const Sounds = (() => {
  let ctx = null, master = null, ok = true, muted = false;

  function _ensure() {
    if (ctx || !ok) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    } catch (_) { ok = false; }
  }
  function _resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  document.addEventListener('pointerdown', () => { _ensure(); _resume(); }, true);

  function tone(freq, dur, type = 'sine', when = 0, vol = 1) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, when = 0, vol = 0.3, freq = 1200) {
    if (!ctx || muted) return;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); const t = ctx.currentTime + when;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur);
  }

  return {
    pickup() { _ensure(); tone(540, 0.07, 'square', 0, 0.4); },
    place()  { _ensure(); tone(300, 0.09, 'sine', 0, 0.5); noise(0.05, 0, 0.12, 600); },
    error()  { _ensure(); tone(150, 0.16, 'sawtooth', 0, 0.4); tone(110, 0.16, 'sawtooth', 0.03, 0.35); },
    ready()  { _ensure(); tone(880, 0.09, 'sine', 0, 0.4); tone(1320, 0.12, 'sine', 0.08, 0.35); },
    assemble(){ _ensure(); tone(660, 0.08, 'triangle', 0, 0.45); tone(990, 0.12, 'triangle', 0.07, 0.45); },
    serve(combo = 1) { _ensure(); const b = 580 + Math.min(combo, 10) * 35; tone(b, 0.08, 'sine', 0, 0.45); tone(b*1.5, 0.1, 'sine', 0.06, 0.45); tone(b*2, 0.12, 'sine', 0.12, 0.4); },
    coin()   { _ensure(); tone(1200, 0.05, 'square', 0, 0.3); tone(1700, 0.07, 'square', 0.04, 0.28); },
    perfect(){ _ensure(); [784,988,1319,1568].forEach((f,i)=>tone(f,0.1,'triangle',i*0.05,0.4)); },
    fail()   { _ensure(); [330,294,247].forEach((f,i)=>tone(f,0.16,'sawtooth',i*0.1,0.35)); },
    sizzle() { _ensure(); noise(0.22, 0, 0.18, 1400); },
    setMuted(m) { muted = m; },
  };
})();

window.SFX = Sounds;
