'use strict';
/* Bibliothek – Oberfläche */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (o) => esc(JSON.stringify(o));

const IS_COMPANION = new URLSearchParams(location.search).get('companion');
const S = {
  state: null,
  view: 'home',
  gameFilter: 'all',
  showHidden: false,
  folderPath: null,
  folderRoot: null,
  folderItems: null,
  inbox: null,
  sys: null,
  vol: null,
  wins: [],
  winIcons: {},
};

/* ───────── Symbole ───────── */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>',
  games: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.9 7.2a2.5 2.5 0 0 0 4.4 2L9 16h6l2.8 1.8a2.5 2.5 0 0 0 4.4-2l-.9-7.2a4 4 0 0 0-4-3.6z"/></svg>',
  apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/></svg>',
  vol: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  mute: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
  wifi: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/></svg>',
  power: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
  dots: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  restart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/></svg>',
  crest: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 2 L36 9 V20 C36 29 29 35 20 38 C11 35 4 29 4 20 V9 Z" stroke="#d6b268" stroke-width="1.5"/><path d="M20 7 L31 12 V20 C31 26.5 26.5 31 20 33.5 C13.5 31 9 26.5 9 20 V12 Z" fill="#1b1712" stroke="#6e5a32"/><path d="M20 12 L24 20 L20 28 L16 20 Z" fill="#d6b268"/></svg>',
  goldFolder: '<svg width="52" height="44" viewBox="0 0 24 20" aria-hidden="true"><path d="M1 3a2 2 0 0 1 2-2h5l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#3a2f1c" stroke="#a8853f" stroke-width=".8"/><path d="M1 7h22v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#4e3e22" stroke="#d6b268" stroke-width=".8"/></svg>',
};
const path = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

const TOOLS = [
  ['sound', 'Ton', 'Geräte, Lautstärke, Mikro', 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12'],
  ['display', 'Anzeige', 'Auflösung, Monitore, HDR', 'M3 4h18v12H3z M8 20h8 M12 16v4'],
  ['network', 'Netzwerk', 'LAN, WLAN, VPN', 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5v.01'],
  ['bluetooth', 'Bluetooth', 'Headset, Maus, Controller', 'M7 7l10 10-5 5V2l5 5L7 17'],
  ['control', 'Systemsteuerung', 'Klassische Steuerung', 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M16 4v4 M10 10v4 M18 16v4'],
  ['taskmgr', 'Task-Manager', 'Prozesse, Leistung', 'M3 12h4l3-8 4 16 3-8h4'],
  ['devmgr', 'Geräte-Manager', 'Treiber, Hardware', 'M7 7h10v10H7z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4'],
  ['update', 'Windows Update', 'Updates suchen', 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v4h-4'],
  ['explorer', 'Datei-Explorer', 'Nur das Fenster', 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  ['apps', 'Apps verwalten', 'Installieren, entfernen', 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
  ['printers', 'Drucker', 'Drucker & Scanner', 'M6 9V3h12v6 M6 18H4v-7h16v7h-2 M6 14h12v7H6z'],
  ['storage', 'Speicher', 'Laufwerke, aufräumen', 'M3 12h18 M5 5h14l2 7v7H3v-7z M17 16h.01'],
];

const SOURCES = [['steam', 'Steam'], ['battlenet', 'Battle.net'], ['epic', 'Epic Games'], ['riot', 'Riot'], ['gog', 'GOG'], ['programs', 'Startmenü-Programme']];

/* ───────── Formatierung ───────── */
function fmtPlay(sec) {
  if (!sec) return '–';
  const h = sec / 3600;
  if (h >= 1) return Math.round(h).toLocaleString('de-DE') + ' Std.';
  return Math.max(1, Math.round(sec / 60)) + ' Min.';
}
function fmtWhen(ts) {
  if (!ts) return 'Noch nie';
  const d = new Date(ts);
  const now = new Date();
  const day = 864e5;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (ts >= startToday) return 'Heute, ' + time;
  if (ts >= startToday - day) return 'Gestern, ' + time;
  const days = Math.floor((startToday - ts) / day) + 1;
  if (days < 7) return 'Vor ' + days + ' Tagen';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return b.toLocaleString('de-DE', { maximumFractionDigits: b < 10 ? 1 : 0 }) + ' ' + u[i];
}
const IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

/* ───────── Daten ───────── */
const games = (all) => (S.state ? S.state.games.filter((g) => all || S.showHidden || !g.hidden) : []);
const programs = (all) => (S.state ? S.state.programs.filter((p) => all || S.showHidden || !p.hidden) : []);
const byRecent = (a, b) => (b.running - a.running) || (b.lastPlayed - a.lastPlayed) || (b.favorite - a.favorite) || a.name.localeCompare(b.name, 'de');
const gameById = (id) => S.state.games.find((g) => g.id === id);
const progById = (id) => S.state.programs.find((p) => p.id === id);

function toast(text, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'error' ? ' error' : '');
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
async function act(promise, okText) {
  try { const r = await promise; if (okText) toast(okText); return r; } catch (e) { toast(e.message, 'error'); return null; }
}

/* ───────── Cover ───────── */
function coverCard(g, opts = {}) {
  const srcs = (g.art && g.art.cover) || [];
  const img = srcs.length ? `<img alt="" data-srcs="${attr(srcs)}" src="${esc(srcs[0])}" loading="lazy">` : '';
  return `<button class="cover-card" data-act="${opts.act || 'game'}" data-id="${esc(g.id)}" aria-label="${esc(g.name)}">
    ${GXArt.cover(g.name)}${img}
    <div class="cap"><div class="cap-title">${esc(g.name)}</div><div class="cap-sub">${esc(opts.sub || g.sourceName)}</div></div>
    ${g.running ? '<div class="flag run">Läuft</div>' : g.isNew ? '<div class="flag">Neu</div>' : ''}
    ${g.favorite ? `<div class="fav">${I.star}</div>` : ''}
  </button>`;
}

// Bildquellen der Reihe nach probieren; klappt keine, bleibt die Szene sichtbar
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.srcs) return;
  const list = JSON.parse(img.dataset.srcs);
  const i = list.indexOf(img.getAttribute('src'));
  if (i >= 0 && i + 1 < list.length) img.src = list[i + 1];
  else { const card = img.closest('.cover-card'); img.remove(); if (card) card.classList.remove('has-img'); }
}, true);
document.addEventListener('load', (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.dataset.srcs) {
    const card = img.closest('.cover-card');
    if (card) card.classList.add('has-img');
  }
}, true);

/* ───────── Seitenleiste ───────── */
function renderSide() {
  const st = S.state;
  const nav = (key, label, icon, extra = '') => `<button class="nav${S.view === key ? ' active' : ''}" data-act="nav" data-view="${key}">${icon}${label}${extra}</button>`;
  const inboxCount = S.inbox ? S.inbox.items.filter((f) => Date.now() - f.mtime < 3 * 864e5).length : 0;
  $('#side').innerHTML = `
    <div class="brand">${I.crest}<div style="min-width:0"><div class="brand-name">${esc(ownerName() || 'Meine')}</div><div class="brand-sub">Bibliothek</div></div></div>
    <div class="side-label">Bibliothek</div>
    ${nav('home', 'Start', I.home)}
    ${nav('games', 'Spiele', I.games, `<span class="count">${games().length}</span>`)}
    ${nav('programs', 'Programme', I.apps, `<span class="count">${programs().length}</span>`)}
    ${nav('folders', 'Ordner', I.folder)}
    <div class="side-label gap">Ablage</div>
    ${nav('inbox', 'Eingangskorb', I.inbox, inboxCount ? `<span class="badge">${inboxCount}</span>` : '')}
    <div class="side-spacer"></div>
    ${nav('settings', 'Einstellungen', I.gear)}
    <div class="profile">
      <div class="avatar">${esc((ownerName() || (st ? st.user : '?')).charAt(0).toUpperCase())}</div>
      <div style="min-width:0"><div class="profile-name">${esc(ownerName() || (st ? st.user : ''))}</div>
      <div class="profile-sub"><span class="dot"></span>${esc(st ? st.computer : '')}</div></div>
    </div>`;
}

/* ───────── Kopfzeile ───────── */
function renderTop() {
  const v = S.vol;
  const now = new Date();
  const winChips = S.wins.slice(0, 7).map((w) => {
    const ic = S.winIcons[w.path];
    return `<button class="win-chip" data-act="win-focus" data-h="${w.h}" title="${esc(w.title)}">${ic ? `<img src="${ic}" alt="">` : '<span class="ph"></span>'}<span class="t">${esc(w.title)}</span>${multiMon() && w.mon ? `<span class="mon" title="Bildschirm ${w.mon}">${w.mon}</span>` : ''}<span class="x" data-act="win-close" data-h="${w.h}" title="Schließen">×</span></button>`;
  }).join('');
  $('#top').innerHTML = `
    <button class="search-btn" data-act="search">${I.search}<span class="grow">Einfach lostippen – Spiele, Programme …</span><span class="kbd">Strg K</span></button>
    <div class="wins">${S.wins.length ? '<span class="wins-label">Geöffnet</span>' + winChips : ''}</div>
    <div class="tray">
      <button class="tray-btn" data-act="vol-pop" aria-label="Lautstärke">${v && v.mute ? I.mute : I.vol}${v ? v.vol : ''}</button>
      <button class="tray-btn" data-act="tool" data-key="network" aria-label="Netzwerk">${I.wifi}</button>
      <div class="tray-sep"></div>
      <button class="tray-btn" data-act="power-pop" aria-label="Ein/Aus">${I.power}</button>
    </div>
    <div class="clock"><div class="clock-time">${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="clock-date">${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>`;
}

/* ───────── Startseite ───────── */
function renderHome() {
  const list = games().sort(byRecent);
  const hero = list[0];
  const recentProgs = programs().slice().sort((a, b) => (b.favorite - a.favorite) || (b.launches - a.launches) || (b.last - a.last) || a.name.localeCompare(b.name, 'de')).slice(0, 6);
  const newItems = [...games().filter((g) => g.isNew).map((g) => ({ g })), ...programs().filter((p) => p.isNew).map((p) => ({ p }))].slice(0, 3);
  const folders = (S.state.config.folders || []).slice(0, 4);
  const inbox = S.inbox ? S.inbox.items.slice(0, 3) : [];

  let heroHtml;
  if (hero) {
    const castle = hero.art && hero.art.scene === 'castle';
    const heroSrcs = (hero.art && hero.art.hero) || [];
    const stats = [
      ['Zuletzt gespielt', fmtWhen(hero.lastPlayed)],
      ['Spielzeit gesamt', hero.playSec ? fmtPlay(hero.playSec) : 'Wird ab jetzt erfasst'],
    ];
    if (hero.wowCharacter) stats.push(['Letzter Charakter', hero.wowCharacter.name + (hero.wowCharacter.realm ? ' · ' + hero.wowCharacter.realm : '')]);
    else stats.push(['Plattform', hero.sourceName]);
    heroHtml = `<section class="hero">
      ${GXArt.hero(hero.name, castle)}
      ${heroSrcs.length ? `<img class="bg" alt="" data-srcs="${attr(heroSrcs)}" src="${esc(heroSrcs[0])}">` : ''}
      <div class="hero-body">
        <div class="hero-tag"><b>${hero.running ? 'Läuft gerade' : hero.lastPlayed ? 'Weiterspielen' : 'Entdecken'}</b><i></i>${esc(hero.sourceName)}</div>
        <h1>${esc(hero.name)}</h1>
        <div class="hero-stats">${stats.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
        <div class="hero-actions">
          ${hero.running ? '<span class="running-pill"><span class="dot"></span>Läuft</span>' : `<button class="btn gold big" data-act="play" data-id="${esc(hero.id)}">${I.play}Spielen</button>`}
          <button class="icon-btn" style="width:50px;height:50px;background:rgba(15,13,10,.6);border-color:#5a4a2a;color:var(--gold-light)" data-act="detail" data-id="${esc(hero.id)}" aria-label="Details">${I.dots}</button>
          <span class="note">${esc(launchHint(hero))}</span>
        </div>
      </div>
    </section>`;
  } else {
    heroHtml = `<section class="hero">${GXArt.hero('Bibliothek', true)}<div class="hero-body">
      <div class="hero-tag"><b>Willkommen</b></div><h1>${S.state.scanning ? 'Bibliothek wird eingelesen …' : 'Noch keine Spiele gefunden'}</h1>
      <div class="hero-stats"><div class="stat"><span>Gesucht in</span><span>Steam · Battle.net · Epic · Riot · GOG</span></div></div>
      <div class="hero-actions"><button class="btn gold big" data-act="rescan">${I.refresh}Neu einlesen</button></div></div></section>`;
  }

  const sys = S.sys;
  const meter = (label, value, pct) => `<div><div class="meter-row"><span>${esc(label)}</span><span>${esc(value)}</span></div><div class="meter"><div style="width:${Math.max(0, Math.min(100, pct))}%"></div></div></div>`;
  const sysHtml = sys ? [
    meter('CPU', sys.cpu + ' %', sys.cpu),
    sys.gpu ? meter('GPU · ' + sys.gpu.name, sys.gpu.util + ' % · ' + sys.gpu.temp + ' °C', sys.gpu.util) : '',
    meter('Arbeitsspeicher', (sys.ramUsed / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' / ' + Math.round(sys.ramTotal / 1073741824) + ' GB', 100 * sys.ramUsed / sys.ramTotal),
  ].join('') : '<div class="muted">Wird gemessen …</div>';

  const newHtml = newItems.length ? newItems.map(({ g, p }) => g
    ? `<button class="mini-item" data-act="detail" data-id="${esc(g.id)}"><div class="mi-thumb">${GXArt.cover(g.name)}${g.art.cover && g.art.cover[0] ? `<img alt="" data-srcs="${attr(g.art.cover)}" src="${esc(g.art.cover[0])}" style="position:absolute;inset:0">` : ''}</div><div><div class="mi-title">${esc(g.name)}</div><div class="mi-sub">Spiele · ${esc(g.sourceName)}</div></div></button>`
    : `<button class="mini-item" data-act="prog" data-id="${esc(p.id)}"><div class="mi-icon">${p.icon ? `<img src="${p.icon}" alt="">` : `<span class="mono">${esc(p.name.charAt(0))}</span>`}</div><div><div class="mi-title">${esc(p.name)}</div><div class="mi-sub">Programme</div></div></button>`).join('')
    : '<div class="muted" style="font-size:12.5px;line-height:1.5">Sobald du etwas installierst, taucht es hier automatisch auf.</div>';

  $('#view').innerHTML = `<div class="home">
    <div class="home-top">
      ${heroHtml}
      <aside class="side-col">
        <div class="panel widget" style="flex-grow:1"><div class="widget-head"><span class="eyebrow">System</span><span class="r">${esc(S.state.computer)}</span></div>${sysHtml}</div>
        <div class="panel widget" style="height:150px;gap:10px"><div class="widget-head"><span class="eyebrow">Neu erkannt</span><span class="r">automatisch</span></div>${newHtml}</div>
      </aside>
    </div>
    <section style="margin-top:22px">
      <div class="section-head"><h2>Deine Spiele</h2><span class="sub">Zuletzt gespielt</span><span class="grow"></span><a data-act="nav" data-view="games">Alle ${games().length} anzeigen</a></div>
      <div class="shelf" style="grid-template-columns:repeat(${Math.min(8, Math.max(5, list.length))}, minmax(0, 1fr))">${list.slice(0, 8).map((g) => coverCard(g)).join('') || '<div class="muted">Keine Spiele gefunden.</div>'}</div>
    </section>
    <div class="home-bottom" style="margin-top:22px">
      <section class="panel"><div class="widget-head"><h2 class="eyebrow">Programme</h2><a class="r" data-act="nav" data-view="programs" style="margin-left:auto;font-size:12px">Alle ${programs().length}</a></div>
        <div class="chip-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${recentProgs.map((p) => `<button class="chip" data-act="prog" data-id="${esc(p.id)}">${p.icon ? `<img src="${p.icon}" alt="">` : `<span class="mono">${esc(p.name.charAt(0))}</span>`}<span class="t">${esc(p.name)}</span></button>`).join('')}</div></section>
      <section class="panel"><div class="widget-head"><h2 class="eyebrow">Ordner</h2><a class="r" data-act="nav" data-view="folders" style="margin-left:auto;font-size:12px">Alle anzeigen</a></div>
        <div class="chip-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${folders.map((f) => `<button class="chip" data-act="folder-go" data-path="${esc(f.path)}"><span style="color:var(--gold);display:flex">${I.folder.replace('<svg ', '<svg width="17" height="17" ')}</span><span class="t">${esc(f.name)}</span></button>`).join('')}</div></section>
      <section class="panel" style="gap:8px"><div class="widget-head"><h2 class="eyebrow">Eingangskorb</h2><a class="r" data-act="nav" data-view="inbox" style="margin-left:auto;font-size:12px">Öffnen</a></div>
        ${inbox.length ? inbox.map((f) => `<div class="inbox-row"><span class="ext">${esc((f.ext || '?').slice(1, 5))}</span><span class="nm">${esc(f.name)}</span><span class="to">${f.destLabel ? '→ ' + esc(f.destLabel) : esc(f.cat)}</span></div>`).join('') : '<div class="muted" style="font-size:12.5px">Downloads sind aufgeräumt.</div>'}
      </section>
    </div>
  </div>`;
}

function launchHint(g) {
  if (g.launchCustom) return 'Eigener Startbefehl';
  if (g.source === 'steam') return 'Startet über Steam';
  if (g.art && g.art.scene === 'castle') return g.hasBnet ? 'Öffnet Battle.net – dort auf „Spielen“ klicken' : 'Startet direkt';
  if (g.source === 'battlenet') return g.launchNote || 'Startet über Battle.net im Hintergrund';
  if (g.source === 'epic') return 'Startet über Epic im Hintergrund';
  if (g.source === 'riot') return 'Startet über den Riot Client';
  return '';
}

/* ───────── Spiele ───────── */
function renderGames() {
  const all = games();
  const counts = {};
  all.forEach((g) => { counts[g.source] = (counts[g.source] || 0) + 1; });
  const favCount = all.filter((g) => g.favorite).length;
  let list = all;
  if (S.gameFilter === 'fav') list = all.filter((g) => g.favorite);
  else if (S.gameFilter !== 'all') list = all.filter((g) => g.source === S.gameFilter);
  list = list.slice().sort(byRecent);
  const pill = (key, label, n) => `<button class="pill" data-act="filter" data-f="${key}" aria-pressed="${S.gameFilter === key}">${label}<span class="n">${n}</span></button>`;
  const hiddenCount = S.state.games.filter((g) => g.hidden).length;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>Spiele</h1><div class="sub">Automatisch erkannt – nur was wirklich auf diesem PC installiert ist.</div></div><span class="grow"></span>
      ${hiddenCount ? `<button class="btn small quiet" data-act="toggle-hidden">${S.showHidden ? 'Ausgeblendete verbergen' : hiddenCount + ' ausgeblendet anzeigen'}</button>` : ''}
      <button class="btn small quiet" data-act="rescan">${S.state.scanning ? '<span class="spin"></span>' : I.refresh}Neu einlesen</button></div>
    <div class="filters">${pill('all', 'Alle', all.length)}${favCount ? pill('fav', 'Favoriten', favCount) : ''}${SOURCES.filter(([k]) => counts[k]).map(([k, l]) => pill(k, l, counts[k])).join('')}</div>
    ${list.length ? `<div class="shelf">${list.map((g) => coverCard(g, { sub: g.running ? 'Läuft' : g.lastPlayed ? fmtWhen(g.lastPlayed) : g.sourceName })).join('')}</div>`
      : `<div class="empty"><h3>Hier ist noch nichts</h3>${S.state.scanning ? 'Bibliothek wird eingelesen …' : 'Keine Spiele in dieser Auswahl.'}</div>`}`;
}

/* ───────── Programme ───────── */
const CAT_ORDER = ['ki', 'gaming', 'chat', 'web', 'media', 'create', 'dev', 'office', 'tools', 'other', 'windows'];
const catLabel = (k) => (S.state.categories && S.state.categories[k]) || k;
function progTile(p) {
  return `<button class="app-tile" data-act="prog" data-id="${esc(p.id)}" style="${p.hidden ? 'opacity:.45' : ''}">
    <span class="ic">${p.icon ? `<img src="${p.icon}" alt="">` : `<span class="mono">${esc(p.name.charAt(0))}</span>`}</span>
    <span style="min-width:0"><div class="t">${esc(p.name)}</div><div class="s">${p.favorite ? 'Favorit' : p.last ? 'Zuletzt ' + fmtWhen(p.last) : esc(catLabel(p.category))}</div></span>
    ${p.isNew ? '<span class="flag">Neu</span>' : p.favorite ? `<span class="fav" style="top:8px;right:10px">${I.star}</span>` : ''}</button>`;
}
function renderPrograms() {
  const all = programs();
  const q = (S.progQuery || '').trim().toLowerCase();
  const f = S.progFilter || 'all';
  const counts = {};
  all.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const favs = all.filter((p) => p.favorite);
  let list = all;
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
  if (f === 'fav') list = list.filter((p) => p.favorite);
  else if (f !== 'all') list = list.filter((p) => p.category === f);
  const hiddenCount = S.state.programs.filter((p) => p.hidden).length;
  const pill = (key, label, n) => `<button class="pill" data-act="pfilter" data-f="${key}" aria-pressed="${f === key}">${esc(label)}<span class="n">${n}</span></button>`;
  const frequent = all.filter((p) => p.favorite || p.launches > 0).sort((a, b) => (b.favorite - a.favorite) || (b.launches - a.launches) || (b.last - a.last)).slice(0, 8);
  let body = '';
  if (!list.length) body = '<div class="empty"><h3>Nichts gefunden</h3>Keine Programme in dieser Auswahl.</div>';
  else if (f === 'all' && !q) {
    if (frequent.length) body += `<section class="prog-sec"><div class="section-head"><h2>Häufig genutzt</h2><span class="grow"></span></div><div class="app-grid">${frequent.map(progTile).join('')}</div></section>`;
    for (const k of CAT_ORDER) {
      const items = list.filter((p) => p.category === k).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      if (!items.length) continue;
      const collapsed = (k === 'windows' || k === 'other') && !(S.openCats || {})[k];
      body += `<section class="prog-sec"><div class="section-head"><h2>${esc(catLabel(k))}</h2><span class="sub">${items.length}</span><span class="grow"></span>
        ${collapsed || (S.openCats || {})[k] ? `<a data-act="cat-toggle" data-k="${k}">${collapsed ? 'Anzeigen' : 'Einklappen'}</a>` : ''}</div>
        ${collapsed ? '' : `<div class="app-grid">${items.map(progTile).join('')}</div>`}</section>`;
    }
  } else {
    body = `<div class="app-grid">${list.slice().sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name, 'de')).map(progTile).join('')}</div>`;
  }
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>Programme</h1><div class="sub">Automatisch sortiert. Rechtsklick: Favorit, Kategorie ändern oder Ausblenden.</div></div><span class="grow"></span>
      <label class="inline-search">${I.search}<input id="pq" placeholder="Programm suchen" value="${esc(S.progQuery || '')}" autocomplete="off" spellcheck="false"></label>
      ${hiddenCount ? `<button class="btn small quiet" data-act="toggle-hidden">${S.showHidden ? 'Ausgeblendete verbergen' : hiddenCount + ' ausgeblendet'}</button>` : ''}
      <button class="btn small quiet" data-act="rescan">${S.state.scanning ? '<span class="spin"></span>' : I.refresh}Neu einlesen</button></div>
    <div class="filters">${pill('all', 'Alle', all.length)}${favs.length ? pill('fav', 'Favoriten', favs.length) : ''}${CAT_ORDER.filter((k) => counts[k]).map((k) => pill(k, catLabel(k), counts[k])).join('')}</div>
    ${body}`;
  const pq = $('#pq');
  pq.addEventListener('input', () => { S.progQuery = pq.value; const pos = pq.selectionStart; renderPrograms(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); });
}

/* ───────── Ordner ───────── */
async function openFolder(p, root) {
  S.folderPath = p;
  if (root) S.folderRoot = root;
  S.folderItems = null;
  S.view = 'folders';
  render();
  S.folderItems = await act(gx.listFolder(p)) || [];
  if (S.view === 'folders' && S.folderPath === p) { renderFolders(); loadFileIcons(); }
}

function renderFolders() {
  const folders = S.state.config.folders || [];
  if (!S.folderPath && folders.length) { openFolder(folders[0].path, folders[0].path); return; }
  const root = S.folderRoot || S.folderPath || '';
  const rel = S.folderPath && root && S.folderPath.toLowerCase().startsWith(root.toLowerCase()) ? S.folderPath.slice(root.length).split(/[\\/]/).filter(Boolean) : [];
  const rootName = (folders.find((f) => f.path === root) || { name: root.split(/[\\/]/).pop() }).name;
  let acc = root;
  const crumbs = [`<button data-act="folder-go" data-path="${esc(root)}">${esc(rootName)}</button>`].concat(rel.map((seg) => {
    acc = acc.replace(/[\\/]+$/, '') + '\\' + seg;
    return `<span class="sep">›</span><button data-act="folder-go" data-path="${esc(acc)}">${esc(seg)}</button>`;
  })).join('');
  const items = S.folderItems;
  $('#view').innerHTML = `<div class="folders" style="height:100%">
    <aside class="panel folder-list">
      <div class="eyebrow" style="padding:4px 12px 10px">Deine Ordner</div>
      ${folders.map((f, i) => `<button class="folder-item" data-act="folder-root" data-path="${esc(f.path)}" aria-current="${f.path === root}"><span style="color:var(--gold);display:flex">${I.folder.replace('<svg ', '<svg width="18" height="18" ')}</span><span class="t">${esc(f.name)}</span><span class="rm" data-act="folder-remove" data-i="${i}" title="Entfernen">${I.x}</span></button>`).join('')}
      <button class="folder-item" data-act="folder-add" style="color:var(--gold)"><span style="display:flex">${I.plus}</span><span class="t">Ordner hinzufügen</span></button>
    </aside>
    <section class="panel folder-main">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <button class="icon-btn" style="width:38px;height:38px" data-act="folder-up" aria-label="Eine Ebene hoch" ${rel.length ? '' : 'disabled style="opacity:.4;width:38px;height:38px"'}>${I.up}</button>
        <div class="crumbs" style="margin:0;flex-grow:1">${crumbs}</div>
        ${S.folderPath ? `<button class="btn small quiet" data-act="open-path" data-path="${esc(S.folderPath)}">Im Explorer öffnen</button>` : ''}
      </div>
      <div class="file-grid">${items === null ? '<div class="muted">Lädt …</div>' : items.length ? items.map((f, i) => `<button class="file" data-act="file-open" data-i="${i}" title="${esc(f.name)}">
        <span class="fi" data-icon="${i}">${f.isDir ? I.goldFolder : IMG_EXT.test(f.name) ? `<img class="thumb" src="${esc(f.url)}" loading="lazy" alt="">` : ''}</span>
        <span class="fn">${esc(f.name)}</span></button>`).join('') : '<div class="muted">Dieser Ordner ist leer.</div>'}</div>
    </section></div>`;
}

async function loadFileIcons() {
  const items = S.folderItems || [];
  const path0 = S.folderPath;
  for (let i = 0; i < items.length; i++) {
    const f = items[i];
    if (f.isDir || IMG_EXT.test(f.name)) continue;
    const icon = await gx.fileIcon(f.path).catch(() => null);
    if (S.folderPath !== path0) return;
    const el = document.querySelector(`[data-icon="${i}"]`);
    if (el && icon) el.innerHTML = `<img src="${icon}" alt="">`;
  }
}

/* ───────── Eingangskorb ───────── */
async function loadInbox() {
  S.inbox = await gx.inbox().catch(() => null);
  if (S.view === 'inbox' || S.view === 'home') renderView();
  renderSide();
}

function renderInbox() {
  const ib = S.inbox;
  const items = ib ? ib.items : [];
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>Eingangskorb</h1><div class="sub">Neue Downloads – mit einem Klick an den richtigen Ort.</div></div><span class="grow"></span>
      ${ib ? `<button class="btn small quiet" data-act="open-path" data-path="${esc(ib.dir)}">Downloads öffnen</button>` : ''}</div>
    <section class="panel inbox-list">${items.length ? items.map((f, i) => `<div class="inbox-item">
      <span class="fi" data-iicon="${i}">${IMG_EXT.test(f.name) ? `<img class="thumb" src="${esc(f.url)}" loading="lazy" alt="">` : ''}</span>
      <div class="info"><div class="nm">${esc(f.name)}</div><div class="meta">${fmtSize(f.size)} · ${fmtWhen(f.mtime)}</div></div>
      <span class="cat">${esc(f.cat)}</span>
      ${f.destKey ? `<button class="btn small gold" data-act="inbox-move" data-i="${i}">Nach ${esc(f.destLabel)}</button>` : ''}
      <button class="btn small quiet" data-act="inbox-open" data-i="${i}">${f.cat === 'Installer' ? 'Ausführen' : 'Öffnen'}</button>
      <button class="btn small quiet" data-act="inbox-show" data-i="${i}">Zeigen</button>
    </div>`).join('') : '<div class="empty"><h3>Alles aufgeräumt</h3>Im Download-Ordner liegt nichts Neues.</div>'}</section>`;
  items.forEach(async (f, i) => {
    if (IMG_EXT.test(f.name)) return;
    const icon = await gx.fileIcon(f.path).catch(() => null);
    const el = document.querySelector(`[data-iicon="${i}"]`);
    if (el && icon) el.innerHTML = `<img src="${icon}" alt="">`;
  });
}

/* ───────── Einstellungen ───────── */
function renderSettings() {
  const c = S.state.config;
  const v = S.vol;
  const tg = (key, on, label, sub) => `<div class="set-row"><div class="l"><span>${label}</span><span>${sub}</span></div><button class="toggle" data-act="cfg-toggle" data-key="${key}" aria-pressed="${!!on}" aria-label="${esc(label)}"><span></span></button></div>`;
  const src = S.state.sources || {};
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>Einstellungen</h1><div class="sub">Alles, was du von Windows brauchst – ohne den Windows-Desktop.</div></div></div>
    <div class="settings">
      <div class="settings-left">
        <section class="panel" style="padding:18px 20px 20px">
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px"><h2 class="eyebrow">Windows-Funktionen</h2><span class="muted" style="font-size:12px">Öffnet nur das Fenster vor der Bibliothek – ohne Taskleiste</span></div>
          <div class="tool-grid">
            ${TOOLS.map(([k, t, s, d]) => `<button class="tool" data-act="tool" data-key="${k}"><span class="ic">${path(d)}</span><span style="min-width:0"><div class="t">${t}</div><div class="s">${s}</div></span></button>`).join('')}
            ${(c.customTiles || []).map((t, i) => `<button class="tool" data-act="custom-tile" data-i="${i}"><span class="ic" data-ticon="${i}">${I.apps.replace('<svg ', '<svg width="20" height="20" ')}</span><span style="min-width:0"><div class="t">${esc(t.name)}</div><div class="s">Eigene Kachel</div></span><span class="rm" data-act="tile-remove" data-i="${i}" title="Entfernen">${I.x}</span></button>`).join('')}
            <button class="tool add" data-act="tile-add"><span class="ic" style="color:var(--gold)">${I.plus}</span><span><div class="t">Eigene Kachel</div><div class="s">Programm oder Datei wählen</div></span></button>
          </div>
        </section>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px">
          <section class="panel" style="padding:18px 20px;display:flex;flex-direction:column;gap:16px">
            <h2 class="eyebrow">Audio</h2>
            ${v ? `<div><div style="display:flex;align-items:baseline;margin-bottom:12px"><span style="font-size:14px;font-weight:600">Lautstärke</span><span style="margin-left:auto;font-size:14px;font-weight:600;color:var(--gold-light)" id="volval">${v.vol} %</span></div>
              <input type="range" id="volrange" min="0" max="100" value="${v.vol}" aria-label="Lautstärke" style="width:100%;background:linear-gradient(90deg,var(--gold) ${v.vol}%,#221d15 ${v.vol}%)"></div>
              <div class="set-row" style="border-top:none"><div class="l"><span>Stumm</span><span>Ton komplett aus</span></div><button class="toggle" data-act="mute" aria-pressed="${!!v.mute}" aria-label="Stumm"><span></span></button></div>`
              : '<div class="muted">Lautstärke wird gelesen …</div>'}
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:auto">
              <button class="btn small quiet" data-act="tool" data-key="sound">Ausgabegerät</button>
              <button class="btn small quiet" data-act="tool" data-key="mixer">Lautstärkemixer</button>
            </div>
          </section>
          <section class="panel" style="padding:18px 20px;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;margin-bottom:8px"><h2 class="eyebrow">Bibliothek</h2><button class="btn small quiet" style="margin-left:auto" data-act="rescan">${S.state.scanning ? '<span class="spin"></span>' : I.refresh}Neu einlesen</button></div>
            ${SOURCES.map(([k, l]) => { const n = src[k]; const on = n > 0; return `<div class="source-row"><span class="source-dot${on ? '' : ' off'}"></span>${l}<span class="n">${n === undefined ? '…' : n < 0 ? 'Fehler' : n === 0 ? 'nicht gefunden' : n + (k === 'programs' ? ' Programme' : n === 1 ? ' Spiel' : ' Spiele')}</span></div>`; }).join('')}
            <div class="muted" style="font-size:11.5px;margin-top:10px">Zuletzt eingelesen: ${S.state.scannedAt ? fmtWhen(S.state.scannedAt) : '–'}. Neue Installationen erscheinen automatisch.</div>
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px"><span style="font-size:14px;font-weight:600">Cover für alle Spiele</span>${c.hasSgdbKey ? '<span class="cat" style="border-color:#4a5a32;color:#cfe6b8">aktiv</span>' : ''}</div>
              <div class="muted" style="font-size:11.5px;line-height:1.5;margin-bottom:10px">Für Battle.net, Riot, Epic & Co. holt die Bibliothek Cover von SteamGridDB. Dafür brauchst du einen kostenlosen Schlüssel: <a data-act="open-url" data-url="https://www.steamgriddb.com/profile/preferences/api">Schlüssel holen</a> (Anmeldung mit Steam).</div>
              <div class="row"><input class="field" id="sgdb" type="password" placeholder="${c.hasSgdbKey ? '•••••••• gespeichert' : 'API-Schlüssel einfügen'}" autocomplete="off" style="flex:1"><button class="btn small quiet" data-act="sgdb-save">Speichern</button></div>
              ${!c.hasSgdbKey ? '<div class="muted" style="font-size:11.5px;line-height:1.6;margin-top:10px">So geht\'s: Auf der Seite oben rechts mit Steam anmelden → „Generate API Key“ klicken → Schlüssel kopieren → hier einfügen → Speichern.</div>' : ''}
              ${S.state.artStatus && S.state.artStatus.total ? `<div style="font-size:12px;margin-top:10px;color:${S.state.artStatus.error && !S.state.artStatus.found ? 'var(--danger)' : 'var(--text-3)'}">${S.state.artStatus.busy ? '<span class="spin" style="width:10px;height:10px;vertical-align:-1px"></span> Suche Cover … ' : ''}Cover gefunden: ${S.state.artStatus.found} von ${S.state.artStatus.total} Spielen außerhalb von Steam${S.state.artStatus.error && !S.state.artStatus.busy ? ' · ' + esc(S.state.artStatus.error) : ''}</div>` : ''}
            </div>
          </section>
        </div>
      </div>
      <div class="settings-right">
        <section class="back-card">
          <h2>Zurück zu Windows</h2>
          <p>Die Bibliothek läuft im Hintergrund weiter. Zurück kommst du mit der <b>Windows-Taste</b>, über die linke untere Bildschirmecke oder ${esc(prettyKeys(c.shortcut))}.</p>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px">
            <button class="btn gold" data-act="app-window" data-a="minimize">Minimieren</button>
            <button class="btn" data-act="app-window" data-a="desktop">Desktop anzeigen</button>
          </div>
        </section>
        <section class="panel" style="padding:18px 22px;display:flex;flex-direction:column">
          <h2 class="eyebrow" style="margin-bottom:12px">Start</h2>
          <div class="seg" style="margin-bottom:8px">
            <button data-act="start-mode" data-m="off" aria-pressed="${c.startMode === 'off'}">Manuell</button>
            <button data-act="start-mode" data-m="autostart" aria-pressed="${c.startMode === 'autostart'}">Mit Windows</button>
            <button data-act="start-mode" data-m="shell" aria-pressed="${c.startMode === 'shell'}">Exklusiv</button>
          </div>
          <div class="muted" style="font-size:11.5px;line-height:1.5;margin-bottom:6px">${c.startMode === 'shell' ? 'Die Bibliothek ersetzt den Windows-Desktop. Nach der PIN erscheint direkt die Bibliothek.' : c.startMode === 'autostart' ? 'Die Bibliothek startet nach der Anmeldung automatisch – der Desktop ist kurz zu sehen.' : 'Die Bibliothek startet nur, wenn du sie öffnest.'}</div>
          ${tg('winKey', c.winKey, 'Windows-Taste', 'Schaltet zwischen Bibliothek und Spiel/Fenster hin und her')}
          ${tg('hideTaskbar', c.hideTaskbar, 'Taskleiste ausblenden', 'Auf allen Bildschirmen, solange die Bibliothek läuft')}
          ${multiMon() ? tg('companion', c.companion, 'Zweitbildschirme', 'Eigene Seite mit Schnellstart statt Windows-Hintergrund') : ''}
          ${tg('hotCorner', c.hotCorner, 'Ecke unten links', 'Maus in die Ecke holt die Bibliothek zurück (nicht beim Spielen)')}
        </section>
        <div class="power-grid">
          <button class="power-btn" data-act="power" data-a="lock">${I.lock}Sperren</button>
          <button class="power-btn" data-act="power" data-a="sleep">${I.moon}Energie sparen</button>
          <button class="power-btn" data-act="power" data-a="restart">${I.restart}Neu starten</button>
          <button class="power-btn danger" data-act="power" data-a="shutdown">${I.power}Herunterfahren</button>
        </div>
        <section class="panel" style="padding:18px 22px;display:flex;flex-direction:column;gap:14px">
          <h2 class="eyebrow">Profil &amp; Bildschirm</h2>
          <div><div class="muted" style="font-size:12px;margin-bottom:8px">Wie möchtest du genannt werden?</div>
            <div class="row"><input class="field" id="owner" value="${esc(c.ownerName || '')}" maxlength="24" style="flex:1"><button class="btn small quiet" data-act="owner-save">Speichern</button></div></div>
          ${multiMon() ? `<div><div class="muted" style="font-size:12px;margin-bottom:8px">Bibliothek anzeigen auf</div>
            <div class="seg">${S.state.displays.map((d) => `<button data-act="display" data-id="${d.id}" aria-pressed="${(c.displayId || S.state.displays.find((x) => x.primary).id) === d.id}">Bildschirm ${d.nr}${d.primary ? ' ★' : ''}</button>`).join('')}</div></div>` : ''}
        </section>
        <div class="muted" style="font-size:11.5px;text-align:center">Bibliothek ${esc(S.state.version)} · ${S.state.canUpdate ? '<a data-act="update">Nach Updates suchen</a> · ' : ''}<a data-act="app-window" data-a="quit">Beenden</a></div>
      </div>
    </div>`;
  (c.customTiles || []).forEach(async (t, i) => {
    const icon = await gx.fileIcon(t.target).catch(() => null);
    const el = document.querySelector(`[data-ticon="${i}"]`);
    if (el && icon) el.innerHTML = `<img src="${icon}" alt="">`;
  });
  const r = $('#volrange');
  if (r) {
    let t = null;
    r.addEventListener('input', () => {
      r.style.background = `linear-gradient(90deg,var(--gold) ${r.value}%,#221d15 ${r.value}%)`;
      $('#volval').textContent = r.value + ' %';
      clearTimeout(t);
      t = setTimeout(async () => { S.vol = await gx.volume('set', +r.value).catch(() => S.vol); renderTop(); }, 60);
    });
  }
}

const multiMon = () => S.state && S.state.displays && S.state.displays.length > 1;
const ownerName = () => (S.state && S.state.config.ownerName) || '';
const prettyKeys = (s) => String(s || '').replace('Control', 'Strg').replace(/\+/g, ' + ');

/* ───────── Overlays ───────── */
function openOverlay(html, onClose) {
  const ov = $('#overlay');
  ov.innerHTML = html;
  ov.hidden = false;
  ov._onClose = onClose;
  const first = ov.querySelector('input, button.btn, button');
  if (first) first.focus();
}
function closeOverlay() {
  const ov = $('#overlay');
  if (ov.hidden) return false;
  if (S.welcome) return true;
  ov.hidden = true;
  ov.innerHTML = '';
  if (ov._onClose) ov._onClose();
  return true;
}
$('#overlay').addEventListener('mousedown', (e) => { if (e.target.id === 'overlay') closeOverlay(); });

function confirmBox(title, html, okLabel, danger) {
  return new Promise((resolve) => {
    openOverlay(`<div class="modal confirm"><div class="modal-head"><h2>${esc(title)}</h2></div><div class="modal-body">${html}
      <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn quiet" id="cf-no">Abbrechen</button><button class="btn ${danger ? 'danger' : 'gold'}" id="cf-yes">${esc(okLabel)}</button></div></div></div>`, () => resolve(false));
    $('#cf-no').onclick = () => closeOverlay();
    $('#cf-yes').onclick = () => { $('#overlay')._onClose = null; closeOverlay(); resolve(true); };
    $('#cf-yes').focus();
  });
}

/* Erster Start: Name abfragen */
function openWelcome() {
  openOverlay(`<div class="modal welcome">
    <div class="welcome-art">${GXArt.hero('Bibliothek', true)}<div class="welcome-crest">${I.crest.replace('width="40" height="40"', 'width="72" height="72"')}</div></div>
    <div class="modal-body" style="padding:30px 36px 34px;display:flex;flex-direction:column;gap:18px">
      <div><div class="eyebrow" style="margin-bottom:10px">Willkommen</div><h2 class="h-display" style="font-size:30px">Deine Bibliothek</h2>
      <p class="muted" style="margin:10px 0 0;line-height:1.6">Spiele, Programme und Ordner – automatisch sortiert, an einem Ort.</p></div>
      <label style="display:flex;flex-direction:column;gap:10px"><span style="font-size:14px;font-weight:600">Wie möchtest du genannt werden?</span>
        <input class="field" id="wname" maxlength="24" placeholder="z. B. Gemix" autocomplete="off" spellcheck="false" style="height:50px;font-size:17px"></label>
      <div class="welcome-preview"><span id="wprev">Deine</span> <span class="wsub">Bibliothek</span></div>
      <button class="btn gold big" id="wgo" disabled style="opacity:.5">Los geht's</button>
    </div></div>`);
  const input = $('#wname');
  const go = $('#wgo');
  const upd = () => { const v = input.value.trim(); $('#wprev').textContent = v || 'Deine'; go.disabled = !v; go.style.opacity = v ? 1 : 0.5; };
  const done = async () => { const v = input.value.trim(); if (!v) return; await act(gx.setConfig({ ownerName: v })); S.welcome = false; closeOverlay(); };
  input.addEventListener('input', upd);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
  go.onclick = done;
  input.focus();
}

/* Spiel-Details */
function openDetail(id) {
  const g = gameById(id);
  if (!g) return;
  const l = g.launch || {};
  const launchText = l.kind === 'uri' ? l.target : [l.target].concat(l.args || []).join(' ');
  openOverlay(`<div class="modal detail"><div class="modal-head"><h2>${esc(g.name)}</h2><button class="icon-btn" style="width:38px;height:38px" data-act="close" aria-label="Schließen">${I.x}</button></div>
    <div class="modal-body"><div class="detail-grid">
      <div class="detail-cover">${coverCard(g, { act: 'noop' })}</div>
      <div class="detail-info">
        <div class="row">
          ${g.running ? '<span class="running-pill"><span class="dot"></span>Läuft gerade</span>' : `<button class="btn gold big" data-act="play" data-id="${esc(g.id)}">${I.play}Spielen</button>`}
          ${g.hasBnet && !(g.art && g.art.scene === 'castle') ? `<button class="btn" data-act="bnet" data-id="${esc(g.id)}">Battle.net öffnen</button>` : ''}
          <button class="btn quiet" data-act="g-fav" data-id="${esc(g.id)}">${I.star}${g.favorite ? 'Favorit entfernen' : 'Favorit'}</button>
        </div>
        <div class="kv">
          <span class="k">Plattform</span><span class="v">${esc(g.sourceName)}</span>
          <span class="k">Zuletzt gespielt</span><span class="v">${esc(fmtWhen(g.lastPlayed))}</span>
          <span class="k">Spielzeit</span><span class="v">${g.playSec ? esc(fmtPlay(g.playSec)) : 'Wird ab jetzt erfasst' + (g.source === 'steam' ? '' : ' (Battle.net & Co. speichern keine Spielzeit)')}</span>
          ${g.wowCharacter ? `<span class="k">Letzter Charakter</span><span class="v">${esc(g.wowCharacter.name)}${g.wowCharacter.realm ? ' · ' + esc(g.wowCharacter.realm) : ''}</span>` : ''}
          <span class="k">Ordner</span><span class="v"><a data-act="open-path" data-path="${esc(g.installDir)}">${esc(g.installDir || '–')}</a></span>
          <span class="k">Startbefehl</span><span class="v">${esc(launchText)}${g.launchCustom ? ' <span class="muted">(eigener)</span>' : ''}</span>
        </div>
        <div><div class="eyebrow" style="margin-bottom:8px">Name</div>
          <div class="row"><input class="field" id="g-name" value="${esc(g.name)}" style="flex:1"><button class="btn small quiet" data-act="g-rename" data-id="${esc(g.id)}">Speichern</button>${g.name !== g.originalName ? `<button class="btn small quiet" data-act="g-rename-reset" data-id="${esc(g.id)}">Original</button>` : ''}</div></div>
        <div class="row">
          <button class="btn small gold" data-act="art-pick" data-id="${esc(g.id)}">Bilder auswählen</button>
          <button class="btn small quiet" data-act="g-cover" data-id="${esc(g.id)}">Eigenes Bild</button>
          <button class="btn small quiet" data-act="g-hero" data-id="${esc(g.id)}">Titelbild wählen</button>
          <button class="btn small quiet" data-act="g-launch" data-id="${esc(g.id)}">Startprogramm ändern</button>
          ${g.launchCustom ? `<button class="btn small quiet" data-act="g-launch-reset" data-id="${esc(g.id)}">Start zurücksetzen</button>` : ''}
          <button class="btn small ${g.hidden ? 'quiet' : 'danger'}" data-act="g-hide" data-id="${esc(g.id)}">${g.hidden ? 'Wieder anzeigen' : 'Ausblenden'}</button>
        </div>
      </div>
    </div></div></div>`);
}

/* Bilder auswählen (SteamGridDB) */
async function openArtPicker(id) {
  const g = gameById(id);
  if (!g) return;
  const P = { id, term: '', games: [], sel: null, tab: 'cover', imgs: null, loading: true, error: null };
  const draw = () => {
    const list = P.imgs ? (P.tab === 'cover' ? P.imgs.covers : P.imgs.heroes) : [];
    $('#overlay').innerHTML = `<div class="modal picker"><div class="modal-head"><h2>Bilder für ${esc(g.name)}</h2><button class="icon-btn" style="width:38px;height:38px" data-act="close" aria-label="Schließen">${I.x}</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
        <div class="row"><input class="field" id="apq" value="${esc(P.term)}" placeholder="Spiel suchen" style="flex:1" autocomplete="off" spellcheck="false"><button class="btn small quiet" data-act="ap-search">Suchen</button></div>
        ${P.games.length ? `<div class="filters" style="margin:0">${P.games.map((x) => `<button class="pill" data-act="ap-game" data-gid="${x.id}" aria-pressed="${P.sel === x.id}">${esc(x.name)}${x.year ? `<span class="n">${x.year}</span>` : ''}</button>`).join('')}</div>` : ''}
        <div class="seg" style="width:320px"><button data-act="ap-tab" data-t="cover" aria-pressed="${P.tab === 'cover'}">Cover</button><button data-act="ap-tab" data-t="hero" aria-pressed="${P.tab === 'hero'}">Titelbild</button></div>
        <div class="pick-grid ${P.tab}">${P.loading ? '<div class="muted" style="padding:30px"><span class="spin"></span> Lade Bilder …</div>'
          : P.error ? `<div class="muted" style="padding:30px;color:var(--danger)">${esc(P.error)}</div>`
          : list.length ? list.map((x, i) => `<button class="pick" data-act="ap-pick" data-i="${i}"><img src="${esc(x.thumb)}" loading="lazy" alt=""></button>`).join('')
          : '<div class="muted" style="padding:30px">Keine Bilder gefunden. Probier einen anderen Suchbegriff.</div>'}</div>
        <div class="muted" style="font-size:11.5px">Bilder von SteamGridDB, sortiert nach Bewertung der Community. Klick auf ein Bild übernimmt es.</div>
      </div></div>`;
    $('#overlay').hidden = false;
    const q = $('#apq');
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ACTIONS['ap-search'](); } });
  };
  const loadGame = async (gid) => {
    P.sel = gid; P.loading = true; P.error = null; draw();
    try { P.imgs = await gx.artImages(gid); } catch (e) { P.error = e.message; }
    P.loading = false; draw();
  };
  const search = async (term) => {
    P.loading = true; P.error = null; P.imgs = null; draw();
    try {
      const r = await gx.artSearch(id, term);
      P.term = r.term; P.games = r.games;
      if (r.games.length) return loadGame(r.games[0].id);
      P.error = 'Kein Spiel mit diesem Namen gefunden.';
    } catch (e) { P.error = e.message; }
    P.loading = false; draw();
  };
  Object.assign(ACTIONS, {
    'ap-search': () => search($('#apq').value),
    'ap-game': (d) => loadGame(+d.gid),
    'ap-tab': (d) => { P.tab = d.t; draw(); },
    'ap-pick': async (d) => {
      const list = P.tab === 'cover' ? P.imgs.covers : P.imgs.heroes;
      const x = list[+d.i];
      if (!x) return;
      toast('Bild wird übernommen …');
      if (await act(gx.artPick(id, P.tab, x.url), P.tab === 'cover' ? 'Cover übernommen.' : 'Titelbild übernommen.')) {
        if (P.tab === 'cover' && P.imgs.heroes.length) { P.tab = 'hero'; draw(); toast('Jetzt noch ein Titelbild wählen – oder schließen.'); }
      }
    },
  });
  search('');
}

/* Suche */
function openSearch(initial = '') {
  openOverlay(`<div class="modal search-modal"><div class="search-input">${I.search}<input id="q" placeholder="Spiele, Programme, Einstellungen, Ordner …" value="${esc(initial)}" autocomplete="off" spellcheck="false"><span class="kbd">Esc</span></div><div class="results" id="results"></div></div>`);
  const q = $('#q');
  q.focus();
  q.setSelectionRange(q.value.length, q.value.length);
  let sel = 0;
  let flat = [];
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const match = (s) => !t || s.toLowerCase().includes(t);
    const score = (s) => (s.toLowerCase().startsWith(t) ? 0 : 1);
    const gs = games().filter((g) => match(g.name)).sort((a, b) => score(a.name) - score(b.name) || byRecent(a, b)).slice(0, 6);
    const ps = programs().filter((p) => match(p.name)).sort((a, b) => score(a.name) - score(b.name) || b.launches - a.launches).slice(0, 6);
    const ts = TOOLS.filter(([, n, s]) => t && (match(n) || match(s))).slice(0, 4);
    const fs = (S.state.config.folders || []).filter((f) => t && match(f.name)).slice(0, 3);
    flat = [];
    let html = '';
    const group = (label, arr, fn) => { if (!arr.length) return; html += `<div class="res-group">${label}</div>`; arr.forEach((x) => { const i = flat.length; flat.push(fn(x)); html += flat[i].html.replace('class="res"', `class="res${i === sel ? ' sel' : ''}" data-ri="${i}"`); }); };
    group('Spiele', gs, (g) => ({ run: () => play(g.id), html: `<button class="res"><span class="mi-thumb" style="width:28px;height:36px">${GXArt.cover(g.name)}</span><span class="t">${esc(g.name)}</span><span class="s">${esc(g.sourceName)}</span></button>` }));
    group('Programme', ps, (p) => ({ run: () => launchProg(p.id), html: `<button class="res"><span class="mi-icon" style="width:28px;height:28px">${p.icon ? `<img src="${p.icon}" alt="" style="width:20px;height:20px">` : ''}</span><span class="t">${esc(p.name)}</span><span class="s">Programm</span></button>` }));
    group('Windows', ts, ([k, n, s]) => ({ run: () => gx.tool(k), html: `<button class="res"><span class="mi-icon" style="width:28px;height:28px;color:#e7c98a">${I.gear.replace('<svg ', '<svg width="16" height="16" ')}</span><span class="t">${esc(n)}</span><span class="s">${esc(s)}</span></button>` }));
    group('Ordner', fs, (f) => ({ run: () => openFolder(f.path, f.path), html: `<button class="res"><span class="mi-icon" style="width:28px;height:28px;color:var(--gold)">${I.folder.replace('<svg ', '<svg width="16" height="16" ')}</span><span class="t">${esc(f.name)}</span><span class="s">${esc(f.path)}</span></button>` }));
    if (!flat.length) html = `<div class="empty" style="padding:30px">Nichts gefunden für „${esc(q.value)}“.</div>`;
    $('#results').innerHTML = html;
  };
  q.addEventListener('input', () => { sel = 0; draw(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(flat.length - 1, sel + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && flat[sel]) { const r = flat[sel]; closeOverlay(); r.run(); e.preventDefault(); }
  });
  $('#results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ri]');
    if (!b) return;
    const r = flat[+b.dataset.ri];
    closeOverlay();
    r.run();
  });
  draw();
}

/* Popover (Lautstärke, Ein/Aus, Kontextmenü) */
function closePopover() { document.querySelectorAll('.popover').forEach((p) => p.remove()); }
function popover(anchorOrPoint, html, alignRight) {
  closePopover();
  const el = document.createElement('div');
  el.className = 'popover';
  el.innerHTML = html;
  document.body.appendChild(el);
  let x, y;
  if (anchorOrPoint instanceof Element) {
    const r = anchorOrPoint.getBoundingClientRect();
    y = r.bottom + 8;
    x = alignRight ? r.right - el.offsetWidth : r.left;
  } else { x = anchorOrPoint.x; y = anchorOrPoint.y; }
  x = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, x));
  y = Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, y));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const f = el.querySelector('button, input');
  if (f) f.focus();
  return el;
}
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.popover') && !e.target.closest('[data-act="vol-pop"],[data-act="power-pop"]')) closePopover(); });

function volPopover(anchor) {
  const v = S.vol || { vol: 50, mute: false };
  const el = popover(anchor, `<div style="width:280px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center"><span class="eyebrow">Lautstärke</span><span id="pv" style="margin-left:auto;font-weight:600;color:var(--gold-light)">${v.vol} %</span></div>
    <input type="range" id="pr" min="0" max="100" value="${v.vol}" style="width:100%;background:linear-gradient(90deg,var(--gold) ${v.vol}%,#221d15 ${v.vol}%)">
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
      <button class="btn small quiet" id="pm">${v.mute ? 'Ton an' : 'Stumm'}</button>
      <button class="btn small quiet" data-act="tool" data-key="sound">Ausgabegerät</button>
    </div></div>`, true);
  const r = el.querySelector('#pr');
  let t = null;
  r.addEventListener('input', () => {
    r.style.background = `linear-gradient(90deg,var(--gold) ${r.value}%,#221d15 ${r.value}%)`;
    el.querySelector('#pv').textContent = r.value + ' %';
    clearTimeout(t);
    t = setTimeout(async () => { S.vol = await gx.volume('set', +r.value).catch(() => S.vol); renderTop(); }, 60);
  });
  el.querySelector('#pm').onclick = async () => { S.vol = await act(gx.volume('mute', !v.mute)) || S.vol; renderTop(); closePopover(); };
}

function powerPopover(anchor) {
  popover(anchor, `<div class="menu">
    <button data-act="power" data-a="lock">${I.lock}Sperren</button>
    <button data-act="power" data-a="sleep">${I.moon}Energie sparen</button>
    <button data-act="power" data-a="logoff">${I.restart}Abmelden</button>
    <hr>
    <button data-act="power" data-a="restart">${I.restart}Neu starten</button>
    <button class="danger" data-act="power" data-a="shutdown">${I.power}Herunterfahren</button>
  </div>`, true);
}

function contextMenu(e, kind, id) {
  e.preventDefault();
  const item = kind === 'g' ? gameById(id) : progById(id);
  if (!item) return;
  const html = kind === 'g'
    ? `<div class="menu"><button data-act="play" data-id="${esc(id)}">${I.play}Spielen</button><button data-act="detail" data-id="${esc(id)}">${I.dots}Details & Anpassen</button><button data-act="art-pick" data-id="${esc(id)}">${I.star}Bilder auswählen</button><button data-act="g-fav" data-id="${esc(id)}">${I.star}${item.favorite ? 'Favorit entfernen' : 'Als Favorit'}</button><hr><button data-act="open-path" data-path="${esc(item.installDir)}">${I.folder.replace('<svg ', '<svg width="18" height="18" ')}Ordner öffnen</button><button class="danger" data-act="g-hide" data-id="${esc(id)}">${I.x}${item.hidden ? 'Wieder anzeigen' : 'Ausblenden'}</button></div>`
    : `<div class="menu"><button data-act="prog" data-id="${esc(id)}">${I.play}Starten</button><button data-act="p-fav" data-id="${esc(id)}">${I.star}${item.favorite ? 'Favorit entfernen' : 'Als Favorit'}</button><button data-act="p-cat" data-id="${esc(id)}">${I.apps.replace('<svg ', '<svg width="18" height="18" ')}Kategorie: ${esc(catLabel(item.category))}</button>${item.lnk ? `<button data-act="show-in-folder" data-path="${esc(item.lnk)}">${I.folder.replace('<svg ', '<svg width="18" height="18" ')}Speicherort zeigen</button>` : ''}<hr><button class="danger" data-act="p-hide" data-id="${esc(id)}">${I.x}${item.hidden ? 'Wieder anzeigen' : 'Ausblenden'}</button></div>`;
  popover({ x: e.clientX, y: e.clientY }, html);
}
document.addEventListener('contextmenu', (e) => {
  const g = e.target.closest('.cover-card[data-id]');
  if (g && g.dataset.act !== 'noop') return contextMenu(e, 'g', g.dataset.id);
  const p = e.target.closest('[data-act="prog"][data-id]');
  if (p) return contextMenu(e, 'p', p.dataset.id);
  e.preventDefault();
});

/* ───────── Aktionen ───────── */
async function play(id) {
  const g = gameById(id);
  if (!g) return;
  closePopover();
  if (await act(gx.launchGame(id))) toast(g.name + ' wird gestartet …');
}
async function launchProg(id) {
  closePopover();
  await act(gx.launchProgram(id));
}

const ACTIONS = {
  nav: (d) => { S.view = d.view; closePopover(); render(); if (d.view === 'inbox') loadInbox(); },
  game: (d) => openDetail(d.id),
  detail: (d) => { closePopover(); openDetail(d.id); },
  play: (d) => { closeOverlay(); play(d.id); },
  bnet: (d) => act(gx.launchBnet(d.id)),
  prog: (d) => launchProg(d.id),
  noop: () => {},
  close: () => closeOverlay(),
  search: () => openSearch(),
  filter: (d) => { S.gameFilter = d.f; renderView(); },
  pfilter: (d) => { S.progFilter = d.f; renderView(); },
  'cat-toggle': (d) => { S.openCats = Object.assign({}, S.openCats, { [d.k]: !(S.openCats || {})[d.k] }); renderView(); },
  'p-cat': (d, el) => {
    const p = progById(d.id);
    popover(el.getBoundingClientRect ? { x: el.getBoundingClientRect().left, y: el.getBoundingClientRect().top } : el, `<div class="menu">${CAT_ORDER.map((k) => `<button data-act="p-cat-set" data-id="${esc(d.id)}" data-k="${k}">${k === p.category ? I.star : '<span style="width:16px"></span>'}${esc(catLabel(k))}</button>`).join('')}${p.category !== p.autoCategory ? `<hr><button data-act="p-cat-set" data-id="${esc(d.id)}" data-k="">Automatisch (${esc(catLabel(p.autoCategory))})</button>` : ''}</div>`);
  },
  'p-cat-set': (d) => { closePopover(); act(gx.updateProgram(d.id, { category: d.k || null })); },
  'art-pick': (d) => { closeOverlay(); openArtPicker(d.id); },
  'art-next': async (d) => {
    toast('Suche anderes Cover …');
    const r = await act(gx.artNext(d.id));
    if (r) { toast(r.count > 1 ? `Cover gewechselt (${r.source}, ${r.count} zur Auswahl).` : `Cover geladen (${r.source}).`); reopenDetail(d.id); }
  },
  'sgdb-save': async () => {
    const v = $('#sgdb').value.trim();
    if (await act(gx.setConfig({ sgdbKey: v }), v ? 'Schlüssel gespeichert – Cover werden gesucht …' : 'Schlüssel entfernt.') !== null) {}
  },
  'open-url': (d) => act(gx.openUrl(d.url)),
  'toggle-hidden': () => { S.showHidden = !S.showHidden; render(); },
  rescan: () => { act(gx.rescan(), 'Bibliothek wird neu eingelesen …'); },
  'vol-pop': (_d, el) => volPopover(el),
  'power-pop': (_d, el) => powerPopover(el),
  tool: (d) => { closePopover(); act(gx.tool(d.key)); },
  'win-focus': (d) => act(gx.focusWindow(+d.h)),
  'win-close': (d) => { act(gx.closeWindow(+d.h)); setTimeout(refreshWindows, 600); },
  power: async (d) => {
    closePopover();
    const labels = { restart: 'Neu starten', shutdown: 'Herunterfahren', logoff: 'Abmelden' };
    if (labels[d.a] && !(await confirmBox(labels[d.a] + '?', '<p>Nicht gespeicherte Arbeit in offenen Programmen geht verloren.</p>', labels[d.a], d.a === 'shutdown'))) return;
    act(gx.power(d.a));
  },
  'app-window': (d) => act(gx.appWindow(d.a)),
  'cfg-toggle': async (d) => { const c = S.state.config; await act(gx.setConfig({ [d.key]: !c[d.key] })); },
  mute: async () => { S.vol = await act(gx.volume('mute', !(S.vol && S.vol.mute))) || S.vol; renderTop(); renderView(); },
  'start-mode': async (d) => {
    if (d.m === S.state.config.startMode) return;
    if (d.m === 'shell') {
      const ok = await confirmBox('Exklusiv-Modus aktivieren?', `<p>Nach der PIN startet Windows dann direkt die Bibliothek statt des normalen Desktops.</p>
        <ul><li>Programme, die sonst mit Windows starten (z. B. Discord, Battle.net), startet die Bibliothek für dich.</li>
        <li>Symbole im Infobereich neben der Uhr gibt es in diesem Modus nicht.</li>
        <li>Notfall: <b>Strg + Alt + Entf</b> → Task-Manager → „Neuen Task ausführen“ → <b>explorer</b>.</li>
        <li>Zurück zum normalen Desktop: hier wieder „Mit Windows“ oder „Manuell“ wählen und neu anmelden.</li></ul>
        <p>Wird ab der nächsten Anmeldung aktiv.</p>`, 'Aktivieren');
      if (!ok) return;
    }
    if (await act(gx.setConfig({ startMode: d.m }), d.m === 'shell' ? 'Exklusiv-Modus ab der nächsten Anmeldung aktiv.' : d.m === 'autostart' ? 'Die Bibliothek startet ab jetzt mit Windows.' : 'Automatischer Start ist aus.') === null) render();
  },
  'owner-save': async () => { const v = $('#owner').value.trim(); if (!v) return toast('Bitte einen Namen eingeben.', 'error'); await act(gx.setConfig({ ownerName: v }), 'Gespeichert – hallo ' + v + '!'); },
  display: (d) => act(gx.setConfig({ displayId: +d.id })),
  update: async () => {
    toast('Suche nach Updates …');
    const r = await act(gx.update());
    if (r) toast(r.updated ? 'Update geladen – die Bibliothek startet neu.' : 'Du hast bereits die neueste Version.');
  },
  'tile-add': async () => {
    const f = await act(gx.pickFile({ title: 'Programm oder Datei für die Kachel wählen', filters: [{ name: 'Programme & Verknüpfungen', extensions: ['exe', 'lnk', 'msc', 'cpl', 'bat', 'cmd'] }, { name: 'Alle Dateien', extensions: ['*'] }] }));
    if (!f) return;
    const name = f.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    const tiles = (S.state.config.customTiles || []).concat([{ name, target: f }]);
    act(gx.setConfig({ customTiles: tiles }), 'Kachel „' + name + '“ hinzugefügt.');
  },
  'tile-remove': (d) => { const tiles = (S.state.config.customTiles || []).filter((_, i) => i !== +d.i); act(gx.setConfig({ customTiles: tiles })); },
  'custom-tile': (d) => { const t = S.state.config.customTiles[+d.i]; if (t) act(gx.openPath(t.target)); },
  'open-path': (d) => { closePopover(); if (d.path) act(gx.openPath(d.path)); },
  'show-in-folder': (d) => { closePopover(); act(gx.showInFolder(d.path)); },
  'folder-root': (d) => openFolder(d.path, d.path),
  'folder-go': (d) => {
    const roots = S.state.config.folders || [];
    const root = roots.find((f) => d.path.toLowerCase().startsWith(f.path.toLowerCase()));
    openFolder(d.path, root ? root.path : S.folderRoot || d.path);
  },
  'folder-up': () => { if (!S.folderPath || S.folderPath === S.folderRoot) return; openFolder(S.folderPath.replace(/[\\/][^\\/]+[\\/]?$/, '')); },
  'folder-add': async () => {
    const p = await act(gx.pickFolder());
    if (!p) return;
    const folders = (S.state.config.folders || []).concat([{ path: p, name: p.split(/[\\/]/).filter(Boolean).pop() || p }]);
    await act(gx.setConfig({ folders }));
    openFolder(p, p);
  },
  'folder-remove': (d) => { const folders = (S.state.config.folders || []).filter((_, i) => i !== +d.i); S.folderPath = null; S.folderRoot = null; act(gx.setConfig({ folders })); },
  'file-open': (d) => { const f = S.folderItems[+d.i]; if (!f) return; if (f.isDir) openFolder(f.path); else act(gx.openPath(f.path)); },
  'inbox-move': async (d) => { const f = S.inbox.items[+d.i]; if (!f) return; if (await act(gx.moveFile(f.path, f.destKey), f.name + ' → ' + f.destLabel)) loadInbox(); },
  'inbox-open': (d) => { const f = S.inbox.items[+d.i]; if (f) act(gx.openPath(f.path)); },
  'inbox-show': (d) => { const f = S.inbox.items[+d.i]; if (f) act(gx.showInFolder(f.path)); },
  'g-fav': (d) => { closePopover(); const g = gameById(d.id); act(gx.updateGame(d.id, { favorite: g.favorite ? null : true })).then(() => reopenDetail(d.id)); },
  'g-hide': (d) => { closePopover(); const g = gameById(d.id); act(gx.updateGame(d.id, { hidden: g.hidden ? null : true }), g.hidden ? g.name + ' wird wieder angezeigt.' : g.name + ' ausgeblendet.'); closeOverlay(); },
  'g-rename': (d) => { const v = $('#g-name').value.trim(); act(gx.updateGame(d.id, { name: v || null }), 'Name gespeichert.').then(() => reopenDetail(d.id)); },
  'g-rename-reset': (d) => act(gx.updateGame(d.id, { name: null })).then(() => reopenDetail(d.id)),
  'g-cover': async (d) => { const f = await act(gx.pickFile({ title: 'Cover-Bild wählen (Hochformat)', filters: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })); if (f) act(gx.updateGame(d.id, { cover: f })).then(() => reopenDetail(d.id)); },
  'g-hero': async (d) => { const f = await act(gx.pickFile({ title: 'Titelbild wählen (Querformat)', filters: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })); if (f) act(gx.updateGame(d.id, { hero: f })).then(() => reopenDetail(d.id)); },
  'g-launch': async (d) => { const f = await act(gx.pickFile({ title: 'Programm zum Starten wählen', filters: [{ name: 'Programme', extensions: ['exe', 'lnk', 'bat', 'cmd'] }] })); if (f) act(gx.updateGame(d.id, { launch: /\.exe$/i.test(f) ? { kind: 'exe', target: f, args: [] } : { kind: 'path', target: f } }), 'Startbefehl gespeichert.').then(() => reopenDetail(d.id)); },
  'g-launch-reset': (d) => act(gx.updateGame(d.id, { launch: null })).then(() => reopenDetail(d.id)),
  'p-fav': (d) => { closePopover(); const p = progById(d.id); act(gx.updateProgram(d.id, { favorite: p.favorite ? null : true })); },
  'p-hide': (d) => { closePopover(); const p = progById(d.id); act(gx.updateProgram(d.id, { hidden: p.hidden ? null : true }), p.hidden ? p.name + ' wird wieder angezeigt.' : p.name + ' ausgeblendet.'); },
};

let reopenId = null;
function reopenDetail(id) { reopenId = id; }

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn(el.dataset, el);
});

/* ───────── Darstellung ───────── */
function renderView() {
  if (!S.state) return;
  const v = $('#view');
  const keepScroll = S.lastView === S.view ? v.scrollTop : 0;
  S.lastView = S.view;
  if (S.view === 'home') renderHome();
  else if (S.view === 'games') renderGames();
  else if (S.view === 'programs') renderPrograms();
  else if (S.view === 'folders') renderFolders();
  else if (S.view === 'inbox') renderInbox();
  else if (S.view === 'settings') renderSettings();
  v.style.overflowY = S.view === 'folders' ? 'hidden' : 'auto';
  v.scrollTop = keepScroll;
}
function render() {
  renderSide();
  renderTop();
  renderView();
}

/* ───────── Live-Daten ───────── */
async function refreshSystem() {
  if (document.hidden) return;
  S.sys = await gx.system().catch(() => S.sys);
  if (S.view === 'home') {
    // Nur die Werte austauschen, nicht die ganze Seite neu zeichnen
    const sys = S.sys;
    const meters = document.querySelectorAll('.side-col .widget:first-child .meter > div');
    const vals = document.querySelectorAll('.side-col .widget:first-child .meter-row span:last-child');
    if (sys && meters.length && vals.length) {
      const list = [[sys.cpu + ' %', sys.cpu]];
      if (sys.gpu) list.push([sys.gpu.util + ' % · ' + sys.gpu.temp + ' °C', sys.gpu.util]);
      list.push([(sys.ramUsed / 1073741824).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' / ' + Math.round(sys.ramTotal / 1073741824) + ' GB', 100 * sys.ramUsed / sys.ramTotal]);
      list.forEach(([txt, pct], i) => { if (vals[i]) vals[i].textContent = txt; if (meters[i]) meters[i].style.width = Math.min(100, pct) + '%'; });
    } else renderHome();
  }
}

async function refreshWindows() {
  const list = await gx.windows().catch(() => null);
  if (!list) return;
  S.wins = list;
  for (const w of list) {
    if (w.path && !(w.path in S.winIcons)) {
      S.winIcons[w.path] = null;
      gx.fileIcon(w.path).then((ic) => { S.winIcons[w.path] = ic; renderTop(); }).catch(() => {});
    }
  }
  renderTop();
}

async function refreshVolume() {
  S.vol = await gx.volume('get').catch(() => S.vol);
  renderTop();
}

/* ───────── Tastatur & Controller ───────── */
function focusables() {
  const root = $('#overlay').hidden ? document : $('#overlay');
  return [...root.querySelectorAll('button:not([disabled]), a[data-act], input, [tabindex="0"]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('.win-chip .x');
  });
}
function moveFocus(dir) {
  const items = focusables();
  const cur = document.activeElement && items.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { const first = $('#view').querySelector('.cover-card, .app-tile, .tool, button') || items[0]; if (first) first.focus(); return; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - ax;
    const dy = by - ay;
    let ok = false;
    if (dir === 'left') ok = dx < -4 && Math.abs(dy) < Math.max(a.height, b.height);
    if (dir === 'right') ok = dx > 4 && Math.abs(dy) < Math.max(a.height, b.height);
    if (dir === 'up') ok = dy < -4;
    if (dir === 'down') ok = dy > 4;
    if (!ok) continue;
    const primary = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

function goBack() {
  if (document.querySelector('.popover')) return closePopover();
  if (closeOverlay()) return;
  if (S.view === 'folders' && S.folderPath && S.folderPath !== S.folderRoot) return ACTIONS['folder-up']();
  if (S.view !== 'home') { S.view = 'home'; render(); }
}

const VIEWS = ['home', 'games', 'programs', 'folders', 'inbox', 'settings'];
function cycleView(step) {
  const i = VIEWS.indexOf(S.view);
  S.view = VIEWS[(i + step + VIEWS.length) % VIEWS.length];
  closeOverlay();
  render();
  if (S.view === 'inbox') loadInbox();
}

document.addEventListener('keydown', (e) => {
  const inField = e.target.matches('input:not([type=range])');
  if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === 'F3')) { e.preventDefault(); openSearch(); return; }
  if (e.key === 'Escape') { e.preventDefault(); goBack(); return; }
  if (inField) return;
  const arrows = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (arrows[e.key] && !e.target.matches('input[type=range]')) { e.preventDefault(); moveFocus(arrows[e.key]); return; }
  if (e.key === 'Backspace') { e.preventDefault(); goBack(); return; }
  // Einfach lostippen = Suche
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && /\S/.test(e.key) && $('#overlay').hidden) { e.preventDefault(); openSearch(e.key); }
});

// Controller (Xbox-/PlayStation-Layout über die Gamepad-API)
(function gamepadLoop() {
  const held = {};
  let lastMove = 0;
  function tick(t) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = [...pads].find(Boolean);
    if (p && document.hasFocus()) {
      const press = (i) => p.buttons[i] && p.buttons[i].pressed;
      const edge = (i) => { const now = press(i); const was = held[i]; held[i] = now; return now && !was; };
      const ax = p.axes[0] || 0;
      const ay = p.axes[1] || 0;
      let dir = null;
      if (press(14) || ax < -0.6) dir = 'left';
      else if (press(15) || ax > 0.6) dir = 'right';
      else if (press(12) || ay < -0.6) dir = 'up';
      else if (press(13) || ay > 0.6) dir = 'down';
      if (dir && t - lastMove > 170) { moveFocus(dir); lastMove = t; }
      if (!dir) lastMove = 0;
      if (edge(0) && document.activeElement) document.activeElement.click();
      if (edge(1)) goBack();
      if (edge(3)) openSearch();
      if (edge(4)) cycleView(-1);
      if (edge(5)) cycleView(1);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ───────── Start ───────── */
gx.on('state', (st) => {
  S.state = st;
  if (IS_COMPANION) { if (window.renderCompanion) window.renderCompanion(); return; }
  const ovOpen = !$('#overlay').hidden;
  const isDetail = ovOpen && $('#overlay .detail');
  render();
  if (reopenId && isDetail) { const id = reopenId; reopenId = null; openDetail(id); }
});
gx.on('toast', (t) => toast(t.text, t.kind));
gx.on('winkey', () => { if (IS_COMPANION) return; closePopover(); refreshWindows(); });
gx.on('inbox-changed', () => { if (!IS_COMPANION) loadInbox(); });
gx.on('windows', () => { if (IS_COMPANION) return; refreshWindows(); refreshVolume(); });

if (!IS_COMPANION) (async function init() {
  S.state = await gx.state();
  render();
  if (!ownerName()) { S.welcome = true; openWelcome(); }
  loadInbox();
  refreshSystem();
  refreshVolume();
  refreshWindows();
  setInterval(refreshSystem, 2500);
  setInterval(() => { if (document.hasFocus()) refreshWindows(); }, 4000);
  setInterval(renderTop, 15000);
})();
