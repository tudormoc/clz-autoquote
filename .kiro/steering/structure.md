# Project Structure

## Root Configuration
- `.env.local` - Environment variables (DB connection, etc.)
- `tsconfig.json` - TypeScript configuration (strict mode enabled)
- `tailwind.config.js` - Tailwind CSS configuration
- `next.config.mjs` - Next.js configuration

## Source Organization (`src/`)

### `/app` - Next.js App Router
- `page.tsx` - Main quote form page
- `layout.tsx` - Root layout
- `globals.css` - Global styles and design tokens
- `*-actions.ts` - Server actions (separated by domain)
  - `actions.ts` - General server actions
  - `admin-actions.ts` - Admin operations
  - `client-actions.ts` - Client management
  - `db-actions.ts` - Database operations
  - `db-test-actions.ts` - Database testing utilities
- `/admin` - Admin dashboard routes

### `/components` - React Components
- `/ui` - Shadcn UI components (Button, Input, Card, etc.)
- `/quote` - Quote form components
  - `AdvancedQuoteForm.tsx` - Main quote form
  - `ClientAutocomplete.tsx` - Client search
  - `LiveBreakdown.tsx` - Real-time price breakdown
  - `/sections` - Form sections (Cover, General, Internal)
- `/admin` - Admin dashboard components
- Utility components (Header, ErrorBoundary, etc.)

### `/lib` - Core Business Logic
- `mssql.ts` - **MANDATORY** centralized database connection pool
- `/pricing` - **Pricing calculation engine**
  - `engine.ts` - Main pricing orchestrator
  - `data.ts` - Database fetching for pricing rules
  - `types.ts` - Pricing type definitions
  - `validation.ts` - Input validation schemas
  - `/formulas` - Domain-specific calculation modules
    - `cover.ts` - Cover production calculations
    - `internal.ts` - CFGS (Cutting, Folding, Gathering, Sewing)
    - `discount.ts` - Volume discount logic
    - `operations.ts` - Generic operation costs
    - `index.ts` - Formula exports

### `/hooks` - React Hooks
- `useAdvancedQuote.ts` - Quote form state management
- `usePricingRules.ts` - Pricing rules data fetching

### `/services` - Data Access Layer
- `dataService.ts` - Generic data operations
- `mssqlService.ts` - SQL Server specific operations

### `/config` - Configuration & Constants
- `constants.ts` - **Single source of truth** for magic numbers and config values

### `/locales` - Internationalization
- `en.ts` - **Single source of truth** for all UI text strings

### `/types` - TypeScript Type Definitions
- `types.ts` - Shared type definitions

## Key Architectural Patterns

### Database Access
- **Always use** `getMSSQLPool()` from `src/lib/mssql.ts`
- Never create manual connections in individual files
- Centralized connection pool handles errors and reconnects

### Server Actions
- Separated by domain in `src/app/*-actions.ts`
- Always wrapped in try/catch with standard error returns
- Use `'use server'` directive

### Pricing Module
- All pricing logic isolated in `src/lib/pricing/`
- Formula files are small (50-100 lines) and focused
- New operations = new formula file in `/formulas`
- Engine orchestrates all calculations

### Component Organization
- One component per file
- Logic in plain TypeScript files, UI in components
- UI components use Shadcn UI library
