import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('setupAPI', {
  setConfig: (config: { azureClientId: string; azureTenantId: string }) =>
    ipcRenderer.invoke('set-config', config),
  getConfig: () => ipcRenderer.invoke('get-config'),
  launchApp: () => ipcRenderer.invoke('launch-app'),
});
