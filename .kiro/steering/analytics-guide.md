---
description: "Analytics module guide - practical examples and patterns"
inclusion: manual
---

# Analytics Module Guide

**Quick reference for adding/modifying analytics reports**

## 🚨 Before You Start

1. **Read first:** `.kiro/steering/database-schema.md` (CRITICAL for queries)
2. **Understand structure:** `src/app/analytics/REFACTORING_SUMMARY.md`
3. **Check rules:** `AI_RULES.md` Section 7

## 📁 File Organization

```
queries/
├── shared/              ← Reusable utilities (USE THESE!)
│   ├── filter-builders.ts
│   ├── query-utils.ts
│   └── work-time-fetcher.ts
├── netpro-queries.ts    ← NETPRO-only reports (fast, simple)
├── business-queries.ts  ← BUSINESS+NETPRO (complex, cross-DB)
└── debug-queries.ts     ← Development utilities
```

## 🎯 Decision Tree: Where to Add Your Report?

```
Is it NETPRO-only (production data)?
├─ YES → Add to netpro-queries.ts
└─ NO → Does it need revenue/cost data?
    ├─ YES → Add to business-queries.ts
    └─ NO → Add to debug-queries.ts (if dev tool)
```

## 📊 Real Examples

### Example 1: Simple NETPRO Report (Machine Utilization)

**Goal:** Show machine usage by date

**File:** `queries/netpro-queries.ts`

```typescript
export async function getMachineUtilizationDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        machine?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        // 1. Setup pagination and dates
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);
        
        // 2. Build WHERE conditions
        const conditions: string[] = [
            "SIT.TIPO = 'WORK'",
            "SIT.DATA >= @startDate",
            "SIT.DATA <= @endDate"
        ];
        const params: Record<string, any> = { startDate, endDate, offset, limit };
        
        // 3. Apply filters using shared utilities
        buildMachineFilter(filters?.machine, conditions, params);
        
        const whereClause = conditions.join(' AND ');
        
        // 4. Build ORDER BY
        const orderBy = buildProductionOrderBy(sort?.column, sort?.direction);
        
        // 5. Query with NOLOCK
        const result = await queryMSSQL(`
            SELECT 
                SIT.DATA as work_date,
                SIT.MACCHINA as machine_code,
                MAC.DESCRIZIONE as machine_name,
                SUM(SIT.LAVORO) as total_hours,
                COUNT(DISTINCT SIT.OGGETTO) as operator_count
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
            WHERE ${whereClause}
            GROUP BY SIT.DATA, SIT.MACCHINA, MAC.DESCRIZIONE
            ORDER BY ${orderBy}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'NETPRO');
        
        // 6. Get total count
        const countResult = await queryMSSQL(`
            SELECT COUNT(*) as total
            FROM (
                SELECT SIT.DATA, SIT.MACCHINA
                FROM SITUAZIONI SIT WITH (NOLOCK)
                WHERE ${whereClause}
                GROUP BY SIT.DATA, SIT.MACCHINA
            ) sub
        `, params, 'NETPRO');
        
        return {
            success: true,
            data: result.recordset,
            pagination: buildPaginationResult(page, limit, countResult.recordset[0].total)
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

### Example 2: Complex Cross-Database Report (Client Profitability)

**Goal:** Show revenue, material cost, labor cost, and margin per client

**File:** `queries/business-queries.ts`

```typescript
export async function getClientProfitabilityDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        client?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);
        
        // 1. Build WHERE conditions for revenue CTE
        const revenueConditions: string[] = [
            "dw.dw_scenario = 1",
            "dw.codditt = 'COOPZANARDI'",
            "dw.dw_anno >= @year",
            "dw.dw_datmov >= @startDate",
            "dw.dw_datmov <= @endDate",
            "an.an_tipo = 'C'",  // Only clients
            "dw.dw_valfatt > 0",
            "dw.dw_commeca > 0"  // Exclude general expenses
        ];
        const params: Record<string, any> = { 
            year, 
            startDate, 
            endDate, 
            offset, 
            limit,
            codditt: 'COOPZANARDI'
        };
        
        buildClientFilter(filters?.client, revenueConditions, params);
        
        const revenueWhere = revenueConditions.join(' AND ');
        
        // 2. Build WHERE for cost CTE (NO date filter on costs!)
        const costConditions: string[] = [
            "dw.dw_scenario = 1",
            "dw.codditt = 'COOPZANARDI'",
            "an.an_tipo = 'F'",  // Only suppliers
            "dw.dw_acqvalore <> 0",
            "dw.dw_commeca > 0"  // CRITICAL: Exclude general expenses
        ];
        const costWhere = costConditions.join(' AND ');
        
        // 3. Query with CTEs
        const result = await queryMSSQL(`
            WITH ClientRevenue AS (
                SELECT 
                    an.an_conto as client_code,
                    an.an_descr1 as client_name,
                    SUM(dw.dw_valfatt) as total_revenue,
                    COUNT(DISTINCT dw.dw_commeca) as order_count
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${revenueWhere}
                GROUP BY an.an_conto, an.an_descr1
            ),
            ClientCosts AS (
                SELECT 
                    an.an_conto as client_code,
                    SUM(dw.dw_acqvalore) as total_material_cost
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${costWhere}
                GROUP BY an.an_conto
            )
            SELECT 
                cr.client_code,
                cr.client_name,
                cr.total_revenue,
                cr.order_count,
                ISNULL(cc.total_material_cost, 0) as material_cost
            FROM ClientRevenue cr
            LEFT JOIN ClientCosts cc ON cr.client_code = cc.client_code
            ORDER BY cr.total_revenue DESC
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'BUSINESS');
        
        // 4. Fetch work costs from NETPRO
        const clientCodes = result.recordset.map(row => row.client_code);
        const workCosts = await fetchWorkCostsForClients(
            clientCodes,
            year,
            startDate,
            endDate,
            APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE
        );
        
        // 5. Combine data and calculate margins
        const enrichedData = result.recordset.map(row => {
            const workCost = workCosts[row.client_code] || 0;
            const totalCost = row.material_cost + workCost;
            const margin = row.total_revenue - totalCost;
            const marginPercent = row.total_revenue > 0 
                ? (margin / row.total_revenue) * 100 
                : 0;
            
            return {
                ...row,
                work_cost: workCost,
                total_cost: totalCost,
                margin,
                margin_percent: marginPercent
            };
        });
        
        return {
            success: true,
            data: enrichedData,
            pagination: buildPaginationResult(page, limit, enrichedData.length)
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

## 🔧 Common Patterns

### Pattern 1: Commessa Search (Code + Description)

**NETPRO:**
```typescript
buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
// Searches: SUBSTRING(ORD.COMMESSA, 4, 4) and ORD.DESCRIZIONE
```

**BUSINESS (with post-CTE description search):**
```typescript
// In CTE WHERE clause
buildCommessaFilterBUSINESS(filters?.commessa, conditions, params, true);

// After CTE (for description search)
const postCTEFilter = buildPostCTECommessaFilter(filters?.commessa, params);
// Then: SELECT ... FROM CTE ${postCTEFilter}
```

### Pattern 2: Multiple Filters

```typescript
// Build all filters
buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
buildMachineFilter(filters?.machine, conditions, params);
buildOperatorFilter(filters?.operator, conditions, params);

// Combine
const whereClause = conditions.join(' AND ');
```

### Pattern 3: Cross-Database Work Time

```typescript
// 1. Get commessa codes from BUSINESS query
const commessaCodes = result.recordset.map(row => row.commessa_display);

// 2. Fetch work times from NETPRO
const workTimes = await fetchWorkTimesForCommessas(commessaCodes);

// 3. Enrich data
const enrichedData = result.recordset.map(row => ({
    ...row,
    work_time: workTimes[row.commessa_display] || 0,
    work_cost: (workTimes[row.commessa_display] || 0) * HOURLY_RATE
}));
```

## 🚨 Common Pitfalls

### ❌ WRONG: Filtering costs by date
```typescript
// WRONG - costs should include ALL historical data
WHERE dw.dw_datmov >= @startDate  // ❌ Don't do this for costs!
```

### ✅ CORRECT: Only filter revenue by date
```typescript
// Revenue CTE - filter by date
WHERE dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate

// Cost CTE - NO date filter
WHERE dw.dw_scenario = 1  // No date filter here!
```

### ❌ WRONG: Including general expenses
```typescript
// WRONG - includes general expenses (commessa = 0)
WHERE dw.dw_scenario = 1
```

### ✅ CORRECT: Exclude general expenses
```typescript
WHERE dw.dw_scenario = 1
  AND dw.dw_commeca > 0  // ✅ Exclude general expenses
```

### ❌ WRONG: Grouping by display code
```typescript
// WRONG - loses precision
GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
```

### ✅ CORRECT: Group by full commessa
```typescript
// CORRECT - group by full number, display 4-digit
GROUP BY dw.dw_commeca
SELECT RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display
```

## 📋 Checklist for New Reports

- [ ] Determined correct file (netpro-queries.ts vs business-queries.ts)
- [ ] Used shared utilities (NO duplicate filter logic)
- [ ] Added NOLOCK hints on all SELECT queries
- [ ] Proper CTE structure (separate revenue from costs)
- [ ] Filtered `dw_commeca > 0` to exclude general expenses
- [ ] Filtered `an_tipo = 'C'` for revenue, `an_tipo = 'F'` for costs
- [ ] NO date filter on cost queries
- [ ] Used `fetchWorkTimesForCommessas()` for labor costs
- [ ] Exported from `analytics-actions.ts`
- [ ] Added to `analyticsSections.ts`
- [ ] UI component has fixed column widths
- [ ] Tested: filters, sorting, pagination, export

## 🎨 UI Component Template

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getYourReportDataAction } from '@/app/analytics/analytics-actions';

export default function YourReport() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [year, setYear] = useState(2024);
    const [commessa, setCommessa] = useState('');
    
    // Pagination
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
    
    const fetchData = async () => {
        setLoading(true);
        const result = await getYourReportDataAction(year, page, 100, {
            commessa: commessa || undefined
        });
        if (result.success) {
            setData(result.data);
            setPagination(result.pagination);
        }
        setLoading(false);
    };
    
    useEffect(() => { fetchData(); }, [year, page, commessa]);
    
    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
                <Input
                    placeholder="Search commessa..."
                    value={commessa}
                    onChange={(e) => setCommessa(e.target.value)}
                    className="w-64"
                />
            </div>
            
            {/* Table with FIXED widths */}
            <table className="w-full">
                <thead>
                    <tr className="border-b border-zinc-800">
                        <th className="w-32 text-left">Commessa</th>
                        <th className="w-48 text-left">Client</th>
                        <th className="text-right">Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-800/50">
                            <td className="w-32">
                                <div className="truncate max-w-[8rem]" title={row.commessa}>
                                    {row.commessa}
                                </div>
                            </td>
                            <td className="w-48">
                                <div className="truncate max-w-[12rem]" title={row.client_name}>
                                    {row.client_name}
                                </div>
                            </td>
                            <td className="text-right font-mono">
                                €{row.revenue.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {/* Pagination */}
            <div className="flex justify-between">
                <Button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    Previous
                </Button>
                <span>Page {page} of {pagination.totalPages}</span>
                <Button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>
                    Next
                </Button>
            </div>
        </div>
    );
}
```

## 💡 Pro Tips

1. **Start simple:** Copy an existing report, modify incrementally
2. **Test filters:** Try single term, multiple terms, empty
3. **Check performance:** Use NOLOCK, limit results, add indexes if slow
4. **Debug queries:** Use `debug-queries.ts` functions to inspect data
5. **Verify costs:** Material costs should NOT be filtered by date
6. **Check margins:** Revenue - Material - Labor should make sense

## 📚 Further Reading

- `database-schema.md` - Complete database reference
- `REFACTORING_SUMMARY.md` - File structure and organization
- `AI_RULES.md` Section 7 - Complete analytics architecture
