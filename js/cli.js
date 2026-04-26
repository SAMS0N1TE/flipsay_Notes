// ════════════════════════════════════════════════════════════════
// FlipSay — Flipper CLI command builders
// ────────────────────────────────────────────────────────────────
// Every Flipper command goes through here. Centralising them means
// command shapes are documented in one file and we can reason about
// what we send vs what the original code claimed it sent.
//
// Reference: Flipper CLI commands are defined in
//   applications/main/subghz/subghz_cli.c in the firmware repo.
// Momentum keeps the same surface plus a few extras.
// ════════════════════════════════════════════════════════════════

import { state, sleep, isValidFlipperFreq } from './state.js';
import { send } from './serial.js';
import { log, appendRX } from './logger.js';

// Send Ctrl+C to interrupt whatever the CLI is currently doing,
// then wait briefly so the firmware actually processes it before
// the next command lands.
async function interrupt() {
  await send('\x03');
  await sleep(40);
}

function requireConnected() {
  if (!state.connected) { log('warn', 'Not connected'); return false; }
  return true;
}

// ── subghz rx — listen on a frequency ──────────────────────────
// Args: <freq_hz> <device 0|1>
//   device 0 = internal CC1101, 1 = external
export async function rx(freq, device = 0) {
  if (!requireConnected()) return;
  if (!isValidFlipperFreq(freq)) { log('warn', 'Freq out of CC1101 range'); return; }
  await interrupt();
  await send(`subghz rx ${freq} ${device}\r\n`);
  appendRX(`[RX] @ ${(freq / 1e6).toFixed(6)} MHz`);
  log('ok', `RX @ ${(freq / 1e6).toFixed(3)} MHz`);
}

// ── subghz rx_raw — raw RSSI stream, no decoder ────────────────
export async function rxRaw(freq) {
  if (!requireConnected()) return;
  if (!isValidFlipperFreq(freq)) { log('warn', 'Freq out of CC1101 range'); return; }
  await interrupt();
  await send(`subghz rx_raw ${freq}\r\n`);
  appendRX(`[RX RAW] @ ${(freq / 1e6).toFixed(6)} MHz`);
}

// ── subghz tx — transmit a key ─────────────────────────────────
// Args: <hex_key> <freq_hz> <te_us> <repeat> <device>
// Note: modulation is stored in state.modulation but the stock
// `subghz tx` CLI verb doesn't take a preset arg — the firmware
// uses whatever preset is loaded internally. The dropdown setting
// affects future tx_from_file behaviour and is logged for clarity.
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

// ── subghz chat — open the chat protocol on a freq ─────────────
export async function chat(freq, device = 0) {
  if (!requireConnected()) return;
  await send(`subghz chat ${freq} ${device}\r\n`);
}

// ── Open the on-Flipper Frequency Analyzer app ─────────────────
// This is a `loader` command, not subghz — it launches the GUI app.
export async function openFreqAnalyzer() {
  if (!requireConnected()) return;
  await send('loader open "Sub-GHz"\r\n');
}

// ── Stop whatever the CLI is currently doing ───────────────────
export async function stop() {
  if (!state.connected) return;
  await interrupt();
  appendRX('[STOPPED]');
  log('warn', 'Stopped');
}
