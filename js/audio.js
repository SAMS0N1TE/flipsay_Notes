

let ctx = null;

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) { return null; }
  }

  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, durationMs, amp = 0.15, type = 'square', startOffset = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + startOffset;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(amp, t0 + 0.005);
  gain.gain.linearRampToValueAtTime(amp, t0 + (durationMs / 1000) - 0.005);
  gain.gain.linearRampToValueAtTime(0, t0 + (durationMs / 1000));
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + (durationMs / 1000) + 0.01);
}

function sequence(notes, type = 'square', amp = 0.15) {
  let offset = 0;
  for (const [freq, dur] of notes) {
    tone(freq, dur, amp, type, offset);
    offset += dur / 1000;
  }
}

export function connectChime() {
  sequence([
    [523, 80],
    [784, 120],
  ]);
}

export function disconnectChime() {
  sequence([
    [784, 60],
    [659, 60],
    [440, 100],
  ]);
}

export function errorChime() {
  sequence([
    [392, 80],
    [294, 200],
  ], 'sawtooth', 0.18);
}

export function tick() {
  tone(1200, 30, 0.08, 'square');
}
