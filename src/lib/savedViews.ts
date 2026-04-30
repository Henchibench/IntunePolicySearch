import type { SortingState } from '@tanstack/react-table';

export interface SavedView {
  name: string;
  filters: Record<string, string[]>;
  sorting: SortingState;
  freeTextSearch: string;
}

const KEY = (tenantId: string) => `groupLookup.savedViews.${tenantId}`;

export function loadSavedViews(tenantId: string): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY(tenantId));
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
  localStorage.setItem(KEY(tenantId), JSON.stringify(all));
}

export function deleteView(tenantId: string, name: string): void {
  const all = loadSavedViews(tenantId).filter((v) => v.name !== name);
  localStorage.setItem(KEY(tenantId), JSON.stringify(all));
}
