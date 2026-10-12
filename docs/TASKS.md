# Agenda — tasks, deadlines, procedures

One place for the owner's work: **what** to do, **when** (once, repeating, by a deadline), **how** (instructions and
procedures), **from where** (links, paths, contacts), **who** does it and **what happened** each time.
Menu area **Agenda** (`/tasks`); in the code the module is `tasks`. Built 2026-10-09/10 on the owner's go-ahead.

Today only the owner uses it, but nothing assumes one person: opening it to others = giving their group access to the
Agenda pages (Impostazioni → Accessi → Gruppi). No file uploads (links and paths only). Email reminders: later.

## Words

| In the app | In the code | What it is |
|---|---|---|
| Attività | task (`tsk_tasks`) | Something to do: one-time (with or without a date) or repeating. Never deleted: paused or archived. |
| Scadenza | occurrence (`tsk_occurrences`) | One real moment a task is due. Done, moved, notes, checklist ticks and comments belong to it. |
| Procedura | guide (`tsk_guides`) | How something is done. Separate from tasks: one serves many, and it stays when a task is archived. Every save keeps the earlier text (`tsk_guide_versions`). |
| Contatto | contact (`tsk_contacts`) | A person or company to call or write, reused by tasks and procedures. |
| Registro | log (`tsk_log`) | Every change, completion and comment, who and when. Kept forever. |

**Tasks and occurrences are separate**: the task holds the rule, each occurrence what happened that time. Changing a
rule never rewrites the past: closed occurrences stay; the future open ones nobody touched are removed and made again.

## Pages

| Page | What |
|---|---|
| **Da fare** `/tasks/todo` | Opens filled (no "Applica": a to-do list, not a report). Groups **Scadute · Oggi · In arrivo · Più avanti** (folded) **· Senza data**, then **Fatte oggi** (to undo). Quick add on top (one line → "Senza data"). Tick = done; "⋯" = done with a note, postpone, in progress, waiting for…, skip (repeating) / cancel (one-time). |
| **Calendario** `/tasks/calendar` | **Week board** (default): on top the coming weeks as small tiles, a tiny bar per day (how much is due, critical ones red; click = that week); what is late in a dock; seven day columns, today wider and with more detail, each with a bar of how full it is. Tick = done; **drag a card onto another day = postpone** (saved as "Rimanda", the original date kept); "+ Aggiungi" on a day = a task on that date; click a card = **side panel** with Fatto, checklist, outcome, comments, instructions, links, contacts. Planned dates of repeating tasks dashed, closed days dimmed. **Month grid**: the same cards in small, drag works too, a day number opens its week. ← → change period, T = today. Phones: the days one under the other. Editable page: *modifica* on it allows ticking, moving and adding. |
| **Attività** `/tasks/list` | All tasks the person sees; filters on screen (text, area, person, state, kind), sortable, Excel. `/tasks/list/new` (also `?copy=ID` = Duplica), `/tasks/list/[id]` task page, `/tasks/list/[id]/edit`. |
| **Procedure** `/tasks/guides` | The library; page with steps, links, contacts, tasks using it, earlier versions (read, put back); "Segna come controllata". |
| **Contatti** `/tasks/contacts` | People and companies; new / change in a window; archive. |
| **Storico** `/tasks/history` | What was closed in a period (loads on "Applica"), outcome, who, late / on time; Excel. |
| Home | A line "N scadute · N per oggi · N in arrivo" linking to Da fare (`src/components/tasks/AgendaSummary.tsx`). |
| Impostazioni → Agenda | **Aree Agenda** (`tsk_areas`) and **Giorni di chiusura** (`tsk_closed_days`), plain settings tables (`RecordTableEditor`). |

**Fits the screen** (the owner's wish: as little scrolling as possible): on desktop no Agenda page scrolls as a whole.
Long parts scroll inside their own box with their titles in view — a day of the week board, each column of Da fare
and of the task / procedure pages (side by side from `xl`), each column of the forms (Salva always visible), the
tables (`DataTable fill`). Closed dates and the log share one box with tabs. Phones: the page scrolls as a whole.

## Repeat rules (`src/lib/tasks/repeat.ts`)

Stored as JSON in `tsk_tasks.repeat_rule` (NULL = one-time), always read through `RepeatRuleSchema` — a new kind of
rule needs no database change. The task's first date (`due_date`) anchors the rule ("every 2 weeks" counts from its week).

- **a calendario** (`mode: 'calendar'`): every N days · every N weeks on chosen weekdays · every N months on day(s) D
  (past a month's end = its last day), on the last day, or on the nth weekday (first Monday, last Friday) · every N
  years on one or more dates. **If missed**: `keep` (stays open until done: nothing lost) or `latest` (a missed date
  becomes *superata* once the next one is visible — a weekly check).
- **dopo l'ultima volta** (`mode: 'after'`): N days / weeks / months / years after the day the last one was done
  (skipped: after its due date). Exactly one open occurrence at a time.
- **end**: never, until a date, after N times.
- **visible from** (`show_days`): how many days before the due date it moves to "In arrivo".

**Closed days** (`src/lib/tasks/closedDays.ts`): weekends (`APP_CONFIG.TASKS.CLOSED_WEEKDAYS`), Italian national
holidays (Easter worked out) and the company's days. A due date is **never moved**: on a closed day the Agenda shows
"meglio entro <working day before>" and lists it under that day.

## How occurrences are made (`src/lib/tasks/series.ts` + `db/series.ts`)

For a repeating task the database always holds every date up to *today + visible-from days*, plus the next one after
that. `refreshSeries()` adds what is missing when Da fare, Calendario, Attività or a task page opens, and after a task
is saved or an occurrence closed. Running it twice changes nothing (one occurrence per task and original date,
`UQ_tsk_occurrences_task_date`), and it writes nothing when nothing is due. New tasks start from the day they are made
(`repeat_from`), so a first date in the past does not create a pile of missed dates; the same after a rule change or resume.

An occurrence nobody touched (no note, tick, move, comment or link — `UNTOUCHED_SQL`) may be removed and made again:
on a rule / date change (future ones), on pause or archive (future ones), on reopen in "after" mode (the next one).

## Who sees what (`visibleTasksSql` in `db/shared.ts`)

Page access as everywhere (*vede* / *modifica* per group). On top, each task has a **responsabile** and a
**visibility**: `private` (responsabile and creator) · `group` (also that group) · `all` (everyone who opens the
Agenda). The superadmin sees everything. People are stored as the login names them: an `app_users` id as text, or
`superadmin`; `system` = the Agenda itself (a missed date replaced). Procedures and contacts are shared by all.

Every write checks the row's version (`row_version`): a save over something changed meanwhile is refused with
"Qualcuno l'ha cambiata nel frattempo" instead of overwriting.

## Code

| Part | Where |
|---|---|
| Pure logic (dates, rules, closed days, groups, planning, projection, weeks, text, form state, checks) | `src/lib/tasks/` (`dates`, `repeat`, `closedDays`, `agenda`, `series`, `projection`, `week`, `describe`, `taskDraft`, `input`, `links`, `types`) |
| Examples on made-up dates | `src/lib/tasks/examples.ts`, `npm run tasks:examples` (part of `npm run check`) |
| All SQL of the module | `src/lib/tasks/db/` (`shared`, `tasks`, `occurrences`, `series`, `views`, `guides`, `contacts`, `settings`) |
| Server actions (each starts with `authorize`) | `src/app/tasks/` (`agenda-actions`, `task-actions`, `guide-actions`, `settings-actions`; answers via `results.ts`) |
| Pages | `src/app/tasks/**/page.tsx` |
| Screens | `src/components/tasks/` (`agenda`, `task`, `form`, `list`, `calendar`, `history`, `guides`, `contacts`, `occurrence`, `shared`) |
| Hooks | `useActionData` (load on open + reload), `useOccurrenceActions`, `useTaskForm`, `useGuideForm`, `useAgendaCalendar` (period, data, moves, panel), `useCalendarDrag` (drag onto a day) |
| Shared UI added | `ActionMenu` ("⋯" menu), `Markdown` + `MarkdownField` (formatted text with preview, `react-markdown`, no raw HTML), `Textarea`; `StatusBadge` tone `danger`; settings editor kinds `date` and `flag`; theme width `w-panel` (side panel) |
| Texts / numbers | `it.ts` → `APP_COPY.tasks`; `constants.ts` → `APP_CONFIG.TASKS` |
| Tables | `sql/tasks/001_create_tables.sql` (run 2026-10-09 with the owner's yes); columns in [DATABASE.md](DATABASE.md) |

A later database change = a new numbered script in `sql/tasks/`, read by the owner and run once by hand.

## Later (the design already allows it)

- Email reminders (`remind_days` is stored) and a warning to the superadmin when a *critica* one is overdue, from `clz-scheduler`.
- Templates ("new employee" = several tasks), sub-tasks (`parent_id`), links to commesse / clients / operators (`link_kind`, `link_code`).
- Tasks made by other parts of the app (`source`): cashflow payments, month-end presence, order deadlines.
- File uploads (a new `tsk_files` table + a folder on the VM), a calendar feed for Outlook, PDF of a procedure.
