import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDriverCatalog } from './useDriverCatalog';
import type { CatalogEntry } from '@/types/drivers';

const sampleEntries: CatalogEntry[] = [
  {
    manufacturer: 'Dell Inc.',
    driverClass: 'Video',
    name: 'Sample',
    version: '1.0.0',
    releaseDate: '2025-01-01',
    criticality: 'Recommended',
    fixes: [],
    knownIssues: [],
    supportedModels: [],
    supportedOperatingSystems: [],
    releaseNotesUrl: null,
  },
];

describe('useDriverCatalog', () => {
  beforeEach(() => {
    delete (window as unknown as { __IS_ELECTRON__?: boolean }).__IS_ELECTRON__;
    delete (window as unknown as { driverCatalog?: unknown }).driverCatalog;
    vi.restoreAllMocks();
  });

  it('loads from baked snapshot in web mode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => sampleEntries,
    } as Response);

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('baked');
    expect(result.current.entries.size).toBe(1);
    expect(result.current.entries.get('dell inc.|video|sample')).toBeDefined();
  });

  it('loads from Electron bridge when synced data exists', async () => {
    (window as unknown as { __IS_ELECTRON__: boolean }).__IS_ELECTRON__ = true;
    (window as unknown as { driverCatalog: unknown }).driverCatalog = {
      getStatus: vi.fn().mockResolvedValue({
        lastSyncedAt: '2026-05-07T00:00:00.000Z',
        entryCount: 1,
        source: 'synced',
      }),
      getEntries: vi.fn().mockResolvedValue(sampleEntries),
      sync: vi.fn(),
      onSyncProgress: vi.fn(() => () => {}),
    };

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('electron-sync');
    expect(result.current.entries.size).toBe(1);
  });

  it('falls back to baked snapshot when Electron reports no synced file', async () => {
    (window as unknown as { __IS_ELECTRON__: boolean }).__IS_ELECTRON__ = true;
    (window as unknown as { driverCatalog: unknown }).driverCatalog = {
      getStatus: vi.fn().mockResolvedValue({
        lastSyncedAt: null,
        entryCount: 0,
        source: 'none',
      }),
      getEntries: vi.fn(),
      sync: vi.fn(),
      onSyncProgress: vi.fn(() => () => {}),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => sampleEntries,
    } as Response);

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('baked');
  });

  it('returns source=none when both Electron and baked load fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDriverCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe('none');
    expect(result.current.entries.size).toBe(0);
  });
});
