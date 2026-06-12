import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// --- Mock heavy deps so we can render cheaply ---
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
    graphService: null,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

vi.mock('@/services/cacheService', () => ({
  CacheService: {
    isCacheValid: vi.fn(() => false),
    loadPolicies: vi.fn(() => null),
    savePolicies: vi.fn(),
    getCacheInfo: vi.fn(() => null),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: vi.fn(() => ({ observerTarget: { current: null } })),
}));

import Policies from '@/pages/Policies';

function renderPolicies() {
  return render(
    <MemoryRouter>
      <Policies />
    </MemoryRouter>,
  );
}

describe('Policies filter bar', () => {
  it('search/filter container is sticky with top-14', () => {
    const { container } = renderPolicies();
    // Find all sticky elements and look for the one with top-14 (the filter bar, not the nav)
    const stickyEls = Array.from(container.querySelectorAll('.sticky'));
    const filterBar = stickyEls.find((el) => el.className.includes('top-14'));
    expect(filterBar).toBeDefined();
    expect(filterBar!.className).toMatch(/\bsticky\b/);
    expect(filterBar!.className).toMatch(/\btop-14\b/);
  });

  it('sticky filter bar has a solid background so scrolling content does not bleed through', () => {
    const { container } = renderPolicies();
    const stickyEls = Array.from(container.querySelectorAll('.sticky'));
    const filterBar = stickyEls.find((el) => el.className.includes('top-14'));
    expect(filterBar).toBeDefined();
    // Must have an opaque bg class (no /XX alpha transparency)
    expect(filterBar!.className).toMatch(/\bbg-background\b|\bbg-card\b|\bbg-canvas\b/);
  });
});
