import { RefreshCw, LogIn, LogOut, User, Search, LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header = ({ onRefresh, isRefreshing = false }: HeaderProps) => {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
    } else {
      login();
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    );

  return (
    <header className="bg-surface border-b border-border px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">
              Intune Policy Search
            </h1>
            <p className="text-sm text-muted-foreground">
            Workplace Ninja Summit 2025
            </p>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              <Search className="h-4 w-4" />
              Policy Search
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          {/* User info */}
          {isAuthenticated && user && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {user.displayName || user.userPrincipalName}
              </span>
              <Badge variant="secondary" className="text-xs">
                Connected
              </Badge>
            </div>
          )}
          
          {/* Refresh button - only show when authenticated */}
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw 
                className={`h-4 w-4 ${isRefreshing ? 'animate-refresh-spin' : ''}`} 
              />
              Refresh
            </Button>
          )}
          
          {/* Login/Logout button */}
          <Button
            variant={isAuthenticated ? "outline" : "default"}
            size="sm"
            onClick={handleAuthAction}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isAuthenticated ? (
              <LogOut className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isLoading ? "Loading..." : isAuthenticated ? "Sign Out" : "Sign In"}
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};