

import { state } from './state.js';
import { log, appendRX, appendFullLog } from './logger.js';
import { ingestRSSI } from './spectrum.js';
import { addSignal } from './signals.js';
import { setFreqDisplay } from './ui.js';
import { continuousReissue } from './control.js';

const ANSI = /\x1b\[[0-9;]*m/g;

export function onLine(rawLine) {
  const line = rawLine.replace(ANSI, '');

  log('info', line);
  appendRX(line);
  appendFullLog(line);

  parseDeviceName(line);
  parsePacketCount(line);
  parseListeningFreq(line);
  parseRSSI(line);
  parseSignalDetection(line);
  parsePowerInfo(line);
  parseAppList(line);
  parseFileList(line);
  parseGpioRead(line);
  parsePromptForContinuous(line);
}

function parsePromptForContinuous(line) {
  if (!state.continuousRx) return;

  if (/^>:\s*$/.test(line)) {
    continuousReissue();
  }
}

function parseDeviceName(line) {
  if (!/hardware_name/i.test(line)) return;
  const name = line.split(':').pop().trim();
  if (!name) return;
  const el = document.getElementById('conn-device');
  if (el) el.textContent = 'Connected to: ' + name.toUpperCase().slice(0, 12);
}

function parsePacketCount(line) {
  const m = line.match(/Packets received\s+(\d+)/i);
  if (!m) return;
  state.pktCount = +m[1];
  const el = document.getElementById('pkt-count');
  if (el) el.textContent = state.pktCount;
}

function parseListeningFreq(line) {
  const m = line.match(/Listening at\s+frequency:\s+(\d{8,9})/i);
  if (!m) return;
  const f = +m[1];
  state.activeRxFreq = f;
  if (!state.sweeping) setFreqDisplay(f);

  if (state.sweeping || state.continuousRx) {
    ingestRSSI(-88 + Math.random() * 4, f, false);
  }
}

function parseRSSI(line) {
  const m =
    line.match(/RSSI[:\s]+(-?\d+(?:\.\d+)?)/i) ||
    line.match(/(-\d+(?:\.\d+)?)\s*dBm/i);
  if (!m) return;
  const rssi = parseFloat(m[1]);

  const freq = state.sweeping && state.activeRxFreq
    ? state.activeRxFreq
    : state.curFreq;
  ingestRSSI(rssi, freq, false);
}

function parseSignalDetection(line) {
  if (!/signal[\s_]detected|protocol:|key:/i.test(line)) return;
  log('signal', 'Signal: ' + line.slice(0, 60));
  addSignal(line);

  const freq = state.activeRxFreq || state.curFreq;
  ingestRSSI(-45 + Math.random() * 10, freq, true);
}

const POWER_FIELDS = {
  charge_level: 'pwr-charge',
  gauge_voltage: 'pwr-voltage',
  gauge_current: 'pwr-current',
  gauge_temperature: 'pwr-temp',
  health: 'pwr-health',
};
function parsePowerInfo(line) {
  const m = line.match(/^(\w+)\s*:\s*(.+?)$/);
  if (!m) return;
  const [, key, value] = m;
  if (key in POWER_FIELDS) {
    const el = document.getElementById(POWER_FIELDS[key]);
    if (el) el.textContent = value.trim();
  }
}

function parseAppList(line) {
  if (!state.expectingAppList) return;
  if (/^>:/.test(line) || /^Applications:/i.test(line)) {
    if (/^>:/.test(line)) state.expectingAppList = false;
    return;
  }

  if (/^(?:OK|ERROR|Listening|Packets|RSSI|Load_keystore|Welcome|Read|Run|Firmware|info|device_info)/i.test(line)) return;
  if (line.length > 60) return;
  state.apps.push(line.trim());
  renderApps();
}

function renderApps() {
  const c = document.getElementById('app-list');
  if (!c) return;
  if (!state.apps.length) {
    c.innerHTML = '<div style="font-size:var(--small);color:var(--DIM);">No apps loaded.</div>';
    return;
  }
  c.innerHTML = '';
  for (const name of state.apps) {
    const btn = document.createElement('button');
    btn.className = 'pxbtn';
    btn.style.cssText = 'margin:2px;font-size:var(--small);';
    btn.textContent = name;
    btn.onclick = () => window.flipsay?.openApp(name);
    c.appendChild(btn);
  }
}

function parseFileList(line) {
  if (!state.subListingDir) return;
  const m = line.match(/^\[([FD])\]\s+(.+)$/);
  if (!m) {
    if (/^>:/.test(line)) state.subListingDir = null;
    return;
  }
  const [, kind, name] = m;
  state.subFiles.push({ kind, name });
  renderSubFiles();
}

function renderSubFiles() {
  const c = document.getElementById('sub-list');
  if (!c) return;
  if (!state.subFiles.length) {
    c.innerHTML = '<div style="font-size:var(--small);color:var(--DIM);">No files.</div>';
    return;
  }
  c.innerHTML = '';
  for (const f of state.subFiles) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:3px 0;font-size:var(--small);';
    const icon = document.createElement('span');
    icon.textContent = f.kind === 'D' ? '📁' : '📄';
    icon.style.cssText = 'opacity:0.7;';
    const label = document.createElement('span');
    label.textContent = f.name;
    label.style.cssText = 'flex:1;color:var(--OB);';
    row.appendChild(icon);
    row.appendChild(label);
    if (f.kind === 'F' && /\.sub$/i.test(f.name)) {
      const btn = document.createElement('button');
      btn.className = 'pxbtn red';
      btn.style.cssText = 'font-size:var(--tiny);padding:2px 6px;';
      btn.textContent = 'TX';
      btn.onclick = () => window.flipsay?.txFromFile(`/ext/subghz/${f.name}`);
      row.appendChild(btn);
    }
    c.appendChild(row);
  }
}

function parseGpioRead(line) {
  if (!state.expectingGpioRead) return;
  const m = line.match(/^[01]$/);
  if (m) {
    log('ok', `GPIO ${state.expectingGpioRead}: ${m[0]}`);
    state.expectingGpioRead = null;
  } else if (/^>:/.test(line)) {
    state.expectingGpioRead = null;
  }
}
