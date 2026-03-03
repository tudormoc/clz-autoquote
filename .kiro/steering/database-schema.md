---
inclusion: always
---

# Database Schema Reference

**CRITICAL:** Always reference this document before writing queries for analytics reports.

## Database Overview

We use 3 SQL Server databases:
- **BUSINESS** - Accounting/ERP data (includes `dwarehe` analytics table)
- **NETPRO** - Production tracking data
- **QUOTES** - Quote management data

## Commessa (Order Number) Handling

### NETPRO Database (Production Data)
**Table:** `ORDINI`  
**Column:** `COMMESSA` (VARCHAR/String)  
**Format:** `YYSSSSRR` (8 characters)
- YY = Year (2 digits)
- SSSS = Sequential number (4 digits) - **THIS IS WHAT WE DISPLAY**
- RR = Revision (2 digits)

**Extraction Pattern:**
```sql
SUBSTRING(ORD.COMMESSA, 4, 4) -- Extracts the 4-digit core (SSSS)
```

**Example:** `25892301` → Display as `8923`

### BUSINESS Database (DataWarehouse)
**Table:** `dwarehe`  
**Column:** `dw_commeca` (INTEGER)  
**Format:** `YYSSSSRRR` (9 digits stored as integer)
- YY = Year (2 digits)
- SSSS = Sequential number (4 digits) - **THIS IS WHAT WE DISPLAY**
- RRR = Revision (3 digits, but last 2 are removed)

**Extraction Pattern:**
```sql
-- Remove last 2 digits, then take last 4 digits
RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
```

**Example:** `240762150` → Remove last 2 (50) → `2407621` → Take last 4 → `7621`

## Key Tables Reference

### NETPRO Database

#### SITUAZIONI (Time Tracking)
- `DATA` (DATE) - Work date
- `TIPO` (VARCHAR) - Type ('WORK', 'SETUP', etc.)
- `TIPO_OGGETTO` (VARCHAR) - Object type ('OPE' = Operator, 'MAC' = Machine)
- `OGGETTO` (VARCHAR) - Object ID (operator ID when TIPO_OGGETTO='OPE')
- `MACCHINA` (VARCHAR) - Machine code
- `TASK` (INT) - Links to JOBSET
- `LAVORO` (DECIMAL) - Work time in hours
- `SETUP` (DECIMAL) - Setup time in hours
- `QTA_COMPLETATA` (INT) - Quantity completed

#### ORDINI (Orders)
- `ORDINE` (INT) - Order ID
- `COMMESSA` (VARCHAR) - Order number (format: YYSSSSRR)
- `DESCRIZIONE` (VARCHAR) - Order description
- `QTA_COMPLETATA` (INT) - Quantity completed

#### JOBSET (Job Tasks)
- `TASK` (INT) - Task ID
- `ORDINE` (INT) - Links to ORDINI
- `QTA_RICHIESTA` (INT) - Requested quantity
- `OPERAZIONE` (VARCHAR) - Operation type

#### MACCHINE (Machines)
- `MACCHINA` (VARCHAR) - Machine code
- `DESCRIZIONE` (VARCHAR) - Machine name

#### CENTRI (Work Centers)
- `CENTRO` (VARCHAR) - Machine/center code
- `DESCRIZIONE` (VARCHAR) - Machine/center name
- `REPARTO` (VARCHAR) - Area code (links to AREE)

#### AREE (Production Areas)
- `REPARTO` (VARCHAR) - Area code
- `DESCRIZIONE` (VARCHAR) - Area name

#### OPERATORI (Operators)
- `OPERATORE` (VARCHAR) - Operator code
- `NOME` (VARCHAR) - Operator name

### BUSINESS Database

#### dwarehe (DataWarehouse Analytics)
Pre-processed analytics data from "Estrazione dati per Datawarehouse" tool.

**Key Columns:**
- `dw_commeca` (INT) - Order number (full integer, 0 = general expenses)
- `dw_conto` (VARCHAR) - Client/Supplier code
- `dw_valfatt` (DECIMAL) - Invoiced value (revenue from clients)
- `dw_acqvalfatt` (DECIMAL) - Acquisition invoiced value (OLD - not used)
- `dw_acqvalore` (DECIMAL) - Acquisition delivered value (material costs from suppliers)
- `dw_collifatt` (INT) - Invoiced quantity
- `dw_datmov` (DATE) - Movement date
- `dw_scenario` (INT) - Scenario (use 1 for actual data)
- `dw_anno` (INT) - Year
- `codditt` (VARCHAR) - Company code (use 'COOPZANARDI')

**CRITICAL - Material Costs:**
- Material costs come from supplier rows (`an_tipo = 'F'`)
- Use `dw_acqvalore` column (NOT `dw_acqvalfatt`)
- MUST filter `dw_commeca > 0` to exclude general expenses
- General expenses (commessa = 0) should NOT be included in order costs

#### anagra (Client Registry)
- `an_conto` (VARCHAR) - Client code
- `an_descr1` (VARCHAR) - Client name
- `an_tipo` (VARCHAR) - Account type ('C' = Client/Clienti, 'F' = Supplier/Fornitori)
- `codditt` (VARCHAR) - Company code

**CRITICAL:** Always filter by `an_tipo = 'C'` for client revenue reports to exclude supplier transactions.

#### commess (Order Registry)
- `co_comme` (INT) - Order number (matches dw_commeca format)
- `co_descr1` (VARCHAR) - Order description
- `codditt` (VARCHAR) - Company code

**Join Pattern:**
```sql
FROM dwarehe dw
INNER JOIN anagra an 
    ON dw.dw_conto = an.an_conto 
    AND dw.codditt = an.codditt
LEFT JOIN commess co
    ON dw.dw_commeca = co.co_comme
    AND dw.codditt = co.codditt
```

## Standard Query Patterns

### Production Reports (NETPRO)
```sql
SELECT 
    SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_display,
    MIN(ORD.COMMESSA) as commessa_full,
    MIN(ORD.DESCRIZIONE) as order_description,
    -- other fields
FROM SITUAZIONI SIT WITH (NOLOCK)
LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
WHERE SIT.TIPO = 'WORK'
  AND SIT.TIPO_OGGETTO = 'OPE'
  AND ORD.COMMESSA IS NOT NULL
GROUP BY SUBSTRING(ORD.COMMESSA, 4, 4)
```

### Revenue Reports (BUSINESS)
```sql
-- Use CTE approach to separate client revenue from supplier costs
WITH ClientRevenue AS (
    SELECT 
        RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
        dw.dw_commeca as commessa_full,
        an.an_conto as client_code,
        an.an_descr1 as client_name,
        SUM(dw.dw_valfatt) as total_revenue,
        SUM(dw.dw_collifatt) as total_quantity
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK) 
        ON dw.dw_conto = an.an_conto 
        AND dw.codditt = an.codditt
    WHERE dw.dw_scenario = 1
      AND dw.codditt = 'COOPZANARDI'
      AND dw.dw_anno >= 2024
      AND an.an_tipo = 'C'  -- Only clients
      AND dw.dw_valfatt > 0
      AND dw.dw_commeca > 0  -- Exclude general expenses
    GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4), dw.dw_commeca, an.an_conto, an.an_descr1
),
SupplierCosts AS (
    SELECT 
        RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
        SUM(dw.dw_acqvalore) as total_cost
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
        AND dw.codditt = an.codditt
    WHERE dw.dw_scenario = 1
      AND dw.codditt = 'COOPZANARDI'
      AND an.an_tipo = 'F'  -- Only suppliers
      AND dw.dw_acqvalore <> 0
      AND dw.dw_commeca > 0  -- CRITICAL: Exclude general expenses
    GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
)
SELECT 
    cr.commessa_display,
    cr.commessa_full,
    co.co_descr1 as order_description,
    cr.client_code,
    cr.client_name,
    cr.total_revenue,
    ISNULL(sc.total_cost, 0) as total_cost,
    cr.total_quantity
FROM ClientRevenue cr
LEFT JOIN SupplierCosts sc ON cr.commessa_display = sc.commessa_display
LEFT JOIN commess co WITH (NOLOCK)
    ON cr.commessa_full = co.co_comme
    AND co.codditt = 'COOPZANARDI'
```

## Performance Best Practices

1. **Always use NOLOCK hints** for read-only analytics queries
2. **Pagination:** Use `OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`
3. **Default limit:** 100 rows per page
4. **Date filters:** Always include date range filters to limit data
5. **Indexes:** Queries assume proper indexes on join columns

## Filter Patterns

### Comma-Separated Filters
- **Multiple values:** Exact match on codes only
- **Single value:** Fuzzy search on code OR name (where applicable)

```typescript
if (codes.length > 1) {
    // Multiple: exact match
    conditions.push(`column IN (@code0, @code1, ...)`);
} else {
    // Single: fuzzy search
    conditions.push('(code LIKE @term OR name LIKE @term)');
}
```

## Common Pitfalls

❌ **WRONG:** Using dw_commeca directly
```sql
dw.dw_commeca -- WRONG: This is 9-digit YYSSSSRRR format
```

✅ **CORRECT:** Remove last 2 digits, take last 4
```sql
RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) -- Correct: 240762150 → 7621
```

**Note:** NETPRO uses `SUBSTRING(COMMESSA, 4, 4)` while BUSINESS uses `RIGHT(dw_commeca / 100, 4)` due to different formats.

## Data Synchronization

**dwarehe table** is populated by running "Estrazione dati per Datawarehouse" in the ERP system:
- This is a manual/scheduled process
- Data is a snapshot, not real-time
- Should be run regularly (daily/weekly) to keep analytics current
- Processes raw ERP data into analytics-ready format
