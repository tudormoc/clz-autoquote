# Databases and query rules

Three SQL Server databases, all reached through `queryMSSQL(query, params, db)` in `src/lib/mssql.ts`:

| `db` | Database | What |
|---|---|---|
| `BUSINESS` | COOPZANARDI | ERP: accounting, orders, clients, suppliers, the `dwarehe` analytics table |
| `NETPRO` | NETPRO | Production: orders, operations, time tracking, presence |
| `QUOTES` | CLZDWHQANDPROG | This app's own tables: quotes, pricing rules, discount tiers, signatures, login users and groups, the Agenda (`tsk_*`) |

Every read names its row type, next to its SQL: `queryMSSQL<{ total: number }>(…)` (numeric / money → `number`,
datetime → `Date`, a nullable or LEFT JOIN column → `| null`). The report screens import the row type from their query file.

**The databases are live.** Analytics and lists only read (`WITH (NOLOCK)` on every SELECT). Writes exist in a few places
(presence edits, "Riallinea Ordine da DiBa", settings tables, presence rules and labour rates) and change production data immediately.
A table or column name that comes from the browser never goes into the SQL as sent: settings tables are checked against
`src/config/editableTables.ts`, the Database page against the database's own list of tables and columns, presence edits
against their own column lists, sort keys and directions through `ownEntry` / `sqlDirection` (`query-utils.ts`).

Business tables give every column a 2–3 letter prefix (`an_*` anagra, `mo_*` movord, `dw_*` dwarehe, `co_*` commess).
Company filter everywhere in Business: `codditt = 'COOPZANARDI'` — write it as `BUSINESS_COMPANY` (`src/config/constants.ts`),
as a parameter or as `'${BUSINESS_COMPANY}'` inside the SQL template.

## Commessa (order number) formats

The number shown to users is the 4-digit core `SSSS`. Each database stores it differently:

| Where | Column | Format | Extract the core |
|---|---|---|---|
| NetPro `ORDINI` | `COMMESSA` (varchar) | `YY0SSSSRR` | `SUBSTRING(ORD.COMMESSA, 4, 4)` — `260961105` → `9611` |
| Business `dwarehe` | `dw_commeca` (int) | `YY0SSSSRR` | `RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)` — `240762150` → `7621` (`businessOrderCore`) |

`YY` is the year, `RR` the sub-order. Revenue/cost reports group by the core so that an order's sub-orders and years add
up. Row lists group by the full number and only *display* the core.

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
| `VALORI_TABELLE` | settings the app saves (`src/lib/settingsStore.ts`): `TABELLA = 'PRESENZE'` the presence rules, `'ANALISI'` the labour rates |

`TASKS.TASK = OPERAZIONI.ID_OPER = JOBSET.TASK`. How orders reach NetPro: [ORDER_PROCESS.md](ORDER_PROCESS.md).

## Business tables

**`dwarehe`** — analytics snapshot produced by "Estrazione dati per Datawarehouse" in the ERP (not real time; rerun it to refresh):

| Column | Meaning |
|---|---|
| `dw_commeca` | Order number (`0` = general expenses, not an order) |
| `dw_conto` | Client or supplier code → `anagra.an_conto` |
| `dw_tipork` | Record type: `'B'` delivery note (value in `dw_valore`), `'D'` invoice (value in `dw_valfatt`); `'E'` and `'N'` rows carry both |
| `dw_valore` | Delivered value (client revenue on delivery notes) |
| `dw_valfatt` | Invoiced value (client revenue on invoices; always `0` on delivery notes) |
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

1. **Revenue** = client rows (`an_tipo = 'C'`), filtered by the date range. Sommario Clienti and Ricavo Ordini use the
   delivered value: `dw_valore` of delivery notes (`dw_tipork = 'B'`).
2. **Material costs** = supplier rows (`an_tipo = 'F'`, `dw_acqvalore`), **never filtered by date**: an order invoiced in 2025
   with costs in 2024 needs those costs for its real margin. The same for work hours (`fetchWorkTimesForCommessas`).
3. **Always `dw_commeca > 0`** on cost queries, or general expenses inflate the costs.
4. **Labour cost** = work hours × `APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE`.
5. **Margin** = revenue − (material cost + labour cost), computed once on the server (`full_cost`, `margin` in the
   rows) and used as is by the table, Excel and PDF. In Ricavo Ordini the revenue is the value *delivered* in the period
   (decided 2026-10-07).
6. **Speed**: `dwarehe` has ~15M rows. Never join or filter it on the computed core (`RIGHT(CAST(…))`) outside a date
   range: that reads the whole table (30–60 s). Read the period's orders into a `#temp` table first, collect their full
   codes with `businessOrderCodesSql` (→ `#OrderCodes`), then join `dwarehe` on `dw_commeca` (indexed). One batch,
   `SET NOCOUNT ON`, `dropTempTablesSql` at the start and the end. Example: `order-revenue-queries.ts` (about 2 s per report).
7. Paging: 100 rows per page. In SQL: `OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY` with a unique tie-breaker in
   the ORDER BY, or rows with equal values move between pages and the export repeats some and loses others. When a
   sortable column is added after the query (labour from NetPro), fetch all rows, complete them, then `sortAndPage`
   (Sommario Clienti, Ricavo Ordini).

## Reusable query helpers (`src/app/analytics/queries/shared/`)

- `filter-builders.ts` — commessa, machine, operator and client filters. Several comma-separated values → exact match on codes;
  one value → `LIKE` on code or name.
- Commessa search by **description** in Business: skip the single-term filter on the order rows
  (`buildCommessaFilterBUSINESS(…, true)`) and add `buildCommessaDescriptionFilter` once `commess` is joined.
- `query-utils.ts` — offset, pagination result, ORDER BY builders, `sortAndPage` (sort and page completed rows),
  date parameters, the `#temp` batch helpers (`businessOrderCore`, `businessOrderCodesSql`, `dropTempTablesSql`)
  and `queryErrorMessage`.
- `work-time-fetcher.ts` — NetPro work hours / costs for a list of commesse (cross-database).

## Server actions

- A `'use server'` file may only export async functions. To re-export, import then assign:
  `import { x as xImpl } from './file'; export const x = xImpl;` (`export { x } from` fails in Next.js 16).
- Wrap the body in `try/catch` and return `{ success, data, error? }`.

## Login tables (QUOTES, created 2026-10-09 with the owner's yes)

| Table | Columns |
|---|---|
| `app_users` | `id`, `name` (UNIQUE, compared without case), `pin` (AES-GCM text `v1:…`, key from `AUTH_SECRET`), `group_ids` (`"1,3"`), `last_login` (DATETIME, wall-clock time of the last login, NULL = never), `suspended` (BIT, default 0); the last two added 2026-10-09 with the owner's yes |
| `app_groups` | `id`, `name` (UNIQUE), `pages` (JSON: menu link → `"view"` / `"edit"`) |

Read and written only by `src/lib/auth/accounts.ts`; the superadmin is not stored here (`.env.local`).

## Agenda tables (QUOTES, created 2026-10-09 with the owner's yes)

Created by `sql/tasks/001_create_tables.sql`; read and written only by `src/lib/tasks/db/` (how they work: [TASKS.md](TASKS.md)).
People are `VARCHAR(20)`: an `app_users` id as text, `superadmin`, or `system`. Dates are `DATE`, moments `DATETIME2(0)` with
`GETDATE()` (wall-clock time). Every main table has `row_version` (ROWVERSION) for the "changed meanwhile" check.

| Table | Columns |
|---|---|
| `tsk_tasks` | `id`, `title`, `notes` (formatted text), `area_id` → `tsk_areas` (SET NULL), `tags` (comma-separated), `priority` (0 normale, 1 alta, 2 critica), `assignee`, `group_id` (`app_groups.id`, no FK), `visibility` (`private` / `group` / `all`), `due_date` (one-time: the date, NULL = none; repeating: the first date), `due_time`, `repeat_rule` (JSON, NULL = one-time), `repeat_from` (no occurrences before), `show_days`, `remind_days` (later), `checklist` (JSON `[{id, text}]`), `estimate_minutes`, `parent_id`, `link_kind` / `link_code` (later), `state` (`active` / `paused` / `archived`), `source`, `created_*`, `updated_*` |
| `tsk_occurrences` | `id`, `task_id` (CASCADE), `original_date` (from the rule), `due_date` (after "Rimanda"), `due_time`, `status` (`open` `progress` `waiting` `done` `skipped` `cancelled` `replaced`), `status_note`, `outcome`, `checklist_done` (JSON ids), `done_at`, `done_by`, `created_at`, `updated_*`; UNIQUE (`task_id`, `original_date`) |
| `tsk_guides` / `tsk_guide_versions` | procedure: `title`, `area_id`, `body`, `review_months`, `reviewed_at`, `state`; each earlier text: `guide_id`, `title`, `body`, `saved_at`, `saved_by` |
| `tsk_task_guides` | `task_id`, `guide_id`, `sort_order` |
| `tsk_links` | `owner_kind` (`task` / `occurrence` / `guide`), `owner_id`, `label`, `kind` (`web` `path` `page` `email` `phone` `other`), `value`, `sort_order` |
| `tsk_contacts` / `tsk_contact_refs` | `name`, `company`, `role`, `phone`, `email`, `notes`, `state`; where used: `contact_id`, `owner_kind` (`task` / `guide`), `owner_id` |
| `tsk_log` | `logged_at`, `person`, `entity_kind`, `entity_id`, `task_id`, `action`, `details` (JSON) |
| `tsk_areas` / `tsk_closed_days` | settings tables (`editableTables.ts`): `name`, `sort_order` / `closed_on`, `name`, `every_year` |
