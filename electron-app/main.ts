import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import * as path from 'path';
import * as http from 'http';
import Store from 'electron-store';
import handler from 'serve-handler';

const store = new Store({
  schema: {
    azureClientId: { type: 'string' as const, default: '' },
    azureTenantId: { type: 'string' as const, default: '' },
  }
});

let mainWindow: BrowserWindow | null = null;
let localServer: http.Server | null = null;
let localServerPort: number | null = null;

function hasConfig(): boolean {
  const clientId = store.get('azureClientId') as string;
  return !!(clientId && clientId.length > 0);
}

function getConfig() {
  const clientId = store.get('azureClientId') as string;
  const tenantId = store.get('azureTenantId') as string;
  const authority = tenantId
    ? `https://login.microsoftonline.com/${tenantId}`
    : 'https://login.microsoftonline.com/common';
  return { clientId, tenantId, authority };
}

function getWebDistPath(): string {
  // In production (packaged app), resources are in app.asar
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'web-dist');
  }
  return path.join(__dirname, '..', 'web-dist');
}

async function startLocalServer(): Promise<number> {
  const webDistPath = getWebDistPath();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      return handler(req, res, {
        public: webDistPath,
        rewrites: [{ source: '**', destination: '/index.html' }],
      });
    });

    server.on('error', reject);

    server.listen(0, 'localhost', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      localServer = server;
      localServerPort = port;
      console.log(`Local server running on http://localhost:${port}`);
      resolve(port);
    });
  });
}

function createAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => showSetup(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showSetup() {
  if (!mainWindow) return;

  const setupPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'setup.html')
    : path.join(__dirname, '..', 'setup.html');

  // Swap to setup page with setup preload
  mainWindow.loadFile(setupPath);
}

async function loadApp() {
  if (!mainWindow) return;

  try {
    // Start local server if not already running
    if (!localServer) {
      await startLocalServer();
    }

    // Close current window and create a new one with the app preload
    const bounds = mainWindow.getBounds();
    mainWindow.close();

    mainWindow = new BrowserWindow({
      ...bounds,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        additionalArguments: getConfigArgs(),
      },
      title: 'Intune Policy Search',
      show: false,
    });

    setupWindowHandlers(mainWindow);

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });

    await mainWindow.loadURL(`http://localhost:${localServerPort}`);
  } catch (error) {
    console.error('Failed to load app:', error);
  }
}

function setupWindowHandlers(win: BrowserWindow) {
  // Allow MSAL login popups, open other external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.includes('login.microsoftonline.com') ||
      url.includes('login.live.com') ||
      url.includes('login.windows.net')
    ) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getConfigArgs(): string[] {
  const config = getConfig();
  return [
    `--intune-client-id=${config.clientId}`,
    `--intune-authority=${config.authority}`,
  ];
}

function createWindow() {
  const useAppPreload = hasConfig();
  const preloadScript = useAppPreload ? 'preload.js' : 'setup-preload.js';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, preloadScript),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...(useAppPreload ? { additionalArguments: getConfigArgs() } : {}),
    },
    title: 'Intune Policy Search',
    show: false,
  });

  setupWindowHandlers(mainWindow);
  createAppMenu();

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (hasConfig()) {
    // Start server and load the web app
    startLocalServer().then((port) => {
      mainWindow?.loadURL(`http://localhost:${port}`);
    }).catch((error) => {
      console.error('Failed to start local server:', error);
    });
  } else {
    // Show setup page
    const setupPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'setup.html')
      : path.join(__dirname, '..', 'setup.html');

    mainWindow.loadFile(setupPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-config', () => getConfig());

ipcMain.handle('set-config', (_event, config: { azureClientId?: string; azureTenantId?: string }) => {
  if (config.azureClientId !== undefined) store.set('azureClientId', config.azureClientId);
  if (config.azureTenantId !== undefined) store.set('azureTenantId', config.azureTenantId);
  return true;
});

ipcMain.handle('has-config', () => hasConfig());

ipcMain.handle('launch-app', async () => {
  await loadApp();
  return true;
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close();
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
