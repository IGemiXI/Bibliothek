'use strict';
/**
 * Benachrichtigungen aus Windows mitlesen (WhatsApp, Discord, Battle.net …).
 *
 * Windows speichert alle Mitteilungen in einer SQLite-Datenbank im Benutzerordner:
 *   %LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db (+ -wal)
 * Die neuesten Einträge stehen oft noch in der Zwischendatei (-wal). Wir lesen beide,
 * führen sie im Speicher zusammen und werten sie mit sql.js aus – ohne die Originale anzufassen.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Notifications');
const DB = path.join(DIR, 'wpndatabase.db');

let SQL = null;
async function sqlJs() {
  if (!SQL) SQL = await require('sql.js')();
  return SQL;
}

/** Bestätigte Seiten aus der WAL-Datei in das Datenbank-Abbild übernehmen */
function applyWal(db, wal) {
  if (!wal || wal.length < 32) return db;
  const be = (b, o) => b.readUInt32BE(o);
  const magic = be(wal, 0);
  if (magic !== 0x377f0682 && magic !== 0x377f0683) return db;
  const pageSize = be(wal, 8);
  const salt1 = be(wal, 16);
  const salt2 = be(wal, 20);
  const frames = [];
  let lastCommit = -1;
  for (let off = 32; off + 24 + pageSize <= wal.length; off += 24 + pageSize) {
    if (be(wal, off + 8) !== salt1 || be(wal, off + 12) !== salt2) break; // alte, ungültige Einträge
    frames.push({ pg: be(wal, off), data: wal.subarray(off + 24, off + 24 + pageSize) });
    if (be(wal, off + 4) !== 0) lastCommit = frames.length - 1; // Seite schließt eine Transaktion ab
  }
  if (lastCommit < 0) return db;
  let pages = Math.ceil(db.length / pageSize);
  for (let i = 0; i <= lastCommit; i++) pages = Math.max(pages, frames[i].pg);
  const out = Buffer.alloc(pages * pageSize);
  db.copy(out, 0, 0, Math.min(db.length, out.length));
  for (let i = 0; i <= lastCommit; i++) frames[i].data.copy(out, (frames[i].pg - 1) * pageSize);
  return out;
}

/** Datenbank-Abbild für sql.js vorbereiten (WAL-Kennung entfernen) */
function asRollbackDb(buf) {
  const out = Buffer.from(buf);
  if (out.length > 20) { out[18] = 1; out[19] = 1; }
  return out;
}

const KNOWN = [
  [/discord/i, 'Discord'], [/whatsapp/i, 'WhatsApp'], [/steam/i, 'Steam'], [/battle\.?net|blizzard/i, 'Battle.net'],
  [/telegram/i, 'Telegram'], [/teams/i, 'Microsoft Teams'], [/outlook/i, 'Outlook'], [/spotify/i, 'Spotify'],
  [/chrome/i, 'Google Chrome'], [/msedge|microsoftedge/i, 'Microsoft Edge'], [/firefox/i, 'Firefox'], [/curseforge/i, 'CurseForge'],
  [/epicgames/i, 'Epic Games'], [/nvidia/i, 'NVIDIA'], [/claude/i, 'Claude'], [/signal/i, 'Signal'], [/riot/i, 'Riot Client'],
  [/instagram/i, 'Instagram'], [/thunderbird/i, 'Thunderbird'], [/xbox|gamingapp/i, 'Xbox'],
];

function appName(id) {
  const s = String(id || '');
  for (const [re, n] of KNOWN) if (re.test(s)) return n;
  if (/^Windows\.SystemToast|^Microsoft\.Windows/i.test(s)) return 'Windows';
  const parts = s.split(/[!\\/.]/).filter((x) => x && !/^(app|com|exe|squirrel|microsoft|windows|[0-9a-z]{13})$/i.test(x));
  const last = parts.pop() || s;
  return last.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

const decode = (t) => t
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&')
  .trim();

/** Zeilen [id, arrivalTime, payload, handlerId] in Benachrichtigungen umwandeln */
function parseRows(rows) {
  const out = [];
  for (const [id, arrival, payload, handler] of rows) {
    const xml = payload == null ? '' : Buffer.from(payload).toString('utf8');
    const texts = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((m) => decode(m[1])).filter(Boolean);
    if (!texts.length) continue;
    // ArrivalTime ist eine Windows-Zeit (100-ns-Schritte seit 1601)
    const ms = Number(arrival) / 10000 - 11644473600000;
    out.push({ id: String(id), time: ms > 0 ? Math.round(ms) : 0, app: appName(handler), appId: handler || '', title: texts[0], body: texts.slice(1).join(' · ') });
  }
  return out;
}

let lastStamp = '';
let cache = [];
/**
 * Liest die neuesten Benachrichtigungen. Gibt null zurück, wenn sich seit dem letzten Lesen nichts geändert hat.
 */
async function readNotifications(limit = 60, force = false) {
  const stamp = ['', '-wal'].map((x) => { try { const st = fs.statSync(DB + x); return st.mtimeMs + ':' + st.size; } catch { return '-'; } }).join('|');
  if (!force && stamp === lastStamp) return null;
  lastStamp = stamp;
  const db = fs.readFileSync(DB);
  let wal = null;
  try { wal = fs.readFileSync(DB + '-wal'); } catch {}
  const S = await sqlJs();
  const d = new S.Database(new Uint8Array(asRollbackDb(applyWal(db, wal))));
  try {
    const res = d.exec(`SELECT n.Id, n.ArrivalTime, n.Payload, h.PrimaryId FROM Notification n
      LEFT JOIN NotificationHandler h ON n.HandlerId = h.RecordId
      WHERE n.Type = 'toast' ORDER BY n.ArrivalTime DESC LIMIT ${Number(limit) || 60}`);
    cache = parseRows(res.length ? res[0].values : []);
  } finally { d.close(); }
  return cache;
}

module.exports = { readNotifications, applyWal, asRollbackDb, parseRows, appName, DB };
