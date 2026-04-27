# Mastercard-inspired Redesign — Design Spec

**Date:** 2026-04-27
**Scope:** Full visual redesign of the Intune Policy Search app to match `DESIGN.md` (Mastercard-inspired), shipped as a single PR. Adds a custom dark variant that preserves the editorial feel.

## Goal & non-goals

**Goal.** Apply the Mastercard design language verbatim — warm cream canvas, ink-black CTAs, oversized pill radii, MarkForMC-substitute typography, eyebrow labels with accent dot, editorial spacing — across every page and component, in both light and dark themes.

**Non-goals.**
- No backend / API changes. The recent `getNonCompliantPolicyStatesBulk` Graph fix is independent.
- No routing changes beyond an auth-gated `Index`-to-`Dashboard` redirect.
- No removal of the existing ninja theme toggle (`/ninja.png` + `ninja-spin` animation) — it is preserved as the theme switch.

## Direction (locked)

| Decision | Choice |
| --- | --- |
| Faithfulness | Full literal port (option A) |
| Dark mode | Yes — designed to match the editorial feel |
| Sequencing | Single PR, all surfaces in one sweep |

## Palette

### Light (DESIGN.md verbatim)

| Token | Hex | Role |
| --- | --- | --- |
| `--canvas` | `#F3F0EE` | Page background — warm putty cream, never pure white |
| `--lifted` | `#FCFBFA` | One step lighter — for nested cards / table frames |
| `--white` | `#FFFFFF` | Floating pill nav, modal cards, satellite circles |
| `--ink` | `#141413` | Primary text, headlines, primary CTA fill, footer |
| `--charcoal` | `#262627` | Softer black text alternate |
| `--slate` | `#696969` | Muted secondary text, eyebrow alternative |
| `--dust` | `#D1CDC7` | Whisper text — disabled / placeholder |
| `--signal` | `#CF4500` | Aggressive accent — used sparingly (consent, eyebrow dots) |
| `--signal-light` | `#F37338` | Decorative accent — orbital arcs, indicators |
| `--clay` | `#9A3A0A` | Deep rust — secondary link buttons |
| `--link` | `#3860BE` | Inline links / informational callouts |

### Dark (True Black Editorial — designed)

| Token | Hex | Role |
| --- | --- | --- |
| `--canvas` | `#0B0A0A` | Near-black canvas, slightly warmed |
| `--lifted` | `#181715` | Lifted surface — table frames, pill nav, KPI cards |
| `--ink` | `#ECE7E2` | Primary text, primary CTA fill (cream/ink inversion) |
| `--charcoal` | `#B8B0A6` | Softer body text |
| `--slate` | `#948C84` | Muted secondary text, utility row |
| `--dust` | `#555555` | Whisper text |
| `--signal` | `#CF4500` | Retained — same aggressive accent |
| `--signal-light` | `#F37338` | Retained |
| `--success` | `#5CC58A` | Compliance / connected indicator |
| `--link` | `#7B9FE8` | Inline links (lifted blue for dark contrast) |

Border / hairline in both themes is `--ink` at 6–8% alpha.

## Typography

- **Family.** Sofia Sans (Google Fonts) is the closest open-source match to MarkForMC. Loaded once in `index.html`. Variable weight; we use **450** for body, **500** for headlines and nav links, **700** for eyebrow labels and column headers.
- **Hierarchy.**

  | Role | Size | Weight | Line height | Tracking |
  | --- | --- | --- | --- | --- |
  | H1 hero | 64px | 500 | 1.0 | -2% |
  | H2 section | 36px | 500 | 44px | -2% |
  | H3 card title | 24px | 500 | 1.2 | -2% |
  | Body | 16px | 450 | 1.4 | normal |
  | Nav link / button | 16px | 500 | 1.0 | -3% |
  | Eyebrow | 14px | 700 | 1.0 | +4%, uppercase, leading `•` accent |
  | Footer link | 14px | 450 | ~1.4 | normal |

- **Principles.** No second typeface. Tight negative tracking on display text; uppercase only on the eyebrow scale. The 450 body weight is load-bearing and must not be replaced with 400.

## Navigation (locked, v5)

A slim floating pill nav docked below viewport top, plus a quiet text-only utility row beneath.

**Pill (max-width 860px, centered).**

- **Left:** "Intune Policy" wordmark at 15px / weight 500 / tracking -1%.
- **Center:** three nav links (Policies, Dashboard, Compliance) at 14px / weight 450, gap 44px. Active link is weight 500 with no underline. Hover lifts opacity from 0.85 → 1.0.
- **Right:** 40px circular cream sign-out button (background `--ink`, foreground `--canvas`, 1.05× hover scale). Lucide `LogOut` icon, 16px stroke 1.6.

Pill background `--lifted`, border `--ink @ 6%`, padding `10px 12px 10px 32px`, radius 999px, shadow `0 24px 60px rgba(0,0,0,0.45)` in dark, `0 24px 48px rgba(0,0,0,0.08)` in light.

**Utility row (under pill, max-width matches, right-aligned, 12px / `--slate`).**

- `<small green dot> Henrik Söderström · Connected` — connection indicator + identity.
- `<refresh icon> Refresh` — text+icon link, fires the same `onRefresh` callback as today's Header.
- **Ninja theme toggle** — existing `ThemeToggle` component, unchanged. Replaces the "Theme" item from the mockup. Sits at the end of the row.

The unauthenticated state of the pill replaces the sign-out circle with a Sign-in CTA pill (same cream background, 8px 20px padding, "Sign in" label).

## Pages

### Index (editorial landing — unauthenticated only)

When the user is **not authenticated**, `/` renders an editorial hero in the spirit of Mastercard's homepage. When the user **is authenticated**, `/` redirects to `/dashboard`.

**Layout (cream canvas in light, true black in dark).**

- Pill nav at top.
- Eyebrow `• INTUNE POLICY SEARCH` + H1 hero "See every device. Every policy. No exports." (or similar — copy locked in implementation).
- One circular image portrait (~360px) with a faint traced `--signal-light` orbital arc spanning the viewport width and a single white "satellite" CTA dot docked on the perimeter (the satellite is the Sign-in trigger).
- A ghost watermark headline (cream-on-cream at H2 scale, ~6% alpha on light / ~4% alpha on dark) layered behind the portrait.
- One eyebrow-labeled "WHAT IT DOES" section with three stacked one-line value props.
- Dark warm-black footer (`--ink` in light theme, deepened a step in dark) with four short link columns and a large conversational headline.

The portrait image is decorative — placeholder asset; project owner can swap.

### Dashboard (legacy policy search) and Compliance dashboard

Both dashboards share the same shell:

1. Pill nav.
2. Eyebrow + H2 page title row.
3. KPI tile grid (Compliance only — 4 tiles).
4. Filter row (existing `SearchBar`, `FilterDropdown`) restyled as outlined pills.
5. Editorial card-table.

### NotFound

Cream / true-black canvas, eyebrow `• 404`, H1 "We can't find that page.", outlined-pill "Back to Dashboard" CTA. No decoration.

## Components

### KPI tile

- **Container.** 28px radius lifted-cream card, padding `22px 24px`, min-height 140px.
- **Eyebrow** (top): label like `• DEVICES`, `• COMPLIANT`, weight 700, tracking +4%, signal-orange dot.
- **Number.** 44px / weight 500 / tracking -3% / line 1.0 — flush with eyebrow vertically, with breathing room.
- **Delta pill** (bottom-left, optional): rounded 999px capsule, 11px / weight 500. Up arrow + signal-orange tint for negative deltas (more non-compliant), down arrow + success-green tint for positive, neutral grey for "no change".

### Editorial card-table

- **Outer frame.** Lifted-cream card, 32px radius, padding 24px, contains the table.
- **Header row.** Eyebrow-style column titles: 10.5px / weight 700 / uppercase / +6% tracking / `--slate`. Hairline `--ink @ 8%` underneath.
- **Body rows.** 12.5px body, weight 450, padding `12px`. Hairline divider `--ink @ 5%` between rows. Hover tints with `--ink @ 3%`.
- **Status badges.** Inline 999px-radius pills inside the row — this is where the "pill language" lives.
- Virtualization (`@tanstack/react-virtual` already in use) is preserved.

### DeviceDrawer

- **Frame.** Slides in from the right, full-height, 520px wide on desktop. Outer radius `24px 0 0 24px` (only the inside edge of the panel rounds; outer edges meet the viewport). Background `--lifted`, shadow `-24px 0 60px rgba(0,0,0,0.5)` (dark) / `-24px 0 60px rgba(0,0,0,0.12)` (light).
- **Close button.** Top-right 32px circle, semi-transparent ink fill, Lucide `X` icon.
- **Header.** Eyebrow `• DEVICE`, H2 device name (28px / weight 500 / tracking -2%), sub-line at 13px `--slate` for UPN, pill cluster (status, OS+version, ownership, last-sync) wrapped underneath.
- **Sections.** Hairline-separated `(• EYEBROW + key/value list)` blocks: Hardware, Compliance summary, Failing policies, Detected apps. Same content as today's `DeviceDeepDetails`.
- **Primary CTA.** Pinned bottom-left: cream pill button "Refine reasons →" — fires the existing deep-fetch wave.

### PolicyCard (legacy `Dashboard`)

Restyled to a 24px-radius lifted card with eyebrow category, H3 policy name, body description in 450 weight, ink-pill primary action and outlined-pill secondary. No structural change.

### Buttons (shared)

| Variant | Background | Text | Border | Radius | Padding |
| --- | --- | --- | --- | --- | --- |
| Primary (Ink Pill) | `--ink` | `--canvas` | 1.5px solid `--ink` | 20px | `6px 24px` |
| Secondary (Outlined Pill) | `--white` (light) / transparent (dark) | `--ink` | 1.5px solid `--ink` | 20px | `6px 24px` |
| Signal | `--signal` | `#FFFFFF` | none | 24px | `8px 20px` |
| Icon-circle (e.g., sign-out) | `--ink` | `--canvas` | none | 999px | 40×40 |

All buttons: font Sofia Sans 16px / weight 500 / tracking -3%. Active/pressed compresses by 1px (no separate hover variant).

### Inputs (search, filter)

Outlined pill style: 20px radius, 1.5px border `--ink @ 25%`, focus ring `--signal-light @ 40%`, 6px 16px padding. No drop-shadow.

## Theme switching

- Single `class="dark"` on `<html>` toggles the theme via the existing `ThemeProvider`. All tokens are HSL CSS variables defined in `index.css`; the `dark` class flips the variable values.
- Default theme: respects the user's system preference (`prefers-color-scheme`), with explicit toggles persisted to `localStorage` (existing `ThemeProvider` behavior is kept).
- The ninja toggle and `ninja-spin` animation are preserved.

## Files affected

- **Foundation.** `src/index.css` (CSS variables for both themes), `tailwind.config.ts` (extend radii, fonts, colors), `index.html` (Sofia Sans link).
- **Components — restyled.** `Header.tsx` → split into `PillNav.tsx` + `UtilityRow.tsx`. `ThemeToggle.tsx` (kept, possibly minor class tweaks). `SearchBar.tsx`, `FilterDropdown.tsx`, `PolicyCard.tsx`. `components/ui/*` shadcn primitives — radius / palette overrides only.
- **Components — new.** `EyebrowLabel.tsx`, `KpiTile.tsx`, `EditorialCard.tsx` (the 32px frame), `OrbitalPortrait.tsx` (Index hero), `Footer.tsx`.
- **Components — dashboard.** `dashboard/DeviceTable.tsx`, `dashboard/DeviceDrawer.tsx`, `dashboard/DeviceDeepDetails.tsx` — repaint to new tokens; structure preserved.
- **Pages.** `Index.tsx` (editorial landing + auth-gated redirect), `Dashboard.tsx`, `DashboardCompliance.tsx`, `NotFound.tsx`.

## Out of scope

- The `getNonCompliantPolicyStatesBulk` two-wave Graph fix already shipped as part of this branch.
- The `getDeviceDeepDetails` drawer assumes inline `settingStates` — that's a known but separate bug; not addressed here.
- No new pages, no new routes, no auth-flow changes besides the post-login `/` → `/dashboard` redirect.
