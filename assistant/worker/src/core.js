// Reine Logik des Chat-Workers (ohne Cloudflare-spezifische APIs), damit sie mit Node getestet werden kann.

export const MAX_HISTORY = 8;          // so viele letzte Nachrichten gehen an das Modell
export const MAX_MESSAGE_CHARS = 800;  // längere Nachrichten werden abgeschnitten
export const MAX_ANSWER_TOKENS = 350;

/** CORS: nur Domains aus der Kunden-Konfiguration. */
export function corsHeaders(origin, client) {
  const h = { 'Vary': 'Origin' };
  if (origin && client && client.allowedOrigins.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

export function originAllowed(origin, client) {
  return Boolean(origin && client && client.allowedOrigins.includes(origin));
}

/** Nimmt nur gültige user/assistant-Nachrichten, kürzt sie und behält die letzten MAX_HISTORY. */
export function cleanHistory(messages) {
  if (!Array.isArray(messages)) return [];
  const ok = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
  const last = ok.slice(-MAX_HISTORY);
  while (last.length && last[0].role !== 'user') last.shift();
  return last;
}

export function buildMessages(client, history) {
  return [{ role: 'system', content: client.chat.systemPrompt }, ...history];
}

/** Entfernt E-Mail-Adressen, Telefonnummern und IBANs aus Text (für das optionale anonyme Fragen-Log). */
export function redact(text) {
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[E-Mail]')
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g, '[IBAN]')
    .replace(/(?:\+|\b0)\d[\d\s/()-]{6,}\d/g, '[Telefon]')
    .slice(0, 300);
}

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // z. B. 2026-10 (UTC)
}

/** Einfaches Limit pro IP und Minute. Nur im Speicher: pro Worker-Instanz, also ein „bestes Bemühen“-Schutz. */
export class MinuteLimiter {
  constructor(now = () => Date.now()) { this.now = now; this.hits = new Map(); }
  allow(key, perMinute) {
    const t = this.now();
    const arr = (this.hits.get(key) || []).filter((x) => t - x < 60_000);
    if (arr.length >= perMinute) { this.hits.set(key, arr); return false; }
    arr.push(t); this.hits.set(key, arr);
    if (this.hits.size > 5000) this.hits.clear(); // Speicher begrenzen
    return true;
  }
}

/**
 * Monatszähler. Speichert in Cloudflare KV, falls gebunden (env.USAGE), sonst im Speicher.
 * KV ist nicht exakt (mehrere gleichzeitige Anfragen können sich überschneiden) – als Kostenbremse reicht das.
 */
export class MonthlyCounter {
  constructor(kv, memory = new Map()) { this.kv = kv; this.mem = memory; }
  async get(key) {
    if (this.kv) return Number.parseInt((await this.kv.get(key)) || '0', 10);
    return this.mem.get(key) || 0;
  }
  async incr(key) {
    const n = (await this.get(key)) + 1;
    if (this.kv) await this.kv.put(key, String(n), { expirationTtl: 60 * 60 * 24 * 40 });
    else this.mem.set(key, n);
    return n;
  }
}

/** Prüft Monatsgrenze pro Kunde und global. Gibt { ok, reason } zurück. */
export async function checkCaps(counter, client, env, month = monthKey()) {
  const clientCount = await counter.get(`cap:${client.id}:${month}`);
  if (clientCount >= client.limits.monthlyRequests) return { ok: false, reason: 'client' };
  const globalCap = Number.parseInt(env.GLOBAL_MONTHLY_CAP || '0', 10);
  if (globalCap > 0) {
    const g = await counter.get(`cap:_global:${month}`);
    if (g >= globalCap) return { ok: false, reason: 'global' };
  }
  return { ok: true };
}

export async function countRequest(counter, client, month = monthKey()) {
  await counter.incr(`cap:${client.id}:${month}`);
  await counter.incr(`cap:_global:${month}`);
}

/** Ruft ein OpenAI-kompatibles Chat-API auf (Mistral, OpenAI, Gemini-OpenAI-Endpunkt, ...). */
export async function callLLM(env, messages, fetchImpl = fetch) {
  const base = (env.LLM_BASE_URL || 'https://api.mistral.ai/v1').replace(/\/$/, '');
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.LLM_API_KEY}` },
    body: JSON.stringify({
      model: env.LLM_MODEL || 'mistral-small-latest',
      messages,
      temperature: 0.2,
      max_tokens: Number.parseInt(env.LLM_MAX_TOKENS || '', 10) || MAX_ANSWER_TOKENS,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`LLM-Fehler ${res.status}`);
  const data = await res.json();
  let text = data?.choices?.[0]?.message?.content;
  // Manche Modelle liefern eine Liste von Teilen (z. B. Denk-Teil + Text) – nur Text übernehmen.
  if (Array.isArray(text)) text = text.filter((c) => c && c.type === 'text').map((c) => c.text).join('');
  if (typeof text !== 'string' || !text.trim()) throw new Error('Leere Antwort vom Modell');
  return text.trim();
}

/** Öffentliche Widget-Konfiguration (ohne Prompt). */
export function publicConfig(client) {
  return { id: client.id, name: client.name, beispiel: Boolean(client.beispiel), ...client.widget };
}

export function fallbackText(client) {
  const w = client.widget;
  const wege = [w.phone && `Telefon ${w.phone}`, w.email && `E-Mail ${w.email}`, w.contactUrl && w.contactUrl].filter(Boolean).join(' oder ');
  return `Der Chat ist gerade nicht verfügbar. ${wege ? `Bitte ${w.du ? 'melde dich' : 'melden Sie sich'} direkt: ${wege}.` : ''}`.trim();
}
