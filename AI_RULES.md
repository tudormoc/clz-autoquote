# AI CONSTITUTION & PROJECT PROTOCOLS

> **CRITICAL: READ BEFORE ACTING**
> This project demands PERFECTION, SCALABILITY, and MAINTAINABILITY. 
> There is ZERO TOLERANCE for messy code, quick fixes, or unauthorized changes.

## 📚 Quick Navigation

**New to the project?** Start here:
- `.kiro/steering/README.md` - Documentation index (find what you need)
- `.kiro/steering/structure.md` - Project organization
- `.kiro/steering/tech.md` - Technology stack

**Working on specific domains?**
- Analytics: `.kiro/steering/analytics-guide.md` + `database-schema.md`
- Pricing: `src/lib/pricing/formulas/QUICK_REFERENCE.md`
- UI: `.kiro/steering/design-system.md`

**Having issues?**
- `.kiro/steering/troubleshooting.md` - Common problems and solutions

## 0. RULES OF ENGAGEMENT (STRICT)
1.  **ASK FIRST:** NEVER modify a file without first proposing the specific change and receiving explicit user approval.
    *   *Workflow:* Analyze -> Propose Plan -> Wait for Approval -> Execute -> Verify.
2.  **NO ASSUMPTIONS:** If a requirement is vague, stop and ask. Do not guess.
3.  **CLEAN AS YOU GO:** Every change must leave the file cleaner and more organized than before.
4.  **READ DESIGN SYSTEM FIRST:** Before ANY UI work, read `.kiro/steering/design-system.md`
5.  **ZERO HARDCODED VALUES:** All colors, spacing, text from centralized sources. NO EXCEPTIONS.

## 1. DESIGN PHILOSOPHY
*   **Future-Proof:** Use standard, well-supported patterns. Avoid experimental hacks.
*   **Scalable:** Write code that handles 10 users or 10,000 users without refactoring.
*   **Maintainable:** Code must be self-explanatory. If it's complex, it's wrong. Simplify it.

## 2. FILE & FOLDER STRUCTURE
*   **Organization:** Keep the project folder pristine. Remove unused files immediately.
*   **Component Purity:** One component per file. Logic goes in plain TypeScript/JS files; UI goes in Components.
*   **Easy to Edit:** Structure files so a human can easily find and modify constants, strings, and logic.

## 3. TECHNICAL STANDARDS (THE GOLDEN RULES)
*   **Single Source of Truth:**
    *   **Text** → `src/locales/` (No hardcoded strings)
    *   **Config/Math** → `src/config/constants.ts` (No magic numbers)
    *   **Styles** → `src/app/globals.css` CSS variables (No hardcoded colors)
    *   **Spacing/Typography** → `src/config/constants.ts` DESIGN tokens
*   **Type Safety:** Strict TypeScript. No `any`. Zod validation for all data boundaries.
*   **DRY:** Isolate logic. If you copy-paste, you must refactor instead.
*   **Centralized Design:** ALL colors, spacing, typography from centralized tokens. ZERO hardcoded values.

## 4. UI STANDARDS (STRICT)

**Read first:** `.kiro/steering/design-system.md`

### Styling Rules - ZERO TOLERANCE
- ✅ Use semantic tokens: `bg-card`, `text-success-foreground`, `text-warning-foreground`
- ❌ NEVER hardcode: `#18181b`, `text-green-400`, `bg-red-50`, `w-[350px]`

### Add New Color
1. Add to `src/app/globals.css` as CSS variable
2. Add to `tailwind.config.js` colors
3. Use via semantic token

### Violations
| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| `text-green-400` | `text-success-foreground` |
| `text-orange-500` | `text-warning-foreground` |
| `text-red-600` | `text-destructive` |
| `bg-[#18181b]` | `bg-card` |
| `w-[350px]` | `w-full` or `max-w-sm` |

## 5. INFRASTRUCTURE & DATA PATTERNS
*   **Database Access:**
    *   **MANDATORY:** Always use `getMSSQLPool()` from `src/lib/mssql.ts`.
    *   **NEVER:** Create manual database connections or pools in individual files.
    *   **WHY:** We use a centralized, resilient connection pool that handles errors and reconnects automatically.
*   **Server Actions:**
    *   Keep server actions pure and separated in `src/app/*-actions.ts`.
    *   Always wrap DB calls in try/catch blocks with standard error return types.
*   **BUSINESS Database Schema (NTS Informatica):**
    *   **Global SQL Prefix Rule:** Every physical table has a strictly enforced 2 to 3-letter prefix, and *all columns* inside that table start with that exact prefix. Instead of searching blindly, find the root field name and apply the table's prefix.
    *   **Common Tables:**
        *   **Registry/Master Data:** `anagra` (Clients) ➔ `an_*` | `artico` (Items) ➔ `ar_*`
        *   **Orders/Commitments:** Table `movord` ➔ columns `mo_*` (e.g., `mo_matric`)
        *   **Invoices/DDTs:** Table `movmag` ➔ columns `mm_*` (e.g., `mm_matric`)
        *   **Quotes/Offers:** Table `movoff` ➔ columns `of_*`
    *   **UI Abstraction Exception:** The `ec_` prefix seen in the Business UI (e.g., `ec_matric`, `ec_codart`) is a UI-only abstraction for document lines. It does NOT exist in the database. Replace `ec_` with the physical target table's prefix (`mo_`, `mm_`, `of_`) when writing SQL queries.

## 6. PRICING MODULE ARCHITECTURE

### 6.1 Structure
- **All pricing logic:** `src/lib/pricing/`
- **Formulas:** `src/lib/pricing/formulas/` (one file per operation, 50-150 lines)
- **Data layer:** `src/lib/pricing/data.ts` (DB fetching)
- **Engine:** `src/lib/pricing/engine.ts` (orchestrates everything)

### 6.2 Formula Standards (MANDATORY)

**Before ANY formula work, read:** `src/lib/pricing/formulas/QUICK_REFERENCE.md`

**Every formula file MUST have:**
1. **Visual header block** (copy from existing files or `TEMPLATE.ts`)
2. **Constants in** `src/config/constants.ts` → `PRICING_FORMULAS` (NO magic numbers)
3. **JSDoc + `@example`** on all exported functions
4. **Naming:** `calculate[Op][Aspect]`, `find[What]`, `apply[What]To[Target]`

### 6.3 Adding New Operations

1. `cp formulas/TEMPLATE.ts formulas/your-operation.ts`
2. Add constants to `src/config/constants.ts` → `PRICING_FORMULAS`
3. Implement with full documentation
4. Export from `formulas/index.ts`
5. Integrate in `engine.ts` (follow existing patterns)
6. Add DB rule via Admin Dashboard
7. Test: `npm run lint` + UI

### 6.4 Modifying Formulas

1. **Try constants first** (preferred) → Edit `constants.ts`
2. **If logic change needed:**
   - Update header block
   - Adjust JSDoc examples
   - Add inline comments
   - Test edge cases

### 6.5 Quality Checklist

- [ ] No magic numbers (all in `constants.ts`)
- [ ] Header block + JSDoc + examples
- [ ] File is 50-150 lines
- [ ] `npm run lint` passes
- [ ] Tested in UI with real data


## 7. ANALYTICS MODULE ARCHITECTURE (MANDATORY)

**Before ANY analytics work, read:** `.kiro/steering/database-schema.md`

### 7.1 Structure (DO NOT CHANGE)
```
src/app/analytics/
├── analytics-actions.ts          (Main export - re-exports only)
├── queries/
│   ├── shared/
│   │   ├── filter-builders.ts    (Reusable filter logic)
│   │   ├── query-utils.ts        (Pagination, sorting, params)
│   │   └── work-time-fetcher.ts  (Cross-DB work time logic)
│   ├── netpro-queries.ts         (NETPRO-only reports)
│   ├── business-queries.ts       (BUSINESS + NETPRO reports)
│   └── debug-queries.ts          (Inspection utilities)
```

### 7.2 Adding New Analytics Reports

**Step 1: Determine Database**
- NETPRO only (production data) → Add to `queries/netpro-queries.ts`
- BUSINESS only (revenue/costs) → Add to `queries/business-queries.ts`
- Both databases → Add to `queries/business-queries.ts`

**Step 2: Use Shared Utilities (MANDATORY)**
```typescript
import {
    buildCommessaFilterNETPRO,      // For NETPRO commessa filtering
    buildCommessaFilterBUSINESS,    // For BUSINESS commessa filtering
    buildMachineFilter,             // For machine filtering
    buildOperatorFilter,            // For operator filtering
    buildClientFilter               // For client filtering
} from './shared/filter-builders';

import {
    calculateOffset,                // Pagination offset
    buildPaginationResult,          // Standard pagination response
    buildProductionOrderBy,         // ORDER BY for production queries
    setupDateParams                 // Standard date parameters
} from './shared/query-utils';

import {
    fetchWorkTimesForCommessas,     // Get work times for commessa list
    fetchWorkCostsForClients        // Get work costs by client
} from './shared/work-time-fetcher';
```

**Step 3: Follow Standard Pattern**
```typescript
export async function getYourReportDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        // Your filters here
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);
        
        // Build WHERE conditions
        const conditions: string[] = [/* base conditions */];
        const params: Record<string, any> = {/* base params */};
        
        // Apply filters using shared utilities
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
        
        const whereClause = conditions.join(' AND ');
        
        // Your SQL query with NOLOCK hints
        const result = await queryMSSQL(`
            SELECT ...
            FROM ... WITH (NOLOCK)
            WHERE ${whereClause}
            ORDER BY ...
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'NETPRO');
        
        return {
            success: true,
            data: result.recordset,
            pagination: buildPaginationResult(page, limit, total)
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            pagination: buildPaginationResult(page, limit, 0)
        };
    }
}
```

**Step 4: Export from Main File**
```typescript
// In analytics-actions.ts
export const getYourReportDataAction = getYourReportData;
```

**Step 5: Add to Config**
```typescript
// In src/config/analyticsSections.ts
export const ANALYTICS_SECTIONS: AnalyticsSectionConfig[] = [
    // ... existing sections
    {
        id: 'your-report',
        label: 'Your Report',
        icon: YourIcon,
        category: 'production', // or 'revenue', 'clients', etc.
        description: 'Brief description'
    }
];

export const REPORT_COMPONENTS: Record<string, React.ComponentType> = {
    // ... existing components
    'your-report': YourReportComponent,
};
```

### 7.3 Query Standards (STRICT)

**ALWAYS:**
- ✅ Use `WITH (NOLOCK)` on all SELECT queries
- ✅ Use shared filter builders (NO duplicate filter logic)
- ✅ Use shared pagination utilities
- ✅ Use CTEs to separate client revenue from supplier costs
- ✅ Filter `dw_commeca > 0` to exclude general expenses
- ✅ Filter `an_tipo = 'C'` for client revenue, `an_tipo = 'F'` for supplier costs
- ✅ Extract commessa codes: NETPRO uses `SUBSTRING(COMMESSA, 4, 4)`, BUSINESS uses `RIGHT(CAST(dw_commeca/100 AS VARCHAR), 4)`

**NEVER:**
- ❌ Create duplicate filter logic (use shared utilities)
- ❌ Hardcode pagination logic (use `calculateOffset` and `buildPaginationResult`)
- ❌ Filter costs by date (costs should include ALL historical data)
- ❌ Group by 4-digit display code (group by FULL commessa number)
- ❌ Forget NOLOCK hints (causes blocking in production)
- ❌ Include general expenses (dw_commeca = 0) in order costs

### 7.4 UI Component Standards

**Table Column Widths (MANDATORY):**
```typescript
// Fixed widths to prevent horizontal scrolling
<th className="w-28">Date</th>           // 7rem / ~112px
<th className="w-32">Commessa</th>       // 8rem / ~128px
<th className="w-40">Commessa</th>       // 10rem / ~160px (with description)
<th className="w-48">Client</th>         // 12rem / ~192px

// With truncation
<td className="w-40">
    <div className="truncate max-w-[10rem]" title={fullText}>
        {text}
    </div>
</td>
```

**Always include:**
- Filters (date range, commessa, client, etc.)
- Pagination (Previous/Next buttons)
- Sorting (click column headers)
- Export to Excel functionality
- Loading states
- Empty states
- Error handling

### 7.5 Cost Calculation Rules (CRITICAL)

**Material Costs:**
- Source: `dwarehe` table with `an_tipo = 'F'` (suppliers)
- Column: `dw_acqvalore` (NOT `dw_acqvalfatt`)
- Filter: `dw_commeca > 0` (exclude general expenses)
- Date: NO date filter (include ALL historical costs)

**Labor Costs:**
- Source: NETPRO `SITUAZIONI` table
- Calculation: `work_time × hourly_rate`
- Hourly rate: `APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE`
- Use `fetchWorkTimesForCommessas()` or `fetchWorkCostsForClients()`

**Revenue:**
- Source: `dwarehe` table with `an_tipo = 'C'` (clients)
- Column: `dw_valfatt`
- Date: Apply date filter (show only invoices in period)

**Margin:**
- Formula: `Revenue - Material Cost - Labor Cost`
- Percentage: `(Margin / Revenue) × 100`

### 7.6 Quality Checklist

- [ ] Uses shared utilities (no duplicate logic)
- [ ] Follows standard function signature
- [ ] Uses NOLOCK hints on all queries
- [ ] Proper error handling with try/catch
- [ ] Returns standard format: `{ success, data, pagination, error? }`
- [ ] Exported from `analytics-actions.ts`
- [ ] Added to `analyticsSections.ts`
- [ ] UI component has fixed column widths
- [ ] Tested with filters, sorting, pagination, export


## 8. DESIGN SYSTEM ENFORCEMENT

**Before ANY UI work:**
- [ ] Read `.kiro/steering/design-system.md`
- [ ] Check `src/app/globals.css` for tokens
- [ ] Check `src/config/constants.ts` for spacing

**Code Review:**
- [ ] No hardcoded colors (`#...`, `text-green-400`, `bg-red-50`)
- [ ] No arbitrary values (`w-[350px]`)
- [ ] Uses semantic tokens (`bg-card`, `text-success-foreground`)
- [ ] All text from `src/locales/en.ts`

**Change design:** Edit `src/app/globals.css` → entire app updates instantly.
