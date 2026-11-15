'use strict';
/* Kleine Uhr auf den Zweitbildschirmen – nur zum Anschauen, Klicks gehen durch */
const pos = new URLSearchParams(location.search).get('pos') || 'tl';
const hud = document.getElementById('hud');
hud.className = (pos.includes('r') ? 'r' : 'l') + (pos.includes('b') ? ' b' : '');

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function tick() {
  const now = new Date();
  $('time').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  $('day').textContent = now.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
tick();
setTimeout(() => { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);

/* Neue Nachrichten kurz einblenden */
let known = null;
const badges = new Map();
const queue = [];
let showing = false;

function keyOf(x) { return x.kind === 'window' ? 'w' + x.h + ':' + (x.attention ? 'a' : '') + x.badge : 'n' + x.id; }

function showNext() {
  if (showing || !queue.length) return;
  showing = true;
  const x = queue.shift();
  const p = $('peek');
  const ic = x.icon ? `<img src="${esc(x.icon)}" alt="">` : esc((x.app || '?').charAt(0));
  const text = x.kind === 'window'
    ? (x.attention ? 'möchte deine Aufmerksamkeit' : x.badge + ' neu') + (x.title ? ' · ' + x.title : '')
    : [x.title, x.body].filter(Boolean).join(' – ');
  p.className = 'peek' + (x.kind === 'window' && x.attention ? ' attn' : '');
  p.innerHTML = `<span class="p-ic">${ic}</span><span class="p-b"><span class="p-app">${esc(x.app)}</span><span class="p-t">${esc(text)}</span></span>`;
  requestAnimationFrame(() => p.classList.add('show'));
  setTimeout(() => {
    p.classList.remove('show');
    setTimeout(() => { showing = false; showNext(); }, 450);
  }, 7000);
}

function update(N) {
  if (!N) return;
  const live = N.live || [];
  const items = N.items || [];
  const attn = live.some((w) => w.attention);
  const ind = $('ind');
  ind.className = 'ind' + (N.unread ? ' on' : '') + (attn ? ' attn' : '');
  $('cnt').textContent = N.unread > 9 ? '9+' : String(N.unread || '');

  const all = [...live, ...items];
  if (known === null) { known = new Set(all.map(keyOf)); live.forEach((w) => badges.set(w.h, w.badge || 0)); return; } // beim Start nichts einblenden
  for (const x of all) {
    const k = keyOf(x);
    if (known.has(k)) continue;
    known.add(k);
    if (x.kind === 'window') {
      const before = badges.get(x.h) || 0;
      badges.set(x.h, x.badge || 0);
      if (x.attention || (x.badge || 0) > before) queue.push(x);
    } else if (x.unread) queue.push(x);
  }
  if (queue.length > 3) queue.splice(0, queue.length - 3);
  showNext();
}

window.gx.notifications().then(update).catch(() => {});
window.gx.on('notifications', update);
