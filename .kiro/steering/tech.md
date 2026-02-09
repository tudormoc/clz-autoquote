# Technology Stack

## Framework & Runtime
- **Next.js 16** (App Router) - React framework with server-side rendering
- **React 19** - UI library
- **TypeScript 5** (strict mode) - Type-safe development
- **Node.js** - Runtime environment

## Database
- **Microsoft SQL Server** - Primary database
- **mssql** package - Database driver with connection pooling

## UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn UI** - Component library (installed components in `src/components/ui/`)
- **Lucide React** - Icon library

## Forms & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation and type inference
- **@hookform/resolvers** - Form validation integration

## Common Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:3000)

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Path Aliases
- `@/*` maps to `./src/*` for clean imports
