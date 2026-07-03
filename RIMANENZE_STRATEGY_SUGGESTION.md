# Rimanenze (Inventory/Stock) Dashboard - Strategy Suggestion

## 📊 Current Data Analysis

After inspecting all existing dashboards, here's what data you have available:

### BUSINESS Database (dwarehe table)
- **Revenue data**: `dw_valfatt` (invoiced value), `dw_valore` (delivered value)
- **Material costs**: `dw_acqvalore` (from suppliers, an_tipo='F')
- **Client/Supplier info**: `anagra` table with `an_tipo` ('C'=Client, 'F'=Supplier)
- **Order tracking**: `dw_commeca` (order number), `dw_datmov` (movement date)
- **Quantities**: `dw_collifatt` (invoiced quantity)

### NETPRO Database
- **Work time**: `SITUAZIONI` table with `LAVORO` (work hours)
- **Order info**: `ORDINI` table with `COMMESSA`, `QTA_COMPLETATA`
- **Production tracking**: Machine, operator, task data

## 💡 Recommended Rimanenze Calculation Strategy

### **Option 1: Work-In-Progress (WIP) Orders - RECOMMENDED**

**Concept**: Orders with production activity and material costs but NO revenue yet = Rimanenze

**Logic**:
```
Rimanenze = Orders WHERE:
  - Has work time (NETPRO.SITUAZIONI) > 0
  - Has material costs (dw_acqvalore from suppliers) > 0
  - Has NO revenue (dw_valfatt = 0 AND dw_valore = 0)
  - OR has partial revenue (some invoicing but production continues)
```

**Why this works**:
- ✅ Identifies orders with invested costs (labor + materials)
- ✅ Shows orders not yet sold/invoiced
- ✅ Represents actual inventory value (work in progress)
- ✅ Uses existing data from both databases

**Dashboard would show**:
- Commessa (order number)
- Order description
- Material costs invested
- Work hours invested
- Labor costs invested
- Total invested value (materials + labor)
- Days since last activity
- Client (if assigned)

---

### **Option 2: Completed But Unsold Orders**

**Concept**: Orders marked as completed in production but not invoiced

**Logic**:
```
Rimanenze = Orders WHERE:
  - QTA_COMPLETATA > 0 (production completed)
  - dw_valfatt = 0 (not invoiced)
  - Last production date < 30 days ago (recent)
```

**Why this works**:
- ✅ Shows finished goods waiting for delivery/invoicing
- ✅ Clear definition of "completed"
- ✅ Easier to calculate

**Dashboard would show**:
- Commessa
- Quantity completed
- Completion date
- Days waiting for invoice
- Total invested costs

---

### **Option 3: Material Inventory Without Revenue**

**Concept**: Track materials purchased but not yet invoiced to clients

**Logic**:
```
Rimanenze = Orders WHERE:
  - dw_acqvalore > 0 (materials purchased from suppliers)
  - dw_valfatt = 0 (not invoiced to clients)
  - dw_datmov within last 12 months (recent activity)
```

**Why this works**:
- ✅ Simplest calculation (single database)
- ✅ Focuses on material inventory
- ✅ Easy to understand

**Dashboard would show**:
- Commessa
- Material costs
- Purchase date
- Days in inventory
- Supplier breakdown

---

## 🎯 My Recommendation: **Hybrid Approach (Option 1 + 2)**

### **Best Solution: "Active Rimanenze" Dashboard**

Combine work-in-progress AND completed orders:

```sql
WITH WorkInProgress AS (
    -- Orders with work time but no/partial revenue
    SELECT 
        commessa_display,
        material_cost,
        work_hours,
        labor_cost,
        'WIP' as status
    FROM orders
    WHERE work_hours > 0 
      AND (revenue = 0 OR revenue < expected_revenue)
),
CompletedUnsold AS (
    -- Orders completed but not invoiced
    SELECT 
        commessa_display,
        material_cost,
        work_hours,
        labor_cost,
        'COMPLETED' as status
    FROM orders
    WHERE qty_completed > 0 
      AND revenue = 0
)
SELECT * FROM WorkInProgress
UNION ALL
SELECT * FROM CompletedUnsold
```

### **Dashboard Features**:

1. **Summary Cards**:
   - Total Rimanenze Value (materials + labor)
   - WIP Orders Count
   - Completed Unsold Orders Count
   - Average Days in Inventory

2. **Filters**:
   - Date range (last activity date)
   - Status (WIP / Completed / All)
   - Client (if assigned)
   - Minimum value threshold

3. **Table Columns**:
   - Commessa (4-digit display)
   - Order Description
   - Status (WIP / Completed)
   - Material Cost
   - Work Hours
   - Labor Cost
   - Total Invested Value
   - Last Activity Date
   - Days in Inventory
   - Client (if assigned)

4. **Sorting**:
   - By total value (highest first)
   - By days in inventory (oldest first)
   - By last activity date

---

## 📋 Implementation Steps

### 1. **Query Structure** (in `rimanenze-queries.ts`):

```typescript
// Main CTE approach
WITH MaterialCosts AS (
    -- Get material costs from suppliers
    SELECT 
        RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
        SUM(dw.dw_acqvalore) as material_cost
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
    WHERE an.an_tipo = 'F'  -- Suppliers only
      AND dw.dw_acqvalore <> 0
      AND dw.dw_commeca > 0
    GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
),
Revenue AS (
    -- Get revenue (to identify unsold orders)
    SELECT 
        RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
        SUM(dw.dw_valfatt) as total_revenue
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
    WHERE an.an_tipo = 'C'  -- Clients only
      AND dw.dw_commeca > 0
    GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
)
SELECT 
    mc.commessa_display,
    mc.material_cost,
    ISNULL(r.total_revenue, 0) as revenue,
    -- Add work time from NETPRO via work-time-fetcher
    -- Add status logic
FROM MaterialCosts mc
LEFT JOIN Revenue r ON mc.commessa_display = r.commessa_display
WHERE ISNULL(r.total_revenue, 0) = 0  -- No revenue = rimanenze
   OR r.total_revenue < (mc.material_cost * 1.5)  -- Partial revenue
```

### 2. **Use Existing Utilities**:
- `fetchWorkTimesForCommessas()` from `work-time-fetcher.ts`
- `buildCommessaFilterBUSINESS()` from `filter-builders.ts`
- `APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE` for labor cost calculation

### 3. **Summary Statistics**:
```typescript
export async function getRimanenzeStatsAction() {
    return {
        total_value: sum(material_cost + labor_cost),
        wip_count: count where status = 'WIP',
        completed_count: count where status = 'COMPLETED',
        avg_days: average(days_in_inventory)
    };
}
```

---

## 🔍 Key Insights This Provides

1. **Financial**: How much capital is tied up in unsold inventory
2. **Operational**: Which orders are stuck in production
3. **Planning**: Identify orders needing attention
4. **Cash Flow**: Predict when inventory will convert to revenue

---

## ⚠️ Important Considerations

1. **Date Filtering**: 
   - Use `dw_datmov` for material purchase dates
   - Use last work date from NETPRO for activity tracking
   - Consider only recent activity (last 6-12 months)

2. **Exclude General Expenses**:
   - Always filter `dw_commeca > 0` (exclude commessa = 0)

3. **Partial Revenue Handling**:
   - Some orders may have partial invoicing
   - Consider threshold: if revenue < 80% of costs, still count as rimanenze

4. **Performance**:
   - Use CTEs for complex joins
   - Fetch work times in batch (like OrderRevenueReport does)
   - Add pagination (100 rows per page)

---

## 📊 Expected Output Example

| Commessa | Description | Status | Material | Hours | Labor | Total Value | Days | Client |
|----------|-------------|--------|----------|-------|-------|-------------|------|--------|
| 8923 | Book Project A | WIP | €2,500 | 45.5 | €1,365 | €3,865 | 12 | Client X |
| 7621 | Magazine B | COMPLETED | €1,200 | 28.0 | €840 | €2,040 | 5 | - |
| 9104 | Catalog C | WIP | €3,800 | 67.2 | €2,016 | €5,816 | 23 | Client Y |

**Summary**: Total Rimanenze Value: €11,721 | WIP: 2 | Completed: 1

---

## 🚀 Next Steps

1. **Confirm the approach**: Which option (1, 2, 3, or hybrid) fits your business needs?
2. **Define thresholds**: 
   - How many days before an order is considered "old inventory"?
   - What revenue % indicates "partial" vs "complete"?
3. **Implement the query** with your confirmed logic
4. **Test with real data** to validate calculations
5. **Add business rules** (e.g., exclude certain order types)

---

## 💬 Questions to Answer

1. Do you want to track **all unsold orders** or only **recent** ones?
2. Should **partially invoiced orders** be included?
3. Do you need to see **supplier breakdown** for materials?
4. Should the dashboard show **aging buckets** (0-30 days, 31-60 days, etc.)?
5. Do you want **alerts** for orders stuck too long?

Let me know which approach you prefer, and I'll implement the exact query logic!
