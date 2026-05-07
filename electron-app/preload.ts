import { contextBridge, ipcRenderer } from 'electron';

// Read config from additionalArguments passed by the main process
// This is synchronous and available before any page scripts run
const args = process.argv;
const clientId = args.find(a => a.startsWith('--intune-client-id='))?.split('=').slice(1).join('=') || '';
const authority = args.find(a => a.startsWith('--intune-authority='))?.split('=').slice(1).join('=') || '';

// Inject config into the page's window object
// authConfig.ts reads window.__INTUNE_CONFIG__ before falling back to env vars
contextBridge.exposeInMainWorld('__INTUNE_CONFIG__', {
  clientId,
  authority,
  // redirectUri is not needed here -- authConfig.ts falls back to window.location.origin
});

contextBridge.exposeInMainWorld('__IS_ELECTRON__', true);

contextBridge.exposeInMainWorld('driverCatalog', {
  getStatus: () => ipcRenderer.invoke('driver-catalog:get-status'),
  getEntries: () => ipcRenderer.invoke('driver-catalog:get-entries'),
  sync: () => ipcRenderer.invoke('driver-catalog:sync'),
  onSyncProgress: (cb: (data: { bytesReceived: number; totalBytes: number | null }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: { bytesReceived: number; totalBytes: number | null }) => cb(data);
    ipcRenderer.on('driver-catalog:sync-progress', listener);
    return () => ipcRenderer.removeListener('driver-catalog:sync-progress', listener);
  },
});
