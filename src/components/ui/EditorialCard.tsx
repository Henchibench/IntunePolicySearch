import * as React from "react";
import { cn } from "@/lib/utils";

type Radius = "card" | "frame" | "pill";

interface EditorialCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "card" = 28px (KPI tiles, content blocks). "frame" = 32px (table frame). "pill" = 999px. Default "card". */
  radius?: Radius;
  /** Padding preset. Default "lg". */
  padding?: "sm" | "md" | "lg";
}

const radiusClass: Record<Radius, string> = {
  card: "rounded-2xl",
  frame: "rounded-3xl",
  pill: "rounded-pill",
};

const paddingClass = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/**
 * Lifted editorial surface. Wraps content in a lifted-cream card with the
 * spec's oversized border-radius. Used for KPI tiles, table frames, drawer
 * sub-sections.
 */
export const EditorialCard = React.forwardRef<HTMLDivElement, EditorialCardProps>(
  ({ radius = "card", padding = "lg", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-lifted border border-border",
        radiusClass[radius],
        paddingClass[padding],
        className,
      )}
      {...props}
    />
  ),
);
EditorialCard.displayName = "EditorialCard";
