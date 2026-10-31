// JenAiSystems Chat-Worker (Cloudflare Workers). Leitet Chat-Fragen an Cloudflare Workers AI (Standard) oder ein OpenAI-kompatibles Sprachmodell weiter.
// Endpunkte:
//   GET  /health
//   GET  /api/config?client=ID          öffentliche Widget-Einstellungen
//   POST /api/chat     {client, messages}  Antwort des Assistenten
//   GET  /api/report?client=ID&month=YYYY-MM  Monatszahlen (nur mit ADMIN_TOKEN)
import { CLIENTS } from './clients.generated.js';
import {
  corsHeaders, originAllowed, cleanHistory, buildMessages, redact, monthKey,
  MinuteLimiter, MonthlyCounter, checkCaps, countRequest, callAI, llmConfigured, publicConfig, fallbackText, planChat,
} from './core.js';
import { findFastAnswer, ensureDemoNotice } from './sparen.js';

const limiter = new MinuteLimiter();
const memoryCounts = new Map();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

export function getClient(id, clients = CLIENTS) {
  return typeof id === 'string' && Object.hasOwn(clients, id) ? clients[id] : null;
}

export default {
  async fetch(request, env, ctx, clients = CLIENTS) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (url.pathname === '/health') return json({ ok: true });

    if (url.pathname === '/api/report' && request.method === 'GET') {
      if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'unauthorized' }, 401);
      const client = getClient(url.searchParams.get('client'), clients);
      if (!client) return json({ error: 'unknown client' }, 404);
      const month = url.searchParams.get('month') || monthKey();
      const counter = new MonthlyCounter(env.USAGE, memoryCounts);
      const out = { client: client.id, month, requests: await counter.get(`cap:${client.id}:${month}`), questions: [] };
      if (env.USAGE) {
        const list = await env.USAGE.list({ prefix: `q:${client.id}:${month}:` });
        for (const k of list.keys) out.questions.push(await env.USAGE.get(k.name));
      }
      return json(out);
    }

    if (url.pathname === '/api/config' && request.method === 'GET') {
      const client = getClient(url.searchParams.get('client'), clients);
      if (!client) return json({ error: 'unknown client' }, 404);
      return json(publicConfig(client), 200, { ...corsHeaders(origin, client), 'Cache-Control': 'public, max-age=300' });
    }

    if (url.pathname === '/api/chat') {
      // Kunde für CORS-Preflight über ?client= bestimmen, bei POST aus dem Body.
      if (request.method === 'OPTIONS') {
        const c = getClient(url.searchParams.get('client'), clients);
        return new Response(null, { status: c && originAllowed(origin, c) ? 204 : 403, headers: corsHeaders(origin, c) });
      }
      if (request.method !== 'POST') return json({ error: 'method' }, 405);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const client = getClient(body?.client, clients);
      if (!client) return json({ error: 'unknown client' }, 404);
      const cors = corsHeaders(origin, client);
      if (!originAllowed(origin, client)) return json({ error: 'origin not allowed' }, 403, cors);

      const history = cleanHistory(body.messages);
      if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'no question' }, 400, cors);

      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      // Cloudflare Rate Limiting (gilt über alle Worker-Instanzen, falls gebunden) + Speicher-Limit als Rückfall.
      let edgeOk = true;
      if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
        try { edgeOk = (await env.RATE_LIMITER.limit({ key: `${client.id}:${ip}` })).success; } catch { edgeOk = true; }
      }
      if (!edgeOk || !limiter.allow(`${client.id}:${ip}`, client.limits.perMinutePerIp)) {
        return json({ error: 'rate', reply: 'Bitte einen kleinen Moment warten und dann erneut fragen.' }, 429, cors);
      }

      // Schnellantwort: eindeutige Standardfragen ohne KI. Zählt NICHT gegen die KI-Limits und schreibt nichts in KV
      // (spart auch KV-Schreibvorgänge); das Minuten-Limit oben gilt trotzdem. Abschalten mit FAST_ANSWERS="off".
      if (env.FAST_ANSWERS !== 'off') {
        const fast = findFastAnswer(client, history);
        if (fast) return json({ reply: fast.reply, source: 'faq' }, 200, cors);
      }

      const counter = new MonthlyCounter(env.USAGE, memoryCounts);
      const caps = await checkCaps(counter, client, env);
      if (!caps.ok) return json({ error: 'cap', reply: fallbackText(client) }, 429, cors);
      if (!llmConfigured(env)) return json({ error: 'not configured', reply: fallbackText(client) }, 503, cors);

      try {
        const plan = planChat(client, history, env);
        if (env.CHAT_DEBUG_LOG === 'true') console.log('plan', client.id, plan.knowledge, plan.simple ? 'einfach' : 'normal', 'prompt_chars', plan.messages[0].content.length);
        const reply = ensureDemoNotice(client, history[history.length - 1].content, await callAI(env, plan.messages, fetch, plan.models));
        const done = countRequest(counter, client).catch(() => {}); // KV-Schreibfehler dürfen den Chat nicht stören
        const question = history[history.length - 1].content;
        const log = client.logQuestions && env.LOG_QUESTIONS === 'true' && env.USAGE
          ? env.USAGE.put(`q:${client.id}:${monthKey()}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, redact(question), { expirationTtl: 60 * 60 * 24 * 90 })
          : null;
        if (ctx?.waitUntil) { ctx.waitUntil(done); if (log) ctx.waitUntil(log); } else { await done; await log; }
        return json({ reply, source: 'ki' }, 200, cors);
      } catch (e) {
        console.log('chat error', client.id, String(e && e.message)); // keine Nutzerinhalte loggen
        return json({ error: 'llm', reply: fallbackText(client) }, 502, cors);
      }
    }

    return json({ error: 'not found' }, 404);
  },
};
