'use strict';
const path = require('path');
const U = require('./util');

const SKIP_DIRS = /^(startup|autostart|windows (tools|accessories|powershell|system|administrative tools|ease of access)|accessibility|administrative tools|windows-verwaltungsprogramme|windows-zubehör|windows-system|barrierefreiheit|verwaltung|maintenance|wartung)$/i;
const SKIP_NAMES = /uninstall|deinstall|entfernen|readme|liesmich|\bhelp\b|hilfe|manual|handbuch|documentation|dokumentation|release notes|website|webseite|\bsupport\b|license|lizenz|what'?s new|changelog|repair|reparatur|benchmark/i;
const SKIP_TARGET = /\.(url|chm|txt|pdf|html?|rtf|md|ini|log)$/i;

function startMenuRoots() {
  const roots = [];
  const pd = process.env.ProgramData || 'C:\\ProgramData';
  roots.push(path.join(pd, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  if (process.env.APPDATA) roots.push(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  return roots;
}

function walk(dir, depth, out) {
  for (const e of U.listDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !SKIP_DIRS.test(e.name)) walk(p, depth - 1, out);
    } else if (e.isFile() && /\.lnk$/i.test(e.name)) {
      out.push(p);
    }
  }
}

/**
 * Programme aus dem Startmenü (klassische Programme) plus Store-Apps.
 * @param {object} o
 * @param {(p:string)=>{target:string,args:string}} o.readShortcut
 * @param {string[]} o.gameDirs Installationsordner der Spiele (die erscheinen unter „Spiele“)
 * @param {{name:string,appId:string}[]} o.startApps Store-Apps
 */
function scanPrograms({ readShortcut, gameDirs, startApps }) {
  const lnks = [];
  for (const r of startMenuRoots()) walk(r, 3, lnks);
  const byName = new Map();
  const byTarget = new Set();
  for (const lnk of lnks) {
    const name = path.basename(lnk, '.lnk').trim();
    if (!name || SKIP_NAMES.test(name)) continue;
    let target = '';
    let args = '';
    try { const s = readShortcut(lnk); target = s.target || ''; args = s.args || ''; } catch {}
    if (target && SKIP_TARGET.test(target)) continue;
    if (target && gameDirs.some((d) => U.isInside(target, d))) continue;
    const tkey = (U.normPath(target) + '|' + args).toLowerCase();
    if (target && byTarget.has(tkey)) continue;
    const key = name.toLowerCase();
    if (byName.has(key)) continue;
    if (target) byTarget.add(tkey);
    byName.set(key, { id: 'p-' + U.slug(name), kind: 'lnk', name, lnk, target, args });
  }
  for (const a of startApps || []) {
    if (!a || !a.name || !a.appId || SKIP_NAMES.test(a.name)) continue;
    const key = a.name.toLowerCase();
    if (byName.has(key)) continue;
    // Systemkram aus dem Store ausblenden
    if (/^(windows\.|microsoft\.(aad|lockapp|ecapp|win32webviewhost|creddialoghost|xboxgamecallableui|asynctextservice|windows\.(shellexperiencehost|startmenuexperiencehost|search|cloudexperiencehost|secureassessmentbrowser)))/i.test(a.appId)) continue;
    byName.set(key, { id: 'uwp-' + U.slug(a.name), kind: 'uwp', name: a.name, appId: a.appId, target: '', args: '' });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

module.exports = { scanPrograms, startMenuRoots };
