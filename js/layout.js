// ════════════════════════════════════════════════════════════════
// FlipSay — resizable layout
// ────────────────────────────────────────────────────────────────
// Wires the splitter to the spectrum view's regions. Three splits:
//
//   1. #spectrum-body  — center | right    (horizontal)
//   2. #center         — top stack | lower (vertical)
//   3. #lower          — demod | gain | mini-logs (horizontal)
//
// Sizes are persisted to localStorage per split.
// ════════════════════════════════════════════════════════════════

import { createSplit } from './vendor/split.js';

let splits = {};

export function initLayout() {
  // Outer: center (spectrum/canvas/lower) vs right panel.
  splits.body = createSplit({
    container: document.getElementById('spectrum-body'),
    direction: 'horizontal',
    children: ['#center', '#right'],
    sizes:    [78, 22],
    minSizes: [320, 180],
    storageKey: 'flipsay.layout.body',
  });

  // Center column: top region (containing freq bar + mode bar +
  // spectrum) vs the lower strip (demod / gain / logs). Wraps the
  // top region in a single child for simpler splitting.
  splits.center = createSplit({
    container: document.getElementById('center'),
    direction: 'vertical',
    children: ['#center-top', '#lower'],
    sizes:    [70, 30],
    minSizes: [200, 80],
    storageKey: 'flipsay.layout.center',
  });

  // Lower strip: 3-way horizontal split.
  splits.lower = createSplit({
    container: document.getElementById('lower'),
    direction: 'horizontal',
    children: ['#demod', '#gain', '#mini-logs'],
    sizes:    [25, 45, 30],
    minSizes: [140, 160, 160],
    storageKey: 'flipsay.layout.lower',
  });
}

// Reset all panel sizes to their defaults.
export function resetLayout() {
  ['flipsay.layout.body','flipsay.layout.center','flipsay.layout.lower'].forEach(k => {
    try { localStorage.removeItem(k); } catch(_) {}
  });
  // Easiest way to apply defaults is a reload — the splitters read
  // sizes once at init.
  location.reload();
}
