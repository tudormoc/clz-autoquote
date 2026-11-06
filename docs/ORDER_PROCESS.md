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

**Comparison tab** (`src/lib/orders/compare.ts`, shared by server count and UI through `differences.ts`): DiBa → Business order → NetPro order, per edition, field-level (lavorazione, centro, note; material qty).
**Sync safety guard (since 2026-11-05):** Riallinea works on one edition at a time (see "Riallinea, one edition at a time" below); it refuses an article with more than one production order on its commessa (a double) and an order whose article is another in NetPro than in Business.

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



## Article data (2026-11-04, corrected 2026-11-05)

The article data of an order are fields of the impegno cliente row (the truth); the article code never changes. Saving the impegno in
Business updates its row and, through the bridge, the NetPro sales order's title (`ORDINI` SELL · `DESCRIZIONE`), nothing else; the
official regeneration then treats a renamed row as a new article and duplicates the orders. Where each datum is kept:

| Datum (form label) | Impegno / order row | Also in | NetPro |
|---|---|---|---|
| Titolo (Titolo/Descrizione) | `movord` · `mo_descr` (255) | `artico` · `ar_descr` (255) | `ORDINI` · `DESCRIZIONE` (100), `ANAG_MATERIALI` · `DESCRIZIONE` (110) |
| Composizione | `movord` · `mo_matric` (255) | — | no field |
| Base, Altezza, Nr.pagine | `movord` · `mo_misura1`, `mo_misura2`, `mo_misura3` | `artico` · `ar_misura1-3` (equal on 898 of 967 orders of 2026) | no field |

**Not places of the title**: the document headers and the commessa. `testord.td_riferim` of the impegno is the document's own reference
text (on real orders it differs from the row's title, e.g. "… - FSC", and one impegno holds several rows), Business's trigger
`UPDATED_DESCR_COMMECA` on `testord` copies it into `commess.co_descr1`, and Business leaves the production order's headers (H, Y)
empty. The first version of the step (2026-11-04) wrote the title there too; found with the preview on real orders and removed on
2026-11-05, before the step was used on any real order (on test order 674 those texts were overwritten, harmless). A text place can
be NULL: the reads turn it into an empty text, and Riallinea treats NULL as different from the impegno's value.

Lengths in `APP_CONFIG.ORDERS.TITLE_LENGTHS`. **Riallinea, article step** (`syncArticle` in `sync.ts`, after the quantities; owner's
rule): the impegno row's values, cut to what each place keeps, written to every place above where they differ (update stamps only then).
**Articolo tab** of Gestione Operazioni Ordine: the same three-column table as the quantities (`articleData.ts` reads, `article.ts` the
rules, `documentFacts.ts` the comparison, `DocumentFactsComparison.tsx` the table), one row per datum with every place under its
document, the article masters under the Business and NetPro columns, "non presente" where NetPro has no field; counted in the
"Disallineato da DiBa" badge. On real open orders the usual differences are the composizione (Business does not copy it to the order
row) and the max quantity (the order row holds the ordered one).

## Preview before Riallinea (2026-11-05)

The confirm window lists what the realign is about to change, by kind (Quantità, Articolo, Fasi, Materiali), one line per place or
row: "Q.tà ordinata · attivit.at_qtapr: 1.000 ×16 → 2.000", "Fase 85: aggiunta in NetPro …", "MP_FITTIZIA: rimosso da …". The lines
come from the same four comparisons the tabs show (`previewSync` in `src/lib/orders/syncPreview.ts`, pure), so the window and the tabs
always agree. Two things make the comparisons say what the realign really writes: the Quantità tab lists the DiBa's per pieces
(`movdis.md_perpz`, real material rows only: the placeholder's row is not touched), and a material's expected quantity is computed
with per pieces = ordered quantity, i.e. the DiBa's own quantity. Not modelled: the phases' times and chain, refreshed on every realign.

## Orders to realign (2026-11-05)

"Ordini da riallineare", the button next to the search on `/work-progress` (same permission as the page): the open
production orders that differ from their impegno cliente or their DiBa, and what differs. Nothing loads until the button
is pressed; a new search puts the list away. The list itself only reads; each row can be realigned (below).

- **One row per article with an open production order**, that is per article of an impegno (owner, 2026-11-05: the
  editions of an impegno are different articles, each with its own DiBa and production order, never mixed). Open = NetPro
  `ORDINI`, `TIPO = 'MAKE'`, `STATO` in `APP_CONFIG.ORDERS.OPEN_STATES` (EMI, EXE). An article with several open orders
  shows **the newest one only** (owner: for now only the new order is shown and realigned; the ids sort by year and
  number). On 2026-11-05: 262 articles, 249 listed.
- **Only articles with a DiBa** (owner, 2026-11-06: "we consider articles with a diba, but not these"): an order whose
  article has no phases in the DiBa is left out and not counted. These are the internal orders of 2023 the indirect
  hours are booked on (`9999PULIZIA`, `9998MANUTENZIONE`, `9997MAGAZZINO`, `9996QUALITÀ`, `RESPPRODUZIONE`,
  `USCITAMACCFURG`: six articles, eight orders). Two internal articles have a DiBa and stay (`RESPFINISSAGGIO`,
  `9995CAMPIONATURA`, both blocked): how to tell an internal order from a customer's is the owner's to say.
- The order is compared with **the Business order row that points to it** (`mo_netpid` = the NetPro id, looked for inside
  the commessa: every open order has exactly one) by `loadOrderManagement` (`management.ts`), the read behind the Gestione tab,
  `ALIGNMENT_CHECKS_AT_ONCE` orders at a time: about 4 seconds for all of them.
- **What differs** comes from `src/lib/orders/differences.ts` (pure): `compareOrder` makes the four comparisons of the tabs,
  `countDifferences` is the "Disallineato da DiBa" badge, `orderDifferences` gives per kind (Quantità, Articolo, Fasi,
  Materiali) the number of rows that differ, the `changes` a realign would write (the lines of its confirm window) and,
  where it has nothing to write, the `issues` of the comparison ("Impegno cliente non trovato" on internal commesse). The
  panel, the badge and the list use these, so the counts of a row add up to the badge of that order.
- **Marks**, as icons right after the buttons of a row (owner, 2026-11-06: not a column of words at the end, so the
  kind of row is seen at once; `MisalignedOrderMarks.tsx`). Three places, each kind always in the same one: what stops
  or settles the realign (comparison failed, "Articolo ≠", "Bloccato" — see "What Riallinea refuses to remove" —, or
  "Allineato"), then "Doppio", then "Più edizioni". The sentence is the icon's tooltip; on phones the name stands next
  to the icon. "Doppio": the article has other production orders (same `PART_NUMBER` in NetPro or same `mo_codart` in
  Business, any state), listed under the row with their state. An article should have one production order, so this is
  usually a duplicate (owner); for now it is only shown, how to fix it is to be decided. 19 articles on 2026-11-05, most
  with an older completed order, four commesse with two open ones (9078, 9086, 9306, 9502). "Più edizioni": the commessa
  holds orders of several articles (only told: each edition is realigned on its own). "Articolo ≠": NetPro names another article on the order than Business (order 712:
  `LCDQ9650` in Business, `LCDT9650` in NetPro; to be fixed by hand, owner: later). "Allineato": a row read again that
  no longer differs.
- **The buttons at the start of a row** (owner, 2026-11-05: at the start, so no scrolling to reach them; buttons for all
  the rows come when every case is handled), next to the arrow that shows the lines: icons only, the one that writes in
  the colour of every write. The icon of Riallinea is `AlignIcon` (`src/components/ui/AlignIcon.ts`), one name for the
  rows, the button on the order's page and the confirm window. Refresh
  reads that order again (`refreshMisalignedOrderAction`, read only): the row is replaced in place, and leaves the list
  when the order is no longer open. Sync is Riallinea for that order: the row is read again, the same confirm window as
  on the order's page lists what will be written, then `syncOrderFromDibaAction` runs (same permission: "modifica" and the
  Riallinea function; logged in the Registro as always) and the row is read again. It is offered for orders in any state
  (owner: in work or not, they always have to be in sync). It is off where Riallinea refuses the order (`canRealign`:
  the article has another production order on the same commessa, a "Doppio" — the guard of `findTarget` in `sync.ts`),
  on "Articolo ≠" and where there is nothing to write. On 2026-11-05 it was on for 229 of 247 rows, 82 of them editions.
- **Screen** (`MisalignedOrdersList.tsx`, `MisalignedOrderActions.tsx`, `useMisalignedOrders.ts`, server `misaligned.ts`):
  sorted by impegno, year then number, newest first (a click on a header sorts by it); the chips keep the orders with a
  kind of difference or with a double article; the arrow shows the lines under the row; a click on a row opens the master
  order (on its first edition).
- **Expect a long list**: on 2026-11-05 about half of the orders listed differed only by the three usual things (the
  composizione missing on the order row, the max quantity equal to the ordered one, MP_FITTIZIA next to real materials).
- Still open: Riallinea for an article with a double order (then the buttons for all the rows), and the Gestione tab of
  a commessa with two production orders, which shows the newest one only.

Check on real data (read only): `npx tsx --tsconfig tsconfig.json tmp/misaligned-check.ts [commessa …]` (not committed).

## Riallinea, one edition at a time (2026-11-05)

Owner's rule: the editions of an impegno cliente are separate articles, each with its own DiBa, its own Business order
row and its own NetPro order; they are checked and realigned separately, whether their order rows sit in one Business
order or in several.

**How editions are stored** (test order 2026/674: edition 1 = row 10, article `9999NEWDB`, commessa 260999910, NetPro
`H26 0000006740010`; edition 2 = row 15, article `9999NEWDBED2`, commessa 260999915, NetPro `H26 0000006740015`):
- one `movord` H row per edition, with the article, the commessa and the NetPro order (`mo_netpid`) of the edition;
- `attivit` / `assris`: the edition is in `at_riga` / `as_riga` (the H row's riga), and **the same fase numbers repeat in
  every edition**; an `attivit` row also holds the edition's `at_coddb`, `at_netpid`, `at_ciclo`, `at_suriga`;
- material rows (`movord` Y) are numbered over the whole order (row 20 for edition 1, 25 for edition 2) and hold the
  edition's `mo_rigaor`, `mo_commeca`, `mo_netpid`, `mo_disbasp`; `keyord` holds `ko_commeca`;
- of the 133 commesse of 2026 with several articles, 104 have their rows in one order, 29 in several orders.

**What `sync.ts` does about it** (`syncOrderFromDiba({ commessa, netproOrder })`, the edition's commessa and its NetPro order):
- `findTarget` takes the H row of that commessa that points to that NetPro order (the newest row when no order is
  given); the article is always the H row's, so the DiBa realigned from is the one of the edition;
- every statement on phases names the edition's row (`PHASES_OF_EDITION`, `RESOURCES_OF_EDITION`): before, "fase 10 of
  order 674" matched the fase 10 of both editions, and one edition's DiBa would have been written over the other;
- a new phase or material row is copied from a row of the same edition (`MATERIALS_OF_EDITION` and the keyord rows of
  those rows), so it keeps the edition's order row, article, commessa and NetPro order;
- a new material row takes the last number of the whole order + 5: before, edition 1 would have taken 20 + 5 = 25,
  the row of edition 2;
- the NetPro statements were already per order (`ORDINE`, `ID_OPER`).

**Ids and rows** (owner, 2026-11-06: "rows are not a good reference, use the ids"). The edition is found by its ids:
commessa, article, NetPro order. The row number is only the key under which Business itself keeps the phases and
material rows of that order line (`at_riga`, `mo_rigaor`); it is not a position. Business also writes the ids on those
rows (`at_netpid`, `at_coddb` on a phase; `mo_commeca`, `mo_netpid` on a material row), and on all the orders of 2026
they agree with the order row (15.726 phases, 3.564 material rows, none without, none under another row). Before
writing, `findTarget` checks it for the edition (`rowsOfAnotherOrder`): a phase or material row under the order row
with another article, commessa or NetPro order, and nothing is written. Materials are matched by their code and, since
a DiBa can list the same code twice (18 DiBas of the 2026 orders do), by the DiBa line (`mo_disbasriga = md_riga`).

**The ordered quantity in the DiBa** (owner, 2026-11-06). Materials: "per copie" is `movdis.md_perpz`, compared in the
Quantità tab and set by Riallinea (above). Phases: the DiBa holds no ordered quantity; its only quantity is
`cicli.dd_perqta` ("Per Qtà"), which is 1 on every phase of every order of 2026 (time per piece), so it is left alone.
The phases' quantity is on the order (`attivit.at_qtapr`) and in NetPro, both compared and realigned.

The order page starts from its first edition's own order row (`fetchOrderDetails`), the edition picker of the Gestione
tab reloads the comparison for the edition chosen, and its Riallinea button realigns that edition. The log entry and
`npm run order:snapshot -- <commessa>` are per commessa, so per edition.

**Verified live on the test order, 2026-11-06** (the owner pressed sync on both editions; snapshots before and after in
`tmp/order-snapshots/`, `…-before-editions` / `…-after-editions`). Edition 2 changed in exactly its expected rows: the H
row 674/15 (composizione, base, altezza, pagine), its material row 25 (20 → 10), `movdis` `md_perpz` 2000 → 3000 and
the NetPro material of `H26 0000006740015` (20 → 10); none of its 16 phases, which were already equal. Edition 1:
"every row is the same". Both editions then compared as aligned.
**New rows, same day** (`…-after-new-rows`): the owner changed a material's quantity (10 → 20), added a material and
added a phase (fase 90) in the DiBa of edition 2, then synced. The new material row is Y/674/30 (the last number of the
whole order, 25, + 5) under order row 15, with commessa 260999915, NetPro order `H26 0000006740015` and DiBa line 3,
with its `keyord` row and NetPro material 30; the new phase is `attivit` / `assris` H/674/15/90 with article
`9999NEWDBED2` and the edition's NetPro order, operation, task and jobset `H26 000000674001590`, and fase 85 now points
to 90 in both programs. Edition 1: "every row is the same" again. Still not exercised on an order with several
editions: removing a phase or a material. What each condition selects, read only: `npx tsx --tsconfig tsconfig.json tmp/edition-scope-check.ts 260999910 260999915`.

**Removal, same day** (`…-after-removal`): the owner removed seven phases (fasi 35, 36, 50, 55, 56, 85, 90) and the
added material (DiBa line 3) from the DiBa of edition 2, then synced. Gone from edition 2 only: `attivit` / `assris`
H/674/15/<fase>, the NetPro operations, tasks and jobset `H26 0000006740015<fase>`, material row Y/674/30 with its
`keyord` row and NetPro material 30; the chain closed over the gaps (30 → 40, 40 → 60, 80 → 100) in both programs.
Edition 1: "every row is the same". Change, add and remove have now each run on an order with two editions.

### What Riallinea refuses to remove (2026-11-06)

A realign takes away from the order what is no longer in the DiBa. The owner asked (2026-11-06: "make them refuse for
now until we fix them definitively") that it stops, and writes nothing, when that would take away something already
used. The rules are in `src/lib/orders/syncBlocks.ts` (pure); `findSyncBlocks` in `sync.ts` reads the facts on the rows
the realign itself removes by, and is asked twice: by the realign through its transaction, right before the first
write, and by the comparison (`loadOrderManagement` → `sync_blocks`), so the list (the "Bloccato" icon, the sync button
off with the reason, the reason under the row) and the order page ("Bloccato" next to a Riallinea that is off) say it
before the button is pressed. What the row says and what the server does is the same function.

- **An article with no phases in the DiBa**: every phase of the order would go. These are the internal orders of 2023
  where indirect hours are booked (`9999PULIZIA`, `9998MANUTENZIONE`, `9997MAGAZZINO`, `9996QUALITÀ`,
  `RESPPRODUZIONE`, `USCITAMACCFURG`). The list leaves them out (above); the refusal still guards the Riallinea of
  their order page.
- **A phase to remove that somebody already worked on**: work is recorded on it in NetPro (`SITUAZIONI` rows, reached
  through `JOBSET`), or its operation has left the state of one nobody touched (`REL`,
  `APP_CONFIG.ORDERS.UNSTARTED_OPERATION_STATE`; on the open orders: 2.410 `REL`, 593 `SUS`, 116 `COM`, 25 `EXE`).
  Removing it would leave its hours without an order: NetPro has no foreign key and no trigger on these tables.
- **A material row to remove that was already withdrawn**: "evaso" in Business (`mo_quaeva`, `mo_flevas`; 65 of the
  723 material rows of the open orders) or with a picked or used quantity in NetPro (`QTA_PRELEVATA`, `QTA_USATA`).

On the open orders that day: 9 rows blocked — the six internal orders whose sync button was on, plus 9999PULIZIA,
9995CAMPIONATURA and LCDQ9226 (commessa 260922605, fase 94 with 6 work rows), which are doubles as well; no order is
blocked for a material; 221 of 245 rows can be realigned; the list takes the same 3 to 4 seconds. With the articles
without DiBa left out (later that day, four orders closed meanwhile): 250 articles, 235 listed, 217 to realign, 3
blocked (LCDQ9226, RESPFINISSAGGIO, 9995CAMPIONATURA). Read only:
`npx tsx --tsconfig tsconfig.json tmp/risk-check-list.ts`. The refusal inside a real Riallinea has not run yet (it
needs an order in one of the three cases: on the test order, work clocked on a phase that is then taken out of the DiBa).

Still open:

- **Two databases, two commits.** Business commits, then NetPro (`withTransactions`): a cut exactly between the two
  leaves Business written and NetPro not. The order then still shows as different and a second Riallinea finishes it
  (every statement writes only where the value differs).
- **No row to copy from.** A new phase or material is a copy of an existing row of the same edition (so it gets every
  column Business and NetPro expect), and the realign removes before it adds: when the only material of the order is
  replaced (or every phase), nothing is left to copy, the Riallinea stops with an error and nothing is written. In
  Business a DiBa material line cannot change its code (owner, 2026-11-06): a material is replaced by deleting its
  line and adding a new one, so with one material this is the normal way. The placeholder row counts as a row to copy:
  of the open orders 127 hold only MP_FITTIZIA, 17 one material plus the placeholder, and only the two test editions
  one material without it — but Riallinea removes the placeholder once the DiBa has a real material, so every order
  realigned with one material ends up there (`tmp/material-count.ts`, read only). 11 internal orders have no material
  row at all: a first material cannot be added to them either way. The fix (add first, remove after) is proposed, not
  built.
- **A copy carries the "already done" values of the row it copies.** `cloneRowInsert` takes the first row of the
  edition (no order asked: in practice its first phase or material) and overrides only the columns of `syncRows.ts` /
  `syncMaterials`. Read on 2026-11-06 (`tmp/copy-inherits.ts`, `tmp/copy-inherits-2.ts`, read only), these are filled on
  worked or withdrawn rows, empty on untouched ones, and not overridden: NetPro `OPERAZIONI` `DATA_INIZIO`,
  `TEFF_LAVORO_MAC`, `TEFF_LAVORO_MAN`, `QTA_COMPLETATA`, `MODIFICATA`; `TASKS` `DATA_INIZIO`, `CRITICO`,
  `TEFF_LAVORO_MAC` / `_MAN`; `JOBSET` `TEFF_LAVORO_MAC` / `_MAN`, `QTA_COMPLETATA`; `MATERIALI_ORDINI` `QTA_USATA`
  (and `QTA_PRELEVATA`); Business `attivit` `at_flevas`, `at_operattees`, `at_operesees`; `movord` Y `mo_flevas`
  (`at_qtaes`, `mo_quaeva`, `mo_coleva` are reset). On an order nobody started there is nothing to carry (the tests on
  order 674); on an order in work a new phase or material could be born looking already done. It has not happened: no
  operation in state `REL` carries a start date, worked time or completed quantity (0 of 2.358). The fix (copy an
  untouched row when there is one, and clear these columns on the copy) is proposed with the add-before-remove one,
  not built.
- The definitive answer for the refusals (what to do with a worked phase or a withdrawn material that left the DiBa)
  is the owner's to decide: "we will fix and implement these exceptions later, one by one" (2026-11-06).

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
