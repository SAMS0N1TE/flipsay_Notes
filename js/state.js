// ════════════════════════════════════════════════════════════════
// FlipSay — central app state
// ────────────────────────────────────────────────────────────────
// All shared mutable state lives here. Modules import `state` and
// read/mutate fields directly. This replaces the loose globals from
// the original single-file build and gives us one place to look
// when debugging "where is X coming from?".
// ════════════════════════════════════════════════════════════════

export const BINS = 64;

export const state = {
  // ── WebSerial ──
  port: null,
  reader: null,
  writer: null,
  readerAbort: null,    // AbortController for the read pipe
  writerAbort: null,    // AbortController for the write pipe
  readPromise: null,    // pipeTo() promise — awaited on disconnect
  writePromise: null,
  rxBuffer: '',         // partial-line buffer from serial
  connected: false,

  // ── Tuner ──
  curFreq: 433_920_000, // Hz
  curBW: 1000,          // kHz
  rxOrTx: 'rx',
  modulation: 'AM650',  // AM650 | AM270 | FM238 | FM476 — used for TX preset

  // ── Continuous RX ──
  // When true, the parser auto-restarts `subghz rx` whenever it
  // sees the prompt return — useful for "park on this freq and
  // listen forever" mode.
  continuousRx: false,
  continuousFreq: null,

  // ── Sweep ──
  sweeping: false,
  sweepFreqs: [],
  sweepIdx: 0,
  sweepTimer: null,
  // The frequency the Flipper is currently tuned to during a sweep.
  // ingestRSSI uses this (when set) instead of curFreq so the
  // spectrum actually reflects the swept band.
  activeRxFreq: null,

  // ── Spectrum ──
  // Three independent buffers — switching modes doesn't destroy data.
  specReal: new Array(BINS).fill(null),
  specPkg:  new Array(BINS).fill(null),
  specMode: 'real',     // 'real' | 'sim' | 'pkg'
  simPhase: 0,

  // ── Stats ──
  pktCount: 0,
  lastRSSI: -90,
  signals: [],          // array of {freq, time, data, rssi}

  // ── Device tab ──
  apps: [],
  expectingAppList: false,
  subFiles: [],
  subListingDir: null,
  expectingGpioRead: null,

  // ── Debug ──
  // Set true to log every TX/RX byte to the browser console.
  // Toggle from DevTools: `flipsay.setVerbose(true)`
  verbose: false,
};

// Flipper CC1101 legal sub-bands (Hz). Used to gate TX commands.
export const FLIPPER_BANDS = [
  [299_999_755, 348_000_000],
  [386_999_938, 464_000_000],
  [778_999_847, 928_000_000],
];

export function isValidFlipperFreq(f) {
  return FLIPPER_BANDS.some(([lo, hi]) => f >= lo && f <= hi);
}

// Sleep helper — used everywhere, lives here so there's one copy.
export const sleep = ms => new Promise(r => setTimeout(r, ms));
