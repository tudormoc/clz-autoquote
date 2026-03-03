# Production Flow Guide

## Overview

This document explains how book production operations are organized and displayed in the Order Operations tracker.

## Production Flow Structure

Book production follows a **parallel flow** pattern where two independent workflows run simultaneously until they merge for final assembly.

### Flow A: Internal/Block Production
Operations that prepare the book's internal pages:

1. **TAGLIO** (10) - Cutting sheets
2. **PIEGA** (20) - Folding sheets into signatures
3. **RACCOLTA** (30) - Gathering signatures in order
4. **CUCITURA** (40) - Sewing signatures together

### Flow B: Cover Production
Operations that prepare the book's cover:

1. **TAGLIO CARTONE** (10) - Cutting cardboard boards
2. **TAGLIO PLANCIA** (20) - Cutting cover material
3. **COPERTINE** (30) - Assembling cover (boards + material)

### Merge Point
Both flows must be complete before these operations:

5. **INCOLLATURA** (50) - Gluing spine/endpapers
6. **INCASSATURA** (60) - Casing-in (attaching cover to block)

### Finishing
Final operations after assembly:

7. **FINISSAGGIO** (70) - Finishing touches
8. **CONFEZIONAMENTO** (80) - Packaging

## Sort Order Configuration

Operations are sorted using `APP_CONFIG.OPERATION_SORT_ORDER` in `src/config/constants.ts`:

```typescript
OPERATION_SORT_ORDER: {
  // Parallel Flow A: Internal/Block (10-40)
  'TAGLIO': 10,
  'PIEGA': 20,
  'RACCOLTA': 30,
  'CUCITURA': 40,
  
  // Parallel Flow B: Cover (10-40)
  'TAGLIO CARTONE': 10,
  'TAGLIO PLANCIA': 20,
  'COPERTINE': 30,
  
  // Merge Point (50-60)
  'INCOLLATURA': 50,
  'INCASSATURA': 60,
  
  // Finishing (70+)
  'FINISSAGGIO': 70,
  'CONFEZIONAMENTO': 80,
}
```

**Key principle:** Operations with the same number run in parallel and are displayed together.

## How Sorting Works

### 1. Primary Sort: Production Flow Order
Operations are sorted by their configured order number (10, 20, 30, etc.)

### 2. Secondary Sort: Sequence Number
When multiple operations have the same order number (parallel operations), they are sorted by their SEQUENZA from the database.

### 3. Fallback: Unknown Operations
Operations not in the config are assigned order 999 and appear at the end.

### Example Sort Logic
```typescript
const orderA = OPERATION_SORT_ORDER[operation_name] || 999;
const orderB = OPERATION_SORT_ORDER[operation_name] || 999;

if (orderA === orderB) {
  return sequenceA - sequenceB; // Same order = sort by sequence
}
return orderA - orderB; // Different order = sort by flow
```

## Multiple Editions Handling

When an order has multiple editions (e.g., French + Polish versions):

### Grouping
Operations are grouped by:
- SEQUENZA (operation sequence)
- DESCRIZIONE (operation name)
- MACCHINA (machine name)

### Status Priority
When grouping editions, the most critical status is shown:
1. **EXE** (In Work) - If ANY edition is in work
2. **SUS** (Suspended) - If ANY edition is suspended
3. **COM** (Completed) - If ALL editions are completed
4. **PENDING** - If none of the above

### Why This Works
Since all editions go through operations together (e.g., cutting all editions at once), showing the most advanced status gives accurate production state.

## Adding New Operations

To add a new operation to the sort order:

1. Open `src/config/constants.ts`
2. Add to `OPERATION_SORT_ORDER` with appropriate number:
   - 10-40: Parallel operations (internal or cover)
   - 50-60: Merge operations (require both flows)
   - 70+: Finishing operations

3. Example:
```typescript
'NEW_OPERATION': 45, // After cucitura, before merge
```

## Testing

### Test Case 1: Parallel Operations Display Together
Search for an order with both internal and cover operations.
Expected: TAGLIO and TAGLIO CARTONE appear together (both order 10)

### Test Case 2: Merge Operations After Parallel
Expected order:
1. All operations with order 10-40 (parallel)
2. INCOLLATURA (50)
3. INCASSATURA (60)
4. Finishing operations (70+)

### Test Case 3: Multiple Editions Status
Create order with 2 editions:
- Edition 1: Operation at EXE
- Edition 2: Operation at SUS
Expected: Operation shows as EXE (highest priority)

### Test Case 4: Unknown Operation
Add operation not in config.
Expected: Appears at end of list (order 999)

## Database Schema Reference

### Key Tables
- **OPERAZIONI**: Operation details (SEQUENZA, DESCRIZIONE, STATO)
- **ORDINI**: Order information (COMMESSA)
- **JOBSET**: Links operations to tasks
- **TASKS**: Task details (QTA_RICHIESTA)
- **MACCHINE**: Machine information (DESCRIZIONE)

### Status Values
- **EXE**: In work (currently being executed)
- **SUS**: Suspended (started but paused)
- **COM**: Completed (operation closed)

## File Locations

- **Sort Configuration**: `src/config/constants.ts` → `APP_CONFIG.OPERATION_SORT_ORDER`
- **Query Logic**: `src/app/analytics/queries/order-operations-queries.ts`
- **UI Component**: `src/components/analytics/OrderOperationsReport.tsx`
- **Section Config**: `src/config/analyticsSections.ts`

## Visual Indicators

- 🟢 Green circle with checkmark = Completed (COM)
- 🔵 Blue circle with play icon (pulsing) = In Work (EXE)
- 🟡 Yellow circle with pause icon = Suspended (SUS)
- ⚪ White circle = Not Started (PENDING)

Active operations also have blue background highlight for visibility.
