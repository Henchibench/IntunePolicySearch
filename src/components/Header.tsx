import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header = ({ onRefresh, isRefreshing = false }: HeaderProps) => {
  return (
    <header className="bg-surface border-b border-border px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Intune Policy Search Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Search and explore Microsoft Intune configuration policies and settings
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
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
        </div>
      </div>
    </header>
  );
};