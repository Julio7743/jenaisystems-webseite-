// Zur Telefon-Demo scrollen und den Notfall-Anruf (ohne Animation) zeigen
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.documentElement.style.scrollBehavior = 'auto';
  const el = document.getElementById('telefon-demo');
  window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 90); await wait(300);
  return 'Szenarien: ' + el.querySelectorAll('.tel-tab').length + ', Zeilen: ' + el.querySelectorAll('.tl').length;
})()
