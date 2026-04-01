import { app, BrowserWindow } from 'electron';
import path from 'path';
import { log } from './logger';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Investing Agent — Paper Trading',
    backgroundColor: '#0f1117',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  log.info('Investing Agent starting up');
  registerIpcHandlers();
  createWindow();
  log.info('Main window created');
});

app.on('window-all-closed', () => {
  log.info('All windows closed, quitting');
  app.quit();
});
