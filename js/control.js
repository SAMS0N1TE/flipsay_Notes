import { state, sleep, isValidFlipperFreq } from './state.js';
import { send } from './serial.js';
import { log } from './logger.js';
import { stopSweep } from './sweep.js';

// Single-button kill switch — call this whenever the user wants
// the Flipper to stop doing whatever it's doing.
export async function stopAll() {
  // 1. Mark sweep stopped — its hop loop checks the flag at every
  //    await and exits cleanly.
  state.sweeping = false;
  if (state.sweepTimer) {
    clearTimeout(state.sweepTimer);
    state.sweepTimer = null;
  }
  // 2. Disable continuous RX so the parser doesn't auto-restart it.
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
  // 4. Reset visual state.
  document.getElementById('scanbtn')?.classList.remove('active');
  document.getElementById('rxhere-btn')?.classList.remove('active');
  state.activeRxFreq = null;
  log('warn', 'Stopped everything');
}

// Toggle continuous mode on/off. When ON, every time the Flipper
// returns to the `>:` prompt while `state.continuousRx` is true,
// the parser re-issues `subghz rx`.
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
  // Stop sweep if running — they're mutually exclusive.
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
  // `subghz rx` listens with the Flipper's protocol decoders.
  // Decoded packets populate the signal list; raw RSSI streaming
  // is not available via the CLI on stock firmware.
  await send(`subghz rx ${state.continuousFreq} 0\r\n`);
  log('ok', `Continuous RX @ ${(state.curFreq/1e6).toFixed(3)} MHz`);
}

// Called by parser when it sees `>:` prompt during continuous mode.
// Re-issues the rx command.
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

// Set the modulation for future TX commands. Not sent to the
// Flipper for `subghz rx` (that command doesn't take modulation),
// but used as the preset name when transmitting from a captured
// hex key. Persisted in state.modulation.
export function setModulation(m) {
  state.modulation = m;
  log('info', `Modulation: ${m}`);
}
