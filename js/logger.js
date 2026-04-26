// ════════════════════════════════════════════════════════════════
// FlipSay — logger
// ────────────────────────────────────────────────────────────────
// Central log dispatch. The original textContent += pattern grew
// unbounded — long sessions slowed the page to a crawl. Here we
// cap at MAX_LOG_LINES and trim oldest when we hit the limit.
// ════════════════════════════════════════════════════════════════

const MAX_MINI_LINES = 12;     // sidebar log
const MAX_FULL_LINES = 5000;   // full log tab
const MAX_RX_LINES   = 2000;   // sub-ghz serial output

const fullLogLines = [];
const rxLines = [];

// type: 'ok' | 'warn' | 'signal' | 'info'
export function log(type, msg) {
  const ts = time();
  const formatted = `[${ts}][${type.toUpperCase()}] ${msg}`;

  // Mirror to the browser console so devs can see everything in
  // DevTools — much easier to debug serial parsing issues with
  // console-side filtering than scrolling the in-page log.
  const consoleStyle = {
    ok:     'color:#00FF80;font-weight:bold',
    warn:   'color:#FF2200;font-weight:bold',
    signal: 'color:#FFA030;font-weight:bold',
    info:   'color:#7A4500',
  }[type] || '';
  const consoleFn = type === 'warn' ? console.warn
                  : type === 'ok'   ? console.log
                  : type === 'signal' ? console.info
                  : console.debug;
  consoleFn(`%c[FlipSay ${ts}] [${type.toUpperCase()}]%c ${msg}`, consoleStyle, '');

  const ll = document.getElementById('loglist');
  if (ll) {
    const d = document.createElement('div');
    d.className = { ok: 'lo', warn: 'lw', signal: 'ls', info: 'li' }[type] || 'li';
    d.textContent = `[${type.toUpperCase()}] ${msg}`;
    ll.appendChild(d);
    while (ll.children.length > MAX_MINI_LINES) ll.removeChild(ll.firstChild);
    ll.scrollTop = ll.scrollHeight;
  }
  appendFullLog(formatted);
}

export function appendRX(line) {
  rxLines.push(line);
  if (rxLines.length > MAX_RX_LINES) rxLines.splice(0, rxLines.length - MAX_RX_LINES);
  const e = document.getElementById('rxout');
  if (e) {
    e.textContent = rxLines.join('\n');
    e.scrollTop = e.scrollHeight;
  }
}

export function appendFullLog(line) {
  fullLogLines.push(line);
  if (fullLogLines.length > MAX_FULL_LINES) {
    fullLogLines.splice(0, fullLogLines.length - MAX_FULL_LINES);
  }
  const e = document.getElementById('fulllog');
  if (e) {
    e.textContent = fullLogLines.join('\n');
    e.scrollTop = e.scrollHeight;
  }
}

export function clearRX() {
  rxLines.length = 0;
  const e = document.getElementById('rxout');
  if (e) e.textContent = '';
}

export function clearFullLog() {
  fullLogLines.length = 0;
  const e = document.getElementById('fulllog');
  if (e) e.textContent = '';
}

export function getFullLogText() { return fullLogLines.join('\n'); }
export function getRxText()      { return rxLines.join('\n'); }

function time() { return new Date().toTimeString().slice(0, 8); }

// Trigger a browser download for arbitrary text.
export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  // Free the object URL after the click handler runs.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
