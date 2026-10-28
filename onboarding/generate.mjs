#!/usr/bin/env node
// Aufruf: node onboarding/generate.mjs clients/<kunde>/antworten.json
// Schreibt in denselben Ordner: wissen.md, chat-prompt.md, client.json und (falls Telefon gewünscht) telefon.json + telefon-prompt.md
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruefeAntworten, baueWissen, baueChatPrompt, baueTelefonPrompt, baueTelefonConfig, baueKundenConfig } from './lib.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const datei = process.argv[2];
if (!datei) { console.error('Bitte Antwortdatei angeben, z. B.: node onboarding/generate.mjs clients/beispiel/antworten.json'); process.exit(1); }

const katalog = JSON.parse(readFileSync(join(hier, 'fragenkatalog.json'), 'utf8'));
const antworten = JSON.parse(readFileSync(datei, 'utf8'));
const { fehler, warnungen } = pruefeAntworten(katalog, antworten);
for (const w of warnungen) console.warn('Hinweis:', w);
if (fehler.length) { for (const f of fehler) console.error('Fehler:', f); process.exit(1); }

const ziel = dirname(resolve(datei));
const wissen = baueWissen(antworten);
const chat = baueChatPrompt(antworten, wissen);
const tel = baueTelefonPrompt(antworten, wissen);
const config = baueKundenConfig(antworten, chat, tel);
writeFileSync(join(ziel, 'wissen.md'), wissen);
writeFileSync(join(ziel, 'chat-prompt.md'), chat);
if (config.phone) {
  writeFileSync(join(ziel, 'telefon-prompt.md'), tel);
  writeFileSync(join(ziel, 'telefon.json'), JSON.stringify(baueTelefonConfig(antworten), null, 2) + '\n');
}
writeFileSync(join(ziel, 'client.json'), JSON.stringify(config, null, 2) + '\n');
console.log(`Fertig: ${config.name} (${config.id}) -> ${ziel}`);
console.log('Nächster Schritt: npm run build:worker  (übernimmt alle Kunden in den Worker)');
