import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";

const NinjaStar = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 2L14.5 7.5L20 5.5L16.5 11.5L22 12L16.5 12.5L20 18.5L14.5 16.5L12 22L9.5 16.5L4 18.5L7.5 12.5L2 12L7.5 11.5L4 5.5L9.5 7.5L12 2Z" />
  </svg>
);

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="relative group p-2 hover:bg-muted/50 transition-all duration-300"
      aria-label="Toggle dark mode"
    >
      <div 
        className={`transition-all duration-500 transform ${
          theme === "dark" ? "rotate-180 scale-110" : "rotate-0 scale-100"
        } group-hover:rotate-45`}
      >
        <NinjaStar 
          className={`h-5 w-5 transition-colors duration-300 ${
            theme === "dark" 
              ? "text-all-platforms drop-shadow-lg" 
              : "text-muted-foreground group-hover:text-foreground"
          }`} 
        />
      </div>
      
      {/* Subtle glow effect in dark mode */}
      {theme === "dark" && (
        <div className="absolute inset-0 rounded-md bg-all-platforms/20 animate-pulse opacity-50" />
      )}
    </Button>
  );
};