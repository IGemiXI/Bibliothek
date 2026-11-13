'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = async (name, ...args) => {
  const r = await ipcRenderer.invoke(name, ...args);
  if (!r || !r.ok) throw new Error((r && r.error) || 'Unbekannter Fehler');
  return r.data;
};

contextBridge.exposeInMainWorld('gx', {
  state: () => call('state'),
  rescan: () => call('rescan'),
  launchGame: (id) => call('launchGame', id),
  launchBnet: (id) => call('launchBnet', id),
  launchProgram: (id) => call('launchProgram', id),
  updateGame: (id, patch) => call('updateGame', id, patch),
  updateProgram: (id, patch) => call('updateProgram', id, patch),
  setConfig: (patch) => call('setConfig', patch),
  pickFile: (opts) => call('pickFile', opts),
  pickFolder: () => call('pickFolder'),
  listFolder: (dir) => call('listFolder', dir),
  fileIcon: (p) => call('fileIcon', p),
  openPath: (p) => call('openPath', p),
  showInFolder: (p) => call('showInFolder', p),
  inbox: () => call('inbox'),
  moveFile: (src, destKey) => call('moveFile', src, destKey),
  system: () => call('system'),
  volume: (action, value) => call('volume', action, value),
  windows: () => call('windows'),
  focusWindow: (h) => call('focusWindow', h),
  closeWindow: (h) => call('closeWindow', h),
  tool: (key) => call('tool', key),
  power: (action) => call('power', action),
  appWindow: (action) => call('appWindow', action),
  update: () => call('update'),
  artNext: (id) => call('artNext', id),
  artSearch: (id, term) => call('artSearch', id, term),
  artImages: (sgdbId) => call('artImages', sgdbId),
  artPick: (id, kind, url) => call('artPick', id, kind, url),
  iconSearch: (term) => call('iconSearch', term),
  iconImages: (sgdbId) => call('iconImages', sgdbId),
  iconPick: (target, src) => call('iconPick', target, src),
  brandIcons: (term, host) => call('brandIcons', term, host),
  openUrl: (url, displayId) => call('openUrl', url, displayId),
  openTile: (tile, displayId) => call('openTile', tile, displayId),
  cornerHit: () => ipcRenderer.send('corner-hit'),
  startDrag: (p) => ipcRenderer.send('start-drag', p),
  notifications: () => call('notifications'),
  notifSeen: () => call('notifSeen'),
  notifOpen: (app) => call('notifOpen', app),
  on: (channel, fn) => {
    const allowed = ['state', 'toast', 'inbox-changed', 'windows', 'winkey', 'notifications'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_e, data) => fn(data));
  },
});
