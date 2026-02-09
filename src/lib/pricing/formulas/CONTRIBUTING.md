# Contributing to Pricing Formulas

**Quick guide for AI agents and developers**

## 🚨 Before You Start

**Read:** `QUICK_REFERENCE.md` (1 page) | `AI_RULES.md` Section 6

**Golden Rules:**
- ❌ NO magic numbers → Use `src/config/constants.ts`
- ✅ Copy `TEMPLATE.ts` for new operations
- ✅ Header block + JSDoc + examples required

## 📋 Standards Checklist

Every formula file needs:
- [ ] Visual header block (copy from existing files)
- [ ] Constants in `constants.ts` → `PRICING_FORMULAS`
- [ ] JSDoc with `@example` on all exports
- [ ] Naming: `calculate[Op][Aspect]`, `find[What]`, `apply[What]To[Target]`
- [ ] File is 50-150 lines

## 🔨 Adding New Operation

```bash
# 1. Copy template
cp TEMPLATE.ts lamination.ts

# 2. Add constants (if needed)
# Edit: src/config/constants.ts → PRICING_FORMULAS.LAMINATION

# 3. Implement with docs

# 4. Export
# Edit: index.ts → export * from './lamination';

# 5. Integrate
# Edit: engine.ts → follow existing patterns

# 6. Add DB rule via Admin Dashboard

# 7. Test
npm run lint  # Must pass
# Test in UI with real data
```

## 🔧 Modifying Existing

1. **Try constants first** → Edit `constants.ts` (preferred)
2. **If logic change:**
   - Update header block
   - Adjust JSDoc examples
   - Add inline comments
   - Test edge cases

## 📐 Common Patterns

**Complexity:**
```typescript
export function calculateComplexity(input: QuoteInput): number {
    return Math.max(
        PRICING_FORMULAS.OP.MIN_COMPLEXITY,
        value - PRICING_FORMULAS.OP.COMPLEXITY_BASE
    );
}
```

**Conditional:**
```typescript
export function determineType(input: QuoteInput): string {
    if (condition) return 'type_a';
    if (condition) return 'type_b';
    return 'default';
}
```

**Rate:**
```typescript
export function calculateRate(
    input: QuoteInput,
    types: Type[],
    fallback: number
): { rate: number; details: string } {
    if (!items.length) return { rate: fallback, details: 'Default' };
    
    let rate = 0;
    items.forEach(item => {
        rate += (item.amount * type.unit_price);
    });
    return { rate, details };
}
```

## ✅ Pre-Commit

- [ ] No magic numbers
- [ ] Header + JSDoc + examples
- [ ] Constants in `constants.ts`
- [ ] 50-150 lines
- [ ] Exported from `index.ts`
- [ ] Integrated in `engine.ts` (if new)
- [ ] DB rule added (if new)
- [ ] `npm run lint` passes
- [ ] Tested in UI

## 🚫 Common Mistakes

**❌ DON'T:**
```typescript
const complexity = totalSigs - 1;  // Magic number!
export function calc(input) { }    // Vague name!
```

**✅ DO:**
```typescript
const complexity = totalSigs - PRICING_FORMULAS.CFGS.COMPLEXITY_BASE;
export function calculateCFGSComplexity(input: QuoteInput): number { }
```

## 🆘 Questions?

- Formula logic unclear? → Ask before implementing
- Need pattern? → Check `internal.ts`, `cover.ts`
- Where to put constants? → `src/config/constants.ts`
- Integration? → Follow `engine.ts` patterns
