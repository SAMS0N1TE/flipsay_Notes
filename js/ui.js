// ════════════════════════════════════════════════════════════════
// FlipSay — UI wiring
// ────────────────────────────────────────────────────────────────
// DOM event handlers that don't belong to a specific module.
// Tabs, frequency display sync, gain sliders, welcome modal.
// ════════════════════════════════════════════════════════════════

import { state, isValidFlipperFreq } from './state.js';
import { log } from './logger.js';

// ── Welcome modal ──────────────────────────────────────────────

export function initWelcome() {
  const modal = document.getElementById('welcome');
  const okBtn = document.getElementById('welcome-ok');
  if (!modal) return;

  const close = () => { modal.style.display = 'none'; };
  okBtn?.addEventListener('click', close);

  // Click outside the box to dismiss.
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  // Escape to dismiss.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display !== 'none') close();
  });
}

// ── Tabs ───────────────────────────────────────────────────────

export function showTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  // Defer resize so the canvas picks up the new container size.
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

// ── Frequency display ──────────────────────────────────────────

export function setFreqDisplay(hz) {
  state.curFreq = hz;
  const mhz = (hz / 1e6).toFixed(6);
  // Update the editable input only if the user isn't currently
  // editing it — would be jarring to have it overwritten mid-type.
  const input = document.getElementById('fdisp-input');
  if (input && document.activeElement !== input) input.value = mhz;
  const big = document.getElementById('bigfreq');
  if (big) big.textContent = mhz;
  document.getElementById('lo-v').textContent = ((hz / 1e6) - 2.2).toFixed(2) + ' MHz';
  const bw = state.curBW / 1000;
  document.getElementById('xa-l').textContent  = ((hz / 1e6) - bw * 0.9).toFixed(1) + ' MHz';
  document.getElementById('xa-m1').textContent = ((hz / 1e6) - bw * 0.4).toFixed(3) + ' m';
  document.getElementById('xa-c').textContent  = mhz + ' MHz';
  document.getElementById('xa-m2').textContent = ((hz / 1e6) + bw * 0.4).toFixed(3) + ' m';
  document.getElementById('xa-r').textContent  = ((hz / 1e6) + bw * 0.9).toFixed(1) + ' MHz';
}

// Set frequency from a MHz string/number (input handler).
export function setFreqMHz(v) {
  const mhz = parseFloat(v);
  if (isNaN(mhz)) return;
  const hz = Math.round(mhz * 1e6);
  if (hz < 300_000_000 || hz > 928_000_000) {
    log('warn', 'Frequency out of CC1101 range (300-928 MHz)');
    return;
  }
  setFreqDisplay(hz);
}

// stepFreq now takes a MHz delta (e.g. 0.01 = 10 kHz).
export function stepFreq(deltaMHz) {
  const next = state.curFreq + Math.round(deltaMHz * 100_000);
  state.curFreq = Math.max(300_000_000, Math.min(928_000_000, next));
  setFreqDisplay(state.curFreq);
}

export function applyPreset(v) {
  const f = +v;
  if (!isValidFlipperFreq(f)) { log('warn', 'Preset out of CC1101 range'); return; }
  setFreqDisplay(f);
}

export function setBW(v) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 50) return;
  state.curBW = n;
  const input = document.getElementById('bw-input');
  if (input && document.activeElement !== input) input.value = n;
  const sb = document.getElementById('sb-bw');
  if (sb) sb.textContent = n + ' kHz';
  setFreqDisplay(state.curFreq);
  state.specReal.fill(null);
  state.specPkg.fill(null);
}

export function setRXTX(mode) {
  state.rxOrTx = mode;
  document.getElementById('rx-b').classList.toggle('on', mode === 'rx');
  document.getElementById('tx-b').classList.toggle('on', mode === 'tx');
}

// ── Gain bars ──────────────────────────────────────────────────
// These currently only update local UI. A future contribution
// could wire them to actual CC1101 register writes via a custom
// firmware command — see TODO in README.

const gainMax = { lna: 40, mix: 24, if: 40 };

export function initGainBars() {
  for (const id of ['lna', 'mix', 'if']) {
    const el = document.getElementById(id + '-track');
    if (!el) continue;
    let dragging = false;
    const moveTo = clientX => {
      const r = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100));
      applyGain(id, pct / 100 * gainMax[id]);
    };
    el.addEventListener('mousedown', e => { dragging = true; moveTo(e.clientX); });
    window.addEventListener('mousemove', e => { if (dragging) moveTo(e.clientX); });
    window.addEventListener('mouseup', () => { dragging = false; });
    el.addEventListener('touchstart', e => { dragging = true; moveTo(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove',  e => { if (dragging) moveTo(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchend',   () => { dragging = false; });
  }
}

function applyGain(id, db) {
  db = Math.max(0, Math.min(gainMax[id], Math.round(db)));
  const pct = db / gainMax[id] * 100;
  document.getElementById(id + '-fill').style.width = pct + '%';
  document.getElementById(id + '-head').style.left = pct + '%';
  const map = { lna: ['rp-lna', 'rp-lna-v'], mix: ['rp-mix', 'rp-mix-v'], if: ['rp-if', 'rp-if-v'] };
  document.getElementById(map[id][0]).style.width = pct + '%';
  document.getElementById(map[id][1]).textContent = db + ' dB';
}

// ── Status bar clock ───────────────────────────────────────────

export function initClock() {
  const tick = () => {
    const el = document.getElementById('sbar-time');
    if (el) el.textContent = new Date().toTimeString().slice(0, 8);
  };
  tick();
  setInterval(tick, 1000);
}

// ── Connection-state UI sync ───────────────────────────────────
// Called from main when serial connection state changes.

export function syncConnectionUI() {
  const btn = document.getElementById('conn-btn');
  const dev = document.getElementById('conn-device');
  const tty = document.getElementById('conn-tty');
  const dot = document.getElementById('dot');
  const conn = document.getElementById('sb-conn');
  const overlay = document.getElementById('overlay');

  if (state.connected) {
    btn.textContent = 'DISCONNECT';
    btn.classList.add('on');
    overlay.classList.add('hidden');
    dev.textContent = 'Connected to: FLIPPER';
    tty.textContent = 'Debug TTY open';
    dot.style.color = 'var(--GRN)';
    conn.textContent = 'Connected via Debug Mode';
  } else {
    btn.textContent = 'CONNECT USB';
    btn.classList.remove('on');
    overlay.classList.remove('hidden');
    dev.textContent = 'Not Connected';
    tty.textContent = 'USB Serial Disconnected';
    dot.style.color = 'var(--O)';
    conn.textContent = 'Disconnected';
  }
}
