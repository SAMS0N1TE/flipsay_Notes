

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

initWelcome();
initSettings();
initGainBars();
initClock();
initSpectrum();
renderSignals();
setFreqDisplay(433_920_000);

requestAnimationFrame(() => {

  if (window.matchMedia('(min-width: 720px)').matches) {
    initLayout();
  }
});

log('info', 'FlipSay ready');

const env = checkEnvironment();
log('info', `Browser: ${env.browser} · Secure context: ${window.isSecureContext} · Protocol: ${location.protocol}`);
if (env.ok) {
  log('ok', 'WebSerial API ready');
} else {
  log('warn', env.reason);

  const notes = document.getElementById('welcome-notes');
  if (notes) {
    const li = document.createElement('li');
    li.style.cssText = 'color:var(--RED);';
    li.textContent = '⚠ ' + env.reason;
    notes.appendChild(li);
  }
}

window.flipsay = {

  toggleConnect: async () => { await toggleConnect(); syncConnectionUI(); },

  showTab,
  stepFreq,
  applyPreset,
  setBW,
  setRXTX,
  setFreqMHz,

  setMode: (m, el) => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    el?.classList.add('active');
    setMode(m);
  },

  startSweep,
  stopSweep,

  stopAll: control.stopAll,
  toggleContinuous: control.toggleContinuous,
  setModulation: control.setModulation,

  rxHere: () => {

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

    if (!confirm(`Transmit key ${key.toUpperCase()} on ${(f/1e6).toFixed(3)} MHz?\n\nMake sure you are licensed for this frequency.`)) {
      return;
    }
    return cli.tx({ key, freq: f, te, repeat, device: d });
  },

  clearSigs: clearSignals,
  exportSigs: exportSignals,
  clearRX,
  saveRX: () => download('rx_output.txt', getRxText()),
  clearLogs: clearFullLog,
  exportLogs: () => download('flipsay_log.txt', getFullLogText()),

  recordFreq: () => log('ok', 'Recorded: ' + (state.curFreq / 1e6).toFixed(6) + ' MHz'),
  clearFreq: () => log('info', 'Freq cleared'),
  saveFreq: () => log('ok', 'Saved: ' + (state.curFreq / 1e6).toFixed(6) + ' MHz'),

  refreshDeviceInfo: device.refreshDeviceInfo,
  refreshPowerInfo: device.refreshPowerInfo,
  neofetch: device.neofetch,
  powerOff: device.powerOff,
  powerReboot: device.powerReboot,

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

  listApps: device.listApps,
  openApp: (name) => device.openApp(name),
  closeApp: device.closeApp,

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

  listSubFiles: (dir) => device.listSubFiles(dir),
  txFromFile: (path) => device.txFromFile(path),

  setScale,
  bumpScale,
  resetLayout,

  setVerbose: (v) => {
    state.verbose = !!v;
    log('info', `Verbose serial logging: ${state.verbose ? 'ON' : 'OFF'}`);
  },
};

window.addEventListener('focus', syncConnectionUI);
