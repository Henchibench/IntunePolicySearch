import { ArrowUpRight } from "lucide-react";

interface OrbitalPortraitProps {
  /** Image URL — anything works, the component is decorative. */
  src?: string;
  /** Click target for the satellite CTA. */
  onCta?: () => void;
  ctaLabel?: string;
}

/**
 * Decorative circular portrait with a traced signal-orange orbital arc and
 * a white "satellite" CTA dot docked on the right edge. Per spec "Index".
 */
export function OrbitalPortrait({ src, onCta, ctaLabel = "Sign in" }: OrbitalPortraitProps) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] aspect-square">
      <svg
        aria-hidden
        viewBox="0 0 600 600"
        className="absolute inset-0 -mx-[20%] -my-[8%] w-[140%] h-[116%] pointer-events-none"
      >
        <ellipse
          cx="300"
          cy="300"
          rx="290"
          ry="220"
          fill="none"
          stroke="hsl(var(--signal-light))"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="0"
          transform="rotate(-12 300 300)"
        />
      </svg>

      <div className="absolute inset-0 overflow-hidden rounded-pill bg-gradient-to-br from-signal-light/30 via-signal/20 to-canvas border border-border">
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
        aria-label={ctaLabel}
        className="absolute right-[6%] top-[16%] inline-flex size-14 items-center justify-center rounded-pill bg-pure-white text-ink shadow-card transition-transform hover:scale-105"
      >
        <ArrowUpRight className="size-5" strokeWidth={1.6} />
      </button>
    </div>
  );
}
