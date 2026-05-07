import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogSyncStatus } from './CatalogSyncStatus';

describe('CatalogSyncStatus', () => {
  it('renders nothing when in web mode (not Electron)', () => {
    const { container } = render(
      <CatalogSyncStatus
        isElectron={false}
        source="baked"
        lastSyncedAt={null}
        syncStatus="idle"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "Catalog not synced" with primary Sync now button when never synced in Electron', () => {
    render(
      <CatalogSyncStatus
        isElectron
        source="baked"
        lastSyncedAt={null}
        syncStatus="idle"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Catalog not synced/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync now/i })).toBeInTheDocument();
  });

  it('shows synced relative time and ghost Sync button when lastSyncedAt set', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    render(
      <CatalogSyncStatus
        isElectron
        source="electron-sync"
        lastSyncedAt={sevenDaysAgo}
        syncStatus="idle"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Catalog synced/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sync$/i })).toBeInTheDocument();
  });

  it('shows "Syncing catalog…" and disabled button while syncStatus=syncing', () => {
    render(
      <CatalogSyncStatus
        isElectron
        source="electron-sync"
        lastSyncedAt="2026-05-01T00:00:00Z"
        syncStatus="syncing"
        syncError={null}
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Syncing catalog/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows "Last sync failed" with Retry when syncStatus=error', () => {
    render(
      <CatalogSyncStatus
        isElectron
        source="electron-sync"
        lastSyncedAt="2026-05-01T00:00:00Z"
        syncStatus="error"
        syncError="boom"
        onSync={() => {}}
      />
    );
    expect(screen.getByText(/Last sync failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('calls onSync when the action button is clicked', () => {
    const handler = vi.fn();
    render(
      <CatalogSyncStatus
        isElectron
        source="baked"
        lastSyncedAt={null}
        syncStatus="idle"
        syncError={null}
        onSync={handler}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Sync now/i }));
    expect(handler).toHaveBeenCalled();
  });
});
