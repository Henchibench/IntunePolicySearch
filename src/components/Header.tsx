import { RefreshCw, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

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

  return (
    <header className="bg-surface border-b border-border px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Intune Policy Search
          </h1>
          <p className="text-sm text-muted-foreground">
          Workplace Ninja Summit 2025
          </p>
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