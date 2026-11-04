# Timesheet — the office people's own hours

The office people enter their own hours day by day, instead of writing them in an Excel file each; the owner checks
and corrects the month in one place and exports it for the pay studio. Menu area **Presenze**, pages **Le mie ore**
(`/presence/my-hours`) and **Ore Ufficio** (`/presence/office-hours`); in the code the module is `timesheet`.
Built 2026-11-04 on the owner's go-ahead. Production people keep clocking in NetPro (Calcolo Ore Mensile is not
touched); they can come into the same tables later.

## Words

| In the app | In the code | What it is |
|---|---|---|
| Riga | entry (`timesheet_entries`) | One piece of a person's day: a span of work (dalle → alle), or a number of hours of another kind. |
| Tipo | kind (`ENTRY_KINDS`, `KIND_SPECS`) | `work`, `ferie`, `permesso`, `malattia`, `straordinarie`, `banca_ore`. A new kind is one line of config, no table change. |
| Causale | `causale` | The type of a ferie or permesso line, picked from the quick texts of Impostazioni → Regole Presenze (`FERIE_PRESETS`, `PERMESSO_PRESETS`). It goes to the studio's file as the note of the column. |
| Nota | `note` | A free word of the person ("visita medica"); shown in Ore Ufficio, not exported. |
| Giorno | day summary (`DaySummary`) | What the day adds up to: the hours per column, the causali, what is missing, its state. Always computed from the lines, never stored. |
| Registro | log (`timesheet_log`) | Every insert, change and delete, who and when, with the line before and after (JSON). Kept forever. There is no month lock: this is the record. |

**Who**: the NetPro operators of the categories marked `timesheet: true` in `PRESENCE_RULES.CATEGORIES` (today
CLZ Ufficio, `ENTITA` 3). A person enters their own hours through the operator link of their login (Utenti → Scheda
persona → `operator_code`); without it the page says whom to ask (`APP_CONFIG.OWNER_NAME`). Someone not of these
categories is not listed and cannot enter hours, whatever their login.

## No rules

Nothing changes what was entered. **Ordinarie** is the sum of the work spans; every other column is the sum of its
lines. Nothing is capped, moved to straordinarie or filled in. Times and hours move in half-hour steps
(`APP_CONFIG.TIMESHEET.STEP_MINUTES`): 08:00, 08:30; 8, 8.5. Entra and Esci stamp the nearest step of now.

The one number read from the presence rules is the person's **workday** (`ORE_GIORNATA`, or their exception in
`ORE_GIORNATA_OPERATORE`), used only to say whether the day is covered:

| State | When |
|---|---|
| In corso | a work line without an exit |
| Mancano N h | a past working day where ordinarie + ferie + permesso + malattia is below the workday |
| Da completare | the same, today or later (no alert yet) |
| Completa | covered, or nothing expected and something entered |
| Libero | a weekend with nothing (nothing shown) |
| Chiuso · name | a company closed day with nothing entered |

Working days are the presence rules' `GIORNI_LAVORATIVI`. **Company closed days** come from the Agenda (Impostazioni
→ Giorni di chiusura): a closed day with nothing entered counts as ferie for the workday hours, with the day's name as
its causale, without any row; a line entered on it counts as itself and the automatic ferie is not added. Over the
workday is never flagged.

Examples of all this run with `npm run timesheet:examples` (`src/lib/timesheet/examples.ts`).

## Pages

**Le mie ore** — the person's own month: a month bar (previous, next, this month), today on top with one big button
that stamps now (**Entra**, or **Esci** when a line is open) and "Dettagli del giorno", then every day of the month
with its lines, its ordinarie and its state. A click on a day opens its window: the lines (change, delete), the
day's total and state, and a form for a new line: the kind, then the times (Alle may be "ancora dentro") or the hours
with "Giornata intera", the causale when the kind has one, a note. *Vede* looks, *modifica* writes; the server
checks that the lines are the person's own. Past and future days can be changed; everything is logged.

**Ore Ufficio** — everyone's month, loaded on "Applica" (month, year, one person or all): one row per person and
day with the file's columns (ferie and causale, permesso and causale, malattia, ordinarie, straordinarie, banca ore),
the spans, the notes and the state; totals in the footer; a short day is tinted. The pencil (with *modifica*) opens
the same day window as Le mie ore, for anyone. **Esporta Excel** gives the month in the studio's layout
(`payrollExcelColumns`, the same sheet as Ore Studio Paghe).

**Ore Studio Paghe** — the office rows come from here (`toPayrollPerson`): "ID Operatore" is the studio's own number
(`APP_CONFIG.PAYROLL.STUDIO_IDS`, by NetPro code: those numbers exist nowhere else), "Codice SARP net" the NetPro
matricola, the name as people write it. The production rows keep coming from the monthly Excel file.

## Code

| What | Where |
|---|---|
| Types, kinds, steps, the day and month sums, the input checks, the examples | `src/lib/timesheet/` (pure) |
| The tables' SQL: lines with their log, the people from NetPro, a month | `src/lib/timesheet/db/` |
| Server actions (access checks, whose line it is) | `src/app/presence/timesheet-actions.ts` |
| Screens | `src/components/timesheet/` |
| Texts / numbers | `it.ts → timesheet` / `APP_CONFIG.TIMESHEET`, `APP_CONFIG.OWNER_NAME`, `PAYROLL.STUDIO_IDS` |
| Tables | `sql/timesheet/001_create_tables.sql` (run 2026-11-04 with the owner's yes); columns in [DATABASE.md](DATABASE.md) → Timesheet tables |

Shared with the Agenda: the SQL text helpers, the runner, the "changed meanwhile" check and how actions answer
(`src/lib/appTables.ts`); the closed days (`src/lib/tasks/closedDays.ts`, `companyDay`).

## Later

- Production people: their rows in the same tables (entered here, or copied from NetPro's clock-ins), then Calcolo
  Ore Mensile reads them.
- A month lock ("Mese chiuso fino al"): one setting in Regole Presenze and one check in `saveEntryAction`.
- Rules on top of the sums (an excess to straordinarie, a shortfall to permesso): a new profile in
  `src/lib/presence`, applied in `summarizeDay`, never to what was entered.
