/*! JenAiSystems Chat-Widget – ohne Abhängigkeiten.
 * Einbinden (vor </body>):
 *   <script src="https://IHR-WORKER/jenaisystems-chat.js"
 *           data-client="kunden-id" data-endpoint="https://IHR-WORKER" defer></script>
 * Optionale Attribute (überschreiben die Server-Einstellungen):
 *   data-color="#8a4b1f" data-name="Korni" data-phone="..." data-email="..." data-privacy="https://.../datenschutz"
 *   data-contact="#kontakt"   (Link „Kontaktformular“ in der Fußzeile)
 *   data-position="left"  (Standard: rechts)
 * Demo-Modus (z. B. auf der JenAiSystems-Website):
 *   data-demo="beispiel"                 zweiter, ERFUNDENER Beispiel-Betrieb, umschaltbar im Chatfenster
 *   data-main-label="JenAiSystems"          Beschriftung des eigenen Assistenten im Umschalter
 *   data-demo-label="Demo: Bäckerei"     Beschriftung des Demo-Assistenten im Umschalter
 *   Steuerung von der Seite aus: <button data-jenaisystems-open="demo">…</button> bzw. ="main",
 *   mit Frage: <button data-jenaisystems-open="demo" data-jenaisystems-ask="Habt ihr glutenfreies Brot?">…</button>
 *   oder per Script: window.JenAiSystemsChat.open('demo' | 'main', 'Frage …')
 * Es werden keine Cookies gesetzt und nichts im Browser gespeichert. Der Verlauf existiert nur, solange die Seite offen ist.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || window.__jenaisystemsChat) return;
  window.__jenaisystemsChat = true;
  var ds = script.dataset;
  var clientId = ds.client;
  // data-endpoint="" bedeutet: gleiche Adresse wie die Seite (z. B. lokaler Testserver)
  var endpoint = (ds.endpoint != null ? ds.endpoint : '').replace(/\/$/, '');
  if (!clientId) { console.warn('JenAiSystems: data-client fehlt'); return; }

  function baseCfg(primary) {
    return {
      assistantName: (primary && ds.name) || 'Assistent', greeting: '', color: (primary && ds.color) || '#0f1c2e',
      phone: (primary && ds.phone) || '', email: (primary && ds.email) || '', contactUrl: (primary && ds.contact) || '',
      privacyUrl: ds.privacy || '', du: false, name: '', beispiel: false, suggestions: []
    };
  }
  // Ein Zustand pro Assistent: eigener Verlauf, eigenes Nachrichtenfenster, eigene Einstellungen.
  var states = { main: { key: 'main', id: clientId, cfg: baseCfg(true), history: [], busy: false, greeted: false } };
  var demoId = ds.demo && ds.demo !== clientId ? ds.demo : '';
  if (demoId) states.demo = { key: 'demo', id: demoId, cfg: baseCfg(false), history: [], busy: false, greeted: false };
  var active = states.main;
  var consent = false;
  var pending = null; // Frage von der Seite, die nach dem KI-Hinweis gestellt wird

  var host = document.createElement('div');
  host.setAttribute('data-jenaisystems', '');
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var left = ds.position === 'left';

  var css = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.wrap{position:fixed;' + (left ? 'left' : 'right') + ':20px;bottom:20px;z-index:2147483000;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#141b26}',
    '.fab{display:flex;align-items:center;gap:10px;border:0;border-radius:999px;padding:12px 18px 12px 14px;background:var(--c);color:#fff;font:600 15px/1 inherit;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px -8px rgba(0,0,0,.45)}',
    '.fab:focus-visible,button:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #f3a83b;outline-offset:2px}',
    '.fab svg{width:22px;height:22px}',
    '.panel{position:absolute;bottom:0;' + (left ? 'left' : 'right') + ':0;width:380px;max-width:calc(100vw - 40px);height:600px;max-height:calc(100vh - 40px);background:#fff;border-radius:18px;box-shadow:0 18px 50px -12px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}',
    '.panel[hidden],.form[hidden],.foot[hidden],.fab[hidden],.log[hidden],.modes[hidden]{display:none}',
    '.head{background:var(--c);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px;transition:background .2s}',
    '.av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;font-weight:700;flex:none}',
    '.ti{flex:1;min-width:0}.ti b{display:block;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ti small{opacity:.85;font-size:12.5px}',
    '.x{background:transparent;border:0;color:#fff;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:22px;line-height:1;flex:none}',
    '.x:hover{background:rgba(255,255,255,.15)}',
    '.modes{display:flex;gap:6px;padding:8px 10px;background:#fff;border-bottom:1px solid #e6e3dc}',
    '.mode{flex:1 1 auto;min-width:0;border:1px solid #d9d5cc;background:#fff;color:#3b4250;border-radius:999px;padding:7px 10px;font:600 13px/1.2 inherit;font-family:inherit;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mode[aria-pressed="true"]{background:var(--c);border-color:var(--c);color:#fff}',
    '.mode .tag{display:inline-block;margin-left:5px;padding:1px 6px;border-radius:999px;background:#fbe7c6;color:#7a4b06;font-size:11px;font-weight:700;vertical-align:1px}',
    '.log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f6f5f2}',
    '.m{max-width:85%;padding:9px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}',
    '.m.a{background:#fff;border:1px solid #e6e3dc;border-bottom-left-radius:4px;align-self:flex-start}',
    '.m.u{background:var(--c);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}',
    '.m a{color:inherit;text-decoration:underline}',
    '.banner{background:#fff6e5;border:1px solid #f1d9ae;color:#5d4a2a;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45}',
    '.banner b{color:#7a4b06}',
    '.sugg{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:100%}',
    '.chip{border:1px solid #d9d5cc;background:#fff;color:#141b26;border-radius:999px;padding:6px 11px;font:500 13px/1.3 inherit;font-family:inherit;cursor:pointer;text-align:left}',
    '.chip:hover{border-color:var(--c)}',
    '.typing{align-self:flex-start;color:#5d6574;font-size:13px;padding:4px 6px}',
    '.consent{margin:auto 0 0;background:#fff;border:1px solid #e6e3dc;border-radius:14px;padding:14px;font-size:13.5px;color:#333}',
    '.consent p{margin:0 0 10px}.consent a{color:inherit}',
    '.btn{display:inline-block;border:0;border-radius:10px;padding:10px 14px;background:var(--c);color:#fff;font:600 14px/1.2 inherit;font-family:inherit;cursor:pointer}',
    '.form{display:flex;gap:8px;padding:10px;border-top:1px solid #e6e3dc;background:#fff}',
    'textarea{flex:1;resize:none;border:1px solid #cfcac0;border-radius:12px;padding:10px 12px;font:15px/1.4 inherit;font-family:inherit;max-height:110px;min-height:44px;color:#141b26}',
    '.send{width:44px;height:44px;border-radius:12px;padding:0;display:grid;place-items:center;flex:none}',
    '.send:disabled{opacity:.5;cursor:default}',
    '.foot{padding:7px 12px 10px;font-size:12.5px;color:#5d6574;background:#fff;display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;align-items:center}',
    '.foot a{color:inherit}',
    '.lk{background:none;border:0;padding:0;color:inherit;font:inherit;text-decoration:underline;cursor:pointer}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    // Kompakt auf dem Handy (data-compact-mobile="true"): nur ein rundes Symbol, erscheint erst nach dem Scrollen.
    '@media (max-width:760px){:host([data-compact]) .fab{width:52px;height:52px;padding:0;justify-content:center}:host([data-compact]) .fl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}:host([data-compact]) .fab{transition:opacity .2s,transform .2s}:host([data-compact][data-away]) .fab{opacity:0;transform:translateY(12px);pointer-events:none}}',
    '@media (max-width:520px){.wrap{right:12px;left:auto;bottom:12px}.panel{position:fixed;inset:0;width:auto;max-width:none;height:auto;max-height:none;border-radius:0}}',
    '@media (prefers-reduced-motion:no-preference){.panel{animation:pop .18s ease-out}@keyframes pop{from{opacity:0;transform:translateY(8px)}}}'
  ].join('\n');

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>';
  var SEND = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  root.innerHTML = '<style>' + css + '</style>' +
    '<div class="wrap">' +
      '<button class="fab" type="button" aria-haspopup="dialog" aria-expanded="false">' + ICON + '<span class="fl">Fragen? Chat</span></button>' +
      '<div class="panel" role="dialog" aria-modal="false" aria-labelledby="ja-title" hidden>' +
        '<div class="head"><div class="av" aria-hidden="true"></div><div class="ti"><b id="ja-title"></b><small class="sub">KI-Assistent · antwortet automatisch</small></div>' +
        '<button class="x" type="button" aria-label="Chat schließen">×</button></div>' +
        '<div class="modes" role="group" aria-label="Assistent wählen" hidden>' +
          '<button class="mode" type="button" data-mode="main" aria-pressed="true"></button>' +
          '<button class="mode" type="button" data-mode="demo" aria-pressed="false"></button>' +
        '</div>' +
        '<div class="log" data-log="main" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="log" data-log="demo" role="log" aria-live="polite" aria-relevant="additions" hidden></div>' +
        '<form class="form" hidden><label class="sr" for="ja-in">Ihre Frage</label>' +
          '<textarea id="ja-in" rows="1" maxlength="800" placeholder="Ihre Frage …"></textarea>' +
          '<button class="btn send" type="submit" aria-label="Senden">' + SEND + '</button></form>' +
        '<div class="foot"></div>' +
      '</div>' +
    '</div>';

  var $ = function (s) { return root.querySelector(s); };
  var wrap = $('.wrap'), fab = $('.fab'), panel = $('.panel'), form = $('.form'), input = $('textarea'), sendBtn = $('.send'), modes = $('.modes');
  states.main.log = $('[data-log="main"]');
  if (states.demo) states.demo.log = $('[data-log="demo"]');

  function link(href, text) { var a = document.createElement('a'); a.href = href; a.textContent = text; if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; } return a; }

  function label(st) {
    if (st.key === 'main') return ds.mainLabel || st.cfg.name || st.cfg.assistantName;
    return ds.demoLabel || ('Demo: ' + (st.cfg.name || st.cfg.assistantName));
  }

  // Kopf, Farben, Fußzeile und Umschalter an den aktiven Assistenten anpassen.
  function applyCfg() {
    var cfg = active.cfg;
    wrap.style.setProperty('--c', cfg.color);
    $('#ja-title').textContent = cfg.assistantName;
    $('.sub').textContent = active.key === 'demo' || cfg.beispiel ? 'Demo · erfundener Betrieb · KI' : 'KI-Assistent · antwortet automatisch';
    $('.av').textContent = (cfg.assistantName || 'A').trim().charAt(0).toUpperCase();
    input.placeholder = cfg.du ? 'Deine Frage …' : 'Ihre Frage …';
    $('label.sr').textContent = cfg.du ? 'Deine Frage' : 'Ihre Frage';
    if (states.demo) {
      modes.hidden = false;
      var mb = modes.querySelectorAll('.mode');
      for (var i = 0; i < mb.length; i++) {
        var st = states[mb[i].getAttribute('data-mode')];
        mb[i].textContent = label(st);
        if (st.key === 'demo') { var tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'erfunden'; mb[i].appendChild(tag); }
        mb[i].setAttribute('aria-pressed', st === active ? 'true' : 'false');
      }
    }
    var foot = $('.foot'); foot.textContent = ''; foot.hidden = false;
    if (active.key === 'demo') {
      var s = document.createElement('span'); s.textContent = 'Erfundenes Beispiel – Kontaktdaten sind nicht echt.'; foot.appendChild(s);
      var back = document.createElement('button'); back.type = 'button'; back.className = 'lk'; back.textContent = 'Zurück zu ' + label(states.main);
      back.addEventListener('click', function () { setMode('main'); });
      foot.appendChild(back);
      return;
    }
    var lead = document.createElement('span'); lead.textContent = 'Lieber persönlich?'; foot.appendChild(lead);
    if (cfg.phone) foot.appendChild(link('tel:' + cfg.phone.replace(/[^\d+]/g, ''), 'Anrufen'));
    if (cfg.email) foot.appendChild(link('mailto:' + cfg.email, 'E-Mail'));
    if (cfg.contactUrl) foot.appendChild(link(cfg.contactUrl, 'Kontaktformular'));
    if (!cfg.phone && !cfg.email && !cfg.contactUrl) foot.hidden = true;
  }

  // Text sicher darstellen: nur URLs, E-Mails und Telefonnummern werden zu Links.
  function render(el, text) {
    var re = /(https?:\/\/[^\s)]+[^\s).,;:!?])|([\w.+-]+@[\w-]+\.[\w.-]*\w)|((?:\+\d|\b0\d)[\d\s/-]{6,}\d)/g, last = 0, m;
    while ((m = re.exec(text))) {
      el.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) el.appendChild(link(m[1], m[1]));
      else if (m[2]) el.appendChild(link('mailto:' + m[2], m[2]));
      else el.appendChild(link('tel:' + m[3].replace(/[^\d+]/g, ''), m[3]));
      last = re.lastIndex;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
  }

  function add(st, role, text) {
    var d = document.createElement('div');
    d.className = 'm ' + (role === 'user' ? 'u' : 'a');
    render(d, text);
    st.log.appendChild(d); st.log.scrollTop = st.log.scrollHeight;
    return d;
  }

  function greet(st) {
    if (st.greeted) return;
    st.greeted = true;
    if (st.key === 'demo' || st.cfg.beispiel) {
      var b = document.createElement('div'); b.className = 'banner';
      var t = document.createElement('b'); t.textContent = 'Live-Demo: ';
      b.appendChild(t);
      b.appendChild(document.createTextNode('So würde der Assistent auf der Website eines Betriebs antworten. „' + (st.cfg.name || st.cfg.assistantName) + '“ ist frei erfunden, alle Angaben sind Beispieldaten.'));
      st.log.appendChild(b);
    }
    var cfg = st.cfg;
    add(st, 'assistant', cfg.greeting || ('Hallo! Ich bin ' + cfg.assistantName + ', eine KI. Wie kann ich helfen?'));
    var list = (cfg.suggestions || []).slice(0, 4);
    if (list.length) {
      var box = document.createElement('div'); box.className = 'sugg';
      list.forEach(function (q) {
        var c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = q;
        c.addEventListener('click', function () { ask(st, q); });
        box.appendChild(c);
      });
      st.log.appendChild(box); st.sugg = box;
    }
  }

  function showConsent() {
    var box = document.createElement('div'); box.className = 'consent';
    var p = document.createElement('p');
    var du = active.cfg.du;
    p.textContent = du
      ? 'Hier antwortet eine KI, kein Mensch. Deine Nachrichten werden zur Beantwortung an einen KI-Dienst übertragen und von uns nicht gespeichert. Die Antworten können Fehler enthalten. Bitte gib keine sensiblen Daten (z. B. Gesundheits- oder Bankdaten) ein.'
      : 'Hier antwortet eine KI, kein Mensch. Ihre Nachrichten werden zur Beantwortung an einen KI-Dienst übertragen und von uns nicht gespeichert. Die Antworten können Fehler enthalten. Bitte geben Sie keine sensiblen Daten (z. B. Gesundheits- oder Bankdaten) ein.';
    box.appendChild(p);
    var privacy = states.main.cfg.privacyUrl;
    if (privacy) { var p2 = document.createElement('p'); p2.appendChild(link(privacy, 'Mehr in der Datenschutzerklärung')); box.appendChild(p2); }
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Verstanden, Chat starten';
    b.addEventListener('click', function () {
      consent = true; box.remove(); form.hidden = false;
      greet(active);
      if (pending) { var q = pending; pending = null; ask(active, q); }
      input.focus();
    });
    box.appendChild(b); active.log.appendChild(box);
    setTimeout(function () { b.focus(); }, 30);
  }

  function setMode(key) {
    var st = states[key] || states.main;
    if (st !== active) {
      var c = active.log.querySelector('.consent');
      active.log.hidden = true;
      active = st;
      active.log.hidden = false;
      if (c) active.log.appendChild(c); // Hinweis wandert mit, bis er bestätigt ist
    }
    applyCfg();
    sendBtn.disabled = active.busy;
    if (consent) { greet(active); if (!panel.hidden) input.focus(); }
  }

  function open(key, question) {
    if (key) setMode(key);
    panel.hidden = false; fab.hidden = true; fab.setAttribute('aria-expanded', 'true');
    if (question) { if (consent) ask(active, String(question).slice(0, 800)); else pending = String(question).slice(0, 800); }
    if (!consent && !root.querySelector('.consent')) showConsent(); else if (consent) input.focus();
  }
  function close() { panel.hidden = true; fab.hidden = false; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }

  function ask(st, q) {
    if (!q || st.busy) return;
    if (st.sugg) { st.sugg.remove(); st.sugg = null; }
    add(st, 'user', q);
    st.history.push({ role: 'user', content: q });
    st.busy = true; if (st === active) sendBtn.disabled = true;
    var t = document.createElement('div'); t.className = 'typing'; t.textContent = st.cfg.assistantName + ' schreibt …'; st.log.appendChild(t);
    st.log.scrollTop = st.log.scrollHeight;
    fetch(endpoint + '/api/chat?client=' + encodeURIComponent(st.id), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: st.id, messages: st.history.slice(-8) })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        var text = d.reply || 'Das hat leider nicht geklappt. Bitte versuchen Sie es gleich noch einmal.';
        add(st, 'assistant', text);
        if (d.reply && !d.error) st.history.push({ role: 'assistant', content: text });
      })
      .catch(function () { add(st, 'assistant', 'Keine Verbindung. Bitte später erneut versuchen' + (st.cfg.phone && st.key === 'main' ? ' oder anrufen: ' + st.cfg.phone : '') + '.'); })
      .then(function () { t.remove(); st.busy = false; if (st === active) { sendBtn.disabled = false; input.focus(); } });
  }

  fab.addEventListener('click', function () { open(); });
  if (ds.compactMobile === 'true') {
    host.setAttribute('data-compact', '');
    var covered = false;
    var away = function () { if (covered || window.scrollY < window.innerHeight * 0.6) host.setAttribute('data-away', ''); else host.removeAttribute('data-away'); };
    // Über Formularen und Knöpfen mit data-jenaisystems-hide ausblenden, damit nichts verdeckt wird
    var hideEls = document.querySelectorAll('[data-jenaisystems-hide]');
    if (hideEls.length && window.IntersectionObserver) {
      var seen = new Set();
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); }); covered = seen.size > 0; away(); });
      [].forEach.call(hideEls, function (el) { io.observe(el); });
    }
    away(); window.addEventListener('scroll', away, { passive: true });
  }
  $('.x').addEventListener('click', close);
  modes.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.mode'); if (b) setMode(b.getAttribute('data-mode')); });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } });
  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || active.busy) return;
    input.value = ''; input.style.height = '';
    ask(active, q);
  });

  // Von der Seite aus steuerbar (z. B. Knopf „Demo starten“).
  window.JenAiSystemsChat = { open: function (key, question) { open(key === 'demo' && states.demo ? 'demo' : key ? 'main' : null, question); }, close: close };
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-jenaisystems-open]');
    if (!el) return;
    e.preventDefault();
    window.JenAiSystemsChat.open(el.getAttribute('data-jenaisystems-open') || 'main', el.getAttribute('data-jenaisystems-ask'));
  });

  // Einstellungen vom Server laden; data-Attribute haben Vorrang (nur für den Haupt-Assistenten).
  function load(st) {
    return fetch(endpoint + '/api/config?client=' + encodeURIComponent(st.id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) { if (c) Object.keys(c).forEach(function (k) { if (c[k] !== '' && c[k] != null) st.cfg[k] = c[k]; }); })
      .catch(function () {});
  }
  Promise.all([load(states.main), states.demo ? load(states.demo) : null]).then(function () {
    var cfg = states.main.cfg;
    if (ds.name) cfg.assistantName = ds.name; if (ds.color) cfg.color = ds.color;
    if (ds.phone) cfg.phone = ds.phone; if (ds.email) cfg.email = ds.email; if (ds.privacy) cfg.privacyUrl = ds.privacy;
    if (ds.contact) cfg.contactUrl = ds.contact;
    if (states.demo) states.demo.cfg.beispiel = true; // Demo ist immer als erfunden gekennzeichnet
    applyCfg(); document.body.appendChild(host);
  });
})();
