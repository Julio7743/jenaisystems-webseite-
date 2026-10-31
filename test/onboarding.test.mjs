import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pruefeAntworten, baueWissen, baueChatPrompt, baueTelefonPrompt, baueTelefonConfig, baueKundenConfig } from '../onboarding/lib.mjs';

const katalog = JSON.parse(readFileSync(new URL('../onboarding/fragenkatalog.json', import.meta.url)));
const beispiel = JSON.parse(readFileSync(new URL('../clients/beispiel/antworten.json', import.meta.url)));
const jenaisystems = JSON.parse(readFileSync(new URL('../clients/jenaisystems/antworten.json', import.meta.url)));

test('Katalog: eindeutige IDs, alle Themen vorhanden', () => {
  const ids = katalog.abschnitte.flatMap((a) => a.fragen.map((f) => f.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const a of ['betrieb', 'leistungen', 'zeiten', 'kontakt', 'faq', 'grenzen', 'weiterleitung', 'tonfall', 'telefon', 'recht']) {
    assert.ok(katalog.abschnitte.some((x) => x.id === a), a);
  }
});

test('Beispiel ist gültig', () => assert.deepEqual(pruefeAntworten(katalog, beispiel).fehler, []));

test('Pflichtfelder werden erkannt', () => {
  const { fehler } = pruefeAntworten(katalog, { kunden_id: 'X Y' });
  assert.ok(fehler.some((f) => f.includes('betrieb_name')));
  assert.ok(fehler.some((f) => f.includes('kunden_id')));
});

test('Wissen enthält nur Angaben aus den Antworten; Preise nur wenn erlaubt', () => {
  const w = baueWissen(beispiel);
  assert.match(w, /Roggenmischbrot 1 kg.*4,80 €/);
  assert.match(w, /Sonntag: geschlossen/);
  const ohne = baueWissen({ ...beispiel, preise_nennen: false });
  assert.doesNotMatch(ohne, /4,80/);
  assert.match(ohne, /KEINE Preise/);
});

test('Chat-Prompt-Regeln', () => {
  const p = baueChatPrompt(beispiel, baueWissen(beispiel));
  for (const re of [/KI, kein Mensch/, /AUSSCHLIESSLICH/, /nicht sicher weißt/, /Erfinde keine Rabatte/, /Heil- oder Gesundheitsversprechen/, /<wissen>/]) assert.match(p, re);
});

test('Gesundheitsbezug: nur geprüfte Aussagen wörtlich', () => {
  const a = { ...beispiel, gesundheitsbezug: true, erlaubte_aussagen: ['Vitamin C trägt zu einer normalen Funktion des Immunsystems bei.'] };
  const p = baueChatPrompt(a, baueWissen(a));
  assert.match(p, /geprüften Aussagen/);
  assert.match(p, /Immunsystems/);
});

test('Telefon: Konfiguration und P1-Prompt ohne Preise/Anrufe', () => {
  const t = baueTelefonConfig(beispiel);
  assert.equal(t.firma, 'Beispiel-Bäckerei Sonnenkorn');
  assert.ok(t.notfall.extern_112.includes('feuer'));
  assert.ok(t.leistungen.includes('geburtstagstorte'));
  const p = baueTelefonPrompt(beispiel, baueWissen(beispiel));
  assert.match(p, /KEINE Preise/);
  assert.match(p, /rufst NIE an/);
  assert.match(p, /112/);
  assert.equal(baueTelefonConfig({ ...beispiel, telefon_aktiv: false }), null);
});

test('Kunden-Config: Domains, Limits, Log standardmäßig aus', () => {
  const c = baueKundenConfig(beispiel, 'p', 't');
  assert.ok(c.allowedOrigins.includes('https://beispiel-baeckerei.example'));
  assert.equal(c.limits.monthlyRequests, 300, 'Demo-Kunde hat ein engeres Monatslimit');
  assert.equal(c.limits.perMinutePerIp, 5);
  assert.equal(c.logQuestions, false);
  assert.equal(c.beispiel, true);
  const std = baueKundenConfig({ ...beispiel, limit_monat: '', limit_minute: '' }, 'p', 't');
  assert.deepEqual(std.limits, { monthlyRequests: 1000, perMinutePerIp: 8, dailyRequests: 40 });
  const ohneTag = baueKundenConfig({ ...beispiel, limit_tag: '' }, 'p', 't');
  assert.equal(ohneTag.limits.dailyRequests, 0, 'ohne Angabe keine Tagesgrenze pro Kunde');
  assert.ok(pruefeAntworten(katalog, { ...beispiel, limit_minute: 'viele' }).fehler.some((f) => f.includes('limit_minute')));
});

test('JenAiSystems selbst: gültig, nur Angaben von der Website, nur die freigegebene Telefonnummer', () => {
  const { fehler } = pruefeAntworten(katalog, jenaisystems);
  assert.deepEqual(fehler, []);
  const w = baueWissen(jenaisystems);
  for (const re of [/ab 490 € einmalig/, /ab 69 € pro Monat/, /ab 199 € pro Monat/, /§ 19 UStG/, /jenaisystems@protonmail\.com/, /\+49 157 34425980/, /Österreich und der Schweiz/, /Drohnenaufnahmen.*auf Anfrage/, /Website-Check/, /Feste Öffnungszeiten: keine/]) assert.match(w, re);
  assert.doesNotMatch(w, /Montag/, 'keine erfundenen Öffnungszeiten');
  assert.equal((w.match(/\+49 ?\d[\d ]+/g) || []).filter((t) => t.trim() !== '+49 157 34425980').length, 0, 'nur die von Julian freigegebene Telefonnummer');
  const p = baueChatPrompt(jenaisystems, w);
  assert.match(p, /KI, kein Mensch/);
  assert.match(p, /einladen: zum kostenlosen Website-Check/);
  assert.match(p, /bitte direkt anfragen/i);
  assert.match(p, /Nenne keine andere Telefonnummer/);
  const c = baueKundenConfig(jenaisystems, p, '');
  assert.equal(c.id, 'jenaisystems');
  assert.equal(c.beispiel, false);
  assert.equal(c.phone, null);
  assert.equal(c.widget.phone, '+49 157 34425980');
  assert.ok(c.allowedOrigins.includes('https://jenaisystems.com'));
  assert.ok(c.widget.suggestions.length > 0 && c.widget.suggestions.length <= 4);
});

test('Keine festen Öffnungszeiten: Pflichtfeld entfällt, Hinweis ohne Sonderzeiten', () => {
  const a = { ...beispiel, oeffnungszeiten_keine: true, oeffnungszeiten: {}, sonderzeiten: '' };
  const r = pruefeAntworten(katalog, a);
  assert.ok(!r.fehler.some((f) => f.includes('oeffnungszeiten')));
  assert.ok(r.warnungen.some((x) => x.includes('Sonderzeiten')));
  assert.ok(pruefeAntworten(katalog, { ...beispiel, oeffnungszeiten: {} }).fehler.some((f) => f.includes('oeffnungszeiten')));
  assert.doesNotMatch(baueWissen(a), /Montag/);
});

test('Erzeugte Dateien sind aktuell (generate + build:worker)', async () => {
  const { CLIENTS } = await import('../assistant/worker/src/clients.generated.js');
  for (const [id, a] of [['beispiel', beispiel], ['jenaisystems', jenaisystems]]) {
    const datei = JSON.parse(readFileSync(new URL(`../clients/${id}/client.json`, import.meta.url)));
    const neu = baueKundenConfig(a, baueChatPrompt(a, baueWissen(a)), '');
    assert.deepEqual(datei, JSON.parse(JSON.stringify(neu)), `Bitte npm run generate -- clients/${id}/antworten.json ausführen`);
    const { fastAnswers, ...ohneSchnell } = CLIENTS[id];
    assert.deepEqual(ohneSchnell, datei, 'Bitte npm run build:worker ausführen');
    const schnell = JSON.parse(readFileSync(new URL(`../clients/${id}/schnellantworten.json`, import.meta.url))).antworten;
    assert.deepEqual(fastAnswers.map((f) => f.id), schnell.map((f) => f.id), 'Schnellantworten: bitte npm run build:worker ausführen');
    assert.deepEqual(fastAnswers.map((f) => f.answer), schnell.map((f) => f.answer));
  }
});

test('Fragebogen-HTML ist mit dem Katalog synchron', () => {
  const html = readFileSync(new URL('../onboarding/fragebogen.html', import.meta.url), 'utf8');
  const m = html.match(/<script type="application\/json" id="katalog">([\s\S]*?)<\/script>/);
  assert.deepEqual(JSON.parse(m[1]), katalog, 'Bitte npm run build:fragebogen ausführen');
});
