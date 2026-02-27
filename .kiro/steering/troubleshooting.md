---
description: "Common issues and solutions - quick fixes for frequent problems"
inclusion: manual
---

# Troubleshooting Guide

**Quick solutions for common issues**

## 🔍 Analytics Issues

### Issue: "Costs are too high / don't match"

**Symptoms:** Material costs seem inflated or incorrect

**Cause:** Including general expenses (commessa = 0) in cost calculations

**Solution:**
```typescript
// ✅ ALWAYS filter out general expenses
WHERE dw.dw_commeca > 0  // Exclude commessa = 0
```

**Check:**
```sql
-- See if general expenses are included
SELECT dw_commeca, SUM(dw_acqvalore) as cost
FROM dwarehe
WHERE an_tipo = 'F'
GROUP BY dw_commeca
ORDER BY dw_commeca
-- If you see commessa = 0 with large costs, that's the problem
```

---

### Issue: "Commessa search doesn't find by description"

**Symptoms:** Searching for order title/description returns no results

**Cause:** Filter applied before description table is joined (in CTE)

**Solution:**
```typescript
// In CTE WHERE clause - skip single term filter
buildCommessaFilterBUSINESS(filters?.commessa, conditions, params, true);
//                                                                  ^^^^ skipSingleTermFilter

// After CTE - add description search
const postCTEFilter = buildPostCTECommessaFilter(filters?.commessa, params);
const query = `
    WITH MyCTE AS (...)
    SELECT ... FROM MyCTE
    LEFT JOIN commess co ON ...
    ${postCTEFilter}  -- Searches both code AND description
`;
```

---

### Issue: "Margins are negative / wrong"

**Symptoms:** Profit margins don't make sense

**Causes:**
1. Costs filtered by date (should include ALL historical costs)
2. Work time not included in cost calculation
3. Wrong hourly rate

**Solution:**
```typescript
// ✅ Revenue CTE - filter by date
WHERE dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate

// ✅ Cost CTE - NO date filter
WHERE dw.dw_scenario = 1  // No date filter!

// ✅ Include work costs
const workCosts = await fetchWorkTimesForCommessas(commessaCodes);
const totalCost = materialCost + (workTime * HOURLY_RATE);
const margin = revenue - totalCost;
```

---

### Issue: "Horizontal scrolling in tables"

**Symptoms:** Table extends beyond viewport, requires horizontal scroll

**Cause:** No fixed column widths

**Solution:**
```tsx
// ✅ Fixed widths with truncation
<th className="w-32">Commessa</th>  {/* 8rem */}
<th className="w-48">Client</th>    {/* 12rem */}

<td className="w-32">
    <div className="truncate max-w-[8rem]" title={fullText}>
        {text}
    </div>
</td>
```

**Standard widths:**
- Date: `w-28` (7rem / ~112px)
- Commessa: `w-32` or `w-40` (8-10rem)
- Client: `w-48` (12rem)
- Machine/Operator: `w-32` (8rem)

---

### Issue: "Query is slow"

**Symptoms:** Report takes >5 seconds to load

**Causes:**
1. Missing NOLOCK hints
2. No pagination
3. Missing indexes
4. Joining too many tables

**Solution:**
```typescript
// ✅ Add NOLOCK hints
FROM dwarehe dw WITH (NOLOCK)
INNER JOIN anagra an WITH (NOLOCK) ON ...

// ✅ Use pagination
OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY

// ✅ Limit date range
WHERE dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate

// ✅ Use CTEs to break up complex queries
WITH Step1 AS (...), Step2 AS (...)
SELECT ... FROM Step1 JOIN Step2 ...
```

---

## 🎨 Design System Issues

### Issue: "Colors don't match design"

**Symptoms:** Using hardcoded colors like `text-green-400`

**Cause:** Not using semantic tokens

**Solution:**
```tsx
// ❌ WRONG
<span className="text-green-400">Success</span>
<div className="bg-[#18181b]">...</div>

// ✅ CORRECT
<span className="text-success-foreground">Success</span>
<div className="bg-card">...</div>
```

**Reference:** `.kiro/steering/design-system.md`

---

### Issue: "Spacing is inconsistent"

**Symptoms:** Using arbitrary values like `p-[17px]`

**Cause:** Not using design tokens

**Solution:**
```tsx
// ❌ WRONG
<div className="p-[17px] gap-[23px]">

// ✅ CORRECT
<div className="p-4 gap-4">  // From constants.ts
```

---

## 💾 Database Issues

### Issue: "Connection pool exhausted"

**Symptoms:** "No connections available" error

**Cause:** Not using centralized pool or not closing connections

**Solution:**
```typescript
// ✅ ALWAYS use centralized pool
import { queryMSSQL } from '@/lib/mssql';

// ❌ NEVER create manual connections
// const pool = new sql.ConnectionPool(config);  // DON'T DO THIS
```

---

### Issue: "Wrong database queried"

**Symptoms:** Query returns no data or wrong data

**Cause:** Using wrong database parameter

**Solution:**
```typescript
// Specify correct database
await queryMSSQL(query, params, 'NETPRO');   // Production data
await queryMSSQL(query, params, 'BUSINESS'); // Revenue/cost data
await queryMSSQL(query, params, 'QUOTES');   // Quote data
```

---

## 🧮 Pricing Issues

### Issue: "Magic numbers in formulas"

**Symptoms:** Hardcoded values like `const complexity = totalSigs - 1`

**Cause:** Not using constants

**Solution:**
```typescript
// ❌ WRONG
const complexity = totalSigs - 1;
const threshold = 305;

// ✅ CORRECT
import { PRICING_FORMULAS } from '@/config/constants';
const complexity = totalSigs - PRICING_FORMULAS.CFGS.COMPLEXITY_BASE;
const threshold = PRICING_FORMULAS.COVER.MANUAL_WIDTH_THRESHOLD;
```

**Reference:** `src/lib/pricing/formulas/QUICK_REFERENCE.md`

---

### Issue: "Formula changes don't take effect"

**Symptoms:** Changed constant but quote calculation unchanged

**Cause:** Need to restart dev server or clear cache

**Solution:**
```bash
# Stop dev server (Ctrl+C)
npm run dev  # Restart
```

---

## 🔧 Build Issues

### Issue: "Next.js 16 'use server' export error"

**Symptoms:** `Only async functions are allowed to be exported in a "use server" file`

**Cause:** Using `export { } from` syntax in server action file

**Solution:**
```typescript
// ❌ WRONG - Next.js 16 doesn't support this
'use server';
export { myAction } from './other-file';

// ✅ CORRECT - Import then re-export
'use server';
import { myAction as myActionImpl } from './other-file';
export const myAction = myActionImpl;
```

---

### Issue: "TypeScript errors after refactoring"

**Symptoms:** Import errors, type mismatches

**Cause:** Stale build cache

**Solution:**
```bash
# Delete build artifacts
rm -rf .next
rm tsconfig.tsbuildinfo

# Rebuild
npm run build
```

---

## 📱 UI Issues

### Issue: "Component not updating"

**Symptoms:** Data changes but UI doesn't reflect it

**Cause:** Missing dependency in useEffect

**Solution:**
```typescript
// ✅ Include all dependencies
useEffect(() => {
    fetchData();
}, [year, page, filters]);  // Add all variables used in fetchData
```

---

### Issue: "Form validation not working"

**Symptoms:** Invalid data submitted

**Cause:** Missing Zod schema or validation

**Solution:**
```typescript
// ✅ Use Zod validation
import { z } from 'zod';

const schema = z.object({
    quantity: z.number().min(1).max(100000),
    width: z.number().positive()
});

// In form
const result = schema.safeParse(formData);
if (!result.success) {
    // Handle errors
}
```

---

## 🚀 Performance Issues

### Issue: "Page loads slowly"

**Symptoms:** Initial page load >3 seconds

**Causes:**
1. Too much data fetched on mount
2. No loading states
3. Blocking queries

**Solution:**
```typescript
// ✅ Add loading states
const [loading, setLoading] = useState(false);

// ✅ Limit initial data
const [limit] = useState(100);  // Don't load everything

// ✅ Use pagination
const [page, setPage] = useState(1);

// ✅ Debounce search inputs
const debouncedSearch = useMemo(
    () => debounce((value) => setSearch(value), 300),
    []
);
```

---

## 📋 Quick Diagnostic Commands

```bash
# Check TypeScript errors
npm run lint

# Check build
npm run build

# Test database connection
# (Add test endpoint in db-test-actions.ts)

# Check environment variables
cat .env.local

# Clear cache and rebuild
rm -rf .next tsconfig.tsbuildinfo && npm run build
```

---

## 🆘 When All Else Fails

1. **Read the error message carefully** - It usually tells you exactly what's wrong
2. **Check recent changes** - What did you modify last?
3. **Compare with working code** - Look at similar existing functionality
4. **Check documentation** - `AI_RULES.md`, steering files, formula docs
5. **Use debug queries** - `src/app/analytics/queries/debug-queries.ts`
6. **Ask for help** - Provide error message, code snippet, what you tried

---

## 📚 Documentation Quick Links

- **Analytics:** `.kiro/steering/analytics-guide.md`
- **Database:** `.kiro/steering/database-schema.md`
- **Design:** `.kiro/steering/design-system.md`
- **Pricing:** `src/lib/pricing/formulas/QUICK_REFERENCE.md`
- **Structure:** `.kiro/steering/structure.md`
- **Rules:** `AI_RULES.md`
