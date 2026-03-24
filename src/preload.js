const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  saveFiles: (payload) => ipcRenderer.invoke('save-files', payload),
  openFolder: (dir) => ipcRenderer.invoke('open-folder', dir),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  loadLocations: () => ipcRenderer.invoke('locations-load'),
  saveLocations: (locations) => ipcRenderer.invoke('locations-save', locations),
  loadSettings: () => ipcRenderer.invoke('settings-load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings-save', settings),
  loadBusinesses: () => ipcRenderer.invoke('businesses-load'),
  saveBusiness: (b) => ipcRenderer.invoke('business-save', b),
  deleteBusiness: (id) => ipcRenderer.invoke('business-delete', id),
  setActiveBusiness: (id) => ipcRenderer.invoke('business-set-active', id),
  exportPost: (payload) => ipcRenderer.invoke('post-export', payload),
});
