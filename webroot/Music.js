// webroot/Music.js — asset-free procedural background music (synthesised, no files).
// A gentle lo-fi loop: a warm chord pad + a soft pentatonic melody over a I–vi–IV–V
// progression. Built on its own WebAudio context, resumed on the first gesture.
// One combined "sound on/off" preference drives both this and the SFX, stored locally.

const Music = (() => {
  let ctx = null, pad = null, lead = null, on = true, started = false, timer = null;
  let nextTime = 0, step = 0;

  const TEMPO = 92;                 // bpm — relaxed
  const SPB = 60 / TEMPO;           // seconds per beat
  const STEP = SPB / 2;             // eighth-note grid
  const STEPS_PER_BAR = 8;
  const TOTAL = STEPS_PER_BAR * 4;  // 4-bar loop

  // I–vi–IV–V in C major (root-position triads, warm low register)
  const CHORDS = [
    [261.63, 329.63, 392.00], // C
    [220.00, 261.63, 329.63], // Am
    [174.61, 220.00, 261.63], // F
    [196.00, 246.94, 293.66], // G
  ];
  // C-major pentatonic for the melody
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  // a sparse, pleasant melodic pattern (indexes into PENTA; -1 = rest)
  const MELODY = [0, -1, 2, -1, 1, -1, 3, 4, -1, 2, -1, -1, 4, -1, 3, 2];

  function _ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      pad = ctx.createGain();  pad.gain.value = 0.045; pad.connect(ctx.destination);
      lead = ctx.createGain(); lead.gain.value = 0.05;  lead.connect(ctx.destination);
      return true;
    } catch (_) { ctx = null; return false; }
  }

  function _voice(out, freq, t, dur, type, peak) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
  }

  function _scheduleStep(s, t) {
    const bar = Math.floor(s / STEPS_PER_BAR);
    const inBar = s % STEPS_PER_BAR;
    // pad: re-voice the chord at the top of each bar, let it ring
    if (inBar === 0) {
      const chord = CHORDS[bar % CHORDS.length];
      chord.forEach((f, i) => _voice(pad, f, t, SPB * 3.6, 'triangle', 0.5 - i * 0.08));
    }
    // a soft bass pluck on beats 1 and 3
    if (inBar === 0 || inBar === 4) {
      _voice(pad, CHORDS[bar % CHORDS.length][0] / 2, t, SPB * 0.9, 'sine', 0.5);
    }
    // melody from the pattern
    const m = MELODY[s % MELODY.length];
    if (m >= 0) _voice(lead, PENTA[m], t, STEP * 1.6, 'sine', 0.9);
  }

  function _tick() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.25) {
      _scheduleStep(step % TOTAL, nextTime);
      nextTime += STEP;
      step++;
    }
  }

  function start() {
    if (!on || started) return;
    if (!_ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    started = true; step = 0; nextTime = ctx.currentTime + 0.08;
    timer = setInterval(_tick, 60);
  }
  function stop() {
    started = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  function isOn() { return on; }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem('dk_sound', on ? '1' : '0'); } catch (_) {}
    window.SFX?.setMuted(!on);
    if (on) start(); else stop();
  }
  function toggle() { setOn(!on); return on; }

  // restore preference (default on)
  try { if (localStorage.getItem('dk_sound') === '0') on = false; } catch (_) {}
  window.SFX?.setMuted(!on);

  // Music + audio need a user gesture; kick off on the first pointer interaction.
  document.addEventListener('pointerdown', () => { if (on) start(); }, true);

  return { start, stop, toggle, isOn, setOn };
})();

window.MUSIC = Music;
