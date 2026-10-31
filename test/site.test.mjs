import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mockAnswer } from '../scripts/dev-server-mock.mjs';
import { CLIENTS } from '../assistant/worker/src/clients.generated.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('site/index.html');

test('Website bindet den Chat ein: JenAiSystems + Demo (Bäckerei)', () => {
  const tag = html.match(/<script src="jenaisystems-chat\.js(\?v=[^"]+)?" data-[^>]*>/);
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
  assert.match(ds, /Cloudflare Workers AI/);
  assert.match(ds, /nicht zum Trainieren/);
  assert.match(ds, /Cloudflare/);
  assert.match(ds, /künstliche Intelligenz, kein Mensch/);
});

test('Übungs-Modell: Preisfrage an JenAiSystems, Demo-Frage an die Bäckerei', () => {
  const ask = (id, q) => mockAnswer([{ role: 'system', content: CLIENTS[id].chat.systemPrompt }, { role: 'user', content: q }]);
  assert.match(ask('jenaisystems', 'Was kostet eine Website?'), /490 €/);
  assert.match(ask('beispiel', 'Habt ihr glutenfreies Brot?'), /glutenfrei/);
  assert.match(ask('jenaisystems', 'Bist du ein Mensch?'), /KI-Assistent, kein Mensch/);
});

test('KI-Chat: Worker-Adresse steht an einer Stelle (main.js) und ist in der CSP erlaubt', () => {
  const js = read('site/main.js');
  const m = js.match(/var CHAT_ENDPOINT = '([^']*)';/);
  assert.ok(m, 'CHAT_ENDPOINT fehlt in site/main.js');
  assert.doesNotMatch(html, /data-endpoint=/, 'Endpoint nicht doppelt im HTML pflegen');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const connect = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('connect-src'));
  assert.match(connect, /https:\/\/api\.web3forms\.com/);
  if (m[1]) assert.ok(connect.split(/\s+/).includes(new URL(m[1]).origin), `connect-src muss ${new URL(m[1]).origin} enthalten`);
  assert.ok(html.indexOf('src="main.js') < html.indexOf('src="jenaisystems-chat.js'), 'main.js muss vor dem Chat-Widget geladen werden');
});

test('Datenschutz: vollständig, ohne Platzhalter, passt zur Seite', () => {
  const ds = read('site/datenschutz.html');
  assert.doesNotMatch(ds, /class="todo"|Platzhalter|TODO/);
  for (const s of ['Berggasse 2', 'GitHub', 'Proton AG', 'Web3Forms', 'Cloudflare Workers AI', 'keine Cookies', 'TLfDI', 'Häßlerstraße 8', 'Art. 15', 'Art. 21', 'Stand: Oktober 2026']) assert.ok(ds.includes(s), s);
  // Behauptung "keine Cookies / kein Local Storage" muss stimmen
  for (const f of ['site/main.js', 'site/jenaisystems-chat.js']) assert.doesNotMatch(read(f), /localStorage|sessionStorage|document\.cookie/, f);
  assert.doesNotMatch(read('site/style.css') + read('site/index.html'), /fonts\.googleapis|fonts\.gstatic/);
});

test('Chat-Widget: keine Anfrage an den Chat-Dienst beim Seitenaufruf, erst beim Öffnen', () => {
  const w = read('assistant/widget/jenaisystems-chat.js');
  assert.equal(read('site/jenaisystems-chat.js'), w, 'site/ nutzt die aktuelle Widget-Version');
  // Einzige Stelle, die Einstellungen lädt, ist ensureCfg(); sie wird nur aus open()/nach dem KI-Hinweis aufgerufen.
  assert.match(w, /function ensureCfg\(\)/);
  assert.match(w, /function open\(key, question\) \{\s*ensureCfg\(\);/);
  const start = w.slice(w.lastIndexOf('var cfgPromise = null;'));
  assert.match(start, /overrides\(\); applyCfg\(\); document\.body\.appendChild\(host\);/);
  // Fetch-Aufrufe nur in load() und ask()
  assert.equal((w.match(/fetch\(/g) || []).length, 2);
  assert.match(read('site/datenschutz.html'), /Solange Sie den Chat nicht öffnen, werden keine Daten an den Chat-Dienst übertragen/);
  assert.doesNotMatch(read('site/index.html'), /Videocall/i);
});

test('Livegang: keine Entwurfs-Leiste, keine offenen Preis-Bestätigungen, Preise final', () => {
  assert.doesNotMatch(html, /class="draft"|noch nicht offiziell|bitte bestätigen|ENTWURF/);
  assert.doesNotMatch(read('site/style.css'), /\.draft/);
  for (const p of ['490&nbsp;€', '69&nbsp;€', '199&nbsp;€']) assert.ok(html.includes(p), p);
});

test('Hero: Nutzen-Überschrift, Chat-Demo direkt darunter, Website-Check weit oben', () => {
  assert.match(html, /<h1>Ihr Betrieb beantwortet Kundenfragen <em>rund um die Uhr\.<\/em><\/h1>/);
  const hero = html.slice(html.indexOf('<h1>'), html.indexOf('class="scene"'));
  assert.match(hero, /data-jenaisystems-open="demo"[^>]*>Chat-Demo ausprobieren/);
  const check = html.indexOf('id="check"');
  assert.ok(check > 0 && check < html.indexOf('id="leistungen"'), 'Website-Check vor den Leistungen');
  assert.match(html, /5 Verbesserungen für Ihren Betrieb/);
});

test('Was Sie bei uns bekommen: fünf ehrliche Punkte, kein Mitbewerber genannt', () => {
  const sec = html.slice(html.indexOf('id="vorteile"'), html.indexOf('id="ablauf"'));
  for (const s of ['Demo zum Ausprobieren', 'Offene Festpreise', 'Keine Tracker', 'Alle Zugänge gehören Ihnen', 'Monatlich kündbar']) assert.ok(sec.includes(s), s);
  assert.doesNotMatch(html, /MA Productions|ma-productions/i);
});

test('SEO-Unterseiten: Titel, Meta, Canonical, CSP, Rechtslinks, verlinkt und in der Sitemap', () => {
  const sitemap = read('site/sitemap.xml');
  for (const f of ['ki-chatbot-jena.html', 'website-handwerker-jena.html']) {
    const p = read(`site/${f}`);
    assert.match(p, /<title>[^<]+Jena[^<]*<\/title>/);
    assert.match(p, /<meta name="description" content="[^"]{60,}">/);
    assert.match(p, new RegExp(`<link rel="canonical" href="https://jenaisystems.com/${f}">`));
    assert.ok(p.includes(`connect-src 'self' https://api.web3forms.com https://jenaisystems-assistant.jenaisystems.workers.dev`), 'gleiche CSP');
    assert.match(p, /href="impressum.html"/); assert.match(p, /href="datenschutz.html"/);
    assert.doesNotMatch(p, /<script/, 'keine Skripte nötig');
    assert.ok(html.includes(`href="${f}"`), `Startseite verlinkt ${f}`);
    assert.ok(sitemap.includes(`https://jenaisystems.com/${f}`), `Sitemap enthält ${f}`);
    assert.doesNotMatch(p, /Videocall|garantiert Platz|\d+\s?% mehr/i);
  }
});

test('Bewertungen: Platz vorbereitet, aber verborgen und leer, bis echte vorliegen', () => {
  const m = html.match(/<section id="bewertungen"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(m, 'Abschnitt vorhanden');
  assert.match(m[0], /<section id="bewertungen"[^>]*\shidden>/);
  assert.match(m[1], /<div class="rev-list"><\/div>/, 'keine Bewertungen eingetragen');
  assert.doesNotMatch(m[1], /★|Sterne|blockquote/);
});

test('HTTPS-Weiterleitung und Cache-Versionen für JS/CSS', () => {
  assert.match(read('site/main.js'), /location\.protocol === 'http:'[\s\S]{0,120}location\.replace\('https:\/\//);
  assert.match(html, /src="main\.js\?v=\w+"/);
  assert.match(html, /src="jenaisystems-chat\.js\?v=\w+"/);
  assert.match(html, /href="style\.css\?v=\w+"/);
});
