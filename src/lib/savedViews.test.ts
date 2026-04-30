import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSavedViews,
  saveView,
  deleteView,
  type SavedView,
} from './savedViews';

beforeEach(() => {
  localStorage.clear();
});

describe('savedViews', () => {
  it('starts empty', () => {
    expect(loadSavedViews('tenant1')).toEqual([]);
  });

  it('saves and loads a view', () => {
    const v: SavedView = {
      name: 'Mine',
      filters: { category: ['mobileApp'] },
      sorting: [{ id: 'name', desc: false }],
      freeTextSearch: 'a',
    };
    saveView('tenant1', v);
    expect(loadSavedViews('tenant1')).toEqual([v]);
  });

  it('overwrites a view with the same name', () => {
    saveView('t', { name: 'X', filters: {}, sorting: [], freeTextSearch: '' });
    saveView('t', { name: 'X', filters: { intent: ['exclude'] }, sorting: [], freeTextSearch: '' });
    const all = loadSavedViews('t');
    expect(all).toHaveLength(1);
    expect(all[0].filters.intent).toEqual(['exclude']);
  });

  it('deletes a view by name', () => {
    saveView('t', { name: 'X', filters: {}, sorting: [], freeTextSearch: '' });
    saveView('t', { name: 'Y', filters: {}, sorting: [], freeTextSearch: '' });
    deleteView('t', 'X');
    expect(loadSavedViews('t').map((v) => v.name)).toEqual(['Y']);
  });

  it('isolates views per tenant', () => {
    saveView('t1', { name: 'A', filters: {}, sorting: [], freeTextSearch: '' });
    saveView('t2', { name: 'B', filters: {}, sorting: [], freeTextSearch: '' });
    expect(loadSavedViews('t1')).toHaveLength(1);
    expect(loadSavedViews('t2')).toHaveLength(1);
  });
});
