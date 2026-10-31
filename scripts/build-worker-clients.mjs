#!/usr/bin/env node
// Sammelt alle clients/*/client.json und schreibt assistant/worker/src/clients.generated.js
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'clients');
const clients = {};
for (const name of readdirSync(dir)) {
  const f = join(dir, name, 'client.json');
  if (!existsSync(f)) continue;
  const c = JSON.parse(readFileSync(f, 'utf8'));
  // Optionale Schnellantworten (feste Texte ohne KI), siehe clients/<id>/schnellantworten.json
  const fast = join(dir, name, 'schnellantworten.json');
  if (existsSync(fast)) {
    const list = JSON.parse(readFileSync(fast, 'utf8')).antworten || [];
    for (const a of list) {
      if (!a.id || !Array.isArray(a.keys) || !a.keys.length || typeof a.answer !== 'string' || !a.answer.trim()) {
        throw new Error(`${fast}: Eintrag ${a.id || '?'} braucht id, keys und answer`);
      }
    }
    c.fastAnswers = list.map(({ id, keys, fill = [], block = [], answer }) => ({ id, keys, fill, block, answer }));
  }
  clients[c.id] = c;
}
const out = `// AUTOMATISCH ERZEUGT von scripts/build-worker-clients.mjs – nicht von Hand ändern.\nexport const CLIENTS = ${JSON.stringify(clients, null, 2)};\n`;
writeFileSync(join(root, 'assistant/worker/src/clients.generated.js'), out);
console.log(`Worker-Kunden aktualisiert: ${Object.keys(clients).join(', ') || '(keine)'}`);
