# Databases and query rules

Three SQL Server databases, all reached through `queryMSSQL(query, params, db)` in `src/lib/mssql.ts`:

| `db` | Database | What |
|---|---|---|
| `BUSINESS` | COOPZANARDI | ERP: accounting, orders, clients, suppliers, the `dwarehe` analytics table |
| `NETPRO` | NETPRO | Production: orders, operations, time tracking, presence |
| `QUOTES` | CLZDWHQANDPROG | This app's own tables: quotes, pricing rules, discount tiers, signatures |

**The databases are live.** Analytics and lists only read (`WITH (NOLOCK)` on every SELECT). Writes exist in a few places
(presence edits, "Riallinea Ordine da DiBa", admin tables) and change production data immediately.

Business tables give every column a 2–3 letter prefix (`an_*` anagra, `mo_*` movord, `dw_*` dwarehe, `co_*` commess).
Company filter everywhere in Business: `codditt = 'COOPZANARDI'`.

## Commessa (order number) formats

The number shown to users is the 4-digit core `SSSS`. Each database stores it differently:

| Where | Column | Format | Extract the core |
|---|---|---|---|
| NetPro `ORDINI` | `COMMESSA` (varchar) | `YYSSSSRR` | `SUBSTRING(ORD.COMMESSA, 4, 4)` — `25892301` → `8923` |
| Business `dwarehe` | `dw_commeca` (int) | `YYSSSSRRR` | `RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)` — `240762150` → `7621` |

Group by the **full** number (`dw.dw_commeca`) and only *display* the core; grouping by the core merges different orders.

## NetPro tables

| Table | Key columns |
|---|---|
| `SITUAZIONI` (time tracking) | `DATA`, `TIPO` ('WORK', 'SETUP'…), `TIPO_OGGETTO` ('OPE' operator / 'MAC' machine), `OGGETTO`, `MACCHINA`, `TASK` → JOBSET, `LAVORO` / `SETUP` (hours), `QTA_COMPLETATA` |
| `ORDINI` | `ORDINE`, `COMMESSA`, `DESCRIZIONE`, `TIPO` ('MAKE'…), `STATO` |
| `JOBSET` | `TASK`, `ORDINE`, `OPERAZIONE`, `ID_OPER`, `QTA_RICHIESTA` |
| `OPERAZIONI` | `ID_OPER`, `ORDINE`, `SEQUENZA` (fase), `DESCRIZIONE`, `STATO` (EXE in work, SUS suspended, COM completed) |
| `TASKS` | `TASK`, `MACCHINA`, `STATO` |
| `CENTRI` / `AREE` | machine/centre → `REPARTO` (area) → area name |
| `OPERATORI` | `OPERATORE`, `NOME`, `STATO_LOGICO` |
| `EVENTI` | presence and work events (ENT/EXT/SUS …) |
| `VALORI_TABELLE` | settings; `TABELLA = 'PRESENZE'` holds the presence rules |

`TASKS.TASK = OPERAZIONI.ID_OPER = JOBSET.TASK`. How orders reach NetPro: [ORDER_PROCESS.md](ORDER_PROCESS.md).

## Business tables

**`dwarehe`** — analytics snapshot produced by "Estrazione dati per Datawarehouse" in the ERP (not real time; rerun it to refresh):

| Column | Meaning |
|---|---|
| `dw_commeca` | Order number (`0` = general expenses, not an order) |
| `dw_conto` | Client or supplier code → `anagra.an_conto` |
| `dw_valfatt` | Invoiced value (client revenue) |
| `dw_acqvalore` | Delivered purchase value (**material cost**; `dw_acqvalfatt` is the old column, not used) |
| `dw_collifatt` | Invoiced quantity |
| `dw_datmov`, `dw_anno` | Movement date, year |
| `dw_scenario` | Always `1` (actual data) |

**`anagra`** — accounts: `an_conto`, `an_descr1`, `an_tipo` (`'C'` client, `'F'` supplier). **`commess`** — orders: `co_comme`, `co_descr1`.

```sql
FROM dwarehe dw WITH (NOLOCK)
INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
LEFT JOIN commess co WITH (NOLOCK) ON dw.dw_commeca = co.co_comme AND dw.codditt = co.codditt
```

## Query rules (revenue, costs, margins)

1. **Revenue** = client rows (`an_tipo = 'C'`, `dw_valfatt`), filtered by the date range.
2. **Material costs** = supplier rows (`an_tipo = 'F'`, `dw_acqvalore`), **never filtered by date**: an order invoiced in 2025
   with costs in 2024 needs those costs for its real margin. The same for work hours (`fetchWorkTimesForCommessas`).
3. **Always `dw_commeca > 0`** on cost queries, or general expenses inflate the costs.
4. **Labour cost** = work hours × `APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE`.
5. **Margin** = revenue − (material cost + labour cost). In Ricavo Ordini the revenue is the value *delivered* in the
   period, in the table and in Excel alike (decided 2026-10-07).
6. Use one CTE for client revenue and one for supplier costs, joined on the commessa (see `business-queries.ts`).
7. Paging: `OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`, 100 rows per page.

## Reusable query helpers (`src/app/analytics/queries/shared/`)

- `filter-builders.ts` — commessa, machine, operator and client filters. Several comma-separated values → exact match on codes;
  one value → `LIKE` on code or name.
- Commessa search by **description** in Business: skip the single-term filter inside the CTE
  (`buildCommessaFilterBUSINESS(…, true)`) and add `buildPostCTECommessaFilter` after the CTE, once `commess` is joined.
- `query-utils.ts` — offset, pagination result, ORDER BY builders, date parameters.
- `work-time-fetcher.ts` — NetPro work hours / costs for a list of commesse (cross-database).

## Server actions

- A `'use server'` file may only export async functions. To re-export, import then assign:
  `import { x as xImpl } from './file'; export const x = xImpl;` (`export { x } from` fails in Next.js 16).
- Wrap the body in `try/catch` and return `{ success, data, error? }`.
