# Cashflow (Flusso Monetario)

Page `/cashflow`: KPI cards and a month-by-month matrix of the year, with a drill-down into every bank movement.

## Files

| What | Where |
|---|---|
| Bank accounts, payroll and extra-expense accounts (attivo / passivo) | `src/config/cashflowConfig.ts` |
| Data | `src/app/cashflow/cashflow-actions.ts` — `getCashflowMonthlyDataAction(year)` (its queries run in parallel), `getBankAccountTransactionsAction` (every prima nota entry of one bank, with running balance) |
| Page and controls (year, reload) | `src/components/cashflow/CashflowDashboard.tsx` |
| KPI cards | `src/components/cashflow/CashflowKpiCards.tsx` |
| Monthly matrix, bank rows, expandable categories | `src/components/cashflow/CashflowMonthlyMatrix.tsx`, `BankMatrixRowGroup.tsx`, `ExpandableMatrixCategory.tsx` |
| Bank drill-down | `src/components/cashflow/BankOperationsDrilldown.tsx` |

## Data (Business database, `codditt = 'COOPZANARDI'`)

- **Cash in / cash out** — `scaden`: entrate `sc_darave = 'D'` with clients (`an_tipo = 'C'`), uscite `sc_darave = 'A'`
  with suppliers (`an_tipo = 'F'`).
- **Payroll and extra expenses** — `prinot` on the accounts listed in `cashflowConfig.ts`.
- **Bank balances** — `prinot`, `SUM(pn_importo)` on the bank accounts of `cashflowConfig.ts`. `pn_importo` is signed:
  positive = Dare (money in), negative = Avere (money out). Attivo accounts add, passivo accounts subtract.

## Rules

1. Saldo iniziale + entrate − uscite = flusso netto → saldo finale.
2. A month's saldo iniziale is the previous month's saldo finale.
3. The drill-down must match the official bilancio to the cent (Dare, Avere, running balance per entry).
