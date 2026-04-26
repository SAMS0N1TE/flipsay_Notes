

import { state } from './state.js';
import { download } from './logger.js';

const MAX_SIGNALS = 200;

export function addSignal(line) {
  const now = new Date().toTimeString().slice(0, 8);
  state.signals.unshift({
    freq: (state.curFreq / 1e6).toFixed(3),
    time: now,
    data: line.slice(0, 50),
    rssi: state.lastRSSI.toFixed(0),
  });
  if (state.signals.length > MAX_SIGNALS) state.signals.length = MAX_SIGNALS;
  render();
}

export function render() {
  const c = document.getElementById('siglist');
  if (!c) return;
  if (!state.signals.length) {
    c.innerHTML = '<div style="font-size:6px;color:var(--DIM);">No signals detected yet.</div>';
    return;
  }

  c.innerHTML = '';
  for (const s of state.signals.slice(0, 60)) {
    const item = document.createElement('div');
    item.className = 'sig-item';
    const sf = document.createElement('span'); sf.className = 'sf'; sf.textContent = `${s.freq} MHz`;
    const sp = document.createElement('span'); sp.className = 'sp'; sp.textContent = s.data;
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = `${s.rssi} dBm`;
    const tt = document.createElement('span'); tt.style.cssText = 'font-size:5px;color:var(--DIM);';
    tt.textContent = s.time;
    item.append(sf, sp, sr, tt);
    c.appendChild(item);
  }
}

export function clearSignals() {
  state.signals.length = 0;
  render();
}

export function exportSignals() {
  const text = state.signals
    .map(s => `${s.time}\t${s.freq}MHz\t${s.rssi}dBm\t${s.data}`)
    .join('\n');
  download('signals.txt', text);
}
