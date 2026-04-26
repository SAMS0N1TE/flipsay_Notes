

import { state, BINS } from './state.js';

const MODE_DESCS = {
  real: 'Amplified real RSSI · tiny signals visible',
  sim:  'Always-on simulation · demo data only',
  pkg:  'Captured packets only · real decoded data',
};

function uiScale() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--scale').trim();
  const n = parseFloat(v);
  return isNaN(n) ? 1.5 : n;
}

let SC, WC, SX, WX;
let wfImageData = null;
let cachedEls = {};
let lastWFTime = 0;

export function initSpectrum() {
  SC = document.getElementById('spec-canvas');
  WC = document.getElementById('wf-canvas');
  SX = SC.getContext('2d');

  WX = WC.getContext('2d', { willReadFrequently: true });

  cachedEls = {
    badge:    document.getElementById('data-badge'),
    modeDesc: document.getElementById('mode-desc'),
    modeBadge:document.getElementById('mode-badge'),
    sbModeText: document.getElementById('sb-mode-txt'),
    liveRssi: document.getElementById('live-rssi'),
    sbRssi:   document.getElementById('sb-rssi'),
    sigfill:  document.getElementById('sigfill'),
  };

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
}

function resize() {
  const zone = document.getElementById('canvases');
  if (!zone) return;
  const w = zone.clientWidth || 600;
  const h = zone.clientHeight || 270;
  SC.width = w;
  SC.height = Math.max(60, h - WC.height - 18);
  WC.width = w;

  wfImageData = WX.createImageData(WC.width, WC.height);
}

export function setMode(mode) {
  state.specMode = mode;
  if (cachedEls.modeDesc) cachedEls.modeDesc.textContent = MODE_DESCS[mode];
  if (cachedEls.modeBadge) cachedEls.modeBadge.textContent = mode.toUpperCase();
  if (cachedEls.sbModeText) cachedEls.sbModeText.textContent = mode.toUpperCase();
  updateBadge();
  if (mode === 'pkg') state.specPkg.fill(null);
}

function updateBadge() {
  const b = cachedEls.badge;
  if (!b) return;
  if (state.specMode === 'sim') {
    b.className = 'data-badge sim'; b.textContent = '● SIMULATION';
  } else if (state.specMode === 'pkg') {
    b.className = 'data-badge pkg'; b.textContent = '● PACKAGE';
  } else if (state.connected) {
    b.className = 'data-badge real'; b.textContent = '● REAL DATA';
  } else {
    b.className = 'data-badge idle'; b.textContent = '● WAITING';
  }
}

export function ingestRSSI(rssi, freq, isPacket) {
  state.lastRSSI = rssi;
  if (cachedEls.liveRssi) cachedEls.liveRssi.textContent = rssi.toFixed(1) + ' dBm';
  if (cachedEls.sbRssi)   cachedEls.sbRssi.textContent   = rssi.toFixed(1) + ' dBm';
  const pct = Math.max(0, Math.min(100, (rssi + 100) / 65 * 100));
  if (cachedEls.sigfill) cachedEls.sigfill.style.width = pct + '%';

  const bwHz = state.curBW * 1000;
  const fMin = state.curFreq - bwHz / 2;
  const fMax = state.curFreq + bwHz / 2;
  const bin = Math.round((freq - fMin) / (fMax - fMin) * (BINS - 1));
  if (bin < 0 || bin >= BINS) return;

  state.specReal[bin] = state.specReal[bin] === null
    ? rssi
    : state.specReal[bin] * 0.5 + rssi * 0.5;

  for (const d of [-2, -1, 1, 2]) {
    const b = bin + d;
    if (b < 0 || b >= BINS) continue;
    const s = rssi - Math.abs(d) * 5;
    state.specReal[b] = state.specReal[b] === null
      ? s
      : Math.max(state.specReal[b] * 0.65 + s * 0.35, state.specReal[b]);
  }

  if (isPacket) {
    state.specPkg[bin] = state.specPkg[bin] === null
      ? rssi
      : Math.max(state.specPkg[bin], rssi);
    for (const d of [-1, 1]) {
      const b = bin + d;
      if (b < 0 || b >= BINS) continue;
      state.specPkg[b] = state.specPkg[b] === null
        ? rssi - 6
        : Math.max(state.specPkg[b], rssi - 6);
    }
  }

  if (state.specMode === 'real') updateBadge();
}

function tickSim() {
  state.simPhase += 0.04;
  const n = BINS, d = new Array(n);
  for (let i = 0; i < n; i++) {
    let v = -85 + Math.sin(i * 0.3 + state.simPhase) * 2 + Math.random() * 4 - 2;
    const cx = n / 2, dx = i - cx;
    v += Math.exp(-dx * dx / (n * 0.06)) * 32;
    for (const s of [n * 0.25, n * 0.75]) {
      const ds = i - s;
      v += Math.exp(-ds * ds / (n * 0.015)) * (10 + Math.sin(state.simPhase * 2) * 5);
    }
    if (Math.random() < 0.01) v += Math.random() * 18;
    d[i] = v;
  }
  return d;
}

function getRealDisplay() {
  const hasData = state.specReal.some(v => v !== null);
  if (!hasData) return new Array(BINS).fill(-92);

  return state.specReal.map(v => {
    if (v === null) return -92;
    const normalized = (v + 100) / 40;
    return Math.min(-10, -90 + normalized * 70);
  });
}

function getPkgDisplay() {
  return state.specPkg.map(v => v === null ? -95 : v);
}

function getDisplayData() {
  if (state.specMode === 'sim') return tickSim();
  if (state.specMode === 'pkg') return getPkgDisplay();
  return getRealDisplay();
}

function drawSpec(data) {
  const w = SC.width, h = SC.height;
  if (!w || !h) return;
  SX.fillStyle = '#0C0700'; SX.fillRect(0, 0, w, h);

  SX.strokeStyle = 'rgba(255,128,0,0.09)'; SX.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = h / 4 * i;
    SX.beginPath(); SX.moveTo(0, y); SX.lineTo(w, y); SX.stroke();
  }
  for (let i = 0; i <= 8; i++) {
    const x = w / 8 * i;
    SX.beginPath(); SX.moveTo(x, 0); SX.lineTo(x, h); SX.stroke();
  }

  if (state.specMode !== 'sim' && !data.some(v => v > -93)) {
    SX.strokeStyle = 'rgba(122,69,0,0.35)'; SX.setLineDash([4, 6]);
    SX.beginPath(); SX.moveTo(0, h * 0.88); SX.lineTo(w, h * 0.88); SX.stroke();
    SX.setLineDash([]);
    SX.fillStyle = 'rgba(122,69,0,0.55)';
    SX.font = `${Math.round(6 * uiScale())}px "Press Start 2P"`;
    SX.textAlign = 'center';
    SX.fillText(
      state.specMode === 'pkg' ? 'WAITING FOR PACKETS' : 'USE ▶ SWEEP OR RX HERE',
      w / 2, h / 2,
    );
    SX.textAlign = 'left';
    return;
  }

  const n = data.length, step = w / n;
  const minR = -100, rng = 90;

  SX.beginPath(); SX.moveTo(0, h);
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const y = h - Math.max(0, (data[i] - minR) / rng) * h;
    SX.lineTo(x, y);
  }
  SX.lineTo(w, h); SX.closePath();
  const g = SX.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0,    'rgba(255,160,48,0.9)');
  g.addColorStop(0.38, 'rgba(255,128,0,0.52)');
  g.addColorStop(0.72, 'rgba(160,80,0,0.22)');
  g.addColorStop(1,    'rgba(20,8,0,0.04)');
  SX.fillStyle = g; SX.fill();

  SX.beginPath();
  SX.strokeStyle = '#FFB040'; SX.lineWidth = 1.5;
  SX.shadowColor = '#FF8000'; SX.shadowBlur = 6;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const y = h - Math.max(0, (data[i] - minR) / rng) * h;
    if (i === 0) SX.moveTo(x, y); else SX.lineTo(x, y);
  }
  SX.stroke(); SX.shadowBlur = 0;

  SX.setLineDash([4, 4]);
  SX.strokeStyle = 'rgba(255,200,80,0.4)'; SX.lineWidth = 1;
  SX.beginPath(); SX.moveTo(w / 2, 0); SX.lineTo(w / 2, h); SX.stroke();
  SX.setLineDash([]);

  SX.fillStyle = 'rgba(255,128,0,0.4)';
  SX.font = `${Math.round(5 * uiScale())}px "Press Start 2P"`;
  for (const [db, f] of [[-20, 0.05], [-40, 0.26], [-60, 0.48], [-80, 0.70], [-90, 0.87]]) {
    SX.fillText(db + 'dB', 2, h * f + 6);
  }
}

function drawWF(data) {
  const w = WC.width, h = WC.height;
  if (!w || !h || !wfImageData) return;
  const shift = 4;

  const prev = WX.getImageData(0, 0, w, h);
  wfImageData.data.set(prev.data.subarray(0, w * (h - shift) * 4), w * shift * 4);

  const n = data.length;
  const hasAny = data.some(v => v > -93);
  for (let x = 0; x < w; x++) {
    const idx = Math.floor(x / w * n);
    const v = data[idx] ?? -95;
    const t = hasAny ? Math.max(0, Math.min(1, (v + 100) / 90)) : 0;
    const r = Math.floor(t * 255);
    const g2 = Math.floor(t * t * 135);
    for (let s = 0; s < shift; s++) {
      const base = (s * w + x) * 4;
      wfImageData.data[base]     = r;
      wfImageData.data[base + 1] = g2;
      wfImageData.data[base + 2] = 0;
      wfImageData.data[base + 3] = 255;
    }
  }
  WX.putImageData(wfImageData, 0, 0);
}

function frame(ts) {
  const data = getDisplayData();
  drawSpec(data);

  if (ts - lastWFTime > 120) { drawWF(data); lastWFTime = ts; }
  requestAnimationFrame(frame);
}
