# AI RULES — CLZ Autoquote

> **CRITICAL MANDATORY RULE:**
> **ALWAYS GIVE VERY SHORT ANSWERS.**
> **NEVER output detailed summaries, multi-step explanations, or long walkthroughs unless the user explicitly requests one.**

---

## 🤖 AGENT BEHAVIOR

1. **VERY SHORT ANSWERS ONLY.** Maximum 1–3 sentences unless user explicitly asks for a summary/detail.
2. **Study first.** Before touching anything, read the relevant existing pages, components, actions, and locale keys. Match those patterns exactly.
3. **Propose, don't act.** Show your plan, wait for explicit approval, then execute.
4. **Reuse everything.** Global components, CSS tokens, locale keys, constants. Never duplicate.
5. **Suggest improvements** if you spot a better way — but never implement without approval.
6. **No assumptions.** If a requirement is vague, ask. Don't guess.

---

## 📚 Read Before Working on Specific Areas

| Area | Read first |
|------|-----------|
| Any UI | `.kiro/steering/design-system.md` |
| Analytics | `.kiro/steering/analytics-guide.md` + `database-schema.md` |
| Pricing | `src/lib/pricing/formulas/QUICK_REFERENCE.md` |
| Structure | `.kiro/steering/structure.md` |
| Issues | `.kiro/steering/troubleshooting.md` |

---

## ✅ SINGLE SOURCE OF TRUTH

| What | Where |
|------|-------|
| All UI text | `src/locales/it.ts` → imported as `APP_COPY` |
| Config & numbers | `src/config/constants.ts` → `APP_CONFIG` |
| Colors & spacing tokens | `src/app/globals.css` CSS variables |
| Tailwind tokens | `tailwind.config.js` |

**Never hardcode strings, numbers, colors, or spacing. No exceptions.**

---

## 🎨 UI RULES

- Use semantic tokens: `bg-card`, `bg-background`, `text-primary`, `text-zinc-400`, `text-success-foreground`, `text-warning-foreground`, `text-destructive`
- No arbitrary values: ~~`w-[350px]`~~, ~~`text-green-400`~~, ~~`#18181b`~~
- Add new color → `globals.css` variable → `tailwind.config.js` → use token
- No shadows except dropdowns. No uppercase labels. Monospace only for numbers.

---

## 🗄️ DATABASE RULES

- **Always** use `getMSSQLPool()` from `src/lib/mssql.ts`. Never create manual connections.
- **Always** use `WITH (NOLOCK)` on SELECT queries.
- Server actions live in `src/app/*-actions.ts`. Always wrap in `try/catch`. Return `{ success, data, error? }`.
- BUSINESS DB table prefix rule: every table has a 2–3 letter prefix shared by all its columns (`an_*`, `mo_*`, `mm_*`, `of_*`). The `ec_` prefix is UI-only — never use it in SQL.

---

## 🏗️ CODE STANDARDS

- **One component per file.** Logic in `.ts`, UI in `.tsx`.
- **DRY.** If you copy-paste, refactor instead.
- **Strict TypeScript.** No `any`. Zod for all data boundaries.
- **Clean as you go.** Remove unused imports, files, dead code immediately.
- **Small files.** Formula files: 50–150 lines. Extract when logic repeats.

---

## 📦 PRICING MODULE

All pricing logic in `src/lib/pricing/`. Adding a new operation:
1. Copy `formulas/TEMPLATE.ts` → `formulas/your-op.ts`
2. Add constants to `constants.ts` → `PRICING_FORMULAS`
3. Export from `formulas/index.ts`
4. Integrate in `engine.ts`
5. Add DB rule via Admin Dashboard
6. Run `npm run lint` + test in UI

---

## 📊 ANALYTICS MODULE

All analytics in `src/app/analytics/`. Adding a new report:
1. Add query to `queries/netpro-queries.ts` or `business-queries.ts`
2. Use shared utilities from `queries/shared/` — never duplicate filter or pagination logic
3. Re-export from `analytics-actions.ts`
4. Add to `src/config/analyticsSections.ts`
5. Build UI component with: filters, pagination, sorting, export, loading/empty/error states

**Query rules:** `NOLOCK` always · no date filter on costs · group by full commessa number · filter `dw_commeca > 0`

---

## 🚀 DEPLOYMENT

- **Dev:** `localhost:3000` (this machine)
- **Prod:** `192.168.1.93:3000` (VM at `C:\tm\clz-autoquote`)
- Deploy: `.\gitsync.bat "message"` → then `.\update.ps1` on VM
- PM2 processes: `clz-autoquote` (app) + `clz-scheduler` (auto-exit cron)
- Network files: `\\SERVER2019\Office\...` / `Z:\` fallback on VM
