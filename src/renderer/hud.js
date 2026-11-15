'use strict';
/* Mini-Leiste auf den Zweitbildschirmen: Uhr · Nachrichten · offene Fenster */
const $ = (id) => document.getElementById(id);
const hud = $('hud');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cleanTitle = (t) => String(t || '').replace(/^\s*[(\[]\d+[)\]]\s*/, '');

/* Größe an das Hauptprogramm melden – das Fenster ist immer genau so groß wie der Inhalt */
new ResizeObserver(() => { const r = hud.getBoundingClientRect(); window.gx.hudSize(r.width, r.height, $('bar').offsetHeight + 8); }).observe(hud);

/* Uhr */
function tick() {
  const now = new Date();
  $('time').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  $('day').textContent = now.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
tick();
setTimeout(() => { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);

/* Klicken = aufklappen, Ziehen = verschieben */
let down = null, dragging = false;
const bar = $('bar');
bar.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  down = { x: e.screenX, y: e.screenY };
  dragging = false;
  bar.setPointerCapture(e.pointerId);
});
bar.addEventListener('pointermove', (e) => {
  if (!down || dragging) return;
  if (Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) > 5) { dragging = true; bar.classList.add('dragging'); window.gx.hudDrag(true); }
});
const up = () => {
  if (!down) return;
  if (dragging) window.gx.hudDrag(false); else toggle();
  down = null; dragging = false; bar.classList.remove('dragging');
};
bar.addEventListener('pointerup', up);
bar.addEventListener('pointercancel', up);

let open = false;
function toggle(force) {
  open = force === undefined ? !open : force;
  hud.classList.toggle('open', open);
  window.gx.hudExpand(open);
  if (open) loadWindows();
}

/* Offene Fenster */
const icons = {};
async function loadWindows() {
  let wins = [];
  try { wins = await window.gx.windows(); } catch {}
  const multi = new Set(wins.map((w) => w.mon).filter(Boolean)).size > 1;
  $('list').innerHTML = wins.length ? wins.map((w) => {
    const ic = icons[w.path];
    return `<div class="win${w.attention ? ' attn' : ''}" data-h="${w.h}" title="${esc(w.title)}">
      <span class="w-ic${ic ? ' img' : ''}" data-p="${esc(w.path || '')}">${ic ? `<img src="${esc(ic)}" alt="">` : esc(cleanTitle(w.title).charAt(0) || '?')}</span>
      <span class="w-t">${esc(cleanTitle(w.title))}</span>
      ${w.badge ? `<span class="w-b">${w.badge > 99 ? '99+' : w.badge}</span>` : ''}
      ${multi && w.mon ? `<span class="w-m">${w.mon}</span>` : ''}
      <span class="w-x" data-close="${w.h}" title="Schließen">×</span></div>`;
  }).join('') : '<div class="empty">Keine Fenster geöffnet.</div>';
  for (const w of wins) {
    if (!w.path || w.path in icons) continue;
    icons[w.path] = null;
    window.gx.fileIcon(w.path).then((u) => {
      icons[w.path] = u;
      if (u) document.querySelectorAll(`.w-ic[data-p="${CSS.escape(w.path)}"]`).forEach((el) => { el.classList.add('img'); el.innerHTML = `<img src="${u}" alt="">`; });
    }).catch(() => {});
  }
}
$('list').addEventListener('click', async (e) => {
  const x = e.target.closest('[data-close]');
  if (x) { await window.gx.closeWindow(+x.dataset.close).catch(() => {}); setTimeout(loadWindows, 400); return; }
  const row = e.target.closest('.win');
  if (row) { toggle(false); window.gx.focusWindow(+row.dataset.h).catch(() => {}); }
});
$('lib').addEventListener('click', () => { toggle(false); window.gx.appWindow('front').catch(() => {}); });

/* Verblassen, wenn die Maus auf diesem Bildschirm arbeitet */
window.gx.on('hud', (m) => {
  if (!m) return;
  if (m.mode) hud.classList.toggle('dim', m.mode === 'dim' && !open);
  if (m.collapse) toggle(false);
  if ('flip' in m) hud.classList.toggle('flip', !!m.flip);
});
window.gx.on('windows', () => { if (open) loadWindows(); });

/* Nachrichten: Zähler + neue kurz einblenden */
let known = null;
const badges = new Map();
const queue = [];
let showing = false;
const keyOf = (x) => (x.kind === 'window' ? 'w' + x.h + ':' + (x.attention ? 'a' : '') + x.badge : 'n' + x.id);

function showNext() {
  if (showing || !queue.length) return;
  showing = true;
  const x = queue.shift();
  const p = $('peek');
  const ic = x.icon ? `<img src="${esc(x.icon)}" alt="">` : esc((x.app || '?').charAt(0));
  const text = x.kind === 'window'
    ? (x.attention ? 'möchte deine Aufmerksamkeit' : x.badge + ' neu') + (x.title ? ' · ' + x.title : '')
    : [x.title, x.body].filter(Boolean).join(' – ');
  p.className = 'peek vis' + (x.kind === 'window' && x.attention ? ' attn' : '');
  p.innerHTML = `<span class="p-ic">${ic}</span><span class="p-b"><span class="p-app">${esc(x.app)}</span><span class="p-t">${esc(text)}</span></span>`;
  hud.classList.add('peeking');
  requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('show')));
  setTimeout(() => {
    p.classList.remove('show');
    setTimeout(() => { p.className = 'peek'; hud.classList.remove('peeking'); showing = false; showNext(); }, 400);
  }, 7000);
}

function update(N) {
  if (!N) return;
  const live = N.live || [];
  const items = N.items || [];
  $('ind').className = 'ind' + (N.unread ? ' on' : '') + (live.some((w) => w.attention) ? ' attn' : '');
  $('cnt').textContent = N.unread > 9 ? '9+' : String(N.unread || '');
  const all = [...live, ...items];
  if (known === null) { known = new Set(all.map(keyOf)); live.forEach((w) => badges.set(w.h, w.badge || 0)); return; }
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
