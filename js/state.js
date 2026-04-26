

export const BINS = 64;

export const state = {

  port: null,
  reader: null,
  writer: null,
  readerAbort: null,
  writerAbort: null,
  readPromise: null,
  writePromise: null,
  rxBuffer: '',
  connected: false,

  curFreq: 433_920_000,
  curBW: 1000,
  rxOrTx: 'rx',
  modulation: 'AM650',

  continuousRx: false,
  continuousFreq: null,

  sweeping: false,
  sweepFreqs: [],
  sweepIdx: 0,
  sweepTimer: null,

  activeRxFreq: null,

  specReal: new Array(BINS).fill(null),
  specPkg:  new Array(BINS).fill(null),
  specMode: 'real',
  simPhase: 0,

  pktCount: 0,
  lastRSSI: -90,
  signals: [],

  apps: [],
  expectingAppList: false,
  subFiles: [],
  subListingDir: null,
  expectingGpioRead: null,

  verbose: false,
};

export const FLIPPER_BANDS = [
  [299_999_755, 348_000_000],
  [386_999_938, 464_000_000],
  [778_999_847, 928_000_000],
];

export function isValidFlipperFreq(f) {
  return FLIPPER_BANDS.some(([lo, hi]) => f >= lo && f <= hi);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
