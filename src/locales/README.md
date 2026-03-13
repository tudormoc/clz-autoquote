# Localization System

This directory contains all translation files for the application.

## Structure

- `it.ts` - Italian translations (Single Source of Truth)
- `index.ts` - Main export for translations

## Usage

### In Components

Import the translation object:

```typescript
import { APP_COPY } from '@/locales';

// In your component
<h1>{APP_COPY.quotes.title}</h1>
```

### Translation Keys Structure

The `APP_COPY` object is organized by feature area:

```typescript
APP_COPY = {
  header: { ... },           // Header/navigation text
  home: { ... },             // Home page content
  quotes: { ... },           // Quotes page titles
  form: { ... },             // All form labels and inputs
  results: { ... },          // Quote results display
  breakdown: { ... },        // Price breakdown table
  history: { ... },          // Quote history list
  errors: { ... },           // Error messages
  admin: { ... },            // Admin dashboard
  analytics: { ... }         // Analytics reports
}
```

## Adding New Translations

### 1. Add to Italian (it.ts)

```typescript
export const APP_COPY = {
  // ... existing keys
  myNewSection: {
    title: "La Mia Nuova Sezione",
    description: "Questa è una nuova sezione"
  }
} as const;
```

### 2. Use in Component

```typescript
import { APP_COPY } from '@/locales';

function MyComponent() {
  return (
    <div>
      <h1>{APP_COPY.myNewSection.title}</h1>
      <p>{APP_COPY.myNewSection.description}</p>
    </div>
  );
}
```

## Best Practices

1. **Never hardcode text** - Always use translation keys in `it.ts`
2. **Keep keys organized** - Group related translations together
3. **Use descriptive keys** - `form.projectTitle` not `form.field1`
4. **Type Safety** - The `as const` assertion ensures TypeScript knows the exact structure.


```typescript
// ✅ Type-safe - autocomplete works
APP_COPY.form.projectTitle

// ❌ Type error - key doesn't exist
APP_COPY.form.nonExistentKey
```

## Future Enhancements

- Add pluralization support for count-based translations
- Add date/number formatting per locale
- Extract translations to JSON files for easier management by non-developers
