'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const U = require('./util');

const PD = process.env.ProgramData || 'C:\\ProgramData';
const fileUrl = (p) => (p ? pathToFileURL(p).href : null);

/* ───────────────────────────── Steam ───────────────────────────── */

const STEAM_SKIP_IDS = new Set(['228980', '250820', '1070560', '1391110', '1628350', '1493710', '1826330']);
const STEAM_SKIP_NAMES = /redistributable|steamworks common|steam linux runtime|proton|steamvr|dedicated server/i;

function steamLibraries(steamPath) {
  const libs = new Set([steamPath]);
  const vdf = U.readText(path.join(steamPath, 'steamapps', 'libraryfolders.vdf'));
  if (vdf) {
    const root = U.getCI(U.parseVDF(vdf), 'libraryfolders') || {};
    for (const v of Object.values(root)) {
      if (typeof v === 'string' && /[\\/]/.test(v)) libs.add(v);
      else if (v && typeof v === 'object') {
        const p = U.getCI(v, 'path');
        if (p) libs.add(p);
      }
    }
  }
  return [...libs].map((p) => path.normalize(p));
}

function steamUserConfig(steamPath) {
  // Neueste localconfig.vdf = zuletzt angemeldeter Steam-Nutzer
  const ud = path.join(steamPath, 'userdata');
  let best = null;
  for (const e of U.listDir(ud)) {
    if (!e.isDirectory()) continue;
    const f = path.join(ud, e.name, 'config', 'localconfig.vdf');
    const m = U.mtime(f);
    if (m && (!best || m > best.m)) best = { f, m };
  }
  if (!best) return {};
  const txt = U.readText(best.f);
  if (!txt) return {};
  const apps = U.getCI(U.parseVDF(txt), 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'apps') || {};
  return apps;
}

function steamArt(steamPath, appid) {
  const lc = path.join(steamPath, 'appcache', 'librarycache');
  const pick = (flat, names) => {
    for (const f of flat) { const p = path.join(lc, f); if (U.exists(p)) return p; }
    return U.findFile(path.join(lc, appid), names, 2);
  };
  const cover = pick([`${appid}_library_600x900.jpg`, `${appid}_library_600x900_2x.jpg`], ['library_600x900.jpg', 'library_600x900_2x.jpg', 'library_capsule.jpg']);
  const hero = pick([`${appid}_library_hero.jpg`], ['library_hero.jpg']);
  const logo = pick([`${appid}_logo.png`], ['logo.png']);
  const cdn = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}`;
  const cdn2 = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}`;
  return {
    cover: [fileUrl(cover), `${cdn}/library_600x900.jpg`, `${cdn2}/library_600x900.jpg`].filter(Boolean),
    hero: [fileUrl(hero), `${cdn}/library_hero.jpg`, `${cdn2}/library_hero.jpg`].filter(Boolean),
    logo: [fileUrl(logo), `${cdn}/logo.png`].filter(Boolean),
  };
}

async function scanSteam(helper) {
  let steamPath = await helper.safe('steamPath', {}, null);
  if (!steamPath) steamPath = 'C:\\Program Files (x86)\\Steam';
  steamPath = path.normalize(String(steamPath));
  if (!U.exists(steamPath)) return [];
  const userApps = steamUserConfig(steamPath);
  const games = [];
  for (const lib of steamLibraries(steamPath)) {
    const sa = path.join(lib, 'steamapps');
    for (const e of U.listDir(sa)) {
      if (!e.isFile() || !/^appmanifest_\d+\.acf$/i.test(e.name)) continue;
      const st = U.getCI(U.parseVDF(U.readText(path.join(sa, e.name)) || ''), 'AppState');
      if (!st) continue;
      const appid = String(U.getCI(st, 'appid') || '');
      const name = U.getCI(st, 'name') || '';
      const flags = parseInt(U.getCI(st, 'StateFlags') || '0', 10);
      if (!appid || !name || STEAM_SKIP_IDS.has(appid) || STEAM_SKIP_NAMES.test(name)) continue;
      if (!(flags & 4)) continue; // nicht vollständig installiert
      const ua = U.getCI(userApps, appid) || {};
      games.push({
        id: 'steam-' + appid,
        source: 'steam',
        sourceName: 'Steam',
        name,
        installDir: path.join(sa, 'common', U.getCI(st, 'installdir') || ''),
        launch: { kind: 'uri', target: `steam://rungameid/${appid}` },
        art: steamArt(steamPath, appid),
        extLastPlayed: (parseInt(U.getCI(ua, 'LastPlayed') || '0', 10) || 0) * 1000,
        extPlaySec: (parseInt(U.getCI(ua, 'Playtime') || '0', 10) || 0) * 60,
      });
    }
  }
  return games;
}

/* ─────────────────────────── Battle.net ─────────────────────────── */

const WOW_FLAVORS = {
  _retail_: 'World of Warcraft',
  _classic_: 'World of Warcraft Classic',
  _classic_era_: 'WoW Classic Era',
  _anniversary_: 'WoW Classic Anniversary',
};
// Bekannte Battle.net-Startcodes (für „launch <Code>“). Unbekannte Spiele öffnen Battle.net.
const BNET_CODES = { fenris: 'Fen', diablo4: 'Fen', hs_beta: 'WTCG', hearthstone: 'WTCG', prometheus: 'Pro', overwatch: 'Pro', osi: 'OSI', diablo3: 'D3', s2: 'S2', s1: 'S1', w3: 'W3' };

function prettyFlavor(folder) {
  const inner = folder.replace(/^_+|_+$/g, '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return 'World of Warcraft (' + inner + ')';
}

function wowExe(dir) {
  const exes = U.listDir(dir)
    .filter((e) => e.isFile() && /^wow.*\.exe$/i.test(e.name) && !/error|voice|proxy|launcher|setup|crash|update/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.length - b.length);
  return exes.length ? path.join(dir, exes[0]) : null;
}

/** Zuletzt benutzter Charakter aus dem WTF-Ordner (Ordner mit neuester Änderung). */
function wowLastCharacter(flavorDir) {
  const acc = path.join(flavorDir, 'WTF', 'Account');
  let best = null;
  for (const a of U.listDir(acc)) {
    if (!a.isDirectory() || /^savedvariables$/i.test(a.name)) continue;
    for (const r of U.listDir(path.join(acc, a.name))) {
      if (!r.isDirectory() || /^savedvariables$/i.test(r.name)) continue;
      for (const c of U.listDir(path.join(acc, a.name, r.name))) {
        if (!c.isDirectory()) continue;
        const cdir = path.join(acc, a.name, r.name, c.name);
        const m = Math.max(U.mtime(cdir), U.mtime(path.join(cdir, 'SavedVariables')), U.mtime(path.join(cdir, 'AddOns.txt')), U.mtime(path.join(cdir, 'config-cache.wtf')));
        if (!best || m > best.mtime) best = { name: c.name, realm: r.name, mtime: m };
      }
    }
  }
  if (best && /^\d+$/.test(best.realm)) {
    const cfg = U.readText(path.join(flavorDir, 'WTF', 'Config.wtf')) || '';
    const m = cfg.match(/SET realmName "([^"]+)"/i);
    best.realm = m ? m[1] : '';
  }
  return best;
}

async function scanBattlenet(helper, uninstall) {
  const entries = (uninstall || []).filter((e) => e && /blizzard/i.test(e.Publisher || ''));
  const bnetEntry = entries.find((e) => /^battle\.net$/i.test((e.DisplayName || '').trim()));
  const bnetExe = [
    bnetEntry && bnetEntry.InstallLocation && path.join(bnetEntry.InstallLocation, 'Battle.net.exe'),
    'C:\\Program Files (x86)\\Battle.net\\Battle.net.exe',
    'C:\\Program Files\\Battle.net\\Battle.net.exe',
  ].find((p) => p && U.exists(p));

  const games = [];
  const wowRoots = new Set();
  for (const e of entries) {
    if (e === bnetEntry) continue;
    const name = (e.DisplayName || '').trim();
    const loc = e.InstallLocation ? path.normalize(e.InstallLocation) : '';
    const uid = ((e.UninstallString || '').match(/--uid=([^\s"]+)/) || [])[1] || '';
    if (/world of warcraft/i.test(name) || /^wow/i.test(uid)) {
      if (loc) wowRoots.add(loc);
      continue;
    }
    if (!name || !loc || !U.exists(loc)) continue;
    const code = BNET_CODES[uid.toLowerCase()];
    games.push({
      id: 'bnet-' + U.slug(uid || name),
      source: 'battlenet',
      sourceName: 'Battle.net',
      name,
      installDir: loc,
      launch: bnetExe ? { kind: 'exe', target: bnetExe, args: code ? ['--exec=launch ' + code] : [] } : { kind: 'uri', target: 'battlenet://' },
      launchNote: code ? null : 'Startcode unbekannt – öffnet Battle.net',
      art: { cover: [], hero: [], logo: [] },
    });
  }
  // Standardpfad prüfen, falls der Registry-Eintrag fehlt
  for (const p of ['C:\\Program Files (x86)\\World of Warcraft', 'C:\\Program Files\\World of Warcraft']) if (U.exists(p)) wowRoots.add(p);

  const seen = new Set();
  for (const root of wowRoots) {
    for (const f of U.listDir(root)) {
      if (!f.isDirectory() || !/^_.+_$/.test(f.name) || /ptr|beta|test/i.test(f.name)) continue;
      const dir = path.join(root, f.name);
      const exe = wowExe(dir);
      if (!exe || seen.has(U.normPath(dir))) continue;
      seen.add(U.normPath(dir));
      const char = wowLastCharacter(dir);
      games.push({
        id: 'bnet-wow-' + U.slug(f.name),
        source: 'battlenet',
        sourceName: 'Battle.net',
        name: WOW_FLAVORS[f.name.toLowerCase()] || prettyFlavor(f.name),
        installDir: dir,
        // WoW über Battle.net öffnen – dort klickst du selbst auf „Spielen“ (Direktstart verlangt eine erneute Anmeldung)
        launch: bnetExe ? { kind: 'exe', target: bnetExe, args: [] } : { kind: 'exe', target: exe, args: [], cwd: dir },
        directExe: exe,
        bnetExe: bnetExe || null,
        art: { cover: [], hero: [], logo: [], scene: 'castle' },
        wowCharacter: char ? { name: char.name, realm: char.realm || '' } : null,
        extLastPlayed: char ? char.mtime : 0,
      });
    }
  }
  return games;
}

/* ───────────────────────────── Epic ───────────────────────────── */

function scanEpic() {
  const dir = path.join(PD, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  const games = [];
  for (const e of U.listDir(dir)) {
    if (!e.isFile() || !/\.item$/i.test(e.name)) continue;
    const m = U.readJSON(path.join(dir, e.name), null);
    if (!m || m.bIsIncompleteInstall) continue;
    if (Array.isArray(m.AppCategories) && !m.AppCategories.includes('games')) continue;
    if (!m.DisplayName || !m.InstallLocation) continue;
    const id = `${m.CatalogNamespace}%3A${m.CatalogItemId}%3A${m.AppName}`;
    games.push({
      id: 'epic-' + U.slug(m.AppName),
      source: 'epic',
      sourceName: 'Epic Games',
      name: m.DisplayName,
      installDir: path.normalize(m.InstallLocation),
      launch: { kind: 'uri', target: `com.epicgames.launcher://apps/${id}?action=launch&silent=true` },
      art: { cover: [], hero: [], logo: [] },
    });
  }
  return games;
}

/* ───────────────────────────── Riot ───────────────────────────── */

const RIOT_PRODUCTS = [['league_of_legends', 'League of Legends'], ['valorant', 'VALORANT'], ['bacon', 'Legends of Runeterra']];

function scanRiot() {
  const base = path.join(PD, 'Riot Games');
  const installs = U.readJSON(path.join(base, 'RiotClientInstalls.json'), {});
  const rc = [installs.rc_default, installs.rc_live, 'C:\\Riot Games\\Riot Client\\RiotClientServices.exe'].find((p) => p && U.exists(p));
  if (!rc) return [];
  const games = [];
  for (const [pid, name] of RIOT_PRODUCTS) {
    const yml = U.readText(path.join(base, 'Metadata', `${pid}.live`, `${pid}.live.product_settings.yaml`));
    if (!yml) continue;
    const m = yml.match(/product_install_full_path:\s*"?([^"\r\n]+)"?/);
    const dir = m ? path.normalize(m[1].trim()) : '';
    if (dir && !U.exists(dir)) continue;
    games.push({
      id: 'riot-' + pid,
      source: 'riot',
      sourceName: 'Riot',
      name,
      installDir: dir,
      launch: { kind: 'exe', target: path.normalize(rc), args: ['--launch-product=' + pid, '--launch-patchline=live'] },
      art: { cover: [], hero: [], logo: [] },
    });
  }
  return games;
}

/* ───────────────────────────── GOG ───────────────────────────── */

async function scanGog(helper) {
  const list = (await helper.safe('gog', {}, [])) || [];
  return list
    .filter((g) => g && g.gameName && g.exe && U.exists(g.exe))
    .map((g) => ({
      id: 'gog-' + (g.gameID || U.slug(g.gameName)),
      source: 'gog',
      sourceName: 'GOG',
      name: g.gameName,
      installDir: g.path ? path.normalize(g.path) : path.dirname(g.exe),
      launch: { kind: 'exe', target: g.exe, args: g.launchParam ? [String(g.launchParam)] : [], cwd: g.workingDir || g.path || path.dirname(g.exe) },
      art: { cover: [], hero: [], logo: [] },
    }));
}

/* ─────────────────────────── Gesamt-Scan ─────────────────────────── */

async function scanGames(helper) {
  const uninstall = await helper.safe('uninstall', {}, [], 30000);
  const results = await Promise.allSettled([scanSteam(helper), scanBattlenet(helper, uninstall), Promise.resolve(scanEpic()), Promise.resolve(scanRiot()), scanGog(helper)]);
  const sources = {};
  const all = [];
  const names = ['steam', 'battlenet', 'epic', 'riot', 'gog'];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { sources[names[i]] = r.value.length; all.push(...r.value); }
    else { sources[names[i]] = -1; console.error('Scan', names[i], r.reason); }
  });
  const seen = new Set();
  const games = all.filter((g) => (seen.has(g.id) ? false : seen.add(g.id)));
  return { games, sources };
}

module.exports = { scanGames, wowLastCharacter, steamLibraries };
