import { useEffect, useState, useCallback } from 'react';
import type { CatalogEntry, CatalogSource, CatalogStatus } from '@/types/drivers';
import { buildDriverKey } from '../../scripts/lib/dell-catalog-normalize';

interface UseDriverCatalogResult {
  entries: Map<string, CatalogEntry>;
  lastSyncedAt: string | null;
  source: CatalogSource;
  isLoading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  sync: () => Promise<void>;
}

function buildEntryMap(entries: CatalogEntry[]): Map<string, CatalogEntry> {
  const map = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    map.set(buildDriverKey(entry.manufacturer, entry.driverClass, entry.name), entry);
  }
  return map;
}

async function loadBaked(): Promise<CatalogEntry[]> {
  const res = await fetch('/driver-catalog.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useDriverCatalog(): UseDriverCatalogResult {
  const [entries, setEntries] = useState<Map<string, CatalogEntry>>(new Map());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [source, setSource] = useState<CatalogSource>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.__IS_ELECTRON__ && window.driverCatalog) {
        const status = await window.driverCatalog.getStatus();
        if (status.source === 'synced') {
          const list = await window.driverCatalog.getEntries();
          setEntries(buildEntryMap(list));
          setLastSyncedAt(status.lastSyncedAt);
          setSource('electron-sync');
          return;
        }
      }
      const baked = await loadBaked();
      setEntries(buildEntryMap(baked));
      setLastSyncedAt(null);
      setSource('baked');
    } catch (err) {
      console.error('useDriverCatalog: failed to load catalog', err);
      setEntries(new Map());
      setSource('none');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const sync = useCallback(async () => {
    if (!window.__IS_ELECTRON__ || !window.driverCatalog) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const status: CatalogStatus = await window.driverCatalog.sync();
      const list = await window.driverCatalog.getEntries();
      setEntries(buildEntryMap(list));
      setLastSyncedAt(status.lastSyncedAt);
      setSource('electron-sync');
      setSyncStatus('idle');
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { entries, lastSyncedAt, source, isLoading, syncStatus, syncError, sync };
}
