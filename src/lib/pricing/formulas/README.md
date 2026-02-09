# Pricing Formulas

All mathematical formulas for quote calculations.

## 📁 Files

- `operations.ts` - Core cost formula (used by all)
- `internal.ts` - CFGS (Cutting, Folding, Gathering, Sewing)
- `cover.ts` - Cover production type logic
- `discount.ts` - Volume discounts
- `surcharge.ts` - Format surcharges
- `TEMPLATE.ts` - Copy this for new operations
- `QUICK_REFERENCE.md` - One-page cheat sheet

## 🎯 Quick Actions

**Change constants:** `src/config/constants.ts` → `PRICING_FORMULAS`  
**Change tiers/surcharges:** Admin Dashboard  
**Add operation:** Copy `TEMPLATE.ts` → Implement → Export → Integrate  
**Modify formula:** Try constants first, then logic

## 📐 Core Formula

```
Setup = base + (variable × complexity)
Production = (base + (variable × complexity)) × quantity
Total = Setup + Production
```

## 🔧 Formulas

### CFGS
```
Complexity = max(0, TotalSignatures - 1)
Unit Rate = Σ(signature_amount × signature_type_unit_price)
```
**Edit:** `PRICING_FORMULAS.CFGS.*`

### Cover Type
```
IF width > 305 OR height > 380 → MANUAL
ELSE IF (100 < width < 296) AND (120 < height < 381) 
     AND no_headbands AND qty ≥ 1000 AND square_spine → FAST
ELSE → STANDARD
```
**Edit:** `PRICING_FORMULAS.COVER.*`

### Discount
```
Factor = 1 - discount_percentage
Final = Original × Factor
```

### Surcharge
```
Factor = 1 + surcharge_percentage
Final = Original × Factor
Applied = max(widthSurcharge, heightSurcharge)
```

## ➕ Add New Operation

1. `cp TEMPLATE.ts your-operation.ts`
2. Add constants to `constants.ts`
3. Implement with header + JSDoc + examples
4. Export from `index.ts`
5. Integrate in `engine.ts`
6. Add DB rule via Admin
7. Test: `npm run lint` + UI

## 📊 Execution Order

1. Load data (rules, tiers, surcharges)
2. Calculate surcharge (format-based)
3. Calculate discount (volume-based)
4. For each operation:
   - Calculate complexity
   - Calculate base cost
   - Apply surcharge
   - Apply discount
   - Add to totals
5. Return final quote

## ✅ Standards

- NO magic numbers → Use `constants.ts`
- Header block required
- JSDoc + `@example` on all exports
- Naming: `calculate[Op][Aspect]`, `find[What]`, `apply[What]To[Target]`
- Files: 50-150 lines

## 🧪 Testing

```bash
npm run lint        # Must pass
npm run dev         # Test in UI
```

Check: Live breakdown, edge cases, multiple tiers

**See:** `QUICK_REFERENCE.md` for formulas | `CONTRIBUTING.md` for detailed guide
