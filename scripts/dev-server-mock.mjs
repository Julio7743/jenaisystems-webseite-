// „Übungs-Modell“ für lokale Tests: sucht nur Stichworte im <wissen>-Teil des System-Prompts. Kein echtes KI-Modell.
export function mockAnswer(messages) {
  const system = messages[0].content;
  const wissen = system.slice(system.lastIndexOf('<wissen>') + 8, system.lastIndexOf('</wissen>'));
  const frage = messages[messages.length - 1].content.toLowerCase();
  const STOP = new Set(['eine', 'einen', 'einer', 'habt', 'haben', 'gibt', 'auch', 'kann', 'können', 'sind', 'ihre', 'euch', 'bitte', 'mich', 'mir', 'dass', 'wird', 'wie']);
  const worte = frage.split(/[^a-zäöüß0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
  if (/\bmensch\b|\bbist du (eine )?ki\b|\bbot\b/.test(frage)) return 'Ich bin ein KI-Assistent, kein Mensch. Persönliche Antworten bekommen Sie über die Kontaktangaben auf der Website. (Übungs-Antwort ohne echtes KI-Modell)';
  const zeilen = wissen.split('\n').map((z) => z.replace(/^\s*-\s*/, '').trim()).filter((z) => z && !z.startsWith('#'));
  // FAQ-Paare zusammenfassen
  const bloecke = [];
  for (let i = 0; i < zeilen.length; i++) {
    if (zeilen[i].startsWith('Frage:') && zeilen[i + 1]?.startsWith('Antwort:')) { bloecke.push(zeilen[i] + ' ' + zeilen[i + 1]); i++; } else bloecke.push(zeilen[i]);
  }
  const stamm = (w) => w.replace(/(en|er|e|n|s)$/, '');
  let best = null, score = 0;
  for (const b of bloecke) {
    const l = b.toLowerCase();
    let s = worte.reduce((n, w) => n + (l.includes(stamm(w)) ? 1 : 0), 0);
    if (s > 0 && /kostet|preis|teuer/.test(frage) && /preis/.test(l)) s += 0.6; // Preisfragen: Zeilen mit Preis bevorzugen
    if (s > 0 && b.startsWith('Frage:')) s += 0.5; // bei Gleichstand die passende häufige Frage bevorzugen
    if (s > score) { score = s; best = b; }
  }
  if (/öffnungszeit|geöffnet|offen|wann/.test(frage)) {
    const oz = bloecke.filter((b) => /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag):/.test(b));
    if (oz.length) return `Unsere Öffnungszeiten: ${oz.join(', ')}. (Übungs-Antwort ohne echtes KI-Modell)`;
  }
  if (!best) return 'Das weiß ich leider nicht sicher. Bitte melden Sie sich direkt bei uns. (Übungs-Antwort ohne echtes KI-Modell)';
  return best.replace(/^Frage: .*? Antwort: /, '').replace(/ \| /g, ', ') + ' (Übungs-Antwort ohne echtes KI-Modell)';
}
