(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let host; for (let i = 0; i < 40 && !host; i++) { host = document.querySelector('[data-jenaisystems]'); await wait(100); }
  host.shadowRoot.querySelector('.fab').click(); await wait(400);
  return 'offen';
})()
