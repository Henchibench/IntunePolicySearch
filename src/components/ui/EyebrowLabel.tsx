import { cn } from "@/lib/utils";

interface EyebrowLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Show the leading signal-orange dot (default true) */
  withDot?: boolean;
}

/**
 * Eyebrow label — uppercase, weight 700, +8% tracking, with an optional
 * signal-orange leading dot. Per spec section "Typography Rules → Eyebrow".
 */
export function EyebrowLabel({
  withDot = true,
  className,
  children,
  ...props
}: EyebrowLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-bold tracking-eyebrow uppercase text-slate",
        className,
      )}
      {...props}
    >
      {withDot && <span aria-hidden className="inline-block size-1.5 rounded-full bg-signal-light" />}
      {children}
    </span>
  );
}
