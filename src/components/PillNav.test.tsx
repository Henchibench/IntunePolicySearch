import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PillNav } from './PillNav';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

function renderNav() {
  return render(
    <MemoryRouter>
      <PillNav />
    </MemoryRouter>,
  );
}

describe('PillNav', () => {
  it('renders the primary nav landmark', () => {
    const { getByRole } = renderNav();
    expect(getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });

  it('has sticky and top-0 classes for pinned positioning', () => {
    const { getByRole } = renderNav();
    const nav = getByRole('navigation', { name: /primary/i });
    expect(nav.className).toMatch(/\bsticky\b/);
    expect(nav.className).toMatch(/\btop-0\b/);
  });

  it('has z-50 so it layers above page content', () => {
    const { getByRole } = renderNav();
    const nav = getByRole('navigation', { name: /primary/i });
    expect(nav.className).toMatch(/\bz-50\b/);
  });

  it('has an explicit height class (h-14) for filter bars to offset against', () => {
    const { getByRole } = renderNav();
    const nav = getByRole('navigation', { name: /primary/i });
    expect(nav.className).toMatch(/\bh-14\b/);
  });

  it('marks only Compliance active on /dashboard/compliance — Dashboard must not also underline', () => {
    const { getByRole } = render(
      <MemoryRouter initialEntries={['/dashboard/compliance']}>
        <PillNav />
      </MemoryRouter>,
    );
    expect(getByRole('link', { name: 'Compliance' }).className).toMatch(/border-primary/);
    expect(getByRole('link', { name: 'Dashboard' }).className).not.toMatch(/border-primary/);
  });

  it('marks only Dashboard active on /dashboard', () => {
    const { getByRole } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PillNav />
      </MemoryRouter>,
    );
    expect(getByRole('link', { name: 'Dashboard' }).className).toMatch(/border-primary/);
    expect(getByRole('link', { name: 'Compliance' }).className).not.toMatch(/border-primary/);
  });
});
