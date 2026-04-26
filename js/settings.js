

import { log } from './logger.js';

const KEY_SCALE = 'flipsay.scale';
const MIN = 0.8;
const MAX = 3.0;
const STEP = 0.1;
const DEFAULT = 1.5;

export function initSettings() {

  const saved = parseFloat(localStorage.getItem(KEY_SCALE));
  if (!isNaN(saved) && saved >= MIN && saved <= MAX) {
    setScale(saved, true);
  }

  syncDisplay();

  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); bumpScale(STEP); }
    else if (e.key === '-')              { e.preventDefault(); bumpScale(-STEP); }
    else if (e.key === '0')              { e.preventDefault(); setScale(DEFAULT); }
  });
}

export function getScale() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--scale').trim();
  return parseFloat(v) || DEFAULT;
}

export function setScale(s, quiet = false) {
  s = Math.max(MIN, Math.min(MAX, Math.round(s * 10) / 10));
  document.documentElement.style.setProperty('--scale', s);
  localStorage.setItem(KEY_SCALE, String(s));
  syncDisplay();

  window.dispatchEvent(new Event('resize'));
  if (!quiet) log('info', `UI scale: ${s.toFixed(1)}×`);
}

export function bumpScale(delta) {
  setScale(getScale() + delta);
}

function syncDisplay() {
  const el = document.getElementById('scale-val');
  if (el) el.textContent = getScale().toFixed(1) + '×';
  const sl = document.getElementById('scale-sl');
  if (sl) sl.value = String(getScale());
}
