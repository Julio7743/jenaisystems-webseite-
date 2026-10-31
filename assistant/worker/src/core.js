// Reine Logik des Chat-Workers (ohne Cloudflare-spezifische APIs), damit sie mit Node getestet werden kann.
import { selectKnowledge, isSimpleQuestion } from './sparen.js';

export const MAX_HISTORY = 8;          // so viele letzte Nachrichten gehen an das Modell
export const MAX_MESSAGE_CHARS = 800;  // längere Nachrichten werden abgeschnitten
export const MAX_ANSWER_TOKENS = 350;

// Cloudflare Workers AI (kostenloses Kontingent: 10.000 Neurons pro Tag, Stand Okt. 2026).
// Mistral Small 3.1: gut auf Deutsch, günstig bei Antworten (≈ 31.876 Neurons/M Eingabe, 50.488/M Ausgabe).
export const DEFAULT_WORKERS_AI_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
export const FALLBACK_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// Empfohlenes kleines Modell für kurze, einfache Fragen (Test Okt. 2026: flüssiges Deutsch, Sie-Form, ≈ 5× weniger Neurons
// als Mistral, aber ungenauer: spricht teils als „ich“ statt über Julian Köbele, vergisst Pflicht-Hinweise).
// Deshalb standardmäßig AUS; einschalten mit WORKERS_AI_SMALL_MODEL in wrangler.toml.
// Llama 3.1 8B wurde verworfen: duzt trotz Anweisung und widerspricht sich auf Deutsch.
export const SMALL_WORKERS_AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

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

/**
 * Plant eine KI-Antwort sparsam: nur der passende Wissens-Auszug und – bei einfachen Fragen – das kleine Modell.
 * Ganzes Wissen statt Auszug: RETRIEVAL="off". Kleines Modell nur, wenn WORKERS_AI_SMALL_MODEL gesetzt ist.
 */
export function planChat(client, history, env = {}) {
  const k = env.RETRIEVAL === 'off' ? { prompt: client.chat.systemPrompt, mode: 'voll' } : selectKnowledge(client, history);
  const main = env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
  const fb = env.WORKERS_AI_FALLBACK_MODEL === '' ? null : (env.WORKERS_AI_FALLBACK_MODEL || FALLBACK_WORKERS_AI_MODEL);
  const small = env.WORKERS_AI_SMALL_MODEL || null; // leer/nicht gesetzt = aus
  const simple = Boolean(small) && isSimpleQuestion(history, k.mode);
  const models = [...new Set((simple ? [small, main] : [main, fb]).filter(Boolean))];
  return { messages: [{ role: 'system', content: k.prompt }, ...history], models, knowledge: k.mode, simple };
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
  // Tagesgrenze pro Kunde (z. B. Demo), damit ein Assistent den anderen nicht ausbremst.
  const clientDaily = Number(client.limits && client.limits.dailyRequests) || 0;
  if (clientDaily > 0) {
    const cd = await counter.get(`cap:${client.id}:day:${dayKey()}`);
    if (cd >= clientDaily) return { ok: false, reason: 'client-daily' };
  }
  // Tagesgrenze über alle Kunden: hält das kostenlose Workers-AI-Kontingent ein (Reset 00:00 UTC).
  const dailyCap = Number.parseInt(env.GLOBAL_DAILY_CAP || '0', 10);
  if (dailyCap > 0) {
    const d = await counter.get(`cap:_day:${dayKey()}`);
    if (d >= dailyCap) return { ok: false, reason: 'daily' };
  }
  return { ok: true };
}

export async function countRequest(counter, client, month = monthKey(), day = dayKey()) {
  await counter.incr(`cap:${client.id}:${month}`);
  await counter.incr(`cap:_global:${month}`);
  await counter.incr(`cap:_day:${day}`);
  await counter.incr(`cap:${client.id}:day:${day}`);
}

export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // z. B. 2026-10-31 (UTC, wie das Workers-AI-Tageskontingent)
}

/** Welcher Anbieter? LLM_PROVIDER="workers-ai" (Cloudflare, Binding env.AI) oder "openai" (OpenAI-kompatibel, z. B. Mistral). */
export function llmProvider(env) {
  const p = String(env.LLM_PROVIDER || (env.AI ? 'workers-ai' : 'openai')).toLowerCase();
  return p === 'workers-ai' ? 'workers-ai' : 'openai';
}

export function llmConfigured(env) {
  return llmProvider(env) === 'workers-ai' ? Boolean(env.AI && typeof env.AI.run === 'function') : Boolean(env.LLM_API_KEY);
}

/** Einheitlicher Aufruf für beide Anbieter. */
export async function callAI(env, messages, fetchImpl = fetch, models = null) {
  return llmProvider(env) === 'workers-ai' ? callWorkersAI(env, messages, models) : callLLM(env, messages, fetchImpl);
}

/** Qwen3 denkt sonst erst laut nach; „/no_think“ schaltet das ab. Denk-Blöcke werden zur Sicherheit entfernt. */
function prepareFor(model, messages) {
  if (!/qwen3/i.test(model)) return messages;
  const out = messages.map((m) => ({ ...m }));
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i].role === 'user') { out[i].content = `${out[i].content} /no_think`; break; }
  }
  return out;
}
export function cleanModelText(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();
}

/** Cloudflare Workers AI über das Binding env.AI. Fällt bei einem Fehler einmal auf das Ersatzmodell zurück. */
export async function callWorkersAI(env, messages, modelList = null) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('Workers-AI-Binding fehlt');
  const max_tokens = Number.parseInt(env.LLM_MAX_TOKENS || '', 10) || MAX_ANSWER_TOKENS;
  let models = modelList && modelList.length ? [...modelList] : null;
  if (!models) {
    models = [env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL];
    const fb = env.WORKERS_AI_FALLBACK_MODEL === '' ? null : (env.WORKERS_AI_FALLBACK_MODEL || FALLBACK_WORKERS_AI_MODEL);
    if (fb && fb !== models[0]) models.push(fb);
  }
  let last;
  for (const model of models) {
    try {
      const out = await env.AI.run(model, { messages: prepareFor(model, messages), max_tokens, temperature: 0.2 });
      let text = out?.response ?? out?.choices?.[0]?.message?.content ?? (typeof out === 'string' ? out : '');
      if (Array.isArray(text)) text = text.filter((c) => c && c.type === 'text').map((c) => c.text).join('');
      text = cleanModelText(text);
      if (text) {
        if (env.CHAT_DEBUG_LOG === 'true') console.log('ki', model, 'neurons', out?.usage?.neurons ?? '?', 'prompt_tokens', out?.usage?.prompt_tokens ?? '?');
        return text;
      }
      last = new Error('Leere Antwort vom Modell');
    } catch (e) { last = e; }
  }
  throw last || new Error('Workers-AI-Fehler');
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
