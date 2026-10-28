// Umschalten prüfen: JenAiSystems fragen -> Demo -> zurück; Verläufe bleiben getrennt
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.documentElement.style.scrollBehavior = 'auto';
  let host; for (let i = 0; i < 50 && !host; i++) { host = document.querySelector('[data-jenaisystems]'); await wait(100); }
  const r = host.shadowRoot, out = [];
  const ask = async (q) => { r.querySelector('textarea').value = q; r.querySelector('form').requestSubmit(); for (let i = 0; i < 50 && r.querySelector('.typing'); i++) await wait(100); await wait(150); };
  r.querySelector('.fab').click(); await wait(200);
  r.querySelector('.consent .btn').click(); await wait(150);
  await ask('Was kostet eine Website?');
  out.push('main:' + r.querySelectorAll('[data-log="main"] .m').length);
  r.querySelector('.mode[data-mode="demo"]').click(); await wait(150);
  await ask('Habt ihr glutenfreies Brot?');
  out.push('demo:' + r.querySelectorAll('[data-log="demo"] .m').length + ' banner:' + !!r.querySelector('[data-log="demo"] .banner') + ' title:' + r.querySelector('#ja-title').textContent + ' foot:' + r.querySelector('.foot').textContent);
  r.querySelector('.foot .lk').click(); await wait(150);
  out.push('zurück:' + r.querySelector('#ja-title').textContent + ' mainLog sichtbar:' + !r.querySelector('[data-log="main"]').hidden + ' main:' + r.querySelectorAll('[data-log="main"] .m').length + ' foot:' + r.querySelector('.foot').textContent);
  return out.join(' | ');
})()
