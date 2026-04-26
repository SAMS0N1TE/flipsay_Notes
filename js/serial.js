// ════════════════════════════════════════════════════════════════
// FlipSay — WebSerial transport
// ────────────────────────────────────────────────────────────────
// Connect/disconnect with proper stream teardown. The original code
// fired `pipeTo()` and never awaited it, which leaked streams on
// reconnect. Here we hold AbortControllers and the pipe promises so
// disconnect can actually wait for the streams to drain before
// closing the port.
// ════════════════════════════════════════════════════════════════

import { state, sleep } from './state.js';
import { log } from './logger.js';
import { onLine } from './parser.js';
import { connectChime, disconnectChime, errorChime } from './audio.js';

const BAUD_RATE = 230_400;

// ── Environment detection ──────────────────────────────────────
// Returns { ok, reason } so the UI can explain WHY WebSerial
// isn't available instead of always blaming the browser.

export function checkEnvironment() {
  const ua = navigator.userAgent;
  const isChromium = /Chrome|Chromium|Edg|Brave|Opera/i.test(ua) && !/Mobile/i.test(ua);
  const isFirefox  = /Firefox/i.test(ua);
  const isSafari   = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
  const isFile     = location.protocol === 'file:';
  const isSecure   = window.isSecureContext;
  const hasSerial  = 'serial' in navigator;

  if (hasSerial) {
    return { ok: true, browser: detectBrowser(), reason: '' };
  }

  if (isFile) {
    return {
      ok: false,
      browser: detectBrowser(),
      reason: 'Opened as file:// — browsers block WebSerial on local files. Serve the folder with a local web server (e.g. `python -m http.server`) and open http://localhost:8000 instead.',
    };
  }

  if (!isSecure) {
    return {
      ok: false,
      browser: detectBrowser(),
      reason: 'Page is not in a secure context. WebSerial requires HTTPS or localhost.',
    };
  }

  if (isFirefox) {
    return {
      ok: false,
      browser: 'Firefox',
      reason: 'Firefox does not support WebSerial. Use Chrome, Edge, Brave, or Opera.',
    };
  }

  if (isSafari) {
    return {
      ok: false,
      browser: 'Safari',
      reason: 'Safari does not support WebSerial. Use Chrome, Edge, Brave, or Opera.',
    };
  }

  if (isChromium) {
    return {
      ok: false,
      browser: detectBrowser(),
      reason: 'Your Chromium-based browser has WebSerial disabled. Check chrome://flags/#enable-experimental-web-platform-features',
    };
  }

  return {
    ok: false,
    browser: 'Unknown',
    reason: 'WebSerial not supported in this browser. Use Chrome or Edge.',
  };
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua))     return 'Edge';
  if (/OPR\//.test(ua))     return 'Opera';
  if (/Brave/.test(ua) || navigator.brave) return 'Brave';
  if (/Chrome/.test(ua))    return 'Chrome';
  if (/Firefox/.test(ua))   return 'Firefox';
  if (/Safari/.test(ua))    return 'Safari';
  return 'Unknown';
}

// ── Public API ─────────────────────────────────────────────────

export async function toggleConnect() {
  return state.connected ? disconnect() : connect();
}

export async function connect() {
  const env = checkEnvironment();
  if (!env.ok) {
    log('warn', 'Cannot connect: ' + env.reason);
    alert(env.reason);
    return false;
  }
  try {
    log('info', 'Requesting serial port…');
    state.port = await navigator.serial.requestPort({ filters: [] });
    log('info', `Opening port @ ${BAUD_RATE} baud`);
    await state.port.open({ baudRate: BAUD_RATE });

    setupWriter();
    setupReader();

    // Log port details if the browser exposes them.
    try {
      const info = state.port.getInfo();
      if (info?.usbVendorId !== undefined) {
        log('info', `Port info: USB VID=0x${info.usbVendorId.toString(16).padStart(4,'0')} PID=0x${info.usbProductId.toString(16).padStart(4,'0')}`);
      }
    } catch (_) {}

    state.connected = true;
    log('ok', `Serial connected @ ${BAUD_RATE} baud`);
    log('info', 'DBG_TTY session started');

    // Connect feedback: ascending chime in the browser, short
    // vibration burst on the Flipper itself.
    connectChime();

    // Wake the CLI and ask the Flipper to identify itself.
    // Don't await this inside the click handler — let it run in the
    // background so the button returns immediately. The 855ms
    // violation goes away.
    (async () => {
      await sleep(400);
      await send('\r\n');
      await sleep(200);
      await send('device_info\r\n');
      // Vibrate the Flipper to confirm — 120ms is short and friendly.
      await sleep(100);
      await send('vibro 1\r\n');
      await sleep(120);
      await send('vibro 0\r\n');
    })();

    return true;
  } catch (e) {
    if (e.name !== 'NotFoundError') {
      log('warn', 'Connect: ' + e.message);
      errorChime();
    }
    return false;
  }
}

export async function disconnect() {
  // 1. Stop the sweep / any active loops via flag.
  state.sweeping = false;
  state.continuousRx = false;
  state.connected = false;

  // 2. Cancel the reader so the read loop exits cleanly.
  try { if (state.reader) await state.reader.cancel(); } catch (_) {}

  // 3. Abort the pipes — pipeTo() returns a promise we awaited on,
  //    these signals tell those pipes to stop.
  try { state.readerAbort?.abort(); } catch (_) {}
  try { state.writerAbort?.abort(); } catch (_) {}

  // 4. Wait for the pipes to actually finish before closing the port.
  //    Without this the port.close() race-conditions with in-flight bytes.
  try { await state.readPromise; }  catch (_) {}
  try { await state.writePromise; } catch (_) {}

  // 5. Close writer + port.
  try { if (state.writer) await state.writer.close(); } catch (_) {}
  try { if (state.port) await state.port.close(); } catch (_) {}

  // 6. Clear everything.
  state.reader = state.writer = state.port = null;
  state.readerAbort = state.writerAbort = null;
  state.readPromise = state.writePromise = null;
  state.rxBuffer = '';

  // Reset spectrum so stale RSSI doesn't linger after reconnect.
  state.specReal.fill(null);

  disconnectChime();
  log('warn', 'Disconnected');
}

// Send raw text down the wire. Most callers should use cli.js
// helpers instead of calling send() directly.
export async function send(cmd) {
  if (!state.writer) return;
  if (state.verbose) {
    // Visualise control chars so \x03 doesn't disappear in the console.
    const visible = cmd.replace(/\r/g, '␍').replace(/\n/g, '␊').replace(/\x03/g, '␃');
    console.debug('%c[FlipSay TX]%c ' + visible, 'color:#FFA030;font-weight:bold', 'color:#FFD700');
  }
  try {
    await state.writer.write(cmd);
  } catch (e) {
    log('warn', 'Send: ' + e.message);
  }
}

// ── Internals ──────────────────────────────────────────────────

function setupWriter() {
  const enc = new TextEncoderStream();
  state.writerAbort = new AbortController();
  state.writePromise = enc.readable
    .pipeTo(state.port.writable, { signal: state.writerAbort.signal })
    .catch(() => {}); // expected on abort
  state.writer = enc.writable.getWriter();
}

function setupReader() {
  const dec = new TextDecoderStream();
  state.readerAbort = new AbortController();
  state.readPromise = state.port.readable
    .pipeTo(dec.writable, { signal: state.readerAbort.signal })
    .catch(() => {}); // expected on abort
  state.reader = dec.readable.getReader();
  state.rxBuffer = '';
  readLoop();
}

async function readLoop() {
  try {
    for (;;) {
      const { value, done } = await state.reader.read();
      if (done) break;
      if (state.verbose) {
        console.debug('%c[FlipSay RX]%c ' + JSON.stringify(value), 'color:#00FF80;font-weight:bold', 'color:#7A4500');
      }
      state.rxBuffer += value;
      const lines = state.rxBuffer.split('\n');
      state.rxBuffer = lines.pop(); // last element is partial
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) onLine(trimmed);
      }
    }
  } catch (e) {
    if (state.connected) log('warn', 'Read: ' + e.message);
  }
}
