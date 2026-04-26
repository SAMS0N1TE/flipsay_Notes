// ════════════════════════════════════════════════════════════════
// FlipSay — audio cues
// ────────────────────────────────────────────────────────────────
// Plays a little chime on connect/disconnect and an error blip on
// failure. Uses WebAudio so no asset files needed.
//
// Browsers block AudioContext until the user has interacted with
// the page, so we lazy-create on first use. The connect chime
// fires from a click handler so it'll always be allowed.
// ════════════════════════════════════════════════════════════════

let ctx = null;

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) { return null; }
  }
  // Resume in case it was suspended.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Play a single tone. freq Hz, duration ms, amplitude 0-1.
function tone(freq, durationMs, amp = 0.15, type = 'square', startOffset = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + startOffset;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Tiny attack/release to avoid clicks.
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(amp, t0 + 0.005);
  gain.gain.linearRampToValueAtTime(amp, t0 + (durationMs / 1000) - 0.005);
  gain.gain.linearRampToValueAtTime(0, t0 + (durationMs / 1000));
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + (durationMs / 1000) + 0.01);
}

// Play a sequence of tones — array of [freq, durationMs] pairs.
function sequence(notes, type = 'square', amp = 0.15) {
  let offset = 0;
  for (const [freq, dur] of notes) {
    tone(freq, dur, amp, type, offset);
    offset += dur / 1000;
  }
}

// ── Public chimes ──────────────────────────────────────────────

// Two-note ascending chime — "you're connected".
export function connectChime() {
  sequence([
    [523, 80],   // C5
    [784, 120],  // G5
  ]);
}

// Three-note descending tritone — "disconnected".
export function disconnectChime() {
  sequence([
    [784, 60],   // G5
    [659, 60],   // E5
    [440, 100],  // A4
  ]);
}

// Sad descending — "error".
export function errorChime() {
  sequence([
    [392, 80],
    [294, 200],
  ], 'sawtooth', 0.18);
}

// Soft tick — useful for "signal detected" feedback later.
export function tick() {
  tone(1200, 30, 0.08, 'square');
}
