import { ArrowUpRight } from "lucide-react";

interface OrbitalPortraitProps {
  /** Image URL — anything works, the component is decorative. */
  src?: string;
  /** Click target for the CTA button. */
  onCta?: () => void;
  ctaLabel?: string;
}

/**
 * Fluent 2 figure. A clean rectangular image container (Surface 2, 8px radius,
 * 1px Stroke 2) with a plain Fluent primary CTA button beneath it. No orbital
 * arc, no satellite dot, no circular photo mask.
 */
export function OrbitalPortrait({ src, onCta, ctaLabel = "Sign in" }: OrbitalPortraitProps) {
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
        {src && (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onCta}
        className="inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {ctaLabel}
        <ArrowUpRight className="size-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}
