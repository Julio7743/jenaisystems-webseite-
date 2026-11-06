/* Immer über HTTPS: Wird die Seite per http:// geöffnet (z. B. eingetippte Adresse in Safari), sofort auf https:// wechseln.
   Sonst lehnt der Chat-Dienst die Anfrage ab, und das Formular wäre unverschlüsselt. */
if (location.protocol === 'http:' && /(^|\.)jenaisystems\.com$/.test(location.hostname)) {
  location.replace('https://' + location.host + location.pathname + location.search + location.hash);
}
/* JenAiSystems – Startseite. Ausgelagert aus index.html, damit die Content-Security-Policy keine Inline-Skripte erlauben muss. */
/* ============================================================
   KONTAKT-EINSTELLUNGEN – nur hier ändern (Datei site/main.js):
   - email:   wird überall angezeigt (Kontakt, Fußzeile, mailto). Später möglich: info@jenaisystems.com als
              Weiterleitung auf dieses Postfach.
   - telefon: leer = Telefonnummer und Anrufen-Knopf werden nirgends angezeigt.
   - WEB3FORMS_ACCESS_KEY: Schlüssel für den Formular-Versand über Web3Forms (kein Konto nötig):
              1. https://web3forms.com öffnen, bei "Create your Access Key" die Postfach-Adresse eingeben, an die Formular-Mails gehen sollen.
              2. Web3Forms schickt den Schlüssel an dieses Postfach (Format wie 12345678-abcd-...).
              3. Den Schlüssel unten statt 'WEB3FORMS_ACCESS_KEY' eintragen – fertig.
              Eingetragen am 31.10.2026. Steht hier wieder 'WEB3FORMS_ACCESS_KEY', öffnet das Formular das E-Mail-Programm (mailto).
              Klappt das Senden nicht, springt das Formular automatisch auf mailto zurück.
              WICHTIG: Web3Forms als Empfänger/Auftragsverarbeiter in der Datenschutzerklärung nennen.
   ============================================================ */
/* KI-CHAT – Adresse des Cloudflare-Workers (nur hier eintragen, z. B. 'https://jenaisystems-assistant.<konto>.workers.dev').
   Leer = gleiche Adresse wie die Seite (lokaler Testserver). Nach dem Eintragen dieselbe Adresse in der
   Content-Security-Policy (connect-src) in index.html ergänzen – ein Test prüft, dass beides passt. */
var CHAT_ENDPOINT = 'https://jenaisystems-assistant.jenaisystems.workers.dev';
window.JENAI_CHAT_ENDPOINT = CHAT_ENDPOINT;

var WEB3FORMS_ACCESS_KEY = 'dd0572f7-260e-4e5d-9ceb-30e66d1606f6'; // öffentlicher Web3Forms-Schlüssel (Formular-Mails gehen an das Postfach von JenAiSystems)
var KONTAKT = {
  email: 'info@jenaisystems.com',
  telefon: '+49 157 34425980',
  formular: { endpoint: 'https://api.web3forms.com/submit', accessKey: WEB3FORMS_ACCESS_KEY }
};
(function(){
  var K=KONTAKT;
  [].forEach.call(document.querySelectorAll('[data-k="email"]'),function(a){a.href='mailto:'+K.email;a.textContent=K.email});
  [].forEach.call(document.querySelectorAll('[data-k="telefon"]'),function(a){a.href='tel:'+K.telefon.replace(/[^\d+]/g,'');a.textContent=K.telefon});
  [].forEach.call(document.querySelectorAll('[data-k="telefon-btn"]'),function(a){a.href='tel:'+K.telefon.replace(/[^\d+]/g,'');a.setAttribute('aria-label','Anrufen: '+K.telefon)});
  [].forEach.call(document.querySelectorAll('[data-k-wrap="telefon"]'),function(el){el.hidden=!K.telefon});

  var b=document.querySelector('.menu-btn'),m=document.getElementById('menu');
  b.addEventListener('click',function(){var o=m.classList.toggle('open');b.setAttribute('aria-expanded',o);b.setAttribute('aria-label',o?'Menü schließen':'Menü öffnen')});
  m.addEventListener('click',function(e){if(e.target.tagName==='A'){m.classList.remove('open');b.setAttribute('aria-expanded','false')}});
  document.getElementById('y').textContent=new Date().getFullYear();

  // Buttons mit data-thema wählen das passende Thema im Formular vor
  var sel=document.getElementById('f-topic');
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-thema]');if(a)sel.value=a.getAttribute('data-thema')});

  var f=document.getElementById('contact-form'),n=document.getElementById('f-note');
  var aktiv=!!(K.formular.endpoint&&K.formular.accessKey&&K.formular.accessKey!=='WEB3FORMS_ACCESS_KEY');
  f.elements.access_key.value=aktiv?K.formular.accessKey:'';
  if(aktiv)n.textContent='Ihre Nachricht wird direkt an mich gesendet.';
  function g(id){return document.getElementById(id).value.trim()}
  function mailto(){
    var body='Name: '+g('f-name')+'\nUnternehmen: '+g('f-firma')+'\nE-Mail: '+g('f-mail')+'\nTelefon: '+g('f-tel')+'\n\n'+g('f-msg');
    location.href='mailto:'+K.email+'?subject='+encodeURIComponent('Anfrage über JenAiSystems: '+g('f-topic'))+'&body='+encodeURIComponent(body);
    n.style.color='';n.textContent='Ihr E-Mail-Programm sollte sich jetzt öffnen. Falls nicht, schreiben Sie direkt an '+K.email+'.';
  }
  f.addEventListener('submit',function(e){
    e.preventDefault();
    if(!g('f-name')||!/^\S+@\S+\.\S+$/.test(g('f-mail'))){n.textContent='Bitte geben Sie Ihren Namen und eine gültige E-Mail-Adresse an.';n.style.color='#b3261e';return}
    if(!document.getElementById('f-ok').checked){n.textContent='Bitte bestätigen Sie kurz den Hinweis zum Datenschutz.';n.style.color='#b3261e';return}
    if(f.botcheck.checked)return; // Spam-Falle: echte Besucher sehen dieses Feld nicht
    if(!aktiv||!window.fetch){mailto();return}
    var data={access_key:K.formular.accessKey,subject:'Anfrage über JenAiSystems: '+g('f-topic'),from_name:'JenAiSystems Website',name:g('f-name'),betrieb:g('f-firma'),email:g('f-mail'),telefon:g('f-tel'),thema:g('f-topic'),nachricht:g('f-msg'),botcheck:f.botcheck.checked};
    n.style.color='';n.textContent='Wird gesendet …';
    fetch(K.formular.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)})
      .then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j.success===false)throw 0})})
      .then(function(){f.reset();n.textContent='Danke! Ihre Nachricht ist angekommen – ich melde mich persönlich bei Ihnen.'})
      .catch(function(){n.style.color='#b3261e';n.textContent='Das Senden hat leider nicht geklappt. Ich öffne stattdessen Ihr E-Mail-Programm …';setTimeout(mailto,1200)});
  });
})();

// Telefon-Demo: spielt Beispielanrufe der Offline-Engine (P0) als Text ab. Daten: scripts/build-site.mjs
(function(){
  var box=document.getElementById('telefon-demo'); if(!box) return;
  var data; try{data=JSON.parse(document.getElementById('telefon-demo-daten').textContent)}catch(e){return}
  var tabs=box.querySelector('.tel-tabs'),log=box.querySelector('.tel-log'),sum=box.querySelector('.tel-sum'),pre=sum.querySelector('pre');
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,timer;
  function line(m){var d=document.createElement('div');d.className='tl '+(m.rolle==='bot'?'bot':'caller');var w=document.createElement('small');w.textContent=m.rolle==='bot'?'KI-Telefonassistent':'Anrufer (Beispiel)';var t=document.createElement('p');t.textContent=m.text;d.appendChild(w);d.appendChild(t);log.appendChild(d);log.scrollTop=log.scrollHeight}
  function show(sc,animate){
    clearTimeout(timer);log.textContent='';pre.textContent=sc.zusammenfassung;sum.open=false;sum.hidden=true;
    [].forEach.call(tabs.children,function(b){b.setAttribute('aria-pressed',b.dataset.id===sc.id?'true':'false')});
    var i=0;(function next(){if(i>=sc.verlauf.length){sum.hidden=false;if(!animate)log.scrollTop=0;return}line(sc.verlauf[i++]);if(animate&&!still)timer=setTimeout(next,i===1?900:1100);else next()})();
  }
  data.szenarien.forEach(function(sc){var b=document.createElement('button');b.type='button';b.className='tel-tab';b.dataset.id=sc.id;b.textContent=sc.titel;b.addEventListener('click',function(){show(sc,true)});tabs.appendChild(b)});
  show(data.szenarien[0],false);
})();

// Foto-Platzhalter: fehlt img/julian.jpg, wird das Bild entfernt und der neutrale Umriss bleibt sichtbar
[].forEach.call(document.querySelectorAll('.photo img'),function(img){
  function weg(){img.remove()}
  if(img.complete&&img.naturalWidth===0)weg();else img.addEventListener('error',weg);
});
