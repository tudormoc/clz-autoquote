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
   or none of it. Query rules, commessa formats and tables: [docs/DATABASE.md](docs/DATABASE.md).
3. **Deploy only when the owner asks.** Secrets stay in `.env.local` (never committed).
4. **Every page and every server action checks access** (see Login below). A new page calls `requirePage(...)`,
   a new server action starts with `await authorize('view' | 'edit', '<menu link>')` or `await requireSuperadmin()`.
   `npm run access:check` (part of `npm run check`) reads the source and fails when one is missing. A page is
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
npm run access:check        # every page and server action checks access (scripts/access-check.ts)
npm run presence:examples   # presence rules on made-up data
npm run format:examples     # number / money / hours / date formatting
npm run excel:examples      # Excel export
npm run tasks:examples      # Agenda date rules (repeats, closed days, to-do groups)
```

## Deployment

- Dev: this PC. Prod: VM `192.168.1.93:3000`, folder `C:\tm\clz-autoquote`, run by PM2 (`ecosystem.config.js`):
  `clz-autoquote` (the app) and `clz-scheduler` (daily auto-exit, `scripts/scheduler.js`).
- Deploy: commit and push to `main` (`gitsync.bat "message"`), then run `update.ps1` on the VM (pull, install, build, restart).
  The build downloads the two fonts (Inter, JetBrains Mono, `src/app/layout.tsx`) from Google, so the VM needs internet while
  building; the running app serves them itself.
- Presence Excel files: `\\SERVER2019\Office\…`, with `Z:\` as fallback on the VM.

- `.env.local` on the VM needs the login keys too (`AUTH_SECRET`, `SUPERADMIN_NAME`, `SUPERADMIN_PIN`, see `.env.example`).
  `AUTH_SECRET` must be **the same as on this PC**: both use the same database and it scrambles the users' PINs.

## Login

- Everyone logs in with a **name and PIN** (`/login`); the login ends when the browser closes, at the latest after
  `APP_CONFIG.AUTH.SESSION_HOURS`. After 5 wrong PINs a name waits 5 minutes.
- **Superadmin** (the owner): name + PIN from `.env.local`, not in the database; sees everything and manages
  Impostazioni → Accessi → **Utenti** and **Gruppi** and Esplora Database.
- **Users** (`app_users`): name, PIN (stored encrypted, readable by the superadmin; new users get a random PIN, they can
  change it with "Cambia PIN"), groups, last login, *sospeso* (cannot log in, an open login ends at once; PIN and
  groups stay). **Groups** (`app_groups`): name and, per menu page, *vede* or *modifica*, stored under the page's id (not
  its link, so a page can move to another area and keep its grants). Utenti is one table of all
  users (a tick column per group); Gruppi is one table of all groups (a column each, a row per area that opens to its
  pages and functions; each cell is No | Vede | Modifica, with Modifica only where the page changes data; a search box
  finds a page).
- A person sees only their pages: menu, home and overview pages are filtered (`src/lib/auth/permissions.ts`), edit
  buttons and click-to-edit cells hide without *modifica* (`useCanEdit()`). The protection itself is on the server:
  `src/proxy.ts` (logged in?), `requirePage` in each page, `authorize` / `requireSuperadmin` in each server action
  (`src/lib/auth/access.ts`). A page that changes data has `editable` in the menu config; Utenti / Gruppi / Database
  have `superadminOnly`.
- `/api/auto-exit` accepts only the scheduler (a key derived from `AUTH_SECRET`, `scripts/scheduler.js`) or the superadmin.
- **Who sees what, in practice.** A module is an area of the menu; a group gets it in Gruppi with one click on the
  area's row (*vede* or *modifica*), or page by page below it; "Tutte le pagine" gives everything. A person gets the
  pages of all their groups (tick columns in Utenti). To take the app away from someone: the *attivo* switch in Utenti
  (sospeso) — or delete them. A new page or report added to `NAV_AREAS` is in Gruppi at once, nothing else to do; until
  a group is given it, nobody but the superadmin can open it.
- **Functions of a page** (today: Riallinea on Avanzamento Lavori, "Crea ed elimina operatori" on Operatori) are given apart, Sì or No, as an indented row under
  the page in Gruppi; the area and "Tutte le pagine" rows never switch them on. A function counts only together with
  *modifica* on its page. To add one: `functions: [{ href: functionHref('/page', 'name'), ...APP_COPY.nav.functions.name }]`
  on the page in `NAV_AREAS`, `await authorize('edit', <that href>)` in its server action after the page check, and
  `useCanUse(<that href>)` to hide its button.

## Where things are

| What | Where |
|---|---|
| Pages | `src/app/<area>/page.tsx`; every page sits in the one frame drawn by the root layout (`src/app/layout.tsx`) |
| Server actions (DB access) | `src/app/**/*-actions.ts`, analytics queries in `src/app/analytics/queries/` |
| All UI text | `src/locales/it.ts` → `APP_COPY` |
| Numbers and settings | `src/config/constants.ts` → `APP_CONFIG`, `PRICING_FORMULAS`, `PRESENCE_RULES` |
| Look: colours, font sizes, radius, shadows, layout sizes | `src/styles/theme.js` |
| Areas and their pages: sidebar, phone menu, home cards, area overview pages | `src/config/navigation.ts` (`NAV_AREAS`) |
| Analytics report list / their components | `src/config/analyticsSections.ts` / `src/components/analytics/reportComponents.ts` |
| Settings pages / their screens / what they may change | `src/config/settingsPages.ts` / `src/components/admin/settingsComponents.ts` (table editors in `recordTables.tsx`; pages `/settings/<id>`) / `src/config/editableTables.ts` |
| Page frame, title, sidebar | `src/components/layout/` (`AppShell`, `PageHeader`, `FillPage`, `AreaOverview`, `NavCards`, `MobileMenu`, `sidebar/`); folded sidebar state `src/lib/sidebar.ts` |
| Shared UI parts | `src/components/ui/` |
| Display formats (money, numbers, hours, dates, months) | `src/lib/format.ts`; date strings, today, the ready-made periods of the date filters (`periodRange`; every filter opens on today, `defaultReportPeriod`) `src/lib/dateUtils.ts` |
| Excel / file downloads | `src/lib/excel.ts` / `src/lib/download.ts` |
| Report state (filters, paging, sorting, export; loads only on "Applica", filters remembered in the address bar via `src/lib/urlFilters.ts`) | `src/hooks/useReportTable.ts` |
| List state for lists that load all rows (presence pages) / on-screen sorting | `src/hooks/useListQuery.ts` / `src/hooks/useClientSort.ts` (`src/lib/sort.ts`) |
| Quote pricing / saved quotes | `src/lib/pricing/` — [docs/PRICING.md](docs/PRICING.md) / `src/lib/quotes/db.ts` |
| Presence rules / data | `src/lib/presence/` — [docs/PRESENCE.md](docs/PRESENCE.md) / `src/app/presence/*-actions.ts` (events, operators, hours, settings; auto-exit in `auto-exit.ts`; shared queries in `presence-db.ts`) |
| Login, users, groups, access checks | `src/lib/auth/` (`access`, `permissions`, `accounts`, `session`, `secrets`, `lockout`), `src/proxy.ts`, `src/app/auth-actions.ts`, `src/app/access-actions.ts`, `src/components/auth/`, `src/components/admin/access/` |
| PDF reports | `src/app/analytics/pdf-actions.ts` (data) + `src/lib/pdf/`: one `*Html.ts` per report on the shared `html.ts` (document, title block, escaping, `percent`) and `theme.ts` (print colours), printed by `renderPdfBase64` |
| Orders: search, details, DiBa comparison, realign (DiBa → Business → NetPro) | `src/lib/orders/` (`details`, `management`, `sync`, `compare`, `flow`, `syncRows`); server actions `src/app/analytics/queries/order-operations-queries.ts` — [docs/ORDER_PROCESS.md](docs/ORDER_PROCESS.md) |
| Cashflow | [docs/CASHFLOW.md](docs/CASHFLOW.md); the monthly table is one `MatrixRow` per line (`src/components/cashflow/`) |
| Work progress page (order flow, DiBa comparison) | `src/components/analytics/OrderOperationsReport.tsx` + `order-operations/`; logic in `src/hooks/useOrderSearch.ts`, `useOrderManagement.ts`, `src/lib/orders/` |
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
`fill` inside a `FillPage` = takes the free height, header and totals stay in view), `CardField` (a line of a phone card),
`EditableCell` (click-to-edit cell), `StatusBadge`, `ChoiceButton`, `TabBar`, `Section` + `RowList`/`Row` (blocks of a settings page),
`Spinner`, `LoadState` (spinner or load error while a screen's data is not there yet), `Modal` (every popup window), `ExportExcelButton`.
Messages: `notify.success / error / failure(err)` (`src/lib/notify.ts`) and `await confirmDelete(text)` / `askConfirm({…})`
(`src/lib/confirm.ts`) — never `alert()` or `confirm()`. Text of a caught error: `errorMessage(err)` (`src/lib/utils.ts`), never `err: any`.

## Rules for new code

1. **Reuse before writing**: look in `src/components/ui`, `src/components/layout`, `src/lib`, `src/hooks` first.
2. **Never copy**: logic, markup or text needed twice goes into one shared helper, hook or component.
3. **Nothing hardcoded**: texts in `it.ts`, numbers in `constants.ts`, look in `theme.js`, formats through `format.ts`.
4. **Small parts**: a component past ~400 lines is split (logic into hooks or `src/lib`, UI into components). One component per file.
5. **Strict TypeScript**, Zod at data boundaries. Remove unused code, imports and files as you go.
6. **Before calling it done**: `npm run check` passes and the change is checked in the browser.

## Recipes

**New page**: the frame (sidebar, phone menu, padding) comes from the root layout — the page starts with
`await requirePage('<area>', '<page id>')`, renders `<PageHeader icon title subtitle />` and its content, and exports
`metadata = { title }` for the browser tab. Its server actions start with `await authorize(...)`; a page that changes
data gets `editable: true` in the menu config, so groups can be given *modifica* on it. A page that
fills the height uses `h-full`. Add the link to `NAV_AREAS` in `src/config/navigation.ts` (a new area, or a page in an
area's `groups`); the sidebar, the phone menu and the overview cards follow.

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
   change the row type, filters, columns and Excel columns. Register it in `reportComponents.ts`.

**New settings table**: a config in `src/components/admin/recordTables.tsx` (columns, how each value is typed and shown, what a
new row starts with; the editor, saving through `src/app/admin-actions.ts`, comes from `RecordTableEditor`), then one entry in
`SETTINGS_COMPONENTS` (`src/components/admin/settingsComponents.ts`) and one in `SETTINGS_PAGES` (`src/config/settingsPages.ts`,
in the group of the area it belongs to; texts in `it.ts` → `admin.pages`); the sidebar and the `/settings/<id>` page follow. The table and the columns it may
change or create go in `src/config/editableTables.ts`: the server refuses every other table or column.

**New pricing operation / presence rule**: see [docs/PRICING.md](docs/PRICING.md) and [docs/PRESENCE.md](docs/PRESENCE.md).

## Other docs

[docs/GLOSSARY.md](docs/GLOSSARY.md) (Italian terms) · [docs/BACKLOG.md](docs/BACKLOG.md) (planned work) ·
[docs/SERVER2019_DISK_SPACE.md](docs/SERVER2019_DISK_SPACE.md) (file server notes)
