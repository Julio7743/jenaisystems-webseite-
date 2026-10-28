#!/usr/bin/env node
// Lokaler Testserver ohne Cloudflare-Konto: liefert Website, Demo, Fragebogen und Widget aus
// und beantwortet /api/* mit demselben Code wie der echte Worker.
// Ohne LLM_API_KEY antwortet ein einfacher „Übungs-Assistent“ (Mock), der nur Stichworte im Wissen sucht.
//   node scripts/dev-server.mjs            -> http://localhost:8787
//   LLM_API_KEY=... node scripts/dev-server.mjs   -> echtes Modell (kostet Geld beim Anbieter!)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../assistant/worker/src/index.js';
import { mockAnswer } from './dev-server-mock.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain' };

const env = {
  LLM_API_KEY: process.env.LLM_API_KEY || 'mock',
  LLM_BASE_URL: process.env.LLM_API_KEY ? (process.env.LLM_BASE_URL || 'https://api.mistral.ai/v1') : 'mock://llm',
  LLM_MODEL: process.env.LLM_MODEL || 'mistral-small-latest',
  GLOBAL_MONTHLY_CAP: process.env.GLOBAL_MONTHLY_CAP || '5000',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('mock://')) {
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: mockAnswer(body.messages) } }] }), { headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // Übungs-Modell als OpenAI-kompatibler Endpunkt, z. B. für "wrangler dev" mit LLM_BASE_URL=http://localhost:8787/mock-llm/v1
    if (url.pathname === '/mock-llm/v1/chat/completions' && req.method === 'POST') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: mockAnswer(body.messages) } }] }));
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const r = await worker.fetch(request, env, null);
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') { res.writeHead(302, { Location: '/demo/' }); return res.end(); }
    if (p === '/jenaisystems-chat.js') p = '/assistant/widget/jenaisystems-chat.js';
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root) || /\/(\.|node_modules)/.test(file.slice(root.length))) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(e.code === 'ENOENT' ? 'Nicht gefunden' : 'Fehler');
  }
}).listen(PORT, () => console.log(`JenAiSystems Testserver: http://localhost:${PORT}  (Demo: /demo/  Fragebogen: /onboarding/fragebogen.html  Website: /site/)${env.LLM_BASE_URL.startsWith('mock') ? '  [Übungsmodus ohne KI-Modell]' : ''}`));
