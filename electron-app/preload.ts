import { contextBridge } from 'electron';

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
