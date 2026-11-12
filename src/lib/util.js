'use strict';
const fs = require('fs');
const path = require('path');

/** Liest Valve-KeyValues (VDF/ACF) in ein verschachteltes Objekt. */
function parseVDF(text) {
  let i = 0;
  const n = text.length;
  const isWs = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n';
  function skip() {
    while (i < n) {
      const c = text[i];
      if (isWs(c)) { i++; continue; }
      if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
      break;
    }
  }
  function quoted() {
    i++;
    let s = '';
    while (i < n && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < n) {
        const nx = text[i + 1];
        s += nx === 'n' ? '\n' : nx === 't' ? '\t' : nx;
        i += 2;
        continue;
      }
      s += text[i++];
    }
    i++;
    return s;
  }
  function bare() {
    let s = '';
    while (i < n && !isWs(text[i]) && text[i] !== '{' && text[i] !== '}' && text[i] !== '"') s += text[i++];
    return s;
  }
  function obj() {
    const o = {};
    for (;;) {
      skip();
      if (i >= n) return o;
      if (text[i] === '}') { i++; return o; }
      const wasQuoted = text[i] === '"';
      const key = wasQuoted ? quoted() : bare();
      if (!wasQuoted && key === '') { i++; continue; }
      skip();
      if (text[i] === '{') { i++; o[key] = obj(); }
      else if (text[i] === '"') o[key] = quoted();
      else o[key] = bare();
    }
  }
  return obj();
}

/** Schlüssel ohne Rücksicht auf Groß-/Kleinschreibung holen. */
function getCI(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    const lk = String(k).toLowerCase();
    const found = Object.keys(cur).find((x) => x.toLowerCase() === lk);
    cur = found === undefined ? undefined : cur[found];
  }
  return cur;
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; }
}

function writeJSON(p, data) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, p);
  } catch (e) {
    console.error('Speichern fehlgeschlagen:', p, e.message);
  }
}

function listDir(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
}

function mtime(p) {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

/** Pfad normalisieren für Vergleiche (Windows: Groß/Klein egal, Slashes vereinheitlicht). */
function normPath(p) {
  if (!p) return '';
  return path.normalize(String(p).replace(/\//g, '\\')).replace(/[\\]+$/, '').toLowerCase();
}

function isInside(child, parent) {
  const c = normPath(child);
  const p = normPath(parent);
  return !!p && (c === p || c.startsWith(p + '\\'));
}

/** Sucht eine Datei mit bestimmtem Namen bis zu einer Tiefe. */
function findFile(dir, names, depth = 2) {
  const wanted = names.map((x) => x.toLowerCase());
  for (const e of listDir(dir)) {
    if (e.isFile() && wanted.includes(e.name.toLowerCase())) return path.join(dir, e.name);
  }
  if (depth > 0) {
    for (const e of listDir(dir)) {
      if (e.isDirectory()) {
        const r = findFile(path.join(dir, e.name), names, depth - 1);
        if (r) return r;
      }
    }
  }
  return null;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

module.exports = { parseVDF, getCI, exists, readText, readJSON, writeJSON, listDir, mtime, normPath, isInside, findFile, slug, debounce };
