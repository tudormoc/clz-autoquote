# Cashflow & Liquidity Module Architecture

Ultra-compact reference guide for future developers and AI agents.

## 📌 Core Files
- **Page Route**: `src/app/cashflow/page.tsx`
- **Server Action**: `src/app/cashflow/cashflow-actions.ts`
- **Matrix Component**: `src/components/cashflow/CashflowMonthlyMatrix.tsx`

---

## 🗄️ Database Sources (`BUSINESS` database)

### 1. Entrate & Uscite (`scaden`)
- **Company**: `codditt = 'COOPZANARDI'`
- **Cash In (Entrate)**: `sc_darave = 'D'` AND `anagra.an_tipo = 'C'` (Clienti)
- **Cash Out (Uscite)**: `sc_darave = 'A'` AND `anagra.an_tipo = 'F'` (Fornitori)
- **Goal**: Add missing cost categories (Payroll, Taxes, etc.) step-by-step to `scadenze` until `Net Flow` matches the actual bank change.

### 2. Real Bank Balances (`prinot`)
- **Company**: `codditt = 'COOPZANARDI'`
- **Bank Account Codes (`pn_conto`)**:
  - **Attivo (+)**: `9020021` (Etica SBF), `9020037` (Banco Popolare SBF), `12010004` (Credem C/C), `12010002` (Etica Deposito)
  - **Passivo (-)**: `12010001` (Etica SCPA C/C), `12010003` (Banco Popolare 1629), `20110015` (Etica Ant.Fatture)
- **Formula**: `SUM(pn_importo)` directly. 
  > ⚠️ `pn_importo` is ALREADY negative for outflows (*Avere*). Do NOT apply `CASE WHEN THEN -pn_importo`!

---

## 🔄 Financial Logic & UI Rules
1. **Chain**: `Saldo Iniziale (Opening) + Cash In - Cash Out = Flusso Netto -> Saldo Finale (Closing)`
2. **Carry-over**: `Saldo Iniziale` = Previous month's `Saldo Finale`.
3. **Unrecorded Months**: Leave `Saldo Iniziale` & `Saldo Finale` empty (`null`).
4. **UI**: Table rows are expandable/collapsible (collapsed by default). Main rows always show row totals. Fits on one screen (no horizontal scroll).
