---
description: "Dark theme design system - centralized colors, spacing, typography"
inclusion: auto
fileMatchPattern: "**/*.tsx"
---

# Design System

## Philosophy
Clean, fast, readable. Minimal shadows, tight spacing. Every pixel serves purpose.

## Colors (src/app/globals.css)

### Backgrounds
- `bg-background` (zinc-950) - Main
- `bg-card` (zinc-900) - Cards
- `bg-zinc-800` - Secondary
- `bg-zinc-950` - Inputs

### Text
- `text-zinc-100` - Primary
- `text-zinc-400` - Labels
- `text-zinc-500` - Placeholder
- `text-primary` - Cyan accent

### Status (Semantic)
- `text-success-foreground` / `bg-success/20` - Green
- `text-warning-foreground` / `bg-warning/20` - Orange
- `text-destructive` / `bg-destructive/10` - Red

## Typography (constants.ts)
- Sans: Inter (UI)
- Mono: JetBrains Mono (numbers only)
- NO uppercase labels
- NO tracking-wider

## Spacing (constants.ts)
- Cards: `p-4`
- Gaps: `gap-4`
- Inputs: `h-9`, `px-3 py-2`

## Rules

### ✅ DO
- Use semantic tokens (`bg-card`, `text-success-foreground`)
- Reference `constants.ts` for spacing
- Monospace ONLY for numbers

### ❌ NEVER
- Hardcode colors (`#18181b`, `text-green-400`, `bg-red-50`)
- Arbitrary values (`w-[350px]`)
- Shadows (except dropdowns)
- Uppercase labels

## Examples

```tsx
// ✅ CORRECT
<div className="bg-card p-4 border border-zinc-800">
<span className="text-success-foreground">Success</span>
<button className="text-destructive hover:bg-destructive/10">Delete</button>

// ❌ WRONG
<div className="bg-[#18181b] p-[17px]">
<span className="text-green-400">Success</span>
<button className="text-red-400 hover:bg-red-50">Delete</button>
```

## Change Design
Edit `src/app/globals.css` → entire app updates instantly.


