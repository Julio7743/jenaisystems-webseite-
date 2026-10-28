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
  clients[c.id] = c;
}
const out = `// AUTOMATISCH ERZEUGT von scripts/build-worker-clients.mjs – nicht von Hand ändern.\nexport const CLIENTS = ${JSON.stringify(clients, null, 2)};\n`;
writeFileSync(join(root, 'assistant/worker/src/clients.generated.js'), out);
console.log(`Worker-Kunden aktualisiert: ${Object.keys(clients).join(', ') || '(keine)'}`);
