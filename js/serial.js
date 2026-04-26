

import { state, sleep } from './state.js';
import { log } from './logger.js';
import { onLine } from './parser.js';
import { connectChime, disconnectChime, errorChime } from './audio.js';

const BAUD_RATE = 230_400;

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
  if (/Edg\
  if (/OPR\
  if (/Brave/.test(ua) || navigator.brave) return 'Brave';
  if (/Chrome/.test(ua))    return 'Chrome';
  if (/Firefox/.test(ua))   return 'Firefox';
  if (/Safari/.test(ua))    return 'Safari';
  return 'Unknown';
}

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

    try {
      const info = state.port.getInfo();
      if (info?.usbVendorId !== undefined) {
        log('info', `Port info: USB VID=0x${info.usbVendorId.toString(16).padStart(4,'0')} PID=0x${info.usbProductId.toString(16).padStart(4,'0')}`);
      }
    } catch (_) {}

    state.connected = true;
    log('ok', `Serial connected @ ${BAUD_RATE} baud`);
    log('info', 'DBG_TTY session started');

    connectChime();

    (async () => {
      await sleep(400);
      await send('\r\n');
      await sleep(200);
      await send('device_info\r\n');

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

  state.sweeping = false;
  state.continuousRx = false;
  state.connected = false;

  try { if (state.reader) await state.reader.cancel(); } catch (_) {}

  try { state.readerAbort?.abort(); } catch (_) {}
  try { state.writerAbort?.abort(); } catch (_) {}

  try { await state.readPromise; }  catch (_) {}
  try { await state.writePromise; } catch (_) {}

  try { if (state.writer) await state.writer.close(); } catch (_) {}
  try { if (state.port) await state.port.close(); } catch (_) {}

  state.reader = state.writer = state.port = null;
  state.readerAbort = state.writerAbort = null;
  state.readPromise = state.writePromise = null;
  state.rxBuffer = '';

  state.specReal.fill(null);

  disconnectChime();
  log('warn', 'Disconnected');
}

export async function send(cmd) {
  if (!state.writer) return;
  if (state.verbose) {

    const visible = cmd.replace(/\r/g, '␍').replace(/\n/g, '␊').replace(/\x03/g, '␃');
    console.debug('%c[FlipSay TX]%c ' + visible, 'color:#FFA030;font-weight:bold', 'color:#FFD700');
  }
  try {
    await state.writer.write(cmd);
  } catch (e) {
    log('warn', 'Send: ' + e.message);
  }
}

function setupWriter() {
  const enc = new TextEncoderStream();
  state.writerAbort = new AbortController();
  state.writePromise = enc.readable
    .pipeTo(state.port.writable, { signal: state.writerAbort.signal })
    .catch(() => {});
  state.writer = enc.writable.getWriter();
}

function setupReader() {
  const dec = new TextDecoderStream();
  state.readerAbort = new AbortController();
  state.readPromise = state.port.readable
    .pipeTo(dec.writable, { signal: state.readerAbort.signal })
    .catch(() => {});
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
      state.rxBuffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) onLine(trimmed);
      }
    }
  } catch (e) {
    if (state.connected) log('warn', 'Read: ' + e.message);
  }
}
