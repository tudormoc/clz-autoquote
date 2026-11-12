# CLZ TM

Internal web app of the cooperative: quotes, production progress, analytics, operator presence, cashflow and the owner's Agenda.
Italian UI. **Live in production with real data.**

Stack: Next.js 16 (App Router) + React 19 + TypeScript (strict), Tailwind CSS, three SQL Server databases through `mssql`,
Puppeteer for PDFs, xlsx for Excel.

## Hard rules

1. **The databases are live.** No schema changes and no new write queries without the owner's explicit yes.
   Local `npm run dev` uses the live databases: look, don't save, delete or press "Riallinea".
2. **Read queries** use `WITH (NOLOCK)` and go through `queryMSSQL` in `src/lib/mssql.ts` (never a new connection).
   A write of more than one statement runs inside `withTransactions([...dbs], run => …)` (same file): all of it lands,
   or none of it. Over two databases it is one transaction in each, committed one after the other: a statement that
   fails undoes both, and only a cut exactly between the two commits can leave the first written and the second not
   (docs/ORDER_PROCESS.md → "Two databases, two commits"). Query rules, commessa formats and tables:
   [docs/DATABASE.md](docs/DATABASE.md).
3. **Deploy only when the owner asks.** Secrets stay in `.env.local` (never committed).
4. **Every page and every server action checks access** (see Login below). A new page calls `requirePage(...)`,
   a new server action starts with `await authorize('view' | 'edit', '<menu link>')` or `await requireSuperadmin()`
   (`superadminRefusal()` where it answers `{ success: false, error }`): nothing that was sent is looked at before it.
   `npm run access:check` (part of `npm run check`) reads the source and fails when one is missing or comes late. A page is
   always named through `LINKS` (`src/config/navigation.ts`), never by a literal link: the check refuses that too.

## Working with the owner

Short answers in plain words. Read the existing code first and follow its patterns. Explain the plan in a few lines
before a big change; ask when something is unclear instead of guessing; one topic at a time. Suggest improvements,
but don't implement them without a yes.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000 (live databases!)
npm run check      # typecheck + lint + access check + example checks + production build — run before every deploy
npm run access:check        # every page and server action checks access, an action first of all; every list of a schema has a maximum (scripts/access-check.ts)
npm run presence:examples   # presence rules on made-up data
npm run orders:examples     # order rules on made-up orders: comparison with the DiBa, what Riallinea changes, leaves or refuses
npm run format:examples     # number / money / hours / date formatting
npm run excel:examples      # Excel export
npm run tasks:examples      # Agenda date rules (repeats, closed days, to-do groups)
npm run persons:examples    # Scheda persona name rules (same name, capitals, cognome / nome split)
npm run permissions:examples # who sees what: stored grants, the lights of Gruppi, the wrong-PIN wait, quick group ticks in Utenti
npm run dates:examples      # date arithmetic (src/lib/dateUtils.ts) and the ready-made periods of the date filters
npm run timesheet:examples  # Le mie ore: what a day adds up to, what the editor accepts, the half-hour steps
npm run inputs:examples     # what the forms accept and refuse (Agenda, Operatori, quote): run before and after a Zod update
npm run address:examples    # what a screen keeps in the address bar (tab, sort, page, chips, applied filters)
npm run errors:examples     # what a screen says when something fails: the app's own texts, a plain sentence for a technical failure
npm run order:snapshot -- 260999910 before   # read-only snapshot of one commessa in Business and NetPro, diffed with the previous one
```

## Deployment

- Dev: this PC. Prod: VM `192.168.1.93:3000`, folder `C:\tm\clz-autoquote`, run by PM2 (`ecosystem.config.js`):
  `clz-autoquote` (the app) and `clz-scheduler` (daily auto-exit, `scripts/scheduler.js`: it reads the app's answer
  and calls again after a run that failed or left exits unwritten, [docs/PRESENCE.md](docs/PRESENCE.md)).
- Deploy: commit and push to `main` (`gitsync.bat "message"`: it runs `npm run check` first and pushes nothing when
  it fails, and asks before pushing files Git has never seen), then run `update.ps1` on the VM (pull, install, build,
  restart). `update.ps1` checks every step and restarts PM2 only on a build that finished; a failed build is replaced
  by the one before (kept in `C:\tm\clz-autoquote-last-build`), with its code and packages, so the app keeps running.
  The build downloads the two fonts (Inter, JetBrains Mono, `src/app/layout.tsx`) from Google, so the VM needs internet while
  building; the running app serves them itself.
- Presence Excel files: `\\SERVER2019\Office\…`, with `Z:\` as fallback on the VM.

- `.env.local` on the VM needs the login keys too (`AUTH_SECRET`, `SUPERADMIN_NAME`, `SUPERADMIN_PIN`, see `.env.example`).
  `AUTH_SECRET` must be **the same as on this PC**: both use the same database and it scrambles the users' PINs.

## Login

- Everyone logs in with a **name and PIN** (`/login`); the login ends when the browser closes, at the latest after
  `APP_CONFIG.AUTH.SESSION_HOURS`. After 5 wrong PINs a name waits, on that computer only: 5 minutes, then 15, an hour,
  4 hours, a day when it happens again (`src/lib/auth/lockout.ts`; 30 wrong PINs for one name from several computers
  make it wait everywhere). A user who is waiting has a lock at the start of their row in Utenti: a click takes the
  wait away. A restart of the app clears every wait.
- **Superadmin** (the owner): name + PIN from `.env.local`, not in the database; sees everything and alone manages
  Impostazioni → Accessi → **Utenti** and **Gruppi** and Esplora Database: giving pages and reading PINs cannot be handed
  to a group (owner, 2026-11-05). The Registro is a page given in Gruppi like any other: who opens it finds the history
  of the pages they can open.
- **Users** (`app_users`): name, PIN (stored encrypted, readable by the superadmin), groups, last login, *sospeso*
  (cannot log in, an open login ends at once; PIN and groups stay). A PIN given out from Utenti (new user, "Nuovo PIN a
  caso", a typed one) shows there as *provvisorio* (`must_change_pin`) until the person changes it with "Cambia PIN"
  in the sidebar, which they may or may not do. "Nuovo utente" gives a 4-digit PIN; the dice next to a PIN rolls a new one of the chosen kind
  (`APP_CONFIG.AUTH.PIN_KINDS`: 4 or 6 digits, 8 letters and digits, 16 characters with symbols) as a proposal in a
  window: roll again until you like it, "Copia", then "Salva" writes it; "Annulla" leaves the old PIN as it is.
- **Scheda persona** (Utenti → Persona): a login is linked to the same person's records elsewhere (`operator_code`,
  `netpro_user`, `erp_user` in `app_users`), and the card shows every record and fact side by side, read live from
  NetPro, Business and ARCPROC (`src/lib/persons/places.ts`, `src/app/person-actions.ts`); a "≠" on the user in Utenti
  says how many facts differ. The card is laid out like the order comparison (one row per fact, a column per place,
  "Allineato" at the end, the shared `AlignmentCell`). "Allinea e-mail" writes one address into the three places that
  may be written (NetPro login, Business login, org chart), one transaction; the mailbox account is only shown and the
  e-mail signatures are left out. "Allinea nome" writes one name in capitals into the five places that hold it (cognome
  and nome apart in the Business login and the org chart); the name counts as the same only when the text is the same.
  Nothing else of NetPro or Business is written from here. Where each place is:
  [docs/DATABASE.md](docs/DATABASE.md) → People. **Groups** (`app_groups`): name and, per menu page, *vede* or *modifica*, stored under the page's id (not
  its link, so a page can move to another area and keep its grants). Utenti is one table of all
  users (a tick column per group); Gruppi works on one group at a time, picked from its cards: a row per area that opens to its
  pages, and on every row the same control, a light that is on or off (Vede, Modifica where the page changes data;
  a page's function is a named light). An area row and "Tutte le pagine" switch a light for all their
  pages, Niente / Solo lettura / Tutto set a whole group, "Annulla" takes the last click back, a search box finds a
  page. How a click becomes grants: `src/lib/auth/lights.ts`.
- A person sees only their pages: menu, home and overview pages are filtered (`src/lib/auth/permissions.ts`), edit
  buttons and click-to-edit cells hide without *modifica* (`useCanEdit()`). The protection itself is on the server:
  `src/proxy.ts` (logged in?), `requirePage` in each page, `authorize` / `requireSuperadmin` in each server action
  (`src/lib/auth/access.ts`). A page that changes data has `editable` in the menu config; Utenti / Gruppi / Database
  have `superadminOnly`.
- `/api/auto-exit` accepts only the scheduler (a key derived from `AUTH_SECRET`, `scripts/scheduler.js`), whose call
  alone writes, or the superadmin, who always gets the preview of what it would do.
- **Who sees what, in practice.** A module is an area of the menu; a group gets it in Gruppi with one click on the
  area's row (*vede* or *modifica*), or page by page below it; "Tutte le pagine" gives everything. A person gets the
  pages of all their groups (tick columns in Utenti). To take the app away from someone: the *attivo* switch in Utenti
  (sospeso) — or delete them. A new page or report added to `NAV_AREAS` is in Gruppi at once, nothing else to do; until
  a group is given it, nobody but the superadmin can open it.
- **Functions of a page** (today: Riallinea on Avanzamento Lavori, "Crea ed elimina operatori" on Operatori, "Tutto il registro" on
  the Registro) are given apart in Gruppi, each a named light on the page's row, switched one by one, never by an area
  row or a preset. A function counts only together with the highest level of its page (*modifica*, or *vede* on a page
  that changes no data, like the Registro): switching it on in Gruppi gives the page that level too, and taking the
  level away switches it off. To add one: `functions: [{ href: functionHref('/page', 'name'), ...APP_COPY.nav.functions.name }]`
  on the page in `NAV_AREAS`, `await authorize('edit', <that href>)` in its server action after the page check, and
  `useCanUse(<that href>)` to hide its button.
- **Whose history the Registro shows** (`src/lib/log/areas.ts`; owner, 2026-11-06: one option, no light per page): who
  can open the Registro page sees there what was done on the pages they can open, nothing else. "Tutto il registro"
  shows every page a group can be given. Logins and the entries of Utenti, Gruppi and Database are the superadmin's alone.

## Where things are

| What | Where |
|---|---|
| Pages | `src/app/<area>/page.tsx`; every page sits in the one frame drawn by the root layout (`src/app/layout.tsx`) |
| Server actions (DB access) | `src/app/**/*-actions.ts`, analytics queries in `src/app/analytics/queries/` |
| All UI text | `src/locales/it.ts` → `APP_COPY` |
| Numbers and settings | `src/config/constants.ts` → `APP_CONFIG`, `PRICING_FORMULAS`, `PRESENCE_RULES`; the hour of the daily automatic exit and how often it is tried again: `src/config/schedule.json`, read by the scheduler too |
| Look: colours, font sizes, radius, shadows, layout sizes | `src/styles/theme.js` |
| Areas and their pages: sidebar, phone menu, home cards, area overview pages | `src/config/navigation.ts` (`NAV_AREAS`) |
| Analytics report list / their components | `src/config/analyticsSections.ts` / `src/components/analytics/reportComponents.ts` |
| Settings pages / their screens / what they may change | `src/config/settingsPages.ts` / `src/components/admin/settingsComponents.ts` (table editors in `recordTables.tsx`; pages `/settings/<id>`) / `src/config/editableTables.ts` |
| Page frame, title, sidebar | `src/components/layout/` (`AppShell`, `PageHeader`, `FillPage`, `AreaOverview`, `NavCards`, `MobileMenu`, `sidebar/`); folded sidebar state `src/lib/sidebar.ts` |
| Shared UI parts | `src/components/ui/` |
| Display formats (money, numbers, hours, dates, months) | `src/lib/format.ts`; date strings, today, the ready-made periods of the date filters (`periodRange`; every filter opens on today, `defaultReportPeriod`) and ALL date arithmetic (day of the week, a date plus days or months, the days of a range or a month, first and last day of a month, the Monday of a week): `src/lib/dateUtils.ts`, the one place for it, with `npm run dates:examples` |
| Excel / file downloads | `src/lib/excel.ts` / `src/lib/download.ts` |
| What a screen shows, kept in the address bar (rule 8): view values (tab, sort, page, chips, the record, month or day shown) / the applied filters of a list | `src/lib/address.ts` (pure: one `…Param` per kind of value, `readFilters` / `writeFilters`) + `src/hooks/useAddress.ts` (`useAddress(shape)` → `values`, `set`, `link`) / `src/hooks/useAppliedFilters.ts`; real links to another view of the same page: `src/components/ui/ViewLink.tsx` |
| Report state (filters, paging, sorting, export; a page opened bare loads only on "Applica", an address with filters loads at once) | `src/hooks/useReportTable.ts` |
| State of a screen that reads everything in one go for its applied filters (a year, a month) / of a list of rows (presence pages) / on-screen sorting | `src/hooks/useAppliedQuery.ts` / `src/hooks/useListQuery.ts` / `src/hooks/useClientSort.ts` (`src/lib/sort.ts`) |
| Quote pricing / saved quotes | `src/lib/pricing/` — [docs/PRICING.md](docs/PRICING.md) / `src/lib/quotes/db.ts` |
| Presence rules / data | `src/lib/presence/` — [docs/PRESENCE.md](docs/PRESENCE.md) / `src/app/presence/*-actions.ts` (events, operators, hours, settings; auto-exit in `auto-exit.ts`; shared queries in `presence-db.ts`) |
| Ore Studio Paghe (a month's hours per person for the pay studio: production from the monthly Excel files, the office from the timesheet) | `src/lib/payroll.ts` (pure, the file's columns), `src/app/analytics/queries/payroll-queries.ts` + `queries/shared/presence-files.ts` (the files, shared with Presenze Annuali; read by column position, so a file whose header row does not show the expected title at a column read is refused: `src/lib/excelLayout.ts`, titles in `APP_CONFIG.…EXCEL_HEADERS`), `src/components/analytics/PayrollHoursReport.tsx` |
| Timesheet (Le mie ore, Ore Ufficio: the office people's own hours, entrate / uscite and absences, exported for the studio) | `src/lib/timesheet/` (pure) + `src/lib/timesheet/db/` (its SQL), actions `src/app/presence/timesheet-actions.ts`, screens `src/components/timesheet/`, tables `sql/timesheet/` — [docs/TIMESHEET.md](docs/TIMESHEET.md) |
| Login, users, groups, access checks | `src/lib/auth/` (`access`, `permissions`, `lights` = how the Gruppi page turns clicks into grants, `accounts`, `session`, `secrets`, `lockout`), `src/proxy.ts`, `src/app/auth-actions.ts`, `src/app/access-actions.ts`, `src/components/auth/`, `src/components/admin/access/` |
| Registro (the app-wide log: who did what and when, with the values before and after) | `src/lib/log/` (`log` writes: `logEvent`, never throws; `entries` reads the three logs as one list; `areas` = whose entries a person sees; `describe` turns a record into lines), actions `src/app/log-actions.ts`, screen `src/components/log/`, table `sql/log/` — a server action that writes calls `logEvent(personOf(access), { page: LINKS.…, action, summary, details })` |
| PDF reports | `src/app/analytics/pdf-actions.ts` (data) + `src/lib/pdf/`: one `*Html.ts` per report on the shared `html.ts` (document, title block, escaping, `percent`) and `theme.ts` (print colours), printed by `renderPdfBase64` |
| Orders: search, details, DiBa comparison, realign (DiBa → Business → NetPro), list of the open orders to realign | `src/lib/orders/` (`details`, `management`, `sync`, `compare`, `flow`, `syncRows`; `dibaData` = the one read of the DiBa, for the page and for Riallinea; `documentFacts` + `documentRows`, `quantities` + `quantityData`, `article` + `articleData` for the Quantità and Articolo tabs; `differences` = what differs by kind, `syncBlocks` = what a realign leaves on the order because it was already used, and when it is refused, `misaligned` = "Ordini da riallineare"); server actions `src/app/analytics/queries/order-operations-queries.ts` — [docs/ORDER_PROCESS.md](docs/ORDER_PROCESS.md) |
| Cashflow | [docs/CASHFLOW.md](docs/CASHFLOW.md); the monthly table is one `MatrixRow` per line (`src/components/cashflow/`) |
| Work progress page (order flow, DiBa comparison, orders to realign) | `src/components/analytics/OrderOperationsReport.tsx` + `order-operations/`; logic in `src/hooks/useOrderSearch.ts`, `useOrderManagement.ts`, `useMisalignedOrders.ts`, `src/lib/orders/`; what is on screen (search, list, the open order, its tabs and edition) is in the address: `src/hooks/useOrderAddress.ts`, e.g. `/work-progress?order=2609537&tab=management&view=quantity` |
| Database page (Settings → Strumenti) | `src/components/database/` + `src/hooks/useDatabaseExplorer.ts`, queries in `src/app/db-actions.ts` |
| Agenda (tasks, deadlines, procedures, contacts) | `src/lib/tasks/` (rules, pure) + `src/lib/tasks/db/` (all its SQL), actions `src/app/tasks/*-actions.ts`, screens `src/components/tasks/`, tables `sql/tasks/` — [docs/TASKS.md](docs/TASKS.md) |

## Design system

The whole look is defined in `src/styles/theme.js`; `tailwind.config.js` turns it into CSS variables and classes.
Restyle the app by editing that file only. Tailwind's own palette is switched off, and ESLint fails on raw colour
classes and `text-[Npx]`, so a component can only use tokens.

**Two looks, light (default) and dark.** The light values sit on `:root`, the dark ones under `<html data-theme="dark">`;
the choice is the `clz_theme` cookie (`src/lib/theme.ts`), read by the root layout so the first paint is already right, and
switched by the Sun / Moon row at the foot of the sidebar (`ThemeProvider`). A component never knows which look is on:
it names the dark shade (`text-success-400`, `bg-danger-950/40`) and the light look mirrors it (`LIGHT_SHADE` in
`theme.js`: text shades get deep, tints get pale, fills stay bright). Text on a fill: `text-fg-inverse` on success /
warning / danger fills, `text-primary-foreground` on `bg-primary`; `bg-bright` is white in both looks (a switch's knob).

- Surfaces: `bg-background` (page) · `bg-card` (panels) · `bg-muted` (controls, hover) · `bg-muted-strong` · `bg-overlay/60`
- Lines: `border-border` · `border-border-strong`
- Text: `text-fg-strong` · `text-fg` · `text-fg-soft` · `text-fg-secondary` · `text-fg-muted` · `text-fg-subtle` · `text-fg-faint` · `text-fg-inverse`
- Status (scale 50–950, default 500): `primary`, `success`, `warning`, `danger`, `info`, `highlight` — e.g. `text-success-400`, `bg-danger/10`, `border-warning-500/30`
- Small text: `text-2xs` (11px), `text-3xs` (10px, the smallest). Layout: `w-sidebar`, `w-sidebar-collapsed`, `min-w-matrix`; `collapsed:` styles the folded sidebar
- No uppercase labels, monospace only for numbers, shadows only on floating elements.
- Phones: below `lg` the sidebar is a slide-in menu and the page scrolls as a whole; `DataTable` shows one card per row
  below `md` (`DataCards`, column options `mobileHidden` / `mobileLabel`, table options `mobileTitle` / `mobileFooter`),
  `FilterPanel` folds into a "Filtri" bar after "Applica". Form fields are 16px on phones (globals.css), so tapping one does not zoom.
- Exports are named after the report's menu label (`APP_COPY.analytics.reports`): `reportFileName()` in `src/lib/download.ts`.

Shared parts to use before writing new markup: `Button` (+ `buttonClasses()` for links), `Input`, `Select`, `Checkbox`, `Switch`,
`DatePicker`, `Card`, `EmptyState`, `Field`, `SearchField`, `DateRangeFields`, `FilterPanel` (+ `ToggleChips` rows),
`Pagination` / `RecordCount`, `DataTable` (+ `Table` primitives, `StackedCell`, `TagCell`, `MissingValue`, footer totals;
`fill` inside a `FillPage` = takes the free height, header and totals stay in view; `rowLink` = a row that is the link to a view (a click anywhere on it, the middle button for a new tab),
`rowDetail` = more about a row unfolded under it, `dense` = lower rows, `scrollResetKey` for a list that replaces a row in place), `CardField` (a line of a phone card),
`EditableCell` (click-to-edit cell), `StatusBadge`, `ChoiceButton`, `TabBar` (tabs as links with `linkOf`), `ViewLink` (a link to another view of the same page), `Section` + `RowList`/`Row` (blocks of a settings page),
`Spinner`, `LoadState` (spinner or load error while a screen's data is not there yet), `Modal` (every popup window), `ExportExcelButton`.
Messages: `notify.success / error / failure(err)` (`src/lib/notify.ts`) and `await confirmDelete(text)` / `askConfirm({…})`
(`src/lib/confirm.ts`) — never `alert()` or `confirm()`. Text of a caught error for the screen: `errorMessage(err)` (`src/lib/utils.ts`), never `err: any` or `err.message`:
an error the app raised says its own text, a technical failure (database, network, file, a fault in the code) says a plain
sentence of `it.ts` → `errors.faults` and its cause goes to the log. For a log, the Registro or the scheduler:
`technicalMessage(err)`. A fault of the setup or the code is thrown as `new AppFault(…)`, never as a text for the person.

## Rules for new code

1. **Reuse before writing**: look in `src/components/ui`, `src/components/layout`, `src/lib`, `src/hooks` first.
2. **Never copy**: logic, markup or text needed twice goes into one shared helper, hook or component.
3. **Nothing hardcoded**: texts in `it.ts`, numbers in `constants.ts`, look in `theme.js`, formats through `format.ts`.
4. **Small parts**: a component past ~400 lines is split (logic into hooks or `src/lib`, UI into components). One component per file.
5. **Strict TypeScript**, Zod at data boundaries. Every list of a schema has a maximum (`z.array(…).max(n)`): a longer
   one is then refused at once instead of being checked element by element; `npm run access:check` fails without it.
   Remove unused code, imports and files as you go.
6. **Before calling it done**: `npm run check` passes and the change is checked in the browser.
7. **Every write is logged**: a server action that changes data ends with `await logEvent(personOf(access), { page: LINKS.…,
   action, entityKind, entityId, summary, details: { before, after } })` (`src/lib/log/log.ts`; the line's text in `it.ts` →
   `log.entries`). The Agenda and the timesheet keep their own logs; the Registro page shows all three. A PIN is never logged.
8. **The address bar says what the screen shows** (owner, 2026-11-06), so a link, a refresh, Back / Forward, a new tab
   (middle-click, Ctrl+click) and "copy link" all work as on any website:
   - *In the address*: everything that says WHAT is looked at — which order, quote, group, person, database table, day
     or month; which tab; the applied filters, sort and page; the chips switched on; the text of a search box that
     filters as one types. *Not in the address*: what is not applied or not saved yet (a form, filters before "Applica").
   - *History*: opening something, another tab and "Applica" add a step (Back returns to the view before); sorting,
     paging, chips and unfolding a row in place stay on the same step.
   - *Links*: whatever opens a view is a real link — a Next `<Link>` to another page, a `ViewLink` (or `TabBar` with
     `linkOf`) to another view of the same page — never a click handler that navigates. `buttonClasses()` gives a link
     the look of a button, `choiceClasses()` that of a `ChoiceButton`. A table row that opens something: `rowLink` of
     `DataTable`, with the same link as a `ViewLink` in its main cell. Something that opens in another tab (a PDF):
     `<a href target="_blank">`, not `window.open`.
   - *Loading*: a list opened bare still waits for "Applica"; an address that carries filters loads at once.
   - *Opening a link only shows*: it never writes or runs an action (Riallinea, a save, a delete stay a deliberate click).
   - *How*: `useAddress(SHAPE)` with one `…Param` per value (`src/lib/address.ts`), or `useReportTable` / `useListQuery` /
     `useAppliedQuery` for filters; a search box that filters as one types goes through `useAddressText` (the Agenda's
     text / area / person filters: `useTaskFilters`); never `useState` for such a value, never `history.pushState` by
     hand. A new kind of value gets its `…Param` and an example in `scripts/address-examples.ts`.

## Recipes

**New page**: the frame (sidebar, phone menu, padding) comes from the root layout — the page starts with
`await requirePage('<area>', '<page id>')`, renders `<PageHeader icon title />` and its content, and exports
`metadata = { title }` for the browser tab. Its server actions start with `await authorize(...)`; a page that changes
data gets `editable: true` in the menu config, so groups can be given *modifica* on it. A page that
fills the height uses `h-full`. Add the link to `NAV_AREAS` in `src/config/navigation.ts` (a new area, or a page in an
area's `groups`); the sidebar, the phone menu and the overview cards follow. What the page shows (the record open, the
tab, the filters) goes in its address, rule 8: `const view = useAddress(VIEW)` with `VIEW = { tab: choiceParam(TABS, 'first') }`
as a module constant, `view.values.tab` to read, `view.link({ tab })` for a `ViewLink` / `TabBar`, `view.set({ … }, 'replace')`
for what stays on the same history step.

**Move or rename a page**: move its folder under `src/app`, change its link in `LINKS` (and its area in `NAV_AREAS`);
every check and link follows, since nothing names a page by a literal link. Keep the page's `id`: the groups' grants are
stored under it. If the link itself changes, add the old link to `RENAMED_LINKS` in `src/lib/auth/permissions.ts` so a
link stored by an old group still counts, and a redirect to `next.config.mjs` for bookmarks. Run `npm run check`.

**New analytics report**:
1. Query in its own file `src/app/analytics/queries/<report>-queries.ts`, using the shared parts in `queries/shared/`
   (`netpro-work.ts` for NetPro work time, `business-report.ts` when revenue or costs are involved, `query-utils.ts` for
   paging, sorting and `failedPage`); re-export it from `analytics-actions.ts`.
2. Entry in `src/config/analyticsSections.ts`, label and description in `it.ts`.
3. Component built with `useReportTable` + `ReportView`: copy `src/components/analytics/ClientDeliveriesReport.tsx` and
   change the row type, filters, columns and Excel columns. Register it in `reportComponents.ts`. Filters, sort and
   page are kept in the address by `useReportTable` itself: a filter is text, a number, yes / no or a list of texts.

**New settings table**: a config in `src/components/admin/recordTables.tsx` (columns, how each value is typed and shown, what a
new row starts with; the editor, saving through `src/app/admin-actions.ts`, comes from `RecordTableEditor`), then one entry in
`SETTINGS_COMPONENTS` (`src/components/admin/settingsComponents.ts`) and one in `SETTINGS_PAGES` (`src/config/settingsPages.ts`,
in the group of the area it belongs to; texts in `it.ts` → `admin.pages`); the sidebar and the `/settings/<id>` page follow. The table and the columns it may
change or create go in `src/config/editableTables.ts`: the server refuses every other table or column.

**New pricing operation / presence rule**: see [docs/PRICING.md](docs/PRICING.md) and [docs/PRESENCE.md](docs/PRESENCE.md).

## Other docs

[docs/GLOSSARY.md](docs/GLOSSARY.md) (Italian terms) · [docs/BACKLOG.md](docs/BACKLOG.md) (planned work) ·
[docs/SERVER2019_DISK_SPACE.md](docs/SERVER2019_DISK_SPACE.md) (file server notes)
