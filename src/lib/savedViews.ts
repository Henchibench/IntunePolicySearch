import type { SortingState } from '@tanstack/react-table';

export interface SavedView {
  name: string;
  filters: Record<string, string[]>;
  sorting: SortingState;
  freeTextSearch: string;
}

const KEY = (tenantId: string) => `groupLookup.savedViews.${tenantId}`;

/** Use window.localStorage explicitly — Node 24's built-in localStorage is not a full Web Storage API. */
function storage(): Storage {
  return window.localStorage;
}

export function loadSavedViews(tenantId: string): SavedView[] {
  try {
    const raw = storage().getItem(KEY(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveView(tenantId: string, view: SavedView): void {
  const all = loadSavedViews(tenantId).filter((v) => v.name !== view.name);
  all.push(view);
  storage().setItem(KEY(tenantId), JSON.stringify(all));
}

export function deleteView(tenantId: string, name: string): void {
  const all = loadSavedViews(tenantId).filter((v) => v.name !== name);
  storage().setItem(KEY(tenantId), JSON.stringify(all));
}
