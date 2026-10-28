// Frage-Knopf in der Live-Demo-Sektion: öffnet die Bäckerei-Demo und stellt die Frage nach dem KI-Hinweis
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.documentElement.style.scrollBehavior = 'auto';
  let host; for (let i = 0; i < 50 && !host; i++) { host = document.querySelector('[data-jenaisystems]'); await wait(100); }
  const r = host.shadowRoot;
  document.querySelector('.try-chip[data-jenaisystems-ask*="Torte"]').click(); await wait(200);
  r.querySelector('.consent .btn').click(); await wait(100);
  for (let i = 0; i < 50 && r.querySelector('.typing'); i++) await wait(100);
  await wait(200);
  const msgs = [...r.querySelectorAll('[data-log="demo"] .m')].map((m) => m.textContent.slice(0, 40));
  return 'Modus ' + r.querySelector('.mode[aria-pressed="true"]').textContent + ' | ' + msgs.join(' / ');
})()
