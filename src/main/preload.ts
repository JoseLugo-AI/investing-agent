import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getAccount: () => ipcRenderer.invoke('get-account'),
  getPositions: () => ipcRenderer.invoke('get-positions'),
  getOrders: () => ipcRenderer.invoke('get-orders'),
  getBars: (symbol: string, timeframe: string) =>
    ipcRenderer.invoke('get-bars', symbol, timeframe),
  saveApiKeys: (keyId: string, secretKey: string) =>
    ipcRenderer.invoke('save-api-keys', keyId, secretKey),
  hasApiKeys: () => ipcRenderer.invoke('has-api-keys'),
  clearApiKeys: () => ipcRenderer.invoke('clear-api-keys'),
});
