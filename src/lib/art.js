'use strict';
/**
 * Cover & Titelbilder für Spiele, die keine eigenen Bilder mitbringen
 * (Battle.net, Epic, Riot, GOG …).
 *
 * Quellen:
 *  1. SteamGridDB – riesige Sammlung, auch WoW, LoL usw. Braucht einen kostenlosen API-Schlüssel.
 *  2. Steam-Shop-Suche – ohne Schlüssel, findet Spiele, die es auch auf Steam gibt.
 */
const fs = require('fs');
const path = require('path');

const SGDB = 'https://www.steamgriddb.com/api/v2';

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[™®©]/g, '')
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9äöüß]+/g, ' ')
  .trim();

async function getJSON(url, headers) {
  const res = await fetch(url, { headers: Object.assign({ 'User-Agent': 'Bibliothek/0.2' }, headers || {}) });
  if (res.status === 401 || res.status === 403) throw new Error('SteamGridDB-Schlüssel ungültig');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function download(url, file, minSize = 2000) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Bibliothek/0.2' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minSize) throw new Error('Bild zu klein');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

/** Suchbegriff aufbereiten: Zusätze in Klammern weg */
function searchTerm(name) {
  return String(name).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Bessere Suchbegriffe für bekannte Fälle */
function smartTerm(name) {
  const n = String(name);
  if (/classic era|anniversary|hardcore/i.test(n) && /wow|warcraft/i.test(n)) return 'World of Warcraft Classic';
  if (/^wow\b/i.test(n)) return n.replace(/^wow\b/i, 'World of Warcraft');
  return searchTerm(n);
}

async function sgdbSearch(term, key) {
  const r = await getJSON(`${SGDB}/search/autocomplete/${encodeURIComponent(term)}`, { Authorization: 'Bearer ' + key });
  return ((r && r.data) || []).map((g) => ({ id: g.id, name: g.name, year: g.release_date ? new Date(g.release_date * 1000).getFullYear() : null }));
}

/* Steam-Spiele exakt über ihre Steam-Nummer finden */
async function sgdbBySteam(appid, key) {
  const r = await getJSON(`${SGDB}/games/steam/${appid}`, { Authorization: 'Bearer ' + key }).catch(() => null);
  const g = r && r.data;
  return g ? { id: g.id, name: g.name, year: g.release_date ? new Date(g.release_date * 1000).getFullYear() : null } : null;
}

async function sgdbFind(name, key) {
  // Erst der volle Name, dann schrittweise kürzer („World of Warcraft Forever“ → „World of Warcraft“)
  const words = smartTerm(name).split(' ');
  for (let n = words.length; n >= Math.min(2, words.length); n--) {
    const term = words.slice(0, n).join(' ');
    const list = await sgdbSearch(term, key);
    if (!list.length) continue;
    const exact = list.find((g) => norm(g.name) === norm(term));
    return exact || list[0];
  }
  return null;
}

/* Nur saubere Bilder, sortiert nach Bewertung der Community */
const clean = (x) => !x.nsfw && !x.humor && !x.epilepsy && !(x.tags || []).some((t) => /nsfw|humor|meme/i.test(t));
const rank = (a, b) => (b.score || 0) - (a.score || 0) || (b.upvotes || 0) - (a.upvotes || 0);

async function sgdbImages(gameId, key) {
  const auth = { Authorization: 'Bearer ' + key };
  const q = 'nsfw=false&humor=false&epilepsy=false&types=static';
  const [grids, heroes] = await Promise.all([
    getJSON(`${SGDB}/grids/game/${gameId}?dimensions=600x900,342x482,660x930&${q}`, auth).catch(() => null),
    getJSON(`${SGDB}/heroes/game/${gameId}?${q}`, auth).catch(() => null),
  ]);
  const pick = (r) => ((r && r.data) || []).filter(clean).sort(rank).map((x) => ({ url: x.url, thumb: x.thumb || x.url, score: x.score || 0 }));
  return { covers: pick(grids), heroes: pick(heroes) };
}

async function steamFind(name) {
  const term = searchTerm(name);
  const r = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=german&cc=DE`);
  const items = (r && r.items) || [];
  const hit = items.find((i) => norm(i.name) === norm(term)) || items.find((i) => norm(i.name).startsWith(norm(term)) && norm(term).length > 5);
  if (!hit) return null;
  const cdn = `https://cdn.cloudflare.steamstatic.com/steam/apps/${hit.id}`;
  return { covers: [{ url: `${cdn}/library_600x900.jpg`, thumb: `${cdn}/library_600x900.jpg` }], heroes: [{ url: `${cdn}/library_hero.jpg`, thumb: `${cdn}/library_hero.jpg` }] };
}

/**
 * Sucht und speichert Bilder für ein Spiel.
 * @param {{id:string,name:string}} game
 * @param {{dir:string,key?:string,index?:number}} opt index = welches Cover (für „Anderes Cover“)
 * @returns {Promise<{cover?:string,hero?:string,source:string,count:number}|null>}
 */
async function fetchArt(game, opt) {
  let imgs = null;
  let source = '';
  if (opt.key) {
    const g = await sgdbFind(game.name, opt.key);
    if (g) { imgs = await sgdbImages(g.id, opt.key); source = 'SteamGridDB'; }
  }
  if (!imgs || !imgs.covers.length) {
    const s = await steamFind(game.name).catch(() => null);
    if (s) { imgs = s; source = 'Steam'; }
  }
  if (!imgs || !imgs.covers.length) return null;
  const idx = (opt.index || 0) % imgs.covers.length;
  const out = { source, count: imgs.covers.length };
  const safe = game.id.replace(/[^a-z0-9_-]/gi, '_');
  const ext = (u) => (u.match(/\.(png|jpe?g|webp)(\?|$)/i) || [, 'jpg'])[1].toLowerCase();
  const cUrl = imgs.covers[idx].url;
  out.cover = await download(cUrl, path.join(opt.dir, `${safe}-cover-${idx}.${ext(cUrl)}`)).catch(() => undefined);
  if (imgs.heroes.length) {
    const hUrl = imgs.heroes[0].url;
    out.hero = await download(hUrl, path.join(opt.dir, `${safe}-hero-auto.${ext(hUrl)}`)).catch(() => undefined);
  }
  return out.cover ? out : null;
}

async function testKey(key) {
  await getJSON(`${SGDB}/search/autocomplete/${encodeURIComponent('World of Warcraft')}`, { Authorization: 'Bearer ' + key });
  return true;
}

/** Icons (quadratisch) – auch für Apps wie Discord, Spotify, WhatsApp */
async function sgdbIcons(gameId, key) {
  const r = await getJSON(`${SGDB}/icons/game/${gameId}?types=static&nsfw=false&humor=false&epilepsy=false&mimes=image/png`, { Authorization: 'Bearer ' + key }).catch(() => null);
  return ((r && r.data) || []).filter(clean).sort(rank).map((x) => ({ url: x.url, thumb: x.thumb || x.url }));
}

/** Ein gewähltes Bild speichern – Dateiendung nach dem echten Inhalt (SVG, PNG, ICO …) */
async function saveImage(gameId, url, kind, dir) {
  const safe = gameId.replace(/[^a-z0-9_-]/gi, '_');
  const res = await fetch(url, { headers: { 'User-Agent': 'Bibliothek/0.6' } });
  if (!res.ok) throw new Error('Bild konnte nicht geladen werden (HTTP ' + res.status + ')');
  const type = (res.headers.get('content-type') || '').toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error('Bild ist leer');
  const e = /svg/.test(type) ? 'svg' : /png/.test(type) ? 'png' : /icon|ico/.test(type) ? 'ico' : /webp/.test(type) ? 'webp' : /gif/.test(type) ? 'gif'
    : ((url.match(/\.(png|jpe?g|webp|svg|ico)(\?|$)/i) || [, 'jpg'])[1].toLowerCase());
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safe}-${kind}-${Date.now()}.${e}`);
  fs.writeFileSync(file, buf);
  return file;
}

/* ───── Marken-Logos ohne Schlüssel (Simple Icons) und Website-Symbole ───── */
const SI = 'https://cdn.simpleicons.org';
function brandSlugs(term) {
  const t = String(term || '').toLowerCase().trim();
  const slug = (x) => x.replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const words = t.split(/\s+/).filter(Boolean);
  const cand = [slug(t), words[0] && slug(words[0]), slug(t.replace(/\b(app|desktop|launcher|client|for windows|beta)\b/g, '')), 'google' + slug(t)];
  if (/youtube music/.test(t)) cand.unshift('youtubemusic');
  if (/gemini/.test(t)) cand.unshift('googlegemini');
  if (/chrome/.test(t)) cand.unshift('googlechrome');
  if (/visual studio code|vs ?code/.test(t)) cand.unshift('visualstudiocode');
  return [...new Set(cand.filter((x) => x && x.length > 1))];
}
async function exists(url) {
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Bibliothek/0.6' } }); return r.ok && /svg/.test(r.headers.get('content-type') || ''); } catch { return false; }
}
/** Logos zu einem Namen: je Treffer in Originalfarbe, Weiß und Gold; bei Websites zusätzlich deren Symbol */
async function brandIcons(term, host) {
  const out = [];
  const found = [];
  for (const sl of brandSlugs(term)) {
    if (found.length >= 2) break;
    if (await exists(`${SI}/${sl}`)) found.push(sl);
  }
  for (const sl of found) {
    for (const [c, label] of [['', 'Original'], ['/ffffff', 'Weiß'], ['/e7c98a', 'Gold']]) {
      const u = `${SI}/${sl}${c}`;
      out.push({ url: u, thumb: u, label: `${sl} · ${label}`, source: 'Simple Icons' });
    }
  }
  if (host) {
    for (const u of [`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`, `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`]) {
      out.push({ url: u, thumb: u, label: 'Website-Symbol', source: 'Website' });
    }
  }
  return out;
}

module.exports = { fetchArt, testKey, sgdbSearch, sgdbBySteam, sgdbIcons, brandIcons, sgdbImages, smartTerm, saveImage };
