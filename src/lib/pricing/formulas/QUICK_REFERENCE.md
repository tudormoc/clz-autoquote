# Formula Quick Reference

## 🎯 Where to Edit

| Change | Location |
|--------|----------|
| Formula constants | `src/config/constants.ts` → `PRICING_FORMULAS` |
| Discount tiers | Admin Dashboard |
| Format surcharges | Admin Dashboard |
| Pricing rules | Admin Dashboard |
| Formula logic | `src/lib/pricing/formulas/[file].ts` |

## 📐 All Formulas

**Core (All Operations)**
```
Setup = base + (variable × complexity)
Production = (base + (variable × complexity)) × quantity
Total = Setup + Production
```

**CFGS**
```
Complexity = max(0, TotalSignatures - 1)
Unit Rate = Σ(signature_amount × signature_type_unit_price)
```
Edit: `PRICING_FORMULAS.CFGS.*`

**Cover Type**
```
IF width > 305 OR height > 380 → MANUAL
ELSE IF (100 < width < 296) AND (120 < height < 381) 
     AND no_headbands AND qty ≥ 1000 AND square_spine → FAST
ELSE → STANDARD
```
Edit: `PRICING_FORMULAS.COVER.*`

**Discount**
```
Factor = 1 - discount_percentage
Final = Original × Factor
```

**Surcharge**
```
Factor = 1 + surcharge_percentage
Final = Original × Factor
Applied = max(widthSurcharge, heightSurcharge)
```

## 🔧 Quick Edits

**Change CFGS complexity:**
```typescript
// src/config/constants.ts
CFGS: { COMPLEXITY_BASE: 1 }  // ← Change this
```

**Change cover thresholds:**
```typescript
// src/config/constants.ts
COVER: { MANUAL_WIDTH_THRESHOLD: 305 }  // ← Change this
```

## ➕ Add New Operation

1. `cp TEMPLATE.ts your-operation.ts`
2. Add constants to `constants.ts`
3. Implement with header + JSDoc + examples
4. Export from `index.ts`
5. Integrate in `engine.ts`
6. Add DB rule via Admin
7. Test: `npm run lint` + UI

## ✅ Checklist

- [ ] No magic numbers
- [ ] Header block + JSDoc + examples
- [ ] Constants in `constants.ts`
- [ ] Lint passes
- [ ] Tested in UI
