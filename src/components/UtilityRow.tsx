import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

interface UtilityRowProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Quiet text-only row beneath the PillNav. Identity + connection state,
 * Refresh, ninja theme toggle. Right-aligned, max-width matches the pill.
 */
export function UtilityRow({ onRefresh, isRefreshing = false, className }: UtilityRowProps) {
  const { isAuthenticated, user } = useAuth();

  return (
    <div
      className={cn(
        "mx-auto mt-3 flex max-w-[860px] items-center justify-end gap-5 px-7 text-[12px] text-slate",
        className,
      )}
    >
      {isAuthenticated && user && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          {user.displayName || user.userPrincipalName} · Connected
        </span>
      )}

      {isAuthenticated && onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-ink disabled:opacity-50"
        >
          <RefreshCw
            className={cn("size-3.5", isRefreshing && "animate-refresh-spin")}
            strokeWidth={1.6}
          />
          Refresh
        </button>
      )}

      <ThemeToggle />
    </div>
  );
}
