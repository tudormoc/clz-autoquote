# Order process (Business → NetPro) — how it works

Two official apps + this webapp (autoquote). Test case used throughout: article `9999NEWDB`, commessa `260999910`, qty 1000.

## Flow

1. **Business – Impegno cliente** (Gestione Ordini, doc type "Impegno cliente", 2026/9999, client 9010038 LONGO AG SPA)
   Row 10 = article `9999NEWDB`, qty 1.000, commessa `260999910`.
2. **Business – Distinta Base (DiBa)** on the article = **source of truth**
   - Lavorazioni (phases): Riga / Fase / Lav. / Centro lav.
     e.g. fase 10 → Taglio Carta (centro 154), 20 Piega (144), 30 Raccolta (158), 35 Imbavatura (111), 36 Accavallatura (168), 40 Cucitura (105), 50 Taglio Cartone (152), 55/56 Taglio Plancia (153/156), 60 Copertine (174), 70 Stampa a caldo (167), 75 Messa in colla (137), 80 Incassatura (159), 100 Finissaggio (134); fase 1 = Movimentazione merce (295).
   - Materials (components): e.g. `MP_FITTIZIA` FOGLI, pallet.
3. **Business – Ordine di produzione** (same Gestione Ordini, doc type "Ordine di produzione", 2026 n.**674**, client 19010001 = the cooperative itself)
   Generated from impegno + DiBa: article row with lavorazioni and materials copied from the DiBa.
4. **NetPro – Ordini** (transformed from the Business OdP)
   Ordine id `H26 0000006740010` = `H{yy} {numord9}{riga4}`; Commessa 260999910; Stato `EMI`; Tipo `MAKE`.
5. **NetPro – Tasks**: each DiBa lavorazione → one task (Stato `REL`). Fields: Descrizione = lavorazione, Nome Macchina / `tasks__macchina` = centro lavoro, `operazioni__sequ` = fase.
6. **NetPro – Operazioni**: one operation per phase (Tipo `WRK`, Stato `REL`), Id Oper `H26 000000674001<fase>`-style, C.Reale / C.Ass. = centro lavoro.

## Mapping summary

| Business | NetPro |
|---|---|
| OdP (anno/numero 674) | Ordini (`H26 0000006740010`) |
| DiBa lavorazione (fase, centro lav.) | Tasks (macchina = centro) + Operazioni (WRK) |
| DiBa material | (materials stay in Business/DiBa) |

## Notes
- DiBa drives everything; change phases there, not in NetPro.
- IDs: NetPro order `H26 0000006740010` = H{yy} {numord9}{riga4}. Operation/task id = order id + fase (min 2 digits): fase 80 → `H26 000000674001080`, fase 100 → `H26 0000006740010100` (normal, the official conversion does the same). TASKS.TASK = OPERAZIONI.ID_OPER = JOBSET.TASK.
- Webapp page: `/work-progress` → search commessa `2609999…` → "Gestione Operazioni Ordine".
- Production DB is live: never write without explicit approval.

## Sync from DiBa ("Riallinea Ordine da DiBa") — verified 2026-10-06 on test order 674

Code: `syncOrderFromDibaAction` in `src/app/analytics/queries/order-operations-queries.ts`, helpers in `src/lib/orderSync.ts`.
Edit the DiBa in Business only. Tab "Confronto Allineato" shows Allineato / Solo Distinta / Solo Ordine. The button writes to BOTH live DBs (no transaction).

**Per phase (fase)** — new rows are cloned from an existing row of the same order, only key/value columns overridden:
- NetPro: `OPERAZIONI` (OPERAZIONE = fase 2-digit, CENTRO_ASSEGNATO/REALE, DESCRIZIONE, **note → DESCRIZIONE01**, QTA_*, TIPO WRK, STATO REL), `TASKS` (MACCHINA / MACCHINA_ASSEGNATA = centro), `JOBSET` (ORDINE, OPERAZIONE, ID_OPER, TASK).
- Business: `attivit` (at_codlavo, at_note, at_cicloriga = DiBa riga, at_qtapr), `assris` (as_codcent).
- Chain, recomputed on every sync: NetPro `OPERAZIONI.CENTRO_SUCCESSIVO` = centro of the next fase (last = NULL); Business `attivit.at_sufase` = next fase (last = 0, with at_suanno/at_sunumord/at_suriga = 0).
- Delete: removes JOBSET, TASKS, OPERAZIONI, attivit, assris of that fase.
- Update: centro/descr/note/qty; real centre/machine only overwritten if not manually reassigned.

**Materials** (DiBa `movdis`): Business `movord` tipork Y + `keyord` (ko_conto = order client); NetPro `MATERIALI_ORDINI` (OPERAZIONE '0', TIPO_QTA 'TOT', QUANTITA = orderQty × quant / perpz, QTA_IMPIEGO = quant / perpz). New material riga = max + 5. Price is NOT calculated (stays 0) — accepted.

**Not touched:** `ORDINI` header, `artpro`, NetPro `FXDEMANDS` / `FXLOG` / `FXJOBS` (bridge log tables written by the official "Aggiorna Ordini di Produzione"), the SELL order `R26 0000099990010`.
The official update differs by deleting/recreating ops, tasks and materials (new material rigas, DATA_* refreshed) and writing FX* rows; the resulting data is equivalent.
Timestamps use DB `GETDATE()` (a JS Date would be 2h off).

**Facts verified on real orders (2026-10-06):**
- **Editions:** one Business OdP can hold several editions = several H rows (riga 5/10/15, e.g. #673 → LCQV9604/9604A/9604B). Each edition has its own `mo_commeca` (e.g. 260960405/10/15), own NetPro order (`mo_netpid`), own phases (`attivit.at_riga` = H riga) and own materials (`movord` Y `mo_rigaor` = H riga). Always scope by edition.
- **Material quantity** = `ceil(orderQty / md_perpz) × md_quant` (e.g. 1358 pz, perpz 10000, quant 1200 → 1200). NetPro `QTA_IMPIEGO` = quantity / orderQty.
- **Material links:** Y row ↔ DiBa row via `mo_disbasriga = md_riga` (a DiBa can list the same code twice); NetPro row ↔ Y row via `MATERIALI_ORDINI.SEQUENZA = mo_riga`.
- **NetPro note** (`OPERAZIONI.DESCRIZIONE01`) = first 100 chars of the DiBa note.
- A commessa can have older/duplicate NetPro MAKE orders; use `mo_netpid`, not "latest order of the commessa".

**Comparison tab** (`src/lib/orderCompare.ts`, shared by server count and UI): DiBa → Business order → NetPro order, per edition, field-level (lavorazione, centro, note; material qty).
**Sync safety guard:** the button refuses commesse with more than one edition or more than one NetPro MAKE order (not edition-aware yet).

**Tested live (fase 85/90, materials):** add/edit/delete phase, add/update/delete material — each diffed before/after; only the expected rows changed.
