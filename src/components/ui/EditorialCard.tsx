import * as React from "react";
import { cn } from "@/lib/utils";

type Radius = "card" | "frame" | "pill";

interface EditorialCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Radius preset. All map to Fluent's 8px container radius. Default "card". */
  radius?: Radius;
  /** Padding preset. Default "lg". */
  padding?: "sm" | "md" | "lg";
}

// Fluent uses a single 8px radius for cards/containers; all variants map to it.
const radiusClass: Record<Radius, string> = {
  card: "rounded-2xl",
  frame: "rounded-2xl",
  pill: "rounded-2xl",
};

const paddingClass = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/**
 * Fluent 2 content surface. An opaque Surface 1 card lifted off the tinted
 * canvas with shadow4 and an 8px radius. Used for KPI tiles, table frames,
 * drawer sub-sections.
 */
export const EditorialCard = React.forwardRef<HTMLDivElement, EditorialCardProps>(
  ({ radius = "card", padding = "lg", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card border border-border shadow-card",
        radiusClass[radius],
        paddingClass[padding],
        className,
      )}
      {...props}
    />
  ),
);
EditorialCard.displayName = "EditorialCard";
