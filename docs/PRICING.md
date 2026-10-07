# Quote pricing

All quote maths lives in `src/lib/pricing/`: `engine.ts` runs the calculation, `formulas/` holds one file per operation,
`data.ts` loads the rules from the QUOTES database, `validation.ts` checks the form input.

## Where to change what

| Change | Where |
|---|---|
| A formula number (thresholds, complexity base …) | `src/config/constants.ts` → `PRICING_FORMULAS` |
| Operation prices, discount tiers, format surcharges, signature types | Settings page (`/settings`, stored in the QUOTES database) |
| A formula's logic | `src/lib/pricing/formulas/<operation>.ts` |

Try a constant first; change logic only when a number cannot express it.

## Formulas

```
Core (every operation)
  Setup      = base + (variable × complexity)
  Production = (base + (variable × complexity)) × quantity
  Total      = Setup + Production

CFGS (cutting, folding, gathering, sewing)                     formulas/internal.ts
  Complexity = max(0, total signatures − 1)
  Unit rate  = Σ(signature amount × signature type unit price)

Cover type                                                      formulas/cover.ts
  width > 305 or height > 380                                   → MANUAL
  100 < width < 296, 120 < height < 381, no headbands,
  quantity ≥ 1000, square spine                                 → FAST
  otherwise                                                     → STANDARD

Discount (by quantity)                                          formulas/discount.ts
  Final = Original × (1 − discount %)

Format surcharge                                                formulas/surcharge.ts
  Applied = max(width surcharge, height surcharge)
  Final   = Original × (1 + surcharge %)
```

Other files: `operations.ts` (core cost), `block.ts` (block thickness), `gluing.ts` (gluing rates).

Calculation order in `engine.ts`: load rules, tiers and surcharges → format surcharge → quantity discount → for each
operation: complexity, base cost, surcharge, discount, add to totals → quote.

## Add an operation

1. Copy `formulas/TEMPLATE.ts` to `formulas/<operation>.ts`.
2. Put its numbers in `PRICING_FORMULAS` (`src/config/constants.ts`).
3. Implement it with the header block and a JSDoc `@example` with real numbers on every export.
4. Export it from `formulas/index.ts` and call it from `engine.ts` like the existing operations.
5. Add its price rule on the Settings page.
6. `npm run check`, then try it on `/quotes` (live breakdown, edge cases, several discount tiers).

## Rules

- No magic numbers: every number comes from `PRICING_FORMULAS` or the database.
- Names: `calculate[Operation][Aspect]`, `find[What]`, `apply[What]To[Target]`.
- One operation per file, 50–150 lines.
