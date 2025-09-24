import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [isSpinning, setIsSpinning] = useState(false);

  const toggleTheme = () => {
    setIsSpinning(true);
    setTheme(theme === "dark" ? "light" : "dark");
    
    // Reset spin animation after it completes
    setTimeout(() => setIsSpinning(false), 600);
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
        className={`transition-all duration-300 transform ${
          isSpinning ? "ninja-spin" : ""
        } ${theme === "dark" ? "scale-110" : "scale-100"}`}
      >
        <img 
          src="/ninja.png" 
          alt="Ninja"
          className={`h-6 w-6 transition-all duration-300 ${
            theme === "dark" 
              ? "drop-shadow-lg brightness-110 contrast-125" 
              : "opacity-70 group-hover:opacity-100"
          }`} 
        />
      </div>
      
      {/* Subtle glow effect in dark mode */}
      {theme === "dark" && (
        <div className="absolute inset-0 rounded-md bg-blue-500/10 animate-pulse opacity-50" />
      )}
    </Button>
  );
};