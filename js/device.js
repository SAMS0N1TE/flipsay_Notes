

import { state } from './state.js';
import { send } from './serial.js';
import { log, appendRX } from './logger.js';

function requireConnected() {
  if (!state.connected) { log('warn', 'Not connected'); return false; }
  return true;
}

export async function refreshDeviceInfo() {
  if (!requireConnected()) return;
  await send('info device\r\n');
}

export async function refreshPowerInfo() {
  if (!requireConnected()) return;
  await send('info power\r\n');
}

export async function neofetch() {
  if (!requireConnected()) return;
  await send('neofetch\r\n');
}

export async function listApps() {
  if (!requireConnected()) return;
  state.apps = [];
  state.expectingAppList = true;
  document.getElementById('app-list').innerHTML = '<div style="font-size:var(--small);color:var(--DIM);">Loading…</div>';
  await send('loader list\r\n');
}

export async function openApp(name) {
  if (!requireConnected()) return;

  await send(`loader open "${name}"\r\n`);
  log('ok', 'Opened app: ' + name);
}

export async function closeApp() {
  if (!requireConnected()) return;
  await send('loader close\r\n');
}

export async function setLED(r, g, b) {
  if (!requireConnected()) return;
  r = clamp255(r); g = clamp255(g); b = clamp255(b);
  await send(`led r ${r}\r\n`);
  await send(`led g ${g}\r\n`);
  await send(`led b ${b}\r\n`);
  log('ok', `LED set #${hex2(r)}${hex2(g)}${hex2(b)}`);
}

export async function setBacklight(v) {
  if (!requireConnected()) return;
  v = clamp255(v);
  await send(`led bl ${v}\r\n`);
}

export async function vibrate(ms = 200) {
  if (!requireConnected()) return;
  await send('vibro 1\r\n');
  setTimeout(() => send('vibro 0\r\n'), ms);
  log('ok', `Vibrate ${ms}ms`);
}

export async function powerOff() {
  if (!requireConnected()) return;
  if (!confirm('Power off the Flipper Zero?')) return;
  await send('power off\r\n');
  log('warn', 'Sent power off');
}

export async function powerReboot() {
  if (!requireConnected()) return;
  if (!confirm('Reboot the Flipper Zero?')) return;
  await send('power reboot\r\n');
  log('warn', 'Sent reboot');
}

export async function gpioMode(pin, output) {
  if (!requireConnected()) return;
  await send(`gpio mode ${pin} ${output ? 1 : 0}\r\n`);
}

export async function gpioSet(pin, value) {
  if (!requireConnected()) return;
  await send(`gpio set ${pin} ${value ? 1 : 0}\r\n`);
}

export async function gpioRead(pin) {
  if (!requireConnected()) return;
  state.expectingGpioRead = pin;
  await send(`gpio read ${pin}\r\n`);
}

export async function listSubFiles(dir = '/ext/subghz') {
  if (!requireConnected()) return;
  state.subFiles = [];
  state.subListingDir = dir;
  document.getElementById('sub-list').innerHTML = '<div style="font-size:var(--small);color:var(--DIM);">Loading…</div>';
  await send(`storage list ${dir}\r\n`);
}

export async function txFromFile(path) {
  if (!requireConnected()) return;
  if (!confirm(`Transmit signal from file ${path}?\n\nMake sure you are licensed for this frequency.`)) return;
  await send(`subghz tx_from_file ${path}\r\n`);
  appendRX(`[TX FROM FILE] ${path}`);
  log('ok', 'TX from file: ' + path);
}

function clamp255(v) { return Math.max(0, Math.min(255, Math.round(+v))); }
function hex2(v) { return v.toString(16).padStart(2, '0').toUpperCase(); }
