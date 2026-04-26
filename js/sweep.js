// ════════════════════════════════════════════════════════════════
// FlipSay — frequency sweep
// ────────────────────────────────────────────────────────────────
// The sweep walks across the band by issuing `subghz rx <f> 0`
// commands and lets parser.js attribute the resulting RSSI to the
// right bin via the `Listening at frequency: N` reply.
//
// Stop responsiveness: the original setInterval-based driver had
// queued awaits in flight when stop fired, so a stop click had to
// race with the next iteration. Now we use a self-rescheduling
// setTimeout chain and check `state.sweeping` between every await.
// Stop is immediate.
// ════════════════════════════════════════════════════════════════

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

// Single sweep hop — issues one retune, then schedules the next
// hop after HOP_INTERVAL_MS. Checks `state.sweeping` between every
// await so a stop click takes effect immediately.
async function hop() {
  if (!state.sweeping || !state.connected) { stopSweep(); return; }

  const f = state.sweepFreqs[state.sweepIdx % state.sweepFreqs.length];
  state.activeRxFreq = f;

  await send('\x03');
  if (!state.sweeping) { stopSweep(); return; }
  await sleep(30);
  if (!state.sweeping) { stopSweep(); return; }
  // `subghz rx` listens for known protocols and reports RSSI on
  // any received packet. The Flipper CLI does not stream raw
  // continuous RSSI samples — that data only lives on-device in
  // the Frequency Analyzer app. Unknown signals (e.g. raw OOK
  // from an HRF) won't show up unless they happen to match a
  // known protocol decoder. This is a firmware limitation.
  await send(`subghz rx ${f} 0\r\n`);

  state.sweepIdx++;

  // Schedule next hop. Track the timer so stopSweep() can cancel
  // a pending iteration before it fires.
  state.sweepTimer = setTimeout(() => {
    state.sweepTimer = null;
    hop();
  }, HOP_INTERVAL_MS);
}

export function stopSweep() {
  // Setting the flag false cuts off any in-flight hop() awaits.
  const wasSweeping = state.sweeping;
  state.sweeping = false;

  // Cancel pending next-hop schedule.
  if (state.sweepTimer) {
    clearTimeout(state.sweepTimer);
    state.sweepTimer = null;
  }
  state.activeRxFreq = null;
  document.getElementById('scanbtn')?.classList.remove('active');

  // Send Ctrl+C once to interrupt whatever the Flipper is currently
  // doing. Don't await it — fire and forget.
  if (state.connected) send('\x03');
  if (wasSweeping) log('warn', 'Sweep stopped');
}
