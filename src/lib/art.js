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

async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Bibliothek/0.2' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error('Bild zu klein');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

/** Suchbegriff aufbereiten: Zusätze in Klammern weg */
function searchTerm(name) {
  return String(name).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

async function sgdbFind(name, key) {
  const auth = { Authorization: 'Bearer ' + key };
  const term = searchTerm(name);
  const r = await getJSON(`${SGDB}/search/autocomplete/${encodeURIComponent(term)}`, auth);
  const list = (r && r.data) || [];
  if (!list.length) return null;
  // Exakter Treffer bevorzugt, sonst der erste
  const exact = list.find((g) => norm(g.name) === norm(term));
  return exact || list[0];
}

async function sgdbImages(gameId, key) {
  const auth = { Authorization: 'Bearer ' + key };
  const [grids, heroes] = await Promise.all([
    getJSON(`${SGDB}/grids/game/${gameId}?dimensions=600x900,342x482,660x930&types=static&nsfw=false&humor=false`, auth).catch(() => null),
    getJSON(`${SGDB}/heroes/game/${gameId}?types=static&nsfw=false&humor=false`, auth).catch(() => null),
  ]);
  return {
    covers: ((grids && grids.data) || []).map((x) => x.url),
    heroes: ((heroes && heroes.data) || []).map((x) => x.url),
  };
}

async function steamFind(name) {
  const term = searchTerm(name);
  const r = await getJSON(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=german&cc=DE`);
  const items = (r && r.items) || [];
  const hit = items.find((i) => norm(i.name) === norm(term)) || items.find((i) => norm(i.name).startsWith(norm(term)) && norm(term).length > 5);
  if (!hit) return null;
  const cdn = `https://cdn.cloudflare.steamstatic.com/steam/apps/${hit.id}`;
  return { covers: [`${cdn}/library_600x900.jpg`], heroes: [`${cdn}/library_hero.jpg`] };
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
  const cUrl = imgs.covers[idx];
  out.cover = await download(cUrl, path.join(opt.dir, `${safe}-cover-${idx}.${ext(cUrl)}`)).catch(() => undefined);
  if (imgs.heroes.length) {
    const hUrl = imgs.heroes[idx % imgs.heroes.length];
    out.hero = await download(hUrl, path.join(opt.dir, `${safe}-hero-${idx % imgs.heroes.length}.${ext(hUrl)}`)).catch(() => undefined);
  }
  return out.cover ? out : null;
}

async function testKey(key) {
  await getJSON(`${SGDB}/search/autocomplete/${encodeURIComponent('World of Warcraft')}`, { Authorization: 'Bearer ' + key });
  return true;
}

module.exports = { fetchArt, testKey };
