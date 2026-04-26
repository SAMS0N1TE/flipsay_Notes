

import { state, sleep, isValidFlipperFreq } from './state.js';
import { send } from './serial.js';
import { log } from './logger.js';
import { stopSweep } from './sweep.js';

export async function stopAll() {

  state.sweeping = false;
  if (state.sweepTimer) {
    clearTimeout(state.sweepTimer);
    state.sweepTimer = null;
  }

  state.continuousRx = false;
  state.continuousFreq = null;
  syncContinuousUI();

  if (state.connected) {
    await send('\x03');
    await sleep(20);
    await send('\x03');
    await sleep(20);
    await send('\x03');
  }

  document.getElementById('scanbtn')?.classList.remove('active');
  document.getElementById('rxhere-btn')?.classList.remove('active');
  state.activeRxFreq = null;
  log('warn', 'Stopped everything');
}

export async function toggleContinuous() {
  if (!state.connected) { log('warn', 'Not connected'); return; }
  if (state.continuousRx) {
    state.continuousRx = false;
    state.continuousFreq = null;
    syncContinuousUI();
    await send('\x03');
    log('info', 'Continuous RX stopped');
    return;
  }

  if (state.sweeping) stopSweep();

  if (!isValidFlipperFreq(state.curFreq)) {
    log('warn', 'Frequency out of CC1101 range');
    return;
  }
  state.continuousRx = true;
  state.continuousFreq = state.curFreq;
  syncContinuousUI();
  await send('\x03');
  await sleep(40);

  await send(`subghz rx ${state.continuousFreq} 0\r\n`);
  log('ok', `Continuous RX @ ${(state.curFreq/1e6).toFixed(3)} MHz`);
}

export async function continuousReissue() {
  if (!state.continuousRx || !state.connected) return;
  if (!state.continuousFreq) return;
  await sleep(60);
  if (!state.continuousRx) return;
  await send(`subghz rx ${state.continuousFreq} 0\r\n`);
}

function syncContinuousUI() {
  const btn = document.getElementById('continuous-btn');
  if (btn) {
    btn.textContent = state.continuousRx ? 'STOP ◼' : 'START';
    btn.classList.toggle('active', state.continuousRx);
  }
  const rx = document.getElementById('rxhere-btn');
  if (rx) rx.classList.toggle('active', state.continuousRx);
}

export function setModulation(m) {
  state.modulation = m;
  log('info', `Modulation: ${m}`);
}