# Jusic Unified Design System — M3 Expressive (2026)

Single source of truth for **Jusic Artist CRM (ARTIST)**, **Jusic Elite Pro / SERVICE**, and future consumer surfaces.

## Platforms

| Codebase | Stack | Entry styles | Primary shell |
|----------|-------|--------------|---------------|
| `ARTIST` | Vite + React 19 + Tailwind v4 | `src/index.css` + `@import tokens` | `ArtistsWorkspaceHeader` |
| `SERVICE` | Next.js 14 + Tailwind v3 | `src/app/globals.css` + tokens | `CrmWorkspaceHeader` |
| Consumer app | TBD | Import `tokens/jusic-m3-tokens.css` | — |

**Sync rule:** Edit tokens in `jusic-design-system/tokens/`, then copy to each repo’s `src/design-system/tokens/` (or run `npm run design:sync` when scripted).

---

## 1. Design language (M3 Expressive)

### Principles

- **Token-first** — No magic numbers in components; use `--jm3-*` CSS variables.
- **Motion physics** — Transitions use emphasized easing; interactive groups use spring layout (Framer `layoutId`).
- **Expressive density** — High information density for operators; 36–44px list rows, 40–48px toolbars.
- **RTL-native** — `dir="rtl"` on root; logical properties (`ms-`, `me-`, `inset-inline`).
- **Reduced motion** — All animations respect `prefers-reduced-motion: reduce`.

### Aesthetic (Antigravity-inspired)

- Soft mesh gradients on canvas (`--jm3-gradient-canvas`)
- Glass surfaces: `backdrop-filter` + `--jm3-glass-edge`
- Primary glow on focus/active (`--jm3-glow-primary`)
- AI accent lane: violet/indigo secondary (`--jm3-color-tertiary`)

---

## 2. Token categories

### Color roles (Material 3)

| Token | Role |
|-------|------|
| `--jm3-color-primary` | Primary actions, active nav |
| `--jm3-color-on-primary` | Text on primary |
| `--jm3-color-surface` | Page background |
| `--jm3-color-surface-container` | Cards, panels |
| `--jm3-color-surface-container-high` | Elevated glass |
| `--jm3-color-on-surface` | Primary text |
| `--jm3-color-on-surface-variant` | Secondary text |
| `--jm3-color-outline` | Borders |
| `--jm3-color-error` / `warning` / `success` | Semantic |

### Typography

| Token | Use |
|-------|-----|
| `--jm3-font-family` | Heebo + system UI (Hebrew) |
| `--jm3-type-title-sm` … `label-xs` | Size + weight + line-height bundles |

### Shape (morphing)

| Token | Value | Use |
|-------|-------|-----|
| `--jm3-shape-none` | 0 | Sheets |
| `--jm3-shape-xs` | 8px | Chips |
| `--jm3-shape-sm` | 12px | Buttons |
| `--jm3-shape-md` | 16px | Cards |
| `--jm3-shape-lg` | 20px | Panels |
| `--jm3-shape-xl` | 28px | Modals |
| `--jm3-shape-full` | 9999px | Pills, FABs |
| `--jm3-shape-morph-duration` | 320ms | Border-radius transitions |

### Motion physics

| Token | Curve / value |
|-------|----------------|
| `--jm3-motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--jm3-motion-ease-emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--jm3-motion-ease-decelerate` | `cubic-bezier(0, 0, 0, 1)` |
| `--jm3-motion-duration-short` | 150ms |
| `--jm3-motion-duration-medium` | 280ms |
| `--jm3-motion-duration-long` | 420ms |
| `--jm3-spring-stiffness` | 380 (Framer) |
| `--jm3-spring-damping` | 32 |

### Elevation

`--jm3-elevation-0` … `--jm3-elevation-3` — layered shadows + glass edge.

---

## 3. Core components (roadmap)

| Priority | Component | Status |
|----------|-----------|--------|
| P0 | `M3ExpressiveToolbar` | ✅ Implemented |
| P0 | Token CSS + Tailwind preset | ✅ Implemented |
| P1 | `M3SegmentedButtonGroup` | Included in toolbar |
| P1 | `M3WaveformProgress` | Included in toolbar |
| P2 | `M3BottomSheet` | Planned |
| P2 | `M3AdaptiveNavigationRail` | Planned (SERVICE shell) |
| P3 | `M3SplitButton` | Included in toolbar |

---

## 4. Performance rules

1. **Prefer CSS** over JS for hover/focus/active.
2. **Framer Motion** only for layout morph + sheet drag — not list rows.
3. **Virtualize** lists > 30 rows (`@tanstack/react-virtual`).
4. **Skeleton loaders** match final layout dimensions (no layout shift).
5. **Memo** list row components with strict equality props.

---

## 5. Integration checklist

### SERVICE (Next.js)

```css
/* globals.css */
@import "../design-system/tokens/jusic-m3-tokens.css";
@import "../design-system/components/m3-expressive-toolbar.css";
```

```tsx
import { M3ExpressiveToolbar } from "@/design-system/react/M3ExpressiveToolbar";
```

### ARTIST (Vite)

```css
/* index.css */
@import "./design-system/tokens/jusic-m3-tokens.css";
@import "./design-system/components/m3-expressive-toolbar.css";
```

---

## 6. File map (canonical)

```
jusic-design-system/
  DESIGN.md                 ← this file
  tokens/
    jusic-m3-tokens.css
    motion.ts
    shape.ts
  react/
    M3ExpressiveToolbar.tsx
    m3-expressive-toolbar.css
    WaveformProgress.tsx
```

---

## 7. Changelog

- **2026-05-28** — Initial M3 Expressive token set + `M3ExpressiveToolbar` v1.
