import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<div>DASHBOARD_LANDED</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Index page", () => {
  it("redirects authenticated users from / to /dashboard", () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { displayName: "Henrik" },
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderAt("/");
    expect(screen.getByText("DASHBOARD_LANDED")).toBeInTheDocument();
  });

  it("renders the editorial landing for unauthenticated users", () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderAt("/");
    expect(screen.getByText("INTUNE POLICY SEARCH")).toBeInTheDocument();
  });
});
