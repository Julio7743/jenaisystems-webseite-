#!/usr/bin/env node
// Bereitet site/ vor:
//  1. kopiert das Chat-Widget nach site/jenaisystems-chat.js (die Website lädt es von dort)
//  2. erzeugt die Telefon-Demo (Text-Simulation der Offline-Engine P0) und bettet sie in site/index.html ein
// Aufruf: node scripts/build-site.mjs          (schreibt)
//         node scripts/build-site.mjs --check  (prüft nur, ob site/ aktuell ist; Exit 1 wenn nicht)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const fehler = [];

const widget = readFileSync(join(root, 'assistant/widget/jenaisystems-chat.js'), 'utf8');
const ziel = join(root, 'site/jenaisystems-chat.js');
if (!existsSync(ziel) || readFileSync(ziel, 'utf8') !== widget) {
  if (check) fehler.push('site/jenaisystems-chat.js ist nicht aktuell'); else writeFileSync(ziel, widget);
}

const demo = execFileSync('python3', [join(root, 'scripts/telefon-demo.py')], { cwd: root, encoding: 'utf8' }).trim();
const json = JSON.stringify(JSON.parse(demo)).replace(/</g, '\\u003c');
const idxFile = join(root, 'site/index.html');
const html = readFileSync(idxFile, 'utf8');
const re = /(<script type="application\/json" id="telefon-demo-daten">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) fehler.push('Platzhalter <script id="telefon-demo-daten"> fehlt in site/index.html');
else {
  const neu = html.replace(re, (_, a, b) => a + json + b);
  if (neu !== html) { if (check) fehler.push('Telefon-Demo in site/index.html ist nicht aktuell'); else writeFileSync(idxFile, neu); }
}

if (fehler.length) { for (const f of fehler) console.error('Fehler:', f); console.error('Bitte ausführen: npm run build:site'); process.exit(1); }
console.log(check ? 'site/ ist aktuell.' : 'site/ aktualisiert (Widget + Telefon-Demo).');
