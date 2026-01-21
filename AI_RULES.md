# AI CONSTITUTION (Strict Adherence Required)

**Context:** Production-grade Quoting Engine (Next.js, TypeScript, Supabase, Cloudflare).

## 1. SINGLE SOURCE OF TRUTH (THE GOLDEN RULE)
*   **NO Hardcoded Text:** NEVER write inline strings like `<h1>Get a Quote</h1>`.
    *   *Correct:* `<h1>{t.home.hero_title}</h1>`
    *   *Action:* Store all user-facing text in `src/config/copy.ts` (or dictionary keys) to allow for future translations (i18n).
*   **NO Magic Numbers:** Never use raw numbers in logic.
    *   *Correct:* `price * CONFIG.PRICING.TAX_RATE`
    *   *Action:* Define all math constants in `src/config/constants.ts`.
*   **NO Arbitrary Styles:** Do not use "magic values" like `text-[#1F2937]` or `w-[350px]`.
    *   *Correct:* Use Tailwind Theme tokens: `text-foreground`, `w-sm`, `p-4`.
    *   *Action:* Rely on `globals.css` CSS variables and `tailwind.config.ts`.

## 2. ARCHITECTURE & LOGIC
*   **Logic Separation:** Pricing math exists ONLY in `src/lib/pricing-engine.ts`. The UI is dumb; it just displays the result.
*   **Edge Native:** No Node.js APIs (`fs`, `path`) in client components.
*   **DRY (Don't Repeat Yourself):** If a logic block or UI pattern appears twice, refactor it into a shared Hook or Component immediately.

## 3. UI & COMPONENT STANDARDS
*   **Shadcn UI First:** Use the installed component library. Do not invent new buttons or inputs.
*   **Strict Types:** No `any`. Define interfaces for all Props and API responses.
*   **Validation:** Use **Zod** schemas to validate inputs before they touch the logic engine.

## 4. WORKFLOW FOR CHANGES
*   **Step 1:** Check if the constant/string already exists in the config.
*   **Step 2:** If not, add it to the config file FIRST.
*   **Step 3:** Use the key in the component.