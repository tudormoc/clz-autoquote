# Pricing Formulas Documentation

This folder contains all the mathematical formulas used to calculate quote prices in the AutoQuote Engine.

## 📁 File Structure

```
formulas/
├── README.md           ← You are here
├── index.ts            ← Exports all formulas
├── operations.ts       ← Core cost calculation formula (used by all operations)
├── internal.ts         ← CFGS (Cutting, Folding, Gathering, Sewing)
├── cover.ts            ← Cover production type logic
├── discount.ts         ← Volume discount calculations
└── surcharge.ts        ← Format surcharge calculations
```

## 🎯 Quick Edit Guide

### Want to change formula constants?
**→ Edit:** `src/config/constants.ts` → `PRICING_FORMULAS`

### Want to change discount tiers?
**→ Use:** Admin Dashboard → Discount Tiers Manager

### Want to change format surcharges?
**→ Use:** Admin Dashboard → Format Surcharges Manager

### Want to change pricing rules (setup costs, production rates)?
**→ Use:** Admin Dashboard → Pricing Configs Manager

### Want to add a new operation (e.g., lamination, paper)?
**→ Create:** New file in this folder (see "Adding New Operations" below)

---

## 📐 Core Formula (Used by All Operations)

**File:** `operations.ts`

```
Setup Cost = setup_base_cost + (setup_variable_factor × complexity)
Unit Rate = production_base_cost + (production_variable_factor × complexity)
Production Cost = Unit Rate × Quantity
Total Cost = Setup Cost + Production Cost
```

**Example (CFGS with 15 signatures, 1000 quantity):**
- Complexity = 14 (15 signatures - 1)
- Setup = 100 + (2 × 14) = €128
- Unit Rate = 0.006 (from signature types)
- Production = 0.006 × 1000 = €6
- **Total = €128 + €6 = €134**

---

## 🔧 Formula Details

### 1. CFGS (Cutting, Folding, Gathering, Sewing)
**File:** `internal.ts`

**Complexity Formula:**
```
Complexity = max(0, TotalSignatures - 1)
```

**Unit Rate Formula:**
```
Unit Rate = Σ(signature_amount × signature_type_unit_price)
```

**Example:**
- 5x 16pp signatures @ €0.50 = €2.50
- 10x 32pp signatures @ €0.35 = €3.50
- **Total Unit Rate = €6.00**

**Edit Constants:**
- `PRICING_FORMULAS.CFGS.COMPLEXITY_BASE` (default: 1)
- `PRICING_FORMULAS.CFGS.MIN_COMPLEXITY` (default: 0)

---

### 2. Cover Production Type
**File:** `cover.ts`

**Decision Tree:**
1. **MANUAL** (if width > 305mm OR height > 380mm)
2. **FAST** (if ALL conditions true):
   - Width: 100-295mm
   - Height: 120-380mm
   - No headbands
   - Quantity ≥ 1000
   - Square spine
3. **STANDARD** (default)

**Edit Constants:**
- `PRICING_FORMULAS.COVER.MANUAL_WIDTH_THRESHOLD` (default: 305)
- `PRICING_FORMULAS.COVER.MANUAL_HEIGHT_THRESHOLD` (default: 380)
- `PRICING_FORMULAS.COVER.FAST_MIN_WIDTH` (default: 99)
- `PRICING_FORMULAS.COVER.FAST_MAX_WIDTH` (default: 296)
- `PRICING_FORMULAS.COVER.FAST_MIN_HEIGHT` (default: 119)
- `PRICING_FORMULAS.COVER.FAST_MAX_HEIGHT` (default: 381)
- `PRICING_FORMULAS.COVER.FAST_MIN_QUANTITY` (default: 1000)

---

### 3. Volume Discounts
**File:** `discount.ts`

**Formula:**
```
Discount Factor = 1 - discount_percentage
Discounted Price = Original Price × Factor
```

**Example:**
- Original: €100
- Discount: 15%
- Factor: 1 - 0.15 = 0.85
- **Final: €100 × 0.85 = €85**

**Order of Operations:**
1. Calculate base price
2. Apply surcharge (if any)
3. Apply discount (if any)

---

### 4. Format Surcharges
**File:** `surcharge.ts`

**Formula:**
```
Surcharge Factor = 1 + surcharge_percentage
Surcharged Price = Original Price × Factor
Applied Surcharge = max(widthSurcharge, heightSurcharge)
```

**Example:**
- Original: €100
- Width: 450mm → 20% surcharge
- Height: 300mm → 10% surcharge
- Applied: 20% (use higher)
- Factor: 1 + 0.20 = 1.20
- **Final: €100 × 1.20 = €120**

---

## ➕ Adding New Operations

Want to add a new pricing operation (e.g., lamination, paper, binding)?

### Step 1: Create Formula File
Create `src/lib/pricing/formulas/your-operation.ts`:

```typescript
import { QuoteInput } from '../types';

// ============================================================================
// YOUR OPERATION FORMULAS
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// Describe your formula here
//
// ============================================================================

/**
 * Calculate complexity for your operation
 */
export function calculateYourOperationComplexity(input: QuoteInput): number {
    // Your logic here
    return 1; // Example: fixed complexity
}
```

### Step 2: Export from Index
Add to `src/lib/pricing/formulas/index.ts`:

```typescript
export * from './your-operation';
```

### Step 3: Use in Engine
Add to `src/lib/pricing/engine.ts`:

```typescript
import { calculateYourOperationComplexity } from './formulas';

// In calculateDetailedQuote function:
const yourOpRule = getRule('your_operation_slug');
if (yourOpRule) {
    const complexity = calculateYourOperationComplexity(input);
    const cost = calculateOperationCost(yourOpRule, input.quantity, complexity);
    
    applySurchargeToItem(cost, surchargeFactor, surchargePercentage);
    applyDiscountToItem(cost, discountFactor, discountLabel);
    
    items.push(cost.item);
    setupTotal += cost.setup;
    productionTotal += cost.production;
}
```

### Step 4: Add Database Rule
Use Admin Dashboard → Pricing Configs Manager to add your operation's pricing rule.

---

## 🧪 Testing Your Changes

After editing formulas:

1. **Check TypeScript:** `npm run lint`
2. **Test in UI:** Start dev server and create a quote
3. **Verify Calculations:** Check the live breakdown display
4. **Test Edge Cases:** Try extreme values (very large/small quantities, dimensions)

---

## 📊 Formula Execution Order

The pricing engine executes formulas in this order:

1. **Load Data** (rules, tiers, surcharges from database)
2. **Calculate Surcharge** (based on format dimensions)
3. **Calculate Discount** (based on quantity)
4. **For Each Operation:**
   - Calculate complexity
   - Calculate base cost
   - Apply surcharge
   - Apply discount
   - Add to totals
5. **Return Final Quote**

---

## 💡 Best Practices

### ✅ DO:
- Add clear comments explaining formulas
- Use constants from `src/config/constants.ts`
- Include examples in JSDoc comments
- Keep functions small and focused
- Test with real-world data

### ❌ DON'T:
- Hardcode magic numbers in formulas
- Create complex nested logic
- Modify database values in formulas
- Skip documentation
- Guess at requirements (ask first!)

---

## 🆘 Need Help?

- **Formula not working?** Check the live breakdown display for error messages
- **Want to change a constant?** Edit `src/config/constants.ts`
- **Need to add a new operation?** Follow the "Adding New Operations" guide above
- **Database values wrong?** Use the Admin Dashboard to update them

---

**Last Updated:** 2026-02-09
**Maintained By:** AutoQuote Engine Team
