import type { CatalogEntry, CatalogStatus } from './drivers';

declare global {
  interface Window {
    __IS_ELECTRON__?: boolean;
    driverCatalog?: {
      getStatus: () => Promise<CatalogStatus>;
      getEntries: () => Promise<CatalogEntry[]>;
      sync: () => Promise<CatalogStatus>;
      onSyncProgress: (
        cb: (data: { bytesReceived: number; totalBytes: number | null }) => void
      ) => () => void;
    };
  }
}

export {};
