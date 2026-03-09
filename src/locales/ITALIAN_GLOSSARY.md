# Italian Translation Glossary

This document provides context for Italian translations used in the AutoQuote Engine.

## Key Terms

### Printing & Binding Terms

| English | Italian | Notes |
|---------|---------|-------|
| Quote | Preventivo | Standard business term |
| Binding | Rilegatura | Book binding process |
| Hardcover | Copertina Rigida | Classic hardcover binding |
| Softcover | Brossura | Paperback/softcover |
| Spine | Dorso | Book spine |
| Endpapers | Risguardi | Papers at beginning/end of book |
| Headbands | Capitelli | Decorative bands at spine top/bottom |
| Signature | Segnatura | Folded sheet forming pages |
| Imposition | Imposizione | Page layout for printing |
| Sheet | Foglio | Paper sheet |
| Weight (paper) | Grammatura | Paper weight in gsm |
| Thickness | Spessore | Material thickness |
| Board | Cartone | Cardboard for covers |

### Business Terms

| English | Italian | Notes |
|---------|---------|-------|
| Client | Cliente | Customer/client |
| Project | Progetto | Work project |
| Quantity | Quantità | Number of units |
| Price | Prezzo | Cost/price |
| Discount | Sconto | Price reduction |
| Surcharge | Sovrapprezzo | Additional charge |
| Setup | Setup | Technical term, kept in English |
| Production | Produzione | Manufacturing process |
| Operation | Operazione | Work operation |
| Total | Totale | Sum/total |

### UI Terms

| English | Italian | Notes |
|---------|---------|-------|
| Settings | Impostazioni | Configuration settings |
| Dashboard | Dashboard | Technical term, kept in English |
| Analytics | Analisi | Data analysis |
| Report | Report/Rapporto | Both acceptable |
| Loading | Caricamento | Data loading state |
| Processing | Elaborazione | Data processing |
| Calculate | Calcola | Compute/calculate |
| Update | Aggiorna | Modify/update |
| Delete | Elimina | Remove/delete |
| Add | Aggiungi | Insert/add |

## Regional Considerations

### Formal vs Informal
- The application uses **formal** language (Lei form)
- Appropriate for business/professional context
- Imperative forms are polite (e.g., "Inserisci" not "Inserire")

### Technical Terms
Some technical terms are kept in English when commonly used in Italian printing industry:
- Setup (universally understood)
- Dashboard (common in software)
- Email (standard term)

### Measurements
- Millimeters: mm (same as English)
- Grams per square meter: gsm (same as English)
- Euro symbol: € (placed before number in Italian: €100)

## Context-Specific Translations

### "Opened Format" vs "Closed Format"
- **Formato Aperto**: The full width when book is opened (2x width)
- **Formato Chiuso**: The dimensions of the closed book

### "Coated" Paper Types
- **Patinata Opaca**: Coated matte paper
- **Patinata Lucida**: Coated glossy paper

### Production Terms
- **Velocità**: Speed/velocity (production rate)
- **Efficienza**: Efficiency (performance metric)
- **Prestazioni**: Performance (general term)
- **Andamento**: Trend/progression

## Pluralization Notes

Italian pluralization rules applied:
- Singular: pagina → Plural: pagine (pages)
- Singular: operazione → Plural: operazioni (operations)
- Singular: area → Plural: aree (areas)

## Abbreviations

| Full Term | Abbreviation | Usage |
|-----------|--------------|-------|
| Pagine | pp | Page count (e.g., "32 pp") |
| Pezzi | pz | Pieces/units |
| Pezzi per ora | pz/h | Pieces per hour |
| Millimetri | mm | Millimeters |

## Date & Number Formatting

### Dates
Italian format: DD/MM/YYYY
- Example: 09/03/2026

### Numbers
- Decimal separator: comma (,)
- Thousands separator: period (.)
- Example: 1.234,56 €

### Currency
- Euro symbol before number: €1.234,56
- In code, use toLocaleString('it-IT') for proper formatting

## Validation Messages

Error messages should be:
- Clear and specific
- Polite and professional
- Action-oriented (tell user what to do)

Examples:
- ❌ "Errore" (too vague)
- ✅ "Controlla i tuoi dati e riprova" (Check your data and try again)

## Future Considerations

### Regional Variants
- Current translations use standard Italian (italiano standard)
- No regional dialects or variations
- Suitable for all Italian-speaking regions

### Industry Jargon
- Translations align with Italian printing industry standards
- Terms verified against professional printing terminology
- Suitable for B2B communication

## Maintenance

When adding new translations:
1. Check this glossary for existing term translations
2. Maintain consistency with established terminology
3. Use formal language (Lei form)
4. Keep technical terms in English when industry-standard
5. Update this glossary with new domain-specific terms
