

import { state, sleep, isValidFlipperFreq } from './state.js';
import { send } from './serial.js';
import { log, appendRX } from './logger.js';

async function interrupt() {
  await send('\x03');
  await sleep(40);
}

function requireConnected() {
  if (!state.connected) { log('warn', 'Not connected'); return false; }
  return true;
}

export async function rx(freq, device = 0) {
  if (!requireConnected()) return;
  if (!isValidFlipperFreq(freq)) { log('warn', 'Freq out of CC1101 range'); return; }
  await interrupt();
  await send(`subghz rx ${freq} ${device}\r\n`);
  appendRX(`[RX] @ ${(freq / 1e6).toFixed(6)} MHz`);
  log('ok', `RX @ ${(freq / 1e6).toFixed(3)} MHz`);
}

export async function rxRaw(freq) {
  if (!requireConnected()) return;
  if (!isValidFlipperFreq(freq)) { log('warn', 'Freq out of CC1101 range'); return; }
  await interrupt();
  await send(`subghz rx_raw ${freq}\r\n`);
  appendRX(`[RX RAW] @ ${(freq / 1e6).toFixed(6)} MHz`);
}

export async function tx({ key, freq, te = 300, repeat = 3, device = 0 }) {
  if (!requireConnected()) return;
  if (!isValidFlipperFreq(freq)) { log('warn', 'Freq out of CC1101 range'); return; }
  if (!/^[0-9A-Fa-f]{1,6}$/.test(key)) {
    log('warn', 'TX key must be 1–6 hex characters');
    return;
  }
  const padded = key.toUpperCase().padStart(6, '0');
  await send(`subghz tx ${padded} ${freq} ${te} ${repeat} ${device}\r\n`);
  appendRX(`[TX] Key:${padded} @ ${(freq / 1e6).toFixed(3)} MHz TE:${te}µs ×${repeat} Mod:${state.modulation}`);
  log('ok', `TX ${padded}`);
}

export async function chat(freq, device = 0) {
  if (!requireConnected()) return;
  await send(`subghz chat ${freq} ${device}\r\n`);
}

export async function openFreqAnalyzer() {
  if (!requireConnected()) return;
  await send('loader open "Sub-GHz"\r\n');
}

export async function stop() {
  if (!state.connected) return;
  await interrupt();
  appendRX('[STOPPED]');
  log('warn', 'Stopped');
}
