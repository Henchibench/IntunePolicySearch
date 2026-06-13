import { NavLink } from "react-router-dom";
import { LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { IconCircleButton } from "@/components/ui/IconCircleButton";
import { Button } from "@/components/ui/button";

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: "/policies", label: "Policies" },
  // `end` so /dashboard only matches exactly, not the /dashboard/compliance child
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/dashboard/compliance", label: "Compliance" },
  { to: "/audit", label: "Audit" },
  { to: "/drivers", label: "Drivers" },
  { to: "/groups", label: "Groups" },
];

/**
 * Fluent 2 top tab navigation. Surface1 bar with a 1px bottom border, brand
 * mark left, nav tabs with a 2px brand underline on the active item, and a
 * sign-out / sign-in action on the right.
 */
export function PillNav() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-50 flex h-14 items-center justify-between gap-8 border-b border-border bg-card px-6"
    >
      <div className="flex items-center gap-8">
        <span className="text-[15px] font-semibold text-foreground">
          Intune Policy
        </span>

        <div className="flex gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-3 py-3.5 text-[14px] transition-colors",
                  isActive
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {isAuthenticated ? (
        <IconCircleButton
          size={40}
          aria-label="Sign out"
          onClick={logout}
          disabled={isLoading}
        >
          <LogOut className="size-4" strokeWidth={1.6} />
        </IconCircleButton>
      ) : (
        <Button variant="default" size="sm" onClick={login} disabled={isLoading}>
          <LogIn className="size-4" strokeWidth={1.6} />
          Sign in
        </Button>
      )}
    </nav>
  );
}
