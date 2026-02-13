# AI CONSTITUTION & PROJECT PROTOCOLS

> **CRITICAL: READ BEFORE ACTING**
> This project demands PERFECTION, SCALABILITY, and MAINTAINABILITY. 
> There is ZERO TOLERANCE for messy code, quick fixes, or unauthorized changes.

## 0. RULES OF ENGAGEMENT (STRICT)
1.  **ASK FIRST:** NEVER modify a file without first proposing the specific change and receiving explicit user approval.
    *   *Workflow:* Analyze -> Propose Plan -> Wait for Approval -> Execute -> Verify.
2.  **NO ASSUMPTIONS:** If a requirement is vague, stop and ask. Do not guess.
3.  **CLEAN AS YOU GO:** Every change must leave the file cleaner and more organized than before.
4.  **READ DESIGN SYSTEM FIRST:** Before ANY UI work, read `.kiro/steering/design-system.md`
5.  **ZERO HARDCODED VALUES:** All colors, spacing, text from centralized sources. NO EXCEPTIONS.

## 1. DESIGN PHILOSOPHY
*   **Future-Proof:** Use standard, well-supported patterns. Avoid experimental hacks.
*   **Scalable:** Write code that handles 10 users or 10,000 users without refactoring.
*   **Maintainable:** Code must be self-explanatory. If it's complex, it's wrong. Simplify it.

## 2. FILE & FOLDER STRUCTURE
*   **Organization:** Keep the project folder pristine. Remove unused files immediately.
*   **Component Purity:** One component per file. Logic goes in plain TypeScript/JS files; UI goes in Components.
*   **Easy to Edit:** Structure files so a human can easily find and modify constants, strings, and logic.

## 3. TECHNICAL STANDARDS (THE GOLDEN RULES)
*   **Single Source of Truth:**
    *   **Text** → `src/locales/` (No hardcoded strings)
    *   **Config/Math** → `src/config/constants.ts` (No magic numbers)
    *   **Styles** → `src/app/globals.css` CSS variables (No hardcoded colors)
    *   **Spacing/Typography** → `src/config/constants.ts` DESIGN tokens
*   **Type Safety:** Strict TypeScript. No `any`. Zod validation for all data boundaries.
*   **DRY:** Isolate logic. If you copy-paste, you must refactor instead.
*   **Centralized Design:** ALL colors, spacing, typography from centralized tokens. ZERO hardcoded values.

## 4. UI STANDARDS (STRICT)

**Read first:** `.kiro/steering/design-system.md`

### Styling Rules - ZERO TOLERANCE
- ✅ Use semantic tokens: `bg-card`, `text-success-foreground`, `text-warning-foreground`
- ❌ NEVER hardcode: `#18181b`, `text-green-400`, `bg-red-50`, `w-[350px]`

### Add New Color
1. Add to `src/app/globals.css` as CSS variable
2. Add to `tailwind.config.js` colors
3. Use via semantic token

### Violations
| ❌ WRONG | ✅ CORRECT |
|---------|-----------|
| `text-green-400` | `text-success-foreground` |
| `text-orange-500` | `text-warning-foreground` |
| `text-red-600` | `text-destructive` |
| `bg-[#18181b]` | `bg-card` |
| `w-[350px]` | `w-full` or `max-w-sm` |

## 5. INFRASTRUCTURE & DATA PATTERNS
*   **Database Access:**
    *   **MANDATORY:** Always use `getMSSQLPool()` from `src/lib/mssql.ts`.
    *   **NEVER:** Create manual database connections or pools in individual files.
    *   **WHY:** We use a centralized, resilient connection pool that handles errors and reconnects automatically.
*   **Server Actions:**
    *   Keep server actions pure and separated in `src/app/*-actions.ts`.
    *   Always wrap DB calls in try/catch blocks with standard error return types.

## 6. PRICING MODULE ARCHITECTURE

### 6.1 Structure
- **All pricing logic:** `src/lib/pricing/`
- **Formulas:** `src/lib/pricing/formulas/` (one file per operation, 50-150 lines)
- **Data layer:** `src/lib/pricing/data.ts` (DB fetching)
- **Engine:** `src/lib/pricing/engine.ts` (orchestrates everything)

### 6.2 Formula Standards (MANDATORY)

**Before ANY formula work, read:** `src/lib/pricing/formulas/QUICK_REFERENCE.md`

**Every formula file MUST have:**
1. **Visual header block** (copy from existing files or `TEMPLATE.ts`)
2. **Constants in** `src/config/constants.ts` → `PRICING_FORMULAS` (NO magic numbers)
3. **JSDoc + `@example`** on all exported functions
4. **Naming:** `calculate[Op][Aspect]`, `find[What]`, `apply[What]To[Target]`

### 6.3 Adding New Operations

1. `cp formulas/TEMPLATE.ts formulas/your-operation.ts`
2. Add constants to `src/config/constants.ts` → `PRICING_FORMULAS`
3. Implement with full documentation
4. Export from `formulas/index.ts`
5. Integrate in `engine.ts` (follow existing patterns)
6. Add DB rule via Admin Dashboard
7. Test: `npm run lint` + UI

### 6.4 Modifying Formulas

1. **Try constants first** (preferred) → Edit `constants.ts`
2. **If logic change needed:**
   - Update header block
   - Adjust JSDoc examples
   - Add inline comments
   - Test edge cases

### 6.5 Quality Checklist

- [ ] No magic numbers (all in `constants.ts`)
- [ ] Header block + JSDoc + examples
- [ ] File is 50-150 lines
- [ ] `npm run lint` passes
- [ ] Tested in UI with real data


## 7. DESIGN SYSTEM ENFORCEMENT

**Before ANY UI work:**
- [ ] Read `.kiro/steering/design-system.md`
- [ ] Check `src/app/globals.css` for tokens
- [ ] Check `src/config/constants.ts` for spacing

**Code Review:**
- [ ] No hardcoded colors (`#...`, `text-green-400`, `bg-red-50`)
- [ ] No arbitrary values (`w-[350px]`)
- [ ] Uses semantic tokens (`bg-card`, `text-success-foreground`)
- [ ] All text from `src/locales/en.ts`

**Change design:** Edit `src/app/globals.css` → entire app updates instantly.
