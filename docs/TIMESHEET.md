# Timesheet — the office people's own hours

The office people enter their own hours day by day, instead of writing them in an Excel file each; the owner checks
and corrects the month in one place and exports it for the pay studio. Menu area **Presenze**, pages **Le mie ore** (`/presence/my-hours`) and **Ore Ufficio** (`/presence/office-hours`); in the code the module is `timesheet`.
Built 2026-11-04 on the owner's go-ahead. Production people keep clocking in NetPro (Calcolo Ore Mensile is not
touched); they can come into the same tables later.

## Words

| In the app | In the code | What it is |
|---|---|---|
| Riga | entry (`timesheet_entries`) | One piece of a person's day: a span of work (dalle → alle), or a number of hours of another kind. |
| Tipo | kind (`ENTRY_KINDS`, `KIND_SPECS`) | `work`, `ferie`, `permesso`, `malattia`, `straordinarie`, `banca_ore`. A new kind is one line of config, no table change. |
| Causale | `causale` | The type of a ferie or permesso line, picked from the quick texts of Impostazioni → Regole Presenze (`FERIE_PRESETS`, `PERMESSO_PRESETS`). It goes to the studio's file as the note of the column. A quick text renamed there is renamed in every line that carries it, each with its log line (`renameCausale`, owner 2026-11-12), in the same transaction as the list and the hours of Calcolo Ore Mensile (`renamePresencePresetAction`): all of it, or none. A quick text removed from the list stays on the lines that have it. |
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
(`APP_CONFIG.TIMESHEET.STEP_MINUTES`): 08:00, 08:30; 8, 8.5. The pickers stay inside the company's open hours
(Regole Presenze → `FOGLIO_ORE_PRIMA_ORA` / `FOGLIO_ORE_ULTIMA_ORA`, default 07:00–19:00), the hours of a line go
up to the person's own workday, and every work line is closed: Alle is always picked (an old line without an exit
still shows as "ancora dentro" and counts nothing). One exception to "no rules": **ferie and malattia are always the whole workday** (`wholeDay` in
`KIND_SPECS`) — no hours to pick, and saving one **replaces every line the day held** (`replaceDayEntries`, one
transaction, every replaced line kept in the log); a day held by one takes no other lines. Both checked on the
server too.

**The timesheet starts on the day set in Regole Presenze** (`FOGLIO_ORE_INIZIO`, default 1 November 2026): earlier
days are shown but locked — nothing expected, no alerts, no editing anywhere, and the server refuses a write before
it. These three timesheet settings live in NETPRO.VALORI_TABELLE like every other presence rule, edited in
Impostazioni → Regole Presenze; `PRESENCE_RULES` (its own constant in `src/config/constants.ts`) holds only their defaults.

The one number read from the presence rules is the person's **workday** (`ORE_GIORNATA`, or their exception in
`ORE_GIORNATA_OPERATORE`), used only to say whether the day is covered:

| State | When |
|---|---|
| In corso | a work line without an exit (old lines only: the editor no longer writes one) |
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

**Le mie ore** — the person's own month: a month bar (previous, next, this month), then every day a row with its
lines, its ordinarie and its state; today is only highlighted, there is no separate card or stamp button (owner,
2026-11-05). A click on a day opens it **in place**. An empty working day comes ready: the **Giornata normale** chip
(the person's usual spans, see below) and the form already open, prefilled with the first usual span — one click for
a normal day, nothing else to press. The form offers a person **Lavoro, Permesso, Ferie and Malattia**, in that
order (`SELF_KINDS` in `kinds.ts`; straordinarie and banca ore are the owner's, written from Ore Ufficio): the
times (picking Dalle on a new line proposes Alle with it: half the workday on the first line, the kept span after),
the hours of a permesso (a new one proposes what still misses to reach the workday, on a Saturday too), the causale when the kind has one,
a note. Ferie (with its causale, started on the quick text named FERIE when there is one) and malattia show no
hours: one click and Salva writes the whole day. Once a write brings the day to its workday, the opened row closes
by itself and the list is back in view. A filled day shows its
lines (change, delete), "Aggiungi riga" and — with two or more lines — **"Svuota giorno"** beside the day's
total, which deletes them all with one confirm, each kept in the log (`deleteDayEntries`, one transaction), and
closes the day; a new work line starts a break after the day's last exit
(`NEXT_LINE_BREAK_MINUTES`) and ends at the person's workday, on a Saturday or a day ahead just the same —
08:30–12:30 saved, the next line proposes 13:30–17:30. The pencil of a line is a toggle: click it again and any change is saved and the line closes. When
every working day of the month is covered, a quiet **"Mese completo"** check appears by the month totals. Days are
filled **one at a time** (owner, 2026-11-05: no bulk fill);
the server writes the giornata normale only into a day that is still an empty working day — the days ahead
included, so a week can be filled in advance (owner, 2026-11-06) (`fillNormalDayAction`), its lines and their log
in one transaction (`insertDayEntries`). *Vede* looks, *modifica*
writes; the server checks that the lines are the person's own. Past and future days can be changed; everything is
logged.

**The giornata normale** (`src/lib/timesheet/normalDay.ts`): the shape the person's own full days take **most often**
over the last `NORMAL_DAY_LOOKBACK_DAYS`, a full day being closed work lines that add up to **exactly** their workday
(owner, 2026-11-11). One odd day does not take over, since the usual day outvotes it (two shapes seen equally often:
the most recent). A longer day, say 8,5 h, never becomes the suggestion however often it happens: extra time is an
exception the person corrects by hand each time. A day shortened by permesso or ferie does not count either, and a
4- or 6-hour person gets their own workday. It is only ever learned, never invented (owner, 2026-11-05): until the
person has entered at least one full day by hand, the chip does not appear, and a new work line prefills from
`DEFAULT_TIME_FROM`. The times need no setting; the workday itself (8, 6, 4) stays a setting of Regole Presenze
(`ORE_GIORNATA`, `ORE_GIORNATA_OPERATORE`): it is a contract fact that reaches the pay studio, so it is not guessed.

The states stay quiet: a covered day is a small green check, "Mancano N h" is red only when the day holds nothing
at all (amber when something is already there), free days and days to come show nothing. Weekends and days before
the start look switched off in the list — greyed, a dashed line, no hover, full size (owner, 2026-11-06: small
rows were tiring) — so the working days stand out and nobody clicks them by mistake.

**Ore Ufficio** — everyone's month, loaded on "Applica" (month, year, one person or all): one row per person and
day with the file's columns (ferie and causale, permesso and causale, malattia, ordinarie, straordinarie, banca ore),
the spans, the notes and the state; totals in the footer; a short day is tinted. The pencil (with *modifica*) opens
the same day panel as Le mie ore in a window, for anyone, with every kind (straordinarie and banca ore are
written here, not by the person). **Esporta Excel** gives the month in the studio's layout
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
