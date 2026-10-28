#!/usr/bin/env node
// Headless-Screenshot mit Chrome (für Doku). Aufruf:
//   node scripts/screenshot.mjs <url> <out.png> [breite] [mobil 0/1] [hoehe 0=ganze Seite] [js-datei mit Aktionen]
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
const [url, out, w = '1280', mob = '0', fixedH = '0', actions] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--user-data-dir=/tmp/chr-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) { try { const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); if (t) ws = t.webSocketDebuggerUrl; } catch {} await sleep(200); }
const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r));
let id = 0; const pend = {};
sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } else if (m.method === 'Runtime.consoleAPICalled') console.log('console:', m.params.args.map((a) => a.value).join(' ')); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
const W = +w, M = mob === '1', H0 = M ? 844 : 800;
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H0, deviceScaleFactor: M ? 2 : 1, mobile: M });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1500);
await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
if (actions) {
  const r = await send('Runtime.evaluate', { expression: readFileSync(actions, 'utf8'), awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) console.log('Aktion fehlgeschlagen:', JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  else console.log('Aktion:', r.result.result.value);
}
const info = JSON.parse((await send('Runtime.evaluate', { expression: 'JSON.stringify({sw:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,y:Math.round(scrollY)})', returnByValue: true })).result.result.value);
console.log(out, info);
const H = +fixedH || info.h;
// Feste Höhe: aktuellen Bildausschnitt (inkl. Scroll-Position) aufnehmen, sonst die ganze Seite
if (!+fixedH) await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: M ? 2 : 1, mobile: M });
await sleep(400);
const shot = await send('Page.captureScreenshot', +fixedH
  ? { format: 'png' }
  : { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, captureBeyondViewport: true });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
sock.close(); chrome.kill(); process.exit(0);
