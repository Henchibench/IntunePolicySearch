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
      className="group p-2 rounded-md hover:bg-accent transition-colors"
      aria-label="Toggle dark mode"
    >
      <div
        className={`transition-transform duration-300 ${
          isSpinning ? "ninja-spin" : ""
        } ${theme === "dark" ? "scale-110" : "scale-100"}`}
      >
        <img
          src="/ninja.png"
          alt="Ninja"
          className={`h-6 w-6 transition-opacity duration-300 ${
            theme === "dark"
              ? "brightness-110 contrast-125"
              : "opacity-70 group-hover:opacity-100"
          }`}
        />
      </div>
    </Button>
  );
};