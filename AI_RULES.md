# AI CONSTITUTION & PROJECT PROTOCOLS

> **CRITICAL: READ BEFORE ACTING**
> This project demands PERFECTION, SCALABILITY, and MAINTAINABILITY. 
> There is ZERO TOLERANCE for messy code, quick fixes, or unauthorized changes.

## 0. RULES OF ENGAGEMENT (STRICT)
1.  **ASK FIRST:** NEVER modify a file without first proposing the specific change and receiving explicit user approval.
    *   *Workflow:* Analyze -> Propose Plan -> Wait for Approval -> Execute -> Verify.
2.  **NO ASSUMPTIONS:** If a requirement is vague, stop and ask. Do not guess.
3.  **CLEAN AS YOU GO:** Every change must leave the file cleaner and more organized than before.

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
    *   Text -> `src/locales/` (No hardcoded strings)
    *   Config/Math -> `src/config/constants.ts` (No magic numbers)
    *   Styles -> Tailwind classes or `globals.css` (No arbitrary values like `w-[350px]`)
*   **Type Safety:** Strict TypeScript. No `any`. Zod validation for all data boundaries.
*   **DRY:** Isolate logic. If you copy-paste, you must refactor instead.

## 4. UI STANDARDS
*   **Shadcn UI First:** Use the installed component library. Do not invent new buttons or inputs.
*   **Strict Styling:** Use standard Tailwind semantic tokens (e.g., `bg-primary`, `text-muted-foreground`).
    *   **FORBIDDEN:** Hardcoded hex values or arbitrary numbering (e.g., `bg-[#414131]`, `w-[350px]`).
    *   **REFER:** See `globals.css` for the defined design system tokens.

## 5. INFRASTRUCTURE & DATA PATTERNS
*   **Database Access:**
    *   **MANDATORY:** Always use `getMSSQLPool()` from `src/lib/mssql.ts`.
    *   **NEVER:** Create manual database connections or pools in individual files.
    *   **WHY:** We use a centralized, resilient connection pool that handles errors and reconnects automatically.
*   **Server Actions:**
    *   Keep server actions pure and separated in `src/app/*-actions.ts`.
    *   Always wrap DB calls in try/catch blocks with standard error return types.