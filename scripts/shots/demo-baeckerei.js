// Website: über den Knopf in der Live-Demo-Sektion die Bäckerei-Demo öffnen und eine Frage stellen
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.documentElement.style.scrollBehavior = 'auto';
  let host; for (let i = 0; i < 50 && !host; i++) { host = document.querySelector('[data-jenaisystems]'); await wait(100); }
  const r = host.shadowRoot;
  document.getElementById('demo').scrollIntoView(); await wait(200);
  document.querySelector('[data-jenaisystems-open="demo"]').click(); await wait(300);
  r.querySelector('.consent .btn').click(); await wait(200);
  const chip = [...r.querySelectorAll('[data-log="demo"] .chip')].find((c) => /glutenfrei/.test(c.textContent)); chip.click();
  for (let i = 0; i < 50 && r.querySelector('.typing'); i++) await wait(100);
  await wait(300);
  return r.querySelectorAll('[data-log="demo"] .m').length + ' Nachrichten, Modus ' + r.querySelector('.mode[aria-pressed="true"]').textContent;
})()
