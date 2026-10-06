# Cashflow & Liquidity Module Architecture

Ultra-compact reference guide for future developers and AI agents.

## 📌 Core Architecture & Files
- **Configuration & SSOT**: [`src/config/cashflowConfig.ts`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/config/cashflowConfig.ts) (Central definition of bank accounts, ativo/passivo categories, helper selectors).
- **Page Route**: [`src/app/cashflow/page.tsx`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/app/cashflow/page.tsx) (Executive KPI cards + monthly financial matrix).
- **Server Actions**: [`src/app/cashflow/cashflow-actions.ts`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/app/cashflow/cashflow-actions.ts)
  - `getCashflowYearlyDataAction`: Parallelized 14-query retrieval via `Promise.all`.
  - `getBankAccountTransactionsAction`: Returns full prima nota transactions with Dare, Avere, and exact progressive balance for any bank.
- **Matrix Component**: [`src/components/cashflow/CashflowMonthlyMatrix.tsx`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/components/cashflow/CashflowMonthlyMatrix.tsx)
- **Reusable Bank Rows**: [`src/components/cashflow/BankMatrixRowGroup.tsx`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/components/cashflow/BankMatrixRowGroup.tsx) (DRY component handling bank rows, row/cell clicks, and drilldowns).
- **Bank Operations Drilldown**: [`src/components/cashflow/BankOperationsDrilldown.tsx`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/components/cashflow/BankOperationsDrilldown.tsx) (Detailed ledger view matching official bilancio numbers, search, and month filters).
- **Executive KPI Cards**: [`src/components/cashflow/CashflowKpiCards.tsx`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/components/cashflow/CashflowKpiCards.tsx) (Available liquidity, cash in/out, net flow).

---

## 🗄️ Database Sources (`BUSINESS` database)

### 1. Entrate & Uscite (`scaden`)
- **Company**: `codditt = 'COOPZANARDI'`
- **Cash In (Entrate)**: `sc_darave = 'D'` AND `anagra.an_tipo = 'C'` (Clienti)
- **Cash Out (Uscite)**: `sc_darave = 'A'` AND `anagra.an_tipo = 'F'` (Fornitori)
- **Extra Costs**: Payroll and extra expense groups from `prinot`.

### 2. Real Bank Balances (`prinot`)
- **Company**: `codditt = 'COOPZANARDI'`
- **Bank Accounts (`pn_conto`)**: Configured in `cashflowConfig.ts` with `category: 'attivo' | 'passivo'`:
  - **Attivo (+)**: `9020021` (Etica SBF), `9020037` (Banco Popolare SBF), `12010004` (Credem C/C), `12010002` (Etica Deposito)
  - **Passivo (-)**: `12010001` (Etica SCPA C/C), `12010003` (Banco Popolare 1629), `20110015` (Etica Ant.Fatture)
- **Formula**: `SUM(pn_importo)` directly.
  > ⚠️ `pn_importo` in `prinot` is signed (positive for *Dare* / debit / cash-in, negative for *Avere* / credit / cash-out).

---

## 🔄 Financial Logic & UI Rules
1. **Chain**: `Saldo Iniziale (Opening) + Cash In - Cash Out = Flusso Netto -> Saldo Finale (Closing)`.
2. **Carry-over**: `Saldo Iniziale` = Previous month's `Saldo Finale`.
3. **Drilldown**: Clicking on any bank row or month expands an inline drilldown displaying every prima nota entry, Dare, Avere, running cumulative balance, and period summaries to verify ERP balance reconciliation down to the cent.
4. **Zero Hardcoding**: All labels and UI strings are sourced from [`src/locales/it.ts`](file:///c:/Users/TM/Desktop/main/clz-autoquote/src/locales/it.ts). All bank settings from `cashflowConfig.ts`.
