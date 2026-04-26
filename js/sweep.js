

import { state, isValidFlipperFreq, sleep } from './state.js';
import { send } from './serial.js';
import { log } from './logger.js';

const SWEEP_STEPS = 32;
const HOP_INTERVAL_MS = 170;

export async function startSweep() {
  if (!state.connected) { log('warn', 'Not connected'); return; }
  if (state.sweeping) return;

  state.sweeping = true;
  state.specReal.fill(null);
  state.activeRxFreq = null;

  const bwHz = state.curBW * 1000;
  const fMin = state.curFreq - bwHz / 2;
  const fMax = state.curFreq + bwHz / 2;
  const fStep = (fMax - fMin) / SWEEP_STEPS;
  state.sweepFreqs = [];
  for (let i = 0; i < SWEEP_STEPS; i++) {
    const f = Math.round(fMin + i * fStep);
    if (isValidFlipperFreq(f)) state.sweepFreqs.push(f);
  }
  if (!state.sweepFreqs.length) {
    log('warn', 'Sweep range has no valid Flipper frequencies');
    state.sweeping = false;
    return;
  }
  state.sweepIdx = 0;

  document.getElementById('scanbtn')?.classList.add('active');
  log('info', `Sweep started — ${state.sweepFreqs.length} steps`);

  hop();
}

async function hop() {
  if (!state.sweeping || !state.connected) { stopSweep(); return; }

  const f = state.sweepFreqs[state.sweepIdx % state.sweepFreqs.length];
  state.activeRxFreq = f;

  await send('\x03');
  if (!state.sweeping) { stopSweep(); return; }
  await sleep(30);
  if (!state.sweeping) { stopSweep(); return; }

  await send(`subghz rx ${f} 0\r\n`);

  state.sweepIdx++;

  state.sweepTimer = setTimeout(() => {
    state.sweepTimer = null;
    hop();
  }, HOP_INTERVAL_MS);
}

export function stopSweep() {

  const wasSweeping = state.sweeping;
  state.sweeping = false;

  if (state.sweepTimer) {
    clearTimeout(state.sweepTimer);
    state.sweepTimer = null;
  }
  state.activeRxFreq = null;
  document.getElementById('scanbtn')?.classList.remove('active');

  if (state.connected) send('\x03');
  if (wasSweeping) log('warn', 'Sweep stopped');
}
