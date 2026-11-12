'use strict';
const path = require('path');
const U = require('./util');

const SKIP_DIRS = /^(startup|autostart|windows (tools|accessories|powershell|system|administrative tools|ease of access)|accessibility|administrative tools|windows-verwaltungsprogramme|windows-zubehör|windows-system|barrierefreiheit|verwaltung|maintenance|wartung)$/i;
const SKIP_NAMES = /uninstall|deinstall|entfernen|readme|liesmich|\bhelp\b|hilfe|manual|handbuch|documentation|dokumentation|release notes|website|webseite|\bsupport\b|license|lizenz|what'?s new|changelog|repair|reparatur|benchmark/i;
const SKIP_TARGET = /\.(url|chm|txt|pdf|html?|rtf|md|ini|log)$/i;

/* Automatische Kategorien – Reihenfolge = Priorität */
const CATEGORIES = [
  ['ki', 'KI & Assistenten', /\b(claude|chatgpt|openai|copilot|gemini|perplexity|ollama|lm studio)\b/i],
  ['gaming', 'Gaming', /steam|battle\.net|epic games|gog galaxy|\bea app\b|\borigin\b|ubisoft|uplay|curseforge|overwolf|wowup|riot client|minecraft|\bxbox\b|playnite|geforce now|parsec|moonlight|r2modman|thunderstore|warcraft|raider\.io|weakauras|battlestate|game ?launcher|\bgames?\b/i],
  ['chat', 'Kommunikation', /discord|teamspeak|\bteams\b|skype|zoom|whatsapp|telegram|signal|slack|thunderbird|outlook|\bmail\b|element|guilded/i],
  ['web', 'Internet', /chrome|firefox|\bedge\b|opera|brave|vivaldi|tor browser|filezilla|qbittorrent|utorrent|jdownloader|vpn|proton/i],
  ['media', 'Medien', /spotify|\bvlc\b|\bobs\b|audacity|itunes|plex|kodi|\bmpc\b|potplayer|foobar|streamlabs|voicemeeter|handbrake|winamp|netflix|prime video|disney|youtube|tidal|deezer|amazon music|media player/i],
  ['create', 'Kreativ', /blender|gimp|photoshop|lightroom|illustrator|premiere|after effects|davinci|krita|paint\.net|inkscape|affinity|figma|canva|clip studio|aseprite|unity|unreal|godot|substance|fusion 360|\bcura\b|prusa|bambu|orca ?slicer|capcut/i],
  ['dev', 'Entwicklung', /visual studio|vs ?code|\bcode\b|\bgit\b|github|gitkraken|python|node\.?js|android studio|intellij|pycharm|webstorm|rider|eclipse|postman|docker|\bwsl\b|terminal|powershell|putty|winscp|sublime|notepad\+\+|cursor|arduino|platformio|mysql|dbeaver|xampp|anaconda|jupyter|virtualbox|vmware|hyper-v|proxmox/i],
  ['office', 'Büro', /\bword\b|excel|powerpoint|onenote|\baccess\b|publisher|acrobat|adobe reader|\bpdf\b|libreoffice|openoffice|onlyoffice|notion|obsidian|evernote|to ?do|kalender|calendar|banking|elster|steuer/i],
  ['tools', 'System & Tools', /nvidia|geforce|\bamd\b|radeon|intel|logitech|g hub|corsair|icue|razer|synapse|steelseries|\bmsi\b|asus|armoury|gigabyte|realtek|7-zip|winrar|peazip|ccleaner|rufus|etcher|crystaldisk|hwinfo|hwmonitor|cpu-z|gpu-z|afterburner|everything|powertoys|treesize|windirstat|revo|driver|treiber|backup|macrium|ventoy|teamviewer|anydesk|rustdesk|bitwarden|keepass|1password|malwarebytes|avast|\bavg\b|kaspersky|norton|bitdefender|magician|tailscale|wireguard|openvpn|update|monitor|benchmark/i],
  ['windows', 'Windows', /^(rechner|calculator|editor|notepad|paint|snipping|ausschneide|fotos|photos|kamera|camera|uhr|clock|wetter|weather|karten|maps|microsoft store|tipps|tips|get help|hilfe|feedback|xbox game bar|filme|movies|groove|kurznotizen|sticky notes|sprachrekorder|sound recorder|cortana|news|nachrichten|solitaire|clipchamp|power automate|remotehilfe|quick assist|remotedesktop|remote desktop|systeminformationen|registrierungs|eingabeaufforderung|command prompt|ausführen|windows|smartphone-link|phone link|dev home|family|einstellungen|settings|bildschirmlupe|magnifier|sprachausgabe|narrator|bildschirmtastatur|on-screen keyboard|zeichentabelle|character map|wordpad|xps|fax|aufgabenplanung|task scheduler|ereignisanzeige|event viewer|dienste|services|datenträger|disk|ressourcenmonitor|resource monitor|systemkonfiguration|odbc|iscsi|leistungsüberwachung|performance monitor|computerverwaltung|computer management|defragment|laufwerke|recovery|wiederherstellung|lautstärke|mixer|snip)/i],
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(([k, l]) => [k, l]).concat([['other', 'Sonstiges']]));

function categorize(p) {
  const hay = p.name + ' ' + (p.target ? path.basename(p.target) : '');
  if (p.kind === 'uwp' && /^Microsoft\.(Windows|ZuneVideo|ZuneMusic|BingWeather|BingNews|GetHelp|Getstarted|MicrosoftSolitaire|People|WindowsCamera|WindowsAlarms|WindowsCalculator|WindowsMaps|WindowsSoundRecorder|Paint|ScreenSketch|Photos|Todos|PowerAutomate|MicrosoftStickyNotes|WindowsFeedbackHub|YourPhone|549981C3F5F10|Clipchamp|DevHome|OutlookForWindows|MicrosoftFamily|WindowsNotepad|WindowsTerminal|XboxGamingOverlay)/i.test(p.appId || '')) {
    if (/terminal/i.test(p.appId)) return 'dev';
    if (/xboxgamingoverlay/i.test(p.appId)) return 'gaming';
    return 'windows';
  }
  if (p.target && /^[a-z]:\\windows\\/i.test(p.target)) return 'windows';
  for (const [key, , re] of CATEGORIES) if (re.test(hay)) return key;
  return 'other';
}

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
  const list = [...byName.values()];
  for (const p of list) p.category = categorize(p);
  return list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

module.exports = { scanPrograms, startMenuRoots, categorize, CATEGORY_LABELS };
