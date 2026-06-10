import { cn } from "@/lib/utils";

interface EyebrowLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Retained for API compatibility; the Fluent caption renders no accent dot. */
  withDot?: boolean;
}

/**
 * Eyebrow caption — a plain Fluent Caption1 (12px / 400, Foreground 3, normal
 * case). No accent dot, no uppercase, no extra tracking.
 */
export function EyebrowLabel({
  withDot,
  className,
  children,
  ...props
}: EyebrowLabelProps) {
  void withDot;
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
