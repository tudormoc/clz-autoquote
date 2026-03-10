# Production Flow Guide

## Overview

This document explains how book production operations are organized and displayed in the Order Operations tracker.

## Production Flow Structure

Book production follows a **parallel flow** pattern where two independent workflows run simultaneously until they merge for final assembly.

### Flow A: Internal/Block Production
Operations that prepare the book's internal pages:

1. **Taglio Carta** - Cutting sheets
2. **Piega** - Folding sheets into signatures
3. **Raccolta** - Gathering signatures in order
4. **Cucitura** - Sewing signatures together

### Flow B: Cover Production
Operations that prepare the book's cover:

1. **Taglio Cartone** - Cutting cardboard boards
2. **Taglio Plancia** - Cutting cover material
3. **Copertine** - Assembling cover (boards + material)

### Merge Point
Both flows must be complete before these operations:

5. **Messa in colla** - Gluing spine/endpapers
6. **Incassatura** - Casing-in (attaching cover to block)
7. **Imbavatura** - Edge trimming

### Finishing
Final operations after assembly:

8. **Accavallatura** - Collating
9. **Stampa a caldo** - Hot stamping
10. **Finissaggio/lavori manuali** - Finishing touches
11. **Lavorazione esterna** - External processing
12. **Generico** - Generic operations

## Single Source of Truth

**All flow configuration lives in one place:**

`src/config/constants.ts` → `APP_CONFIG.ANALYTICS.PRODUCTION_FLOW`

```typescript
PRODUCTION_FLOW: {
  // Flow A: Block/Internal Production (runs in parallel with Flow B)
  FLOW_A_AREAS: ['Taglio Carta', 'Piega', 'Raccolta', 'Cucitura'],

  // Flow B: Cover Production (runs in parallel with Flow A)
  FLOW_B_AREAS: ['Taglio Cartone', 'Taglio Plancia', 'Copertine'],

  // Assembly Phase: Requires both Flow A and Flow B to be complete
  ASSEMBLY_AREAS: ['Messa in colla', 'Incassatura', 'Imbavatura'],

  // Finishing Phase: Final operations after assembly
  FINISHING_AREAS: ['Accavallatura', 'Stampa a caldo', 'Finissaggio/lavori manuali', 'Lavorazione esterna', 'Generico'],
}
```

**The array order IS the display order.** To reorder operations within a phase, just reorder items in the array. To move an operation to a different phase, move it to a different array.

### Machine → Area Mapping
Machine codes are mapped to area names dynamically from the NETPRO database via `src/config/machines.ts`:
- `getMachineArea(machineCode)` → area name (from CENTRI + AREE tables)
- Data cached after first fetch

## How It Works

1. **Query** fetches operations and enriches each with its `area_name` via `getMachineArea()`
2. **UI component** groups operations into sections using `PRODUCTION_FLOW` arrays
3. **Within each section**, operations are sorted by their index position in the corresponding array
4. **Unclassified operations** (area not in any array) appear in an "Other" section at the bottom

## Multiple Editions Handling

When an order has multiple editions (e.g., French + Polish versions):

### Grouping
Operations are grouped by:
- DESCRIZIONE (operation name)
- MACCHINA (machine name)

### Status Priority
When grouping editions, the most critical status is shown:
1. **EXE** (In Work) - If ANY edition is in work
2. **SUS** (Suspended) - If ANY edition is suspended
3. **COM** (Completed) - If ALL editions are completed
4. **PENDING** - If none of the above

## Adding / Reordering Operations

1. Open `src/config/constants.ts`
2. Find `PRODUCTION_FLOW` in the `ANALYTICS` section
3. Add/move the area name to the desired array and position
4. Done — the UI updates automatically

## Database Schema Reference

### Key Tables
- **OPERAZIONI**: Operation details (SEQUENZA, DESCRIZIONE, STATO)
- **ORDINI**: Order information (COMMESSA)
- **JOBSET**: Links operations to tasks
- **TASKS**: Task details (MACCHINA)
- **MACCHINE**: Machine information (DESCRIZIONE)
- **CENTRI**: Machine codes and area assignments (CENTRO, REPARTO)
- **AREE**: Area names (REPARTO, DESCRIZIONE)

### Status Values
- **EXE**: In work (currently being executed)
- **SUS**: Suspended (started but paused)
- **COM**: Completed (operation is closed)

## File Locations

- **Flow Config (single source of truth)**: `src/config/constants.ts` → `APP_CONFIG.ANALYTICS.PRODUCTION_FLOW`
- **Machine → Area Mapping**: `src/config/machines.ts` → `getMachineArea()`
- **Query Logic**: `src/app/analytics/queries/order-operations-queries.ts`
- **UI Component**: `src/components/analytics/OrderOperationsReport.tsx`
- **Section Config**: `src/config/analyticsSections.ts`
- **Locale Strings**: `src/locales/en.ts` → `analytics.orderOperations`

## Visual Indicators

- 🟢 Green (success token) = Completed (COM)
- 🔵 Blue (info token, pulsing) = In Work (EXE)
- 🟡 Orange (warning token) = Suspended (SUS)
- ⚪ Gray (muted) = Not Started (PENDING)
