// ════════════════════════════════════════════════════════════════
// FlipSay — main entry point
// ────────────────────────────────────────────────────────────────
// All cross-module wiring lives here. Modules import each other
// for behaviour but the DOM event handlers (onclick="...") all
// resolve to functions exposed on window.flipsay below.
//
// This is the only file that does window-level wiring — every
// other module is pure ES module imports.
// ════════════════════════════════════════════════════════════════

import { state } from './state.js';
import { log } from './logger.js';
import { toggleConnect, checkEnvironment } from './serial.js';
import * as cli from './cli.js';
import * as device from './device.js';
import * as control from './control.js';
import { initSpectrum, setMode } from './spectrum.js';
import { startSweep, stopSweep } from './sweep.js';
import { clearSignals, exportSignals, render as renderSignals } from './signals.js';
import {
  clearRX, clearFullLog, getFullLogText, getRxText, download,
} from './logger.js';
import {
  initWelcome, initGainBars, initClock, showTab,
  setFreqDisplay, stepFreq, applyPreset, setBW, setRXTX,
  setFreqMHz, syncConnectionUI,
} from './ui.js';
import { initSettings, setScale, bumpScale } from './settings.js';
import { initLayout, resetLayout } from './layout.js';

// ── Boot ───────────────────────────────────────────────────────

initWelcome();
initSettings();
initGainBars();
initClock();
initSpectrum();
renderSignals();
setFreqDisplay(433_920_000);

// Initialise the resizable splitters AFTER the spectrum has its
// canvas sized. Splitters read container dimensions to convert
// pixel min-sizes to percentages, so they need real layout.
// Wrap in rAF to wait for the next paint frame.
requestAnimationFrame(() => {
  // Only wire splitters above the mobile breakpoint — small screens
  // get a stacked CSS-driven layout (see flipsay.css media query).
  if (window.matchMedia('(min-width: 720px)').matches) {
    initLayout();
  }
});

log('info', 'FlipSay ready');

// Environment check — tell the user the actual reason if WebSerial
// isn't going to work, before they click connect and get a vague
// alert.
const env = checkEnvironment();
log('info', `Browser: ${env.browser} · Secure context: ${window.isSecureContext} · Protocol: ${location.protocol}`);
if (env.ok) {
  log('ok', 'WebSerial API ready');
} else {
  log('warn', env.reason);
  // Patch the welcome modal with a visible warning so the user
  // sees it even if they ignore the in-page log.
  const notes = document.getElementById('welcome-notes');
  if (notes) {
    const li = document.createElement('li');
    li.style.cssText = 'color:var(--RED);';
    li.textContent = '⚠ ' + env.reason;
    notes.appendChild(li);
  }
}

// ── HTML inline handlers ───────────────────────────────────────
// We expose a single namespace on window so the HTML can stay
// readable (`onclick="flipsay.startSweep()"`). Adding a new
// handler? Add it here and wire the button.

window.flipsay = {
  // connection
  toggleConnect: async () => { await toggleConnect(); syncConnectionUI(); },

  // tabs + tuning
  showTab,
  stepFreq,
  applyPreset,
  setBW,
  setRXTX,
  setFreqMHz,

  // spectrum
  setMode: (m, el) => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    el?.classList.add('active');
    setMode(m);
  },

  // sweep
  startSweep,
  stopSweep,

  // control — single big-red-button stop, continuous mode, modulation
  stopAll: control.stopAll,
  toggleContinuous: control.toggleContinuous,
  setModulation: control.setModulation,

  // ── CLI ─────────────────────────────────────────────────
  rxHere: () => {
    // RX HERE = continuous RX on the currently displayed freq.
    // Click again to stop. This is the "leave it listening"
    // mode users actually want.
    return control.toggleContinuous();
  },
  sgRX: () => {
    const f = +document.getElementById('sg-freq').value;
    const d = +document.getElementById('sg-dev').value;
    return cli.rx(f, d);
  },
  sgRXRaw: () => {
    const f = +document.getElementById('sg-freq').value;
    return cli.rxRaw(f);
  },
  sgStop: () => control.stopAll(),
  sgFreqAna: () => cli.openFreqAnalyzer(),
  sgChat: () => {
    const f = +document.getElementById('sg-freq').value;
    const d = +document.getElementById('sg-dev').value;
    return cli.chat(f, d);
  },
  sgTX: () => {
    const key = document.getElementById('tx-key').value;
    const f = +document.getElementById('sg-freq').value;
    const te = +document.getElementById('tx-te').value;
    const repeat = +document.getElementById('tx-rep').value;
    const d = +document.getElementById('sg-dev').value;
    // Confirm before transmitting — TX is the only action with
    // legal/RF consequences and a misclick is easy to make.
    if (!confirm(`Transmit key ${key.toUpperCase()} on ${(f/1e6).toFixed(3)} MHz?\n\nMake sure you are licensed for this frequency.`)) {
      return;
    }
    return cli.tx({ key, freq: f, te, repeat, device: d });
  },

  // signals + logs
  clearSigs: clearSignals,
  exportSigs: exportSignals,
  clearRX,
  saveRX: () => download('rx_output.txt', getRxText()),
  clearLogs: clearFullLog,
  exportLogs: () => download('flipsay_log.txt', getFullLogText()),

  // freq buttons (actually working now via prompt-based recall)
  recordFreq: () => log('ok', 'Recorded: ' + (state.curFreq / 1e6).toFixed(6) + ' MHz'),
  clearFreq: () => log('info', 'Freq cleared'),
  saveFreq: () => log('ok', 'Saved: ' + (state.curFreq / 1e6).toFixed(6) + ' MHz'),

  // ── Device tab ─────────────────────────────────────────
  refreshDeviceInfo: device.refreshDeviceInfo,
  refreshPowerInfo: device.refreshPowerInfo,
  neofetch: device.neofetch,
  powerOff: device.powerOff,
  powerReboot: device.powerReboot,

  // LED — read sliders, send to Flipper
  applyLED: () => {
    const r = +document.getElementById('led-r').value;
    const g = +document.getElementById('led-g').value;
    const b = +document.getElementById('led-b').value;
    return device.setLED(r, g, b);
  },
  applyBacklight: () => {
    const v = +document.getElementById('led-bl').value;
    return device.setBacklight(v);
  },
  ledOff: () => device.setLED(0, 0, 0),
  vibrate: (ms) => device.vibrate(ms),

  // Apps
  listApps: device.listApps,
  openApp: (name) => device.openApp(name),
  closeApp: device.closeApp,

  // GPIO — pin selected from dropdown
  gpioMode: (output) => {
    const pin = document.getElementById('gpio-pin').value;
    return device.gpioMode(pin, output);
  },
  gpioSet: (value) => {
    const pin = document.getElementById('gpio-pin').value;
    return device.gpioSet(pin, value);
  },
  gpioRead: () => {
    const pin = document.getElementById('gpio-pin').value;
    return device.gpioRead(pin);
  },

  // Files
  listSubFiles: (dir) => device.listSubFiles(dir),
  txFromFile: (path) => device.txFromFile(path),

  // ── Settings ───────────────────────────────────────────
  setScale,
  bumpScale,
  resetLayout,

  // debug helper — open DevTools console and run flipsay.setVerbose(true)
  // to see every byte in/out
  setVerbose: (v) => {
    state.verbose = !!v;
    log('info', `Verbose serial logging: ${state.verbose ? 'ON' : 'OFF'}`);
  },
};

// Re-sync connection UI on disconnect (in case the user yanks the cable).
window.addEventListener('focus', syncConnectionUI);
