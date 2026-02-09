---
inclusion: fileMatch
fileMatchPattern: 'src/lib/pricing/formulas/**'
---

# Formula Standards (Auto-Loaded)

## 🚨 Critical Rules

**1. NO MAGIC NUMBERS** → All in `src/config/constants.ts` → `PRICING_FORMULAS`
```typescript
// ❌ const complexity = totalSigs - 1;
// ✅ const complexity = totalSigs - PRICING_FORMULAS.CFGS.COMPLEXITY_BASE;
```

**2. HEADER BLOCK REQUIRED** → Copy from existing files or `TEMPLATE.ts`

**3. JSDOC + EXAMPLES** → Every exported function needs `@example` with real numbers

**4. NAMING** → `calculate[Op][Aspect]`, `find[What]`, `apply[What]To[Target]`

## 🔄 Quick Workflow

**New Operation:** Copy `TEMPLATE.ts` → Add constants → Implement → Export from `index.ts` → Integrate in `engine.ts` → Add DB rule

**Modify:** Try constants first → If logic change: update header + examples + inline comments

## 📐 Core Pattern
```
Setup = base + (variable × complexity)
Production = (base + (variable × complexity)) × quantity
Total = Setup + Production
```

## ✅ Before Commit
- [ ] No magic numbers
- [ ] Header block + JSDoc + examples
- [ ] Constants in `constants.ts`
- [ ] `npm run lint` passes
- [ ] Tested in UI

**See:** `QUICK_REFERENCE.md` for formulas | `TEMPLATE.ts` for structure
