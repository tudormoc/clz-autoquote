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
A write of more than one statement is one transaction per database: a SQL batch with `SET XACT_ABORT ON; BEGIN TRANSACTION … COMMIT`
(pricing rules, the Agenda's `transaction()`), or `withTransactions(['BUSINESS', 'NETPRO'], async (run) => { await run(sql, params, db); … })`
in `src/lib/mssql.ts` when the statements are built in code (Riallinea, presence exits): every `run` goes into its database's
transaction, all are committed at the end, all rolled back if anything throws. Two databases cannot commit as one; the
transactions commit one after the other, so the only moment a change can be half-done is between those two commits.
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
| `OPERATORI` | one row per operator, key `OPERATORE` (typed by hand, no numbering), `NOME` (interinali end with ` *lb`), `BADGE` (card number, unique by the app only), `ENTITA` (category: 2 Produzione, 3 Ufficio, 1001 Interinali, 999 who left: "OFF HR" in Modifica operatore), `MATRICOLA`, `STATO_FISICO` / `STATO_LOGICO` (and when each last changed: `ORA_ST_FISICO` / `ORA_ST_LOGICO`, 1986-01-01 until the first event, `APP_CONFIG.PRESENCE.NO_MOVEMENT_DATE`; the first is the "Ultimo movimento" column of Operatori), `FCODE01`…`05` (free fields: agency, then whatever was typed). "Nuovo operatore" inserts one row with the same fixed values NetPro writes (`APP_CONFIG.PRESENCE.NEW_OPERATOR_VALUES`), the stato fisico by category (OUT, OFF for Ufficio); nothing else in the database refers to a new operator (no keys, triggers or procedures). "Elimina" deletes the row only when no event, clock record, activity, user or saved hours names the code. Rules: [PRESENCE.md](PRESENCE.md) → Operators |
| `EVENTI` | presence and work events (ENT/EXT/SUS …). Key: `TASK`, `TIPO_OGGETTO`, `OGGETTO`, `EVENTO`, `ORA_EVENTO`, `PROGRESSIVO` (the counter of the events of one instant); no foreign key, trigger or procedure. A presence event has `TASK = 'presenza'`, `TIPO_OGGETTO = 'OPE'`, `OGGETTO` = the operator; a work event names its operator in `OPERATORE` (machine and 'stato' rows too). The `SITUAZIONI` rows (`TIPO = 'CLCK'` for presence) are built from these by NetPro's night job, never by the app. Rules: [PRESENCE.md](PRESENCE.md) → Presence events |
| `ATTIVITA` | NetPro's list of the work in progress: one row per person working now (key `TASK`, `OPERATORE`, `TIPO_OGGETTO` 'OPE'; `DATA_INIZIO`, `TIPO` 'WRK'). NetPro adds the row at a start and removes it at a pause; while it is there NetPro refuses that person another job (`OPERATORE ATTIVO`). The app reads it to know what an exit must pause and removes the row when it pauses that work ([PRESENCE.md](PRESENCE.md) → Presence events) |
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

**`movord`** — the rows of every order document (`mo_tipork`: `R` impegno cliente, `H` ordine di produzione, `Y` its materials under
the H row, `O` ordine fornitore …; `mo_quant` = Q.tà ordinata, `mo_colli` = Qta.Max.Prod, the most that may be produced),
**`testord`** their headers (`td_*`); the production order's phases in `attivit` / `assris`. How they link and where the quantity lives: [ORDER_PROCESS.md](ORDER_PROCESS.md).

**`anagra`** — accounts: `an_conto`, `an_descr1`, `an_tipo` (`'C'` client, `'F'` supplier). **`commess`** — orders: `co_comme`, `co_descr1`.

```sql
FROM dwarehe dw WITH (NOLOCK)
INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
LEFT JOIN commess co WITH (NOLOCK) ON dw.dw_commeca = co.co_comme AND dw.codditt = co.codditt
```

## Query rules (revenue, costs, margins)

1. **Revenue** = client rows (`an_tipo = 'C'`), filtered by the date range. Report Clienti and Ricavo Ordini use the
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
   (Report Clienti, Ricavo Ordini).

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
| `app_users` | `id`, `name` (UNIQUE, compared without case), `pin` (AES-GCM text `v1:…`, key from `AUTH_SECRET`), `group_ids` (`"1,3"`), `last_login` (DATETIME, wall-clock time of the last login, NULL = never), `suspended` (BIT, default 0); the last two added 2026-10-09 with the owner's yes; `must_change_pin` (BIT, default 0: 1 while the PIN is still the one the superadmin gave out, shown as *provvisorio* in Utenti), added 2026-11-02 with the owner's yes, `sql/auth/001_must_change_pin.sql`; `operator_code`, `netpro_user`, `erp_user` (VARCHAR(20), NULL = not linked: the same person in NetPro and Business, see People), added 2026-11-02 with the owner's yes, `sql/auth/002_person_links.sql` |
| `app_groups` | `id`, `name` (UNIQUE), `pages` (JSON: page id → `"view"` / `"edit"`, e.g. `"daily-events"`; a page's function as `"page id#name": "edit"`, e.g. `"work-progress#riallinea"`. Until 2026-10-30 the keys were the menu links; `cleanPermissions` still reads those) |

Read and written only by `src/lib/auth/accounts.ts`; the superadmin is not stored here (`.env.local`).

## Log table (QUOTES, created 2026-11-05 with the owner's yes)

`app_log` (`sql/log/001_create_app_log.sql`): one row per thing a person did in the app. Written only by `logEvent`
(`src/lib/log/log.ts`, never throws), read only by `src/lib/log/entries.ts` for the Registro page, which lists it together
with the Agenda's `tsk_log` and the timesheet's `timesheet_log`.

| Column | Meaning |
|---|---|
| `logged_at` | the moment (`GETDATE()`, wall-clock time) |
| `person`, `person_name` | who: an `app_users` id as text, `superadmin`, `system` or `anonymous` (a login that failed), and the name at that moment |
| `area` | the menu page's id (`work-progress`, `operators` …), or `login` |
| `action` | what was done: `created`, `changed`, `deleted`, `renamed` on most records; `riallinea`, `prefill`, `auto-exit`, `links`, `align-email`, `align-name`, `groups`, `pages`, `pin-set`, `suspended`, `resumed`; `login`, `login-failed`, `login-locked`, `login-suspended`, `logout`, `pin-changed` |
| `entity_kind`, `entity_id` | what it was done to: `order` + commessa, `user` + id … |
| `summary` | one line a person can read |
| `details` | JSON: `{ before, after }` for one record, `{ rows: [{ db, table, key, change, columns | row }] }` for a write over several tables (Riallinea: every row and column it really changed, from a snapshot before and after, `src/lib/orders/snapshot.ts`) |
| `outcome`, `error` | `ok`, `refused` or `error`, with the error text |

A PIN or a password is never written there.

Logged since 2026-11-05: logins; Riallinea (every row it changed, also refused and failed runs); users and groups; quotes
and price rules; the settings tables, the labour rates and the presence rules; presence events, the hours of a day, the
prefill of the absences and the automatic exit (as `system`); operators; the Scheda persona's links and its two Allinea.
Not logged, by the owner's choice: exports, prints and pages opened. Who reads it: the superadmin everything; a group that can
open the Registro page the entries of the pages it can open, or of every grantable page with "Tutto il registro"; logins and the
entries of Utenti, Gruppi and Esplora Database are the superadmin's alone (`src/lib/log/areas.ts`).

## People

The same person lives in several places; the Scheda persona (Utenti) reads them all through the three links of `app_users` and
writes the e-mail and the name (in capitals, the same text everywhere), only where marked. Collations are case-insensitive, so `TM` = `tm`.

| Place | Table | Key | Read | Written by Allinea |
|---|---|---|---|---|
| NetPro operator | `NETPRO.OPERATORI` | `OPERATORE` = `operator_code` | `NOME`, `BADGE`, `ENTITA` | `NOME` (varchar 30, with the category's mark) |
| Business operator list | `COOPZANARDI.tabcope` | `tb_codcope` = `operator_code` | `tb_descope` | `tb_descope` (30) |
| NetPro login | `NETPRO.UTENTI` | `UTENTE` = `netpro_user` | `DESCRIZIONE`, `FEMAIL`, `RUOLO` | `FEMAIL` (varchar 50), `DESCRIZIONE` (30) |
| Business login | `ARCPROC.OPERAT` | `OpNome` = `erp_user` | `OpDescont`, `OpDescont2`, `OpSumail`, `OpRuolo` | `OpSumail`, `OpDescont` (30) + `OpDescont2` (20) |
| Business org chart | `COOPZANARDI.organig` | `og_coperat` = `erp_user` | `og_descont`, `og_descont2`, `og_email`, `og_telef`, `og_codcope` | `og_email`, `og_descont` (30) + `og_descont2` (20) |
| Business mailbox | `COOPZANARDI.emailconf` | `em_user` = `erp_user` | `em_email` | never (it is the mailbox login) |

Left out on purpose (owner, 2026-11-02): the e-mail signatures (`emailfirme`, one row per signature, a person may keep
several addresses there), the ERP's settings store (`ARCPROC.REGPROP`) and the mailbox folder cache (`emaildir`).

ARCPROC is the ERP's own database (users, roles, settings) on the same server, reached through the Business connection as
`ARCPROC.dbo.…`. The Business logins' passwords and PINs there are the ERP's, never read by the app.
## Agenda tables (QUOTES, created 2026-10-09 with the owner's yes)

Created by `sql/tasks/001_create_tables.sql`; read and written only by `src/lib/tasks/db/` (how they work: [TASKS.md](TASKS.md)).
People are `VARCHAR(20)`: an `app_users` id as text, `superadmin`, or `system`. Dates are `DATE`, moments `DATETIME2(0)` with
`GETDATE()` (wall-clock time). Every main table has `row_version` (ROWVERSION) for the "changed meanwhile" check.

| Table | Columns |
|---|---|
| `tsk_tasks` | `id`, `title`, `notes` (formatted text), `area_id` → `tsk_areas` (SET NULL), `tags` (comma-separated), `priority` (0 normale, 1 alta, 2 critica), `assignee`, `group_id` (`app_groups.id`, no FK), `visibility` (`private` / `group` / `all`), `due_date` (one-time: the date, NULL = none; repeating: the first date), `due_time`, `repeat_rule` (JSON, NULL = one-time), `repeat_from` (no occurrences before), `show_days`, `remind_days` (later), `checklist` (JSON `[{id, text}]`), `estimate_minutes`, `parent_id`, `link_kind` / `link_code` (later), `state` (`active` / `paused` / `archived`), `source`, `created_*`, `updated_*` |
| `tsk_occurrences` | `id`, `task_id` (CASCADE), `original_date` (from the rule), `due_date` (after "Rimanda"), `due_time`, `status` (`open` `progress` `waiting` `done` `skipped` `cancelled` `replaced`), `status_note`, `outcome`, `checklist_done` (JSON ids), `done_at`, `done_by`, `day_order` (place in its day, set by hand; NULL = by time), `created_at`, `updated_*`; UNIQUE (`task_id`, `original_date`) |
| `tsk_guides` / `tsk_guide_versions` | procedure: `title`, `area_id`, `body`, `review_months`, `reviewed_at`, `state`; each earlier text: `guide_id`, `title`, `body`, `saved_at`, `saved_by` |
| `tsk_task_guides` | `task_id`, `guide_id`, `sort_order` |
| `tsk_links` | `owner_kind` (`task` / `occurrence` / `guide`), `owner_id`, `label`, `kind` (`web` `path` `page` `email` `phone` `other`), `value`, `sort_order` |
| `tsk_contacts` / `tsk_contact_refs` | `name`, `company`, `role`, `phone`, `email`, `notes`, `state`; where used: `contact_id`, `owner_kind` (`task` / `guide`), `owner_id` |
| `tsk_log` | `logged_at`, `person`, `entity_kind`, `entity_id`, `task_id`, `action`, `details` (JSON) |
| `tsk_areas` / `tsk_closed_days` | settings tables (`editableTables.ts`): `name`, `sort_order` / `closed_on`, `name`, `every_year` |

## Timesheet tables (QUOTES, created 2026-11-04 with the owner's yes)

Created by `sql/timesheet/001_create_tables.sql`; read and written only by `src/lib/timesheet/db/` (how they work:
[TIMESHEET.md](TIMESHEET.md)). People, dates and moments as in the Agenda tables; the operator is the NetPro code
(`NETPRO.OPERATORI.OPERATORE` = `app_users.operator_code`). The SQL helpers both modules use: `src/lib/appTables.ts`.

| Table | Columns |
|---|---|
| `timesheet_entries` | `id`, `operator_code`, `day`, `kind` (`work`, `ferie`, `permesso`, `malattia`, `straordinarie`, `banca_ore`: the app's list, not a CHECK, so a new kind needs no table change), `time_from` / `time_to` (work; `time_to` NULL while still in), `hours` (every other kind), `causale` (ferie / permesso: the type), `note`, `created_*`, `updated_*`, `row_version`. CHECKs: a work row has times and no hours, any other row hours and no times; `time_to > time_from`; `0 < hours ≤ 24`. Index (`operator_code`, `day`) |
| `timesheet_log` | `logged_at`, `person`, `entry_id` (kept after a delete), `operator_code`, `day`, `action` (`created` / `changed` / `deleted`), `details` (JSON `{ before, after }`, the missing side left out) |
