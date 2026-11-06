# Presence rules — quick reference

All formulas behind `/presence/monthly-summary` live in `src/lib/presence/`. They are pure functions
that read every number from a `PresenceRulesConfig`. Nothing is hardcoded.

## Where a value comes from

```
src/config/constants.ts → PRESENCE_RULES   (defaults, in code)
        ↓ overridden by
NETPRO.VALORI_TABELLE  TABELLA='PRESENZE'  (editable in Impostazioni Presenze)
        ↓ parsed by
src/lib/presence/config.ts → parsePresenceRules()
        ↓ used by
formulas/*   ← server actions + MonthlyHoursTable
```

## Files

| File | Formula |
|------|---------|
| `src/lib/presence/formulas/counted-times.ts` | Entry rule (shift snap / ceil 15), exit rule (floor 15), totale = end − start − pausa |
| `src/lib/presence/formulas/distribution.ts` | Prefill: absence / partial / full → which fields get which hours |
| `src/lib/presence/formulas/coverage.ts` | Controllo 8h: Σ coveredFields = workdayHours, day status |
| `src/lib/presence/formulas/edit-effects.ts` | Cell edit side effects (permesso clears ferie, causale → full ferie) |
| `src/lib/presence/formulas/rounding.ts` | Shared rounding (step + floor/nearest/ceil) |
| `src/lib/presence/calendar.ts` | Working days, date ranges, local today |
| `src/lib/presence/categories.ts` | ENTITA → category, tracked reparti, the name mark of a category (`nameForCategory`) |
| `src/lib/presence/operatorInput.ts` | What the Operatori window may write: column sizes, Zod schemas, the message of a wrong field |
| `src/lib/presence/config.ts` | Setting definitions (DB key ↔ config field), parser, defaults |
| `src/lib/presence/examples.ts` | Validated example table — run with `npm run presence:examples` |

## The formula (defaults)

1. **Counted start** — clock-in ≤ 30 min before a shift start (06:30 / 07:30 / 08:30) → that start;
   otherwise clock-in rounded **up** to 15 min. `07:24 → 07:30`, `07:31 → 07:45`, `07:00 → 07:30`.
2. **Counted end** — last clock-out rounded **down** to 15 min. `16:34 → 16:30`.
3. **Totale** = end − start − 60 min pause. The pause is flat (intermediate stamps ignored) and
   deducted only if the counted span covers the pause window `12:00–13:00`; leaving before
   13:00 or arriving after 12:00 → no pause.
4. **Compensation** — if the total is short of 8h by ≤ 30 min (`TOLLERANZA_COMPENSAZIONE`) but the
   real clocked minutes (Σ sessions; flat pause assumed when no pause was clocked) reach 8h minus
   `TOLLERANZA_MINUTI_REALI` (5 min), grant 8.
   `TOLLERANZA_INGRESSO` (default 0) can additionally forgive N minutes of late entry outright.
5. Totale ≥ 8 → ordinarie 8; excess ≥ 0.5 → banca ore floored to 0.5.
6. Totale < 8 → ordinarie floored to 0.5, permesso = 8 − ordinarie.
7. No clock-in → ferie 8.

**Saturday (giorno extra)** — raw clock-in → clock-out, no pause, no penalties.
No records → nothing written, no anomaly. Records → `ore_straordinarie = min(4, floor(worked, 0.5))`;
excess dropped. Anomaly only when records exist but the field is still empty.
**Sunday (off)** — nothing computed or written.

Day kinds come from `GIORNI_LAVORATIVI` / `GIORNI_EXTRA`; extra-day numbers from `EXTRA_*`.

**Category profiles** (`PRESENCE_RULES.CATEGORIES → profile`):
- `standard` (Produzione, Interinali) — everything above.
- `fixed` (Ufficio) — working days: always 8 ordinarie when nothing is filled, even with no
  clock records; no penalties, pause, straordinari or banca ore. Saturday: same extra-day rule.
- `none` — never prefilled.

A category marked `timesheet: true` (today Ufficio) enters its own hours in Le mie ore instead of clocking: that
module reads only the workday (`ORE_GIORNATA`, `ORE_GIORNATA_OPERATORE`), the working days and the quick texts from
these rules, and applies none of the formulas above — see [TIMESHEET.md](TIMESHEET.md).

## Change a rule

- **Change a number** (shift starts, snap window, 15-min steps, 8h, rounding, banca ore threshold…): edit it in
  *Impostazioni Presenze* (DB), or the default in `PRESENCE_RULES`.
- **Change which field gets filled** (absence → malattia instead of ferie, excess →
  straordinarie instead of banca ore): same — `ASSENZA_CAMPO`, `PARZIALE_CAMPO`, `ECCEDENZA_CAMPO`.
- **Add a new tunable**: default in `PRESENCE_RULES` → field in `types.ts` → one row in
  `PRESENCE_SETTINGS` (`config.ts`) → use it in the formula. Settings page picks it up.
- **Add a new formula**: new file in `formulas/`, export from `index.ts`, read config only.
- **After any change**: update `examples.ts` and run `npm run presence:examples` — it must print all OK.

**Per-operator exceptions** — `ORE_GIORNATA_OPERATORE` = `12345=6` (only the exceptions; everyone
else uses `ORE_GIORNATA`). `rulesForOperator()` applies them, so the 6h flows into prefill, ferie/permesso,
the Controllo badge and anomalies automatically. Add other per-operator knobs the same way.

## Operators (anagrafica)

An operator is one row of `NETPRO.OPERATORI` and nothing else (no other table, key, trigger or procedure is involved;
the badge terminal finds the person through `BADGE` in that row). The Operatori page creates and edits them:

- **Nuovo operatore** (with the function "Crea ed elimina operatori", given apart in Gruppi): code, name, badge, category. The server
  (`createOperatorAction`) refuses a code or badge already in use, then inserts the row the way NetPro's own screen
  does: `MATRICOLA` = the code, stato logico IDLE as of now, and the fixed values in
  `APP_CONFIG.PRESENCE.NEW_OPERATOR_VALUES` (cost centre, level, flags). Check and insert are one transaction.
- **Stato fisico of a new person**: by habit OFF means "no longer working, or office" (never clocks), so the stato
  comes from the category (`newStato` in `PRESENCE_RULES.CATEGORIES`): OUT for Produzione and Interinali, as after an
  exit, OFF for Ufficio. NetPro's own screen writes OFF for everyone; the window shows the stato it will write.
- **Modifica** (the pencil, with *modifica* on the page): name, badge, category, matricola and NetPro's five free
  fields, shown with their real names and a hint of what they usually hold. `saveOperatorAction` writes only the
  columns of `OperatorFieldsSchema`; a badge must not be another operator's.
- **OFF HR, who leaves**: the category list of Modifica (not of Nuovo operatore) also has **OFF HR**, NetPro's category
  999 (`PRESENCE_RULES.LEFT_CATEGORY`). Who moves there leaves every presence page, keeps the name as it is (mark
  included, NetPro's habit) and gets stato fisico OFF, like every row of that category (already OFF stays OFF); the
  window says so under the category. Operatori shows these people only with the **OFF HR** chip of Categoria, off by
  default; from there the pencil can move someone back.
- **Chips**: Categoria and Stato Fisico only hide rows on screen. The stati in use are read when the page opens
  (`getOperatorStatiAction`), so their chips are there before "Applica Filtri"; the list itself loads only on Applica.
- **The name mark**: by habit the names of the interinali end with ` *lb` (`nameMark` of the category in
  `PRESENCE_RULES.CATEGORIES`). `nameForCategory()` adds it when the category is Interinali and takes it off when the
  person moves to another category (not to OFF HR), so nobody types it; the window shows the name it will save.
  Examples in `npm run presence:examples`.
- **Elimina** (in the edit window, same function): `deleteOperatorAction` deletes the row only when nothing names
  the code, in `EVENTI`, `STO_EVENTI`, `SITUAZIONI`, `STO_SITUAZIONI`, `ATTIVITA`, `UTENTI` or the saved hours
  (`HISTORY_TABLES`): nothing in the database would otherwise stop those rows from losing their person. A person
  with history is kept, and the message says to move the person to OFF HR instead. Checks and delete are one
  transaction.

## Invariant

Every prefill proposal must satisfy `Σ coveredFields = workdayHours`
(`assertCoversWorkday`). The server refuses to write a proposal that breaks it.
