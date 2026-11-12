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
const { scanGames, wowLastCharacter } = require('./lib/games');
const { scanPrograms, startMenuRoots } = require('./lib/programs');

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
};

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
let stats = Object.assign({ games: {}, programs: {}, known: [], firstScanDone: false }, U.readJSON(F.stats, {}));
let cache = Object.assign({ games: [], programs: [], icons: {}, sources: {}, scannedAt: 0 }, U.readJSON(F.cache, {}));

const saveConfig = U.debounce(() => U.writeJSON(F.config, config), 300);
const saveStats = U.debounce(() => U.writeJSON(F.stats, stats), 1000);
const saveCache = U.debounce(() => U.writeJSON(F.cache, cache), 500);

let running = new Set();     // IDs laufender Spiele
let scanning = false;

/* ─────────────────────────── Fenster ─────────────────────────── */

let win = null;
let corner = null;
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
  win.once('ready-to-show', () => { win.show(); win.focus(); });
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
  win.setAlwaysOnTop(true);
  win.focus();
  setTimeout(() => { if (win && !win.isDestroyed()) win.setAlwaysOnTop(false); }, 150);
  applyTaskbar();
}

/* Windows-Taste: zwischen Bibliothek und dem zuletzt aktiven Fenster (z. B. WoW) hin- und herschalten */
let lastOther = null;
function ownHandle() {
  try { const b = win.getNativeWindowHandle(); return b.length >= 8 ? Number(b.readBigInt64LE(0)) : b.readInt32LE(0); } catch { return 0; }
}
function onWinKey(ev) {
  if (!win || win.isDestroyed()) return;
  const fg = Number(ev && ev.fg) || 0;
  const mine = ownHandle();
  if (win.isFocused() || (fg && fg === mine)) {
    if (lastOther) helper.safe('focus', { h: lastOther });
    else win.minimize();
  } else {
    if (fg && fg !== mine) lastOther = fg;
    bringToFront();
    send('winkey');
  }
}
helper.on('winkey', onWinKey);

function applyTaskbar() {
  if (process.platform !== 'win32') return;
  helper.safe('taskbar', { show: !config.hideTaskbar });
}

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
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
    art: Object.assign({}, g.art, o.cover ? { cover: [pathToFileURL(o.cover).href].concat(g.art.cover || []) } : {}, o.hero ? { hero: [pathToFileURL(o.hero).href].concat(g.art.hero || []) } : {}),
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

function programView(p) {
  const o = config.programs[p.id] || {};
  const s = stats.programs[p.id] || {};
  return {
    id: p.id, kind: p.kind, name: o.name || p.name, target: p.target, lnk: p.lnk,
    icon: cache.icons[p.id] || null, hidden: !!o.hidden, favorite: !!o.favorite,
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
      startMode: config.startMode, hideTaskbar: config.hideTaskbar, hotCorner: config.hotCorner,
      shortcut: config.shortcut, folders: config.folders, customTiles: config.customTiles,
    },
    user: os.userInfo().username,
    computer: os.hostname(),
    version: app.getVersion(),
    displays: displayList(),
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

async function loadIcons(programs) {
  if (process.platform !== 'win32') return;
  const todo = programs.filter((p) => !cache.icons[p.id] && p.kind === 'lnk');
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const p = todo[i++];
      const src = p.target && /\.exe$/i.test(p.target) && U.exists(p.target) ? p.target : p.lnk;
      try {
        const img = await app.getFileIcon(src, { size: 'large' });
        if (!img.isEmpty()) cache.icons[p.id] = img.toDataURL();
      } catch {}
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
}

async function rescan() {
  if (scanning) return;
  scanning = true;
  pushState();
  try {
    const { games, sources } = await scanGames(helper);
    const startApps = process.platform === 'win32' ? await helper.safe('startApps', {}, [], 30000) : [];
    const programs = scanPrograms({
      readShortcut: (p) => shell.readShortcutLink(p),
      gameDirs: games.map((g) => g.installDir).filter(Boolean),
      startApps,
    });
    markNew('g', games);
    markNew('p', programs);
    stats.firstScanDone = true;
    cache.games = games;
    cache.programs = programs;
    cache.sources = Object.assign(sources, { programs: programs.length });
    cache.scannedAt = Date.now();
    pushState();
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
  const procs = await helper.safe('procs', {}, null, 20000);
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
        if (c) { g.wowCharacter = { name: c.name, realm: c.realm }; g.extLastPlayed = c.mtime; saveCache(); }
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
  const entries = (await helper.safe('runEntries', {}, [])) || [];
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
  Object.assign(config, patch);
  saveConfig();
  if ('ownerName' in patch && win) win.setTitle(appTitle());
  if ('displayId' in patch) moveToDisplay();
  if ('winKey' in patch) helper.safe('winkey', { on: !!config.winKey });
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

handle('windows', async () => {
  const list = (await helper.call('windows', { selfPid: process.pid })) || [];
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
});
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
  if (action === 'minimize') { await helper.safe('taskbar', { show: true }); win.minimize(); }
  else if (action === 'desktop') {
    await helper.safe('taskbar', { show: true });
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

ipcMain.on('corner-hit', () => bringToFront());

/* ─────────────────────────── Start ─────────────────────────── */

app.whenReady().then(async () => {
  createWindow();
  createCorner();
  helper.start().then((ok) => {
    if (!ok) return;
    applyTaskbar();
    helper.safe('winkey', { on: !!config.winKey });
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
  await helper.safe('taskbar', { show: true }, null, 3000);
  helper.stop();
  cleanedUp = true;
  app.quit();
});

process.on('uncaughtException', (e) => console.error('Fehler:', e));
