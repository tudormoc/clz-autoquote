# Italian terms used in the app

All texts are Italian (`src/locales/it.ts`). Use these words so the same thing is always called the same way.

## Binding and printing

| English | Italian |
|---|---|
| Quote | Preventivo |
| Binding | Rilegatura |
| Hardcover | Copertina rigida |
| Softcover | Brossura |
| Spine | Dorso |
| Endpapers | Risguardi |
| Headbands | Capitelli |
| Signature | Segnatura |
| Imposition | Imposizione |
| Sheet | Foglio |
| Paper weight | Grammatura |
| Thickness | Spessore |
| Board | Cartone |
| Coated matte / glossy | Patinata opaca / lucida |
| Open / closed format | Formato aperto (2 × width) / formato chiuso |

## Business and production

| English | Italian |
|---|---|
| Client / supplier | Cliente / fornitore |
| Order number | Commessa |
| Discount / surcharge | Sconto / sovrapprezzo |
| Operation | Operazione |
| Production rate | Velocità |
| Efficiency | Efficienza |
| Trend | Andamento |
| Setup, Dashboard | kept in English |

## UI words

Impostazioni (settings), Analisi (analytics), Caricamento (loading), Elaborazione (processing), Calcola, Aggiorna,
Elimina, Aggiungi.

## Style

- Formal, short, action-oriented: "Controlla i dati e riprova", never just "Errore".
- Abbreviations: pp (pagine), pz (pezzi), pz/h, mm.
- Numbers, money, hours and dates are never written by hand: use `src/lib/format.ts`
  (`1.234,56 €`, `06/10/2026`, `7:30`).
