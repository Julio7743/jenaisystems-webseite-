import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mockAnswer } from '../scripts/dev-server-mock.mjs';
import { CLIENTS } from '../assistant/worker/src/clients.generated.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('site/index.html');

test('Website bindet den Chat ein: JenAiSystems + Demo (Bäckerei)', () => {
  const tag = html.match(/<script src="jenaisystems-chat\.js" data-[^>]*>/);
  assert.ok(tag, 'Widget-Script fehlt');
  assert.match(tag[0], /data-client="jenaisystems"/);
  assert.match(tag[0], /data-demo="beispiel"/);
  assert.match(tag[0], /data-privacy="datenschutz\.html#chat"/);
  assert.match(html, /data-jenaisystems-open="demo"/);
  assert.match(html, /id="demo"/);
  assert.match(html, /erfunden/);
});

test('site/ ist aktuell (Widget-Kopie + Telefon-Demo aus P0)', () => {
  execFileSync(process.execPath, [new URL('../scripts/build-site.mjs', import.meta.url).pathname, '--check'], { stdio: 'pipe' });
});

test('Telefon-Demo: Text-Simulation mit KI-Hinweis, 112 und ohne Aufnahme', () => {
  const m = html.match(/<script type="application\/json" id="telefon-demo-daten">([\s\S]*?)<\/script>/);
  const d = JSON.parse(m[1]);
  assert.ok(d.szenarien.length >= 2);
  const start = d.szenarien[0].verlauf[0].text;
  assert.match(start, /künstliche Intelligenz/);
  assert.match(start, /nicht aufgenommen/);
  assert.match(start, /112/);
  assert.ok(d.szenarien.some((s) => s.verlauf.some((v) => /wählen Sie die 112/.test(v.text))));
  assert.match(html, /Text-Simulation/);
});

test('Impressum und Datenschutz sind verlinkt und vorhanden, Datenschutz hat Chat-Abschnitt', () => {
  for (const f of ['impressum.html', 'datenschutz.html']) {
    assert.ok(existsSync(new URL(`../site/${f}`, import.meta.url)), f);
    assert.match(html, new RegExp(`href="${f}"`));
  }
  const ds = read('site/datenschutz.html');
  assert.match(ds, /id="chat"/);
  assert.match(ds, /Mistral/);
  assert.match(ds, /Cloudflare/);
  assert.match(ds, /KI, kein Mensch/);
});

test('Übungs-Modell: Preisfrage an JenAiSystems, Demo-Frage an die Bäckerei', () => {
  const ask = (id, q) => mockAnswer([{ role: 'system', content: CLIENTS[id].chat.systemPrompt }, { role: 'user', content: q }]);
  assert.match(ask('jenaisystems', 'Was kostet eine Website?'), /490 €/);
  assert.match(ask('beispiel', 'Habt ihr glutenfreies Brot?'), /glutenfrei/);
  assert.match(ask('jenaisystems', 'Bist du ein Mensch?'), /KI-Assistent, kein Mensch/);
});
