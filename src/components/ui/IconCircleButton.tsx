import * as React from "react";
import { cn } from "@/lib/utils";

interface IconCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 32 | 40 | 48;
  /** Visual treatment: cream-on-ink (filled, primary) or ghost (transparent border). */
  tone?: "filled" | "ghost";
}

const sizeClass = {
  32: "size-8",
  40: "size-10",
  48: "size-12",
};

/**
 * 999px-radius icon-only button. The "satellite" shape from the spec.
 * Used for sign-out, drawer-close, refresh-icon-only.
 */
export const IconCircleButton = React.forwardRef<HTMLButtonElement, IconCircleButtonProps>(
  ({ size = 40, tone = "filled", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-pill transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        tone === "filled"
          ? "bg-ink text-canvas hover:scale-[1.05]"
          : "bg-transparent text-ink border border-ink/15 hover:bg-ink/5",
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
