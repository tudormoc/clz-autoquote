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
| `src/lib/presence/events.ts` | Presence events and the stato fisico: NetPro's codes, the event a stato changed by hand needs (`eventForStatoChange`) |
| `src/lib/presence/eventDelete.ts` | Which presence events may be deleted: refused when the operator did something else during that presence |
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
- **Stato fisico changed by hand** (the cell of the list, or a move to OFF HR; NetPro's own screen only changes the
  stato): the events always say the same as the stato (owner, 2026-11-06). IN is the only stato of who is inside, so
  a change **into IN** (from OUT, from OFF) also writes an entry and a change **out of IN** (to OUT, to OFF) an exit,
  as of that moment, the way "Aggiungi Evento" does (`addPresenceEvent` in `src/app/presence/presence-db.ts`: the
  row, the stato fisico with the event's time, and for an exit the work in progress paused); the stato asked for
  is the one that stays (OFF after the exit). No event when the operator's last presence event already says so: no
  second entry after an entry, no exit when there is no entry to close (the stato was only left wrong, for example
  after a deleted event). OUT ↔ OFF writes none. The rule is `eventForStatoChange` in `src/lib/presence/events.ts`
  (examples in `npm run presence:examples`); a message on the page says what was done.
- **The name mark**: by habit the names of the interinali end with ` *lb` (`nameMark` of the category in
  `PRESENCE_RULES.CATEGORIES`). `nameForCategory()` adds it when the category is Interinali and takes it off when the
  person moves to another category (not to OFF HR), so nobody types it; the window shows the name it will save.
  Examples in `npm run presence:examples`.
- **Elimina** (in the edit window, same function): `deleteOperatorAction` deletes the row only when nothing names
  the code, in `EVENTI`, `STO_EVENTI`, `SITUAZIONI`, `STO_SITUAZIONI`, `ATTIVITA`, `UTENTI` or the saved hours
  (`HISTORY_TABLES`): nothing in the database would otherwise stop those rows from losing their person. A person
  with history is kept, and the message says to move the person to OFF HR instead. Checks and delete are one
  transaction.

## Presence events (Eventi Giornalieri)

A presence event (ENT entry, EXT exit) is one row of `NETPRO.EVENTI` with `TASK = 'presenza'`; with the operator,
the event, its time and NetPro's `PROGRESSIVO` it is the row's key (a double badge stamp is an entry 0 and an exit 1
of the same instant). `UTENTE` says who wrote it: `SSQ` the badge clock (whole minutes; its stamps are marked as
handled in `IMPORT_TIMBRATURE`, so a deleted event is not imported again), `MES` the shop-floor terminal, a NetPro user
(`ADMIN`, `DIEGO` …) NetPro's own screen, `ADMIN` also this app by hand, `AUTO` the daily auto-exit.

- **Clock rows**: the hours pages read `SITUAZIONI` (`TIPO = 'CLCK'`, one row per entry → exit). Only NetPro's night
  job writes them, from the events: today's events have none until the night, and an event changed or deleted later is
  followed there (in six months every clock row matched its entry and exit). The app never writes `SITUAZIONI`.
- **Aggiungi Evento** (`createEventAction`), a stato fisico changed by hand on Operatori (see Operators above) and
  the daily automatic exit all write a presence event through `addPresenceEvent` (`src/app/presence/presence-db.ts`),
  the way NetPro's own screen does (compared with NetPro on 2026-11-11, a picture of the database before and after):
  an **entry** is the row, the operator IN and both "since" times (`ORA_ST_FISICO`, `ORA_ST_LOGICO`) = the entry; an
  **exit** first pauses the work in progress one second before, then the row, the operator OUT and `ORA_ST_FISICO` =
  the exit. Entering again restarts nothing, in NetPro and in the app: the work stays paused until someone starts it.
- **The automatic exit** (`runAutoExit`, called by the scheduler at 19:00 on the VM): who is still IN (last presence
  event of the day an entry) gets an exit dated `AUTO_EXIT_TIME_WEEKDAY` / `_SATURDAY` (16:30, 11:00), written as
  `UTENTE = 'AUTO'`, with the work in progress paused one second before. Not handled: work started after that time.
- **Work in progress paused at an exit** (`pauseWorkAtExit`): what is in progress is what NetPro's own list says,
  `ATTIVITA` (one row per person working now: NetPro adds it at a start and removes it at a pause), on a task NetPro
  holds in stato EXE whose last event of that person is the start. For each such phase the app writes what NetPro
  writes: the person's pause row (`OPE` `SUS`, the quantities at 0) and the person off `ATTIVITA`; when no colleague
  is still on the phase, also the machine's pause row (`MAC` `SUS`) if the machine is open on it, `TASKS` and
  `OPERAZIONI` in stato SUS with `OPERAZIONI.DATA_UPD` = the pause and, unless the machine is still open on another
  phase in execution, the machine's state row (`TASK = 'stato'`, `IDLE`) and `MACCHINE` idle; when colleagues go on,
  nothing else (NetPro's rule in 99 % of 1,385 of its own pauses; the state row rule in all 898 machine pauses).
  At the end the operator is idle since the exit. Two things are left to NetPro: the hours it keeps on the phase
  (`TEFF_LAVORO_MAC` / `_MAN` in `TASKS`, `OPERAZIONI`, `JOBSET`), which it counts again at its own next pause of the
  phase (its machine hours could not be reproduced exactly; the app's reports read `SITUAZIONI`), and `SITUAZIONI`.
  History: until 2026-11-06 old events decided what was "in execution" and a close was looked for as `CLO`, which
  NetPro never writes, so an exit of someone with nothing open set a phase closed long before back to SUS (the
  phases hit were closed again by the owner); until 2026-11-11 the person stayed on `ATTIVITA`, so NetPro refused them a new job the
  same day (`OPERATORE ATTIVO`), and the state row was not written.
- **The time** (a click on it, `updateEventAction`): changes `ORA_EVENTO` of that row, nothing else.
- **Elimina** (tick boxes at the start of the rows, with *modifica*; the ticks drop at every new search;
  `deleteEventsAction`): removes the ticked rows and
  nothing else, which is exactly what NetPro's own screen does (compared on 2026-11-06 with a snapshot before and after
  each step): the stato fisico stays as it is, also when the deleted event was the person's last one. Refused when the
  operator did anything else during that presence (`src/lib/presence/eventDelete.ts`, examples in
  `npm run presence:examples`): any other event that names the operator (work started or suspended, machine and stato
  rows) between an entry and its exit, both ends included, keeps the entry and the exit; an entry with no exit yet is
  kept when anything follows it; an exit with no entry before it stands alone. All or nothing, one transaction: one
  refused event, or one that is no longer there, and nothing is deleted. Every deleted row goes to the Registro with
  all its columns, so it can be put back by hand.

## Invariant

Every prefill proposal must satisfy `Σ coveredFields = workdayHours`
(`assertCoversWorkday`). The server refuses to write a proposal that breaks it.
