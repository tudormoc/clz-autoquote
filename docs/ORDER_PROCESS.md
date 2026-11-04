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

Code: `syncOrderFromDiba` in `src/lib/orders/sync.ts` (steps: find the order and its impegno, quantities, article data, phases, phase chain, materials), row cloning in `src/lib/orders/syncRows.ts`; called by `syncOrderFromDibaAction` (`src/app/analytics/queries/order-operations-queries.ts`).
Edit the DiBa in Business only. Tab "Confronto Allineato" shows Allineato / Solo Distinta / Solo Ordine. The button writes to BOTH live DBs, one transaction each (`withTransactions`, `src/lib/mssql.ts`): if any statement fails, nothing is changed (Business commits first, then NetPro).

**Per phase (fase)** — new rows are cloned from an existing row of the same order, only key/value columns overridden:
- NetPro: `OPERAZIONI` (OPERAZIONE = fase 2-digit, CENTRO_ASSEGNATO/REALE, DESCRIZIONE, **note → DESCRIZIONE01**, QTA_*, TIPO WRK, STATO REL), `TASKS` (MACCHINA / MACCHINA_ASSEGNATA = centro), `JOBSET` (ORDINE, OPERAZIONE, ID_OPER, TASK).
- Business: `attivit` (at_codlavo, at_note, at_cicloriga = DiBa riga, at_qtapr), `assris` (as_codcent).
- Chain, recomputed on every sync: NetPro `OPERAZIONI.CENTRO_SUCCESSIVO` = centro of the next fase (last = NULL); Business `attivit.at_sufase` = next fase (last = 0, with at_suanno/at_sunumord/at_suriga = 0).
- Delete: removes JOBSET, TASKS, OPERAZIONI, attivit, assris of that fase.
- Update: centro/descr/note/qty; real centre/machine only overwritten if not manually reassigned.

**Materials** (DiBa `movdis`): Business `movord` tipork Y + `keyord` (ko_conto = order client); NetPro `MATERIALI_ORDINI` (OPERAZIONE '0', TIPO_QTA 'TOT', QUANTITA = orderQty × quant / perpz, QTA_IMPIEGO = quant / perpz). New material riga = max + 5. Price is NOT calculated (stays 0) — accepted.
`MP_FITTIZIA`, the placeholder that gives NetPro one material on an order without any (286 orders of 2026): Riallinea never adds it;
once the DiBa has a real material it is removed from the DiBa, the Business order (Y row + keyord) and NetPro, and the comparison
shows it "da rimuovere" (owner's rule 2026-11-04). On an order without real materials it is left alone.
Update stamps (`mo_ultagg` of a material row, `TASKS.DATA_UPD`) move only when a value really changes.

**Tested live 2026-11-04 on order 674** (snapshots diffed at each step): quantity 1000 → 2000 / 2500 from the impegno reached the H row,
the 16 phases, the DiBa per-pieces, the NetPro order, operations (`QTA_BASE` too), tasks and jobset; the material stayed 10 (per copy
0.005); the FOGLI placeholder was removed from `movord`, `keyord` and `MATERIALI_ORDINI`; a second press changed nothing.

**Not touched:** `ORDINI` header, `artpro`, NetPro `FXDEMANDS` / `FXLOG` / `FXJOBS` (bridge log tables written by the official "Aggiorna Ordini di Produzione"), the SELL order `R26 0000099990010`.
The official update differs by deleting/recreating ops, tasks and materials (new material rigas, DATA_* refreshed) and writing FX* rows; the resulting data is equivalent.
Timestamps use DB `GETDATE()` (a JS Date would be 2h off).

**Facts verified on real orders (2026-10-06):**
- **Editions:** one Business OdP can hold several editions = several H rows (riga 5/10/15, e.g. #673 → LCQV9604/9604A/9604B). Each edition has its own `mo_commeca` (e.g. 260960405/10/15), own NetPro order (`mo_netpid`), own phases (`attivit.at_riga` = H riga) and own materials (`movord` Y `mo_rigaor` = H riga). Always scope by edition.
- **Material quantity** = `ceil(orderQty / md_perpz) × md_quant` (e.g. 1358 pz, perpz 10000, quant 1200 → 1200). NetPro `QTA_IMPIEGO` = quantity / orderQty.
- **Material links:** Y row ↔ DiBa row via `mo_disbasriga = md_riga` (a DiBa can list the same code twice); NetPro row ↔ Y row via `MATERIALI_ORDINI.SEQUENZA = mo_riga`.
- **NetPro note** (`OPERAZIONI.DESCRIZIONE01`) = first 100 chars of the DiBa note.
- A commessa can have older/duplicate NetPro MAKE orders; use `mo_netpid`, not "latest order of the commessa".

**Comparison tab** (`src/lib/orders/compare.ts`, shared by server count and UI): DiBa → Business order → NetPro order, per edition, field-level (lavorazione, centro, note; material qty).
**Sync safety guard:** the button refuses commesse with more than one edition or more than one NetPro MAKE order (not edition-aware yet).

**Tested live (fase 85/90, materials):** add/edit/delete phase, add/update/delete material — each diffed before/after; only the expected rows changed.

## Quantities (2026-11-04, test order 674 and the 2026 orders)

Two quantities of an order, the fields of the Business document row (form labels *Q.tà ordin.* and *Qta.Max.Prod*):

| Quantity | Impegno cliente (the truth) | Ordine di produzione (Business) | Ordine NetPro |
|---|---|---|---|
| Q.tà ordinata | `movord` R · `mo_quant` | `movord` H · `mo_quant`; `attivit` · `at_qtapr` (every phase) | `ORDINI` · `QTA_RICHIESTA`; `OPERAZIONI`, `TASKS`, `JOBSET` · `QTA_RICHIESTA` |
| Q.tà max da produrre | `movord` R · `mo_colli` | `movord` H · `mo_colli` | not in NetPro |

The impegno cliente row of an order is the R row with the same `mo_commeca` **and** `mo_codart` as the H row (one and only one in
965 of 967 H rows of 2026; `testord.td_numpar` is set on 13 only). An impegno can hold several rows on one commessa (the book plus
services): only the article row counts.

**What the programs do by themselves** (snapshots of the test order): saving the impegno in Business updates the NetPro sales order
(`ORDINI` SELL = `mo_netpid` of the R row, its `MATERIALI_ORDINI` row, an `FXDEMANDS` row) and the money totals of the impegno header,
nothing of the production order. Changing the quantity of the MAKE order in the NetPro program updates `QTA_RICHIESTA` of its
operations, tasks (with `DATA_UPD`) and jobset and scales `MATERIALI_ORDINI.QUANTITA` by the per-piece quantity; `OPERAZIONI.QTA_BASE`
stays as it was. NetPro has no database triggers: a write to `ORDINI` from outside the program cascades nowhere.

**Riallinea, quantity step** (`syncQuantities` in `sync.ts`, the first step of the sync; owner's rules): the two quantities are read
from the impegno row (from the H row when there is none); `movdis.md_perpz` = ordered quantity on **every** material row of the DiBa,
so the material quantities stay as typed in the DiBa (10 stays 10: a material changes only when the DiBa is edited); `movord` H row
`mo_quant` / `mo_colli`; NetPro `ORDINI.QTA_RICHIESTA`. Then the phase step writes `at_qtapr` and, on operations, tasks and jobset,
`QTA_RICHIESTA` (and `OPERAZIONI.QTA_BASE`, which NetPro's program leaves at the first quantity: the owner wants every 1000 to become
2000), and the material step recomputes the order's materials from the DiBa. Each write only where the value differs. Left alone:
the sales order and the bridge rows (Business keeps them), the document headers (`testord.td_totcoll`, not maintained by Business
either). The quantity rows count in the "Disallineato da DiBa" badge. Verified live on order 674 (2026-11-04): the diff of the two
snapshots showed exactly these rows.

**Quantità tab** of Gestione Operazioni Ordine (`src/lib/orders/quantityData.ts` reads, `quantities.ts` compares; the same layout as
the phases and materials): one row per quantity, the impegno cliente, the Business order and the NetPro order side by side, every
place of a document under its value, "Allineato" at the end.

**Snapshot tool** (`scripts/order-snapshot.ts`, read only): `npm run order:snapshot -- 260999910 before`, change the order in
Business or NetPro, then `npm run order:snapshot -- 260999910 after` prints every row and column that changed in both databases
(movord, testord, attivit, assris, keyord, commess, cicli, movdis; ORDINI, OPERAZIONI, JOBSET, TASKS, MATERIALI_ORDINI and the
FX* bridge rows). Files in `tmp/order-snapshots/` (not committed).



## Article data (2026-11-04)

The article data of an order are fields of the impegno cliente row (the truth); the article code never changes. Saving the impegno in
Business updates its row and, through the bridge, the NetPro sales order's title (`ORDINI` SELL · `DESCRIZIONE`), nothing else; the
official regeneration then treats a renamed row as a new article and duplicates the orders. Where each datum is kept:

| Datum (form label) | Impegno / order row | Also in | NetPro |
|---|---|---|---|
| Titolo (Titolo/Descrizione) | `movord` · `mo_descr` (255) | `testord` · `td_riferim` of the three headers (80), `commess` · `co_descr1` (80, Business's trigger `UPDATED_DESCR_COMMECA` on `testord` copies every impegno header's `td_riferim` here), `artico` · `ar_descr` (255) | `ORDINI` · `DESCRIZIONE` (100), `ANAG_MATERIALI` · `DESCRIZIONE` (110) |
| Composizione | `movord` · `mo_matric` (255) | — | no field |
| Base, Altezza, Nr.pagine | `movord` · `mo_misura1`, `mo_misura2`, `mo_misura3` | `artico` · `ar_misura1-3` (equal on 898 of 967 orders of 2026) | no field |

Lengths in `APP_CONFIG.ORDERS.TITLE_LENGTHS`. **Riallinea, article step** (`syncArticle` in `sync.ts`, after the quantities; owner's
rule): the impegno row's values, cut to what each place keeps, written to every place above where they differ (update stamps only then).
**Articolo tab** of Gestione Operazioni Ordine: the same three-column table as the quantities (`articleData.ts` reads, `article.ts` the
rules, `documentFacts.ts` the comparison, `DocumentFactsComparison.tsx` the table), one row per datum with every place under its
document, the article masters under the Business and NetPro columns, "non presente" where NetPro has no field; counted in the
"Disallineato da DiBa" badge. Verified live on order 674 (2026-11-04): the title Riallinea changed exactly the eight title places.

## Production flow on the Avanzamento Lavori page (`/work-progress`)

Operations are grouped by their area (NetPro `CENTRI.REPARTO` → `AREE.DESCRIZIONE`, read by the query) into the phases
of `APP_CONFIG.ANALYTICS.PRODUCTION_FLOW` (`src/config/constants.ts`). The array order is the display order; an area in
no array is shown under "Altre operazioni".

| Phase | Areas |
|---|---|
| Flow A — block (in parallel with B) | Taglio Carta, Piega, Raccolta, Cucitura |
| Flow B — cover | Taglio Cartone, Taglio Plancia, Copertine |
| Assembly (needs A and B) | Messa in colla, Incassatura, Imbavatura |
| Finishing | Accavallatura, Stampa a caldo, Finissaggio/lavori manuali, Lavorazione esterna, Generico |

Several editions of one order: operations with the same description and machine are merged and show the most
urgent state — EXE (in work) if any edition is in work, else SUS (suspended), COM (completed) only when all are completed.
