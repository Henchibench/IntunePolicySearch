# Design System Based on Microsoft Fluent 2

> Target: **Fluent 2 for the Web** — the design language Microsoft ships across the Microsoft 365 admin centers, Azure portal, and the Intune admin center. This app deliberately mirrors that environment, with one tuning choice: a softly **tinted canvas, 8px card corners, and a touch more elevation depth** than the stark portal default. Every token below traces to the Fluent 2 web design tokens (`@fluentui/tokens`); the friendly names are paired with the canonical values so the system is reproducible without the library.

## 1. Visual Theme & Atmosphere

Fluent 2 reads like a calm, information-dense productivity tool: neutral, crisp, and quietly confident. The system is built on **opaque neutral surfaces** layered by subtle elevation, **one brand accent** (Communication Blue) used sparingly for action and selection, and **Segoe UI** carrying the entire type system. There is no warmth-by-decoration here — hierarchy comes from neutral background steps, weight contrast, and soft shadows, not from color washes or ornamental shapes.

The dominant gesture is **the layered surface**. Content sits on a softly tinted canvas; cards, lists, and panels are opaque white (light) or near-black (dark) rectangles lifted off that canvas by a two-part Fluent shadow (a tight ambient ring plus a soft directional drop). Corners are gently rounded — **4px on controls, 8px on cards** — never pill-shaped, never sharp. Interaction is communicated through **state layers** (subtle hover/pressed background tints) and a single **brand-blue focus and selection signal**.

The second gesture is **restraint with color**. Color is a tool for meaning, not surface. Brand blue marks the primary action, the selected tab, the focused field, and links — nothing else. Status colors (green/red/orange) appear only as small semantic signals. Large areas are always neutral. This is what makes a Fluent surface feel trustworthy for administrative work: the eye is never pulled anywhere it doesn't need to go.

**Key Characteristics:**
- Tinted neutral canvas (`#F5F5F7` light / `#141414` dark) — never pure white as the page background; surfaces above it are opaque
- Three-step surface layering: canvas → card/surface (`#FFFFFF` / `#1F1F1F`) → raised flyout, separated by elevation, not hue
- Brand Communication Blue (`#0F6CBD`) reserved for primary actions, selection, focus, and links
- Soft corner radius scale: 4px controls, 8px cards/dialogs, circular only for avatars/badges
- Two-part Fluent shadows (ambient + key) for elevation; borders for functional delineation
- Segoe UI across the entire ramp; weight contrast (400 / 600 / 700) carries hierarchy
- State layers (hover/pressed/selected background tints) instead of color changes for interactivity
- Full light **and** dark theme parity, both defined from Fluent neutral and brand ramps

## 2. Color Palette & Roles

Fluent organizes color into three palettes — **neutral**, **brand**, and **shared (status)** — exposed as global tokens (raw hex) and alias tokens (semantic roles). Below, each role lists its light and dark value.

### Brand — Communication Blue

The brand ramp is Fluent's "Communication Blue." Primary `80` is the workhorse.

| Global token | Hex | Role |
|------|-----|------|
| Brand 60 | `#0F548C` | Selected / pressed-deep |
| Brand 70 | `#115EA3` | Hover (light) / brand background (dark) |
| **Brand 80** | **`#0F6CBD`** | **Primary brand background, links (light)** |
| Brand 90 | `#2886DE` | — |
| Brand 100 | `#479EF5` | Brand foreground & links (dark) |
| Brand 110 | `#62ABF5` | Brand foreground 2 (dark) |
| Brand 150 | `#CFE4FA` | Brand-tinted backgrounds / subtle selection |

**Alias roles:**
- **Primary action background**: `#0F6CBD` light · `#115EA3` dark — hover `#115EA3` / `#0F6CBD`, pressed `#0C3B5E` both
- **Brand foreground / links**: `#0F6CBD` light · `#479EF5` dark
- **Selection / focus stroke**: `#0F6CBD` light · `#479EF5` dark
- **Subtle brand selection fill** (selected row/tab wash): `#EBF3FC` light · `rgba(71,158,245,0.12)` dark

### Neutral — Backgrounds

| Role (alias) | Light | Dark |
|------|-------|------|
| **Canvas** (page body) | `#F5F5F7` | `#141414` |
| **Surface 1** (cards, lists, inputs) | `#FFFFFF` | `#1F1F1F` |
| **Surface 2** (nested / lower container) | `#FAFAFA` | `#292929` |
| **Surface 3** (subtle wells, table headers) | `#F5F5F5` | `#0A0A0A` |
| **Hover layer** (subtle) | `#F5F5F5` | `#3D3D3D` |
| **Pressed layer** (subtle) | `#E0E0E0` | `#1F1F1F` |
| **Disabled background** | `#F0F0F0` | `#141414` |
| **Inverted background** (tooltips) | `#292929` | `#FFFFFF` |

> The canvas tint (`#F5F5F7`) is this app's tuning choice — Fluent's literal portal default is `#FFFFFF`/`#FAFAFA`. The slightly cool grey gives cards definition without a hard border and is the "depth" we chose over the flat portal look.

### Neutral — Foreground (Text & Icons)

| Role | Light | Dark |
|------|-------|------|
| **Foreground 1** (primary text) | `#242424` | `#FFFFFF` |
| **Foreground 2** (secondary) | `#424242` | `#D6D6D6` |
| **Foreground 3** (tertiary / captions) | `#616161` | `#ADADAD` |
| **Foreground 4** (hint / watermark) | `#707070` | `#999999` |
| **Disabled foreground** | `#BDBDBD` | `#5C5C5C` |
| **On-brand foreground** (text on blue) | `#FFFFFF` | `#FFFFFF` |

### Neutral — Strokes

| Role | Light | Dark |
|------|-------|------|
| **Stroke 1** (default control border) | `#D1D1D1` | `#666666` |
| **Stroke 2** (card / divider) | `#E0E0E0` | `#525252` |
| **Stroke 3** (subtle divider) | `#F0F0F0` | `#3D3D3D` |
| **Accessible stroke** (3:1 on canvas) | `#616161` | `#ADADAD` |

### Shared — Status Colors

Used only as small semantic signals (badges, dots, inline validation), never as large fills.

| Status | Primary foreground | Tint background (light) | Use |
|--------|--------|-----------------|-----|
| **Success** | `#107C10` | `#F1FAF1` | Create/add operations, success results, compliant |
| **Danger / Error** | `#D13438` | `#FDF3F4` | Delete operations, failures, errors, non-compliant |
| **Warning** | `#F7630C` | `#FFF9F5` | Update/modify operations, cautions |
| **Severe warning** | `#DA3B01` | `#FDF6F3` | Destructive confirmations |
| **Info** (brand) | `#0F6CBD` | `#EBF3FC` | Neutral informational callouts |

> **Audit page mapping:** the operation dots become Success `#107C10` (create), Warning `#F7630C` (update), Danger `#D13438` (delete) — replacing the prior ad-hoc emerald/amber/red.

### Gradient System
Fluent 2 uses **no decorative gradients** in core UI. The only permitted "gradient" is the implicit one created by elevation — a card's shadow against the canvas. Do not introduce color gradients on surfaces, buttons, or text.

## 3. Typography Rules

### Font Family
- **Primary**: `'Segoe UI Variable', 'Segoe UI'` — Microsoft's UI typeface, native on Windows.
- **Fallback stack**: `'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif` — degrades gracefully on macOS/Linux where Segoe isn't installed.
- **Monospace** (IDs, JSON, script content): `Consolas, 'Courier New', Courier, monospace`.

### Type Ramp (Fluent named styles)

| Role | Size | Line height | Weight | Notes |
|------|------|-------------|--------|-------|
| Display | 68px | 92px | 600 | Marketing-scale only; rare in-app |
| LargeTitle | 40px | 52px | 600 | Page hero on landing surfaces |
| Title1 | 32px | 40px | 600 | Primary page title |
| Title2 | 28px | 36px | 600 | Section title |
| Title3 | 24px | 32px | 600 | Card / panel title |
| Subtitle1 | 20px | 28px | 600 | Page heading (app default for `<h1>`) |
| Subtitle2 | 16px | 22px | 600 | Sub-section heading |
| Body1Strong | 14px | 20px | 600 | Emphasized body, labels, table headers |
| **Body1 (base)** | **14px** | **20px** | **400** | Default body text |
| Caption1 | 12px | 16px | 400 | Secondary metadata, timestamps |
| Caption2 | 10px | 14px | 400 | Smallest legal/overline |

### Weights
- **Regular 400** — body, paragraphs, most UI text
- **Semibold 600** — headings, button labels, table headers, selected state, emphasis
- **Bold 700** — reserved; use only for rare strong emphasis within body

### Principles
- **600 is the heading weight.** Fluent does not use a heavy display weight for hierarchy — it pairs 600 headings with 400 body. Avoid 700 for titles.
- **No negative letter-spacing.** Segoe UI is tuned for screen at default tracking; do not tighten headings (this is the opposite of the prior Mastercard system).
- **No uppercase transforms** except true overlines (Caption2). No shouty section headers.
- **One font system.** Hierarchy comes from size + weight, never from a second display or serif face.
- **14px is the body baseline**, not 16px — Fluent is information-dense. Use 12px (Caption1) for metadata.

## 4. Component Stylings

All controls share: **4px corner radius** (`borderRadiusMedium`), **1px strokes** (`strokeWidthThin`), **Segoe UI**, and **state layers** for hover/pressed.

### Buttons

**Primary (`appearance="primary"`)**
- Background: Brand `#0F6CBD` (light) / `#115EA3` (dark)
- Text: `#FFFFFF` · Border: none
- Radius: 4px · Height: 32px (medium) · Padding: 0 12px · Min-width: 96px
- Font: 14px / 600
- Hover: `#115EA3` / `#0F6CBD` · Pressed: `#0C3B5E`
- Use for: the single most important action on a surface (Save, Apply, Filter)

**Default / Secondary (`appearance="outline"`)**
- Background: Surface 1 (`#FFFFFF` / `#1F1F1F`)
- Text: Foreground 1 · Border: 1px solid Stroke 1 (`#D1D1D1` / `#666666`)
- Radius: 4px · same metrics as primary
- Hover: background Hover-layer (`#F5F5F5` / `#3D3D3D`) · Pressed: `#E0E0E0`
- Use for: all standard actions; pair beside one primary

**Subtle (`appearance="subtle"`)**
- Background: transparent · Text: Foreground 2 · Border: none
- Hover: subtle hover layer fill only
- Use for: toolbar/command-bar actions, icon buttons, low-emphasis controls

**Transparent / Link (`appearance="transparent"`)**
- Background: transparent, no border; Text: brand for links, Foreground 2 for neutral
- Use for: inline text actions, "Raw JSON" toggles

**Sizes:** Small 24px / 12px font / pad 0 8px · Medium 32px (default) · Large 40px / 16px font / pad 0 16px.
**Shapes:** default rounded (4px); `circular` (pill) only for icon-only chips and filter pills.

### Inputs & Forms

**Text field / Input**
- Background: Surface 1 · Text: Foreground 1 · Placeholder: Foreground 4
- Border: 1px solid Stroke 1, **plus a 1px bottom "active indicator" in Stroke Accessible**
- Radius: 4px (top corners); the bottom indicator stays square-aligned
- Height: 32px (medium) · Padding: 0 8px
- **Focus**: the bottom active indicator thickens to **2px in brand `#0F6CBD`** (`#479EF5` dark) — this animated bottom stroke is Fluent's signature focus treatment. Do not replace it with a full box-glow.
- Disabled: background Disabled, text Disabled foreground

**Dropdown / Combobox / Select** — same field treatment with a trailing chevron (Foreground 3).
**Checkbox / Radio** — 16px box, Stroke 1 border unchecked; checked fills brand `#0F6CBD` with white glyph; 4px radius (checkbox) / circular (radio).
**Search** — standard input with a leading magnifier icon (Foreground 3); no special pill shape required.

### Cards & Containers

**Card / Surface panel**
- Background: Surface 1 (`#FFFFFF` / `#1F1F1F`)
- Radius: **8px** (`borderRadiusXLarge` — the app's depth choice)
- Border: 1px solid Stroke 2 (`#E0E0E0` / `#525252`) **or** elevation shadow4 — use one, not both heavily; prefer shadow on the canvas tint
- Padding: 12–16px
- Use for: the primary content container, list wrappers, detail blocks

**List / Table container**
- Wrapper: Surface 1, 8px radius, 1px Stroke 2 or shadow4, `overflow: hidden`
- Rows: divided by 1px Stroke 3 (`#F0F0F0` / `#3D3D3D`); row hover = subtle hover layer
- Header row: Surface 3 background, Body1Strong (14/600) text
- Selected row: subtle brand wash (`#EBF3FC` / brand-12%) with a 2px brand left indicator optional

**Dialog / Flyout / Popover**
- Background: Surface 1 · Radius: 8px · Shadow: shadow16 (popover) / shadow64 (dialog)
- Border: 1px Stroke 2 (light); in dark, shadow carries the edge
- Dialog max-width ~ 600px; backdrop scrim `rgba(0,0,0,0.4)`

### Badges & Tags
- **Badge** (status/count): circular or 4px-radius pill, height 20px, 12px/600 text. Filled variants use status tint backgrounds + status foreground (e.g. Success `#F1FAF1` bg / `#107C10` text).
- **Counter badge** (selection count): brand `#0F6CBD` fill, white text, circular.

### Navigation

**Top tab nav (current `PillNav` surface)**
- Container: Surface 1 bar, 1px Stroke 2 bottom border (no float, sits at top)
- Tabs: 14px text, Foreground 2 default; **selected tab = Foreground 1 / 600 with a 2px brand `#0F6CBD` underline indicator** (rounded ends). This replaces the prior floating pill.
- Hover: subtle hover layer behind the tab
- Brand mark left, optional command actions right

**Side nav (if used)** — Fluent `Nav`: items 32px tall, 4px radius hover fill, selected item gets subtle brand wash + 2px brand left bar.

### Drawer / Detail Panel
- Slides from the right · Width: full on mobile, ~592px (`sm`) desktop
- Background: Surface 1 · Shadow: shadow64 · No radius on the screen edge, 0px outer
- Header: Title3 (24/600) + status badges row; body uses Body1 with Foreground 2 labels

### Diff / Code Display
- Container: Surface 3 well (`#F5F5F5` / `#0A0A0A`), 4px radius, monospace 12px
- Old value: Foreground 3 with `line-through`; New value: Foreground 1
- For raw JSON: monospace block on Surface 3, not a colored syntax theme

### Image / Icon Treatment
- **Icons**: Fluent UI System Icons (line weight ~1.5px), sized 16/20/24px, colored Foreground 2 (or brand when interactive/selected).
- **Avatars**: circular, with neutral or brand initials fallback.
- **Imagery**: rare in this app; when present, 4–8px radius rectangles. **No circular photo masks** (that was the prior system).

## 5. Layout Principles

### Spacing System
- **Base unit**: 4px (Fluent spacing scale).
- **Scale**: 2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 (XXS · XS · S · MNudge→M · L · XL · XXL · XXXL).
- **Card internal padding**: 12–16px desktop, 12px mobile.
- **Section gap**: 16–24px between stacked content blocks; 32px between major regions.
- **Control gap**: 8px between related controls (button groups, filter chips).

### Grid & Container
- **Max content width**: ~1280px centered, with 16–24px horizontal gutter (tighter than the prior editorial 48–100px).
- **Density**: Fluent is comfortable-dense. Default to 32px control heights; offer no oversized hero whitespace.
- **Responsive columns**: content-first single column on mobile; 2-up filter/results splits on desktop where useful.

### Border Radius Scale

| Token | Radius | Use |
|-------|--------|-----|
| `borderRadiusNone` | 0 | Flush dividers, full-bleed edges |
| `borderRadiusSmall` | 2px | Tiny chips, inline code |
| `borderRadiusMedium` | 4px | **Controls** — buttons, inputs, dropdowns, checkboxes |
| `borderRadiusLarge` | 6px | Menus, small popovers |
| `borderRadiusXLarge` | 8px | **Cards, dialogs, list containers, drawers** |
| `borderRadiusCircular` | 10000px | Avatars, counter badges, icon pills |

The scale is tight and functional — **4px for controls, 8px for containers**. Never pill-shape rectangular content; never exceed 8px on cards.

### Stroke Widths
1px (`strokeWidthThin`, default borders/dividers) · 2px (`strokeWidthThick`, focus indicators, selected bars) · 3–4px (rare, heavy emphasis).

## 6. Depth & Elevation

Fluent shadows are **two-part**: a tight ambient ring (`0 0 2px`) plus a soft directional key drop. Opacity is low in light, higher in dark.

| Level | Light | Dark | Use |
|-------|-------|------|-----|
| 2 | `0 0 2px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.14)` | `…rgba(0,0,0,.24), …rgba(0,0,0,.28)` | Subtle lift, hover on flat items |
| 4 | `0 0 2px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.14)` | `.24 / .28` | **Cards on the canvas (default)** |
| 8 | `0 0 2px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.14)` | `.24 / .28` | Menus, raised cards |
| 16 | `0 0 2px rgba(0,0,0,.12), 0 8px 16px rgba(0,0,0,.14)` | `.24 / .28` | Popovers, flyouts |
| 64 | `0 0 8px rgba(0,0,0,.12), 0 32px 64px rgba(0,0,0,.14)` | `.24 / .28` | Dialogs, right-side drawer |

### Shadow Philosophy
Elevation communicates **layering and transience** — the higher the shadow, the more "temporary/on-top" the surface (a dialog is shadow64; a resting card is shadow4). Use **borders for permanent structural delineation** (dividers, input outlines) and **shadows for things that float above** (cards on tinted canvas, menus, drawers). In dark mode, shadows alone can read weakly — pair card edges with Stroke 2 if definition is lost.

### No Decorative Depth
No orbital arcs, no ghost watermark text, no glow, no neon. Depth is strictly the neutral shadow set above.

## 7. Do's and Don'ts

### Do
- Use the tinted canvas (`#F5F5F7` / `#141414`) for the page body; put content on opaque Surface 1 cards
- Reserve brand blue `#0F6CBD` for primary action, selection, focus, and links — nothing else
- Set headings in Segoe UI **600** at default tracking; body at **400 / 14px**
- Use 4px radius on controls, 8px on cards/dialogs/drawers
- Show focus with the **2px brand bottom active-indicator** on fields, and a brand focus ring on buttons
- Use the Fluent two-part shadow set for elevation; borders for dividers
- Use status colors (green/red/orange) only as small semantic signals
- Provide full light **and** dark values for every surface, text, and stroke role
- Keep density comfortable — 32px controls, 12–16px card padding

### Don't
- Don't use pure white as the page canvas — use the tint so cards separate without heavy borders
- Don't tighten heading letter-spacing or use 700 for titles (that was the old system)
- Don't pill-shape rectangular content or exceed 8px radius on cards
- Don't paint large surfaces with brand or status color — color is for meaning, not area
- Don't add gradients, glows, circular photo masks, orbital lines, or watermark text
- Don't replace the field's bottom active-indicator focus with a generic box-shadow glow
- Don't introduce a second typeface or use weight 450 — the ramp is 400 / 600 / 700 Segoe UI
- Don't rely on shadow alone for card edges in dark mode — add Stroke 2 if needed
- Don't use uppercase transforms outside true overlines

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | ≤ 639px | Single column; top nav collapses to brand mark + overflow menu; drawer goes full-width; tables become stacked rows; page title drops to Subtitle1 (20px) |
| Tablet | 640–1023px | 2-up filter/results where useful; nav shows primary tabs; drawer ~480px |
| Desktop | ≥ 1024px | Full top tab nav with brand underline indicator; drawer ~592px; content max ~1280px |
| Wide | ≥ 1366px | Content max-width caps ~1280px; gutters grow symmetrically |

### Touch Targets
Interactive targets meet **44×44px** effective hit area even when the visual control is 32px (use padding/inset hit areas). Icon buttons get a 32px visual / 40px hit minimum. Checkboxes/radios keep a 32px touch target around a 16px glyph.

### Collapsing Strategy
- **Nav**: top tab bar → overflow menu on mobile; the brand underline indicator is preserved on the active tab.
- **Tables/lists**: row grids collapse to stacked label/value pairs on mobile.
- **Drawer**: right-side panel → full-screen sheet on mobile.
- **Spacing**: section gaps compress from 24–32px to 16px on mobile.
- **Density**: control heights stay 32px (tap targets handled via hit-area padding, not larger visuals).

### Theme Behavior
Light/dark is a token swap, not a layout change. Honor `prefers-color-scheme` and an explicit toggle. Every color role in Section 2 has a paired dark value — switching themes must never leave a hard-coded light color behind.

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary action: "Brand blue `#0F6CBD` (light) / `#115EA3` (dark) background, white text, 4px radius"
- Canvas / page body: "Tinted neutral `#F5F5F7` (light) / `#141414` (dark) — never pure white"
- Surface / card: "Opaque `#FFFFFF` (light) / `#1F1F1F` (dark), 8px radius, shadow4"
- Primary text: "Foreground 1 `#242424` / `#FFFFFF`"
- Secondary text: "Foreground 2 `#424242` / `#D6D6D6`"
- Tertiary / captions: "Foreground 3 `#616161` / `#ADADAD`"
- Links / brand foreground: "`#0F6CBD` (light) / `#479EF5` (dark)"
- Default border: "Stroke 1 `#D1D1D1` / `#666666` (controls); Stroke 2 `#E0E0E0` / `#525252` (cards/dividers)"
- Focus: "2px brand bottom active-indicator on fields; brand focus ring on buttons"
- Status: "Success `#107C10`, Danger `#D13438`, Warning `#F7630C` — small signals only"

### Example Component Prompts
- "Create a Fluent 2 primary button: brand `#0F6CBD` background, white text, 4px radius, 32px tall, 0 12px padding, 96px min-width, Segoe UI 14px/600. Hover `#115EA3`, pressed `#0C3B5E`. Dark theme uses `#115EA3` background."
- "Build a Fluent 2 text field: Surface 1 background, 1px Stroke 1 border, 4px top radius, 32px tall, Segoe UI 14px. On focus, animate a 2px brand `#0F6CBD` bottom active-indicator. Placeholder in Foreground 4."
- "Design a content card: opaque Surface 1 (`#FFFFFF` light / `#1F1F1F` dark), 8px radius, Fluent shadow4 on the tinted canvas, 16px padding. Title in Title3 (24/600) Foreground 1, body in Body1 (14/400) Foreground 2."
- "Create a list container: Surface 1, 8px radius, `overflow:hidden`, rows divided by 1px Stroke 3, header row on Surface 3 in Body1Strong (14/600). Row hover = subtle hover layer; selected row = brand wash `#EBF3FC` with a 2px brand left bar."
- "Build the top tab nav: Surface 1 bar with a 1px Stroke 2 bottom border, brand mark at left, tabs in 14px Foreground 2. The selected tab is Foreground 1/600 with a 2px brand `#0F6CBD` rounded underline indicator."
- "Design a right-side detail drawer: Surface 1, ~592px wide desktop / full-screen mobile, shadow64, no edge radius. Header is Title3 with a row of status badges; labels in Foreground 3, values in Foreground 1."

### Iteration Guide
When refining screens built with this system:
1. Focus on ONE component at a time.
2. Reference Fluent role names AND hex values from Section 2 (always give both light and dark).
3. Describe interaction by **state layer and brand signal** ("subtle hover fill", "2px brand focus indicator"), not by recoloring.
4. Default the page canvas to the tint (`#F5F5F7` / `#141414`), content to Surface 1 — this single move establishes the Fluent layered feel.
5. Reach for two radii: **4px (controls)** or **8px (containers)**. Never pill rectangles.
6. Keep color semantic — if a color isn't marking action, selection, focus, link, or status, it shouldn't be there.

### Token Provenance & Known Gaps
- Values trace to the Fluent 2 web design tokens (`@fluentui/tokens`: `webLightTheme` / `webDarkTheme`). Friendly names map to alias tokens (e.g. "Surface 1" = `colorNeutralBackground1`, "Brand" = `colorBrandBackground`).
- **App tuning vs. portal default:** the tinted canvas (`#F5F5F7`), 8px card radius, and default card shadow are deliberate "depth" choices. Fluent's literal portal default is a white/`#FAFAFA` canvas with 4px cards and lighter elevation — drop the tint and use 4px if exact portal parity is ever required.
- **Segoe UI licensing:** Segoe ships with Windows; on macOS/Linux the fallback stack renders the nearest system sans. Visual parity is closest on Windows.
- **Dark brand background** is `#115EA3` (Fluent shifts the brand background down one ramp step in dark for contrast), while brand **foreground/links** shift up to `#479EF5`.
- This document defines the design language only. Implementing it in the app (Tailwind tokens, component refactor) is a separate, not-yet-scheduled effort.
