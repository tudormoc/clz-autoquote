---
description: "Dark theme design system - tokens, layout components, formatters"
inclusion: auto
fileMatchPattern: "**/*.tsx"
---

# Design System

## Philosophy
Clean, fast, readable. Minimal shadows, tight spacing. Every pixel serves purpose.

## Where things live

| What | File |
|------|------|
| Colours, font sizes, radius, shadows, layout sizes | `src/styles/theme.js` |
| Page frame (header + sidebar + content) | `src/components/layout/AppShell.tsx` |
| Page title block | `src/components/layout/PageHeader.tsx` |
| Section sidebars, header icons, home cards | `src/config/navigation.ts` |
| Buttons (also links styled as buttons) | `src/components/ui/Button.tsx` → `Button`, `buttonClasses()` |
| Empty / landing panels | `src/components/ui/EmptyState.tsx` |
| Numbers, money, hours, dates | `src/lib/format.ts` |

Restyle the whole app by editing `src/styles/theme.js` only.

## Colour tokens

### Surfaces (darkest → lightest)
- `bg-background` page, inputs
- `bg-card` panels, cards, sidebars
- `bg-muted` secondary buttons, chips, row hover
- `bg-muted-strong` hover on muted controls
- `bg-overlay/60` modal backdrop

### Lines
- `border-border` default borders, `divide-border`
- `border-border-strong` input borders, emphasised outlines

### Text (strongest → faintest)
- `text-fg-strong` titles, key figures
- `text-fg` default text
- `text-fg-soft` emphasised values
- `text-fg-secondary` secondary text
- `text-fg-muted` labels, icons
- `text-fg-subtle` hints, placeholders
- `text-fg-faint` disabled, decorative
- `text-fg-inverse` text on bright fills

### Status roles (full 50–950 scale, `DEFAULT` = 500)
- `primary` brand / interactive (cyan)
- `success` ok, positive amounts (emerald)
- `warning` attention, pending, manual edits (amber)
- `danger` errors, delete, negative amounts (red)
- `info` informational, selection (blue)
- `highlight` secondary category accent (purple)

Typical use: text `text-success-400`, tint `bg-danger/10`, border `border-warning-500/30`.

## Typography
- Sans: Inter (UI) · Mono: JetBrains Mono (numbers only)
- Small sizes: `text-2xs` (11px), `text-3xs` (10px), `text-4xs` (9px)
- NO uppercase labels, NO tracking-wider

## Layout
- Page column: `max-w-page`; full-height work area: `max-w-workspace`
- Sidebar: `w-sidebar` / `w-sidebar-collapsed`
- Cards `p-4`, gaps `gap-4`, inputs `h-9`

## New page recipe
```tsx
// Inside a section with a sidebar (its layout.tsx already renders AppShell + SectionSidebar):
export default function MyPage() {
    return (
        <>
            <PageHeader icon={Users} title={copy.title} subtitle={copy.subtitle} />
            <MyContent />
        </>
    );
}

// Standalone page:
export default function MyPage() {
    return (
        <AppShell>
            <PageHeader icon={Wallet} title={copy.title} actions={<Button>…</Button>} />
            <MyContent />
        </AppShell>
    );
}
```
Then add the link to `src/config/navigation.ts`.

## Rules
- ❌ Raw palette classes: `text-zinc-400`, `bg-emerald-500`, `text-white` (ESLint error)
- ❌ Arbitrary font sizes: `text-[10px]` (ESLint error)
- ❌ Hex colours in components: `#18181b`
- ✅ Monospace only for numbers · shadows only for dropdowns

```tsx
// ✅ CORRECT
<div className="bg-card p-4 border border-border">
<span className="text-success-400">{formatCurrency(total)}</span>
<button className="text-danger hover:bg-danger/10">Elimina</button>

// ❌ WRONG
<div className="bg-[#18181b] p-[17px]">
<span className="text-green-400">{value.toFixed(2)} €</span>
```
