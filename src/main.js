'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, screen, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');

app.setName('Bibliothek');
if (process.platform === 'win32') app.setAppUserModelId('Bibliothek.App');

const U = require('./lib/util');
const helper = require('./lib/helper');
const worker = helper.worker;
const { scanGames, wowLastCharacter } = require('./lib/games');
const { scanPrograms, startMenuRoots, categorize, CATEGORY_LABELS } = require('./lib/programs');
const Art = require('./lib/art');

const IS_SHELL_LAUNCH = process.argv.includes('--bibliothek-shell');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

/* ─────────────────────────── Daten ─────────────────────────── */

const DATA = app.getPath('userData');
const F = {
  config: path.join(DATA, 'config.json'),
  stats: path.join(DATA, 'stats.json'),
  cache: path.join(DATA, 'cache.json'),
  art: path.join(DATA, 'art.json'),
};
const ART_DIR = path.join(DATA, 'art');
const ICON_DIR = path.join(DATA, 'icons');

function defaultFolders() {
  const p = (k) => { try { return app.getPath(k); } catch { return null; } };
  return [
    ['desktop', 'Desktop'], ['documents', 'Dokumente'], ['downloads', 'Downloads'],
    ['pictures', 'Bilder'], ['videos', 'Videos'], ['music', 'Musik'],
  ].map(([k, name]) => ({ path: p(k), name })).filter((f) => f.path && U.exists(f.path));
}

const DEFAULT_CONFIG = {
  ownerName: '',             // „Wie möchtest du genannt werden?“ – oben steht dann „<Name> Bibliothek“
  winKey: true,              // Windows-Taste öffnet die Bibliothek
  displayId: null,           // Bildschirm für die Bibliothek (null = Hauptbildschirm)
  sgdbKey: '',               // SteamGridDB-Schlüssel für Cover (optional)
  companion: true,           // eigene Seite auf den Zweitbildschirmen
  quickTiles: null,          // Schnellstart auf den Zweitbildschirmen (wird beim ersten Start befüllt)
  startMode: 'off',          // off | autostart | shell
  hideTaskbar: true,
  hotCorner: true,
  shortcut: 'Control+Alt+G',
  folders: null,             // wird beim ersten Start befüllt
  customTiles: [],
  games: {},                 // Überschreibungen je Spiel: name, hidden, cover, launch, favorite
  programs: {},              // Überschreibungen je Programm: name, hidden, favorite
};

let config = Object.assign({}, DEFAULT_CONFIG, U.readJSON(F.config, {}));
if (!config.folders) config.folders = defaultFolders();
if (!config.quickTiles) {
  config.quickTiles = [
    { id: 'yt', type: 'web', name: 'YouTube', url: 'https://www.youtube.com' },
    { id: 'ytm', type: 'web', name: 'YouTube Music', url: 'https://music.youtube.com' },
    { id: 'google', type: 'web', name: 'Google', url: 'https://www.google.com' },
    { id: 'gemini', type: 'web', name: 'Gemini', url: 'https://gemini.google.com' },
  ];
}
let stats = Object.assign({ games: {}, programs: {}, known: [], firstScanDone: false }, U.readJSON(F.stats, {}));
let cache = Object.assign({ games: [], programs: [], icons: {}, sources: {}, scannedAt: 0 }, U.readJSON(F.cache, {}));

const saveConfig = U.debounce(() => U.writeJSON(F.config, config), 300);
const saveStats = U.debounce(() => U.writeJSON(F.stats, stats), 1000);
const saveCache = U.debounce(() => U.writeJSON(F.cache, cache), 500);
let artMap = U.readJSON(F.art, {});   // gameId -> { cover, hero, source, index, tried, name }
const saveArt = U.debounce(() => U.writeJSON(F.art, artMap), 500);

let running = new Set();     // IDs laufender Spiele
let scanning = false;

/* ─────────────────────────── Fenster ─────────────────────────── */

let win = null;
let corner = null;
const companions = new Map();   // displayId -> BrowserWindow (Seite auf den Zweitbildschirmen)
let quitting = false;

function targetDisplay() {
  return screen.getAllDisplays().find((d) => d.id === config.displayId) || screen.getPrimaryDisplay();
}

function displayList() {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays()
    .slice()
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
    .map((d, i) => ({ id: d.id, nr: i + 1, primary: d.id === primary, width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) }));
}

function appTitle() {
  return (config.ownerName ? config.ownerName + ' ' : '') + 'Bibliothek';
}

function moveToDisplay() {
  if (!win || win.isDestroyed()) return;
  const { bounds } = targetDisplay();
  win.setFullScreen(false);
  win.setBounds(bounds);
  setTimeout(() => { if (win && !win.isDestroyed()) win.setFullScreen(true); }, 100);
  placeCorner();
  syncCompanions();
}

/* ───── Zweitbildschirme ───── */
function hwndOf(w) {
  try { const b = w.getNativeWindowHandle(); return b.length >= 8 ? Number(b.readBigInt64LE(0)) : b.readInt32LE(0); } catch { return 0; }
}
// Seite liegt wie ein Hintergrund unter allen anderen Fenstern
function toBack(w) { if (w && !w.isDestroyed()) helper.safe('toBack', { h: hwndOf(w) }); }

function syncCompanions() {
  const main = targetDisplay().id;
  const wanted = config.companion ? screen.getAllDisplays().filter((d) => d.id !== main) : [];
  for (const [id, w] of companions) {
    if (!wanted.some((d) => d.id === id)) { companions.delete(id); if (!w.isDestroyed()) w.destroy(); }
  }
  for (const d of wanted) {
    let w = companions.get(d.id);
    if (w && !w.isDestroyed()) { w.setBounds(d.bounds); continue; }
    w = new BrowserWindow({
      x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
      frame: false, show: false, skipTaskbar: true, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false,
      backgroundColor: '#0b0a08', title: appTitle(),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false },
    });
    w.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { companion: String(d.id) } });
    w.once('ready-to-show', () => { w.showInactive(); w.setBounds(d.bounds); setTimeout(() => toBack(w), 200); });
    // Normal liegt die Seite wie ein Hintergrund unten – außer sie wurde mit Windows + Tab nach vorne geholt
    w.on('focus', () => { if (!w.pinnedFront) setTimeout(() => toBack(w), 30); });
    w.on('page-title-updated', (e) => e.preventDefault());
    w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
    companions.set(d.id, w);
    w.once('ready-to-show', () => setTimeout(syncHwnds, 300));
  }
  syncHwnds();
}

/* Programm/Website starten und das neue Fenster auf einen bestimmten Bildschirm schieben */
async function launchOnDisplay(displayId, launch, matchPath) {
  const d = screen.getAllDisplays().find((x) => x.id === displayId);
  if (!d || process.platform !== 'win32') return launch();
  const before = new Set(((await helper.safe('windows', { selfPid: process.pid }, [])) || []).map((w) => w.h));
  await launch();
  const r = screen.dipToScreenRect(null, d.bounds);
  for (let i = 0; i < 20; i++) {
    await new Promise((res) => setTimeout(res, 500));
    const list = (await helper.safe('windows', { selfPid: process.pid }, [])) || [];
    let hit = list.find((w) => !before.has(w.h));
    if (!hit && i > 6 && matchPath) hit = list.find((w) => w.path && U.normPath(w.path) === U.normPath(matchPath));
    if (hit) { await helper.safe('moveTo', { h: hit.h, x: r.x, y: r.y, w: r.width, hh: r.height, max: true }); return; }
  }
}

/* Fensterliste mit Bildschirmnummer (1, 2, 3 …) */
async function windowsWithMon() {
  const list = (await helper.safe('windows', { selfPid: process.pid }, [])) || [];
  const displays = displayList();
  return list.map((w) => {
    let mon = null;
    try {
      const pt = screen.screenToDipPoint({ x: Math.round((w.l + w.r) / 2), y: Math.round((w.t + w.b) / 2) });
      const d = screen.getDisplayNearestPoint(pt);
      const e = displays.find((x) => x.id === d.id);
      mon = e ? e.nr : null;
    } catch {}
    return { h: w.h, title: w.title, path: w.path, mon };
  });
}

async function openUrl(url, displayId) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const b = process.platform === 'win32' ? await helper.safe('defaultBrowser', {}, null) : null;
  const exe = b && b.command ? ((b.command.match(/^"([^"]+)"/) || b.command.match(/^(\S+\.exe)/i) || [])[1]) : null;
  const chromium = exe && /chrome|msedge|brave|opera|vivaldi|chromium/i.test(exe);
  const firefox = exe && /firefox|librewolf|waterfox/i.test(exe);
  if (!exe || !U.exists(exe) || (!chromium && !firefox)) return shell.openExternal(url);

  // Läuft der Browser schon? Dann nur einen neuen Tab öffnen –
  // bevorzugt im Browserfenster auf diesem Bildschirm, sonst im zuletzt benutzten.
  const wins = await windowsWithMon();
  const own = wins.filter((w) => w.path && U.normPath(w.path) === U.normPath(exe));
  if (own.length) {
    const nr = (displayList().find((d) => d.id === displayId) || {}).nr;
    const target = own.find((w) => w.mon === nr) || own[0];
    await helper.safe('focus', { h: target.h });
    await new Promise((r) => setTimeout(r, 150));
    spawnDetached(exe, firefox ? ['-new-tab', url] : [url]);
    return;
  }
  // Noch kein Browser offen: neues Fenster direkt auf diesem Bildschirm
  const run = () => spawnDetached(exe, firefox ? ['-new-window', url] : ['--new-window', url]);
  if (displayId) return launchOnDisplay(displayId, run);
  return run();
}

function createWindow() {
  const { bounds } = targetDisplay();
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    show: false,
    frame: false,
    fullscreen: true,
    backgroundColor: '#0b0a08',
    title: appTitle(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.focus(); setTimeout(syncHwnds, 500); });
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('focus', () => { applyTaskbar(); updateCorner(); pushWindows(); });
  win.on('blur', () => updateCorner());
  win.on('restore', () => applyTaskbar());
  win.on('close', (e) => {
    // Im Exklusiv-Modus ist die Bibliothek die Oberfläche – nicht versehentlich schließen
    if (!quitting && IS_SHELL_LAUNCH) { e.preventDefault(); win.minimize(); }
  });
  win.webContents.on('render-process-gone', () => { if (!quitting) win.reload(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function placeCorner() {
  if (!corner || corner.isDestroyed()) return;
  const d = targetDisplay().bounds;
  corner.setBounds({ x: d.x, y: d.y + d.height - 4, width: 4, height: 4 });
}

function createCorner() {
  const d = targetDisplay().bounds;
  corner = new BrowserWindow({
    x: d.x, y: d.y + d.height - 4, width: 4, height: 4,
    frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, focusable: false, show: false, alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  corner.setAlwaysOnTop(true, 'screen-saver');
  corner.loadURL('data:text/html,' + encodeURIComponent('<html><body style="margin:0;background:rgba(0,0,0,0.01);width:100vw;height:100vh" onmouseenter="window.gx.cornerHit()"></body></html>'));
}

function updateCorner() {
  if (!corner || corner.isDestroyed()) return;
  const want = config.hotCorner && win && !win.isDestroyed() && !win.isFocused() && running.size === 0;
  if (want && !corner.isVisible()) corner.showInactive();
  if (!want && corner.isVisible()) corner.hide();
}

function bringToFront() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.focus();
  // Windows erlaubt den Fokuswechsel nur dem Prozess, der gerade die Eingabe bekommen hat –
  // das ist der Helfer mit der Windows-Taste. Er holt die Bibliothek darum zusätzlich selbst nach vorne.
  helper.safe('focus', { h: ownHandle() });
  setTimeout(() => { if (win && !win.isDestroyed()) { win.setAlwaysOnTop(false); win.focus(); } }, 250);
  applyTaskbar();
}

/* Windows-Taste: zwischen Bibliothek und dem zuletzt aktiven Fenster (z. B. WoW) hin- und herschalten */
let lastOther = null;
function ownHandle() {
  try { const b = win.getNativeWindowHandle(); return b.length >= 8 ? Number(b.readBigInt64LE(0)) : b.readInt32LE(0); } catch { return 0; }
}
function ourHandles() {
  return new Set([ownHandle(), ...[...companions.values()].map(hwndOf)].filter(Boolean));
}
/* Der Wechsel selbst passiert direkt im Helfer (sofort, ohne Warteschlange).
   Hier wird nur nachbereitet: Taskleiste, Fensterliste, Zustand der Zweitbildschirme. */
function onWinKey() {
  setTimeout(() => { if (win && !win.isDestroyed() && win.isFocused()) { applyTaskbar(); send('winkey'); } }, 120);
}
helper.on('winkey', onWinKey);

function onWinTab(ev) {
  const on = !!(ev && ev.pinned);
  for (const w of companions.values()) if (!w.isDestroyed()) w.pinnedFront = on;
  if (on) send('companion-pinned');
}
helper.on('wintab', onWinTab);

/* Dem Helfer sagen, welche Fenster zur Bibliothek gehören */
function syncHwnds() {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  helper.safe('setHwnds', { lib: ownHandle(), comps: [...companions.values()].filter((w) => !w.isDestroyed()).map(hwndOf) });
}

async function applyTaskbar() {
  if (process.platform !== 'win32') return;
  if (!config.hideTaskbar) return showTaskbar();
  const prev = await helper.safe('taskbar', { show: false, restore: -1 });
  helper.safe('taskbarGuard', { on: true });
  // Ursprüngliche Einstellung einmal merken (nur wenn sie nicht schon „automatisch ausblenden“ war)
  if (config.taskbarPrev == null && typeof prev === 'number' && (prev & 1) === 0) { config.taskbarPrev = prev; saveConfig(); }
}

/* Taskleiste zeigen und die ursprüngliche Einstellung wiederherstellen */
async function showTaskbar() {
  if (process.platform !== 'win32') return;
  const restore = config.taskbarPrev == null ? -1 : config.taskbarPrev;
  await helper.safe('taskbarGuard', { on: false }, null, 3000);
  await helper.safe('taskbar', { show: true, restore }, null, 3000);
  if (config.taskbarPrev != null) { config.taskbarPrev = null; saveConfig(); }
}

function send(channel, data) {
  for (const w of [win, ...companions.values()]) if (w && !w.isDestroyed()) w.webContents.send(channel, data);
}

function pushWindows() { send('windows'); }

/* ─────────────────────────── Zustand ─────────────────────────── */

function gameView(g) {
  const o = config.games[g.id] || {};
  const s = stats.games[g.id] || {};
  const playSec = Math.max(g.extPlaySec || 0, s.playSec || 0);
  const lastPlayed = Math.max(g.extLastPlayed || 0, s.lastPlayed || 0);
  return {
    id: g.id,
    name: o.name || g.name,
    originalName: g.name,
    source: g.source,
    sourceName: g.sourceName,
    installDir: g.installDir,
    art: buildArt(g, o),
    artSource: (artMap[g.id] && artMap[g.id].cover && !o.cover) ? artMap[g.id].source : null,
    launch: o.launch || g.launch,
    launchCustom: !!o.launch,
    launchNote: g.launchNote || null,
    hasBnet: !!g.bnetExe,
    wowCharacter: g.wowCharacter || null,
    hidden: !!o.hidden,
    favorite: !!o.favorite,
    playSec,
    lastPlayed,
    isNew: !!s.isNew && Date.now() - (s.firstSeen || 0) < 7 * 864e5,
    running: running.has(g.id),
  };
}

function buildArt(g, o) {
  const a = artMap[g.id] || {};
  const url = (p) => (p && U.exists(p) ? pathToFileURL(p).href : null);
  const cover = [url(o.cover), url(a.cover)].concat(g.art.cover || []).filter(Boolean);
  const hero = [url(o.hero), url(a.hero)].concat(g.art.hero || []).filter(Boolean);
  return Object.assign({}, g.art, { cover, hero });
}

/* ─────────────────────────── Cover suchen ─────────────────────────── */

let artBusy = false;
const ART_V = 2; // Version der Auswahl-Logik – ältere automatische Treffer werden neu gesucht
async function fetchMissingArt(force) {
  if (artBusy) return;
  artBusy = true;
  try {
    for (const g of cache.games) {
      if (g.source === 'steam') continue;
      const o = config.games[g.id] || {};
      const name = o.name || g.name;
      const a = artMap[g.id];
      if (a && a.picked && a.cover && U.exists(a.cover)) continue; // selbst ausgewählt – nie überschreiben
      const fresh = a && a.v === ART_V && a.name === name && (a.cover ? U.exists(a.cover) : (a.withKey === !!config.sgdbKey && Date.now() - (a.tried || 0) < 3 * 864e5));
      if (fresh && !force) continue;
      try {
        const r = await Art.fetchArt({ id: g.id, name }, { dir: ART_DIR, key: config.sgdbKey, index: 0 });
        artMap[g.id] = Object.assign({ v: ART_V, name, tried: Date.now(), index: 0, withKey: !!config.sgdbKey }, r || {});
      } catch (e) {
        artMap[g.id] = { v: ART_V, name, tried: Date.now(), error: e.message, withKey: !!config.sgdbKey };
        if (/Schlüssel/.test(e.message)) { send('toast', { kind: 'error', text: e.message }); break; }
      }
      saveArt();
      pushState();
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally { artBusy = false; }
}

function programView(p) {
  const o = config.programs[p.id] || {};
  const s = stats.programs[p.id] || {};
  return {
    id: p.id, kind: p.kind, name: o.name || p.name, target: p.target, lnk: p.lnk,
    category: o.category || p.category || categorize(p), autoCategory: p.category || categorize(p),
    icon: (o.customIcon && U.exists(o.customIcon) ? pathToFileURL(o.customIcon).href : null) || cache.icons[p.id] || null,
    customIcon: !!o.customIcon, hidden: !!o.hidden, favorite: !!o.favorite,
    launches: s.launches || 0, last: s.last || 0,
    isNew: !!s.isNew && Date.now() - (s.firstSeen || 0) < 7 * 864e5,
  };
}

function fullState() {
  return {
    games: cache.games.map(gameView),
    programs: cache.programs.map(programView),
    sources: cache.sources,
    scannedAt: cache.scannedAt,
    scanning,
    config: {
      ownerName: config.ownerName, winKey: config.winKey, displayId: config.displayId,
      hasSgdbKey: !!config.sgdbKey, companion: config.companion, quickTiles: config.quickTiles || [], compLayout: config.compLayout || { hello: true, side: true },
      startMode: config.startMode, hideTaskbar: config.hideTaskbar, hotCorner: config.hotCorner,
      shortcut: config.shortcut, folders: config.folders, customTiles: config.customTiles,
    },
    user: os.userInfo().username,
    computer: os.hostname(),
    version: app.getVersion(),
    displays: displayList(),
    categories: CATEGORY_LABELS,
    artStatus: (() => {
      const own = cache.games.filter((g) => g.source !== 'steam');
      const found = own.filter((g) => (artMap[g.id] && artMap[g.id].cover) || (config.games[g.id] || {}).cover).length;
      const err = own.map((g) => artMap[g.id] && artMap[g.id].error).find(Boolean) || null;
      return { total: own.length, found, busy: artBusy, error: err };
    })(),
    canUpdate: U.exists(path.join(app.getAppPath(), '.git')),
    isShell: IS_SHELL_LAUNCH,
    platform: process.platform,
  };
}

const pushState = U.debounce(() => send('state', fullState()), 150);

/* ─────────────────────────── Scannen ─────────────────────────── */

function markNew(kind, items) {
  const known = new Set(stats.known);
  const first = !stats.firstScanDone;
  for (const it of items) {
    const key = kind + ':' + it.id;
    const bucket = kind === 'g' ? stats.games : stats.programs;
    if (!known.has(key)) {
      known.add(key);
      bucket[it.id] = Object.assign(bucket[it.id] || {}, { firstSeen: Date.now(), isNew: !first });
    }
  }
  stats.known = [...known];
}

const ICON_VERSION = 2;
async function loadIcons(programs) {
  if (process.platform !== 'win32') return;
  if (cache.iconsV !== ICON_VERSION) { cache.icons = {}; cache.iconsV = ICON_VERSION; }
  // Store-Apps: Logo direkt aus dem App-Paket
  const uwp = programs.filter((p) => p.kind === 'uwp' && !cache.icons[p.id]);
  if (uwp.length) {
    const logos = (await worker.safe('uwpLogos', { appIds: uwp.map((p) => p.appId) }, {}, 60000)) || {};
    for (const p of uwp) if (logos[p.appId]) cache.icons[p.id] = pathToFileURL(logos[p.appId]).href;
    pushState();
  }
  // Klassische Programme: großes Icon über die Verknüpfung (die kennt auch das richtige Icon, z. B. bei Discord)
  let n = 0;
  for (const p of programs) {
    if (p.kind !== 'lnk' || cache.icons[p.id]) continue;
    const b64 = await worker.safe('icon', { path: p.lnk }, null, 15000);
    if (b64) {
      // Als Datei speichern, damit der Zustand klein bleibt
      const f = path.join(ICON_DIR, p.id.replace(/[^a-z0-9_-]/gi, '_') + '.png');
      try { fs.mkdirSync(ICON_DIR, { recursive: true }); fs.writeFileSync(f, Buffer.from(b64, 'base64')); cache.icons[p.id] = pathToFileURL(f).href + '?v=' + Date.now(); } catch {}
    }
    else {
      try { const img = await app.getFileIcon(p.target && U.exists(p.target) ? p.target : p.lnk, { size: 'large' }); if (!img.isEmpty()) cache.icons[p.id] = img.toDataURL(); } catch {}
    }
    if (++n % 15 === 0) pushState();
  }
  pushState();
}

async function rescan() {
  if (scanning) return;
  scanning = true;
  pushState();
  try {
    const { games, sources } = await scanGames(worker);
    const startApps = process.platform === 'win32' ? await worker.safe('startApps', {}, [], 30000) : [];
    const programs = scanPrograms({
      readShortcut: (p) => shell.readShortcutLink(p),
      gameDirs: games.map((g) => g.installDir).filter(Boolean),
      startApps,
    });
    if (!config.quickTilesSeeded) {
      // Discord & Claude automatisch auf den Zweitbildschirm legen, falls installiert
      for (const re of [/^discord$/i, /^claude$/i]) {
        const p = programs.find((x) => re.test(x.name));
        if (p && !config.quickTiles.some((t) => t.programId === p.id)) config.quickTiles.push({ id: 't-' + p.id, type: 'program', name: p.name, programId: p.id });
      }
      config.quickTilesSeeded = true;
      saveConfig();
    }
    markNew('g', games);
    markNew('p', programs);
    stats.firstScanDone = true;
    cache.games = games;
    cache.programs = programs;
    cache.sources = Object.assign(sources, { programs: programs.length });
    cache.scannedAt = Date.now();
    pushState();
    fetchMissingArt();
    await loadIcons(programs);
    saveCache();
    saveStats();
  } catch (e) {
    console.error('Scan fehlgeschlagen', e);
  } finally {
    scanning = false;
    pushState();
  }
}
const rescanSoon = U.debounce(rescan, 3000);

function setupWatchers() {
  const watch = (dir, recursive) => {
    if (!dir || !U.exists(dir)) return;
    try { fs.watch(dir, { recursive }, () => rescanSoon()); } catch {}
  };
  for (const r of startMenuRoots()) watch(r, true);
  const pd = process.env.ProgramData || 'C:\\ProgramData';
  watch(path.join(pd, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'), false);
  // Steam-Bibliotheken: neue appmanifest-Dateien = neues Spiel
  const steamDirs = new Set(cache.games.filter((g) => g.source === 'steam').map((g) => path.resolve(g.installDir, '..', '..')));
  for (const d of steamDirs) watch(d, false);
  // Downloads für den Eingangskorb
  try { fs.watch(app.getPath('downloads'), U.debounce(() => send('inbox-changed'), 800)); } catch {}
}

/* ─────────────────────────── Spielzeit ─────────────────────────── */

const POLL_SEC = 20;
async function pollRunning() {
  if (process.platform !== 'win32') return;
  const procs = await worker.safe('procs', {}, null, 20000);
  if (!procs) return;
  const now = new Set();
  for (const g of cache.games) {
    if (!g.installDir) continue;
    if (procs.some((p) => U.isInside(p, g.installDir))) now.add(g.id);
  }
  for (const id of now) {
    const s = stats.games[id] || (stats.games[id] = {});
    s.playSec = Math.max(s.playSec || 0, (cache.games.find((g) => g.id === id) || {}).extPlaySec || 0) + POLL_SEC;
    s.lastPlayed = Date.now();
  }
  const changed = now.size !== running.size || [...now].some((id) => !running.has(id));
  // WoW: Charakter nach dem Spielen neu einlesen
  for (const id of running) {
    if (!now.has(id)) {
      const g = cache.games.find((x) => x.id === id);
      if (g && g.art && g.art.scene === 'castle') {
        const c = wowLastCharacter(g.installDir);
        if (c) { g.wowCharacter = { name: c.name, realm: c.realm || '' }; g.extLastPlayed = c.mtime; saveCache(); }
      }
    }
  }
  running = now;
  if (now.size) saveStats();
  if (changed) { updateCorner(); pushState(); }
}

/* ─────────────────────────── Starten ─────────────────────────── */

function spawnDetached(target, args = [], cwd) {
  const child = spawn(target, args, { cwd: cwd || path.dirname(target), detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', (e) => send('toast', { kind: 'error', text: 'Start fehlgeschlagen: ' + e.message }));
  child.unref();
}

async function runLaunch(l) {
  if (!l) throw new Error('Kein Startbefehl hinterlegt');
  if (l.kind === 'uri') return shell.openExternal(l.target);
  if (l.kind === 'exe') {
    if (!U.exists(l.target)) throw new Error('Datei nicht gefunden: ' + l.target);
    return spawnDetached(l.target, l.args || [], l.cwd);
  }
  if (l.kind === 'path') {
    const err = await shell.openPath(l.target);
    if (err) throw new Error(err);
    return;
  }
  throw new Error('Unbekannte Startart');
}

/* ─────────────────────────── Startmodus ─────────────────────────── */

function selfCommand() {
  const exe = process.execPath;
  return app.isPackaged ? { exe, args: [] } : { exe, args: [app.getAppPath()] };
}

async function applyStartMode(mode) {
  const { exe, args } = selfCommand();
  if (process.platform !== 'win32') return;
  if (mode === 'autostart') {
    app.setLoginItemSettings({ openAtLogin: true, path: exe, args });
    await helper.call('shellSet', { value: null });
  } else if (mode === 'shell') {
    app.setLoginItemSettings({ openAtLogin: false, path: exe, args });
    const q = (s) => '"' + s + '"';
    await helper.call('shellSet', { value: [q(exe)].concat(args.map(q)).concat(['--bibliothek-shell']).join(' ') });
  } else {
    app.setLoginItemSettings({ openAtLogin: false, path: exe, args });
    await helper.call('shellSet', { value: null });
  }
}

/** Im Exklusiv-Modus startet Windows keine Autostart-Programme – das übernimmt die Bibliothek. */
async function runStartupEntries() {
  const entries = (await worker.safe('runEntries', {}, [])) || [];
  for (const e of entries) {
    if (!e.cmd || e.cmd.toLowerCase().includes(process.execPath.toLowerCase())) continue;
    try { spawn(e.cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch {}
  }
  const dirs = [
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
  ];
  for (const d of dirs) {
    for (const f of U.listDir(d)) {
      if (f.isFile() && !/desktop\.ini/i.test(f.name)) shell.openPath(path.join(d, f.name));
    }
  }
}

/* ─────────────────────────── Systemwerte ─────────────────────────── */

let lastCpu = os.cpus();
function cpuPercent() {
  const now = os.cpus();
  let idle = 0;
  let total = 0;
  now.forEach((c, i) => {
    const p = lastCpu[i] ? lastCpu[i].times : { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const t = c.times;
    const dt = (t.user - p.user) + (t.nice - p.nice) + (t.sys - p.sys) + (t.idle - p.idle) + (t.irq - p.irq);
    total += dt;
    idle += t.idle - p.idle;
  });
  lastCpu = now;
  return total > 0 ? Math.round(100 * (1 - idle / total)) : 0;
}

let gpuCache = { at: 0, data: null };
function gpuInfo() {
  return new Promise((resolve) => {
    if (Date.now() - gpuCache.at < 4000) return resolve(gpuCache.data);
    execFile('nvidia-smi', ['--query-gpu=name,utilization.gpu,temperature.gpu', '--format=csv,noheader,nounits'], { timeout: 3000, windowsHide: true }, (err, out) => {
      let data = null;
      if (!err && out) {
        const [name, util, temp] = out.split('\n')[0].split(',').map((s) => s.trim());
        data = { name: name.replace(/^NVIDIA\s+/i, '').replace(/^GeForce\s+/i, ''), util: +util, temp: +temp };
      }
      gpuCache = { at: Date.now(), data };
      resolve(data);
    });
  });
}

/* ─────────────────────────── Dateien ─────────────────────────── */

const CATS = [
  { re: /\.(jpe?g|png|gif|webp|bmp|heic|svg|tiff?)$/i, cat: 'Bild', dest: 'pictures', label: 'Bilder' },
  { re: /\.(pdf|docx?|xlsx?|pptx?|odt|ods|txt|csv|md|rtf)$/i, cat: 'Dokument', dest: 'documents', label: 'Dokumente' },
  { re: /\.(mp4|mkv|mov|avi|webm|wmv)$/i, cat: 'Video', dest: 'videos', label: 'Videos' },
  { re: /\.(mp3|wav|flac|m4a|ogg|aac)$/i, cat: 'Musik', dest: 'music', label: 'Musik' },
  { re: /\.(exe|msi|msix|appx)$/i, cat: 'Installer', dest: null, label: 'Installer' },
  { re: /\.(zip|rar|7z|tar|gz)$/i, cat: 'Archiv', dest: null, label: 'Archiv' },
];

function listFolder(dir) {
  const out = [];
  for (const e of U.listDir(dir).slice(0, 800)) {
    if (/^(desktop\.ini|thumbs\.db|\$recycle\.bin)$/i.test(e.name) || e.name.startsWith('~$')) continue;
    const p = path.join(dir, e.name);
    let st = null;
    try { st = fs.statSync(p); } catch { continue; }
    out.push({ name: e.name, path: p, isDir: st.isDirectory(), size: st.size, mtime: st.mtimeMs, ext: path.extname(e.name).toLowerCase(), url: pathToFileURL(p).href });
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name, 'de', { numeric: true }) : a.isDir ? -1 : 1));
  return out;
}

function inbox() {
  const dl = app.getPath('downloads');
  const items = listFolder(dl)
    .filter((f) => !f.isDir && !/\.(crdownload|part|tmp|download)$/i.test(f.name))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 40)
    .map((f) => {
      const c = CATS.find((x) => x.re.test(f.name));
      return Object.assign(f, c ? { cat: c.cat, destKey: c.dest, destLabel: c.label } : { cat: 'Sonstiges', destKey: null, destLabel: null });
    });
  return { dir: dl, items };
}

function moveFile(src, destKey) {
  const destDir = app.getPath(destKey);
  const ext = path.extname(src);
  const base = path.basename(src, ext);
  let dest = path.join(destDir, base + ext);
  for (let n = 2; U.exists(dest); n++) dest = path.join(destDir, `${base} (${n})${ext}`);
  try { fs.renameSync(src, dest); } catch { fs.copyFileSync(src, dest); fs.unlinkSync(src); }
  return dest;
}

const iconCache = new Map();
async function fileIcon(p) {
  const ext = path.extname(p).toLowerCase();
  const perPath = ['.exe', '.lnk', '.ico', '.url', ''].includes(ext);
  const key = perPath ? 'p:' + p.toLowerCase() : 'e:' + ext;
  if (iconCache.has(key)) return iconCache.get(key);
  let url = null;
  if (perPath && ext && process.platform === 'win32') {
    const b64 = await worker.safe('icon', { path: p }, null, 10000);
    if (b64) { url = 'data:image/png;base64,' + b64; iconCache.set(key, url); return url; }
  }
  try { const img = await app.getFileIcon(p, { size: 'large' }); if (!img.isEmpty()) url = img.toDataURL(); } catch {}
  iconCache.set(key, url);
  return url;
}

/* ─────────────────────────── Windows-Werkzeuge ─────────────────────────── */

const TOOLS = {
  sound: { uri: 'ms-settings:sound' },
  display: { uri: 'ms-settings:display' },
  network: { uri: 'ms-settings:network-status' },
  bluetooth: { uri: 'ms-settings:bluetooth' },
  control: { exe: 'control.exe' },
  taskmgr: { exe: 'taskmgr.exe' },
  devmgr: { exe: 'mmc.exe', args: ['devmgmt.msc'] },
  update: { uri: 'ms-settings:windowsupdate' },
  explorer: { exe: 'explorer.exe', args: [os.homedir()] },
  apps: { uri: 'ms-settings:appsfeatures' },
  printers: { uri: 'ms-settings:printers' },
  storage: { uri: 'ms-settings:storagesense' },
  mixer: { exe: 'sndvol.exe' },
  settings: { uri: 'ms-settings:' },
  personalization: { uri: 'ms-settings:personalization' },
  power: { uri: 'ms-settings:powersleep' },
};

function openTool(key) {
  const t = TOOLS[key];
  if (!t) throw new Error('Unbekanntes Werkzeug');
  if (t.uri) shell.openExternal(t.uri);
  else spawn(t.exe, t.args || [], { detached: true, stdio: 'ignore' }).unref();
  // Explorer blendet die Taskleiste manchmal wieder ein – kurz danach erneut verstecken
  setTimeout(applyTaskbar, 2500);
}

/* ─────────────────────────── IPC ─────────────────────────── */

function handle(name, fn) {
  ipcMain.handle(name, async (_e, ...a) => {
    try { return { ok: true, data: await fn(...a) }; } catch (e) { return { ok: false, error: e.message }; }
  });
}

handle('state', () => fullState());
handle('rescan', () => { rescan(); return true; });

handle('launchGame', async (id) => {
  const g = cache.games.find((x) => x.id === id);
  if (!g) throw new Error('Spiel nicht gefunden');
  const v = gameView(g);
  // Läuft das Spiel schon? Dann direkt hinein springen statt neu zu starten
  if (g.installDir && process.platform === 'win32') {
    const wins = await windowsWithMon();
    const gw = wins.find((w) => w.path && U.isInside(w.path, g.installDir));
    if (gw) { await helper.safe('focus', { h: gw.h }); lastOther = gw.h; return { focused: true }; }
  }
  await runLaunch(v.launch);
  const s = stats.games[id] || (stats.games[id] = {});
  s.lastPlayed = Date.now();
  s.launches = (s.launches || 0) + 1;
  s.isNew = false;
  saveStats();
  // Ecke unten links sofort aus, bis die Spielerkennung greift
  running.add(id);
  updateCorner();
  setTimeout(pollRunning, 15000);
  pushState();
  return true;
});

handle('launchBnet', async (id) => {
  const g = cache.games.find((x) => x.id === id);
  if (!g || !g.bnetExe) throw new Error('Battle.net nicht gefunden');
  spawnDetached(g.bnetExe, []);
  return true;
});

handle('launchProgram', async (id) => {
  const p = cache.programs.find((x) => x.id === id);
  if (!p) throw new Error('Programm nicht gefunden');
  if (p.kind === 'uwp') spawn('explorer.exe', ['shell:AppsFolder\\' + p.appId], { detached: true, stdio: 'ignore' }).unref();
  else { const err = await shell.openPath(p.lnk); if (err) throw new Error(err); }
  const s = stats.programs[id] || (stats.programs[id] = {});
  s.launches = (s.launches || 0) + 1;
  s.last = Date.now();
  s.isNew = false;
  saveStats();
  pushState();
  return true;
});

handle('updateGame', (id, patch) => {
  const o = Object.assign({}, config.games[id] || {}, patch);
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === '') delete o[k];
  config.games[id] = o;
  saveConfig();
  pushState();
  if ('name' in patch) fetchMissingArt();
  return true;
});

handle('artNext', async (id) => {
  const g = cache.games.find((x) => x.id === id);
  if (!g) throw new Error('Spiel nicht gefunden');
  const name = (config.games[id] || {}).name || g.name;
  const prev = artMap[id] || {};
  const index = (prev.index || 0) + 1;
  const r = await Art.fetchArt({ id, name }, { dir: ART_DIR, key: config.sgdbKey, index });
  if (!r) throw new Error(config.sgdbKey ? 'Kein Cover gefunden – Namen prüfen oder eigenes Bild wählen.' : 'Kein Cover gefunden. Mit einem SteamGridDB-Schlüssel (Einstellungen) findet die Bibliothek viel mehr.');
  if (o2(id).cover) { const o = config.games[id]; delete o.cover; delete o.hero; saveConfig(); }
  artMap[id] = Object.assign({ name, tried: Date.now(), index: r.count > 1 ? index % r.count : 0 }, r);
  saveArt();
  pushState();
  return { count: r.count, source: r.source };
});
const o2 = (id) => config.games[id] || {};

/* Icons selbst auswählen (Programme & Schnellstart-Kacheln) */
handle('iconSearch', async (term) => {
  if (!config.sgdbKey) throw new Error('Für die Icon-Suche braucht die Bibliothek einen SteamGridDB-Schlüssel (Einstellungen → Bibliothek). „Eigenes Bild“ geht auch ohne.');
  return (await Art.sgdbSearch(String(term || '').trim(), config.sgdbKey)).slice(0, 8);
});
handle('iconImages', async (sgdbId) => Art.sgdbIcons(sgdbId, config.sgdbKey));
handle('brandIcons', async (term, host) => Art.brandIcons(term, host));
handle('hasSgdbKey', () => !!config.sgdbKey);
handle('iconPick', async (target, src) => {
  // src = Web-Adresse (SteamGridDB) oder Pfad zu einer eigenen Bilddatei; null = zurücksetzen
  let file = null;
  if (src) {
    const name = `custom-${String(target.id).replace(/[^a-z0-9_-]/gi, '_')}-${Date.now()}`;
    if (/^https?:/i.test(src)) file = await Art.saveImage(name, src, 'icon', ICON_DIR);
    else { fs.mkdirSync(ICON_DIR, { recursive: true }); file = path.join(ICON_DIR, name + path.extname(src).toLowerCase()); fs.copyFileSync(src, file); }
  }
  if (target.kind === 'program') {
    const o = Object.assign({}, config.programs[target.id] || {});
    if (file) o.customIcon = file; else delete o.customIcon;
    config.programs[target.id] = o;
  } else if (target.kind === 'tile') {
    config.quickTiles = (config.quickTiles || []).map((t) => (t.id === target.id ? Object.assign({}, t, { icon: file ? pathToFileURL(file).href : undefined }) : t));
  }
  saveConfig();
  pushState();
  return true;
});

/* Bilder selbst auswählen */
handle('artSearch', async (id, term) => {
  if (!config.sgdbKey) throw new Error('Für die Bildauswahl braucht die Bibliothek einen SteamGridDB-Schlüssel (Einstellungen → Bibliothek).');
  const g = cache.games.find((x) => x.id === id);
  if (!g) throw new Error('Spiel nicht gefunden');
  const name = (config.games[id] || {}).name || g.name;
  const t = (term && term.trim()) || Art.smartTerm(name);
  let games = await Art.sgdbSearch(t, config.sgdbKey);
  if (!games.length && !term) games = await Art.sgdbSearch(t.split(' ').slice(0, 3).join(' '), config.sgdbKey);
  // Steam-Spiel: exakten Treffer über die Steam-Nummer nach vorne holen
  if (!term && g.source === 'steam') {
    const exact = await Art.sgdbBySteam(g.id.replace(/^steam-/, ''), config.sgdbKey);
    if (exact) games = [exact].concat(games.filter((x) => x.id !== exact.id));
  }
  return { term: t, games: games.slice(0, 8) };
});
handle('artImages', async (sgdbId) => {
  if (!config.sgdbKey) throw new Error('Kein SteamGridDB-Schlüssel');
  const r = await Art.sgdbImages(sgdbId, config.sgdbKey);
  return { covers: r.covers.slice(0, 40), heroes: r.heroes.slice(0, 24) };
});
handle('artPick', async (id, kind, url) => {
  const file = await Art.saveImage(id, url, kind, ART_DIR);
  const a = artMap[id] || {};
  const name = (config.games[id] || {}).name || ((cache.games.find((x) => x.id === id) || {}).name);
  artMap[id] = Object.assign({}, a, { v: ART_V, name, picked: true, source: 'SteamGridDB', [kind]: file });
  const o = config.games[id];
  if (o && o[kind]) { delete o[kind]; saveConfig(); }
  saveArt();
  pushState();
  return true;
});

handle('updateProgram', (id, patch) => {
  const o = Object.assign({}, config.programs[id] || {}, patch);
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === '') delete o[k];
  config.programs[id] = o;
  saveConfig();
  pushState();
  return true;
});

handle('setConfig', async (patch) => {
  if (patch.startMode && patch.startMode !== config.startMode) {
    await applyStartMode(patch.startMode);
  }
  if (patch.shortcut && patch.shortcut !== config.shortcut) {
    globalShortcut.unregisterAll();
    if (!globalShortcut.register(patch.shortcut, bringToFront)) throw new Error('Tastenkombination ist schon belegt');
  }
  if ('ownerName' in patch) patch.ownerName = String(patch.ownerName || '').trim().slice(0, 24);
  if ('sgdbKey' in patch) {
    patch.sgdbKey = String(patch.sgdbKey || '').trim();
    if (patch.sgdbKey) await Art.testKey(patch.sgdbKey);
  }
  Object.assign(config, patch);
  saveConfig();
  if ('ownerName' in patch && win) win.setTitle(appTitle());
  if ('displayId' in patch) moveToDisplay();
  if ('winKey' in patch) helper.safe('winkey', { on: !!config.winKey });
  if ('companion' in patch) syncCompanions();
  if ('sgdbKey' in patch) { for (const k of Object.keys(artMap)) if (!artMap[k].cover) delete artMap[k]; fetchMissingArt(); }
  if ('hideTaskbar' in patch) applyTaskbar();
  if ('hotCorner' in patch) updateCorner();
  pushState();
  return true;
});

handle('pickFile', async (opts = {}) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: opts.filters, title: opts.title });
  return r.canceled ? null : r.filePaths[0];
});
handle('pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

handle('listFolder', (dir) => listFolder(dir));
handle('fileIcon', (p) => fileIcon(p));
handle('openPath', async (p) => { const err = await shell.openPath(p); if (err) throw new Error(err); return true; });
handle('showInFolder', (p) => { shell.showItemInFolder(p); setTimeout(applyTaskbar, 2500); return true; });
handle('inbox', () => inbox());
handle('moveFile', (src, destKey) => moveFile(src, destKey));

handle('system', async () => {
  const total = os.totalmem();
  return { cpu: cpuPercent(), cpuName: (os.cpus()[0] || {}).model || '', ramUsed: total - os.freemem(), ramTotal: total, gpu: await gpuInfo() };
});

handle('volume', async (action, value) => {
  if (action === 'set') await helper.call('volSet', { v: value });
  if (action === 'mute') await helper.call('muteSet', { m: !!value });
  return helper.call('volGet');
});

handle('windows', () => windowsWithMon());
handle('focusWindow', (h) => helper.call('focus', { h }));
handle('closeWindow', (h) => helper.call('closeWin', { h }));
handle('tool', (key) => openTool(key));

handle('power', async (action) => {
  const run = (cmd, args) => spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  if (action === 'lock') run('rundll32.exe', ['user32.dll,LockWorkStation']);
  else if (action === 'sleep') await helper.call('sleep');
  else if (action === 'restart') { quitting = true; run('shutdown.exe', ['/r', '/t', '0']); }
  else if (action === 'shutdown') { quitting = true; run('shutdown.exe', ['/s', '/t', '0']); }
  else if (action === 'logoff') { quitting = true; run('shutdown.exe', ['/l']); }
  return true;
});

handle('appWindow', async (action) => {
  if (action === 'front') { bringToFront(); return true; }
  if (action === 'minimize') { await showTaskbar(); win.minimize(); }
  else if (action === 'desktop') {
    await showTaskbar();
    if (IS_SHELL_LAUNCH) {
      const procs = (await helper.safe('procs', {}, [])) || [];
      if (!procs.some((p) => /\\explorer\.exe$/i.test(p))) spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref();
    }
    win.minimize();
  } else if (action === 'quit') { quitting = true; app.quit(); }
  return true;
});

/* Update über GitHub (wenn die Bibliothek per git clone installiert wurde) */
handle('update', () => new Promise((resolve, reject) => {
  const cwd = app.getAppPath();
  if (!U.exists(path.join(cwd, '.git'))) return reject(new Error('Diese Installation stammt nicht aus „git clone“ – Update bitte über START.bat oder GitHub laden.'));
  execFile('git', ['pull', '--ff-only'], { cwd, windowsHide: true, timeout: 60000 }, (err, out, errOut) => {
    if (err) return reject(new Error(/not recognized|ENOENT/i.test(String(err.message) + errOut) ? 'Git ist nicht installiert.' : 'Update fehlgeschlagen: ' + (errOut || err.message).trim().split('\n')[0]));
    if (/already up.to.date|bereits aktuell/i.test(out)) return resolve({ updated: false });
    const needInstall = /package(-lock)?\.json/.test(out);
    const finish = () => { resolve({ updated: true }); setTimeout(() => { app.relaunch(); quitting = true; app.quit(); }, 1500); };
    if (!needInstall) return finish();
    execFile(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd, windowsHide: true, timeout: 300000, shell: process.platform === 'win32' }, () => finish());
  });
}));

handle('openUrl', (url, displayId) => openUrl(url, displayId));
handle('openTile', async (tile, displayId) => {
  if (!tile) throw new Error('Unbekannte Kachel');
  if (tile.type === 'web') return openUrl(tile.url, displayId);
  if (tile.type === 'program') {
    const p = cache.programs.find((x) => x.id === tile.programId);
    if (!p) throw new Error('Programm nicht mehr gefunden');
    const run = async () => {
      if (p.kind === 'uwp') spawn('explorer.exe', ['shell:AppsFolder\\' + p.appId], { detached: true, stdio: 'ignore' }).unref();
      else { const err = await shell.openPath(p.lnk); if (err) throw new Error(err); }
    };
    const s = stats.programs[p.id] || (stats.programs[p.id] = {});
    s.launches = (s.launches || 0) + 1; s.last = Date.now(); saveStats();
    return launchOnDisplay(displayId, run, p.target);
  }
  throw new Error('Unbekannte Kachel');
});

ipcMain.on('corner-hit', () => bringToFront());

/* ─────────────────────────── Start ─────────────────────────── */

app.whenReady().then(async () => {
  createWindow();
  createCorner();
  setTimeout(syncCompanions, 1500);
  worker.start();
  helper.start().then((ok) => {
    if (!ok) return;
    applyTaskbar();
    helper.safe('winkey', { on: !!config.winKey });
    syncHwnds();
    if (IS_SHELL_LAUNCH) runStartupEntries();
    pollRunning();
  });
  try { globalShortcut.register(config.shortcut, bringToFront); } catch {}
  // Erst aus dem Zwischenspeicher anzeigen (sofort da), dann im Hintergrund frisch einlesen
  setTimeout(() => { rescan().then(setupWatchers); }, 800);
  setInterval(pollRunning, POLL_SEC * 1000);
  const onDisplays = U.debounce(() => { moveToDisplay(); pushState(); }, 800);
  screen.on('display-added', onDisplays);
  screen.on('display-removed', onDisplays);
});

app.on('second-instance', () => bringToFront());

let cleanedUp = false;
app.on('before-quit', async (e) => {
  quitting = true;
  if (cleanedUp) return;
  e.preventDefault();
  globalShortcut.unregisterAll();
  try { U.writeJSON(F.stats, stats); U.writeJSON(F.cache, cache); U.writeJSON(F.config, config); } catch {}
  // Taskleiste wiederherstellen, bevor die Bibliothek sich beendet
  await showTaskbar();
  helper.stop();
  worker.stop();
  cleanedUp = true;
  app.quit();
});

process.on('uncaughtException', (e) => console.error('Fehler:', e));
