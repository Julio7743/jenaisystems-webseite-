// Zur Live-Demo-Sektion scrollen und einen Telefon-Beispielanruf ohne Animation zeigen
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.documentElement.style.scrollBehavior = 'auto';
  const y = document.getElementById('demo').getBoundingClientRect().top + scrollY - 72;
  window.scrollTo(0, y); await wait(400);
  return 'scrollY ' + Math.round(scrollY);
})()
