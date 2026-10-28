#!/usr/bin/env node
// Bettet onboarding/fragenkatalog.json in onboarding/fragebogen.html ein, damit der Fragebogen auch ohne Server
// (Doppelklick auf die Datei) funktioniert.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'onboarding');
const katalog = JSON.stringify(JSON.parse(readFileSync(join(dir, 'fragenkatalog.json'), 'utf8'))).replace(/</g, '\\u003c');
const html = readFileSync(join(dir, 'fragebogen.html'), 'utf8');
const neu = html.replace(/(<script type="application\/json" id="katalog">)[\s\S]*?(<\/script>)/, `$1${katalog}$2`);
writeFileSync(join(dir, 'fragebogen.html'), neu);
console.log('Fragebogen aktualisiert.');
