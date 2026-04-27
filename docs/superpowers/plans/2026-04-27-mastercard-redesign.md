# Mastercard-inspired Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Mastercard editorial design language across every page and component (light + dark variants), shipped as a single PR on `feature/dashboard-compliance`.

**Architecture:** Token-driven restyle. We swap the existing HSL CSS-variable palette to match the spec, add new editorial primitives (`EyebrowLabel`, `EditorialCard`, `IconCircleButton`), split `Header` into `PillNav` + `UtilityRow`, and repaint every page/component to consume the new tokens. Only one piece of net-new logic: `Index` becomes an editorial landing that redirects to `/dashboard` once the user is authenticated.

**Tech Stack:** Vite + React 18 + TypeScript, Tailwind 3, shadcn/ui (cva), `@tanstack/react-virtual`, `react-router-dom`, MSAL/`useAuth`, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-04-27-mastercard-redesign-design.md`. Read it before starting Task 1.

**Verification model.** Visual changes can't be unit-tested. The verification gate for restyle tasks is: (a) `npx tsc --noEmit` passes, (b) `npm run build` succeeds, (c) `npm run dev` boots and the affected page renders without console errors. The auth-redirect logic in `Index` is the one piece with a real Vitest test (Task 13).

---

## File map

**Touched (modified):**

- `index.html` — add Google Fonts link for Sofia Sans
- `src/index.css` — replace HSL variables in `:root` and `.dark` with the spec palette; add Sofia Sans font-family default
- `tailwind.config.ts` — extend `colors`, `borderRadius`, `fontFamily`, `boxShadow`
- `src/components/ui/button.tsx` — add `ink`, `outlined`, `signal`, `iconCircle` variants
- `src/components/ui/input.tsx` — outlined pill style
- `src/components/Header.tsx` — **deleted** (split into PillNav + UtilityRow)
- `src/components/ThemeToggle.tsx` — minor class tweaks for the new utility-row position
- `src/components/SearchBar.tsx` — Tailwind class repaint
- `src/components/FilterDropdown.tsx` — Tailwind class repaint
- `src/components/PolicyCard.tsx` — Tailwind class repaint
- `src/components/dashboard/KpiTile.tsx` — full restyle, same API
- `src/components/dashboard/DeviceTable.tsx` — repaint to editorial card-table
- `src/components/dashboard/DeviceDrawer.tsx` — repaint per spec
- `src/components/dashboard/DeviceDeepDetails.tsx` — eyebrow-sectioned layout
- `src/pages/Index.tsx` — rewritten as editorial landing with auth-gated redirect
- `src/pages/Dashboard.tsx` — page-shell repaint
- `src/pages/DashboardCompliance.tsx` — page-shell repaint
- `src/pages/NotFound.tsx` — minimal editorial 404
- `src/App.tsx` (only if router-level wrapping is needed for the new Header replacement)

**Created:**

- `src/components/PillNav.tsx`
- `src/components/UtilityRow.tsx`
- `src/components/Footer.tsx`
- `src/components/ui/EyebrowLabel.tsx`
- `src/components/ui/EditorialCard.tsx`
- `src/components/ui/IconCircleButton.tsx`
- `src/components/landing/OrbitalPortrait.tsx`
- `src/pages/__tests__/Index.test.tsx` (auth-redirect)

---

## Task 1: Wire Sofia Sans

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the Google Fonts preconnects + stylesheet to `<head>`**

Insert these three lines before `</head>` in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sofia+Sans:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify the font loads**

Run: `npm run dev`
Open the dev URL, open DevTools → Network → filter "font", reload. Confirm a `Sofia+Sans` woff2 200s. Stop the dev server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(design): load Sofia Sans variable font"
```

---

## Task 2: Replace CSS variables with the editorial palette

**Files:**
- Modify: `src/index.css` (lines 1-165 — full `@layer base` block)

- [ ] **Step 1: Replace the contents of `@layer base { ... }` (lines 7-165)**

Open `src/index.css`. Delete lines 7 through 165 inclusive. Paste this in their place:

```css
@layer base {
  :root {
    /* True canvas — DESIGN.md "Canvas Cream" */
    --canvas: 30 14% 94%;            /* #F3F0EE */
    --lifted: 30 25% 98%;            /* #FCFBFA */
    --pure-white: 0 0% 100%;         /* pill nav, modal, satellites */

    /* Ink (text + primary CTA) */
    --ink: 60 4% 8%;                 /* #141413 */
    --charcoal: 240 1% 15%;          /* #262627 */
    --slate: 0 0% 41%;               /* #696969 */
    --dust: 30 10% 80%;              /* #D1CDC7 */

    /* Accent */
    --signal: 19 100% 41%;           /* #CF4500 */
    --signal-light: 18 89% 58%;      /* #F37338 */
    --clay: 23 90% 32%;              /* #9A3A0A */
    --link: 222 50% 49%;             /* #3860BE */
    --success: 142 51% 57%;          /* #5CC58A */
    --warning: 18 89% 58%;           /* same as signal-light */

    /* Semantic mappings (kept for shadcn primitives) */
    --background: var(--canvas);
    --foreground: var(--ink);
    --surface: var(--lifted);
    --surface-foreground: var(--ink);
    --card: var(--lifted);
    --card-foreground: var(--ink);
    --card-hover: 30 14% 92%;
    --popover: var(--pure-white);
    --popover-foreground: var(--ink);
    --primary: var(--ink);
    --primary-foreground: var(--canvas);
    --primary-glow: var(--signal-light);
    --secondary: var(--lifted);
    --secondary-foreground: var(--ink);
    --muted: 30 14% 90%;
    --muted-foreground: var(--slate);
    --accent: 30 14% 90%;
    --accent-foreground: var(--ink);
    --destructive: var(--signal);
    --destructive-foreground: var(--pure-white);
    --success-foreground: var(--ink);
    --warning-foreground: var(--ink);
    --border: 60 4% 8% / 0.08;       /* ink at 8% */
    --input: 60 4% 8% / 0.18;
    --ring: var(--signal-light);

    /* Geometry */
    --radius: 1.25rem;               /* 20px — primary CTA radius */
    --radius-pill: 999px;
    --radius-card: 1.75rem;          /* 28px — KPI tile */
    --radius-frame: 2rem;            /* 32px — table frame */
    --header-height: 4.5rem;
  }

  .dark {
    --canvas: 30 4% 5%;              /* #0B0A0A */
    --lifted: 30 6% 9%;              /* #181715 */
    --pure-white: 0 0% 100%;         /* still pure white inside drawers/modals on dark */

    --ink: 30 16% 90%;               /* #ECE7E2 — cream as text */
    --charcoal: 30 14% 81%;          /* #B8B0A6 */
    --slate: 30 8% 55%;              /* #948C84 */
    --dust: 0 0% 33%;                /* #555555 */

    --signal: 19 100% 41%;           /* unchanged */
    --signal-light: 18 89% 58%;
    --clay: 23 90% 32%;
    --link: 220 70% 70%;             /* #7B9FE8 */
    --success: 142 51% 57%;
    --warning: 18 89% 58%;

    --background: var(--canvas);
    --foreground: var(--ink);
    --surface: var(--lifted);
    --surface-foreground: var(--ink);
    --card: var(--lifted);
    --card-foreground: var(--ink);
    --card-hover: 30 6% 13%;
    --popover: var(--lifted);
    --popover-foreground: var(--ink);
    --primary: var(--ink);
    --primary-foreground: var(--canvas);
    --primary-glow: var(--signal-light);
    --secondary: var(--lifted);
    --secondary-foreground: var(--ink);
    --muted: 30 6% 14%;
    --muted-foreground: var(--slate);
    --accent: 30 6% 14%;
    --accent-foreground: var(--ink);
    --destructive: var(--signal);
    --destructive-foreground: var(--pure-white);
    --success-foreground: var(--canvas);
    --warning-foreground: var(--canvas);
    --border: 30 16% 90% / 0.08;
    --input: 30 16% 90% / 0.18;
    --ring: var(--signal-light);
  }
}

@layer base {
  * { @apply border-border; }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-feature-settings: "ss01", "cv01";
  }

  h1, h2, h3, h4 { letter-spacing: -0.02em; font-weight: 500; }
  p, li, dt, dd { font-weight: 450; line-height: 1.45; }
}
```

The animation utilities below line 165 (`.animate-search-highlight` … `@keyframes ninja-spin`) **stay as-is** — do not touch them.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Boot the dev server and confirm the canvas is now cream / true-black**

Run: `npm run dev`
Open the dev URL. The page should now have a warm cream background in light mode (or near-black in dark mode if your OS preference is dark). Existing layout will look broken — that's expected, we haven't restyled the components yet. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(design): swap palette tokens to editorial cream + true-black"
```

---

## Task 3: Extend Tailwind config

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace the file with the version below**

Open `tailwind.config.ts` and replace its full contents with:

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['"Sofia Sans"', "system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
      },
      colors: {
        canvas: "hsl(var(--canvas))",
        lifted: "hsl(var(--lifted))",
        ink: "hsl(var(--ink))",
        charcoal: "hsl(var(--charcoal))",
        slate: "hsl(var(--slate))",
        dust: "hsl(var(--dust))",
        signal: {
          DEFAULT: "hsl(var(--signal))",
          light: "hsl(var(--signal-light))",
        },
        clay: "hsl(var(--clay))",
        link: "hsl(var(--link))",

        /* shadcn-compatible aliases */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: { DEFAULT: "hsl(var(--surface))", foreground: "hsl(var(--surface-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", glow: "hsl(var(--primary-glow))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))", hover: "hsl(var(--card-hover))" },
      },
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "var(--radius)",
        xl: "1.5rem",
        "2xl": "var(--radius-card)",
        "3xl": "var(--radius-frame)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        pill: "0 24px 60px rgba(0,0,0,0.45)",
        "pill-light": "0 18px 40px rgba(0,0,0,0.08)",
        drawer: "-24px 0 60px rgba(0,0,0,0.5)",
        "drawer-light": "-24px 0 60px rgba(0,0,0,0.12)",
        card: "0 24px 48px rgba(0,0,0,0.08)",
      },
      letterSpacing: {
        eyebrow: "0.08em",
        tight2: "-0.02em",
        tight3: "-0.03em",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

Notes on what changed:
- Removed `windows`, `ios`, `android`, `all-platforms`, `sidebar` color groups — none are referenced after the redesign. (Step 2 verifies.)
- Added `canvas`, `lifted`, `ink`, `charcoal`, `slate`, `dust`, `signal.{DEFAULT,light}`, `clay`, `link`.
- `borderRadius` now exposes `2xl`/`3xl`/`pill`.
- `boxShadow.pill`, `pill-light`, `drawer`, `drawer-light`, `card`.
- `fontFamily.sans` defaults to Sofia Sans.

- [ ] **Step 2: Find and replace deprecated platform color references**

Run: `Grep -r "bg-windows\|bg-ios\|bg-android\|bg-all-platforms\|text-windows\|text-ios\|text-android\|text-all-platforms\|sidebar-" src/`

For each match, replace with the closest editorial token. The most common cases:
- `bg-windows` / `bg-windows-light` → `bg-lifted` (or remove and rely on row hover)
- `text-windows-foreground` → `text-ink`
- `border-windows-border` → `border-border`
- `bg-all-platforms*` → `bg-lifted`
- Any `sidebar-*` reference → there should be none in active code; if present, drop the file or replace with `surface`.

Edit each match in turn. Most live in `PolicyCard.tsx` (which Task 21 will fully repaint), so prefer leaving them untouched here if the only references are in files Tasks 17-21 will rewrite end-to-end.

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Build completes; no "unknown utility class" warnings from Tailwind for the colors above. If build fails on a removed class, fix that file before continuing.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts $(git diff --name-only -- src/)
git commit -m "feat(design): editorial color/radii/shadow tokens in Tailwind"
```

---

## Task 4: Add new Button variants (ink-pill, outlined-pill, signal, icon-circle)

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Replace the `buttonVariants` cva block with the version below**

Open `src/components/ui/button.tsx`. Replace lines 7-31 (the `cva(...)` call) with:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-[16px] font-medium tracking-tight2 ring-offset-background transition-[transform,background-color,color,border-color] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Mastercard primary — ink-pill */
        ink: "rounded-[20px] border-[1.5px] border-ink bg-ink text-canvas hover:bg-ink/90",
        /* Mastercard secondary — outlined-pill on cream/lifted */
        outlined:
          "rounded-[20px] border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink/5",
        /* Aggressive consent / destructive */
        signal: "rounded-[24px] bg-signal text-white hover:bg-signal/90 border-0",
        /* Round icon button (sign-out, drawer-close, etc.) */
        iconCircle:
          "rounded-pill bg-ink text-canvas hover:scale-[1.05] border-0 [&_svg]:size-4",

        /* shadcn-compatible aliases (kept so existing call sites still work) */
        default: "rounded-[20px] border-[1.5px] border-ink bg-ink text-canvas hover:bg-ink/90",
        destructive: "rounded-[20px] bg-signal text-white hover:bg-signal/90",
        outline:
          "rounded-[20px] border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink/5",
        secondary:
          "rounded-[20px] bg-lifted text-ink hover:bg-lifted/80 border border-border",
        ghost: "rounded-[20px] text-ink hover:bg-ink/5",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 px-4",
        lg: "h-11 px-8",
        icon: "h-10 w-10 p-0",
        iconLg: "h-12 w-12 p-0",
      },
    },
    defaultVariants: { variant: "ink", size: "default" },
  },
);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Existing call-sites that used `variant="default"`, `outline`, `secondary`, `ghost`, `destructive`, `link` continue to compile because those keys are kept.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): editorial Button variants (ink-pill, outlined, signal, iconCircle)"
```

---

## Task 5: Restyle Input as outlined pill

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Open the file and locate the `<input>` element's class string**

Read the file. The component renders a single `<input>` with a long `className`.

- [ ] **Step 2: Replace its `className` with**

```ts
"flex h-10 w-full rounded-[20px] border-[1.5px] border-input bg-transparent px-4 py-2 text-[15px] font-[450] placeholder:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50"
```

(Preserve the `cn(..., className)` wrapper and `ref`/`type` props exactly.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat(design): outlined-pill input"
```

---

## Task 6: Create EyebrowLabel primitive

**Files:**
- Create: `src/components/ui/EyebrowLabel.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/EyebrowLabel.tsx
git commit -m "feat(design): EyebrowLabel primitive"
```

---

## Task 7: Create EditorialCard primitive

**Files:**
- Create: `src/components/ui/EditorialCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/EditorialCard.tsx
git commit -m "feat(design): EditorialCard primitive"
```

---

## Task 8: Create IconCircleButton primitive

**Files:**
- Create: `src/components/ui/IconCircleButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/IconCircleButton.tsx
git commit -m "feat(design): IconCircleButton primitive"
```

---

## Task 9: Restyle dashboard/KpiTile

**Files:**
- Modify: `src/components/dashboard/KpiTile.tsx`

- [ ] **Step 1: Replace the entire file with**

```tsx
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  subStat?: ReactNode;
  to?: string;
  disabled?: boolean;
  tone?: "default" | "warning" | "danger";
}

export function KpiTile({ label, value, subStat, to, disabled, tone = "default" }: KpiTileProps) {
  const navigate = useNavigate();

  const onClick = () => {
    if (disabled || !to) return;
    navigate(to);
  };

  const valueTone =
    tone === "danger" ? "text-signal" : tone === "warning" ? "text-signal-light" : "text-ink";

  return (
    <EditorialCard
      radius="card"
      padding="lg"
      onClick={onClick}
      className={cn(
        "flex min-h-[140px] flex-col justify-between transition-shadow",
        disabled
          ? "cursor-not-allowed opacity-50"
          : to
            ? "cursor-pointer hover:shadow-card"
            : "",
      )}
    >
      <EyebrowLabel>{label}</EyebrowLabel>
      <div
        className={cn(
          "mt-4 text-[44px] font-medium leading-none tracking-tight3",
          valueTone,
        )}
      >
        {value}
      </div>
      {subStat && (
        <div className="mt-2 text-xs font-[450] text-slate">{subStat}</div>
      )}
      {disabled && (
        <div className="mt-2 text-xs italic text-slate">Coming in v2</div>
      )}
    </EditorialCard>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/KpiTile.tsx
git commit -m "feat(design): editorial KpiTile (eyebrow + 44px display num)"
```

---

## Task 10: Build PillNav + UtilityRow

**Files:**
- Create: `src/components/PillNav.tsx`
- Create: `src/components/UtilityRow.tsx`

- [ ] **Step 1: Write `PillNav.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { IconCircleButton } from "@/components/ui/IconCircleButton";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Policies", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/compliance", label: "Compliance" },
];

/**
 * Slim floating pill navigation. Wordmark left, three centered nav links
 * (44px gap), circular sign-out icon-button right. Per spec "Navigation v5".
 */
export function PillNav() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <nav
      aria-label="Primary"
      className="mx-auto mt-6 flex max-w-[860px] items-center justify-between gap-12 rounded-pill border border-border bg-lifted py-2.5 pl-8 pr-3 shadow-pill-light dark:shadow-pill"
    >
      <span className="text-[15px] font-medium tracking-tight2 text-ink">
        Intune Policy
      </span>

      <div className="flex gap-11">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "py-1.5 text-[14px] tracking-tight2 text-ink transition-opacity",
                isActive ? "font-medium opacity-100" : "font-[450] opacity-85 hover:opacity-100",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {isAuthenticated ? (
        <IconCircleButton
          size={40}
          aria-label="Sign out"
          onClick={logout}
          disabled={isLoading}
        >
          <LogOut className="size-4" strokeWidth={1.6} />
        </IconCircleButton>
      ) : (
        <Button variant="ink" size="sm" onClick={login} disabled={isLoading}>
          <LogIn className="size-4" strokeWidth={1.6} />
          Sign in
        </Button>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Write `UtilityRow.tsx`**

```tsx
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

interface UtilityRowProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Quiet text-only row beneath the PillNav. Identity + connection state,
 * Refresh, ninja theme toggle. Right-aligned, max-width matches the pill.
 */
export function UtilityRow({ onRefresh, isRefreshing = false, className }: UtilityRowProps) {
  const { isAuthenticated, user } = useAuth();

  return (
    <div
      className={cn(
        "mx-auto mt-3 flex max-w-[860px] items-center justify-end gap-5 px-7 text-[12px] text-slate",
        className,
      )}
    >
      {isAuthenticated && user && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          {user.displayName || user.userPrincipalName} · Connected
        </span>
      )}

      {isAuthenticated && onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-ink disabled:opacity-50"
        >
          <RefreshCw
            className={cn("size-3.5", isRefreshing && "animate-refresh-spin")}
            strokeWidth={1.6}
          />
          Refresh
        </button>
      )}

      <ThemeToggle />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PillNav.tsx src/components/UtilityRow.tsx
git commit -m "feat(design): PillNav + UtilityRow (replaces Header)"
```

---

## Task 11: Replace Header consumers and delete Header.tsx

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/DashboardCompliance.tsx`
- Modify: `src/pages/Index.tsx` (if it imports Header)
- Delete: `src/components/Header.tsx`

- [ ] **Step 1: Find every Header import**

Run: `Grep "from \"@/components/Header\"" src/`
Note every file that imports `Header`. Each will need updating. Common cases: `Dashboard.tsx`, `DashboardCompliance.tsx`, `Index.tsx`.

- [ ] **Step 2: In each consumer, replace the import and the usage**

For each file from Step 1:

Replace the import line:
```tsx
import { Header } from "@/components/Header";
```
with:
```tsx
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
```

Replace the JSX usage:
```tsx
<Header onRefresh={...} isRefreshing={...} />
```
with:
```tsx
<PillNav />
<UtilityRow onRefresh={...} isRefreshing={...} />
```

(Keep whatever `onRefresh` / `isRefreshing` expressions the file already has. If the file passed no props to `Header`, just render `<PillNav /><UtilityRow />`.)

- [ ] **Step 3: Delete the old Header file**

```bash
git rm src/components/Header.tsx
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If it complains about any remaining `Header` import, that file was missed in Step 2 — fix it.

- [ ] **Step 5: Boot dev server and confirm the pill nav renders**

Run: `npm run dev`. Open the dev URL on `/`, `/dashboard`, `/dashboard/compliance`. The pill should render at top with three nav links and the right-side action. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -u src/
git commit -m "feat(design): wire PillNav + UtilityRow across pages, drop Header"
```

---

## Task 12: Build Footer

**Files:**
- Create: `src/components/Footer.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * Editorial footer for the unauthenticated landing.
 * Dark warm-black surface (ink in light theme, deeper in dark), four short
 * link columns, large conversational headline. Per spec "Index".
 */
export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-canvas">
      <div className="mx-auto max-w-[1240px] px-8 py-16">
        <h2 className="max-w-[14ch] text-[44px] font-medium leading-[1.05] tracking-tight2">
          Built for IT teams who don't have all day.
        </h2>

        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { title: "PRODUCT", links: ["Policies", "Dashboard", "Compliance"] },
            { title: "RESOURCES", links: ["Workplace Ninja Summit", "Microsoft Graph", "Intune docs"] },
            { title: "ABOUT", links: ["Source", "Changelog"] },
            { title: "LEGAL", links: ["Privacy", "Terms"] },
          ].map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-bold tracking-eyebrow text-canvas/60">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a className="text-[14px] font-[450] text-canvas/85 hover:text-canvas">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 text-[12px] text-canvas/50">
          © Intune Policy Search · Workplace Ninja Summit 2025
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat(design): editorial Footer for landing"
```

---

## Task 13: Index — auth-redirect (TDD) + editorial landing + OrbitalPortrait

**Files:**
- Create: `src/components/landing/OrbitalPortrait.tsx`
- Create: `src/pages/__tests__/Index.test.tsx`
- Modify: `src/pages/Index.tsx` (full rewrite)

- [ ] **Step 1: Write the failing test**

Create `src/pages/__tests__/Index.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<div>DASHBOARD_LANDED</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Index page", () => {
  it("redirects authenticated users from / to /dashboard", () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { displayName: "Henrik" },
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderAt("/");
    expect(screen.getByText("DASHBOARD_LANDED")).toBeInTheDocument();
  });

  it("renders the editorial landing for unauthenticated users", () => {
    (useAuth as any).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderAt("/");
    // Eyebrow above the hero
    expect(screen.getByText(/INTUNE POLICY SEARCH/i)).toBeInTheDocument();
  });
});
```

You will likely need `@testing-library/react` and `@testing-library/jest-dom`. If not yet installed, add them: `npm i -D @testing-library/react @testing-library/jest-dom`. Then create or edit `src/setupTests.ts` to include `import "@testing-library/jest-dom";` and reference it in `vite.config.ts` under `test.setupFiles`. (If the project already has a Vitest setup file — check `vite.config.ts` or `vitest.config.ts` — append to it instead.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/Index.test.tsx`
Expected: FAIL — current `Index.tsx` doesn't redirect, doesn't render an eyebrow, and may import `Header` (already deleted in Task 11) so it likely fails to compile.

- [ ] **Step 3: Write `OrbitalPortrait.tsx`**

```tsx
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
      {/* Orbital arc — full-bleed within stage, behind the portrait */}
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

      {/* Portrait disc */}
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

      {/* Satellite CTA dot */}
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
```

Note: the `bg-pure-white` class won't exist unless we add it. Add this single utility to `tailwind.config.ts → extend.colors`:

```ts
"pure-white": "hsl(var(--pure-white))",
```

(Place it next to the other top-level color entries.) Re-run `npx tsc --noEmit` after edit.

- [ ] **Step 4: Rewrite `src/pages/Index.tsx`**

```tsx
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { Footer } from "@/components/Footer";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
import { OrbitalPortrait } from "@/components/landing/OrbitalPortrait";

export default function Index() {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    document.title = "Intune Policy Search";
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="px-6">
        <PillNav />
        <UtilityRow />
      </div>

      <main className="relative mx-auto mt-20 max-w-[1240px] px-8">
        {/* Ghost watermark — H2 scale, cream-on-cream, behind the portrait */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-24 select-none text-center text-[120px] font-medium leading-none tracking-tight2 text-ink/[0.04] dark:text-ink/[0.05]"
        >
          Compliance.
        </div>

        <div className="relative grid grid-cols-1 items-center gap-16 md:grid-cols-2">
          <div>
            <EyebrowLabel>INTUNE POLICY SEARCH</EyebrowLabel>
            <h1 className="mt-4 text-[64px] font-medium leading-none tracking-tight2 text-ink">
              See every device.<br />Every policy.<br />No exports.
            </h1>
            <p className="mt-6 max-w-[44ch] text-[16px] font-[450] leading-relaxed text-charcoal">
              A read-only window into your Intune tenant. Search policies, drill
              into compliance, find why a device is failing — without opening
              the portal.
            </p>
          </div>

          <OrbitalPortrait onCta={login} />
        </div>

        <section className="mt-32">
          <EyebrowLabel>WHAT IT DOES</EyebrowLabel>
          <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              { h: "Policy search", b: "Find any compliance, configuration, or app-protection policy by name, platform, or assignment." },
              { h: "Compliance dashboard", b: "Live KPI tiles, virtualized device table, drill-down by policy or pivot." },
              { h: "Device deep-fetch", b: "On-demand per-setting failure reasons, batched against Microsoft Graph." },
            ].map((item) => (
              <div key={item.h}>
                <h3 className="text-[24px] font-medium tracking-tight2 text-ink">{item.h}</h3>
                <p className="mt-2 text-[14px] font-[450] leading-relaxed text-charcoal">{item.b}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/pages/__tests__/Index.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 6: Boot dev server and eye-check the landing**

Run: `npm run dev`. Hit `/` while signed out — you should see the editorial landing with hero text, ghost watermark, orbital portrait, and the three "WHAT IT DOES" columns. Sign in — `/` should redirect to `/dashboard`. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Index.tsx src/pages/__tests__/Index.test.tsx src/components/landing/OrbitalPortrait.tsx tailwind.config.ts
git commit -m "feat(design): editorial Index landing + auth-gated dashboard redirect"
```

---

## Task 14: NotFound

**Files:**
- Modify: `src/pages/NotFound.tsx`

- [ ] **Step 1: Replace its contents with**

```tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <EyebrowLabel>404</EyebrowLabel>
      <h1 className="mt-4 text-[48px] font-medium tracking-tight2 text-ink">
        We can't find that page.
      </h1>
      <p className="mt-3 max-w-[44ch] text-[15px] font-[450] text-charcoal">
        The link may be stale, or the route was renamed.
      </p>
      <Button variant="outlined" size="default" asChild className="mt-8">
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/NotFound.tsx
git commit -m "feat(design): minimal editorial 404"
```

---

## Task 15: Dashboard page-shell repaint

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Read the file** so you know its current structure (62 lines, a search/policy-card view).

- [ ] **Step 2: Wrap the page in the editorial shell**

Edit the top-level JSX to look like:

```tsx
return (
  <div className="min-h-screen bg-canvas">
    <div className="px-6">
      <PillNav />
      <UtilityRow onRefresh={refresh} isRefreshing={isRefreshing} />
    </div>

    <main className="mx-auto mt-12 max-w-[1240px] px-8 pb-24">
      <EyebrowLabel>POLICIES</EyebrowLabel>
      <h1 className="mt-3 text-[44px] font-medium leading-tight tracking-tight2 text-ink">
        Search every Intune policy.
      </h1>

      {/* existing SearchBar, FilterDropdown, results list — keep as-is */}
      {/* ... preserve current content of the Dashboard JSX between header and end ... */}
    </main>
  </div>
);
```

Replace the previous header import + render. Add at the top of the file:

```tsx
import { PillNav } from "@/components/PillNav";
import { UtilityRow } from "@/components/UtilityRow";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
```

The variable names `refresh` / `isRefreshing` in the JSX above are illustrative — use whatever names the component currently uses for refresh wiring (from the existing Header consumer call).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Boot dev server and check**

Run: `npm run dev`, hit `/dashboard`. Confirm pill nav, eyebrow, hero, and the existing search/results render. Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(design): editorial shell for Dashboard page"
```

---

## Task 16: DashboardCompliance page-shell repaint

**Files:**
- Modify: `src/pages/DashboardCompliance.tsx`

- [ ] **Step 1: Wrap the page in the editorial shell**

Pattern is the same as Task 15. Top of return:

```tsx
return (
  <div className="min-h-screen bg-canvas">
    <div className="px-6">
      <PillNav />
      <UtilityRow onRefresh={refresh} isRefreshing={isRefreshing} />
    </div>

    <main className="mx-auto mt-12 max-w-[1240px] px-8 pb-24">
      <EyebrowLabel>COMPLIANCE</EyebrowLabel>
      <h1 className="mt-3 text-[44px] font-medium leading-tight tracking-tight2 text-ink">
        Every device, every policy.
      </h1>

      {/* KPI tiles row */}
      <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4">
        {/* existing <KpiTile ... /> usages — leave them, KpiTile already restyled */}
      </div>

      {/* Pivots, filters, table — keep existing content from here down */}
      {/* ... */}
    </main>
  </div>
);
```

Add the same imports (`PillNav`, `UtilityRow`, `EyebrowLabel`) at the top.

- [ ] **Step 2: Replace the existing KPI grid wrapper classes**

If the current code uses `grid` with old gap/columns, swap to `grid grid-cols-2 gap-5 md:grid-cols-4`. Leave the `<KpiTile>` calls untouched — Task 9 already repainted them.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Boot dev server and verify**

Run: `npm run dev`, hit `/dashboard/compliance`. Pill nav + KPI tiles + table should render. Don't worry about the table styling yet (Task 17). Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardCompliance.tsx
git commit -m "feat(design): editorial shell for Compliance page"
```

---

## Task 17: DeviceTable repaint

**Files:**
- Modify: `src/components/dashboard/DeviceTable.tsx`

- [ ] **Step 1: Wrap the existing virtualized table in an EditorialCard frame**

Read the current file. It's a virtualized table (~77 lines). Find the outer container — typically a `<div>` or `<Card>` wrapping the scroller and rows.

Replace that outer wrapper with `<EditorialCard radius="frame" padding="lg">`. Add the import:

```tsx
import { EditorialCard } from "@/components/ui/EditorialCard";
```

- [ ] **Step 2: Update header-row styles**

Find the header row (first row, often rendered separately from virtualized body). Replace its class set with:

```tsx
"sticky top-0 z-10 grid grid-cols-[2fr_1.4fr_1fr_0.8fr_0.8fr] gap-4 border-b border-border bg-lifted py-3 text-[10.5px] font-bold uppercase tracking-eyebrow text-slate"
```

(Adjust the `grid-cols-*` template to match the column count the file currently uses; preserve the existing column layout shape.)

- [ ] **Step 3: Update body-row styles**

Each virtualized row's outer class should become:

```tsx
"grid grid-cols-[2fr_1.4fr_1fr_0.8fr_0.8fr] gap-4 border-b border-border/50 px-3 py-3 text-[12.5px] font-[450] text-ink hover:bg-ink/[0.03] cursor-pointer"
```

Leave row props (`role`, `onClick`, virtualization style with `transform`) intact.

- [ ] **Step 4: Update status-badge classes inline (where the row renders compliance state)**

Replace existing badge classes with:

```tsx
// compliant
"inline-flex items-center rounded-pill bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success"
// non-compliant
"inline-flex items-center rounded-pill bg-signal/18 px-2.5 py-0.5 text-[11px] font-medium text-signal-light"
// in grace
"inline-flex items-center rounded-pill bg-signal-light/12 px-2.5 py-0.5 text-[11px] font-medium text-signal-light"
// neutral / unknown
"inline-flex items-center rounded-pill bg-ink/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-ink"
```

- [ ] **Step 5: Type-check + dev-server smoke**

Run: `npx tsc --noEmit && npm run dev`
Open `/dashboard/compliance`. The table should render inside a 32px-radius lifted frame with eyebrow column titles and the new pill badges. Stop server.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DeviceTable.tsx
git commit -m "feat(design): editorial card-table treatment"
```

---

## Task 18: DeviceDrawer repaint

**Files:**
- Modify: `src/components/dashboard/DeviceDrawer.tsx`

- [ ] **Step 1: Read the current file** (~97 lines).

The drawer likely uses shadcn `Sheet` from `@/components/ui/sheet`. The painting work is on the `SheetContent` wrapper and the inner header/sections.

- [ ] **Step 2: Restyle the SheetContent wrapper**

Find the `<SheetContent>` and add/replace its `className`:

```tsx
<SheetContent
  side="right"
  className="w-[520px] max-w-[92vw] rounded-l-3xl border-l border-border bg-lifted p-7 shadow-drawer-light dark:shadow-drawer flex flex-col"
>
```

(Drop any prior `rounded-*` / `bg-*` / `p-*` classes on it.)

- [ ] **Step 3: Restyle the close button**

If the drawer renders its own close button, swap to:

```tsx
import { IconCircleButton } from "@/components/ui/IconCircleButton";
import { X } from "lucide-react";

<IconCircleButton
  size={32}
  tone="ghost"
  className="absolute right-5 top-5"
  onClick={onClose}
  aria-label="Close"
>
  <X className="size-3.5" strokeWidth={2} />
</IconCircleButton>
```

If shadcn `Sheet` renders its own close-X internally, leave that and just style the outer wrapper.

- [ ] **Step 4: Restyle the drawer header (eyebrow + device name + sub-line + pill cluster)**

Replace the existing header block with:

```tsx
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";

<div>
  <EyebrowLabel>DEVICE</EyebrowLabel>
  <h2 className="mt-1.5 text-[28px] font-medium leading-tight tracking-tight2 text-ink">
    {device.deviceName}
  </h2>
  <p className="mt-1 text-[13px] text-slate">{device.userPrincipalName}</p>

  <div className="mt-5 flex flex-wrap gap-1.5">
    <span className="inline-flex items-center rounded-pill bg-signal/18 px-3 py-1 text-[11.5px] font-medium text-signal-light">
      {device.complianceState}
    </span>
    <span className="inline-flex items-center rounded-pill bg-ink/[0.06] px-3 py-1 text-[11.5px] font-medium text-ink">
      {device.operatingSystem} · {device.osVersion}
    </span>
    <span className="inline-flex items-center rounded-pill bg-link/15 px-3 py-1 text-[11.5px] font-medium text-link">
      {device.managedDeviceOwnerType ?? "Unknown"}
    </span>
  </div>
</div>
```

(Preserve the existing field-name accesses; the snippet above assumes `device.deviceName`, `device.userPrincipalName`, etc. — match your current props.)

- [ ] **Step 5: Move the primary CTA ("Refine reasons →") to bottom-left**

Find the existing CTA. Wrap or reposition with:

```tsx
<div className="mt-auto pt-6">
  <Button variant="ink" onClick={onRefineReasons}>
    Refine reasons →
  </Button>
</div>
```

`mt-auto` plus the parent `flex flex-col` from Step 2 pins it to the bottom.

- [ ] **Step 6: Type-check + dev-server smoke**

Run: `npx tsc --noEmit && npm run dev`. Open `/dashboard/compliance`, click any non-compliant row to open the drawer. Verify the eyebrow header, pill cluster, and bottom-left CTA. Stop server.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/DeviceDrawer.tsx
git commit -m "feat(design): editorial DeviceDrawer (eyebrow header + pinned CTA)"
```

---

## Task 19: DeviceDeepDetails — eyebrow-sectioned layout

**Files:**
- Modify: `src/components/dashboard/DeviceDeepDetails.tsx`

- [ ] **Step 1: Read the file** (~86 lines).

The component renders sections like Hardware, Compliance, Apps with their own headings and key/value lists.

- [ ] **Step 2: Replace each section heading with `<EyebrowLabel>`** and use a consistent grid for key/value pairs

Add the import:

```tsx
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
```

For each existing section, wrap with:

```tsx
<section className="border-t border-border py-4 first:border-t-0 first:pt-0">
  <EyebrowLabel>HARDWARE</EyebrowLabel>
  <dl className="mt-3 grid grid-cols-[130px_1fr] gap-x-4 gap-y-1.5 text-[13px]">
    <dt className="font-[450] text-slate">Manufacturer</dt>
    <dd className="font-[450] text-ink">{device.manufacturer}</dd>
    {/* ... */}
  </dl>
</section>
```

Repeat for each section the file currently renders (Hardware, Compliance summary, Failing policies, Detected apps — match the existing sections; don't add or remove any).

- [ ] **Step 3: Type-check + dev-server smoke**

Run: `npx tsc --noEmit && npm run dev`. Open the drawer with deep-details expanded — the sections should be hairline-separated with eyebrow-style headings. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DeviceDeepDetails.tsx
git commit -m "feat(design): eyebrow-sectioned DeviceDeepDetails"
```

---

## Task 20: SearchBar / FilterDropdown / PolicyCard repaint

**Files:**
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/components/FilterDropdown.tsx`
- Modify: `src/components/PolicyCard.tsx`

- [ ] **Step 1: SearchBar** (~26 lines)

Replace the outer wrapper class with:

```tsx
"relative flex items-center gap-2"
```

The `<Input>` already inherits the new outlined-pill style from Task 5. If there's a search-icon `<Search />` rendered absolutely-positioned inside, change its class to:

```tsx
"absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate"
```

If the Input has padding-left to make room for the icon, set the Input className to `pl-10`.

- [ ] **Step 2: FilterDropdown** (~41 lines)

If it renders a shadcn `Select` or `DropdownMenu` trigger, replace the trigger className with:

```tsx
"inline-flex h-10 items-center gap-2 rounded-[20px] border-[1.5px] border-input bg-transparent px-4 text-[14px] font-[450] text-ink hover:bg-ink/[0.04]"
```

The popover content can keep shadcn defaults — it now inherits the new tokens.

- [ ] **Step 3: PolicyCard** (~265 lines)

This is the biggest restyle of the three. Approach: wrap the entire card body in `<EditorialCard radius="card" padding="lg">` and replace internal class strings.

- Outer card wrapper class set: `"group transition-shadow hover:shadow-card cursor-pointer"`
- Title (the policy name) class: `"text-[20px] font-medium leading-tight tracking-tight2 text-ink"`
- Body description: `"mt-2 text-[14px] font-[450] leading-relaxed text-charcoal"`
- Eyebrow category (above title — add via `<EyebrowLabel>` if there's a category/platform label): `"mb-2"`
- Any platform "chip" or assignment badge: `"inline-flex items-center rounded-pill bg-ink/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-ink"`
- Primary action: `<Button variant="ink" size="sm">…</Button>`
- Secondary action: `<Button variant="outlined" size="sm">…</Button>`
- Remove any of the deprecated `bg-windows*` / `bg-ios*` / `bg-android*` / `bg-all-platforms*` color classes; replace with the chip class above.

Add imports:

```tsx
import { EditorialCard } from "@/components/ui/EditorialCard";
import { EyebrowLabel } from "@/components/ui/EyebrowLabel";
```

- [ ] **Step 4: Type-check + dev-server smoke**

Run: `npx tsc --noEmit && npm run build && npm run dev`
On `/dashboard`, search for a policy. SearchBar/Filter/PolicyCard should all render in the new editorial style. Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/FilterDropdown.tsx src/components/PolicyCard.tsx
git commit -m "feat(design): editorial repaint of SearchBar, FilterDropdown, PolicyCard"
```

---

## Task 21: Verification + Vitest sweep

**Files:** none

- [ ] **Step 1: Type-check the full tree**

Run: `npx tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: PASS. Resolve any "unknown utility class" Tailwind warnings by editing the offending file (most common: leftover `bg-windows-*` etc. from Task 3 Step 2 grep that slipped through).

- [ ] **Step 3: Vitest run**

Run: `npx vitest run`
Expected: PASS. Auth-redirect test from Task 13 must pass; any pre-existing tests should still pass.

- [ ] **Step 4: Manual smoke against dev server**

Run: `npm run dev`. Walk these flows:

1. **Signed-out `/`** — editorial landing renders: pill nav, eyebrow, hero text, ghost watermark, orbital portrait, "WHAT IT DOES" trio, dark footer.
2. **Sign in** (existing MSAL flow) — `/` redirects to `/dashboard`.
3. **`/dashboard`** — pill nav + UtilityRow, eyebrow + hero, search box and filters in pill style, results list in EditorialCard style.
4. **`/dashboard/compliance`** — KPI tile row (4 tiles, 28px radius, big numbers), table renders inside a 32px-radius lifted frame with eyebrow column titles and pill status badges.
5. **Click a non-compliant row** — drawer slides in from right with eyebrow + device name + pill cluster + hairline-separated deep-detail sections + bottom-left "Refine reasons →" CTA.
6. **Click "Refine reasons →"** — bulk fetch fires (Graph fix from earlier in branch), drawer body updates with per-setting failures.
7. **Theme toggle** — click the ninja in UtilityRow. Page flips between cream and true-black; spinning ninja animation plays.
8. **NotFound** — visit `/garbage`. Eyebrow 404 + headline + outlined-pill "Back to Dashboard" CTA.
9. **DevTools console** — zero errors, zero React warnings on each page.

If any flow fails, file a follow-up task on this plan and fix before moving on.

- [ ] **Step 5: Commit any final tweaks from manual smoke**

If steps 1-4 surfaced fixes:

```bash
git add -u
git commit -m "fix(design): manual-smoke follow-ups"
```

If nothing to fix, skip.

- [ ] **Step 6: Push the branch**

Run: `git push -u origin feature/dashboard-compliance` (only if the user has explicitly said to push). Otherwise stop here and report completion to the user with `git log --oneline main..HEAD` so they can decide.

---

## Self-review notes

- Spec coverage walked: palette ✓ (T2/T3), typography ✓ (T1/T2/T3), nav ✓ (T10/T11), Index ✓ (T13), KPI ✓ (T9), table ✓ (T17), drawer ✓ (T18/T19), buttons/inputs ✓ (T4/T5), dashboard pages ✓ (T15/T16), legacy components ✓ (T20), NotFound ✓ (T14), footer ✓ (T12).
- Out-of-scope items in spec (Graph fix, drawer-deep-details inline-settingStates) intentionally not addressed.
- "Default theme respects `prefers-color-scheme`" — the existing `ThemeProvider` already does this; no plan task needed beyond preserving it.
