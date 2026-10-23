const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSites: () => ipcRenderer.invoke('get-sites'),
  saveSites: (sites) => ipcRenderer.invoke('save-sites', sites),
  openSite: (url) => ipcRenderer.invoke('open-site', url),
  nav: (action) => ipcRenderer.invoke('nav', action),
  confirm: (message) => ipcRenderer.invoke('confirm', message),
  siteInfo: (url) => ipcRenderer.invoke('site-info', url),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  setViewVisible: (v) => ipcRenderer.invoke('set-view-visible', v),
  onNavState: (cb) => ipcRenderer.on('nav-state', (_e, s) => cb(s)),
  onLoading: (cb) => ipcRenderer.on('loading', (_e, l) => cb(l)),
  translumoStatus: () => ipcRenderer.invoke('translumo-status'),
  translumoToggle: (on) => ipcRenderer.invoke('translumo-toggle', on),
  translumoPick: () => ipcRenderer.invoke('translumo-pick'),
  onTranslumoState: (cb) => ipcRenderer.on('translumo-state', (_e, s) => cb(s)),
});
