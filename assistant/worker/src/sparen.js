// Sparmaßnahmen für den Chat (weniger KI-Rechenzeit, schnellere Antworten):
// 1) Schnellantworten: eindeutige Standardfragen werden mit geprüften, festen Texten beantwortet – ohne KI.
// 2) Wissens-Auszug: An das Modell geht nur der zur Frage passende Teil des Wissens statt des ganzen Textes.
// 3) Modellwahl: kurze, einfache Fragen an ein kleines, schnelles Modell; alles andere an das Hauptmodell.
// Alle Funktionen sind rein (kein Netz, kein Speicher) und damit gut testbar.

/** Kleinschreibung, Umlaute auflösen, nur Buchstaben/Ziffern; liefert Wortliste. */
export function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1);
}

// Füllwörter, die nichts über das Thema verraten.
const STOP = new Set(('ich du er sie es wir ihr man mich mir dich dir uns euch ihnen sich mein meine meinen meinem meiner '
  + 'dein deine ihre ihren ihrem euer eure euren unser unsere der die das den dem des ein eine einen einem einer und oder '
  + 'aber auch noch schon mal bitte danke denn doch ja nein so wie was wer wo wann welche welcher welches ist sind bin bist '
  + 'seid sein war hat habe hast habt haben gibt gib geben kann kannst koennen koennt koennte konnte wird werden wuerde '
  + 'muss mit von vom zu zum zur bei beim fuer an am im in ins auf aus um ob dass hier da dort gerne gern eigentlich genau '
  + 'etwa ungefaehr ca jetzt heute bzw usw also nur sehr viel viele wieviel mehr').split(' '));

const SUFFIXES = ['ungen', 'ung', 'ern', 'en', 'er', 'es', 'em', 'e', 'n', 's'];
/** Sehr einfache Wortstamm-Bildung, damit „Preise“ und „Preis“ zusammenpassen. */
export function stem(w) {
  for (const s of SUFFIXES) if (w.length - s.length >= 4 && w.endsWith(s)) return w.slice(0, -s.length);
  return w;
}

// Bedeutungsgruppen: ein Wort aus der Frage zählt auch für die anderen Wörter seiner Gruppe.
const SYNONYMS = [
  ['preis', 'kost', 'teuer', 'euro', 'paket', 'bezahl', 'zahl'],
  ['erreich', 'kontakt', 'telefon', 'anruf', 'nummer', 'mail', 'schreib'],
  ['oeffnungszeit', 'geoeffnet', 'offen', 'oeffn', 'geschlossen', 'montag', 'samstag', 'sonntag', 'uhr'],
  ['ablauf', 'laeuft', 'zusammenarbeit', 'vorgeh', 'schritt', 'erstgespraech', 'bestell'],
  ['daten', 'datenschutz', 'speicher', 'gespeichert', 'tracker', 'cookie'],
  ['adress', 'anfahrt', 'wo', 'standort', 'bus', 'haltestell'],
  ['foto', 'bild', 'fotograf'],
  ['website', 'webseit', 'homepag', 'internetseit'],
  ['chatbot', 'assistent', 'ki', 'chat'],
  ['kuendig', 'gebund', 'vertrag', 'laufzeit', 'kuendbar'],
  ['shop', 'onlineshop', 'gutschein'],
  ['werbung', 'ads', 'anzeig', 'werb', 'instagram', 'facebook'],
  ['vegan', 'vegane'],
  ['gluten', 'glutenfrei'],
];
const SYN = new Map();
for (const g of SYNONYMS) for (const w of g) SYN.set(w, g);

/** Suchbegriffe einer Frage mit Gewicht: eigene Wörter 1, verwandte Wörter (Synonyme) 0,4. */
function queryTerms(text) {
  const terms = new Map();
  const add = (t, w) => { if ((terms.get(t) || 0) < w) terms.set(t, w); };
  for (const w of words(text)) {
    if (STOP.has(w) && !SYN.has(w)) continue;
    const s = stem(w);
    if (s.length < 3 && !SYN.has(s)) continue;
    add(s, 1);
    for (const [k, g] of SYN) if (s.startsWith(k) && (k.length >= 4 || s === k)) g.forEach((x) => add(x, 0.4));
  }
  return terms;
}

// ---------------------------------------------------------------- Wissens-Auszug

const parsed = new WeakMap();

/** Zerlegt einen System-Prompt in Kopf (Regeln), Wissens-Einträge und Schluss. */
export function parsePrompt(prompt) {
  const start = prompt.lastIndexOf('\n<wissen>');
  const end = prompt.lastIndexOf('</wissen>');
  if (start < 0 || end < start) return null;
  const head = prompt.slice(0, start);
  const tail = prompt.slice(end + '</wissen>'.length);
  const lines = prompt.slice(start + '\n<wissen>'.length, end).split('\n');
  let title = '';
  let section = '';
  const items = [];
  for (const line of lines) {
    if (line.startsWith('# ')) { title = line; continue; }
    if (line.startsWith('## ')) { section = line.slice(3).trim(); continue; }
    if (line.startsWith('- ')) { items.push({ section, text: line, index: items.length }); continue; }
    if (line.startsWith('  ') && items.length) items[items.length - 1].text += `\n${line}`;
  }
  for (const it of items) it.norm = words(`${it.section} ${it.text}`).map(stem).join(' ');
  // Seltene Wörter zählen mehr (einfaches IDF), damit „Fotos“ wichtiger ist als „Website“.
  const df = new Map();
  for (const it of items) for (const w of new Set(it.norm.split(' '))) df.set(w, (df.get(w) || 0) + 1);
  return { head, tail, title, items, df, n: items.length };
}

function parsedFor(client) {
  if (!parsed.has(client)) parsed.set(client, parsePrompt(client.chat.systemPrompt));
  return parsed.get(client);
}

// Einträge, die immer mitgehen (kurz, grundlegend): Name/Branche/Beschreibung und der Kontakt-Block.
function alwaysInclude(it) {
  if (it.section === 'Kontakt') return true;
  return it.section === 'Betrieb' && /^- (Name|Branche|Beschreibung):/.test(it.text);
}

function scoreItem(it, terms, kb) {
  let score = 0;
  const hay = ` ${it.norm} `;
  for (const [t, weight] of terms) {
    if (t.length < 2) continue;
    const hit = t.length >= 4 ? hay.includes(` ${t}`) || hay.includes(t) : hay.includes(` ${t} `);
    if (!hit) continue;
    let df = 0;
    for (const [w, c] of kb.df) if (w.startsWith(t)) { df = Math.max(df, c); }
    score += weight * Math.log(1 + kb.n / (1 + df));
  }
  if (it.section === 'Häufige Fragen' && score > 0) score *= 1.3; // fertige Antworten bevorzugen
  return score;
}

export const RETRIEVAL_MAX_ITEMS = 8;
export const RETRIEVAL_MAX_CHARS = 4500;

/**
 * Baut einen verkürzten System-Prompt: Regeln + nur die passenden Wissens-Einträge.
 * Findet die Frage nichts Passendes, geht zur Sicherheit das ganze Wissen mit.
 */
export function selectKnowledge(client, history, opts = {}) {
  const full = client.chat.systemPrompt;
  const kb = parsedFor(client);
  if (!kb || !kb.items.length) return { prompt: full, mode: 'voll' };
  const users = history.filter((m) => m.role === 'user');
  const last = users[users.length - 1]?.content || '';
  const prev = users.slice(-3, -1).map((m) => m.content).join(' ');
  const terms = queryTerms(last);
  const prevTerms = new Map([...queryTerms(prev)].filter(([t]) => !terms.has(t)));
  const scored = kb.items
    .filter((it) => !alwaysInclude(it))
    .map((it) => ({ it, s: scoreItem(it, terms, kb) + 0.5 * scoreItem(it, prevTerms, kb) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (!scored.length || scored[0].s < 0.5) return { prompt: full, mode: 'voll' };
  const maxItems = opts.maxItems || RETRIEVAL_MAX_ITEMS;
  const maxChars = opts.maxChars || RETRIEVAL_MAX_CHARS;
  const top = scored[0].s;
  const chosen = new Set(kb.items.filter(alwaysInclude));
  let chars = 0;
  let added = 0;
  for (const { it, s } of scored) {
    if (added >= maxItems || s < top * 0.25) break;
    if (chars + it.text.length > maxChars) continue;
    chosen.add(it);
    chars += it.text.length;
    added += 1;
  }
  // Zusammengehöriges nie halb schicken: alle Öffnungszeiten (sonst fehlen Wochentage) und alle Pakete (Preisvergleich).
  for (const group of [(it) => it.section === 'Öffnungszeiten', (it) => it.text.startsWith('- Paket ')]) {
    if ([...chosen].some(group)) kb.items.filter(group).forEach((it) => chosen.add(it));
  }
  // In der ursprünglichen Reihenfolge und mit Abschnitts-Überschriften ausgeben.
  let body = `${kb.title}\n(Auszug: nur die zur Frage passenden Einträge. Steht etwas nicht hier, sag ehrlich, dass du es nicht sicher weißt, und verweise auf den Kontakt.)\n`;
  let cur = null;
  for (const it of kb.items) {
    if (!chosen.has(it)) continue;
    if (it.section !== cur) { body += `\n## ${it.section}\n`; cur = it.section; }
    body += `${it.text}\n`;
  }
  return { prompt: `${kb.head}\n<wissen>\n${body}</wissen>${kb.tail}`, mode: 'auszug' };
}

// ---------------------------------------------------------------- Schnellantworten

function matchesAny(word, list) {
  for (const k of list || []) {
    if (k.endsWith('*') ? word.startsWith(k.slice(0, -1)) : word === k) return true;
  }
  return false;
}

// Wörter, die in einer Folgefrage auf etwas Vorheriges verweisen – dann lieber die KI fragen.
const REFERS_BACK = ['das', 'dafuer', 'davon', 'dazu', 'damit', 'dies', 'diese', 'dieses', 'es', 'da', 'dort', 'und', 'auch', 'sonst', 'noch'];
export const FAST_MAX_CHARS = 90;
const GREETING = new Set(['hallo', 'hi', 'hey', 'moin', 'servus', 'gruezi', 'huhu', 'guten', 'tag', 'morgen', 'abend', 'liebes', 'team']);

/**
 * Sucht eine feste Antwort. Strenge Regeln, damit nichts Falsches herauskommt:
 * - Frage kurz (höchstens FAST_MAX_CHARS Zeichen), höchstens ein Fragezeichen.
 * - Genau EIN Thema passt; jedes Wort der Frage ist entweder Schlüsselwort, erlaubtes Füllwort oder allgemeines Füllwort.
 *   Bleibt auch nur ein anderes Wort übrig (z. B. „Shop“ in „Was kostet ein Shop?“), antwortet die KI.
 * - Kein Sperrwort des Themas in der Frage.
 * - In einer laufenden Unterhaltung keine Rückverweise („und das?“, „was kostet das?“).
 */
export function findFastAnswer(client, history) {
  const list = client.fastAnswers;
  if (!Array.isArray(list) || !list.length) return null;
  const users = history.filter((m) => m.role === 'user');
  const q = users[users.length - 1]?.content || '';
  if (q.length > FAST_MAX_CHARS || (q.match(/\?/g) || []).length > 1) return null;
  if (/\d{4,}|@/.test(q)) return null; // Nummern/E-Mails in der Frage: lieber nicht
  // Grußworte stören die Erkennung nicht („Hallo, was kostet eine Website?“).
  const all = words(q);
  const ws = all.some((w) => !GREETING.has(w)) ? all.filter((w) => !GREETING.has(w)) : all;
  if (!ws.length || ws.length > 14) return null;
  if (users.length > 1 && ws.some((w) => REFERS_BACK.includes(w))) return null;
  const hits = [];
  for (const fa of list) {
    if (!ws.some((w) => matchesAny(w, fa.keys))) continue;
    if (ws.some((w) => matchesAny(w, fa.block))) continue;
    const rest = ws.filter((w) => !matchesAny(w, fa.keys) && !matchesAny(w, fa.fill) && !STOP.has(w));
    if (rest.length === 0) hits.push(fa);
  }
  if (hits.length !== 1) return null; // nichts oder mehrdeutig → KI
  return { id: hits[0].id, reply: hits[0].answer };
}

// ---------------------------------------------------------------- Modellwahl

const COMPLEX = ['unterschied', 'vergleich', 'lohnt', 'empfehl', 'besser', 'warum', 'wieso', 'weshalb', 'erklaer', 'steuer',
  'rechnung', 'abrechn', 'recht', 'datenschutz', 'vertrag', 'kuendig', 'oesterreich', 'schweiz', 'reverse', 'beschwer',
  'problem', 'fehler', 'allerg', 'gesund', 'krank', 'ignor', 'anweisung', 'prompt', 'regel', 'rolle',
  // Bestellen & Co.: In der Demo muss der Hinweis „erfundener Betrieb“ zuverlässig kommen → Hauptmodell.
  'bestell', 'vorbestell', 'abhol', 'reservier', 'buch', 'termin', 'liefer'];
export const SIMPLE_MAX_CHARS = 80;

/**
 * „Einfach“ = erste oder zweite Frage, kurz (≤ 80 Zeichen, ≤ 12 Wörter), ein Satz, kein heikles Thema,
 * und der Wissens-Auszug hat etwas Passendes gefunden. Nur dann darf das kleine Modell ran.
 */
export function isSimpleQuestion(history, knowledgeMode) {
  const users = history.filter((m) => m.role === 'user');
  if (users.length > 2 || knowledgeMode !== 'auszug') return false;
  const q = users[users.length - 1]?.content || '';
  if (q.length > SIMPLE_MAX_CHARS || (q.match(/[?.!]/g) || []).length > 1) return false;
  const ws = words(q);
  if (ws.length > 12) return false;
  return !ws.some((w) => COMPLEX.some((c) => w.startsWith(c)));
}

// ---------------------------------------------------------------- Sicherheitsnetz Demo

const ORDER = /\b(vor)?bestell|abhol|reservier|vorbeikomm|liefer/i;
/**
 * Demo-Betrieb (erfunden): Geht es ums Bestellen/Abholen/Vorbeikommen und hat das Modell den Hinweis vergessen,
 * wird er fest angehängt. So hängt diese Pflicht-Info nicht vom Modell ab.
 */
export function ensureDemoNotice(client, question, reply) {
  if (!client.beispiel || !ORDER.test(question || '')) return reply;
  if (/erfunden|Beispielbetrieb|Demo/i.test(reply)) return reply;
  return `${reply} Hinweis: Das ist ein erfundener Beispielbetrieb für eine Demo – hier kann man nicht wirklich bestellen.`;
}
