# CLZ TM

Internal web app of the cooperative: quotes, production progress, analytics, operator presence and cashflow.
Italian UI. **Live in production with real data.**

Stack: Next.js 16 (App Router) + React 19 + TypeScript (strict), Tailwind CSS, three SQL Server databases through `mssql`,
Puppeteer for PDFs, xlsx for Excel.

## Hard rules

1. **The databases are live.** No schema changes and no new write queries without the owner's explicit yes.
   Local `npm run dev` uses the live databases: look, don't save, delete or press "Riallinea".
2. **Read queries** use `WITH (NOLOCK)` and go through `queryMSSQL` in `src/lib/mssql.ts` (never a new connection).
   Query rules, commessa formats and tables: [docs/DATABASE.md](docs/DATABASE.md).
3. **Deploy only when the owner asks.** Secrets stay in `.env.local` (never committed).

## Working with the owner

Short answers in plain words. Read the existing code first and follow its patterns. Explain the plan in a few lines
before a big change; ask when something is unclear instead of guessing; one topic at a time. Suggest improvements,
but don't implement them without a yes.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000 (live databases!)
npm run check      # typecheck + lint + example checks + production build — run before every deploy
npm run presence:examples   # presence rules on made-up data
npm run format:examples     # number / money / hours / date formatting
npm run excel:examples      # Excel export
```

## Deployment

- Dev: this PC. Prod: VM `192.168.1.93:3000`, folder `C:\tm\clz-autoquote`, run by PM2 (`ecosystem.config.js`):
  `clz-autoquote` (the app) and `clz-scheduler` (daily auto-exit, `scripts/scheduler.js`).
- Deploy: commit and push to `main` (`gitsync.bat "message"`), then run `update.ps1` on the VM (pull, install, build, restart).
  The build downloads the two fonts (Inter, JetBrains Mono, `src/app/layout.tsx`) from Google, so the VM needs internet while
  building; the running app serves them itself.
- Presence Excel files: `\\SERVER2019\Office\…`, with `Z:\` as fallback on the VM.

## Where things are

| What | Where |
|---|---|
| Pages | `src/app/<area>/page.tsx`; sections with a sidebar have a `layout.tsx` (`analytics`, `presence`, `settings`) |
| Server actions (DB access) | `src/app/**/*-actions.ts`, analytics queries in `src/app/analytics/queries/` |
| All UI text | `src/locales/it.ts` → `APP_COPY` |
| Numbers and settings | `src/config/constants.ts` → `APP_CONFIG`, `PRICING_FORMULAS`, `PRESENCE_RULES` |
| Look: colours, font sizes, radius, shadows, layout sizes | `src/styles/theme.js` |
| Areas, header icons, home cards, section sidebars | `src/config/navigation.ts` |
| Analytics report list / their components | `src/config/analyticsSections.ts` / `src/components/analytics/reportComponents.ts` |
| Settings (admin) tables / their components | `src/config/adminTables.ts` / `src/components/admin/managerComponents.ts` (pages `/settings/<id>`) |
| Page frame, title, sidebar | `src/components/layout/` (`AppShell`, `PageHeader`, `SectionSidebar`, `Header`) |
| Shared UI parts | `src/components/ui/` |
| Display formats (money, numbers, hours, dates, months) | `src/lib/format.ts`; date strings `src/lib/dateUtils.ts` |
| Excel / file downloads | `src/lib/excel.ts` / `src/lib/download.ts` |
| Report state (filters, paging, sorting, export) | `src/hooks/useReportTable.ts` |
| List state for lists that load all rows (presence pages) / on-screen sorting | `src/hooks/useListQuery.ts` / `src/hooks/useClientSort.ts` (`src/lib/sort.ts`) |
| Quote pricing | `src/lib/pricing/` — [docs/PRICING.md](docs/PRICING.md) |
| Presence rules / data | `src/lib/presence/` — [docs/PRESENCE.md](docs/PRESENCE.md) / `src/app/presence/*-actions.ts` (events, operators, hours, settings, auto-exit; shared queries in `presence-db.ts`) |
| PDF reports | `src/app/analytics/pdf-actions.ts` (data) + `src/lib/pdf/` (page HTML, `renderPdfBase64`) |
| Order sync DiBa → Business → NetPro | `src/lib/orderSync.ts`, `src/lib/orderCompare.ts` — [docs/ORDER_PROCESS.md](docs/ORDER_PROCESS.md) |
| Cashflow | [docs/CASHFLOW.md](docs/CASHFLOW.md) |

## Design system

The whole look is defined in `src/styles/theme.js`; `tailwind.config.js` turns it into CSS variables and classes.
Restyle the app by editing that file only. Tailwind's own palette is switched off, and ESLint fails on raw colour
classes and `text-[Npx]`, so a component can only use tokens:

- Surfaces: `bg-background` (page) · `bg-card` (panels) · `bg-muted` (controls, hover) · `bg-muted-strong` · `bg-overlay/60`
- Lines: `border-border` · `border-border-strong`
- Text: `text-fg-strong` · `text-fg` · `text-fg-soft` · `text-fg-secondary` · `text-fg-muted` · `text-fg-subtle` · `text-fg-faint` · `text-fg-inverse`
- Status (scale 50–950, default 500): `primary`, `success`, `warning`, `danger`, `info`, `highlight` — e.g. `text-success-400`, `bg-danger/10`, `border-warning-500/30`
- Small text: `text-2xs` (11px), `text-3xs` (10px), `text-4xs` (9px). Layout: `max-w-page`, `max-w-workspace`, `w-sidebar`
- No uppercase labels, monospace only for numbers, shadows only on floating elements.

Shared parts to use before writing new markup: `Button` (+ `buttonClasses()` for links), `Input`, `Select`, `Checkbox`,
`DatePicker`, `Card`, `EmptyState`, `Field`, `SearchField`, `DateRangeFields`, `FilterPanel` (+ `ToggleChips` rows),
`Pagination` / `RecordCount`, `DataTable` (+ `Table` primitives, `StackedCell`, `TagCell`, `MissingValue`, footer totals),
`EditableCell` (click-to-edit cell), `StatusBadge`, `ChoiceButton`, `Modal` (every popup window), `ExportExcelButton`.
Messages: `notify.success / error / failure(err)` (`src/lib/notify.ts`) and `await confirmDelete(text)` / `askConfirm({…})`
(`src/lib/confirm.ts`) — never `alert()` or `confirm()`.

## Rules for new code

1. **Reuse before writing**: look in `src/components/ui`, `src/components/layout`, `src/lib`, `src/hooks` first.
2. **Never copy**: logic, markup or text needed twice goes into one shared helper, hook or component.
3. **Nothing hardcoded**: texts in `it.ts`, numbers in `constants.ts`, look in `theme.js`, formats through `format.ts`.
4. **Small parts**: a component past ~400 lines is split (logic into hooks or `src/lib`, UI into components). One component per file.
5. **Strict TypeScript**, Zod at data boundaries. Remove unused code, imports and files as you go.
6. **Before calling it done**: `npm run check` passes and the change is checked in the browser.

## Recipes

**New page**: inside a section, its `layout.tsx` already gives header and sidebar — the page renders
`<PageHeader icon title subtitle />` and its content. A standalone page wraps them in `<AppShell>`. Add the link to
`src/config/navigation.ts` (`MAIN_NAV` for a main area, `SECTION_NAVS` for a sidebar entry).

**New analytics report**:
1. Query in `src/app/analytics/queries/` (`netpro-queries.ts` for production data, `business-queries.ts` when revenue or
   costs are involved), using the shared helpers; re-export it from `analytics-actions.ts`.
2. Entry in `src/config/analyticsSections.ts`, label and description in `it.ts`.
3. Component built with `useReportTable` + `ReportView`: copy `src/components/analytics/ClientDeliveriesReport.tsx` and
   change the row type, filters, columns and Excel columns. Register it in `reportComponents.ts`.

**New settings table**: manager component in `src/components/admin/` (generic CRUD via `src/app/admin-actions.ts`),
then one entry in `ADMIN_TABLES` (`src/config/adminTables.ts`, texts in `it.ts` → `admin.tables`) and one in
`MANAGER_COMPONENTS` (`src/components/admin/managerComponents.ts`); the sidebar and the `/settings/<id>` page follow.

**New pricing operation / presence rule**: see [docs/PRICING.md](docs/PRICING.md) and [docs/PRESENCE.md](docs/PRESENCE.md).

## Other docs

[docs/GLOSSARY.md](docs/GLOSSARY.md) (Italian terms) · [docs/BACKLOG.md](docs/BACKLOG.md) (planned work) ·
[docs/SERVER2019_DISK_SPACE.md](docs/SERVER2019_DISK_SPACE.md) (file server notes)
