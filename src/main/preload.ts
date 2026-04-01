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
  createOrder: (order: any) => ipcRenderer.invoke('create-order', order),
  cancelOrder: (orderId: string) => ipcRenderer.invoke('cancel-order', orderId),
  getQuote: (symbol: string) => ipcRenderer.invoke('get-quote', symbol),
  getPortfolioHistory: (period: string, timeframe: string) =>
    ipcRenderer.invoke('get-portfolio-history', period, timeframe),
  searchAssets: (query: string) => ipcRenderer.invoke('search-assets', query),
  getWatchlist: () => ipcRenderer.invoke('get-watchlist'),
  addToWatchlist: (symbol: string, name: string) =>
    ipcRenderer.invoke('add-to-watchlist', symbol, name),
  removeFromWatchlist: (symbol: string) =>
    ipcRenderer.invoke('remove-from-watchlist', symbol),
});
