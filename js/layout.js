

import { createSplit } from './vendor/split.js';

let splits = {};

export function initLayout() {

  splits.body = createSplit({
    container: document.getElementById('spectrum-body'),
    direction: 'horizontal',
    children: ['#center', '#right'],
    sizes:    [78, 22],
    minSizes: [320, 180],
    storageKey: 'flipsay.layout.body',
  });

  splits.center = createSplit({
    container: document.getElementById('center'),
    direction: 'vertical',
    children: ['#center-top', '#lower'],
    sizes:    [70, 30],
    minSizes: [200, 80],
    storageKey: 'flipsay.layout.center',
  });

  splits.lower = createSplit({
    container: document.getElementById('lower'),
    direction: 'horizontal',
    children: ['#demod', '#gain', '#mini-logs'],
    sizes:    [25, 45, 30],
    minSizes: [140, 160, 160],
    storageKey: 'flipsay.layout.lower',
  });
}

export function resetLayout() {
  ['flipsay.layout.body','flipsay.layout.center','flipsay.layout.lower'].forEach(k => {
    try { localStorage.removeItem(k); } catch(_) {}
  });

  location.reload();
}
