import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CatalogSource } from '@/types/drivers';

interface Props {
  isElectron: boolean;
  source: CatalogSource;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  onSync: () => void;
}

export function CatalogSyncStatus({
  isElectron, source, lastSyncedAt, syncStatus, syncError, onSync,
}: Props) {
  if (!isElectron) return null;

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Syncing catalog…</span>
        <Button type="button" size="sm" variant="ghost" disabled>Sync</Button>
      </div>
    );
  }

  if (syncStatus === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600">
        <span title={syncError ?? ''}>🔴 Last sync failed</span>
        <Button type="button" size="sm" variant="outline" onClick={onSync}>Retry</Button>
      </div>
    );
  }

  if (source === 'electron-sync' && lastSyncedAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate">
        <span>🟢 Catalog synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}</span>
        <Button type="button" size="sm" variant="ghost" onClick={onSync}>Sync</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate">
      <span>🟡 Catalog not synced</span>
      <Button type="button" size="sm" onClick={onSync}>Sync now</Button>
    </div>
  );
}
