(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let host; for (let i = 0; i < 40 && !host; i++) { host = document.querySelector('[data-jenaisystems]'); await wait(100); }
  const r = host.shadowRoot;
  r.querySelector('.fab').click(); await wait(300);
  r.querySelector('.consent .btn').click(); await wait(200);
  const ask = async (q) => { const t = r.querySelector('textarea'); t.value = q; r.querySelector('form').requestSubmit(); for (let i = 0; i < 50 && r.querySelector('.typing'); i++) await wait(100); await wait(200); };
  await ask('Habt ihr glutenfreies Brot?');
  await ask('Wann habt ihr samstags offen?');
  return r.querySelectorAll('.m').length + ' Nachrichten';
})()
