import { NavLink } from "react-router-dom";
import { LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { IconCircleButton } from "@/components/ui/IconCircleButton";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/policies", label: "Policies" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/compliance", label: "Compliance" },
];

/**
 * Slim floating pill navigation. Wordmark left, three centered nav links
 * (44px gap), circular sign-out icon-button right. Per spec "Navigation v5".
 */
export function PillNav() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <nav
      aria-label="Primary"
      className="mx-auto mt-6 flex max-w-[860px] items-center justify-between gap-12 rounded-pill border border-border bg-lifted py-2.5 pl-8 pr-3 shadow-pill-light dark:shadow-pill"
    >
      <span className="text-[15px] font-medium tracking-tight2 text-ink">
        Intune Policy
      </span>

      <div className="flex gap-11">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "py-1.5 text-[14px] tracking-tight2 text-ink transition-opacity",
                isActive ? "font-medium opacity-100" : "font-[450] opacity-85 hover:opacity-100",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
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
        <Button variant="ink" size="sm" onClick={login} disabled={isLoading}>
          <LogIn className="size-4" strokeWidth={1.6} />
          Sign in
        </Button>
      )}
    </nav>
  );
}
