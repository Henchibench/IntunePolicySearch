import * as React from "react";
import { cn } from "@/lib/utils";

interface IconCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 32 | 40 | 48;
  /** Visual treatment: brand-filled (primary) or subtle (transparent, neutral hover). */
  tone?: "filled" | "ghost";
}

const sizeClass = {
  32: "size-8",
  40: "size-10",
  48: "size-12",
};

/**
 * Fluent 2 icon-only button. Subtle neutral by default (transparent with a
 * neutral hover layer), or brand-filled for a primary action. Used for
 * sign-out, drawer-close, refresh-icon-only.
 */
export const IconCircleButton = React.forwardRef<HTMLButtonElement, IconCircleButtonProps>(
  ({ size = 40, tone = "filled", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        tone === "filled"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-transparent text-foreground hover:bg-muted",
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconCircleButton.displayName = "IconCircleButton";
