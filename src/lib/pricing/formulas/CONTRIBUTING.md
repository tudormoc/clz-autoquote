# Contributing to Pricing Formulas

**For AI Agents and Future Developers**

This guide ensures all formula contributions follow the same high-quality standards.

---

## 🚨 BEFORE YOU START

### Required Reading (In Order)
1. **`AI_RULES.md`** (project root) - Section 6: Pricing Module Architecture
2. **`README.md`** (this folder) - Complete formula documentation
3. **`QUICK_REFERENCE.md`** (this folder) - Formula cheat sheet
4. **`TEMPLATE.ts`** (this folder) - Standard template to copy

### Golden Rules
- ❌ **NEVER** hardcode magic numbers in formula files
- ❌ **NEVER** skip documentation (header blocks, JSDoc, examples)
- ❌ **NEVER** modify formulas without understanding the full calculation flow
- ✅ **ALWAYS** use constants from `src/config/constants.ts`
- ✅ **ALWAYS** follow the template structure exactly
- ✅ **ALWAYS** test with real data before committing

---

## 📋 Formula Standards Checklist

Every formula file MUST have:

### 1. Visual Header Block
```typescript
// ============================================================================
// OPERATION NAME FORMULAS
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// [Clear explanation]
// [Step-by-step breakdown]
// [Example with real numbers]
//
// EDIT CONSTANTS IN: [exact path]
// ============================================================================
```

### 2. Constants in Config File
```typescript
// src/config/constants.ts
export const PRICING_FORMULAS = {
    YOUR_OPERATION: {
        CONSTANT_NAME: value,  // ← Add your constants here
    },
} as const;
```

### 3. Detailed JSDoc Comments
```typescript
/**
 * Brief description
 * 
 * FORMULA: [math formula]
 * 
 * Detailed explanation
 * 
 * @param input - Description
 * @returns Description
 * 
 * @example
 * // Scenario description
 * functionName(input) → expected output
 * // Calculation: step by step
 */
```

### 4. Inline Comments
```typescript
// --- STEP 1: What this does ---
// Formula: x = a + b
const result = a + b;
```

### 5. Consistent Naming
- `calculate[Operation][Aspect]` - For calculations
- `find[What]` - For lookups
- `apply[What]To[Target]` - For modifications
- `get[What]Label` - For display strings

---

## 🔨 Adding a New Operation

### Step 1: Copy Template
```bash
cp src/lib/pricing/formulas/TEMPLATE.ts src/lib/pricing/formulas/lamination.ts
```

### Step 2: Add Constants (if needed)
```typescript
// src/config/constants.ts
export const PRICING_FORMULAS = {
    // ... existing constants ...
    
    LAMINATION: {
        COMPLEXITY_MULTIPLIER: 1.5,
        MIN_THICKNESS: 0.1,
        MAX_THICKNESS: 5.0,
    },
} as const;
```

### Step 3: Implement Formula
Replace template placeholders with your logic:
- Update header block with your formula
- Add real examples with numbers
- Implement calculation functions
- Reference constants from config

### Step 4: Export
```typescript
// src/lib/pricing/formulas/index.ts
export * from './cover';
export * from './internal';
export * from './discount';
export * from './surcharge';
export * from './operations';
export * from './lamination';  // ← Add your export
```

### Step 5: Integrate in Engine
```typescript
// src/lib/pricing/engine.ts
import {
    // ... existing imports ...
    calculateLaminationComplexity,  // ← Add your import
} from './formulas';

// In calculateDetailedQuote function:
const laminationRule = getRule('lamination');
if (laminationRule) {
    const complexity = calculateLaminationComplexity(input);
    const cost = calculateOperationCost(laminationRule, input.quantity, complexity);
    
    applySurchargeToItem(cost, surchargeFactor, surchargePercentage);
    applyDiscountToItem(cost, discountFactor, discountLabel);
    
    items.push(cost.item);
    setupTotal += cost.setup;
    productionTotal += cost.production;
}
```

### Step 6: Add Database Rule
1. Open Admin Dashboard
2. Go to "Pricing Configs Manager"
3. Create new rule:
   - Slug: `lamination`
   - Operation Name: `Lamination`
   - Setup Base Cost: (your value)
   - Setup Variable Factor: (your value)
   - Production Base Cost: (your value)
   - Production Variable Factor: (your value)

### Step 7: Test
```bash
# Check TypeScript
npm run lint

# Start dev server
npm run dev

# Test in UI:
# 1. Create a quote
# 2. Check live breakdown
# 3. Verify calculations
# 4. Test edge cases
```

---

## 🔧 Modifying Existing Formulas

### Option 1: Change Constants (Preferred)
```typescript
// src/config/constants.ts
CFGS: {
    COMPLEXITY_BASE: 2,  // ← Changed from 1
    MIN_COMPLEXITY: 0,
}
```
✅ Simple, safe, no code changes needed

### Option 2: Modify Formula Logic
If constants aren't enough:

1. **Understand Current Behavior**
   - Read header block
   - Review examples
   - Test current formula

2. **Update Header Block**
   - Adjust formula overview
   - Update example calculations
   - Change constant references

3. **Modify Code**
   - Keep structure intact
   - Update inline comments
   - Preserve JSDoc format

4. **Update Examples**
   - Adjust `@example` blocks
   - Show new calculation steps
   - Include edge cases

5. **Test Thoroughly**
   - Old behavior still works (if applicable)
   - New behavior is correct
   - Edge cases handled

---

## 📐 Formula Patterns

### Pattern 1: Complexity Calculation
```typescript
/**
 * Calculates complexity factor for [operation]
 * 
 * FORMULA: Complexity = max(MIN, value - BASE)
 */
export function calculateComplexity(input: QuoteInput): number {
    const value = /* extract from input */;
    return Math.max(
        PRICING_FORMULAS.OPERATION.MIN_COMPLEXITY,
        value - PRICING_FORMULAS.OPERATION.COMPLEXITY_BASE
    );
}
```

### Pattern 2: Conditional Logic
```typescript
/**
 * Determines [what] based on [criteria]
 * 
 * DECISION TREE:
 * 1. If [condition] → [result]
 * 2. Else if [condition] → [result]
 * 3. Else → [default]
 */
export function determineType(input: QuoteInput): string {
    if (/* condition */) {
        return 'type_a';
    }
    
    if (/* condition */) {
        return 'type_b';
    }
    
    return 'default';
}
```

### Pattern 3: Rate Calculation
```typescript
/**
 * Calculates unit rate for [operation]
 * 
 * FORMULA: Rate = Σ(amount × unit_price)
 */
export function calculateRate(
    input: QuoteInput,
    types: Type[],
    fallback: number
): { rate: number; details: string } {
    const items = input.items || [];
    
    if (items.length === 0) {
        return { rate: fallback, details: 'Default' };
    }
    
    let rate = 0;
    let details = '';
    
    items.forEach(item => {
        const type = types.find(t => t.id === item.type_id);
        if (type) {
            rate += (item.amount * type.unit_price);
            details += `${item.amount}x${type.name} `;
        }
    });
    
    return { rate, details: details.trim() };
}
```

---

## ✅ Pre-Commit Checklist

Before submitting ANY formula changes:

- [ ] Header block is complete and accurate
- [ ] All constants moved to `src/config/constants.ts`
- [ ] JSDoc comments on all exported functions
- [ ] At least one `@example` per function with real numbers
- [ ] Inline comments explain WHY, not just WHAT
- [ ] File is 50-150 lines (split if longer)
- [ ] Exported from `formulas/index.ts`
- [ ] Integrated in `engine.ts` (if new operation)
- [ ] Database rule created (if new operation)
- [ ] `npm run lint` passes with zero errors
- [ ] Tested in UI with multiple scenarios
- [ ] Edge cases tested (0, negative, very large values)
- [ ] Live breakdown display shows correct values
- [ ] README.md updated (if new patterns added)

---

## 🚫 Common Mistakes to Avoid

### ❌ DON'T: Hardcode Magic Numbers
```typescript
// BAD
const complexity = totalSigs - 1;
```

### ✅ DO: Use Constants
```typescript
// GOOD
const complexity = totalSigs - PRICING_FORMULAS.CFGS.COMPLEXITY_BASE;
```

---

### ❌ DON'T: Skip Documentation
```typescript
// BAD
export function calc(input: QuoteInput): number {
    return input.qty * 2;
}
```

### ✅ DO: Document Everything
```typescript
// GOOD
/**
 * Calculates doubled quantity for special pricing
 * 
 * FORMULA: Result = Quantity × 2
 * 
 * @param input - Quote input
 * @returns Doubled quantity
 * 
 * @example
 * calc({ qty: 100 }) → 200
 */
export function calculateDoubledQuantity(input: QuoteInput): number {
    // Formula: Result = Quantity × 2
    return input.quantity * 2;
}
```

---

### ❌ DON'T: Use Vague Names
```typescript
// BAD
export function process(input: QuoteInput): number {
    return calc(input);
}
```

### ✅ DO: Use Descriptive Names
```typescript
// GOOD
export function calculateLaminationComplexity(input: QuoteInput): number {
    return calculateComplexityFactor(input);
}
```

---

### ❌ DON'T: Mix Concerns
```typescript
// BAD - Calculation + database access + UI logic
export function calculatePrice(input: QuoteInput): number {
    const data = fetchFromDB();
    showToast('Calculating...');
    return data.price * input.qty;
}
```

### ✅ DO: Keep Functions Pure
```typescript
// GOOD - Pure calculation only
export function calculatePrice(
    input: QuoteInput,
    priceData: PriceData
): number {
    return priceData.basePrice * input.quantity;
}
```

---

## 🆘 Getting Help

### Questions to Ask
1. "What is the mathematical formula for this operation?"
2. "What are the edge cases I need to handle?"
3. "Are there existing patterns I should follow?"
4. "What constants should be configurable?"

### Resources
- **README.md** - Complete documentation
- **QUICK_REFERENCE.md** - One-page cheat sheet
- **TEMPLATE.ts** - Copy this for new operations
- **Existing formulas** - See `internal.ts`, `cover.ts` for examples
- **AI_RULES.md** - Project-wide standards

---

## 🎯 Success Criteria

Your formula contribution is ready when:

1. ✅ A non-technical person can understand the formula from the header block
2. ✅ Another developer can modify it 6 months from now without confusion
3. ✅ An AI agent can extend it following the same patterns
4. ✅ All tests pass and calculations are correct
5. ✅ The code is cleaner than before you touched it

---

**Remember:** We're building a system that will be maintained for years. Take the extra 10 minutes to document properly. Your future self (and others) will thank you.
