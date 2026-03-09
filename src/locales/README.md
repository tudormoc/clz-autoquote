# Localization System

This directory contains all translation files for the application.

## Structure

- `en.ts` - English translations (default)
- `it.ts` - Italian translations

## Usage

### In Components

Import the translation object and use the keys:

```typescript
import { APP_COPY } from '@/locales/en';

// In your component
<h1>{APP_COPY.quotes.title}</h1>
<p>{APP_COPY.quotes.subtitle}</p>
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

### 1. Add to English (en.ts)

```typescript
export const APP_COPY = {
  // ... existing keys
  myNewSection: {
    title: "My New Section",
    description: "This is a new section"
  }
} as const;
```

### 2. Add to Italian (it.ts)

```typescript
export const APP_COPY = {
  // ... existing keys
  myNewSection: {
    title: "La Mia Nuova Sezione",
    description: "Questa è una nuova sezione"
  }
} as const;
```

### 3. Use in Component

```typescript
import { APP_COPY } from '@/locales/en';

function MyComponent() {
  return (
    <div>
      <h1>{APP_COPY.myNewSection.title}</h1>
      <p>{APP_COPY.myNewSection.description}</p>
    </div>
  );
}
```

## Switching Languages

Currently, the application uses English by default. To implement language switching:

### Option 1: Context-based (Recommended)

Create a language context:

```typescript
// src/contexts/LanguageContext.tsx
import { createContext, useContext, useState } from 'react';
import { APP_COPY as EN } from '@/locales/en';
import { APP_COPY as IT } from '@/locales/it';

type Language = 'en' | 'it';

const translations = { en: EN, it: IT };

const LanguageContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof EN;
}>({
  lang: 'en',
  setLang: () => {},
  t: EN
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('en');
  
  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => useContext(LanguageContext);
```

Then in components:

```typescript
import { useTranslation } from '@/contexts/LanguageContext';

function MyComponent() {
  const { t, lang, setLang } = useTranslation();
  
  return (
    <div>
      <h1>{t.quotes.title}</h1>
      <button onClick={() => setLang(lang === 'en' ? 'it' : 'en')}>
        Switch to {lang === 'en' ? 'Italian' : 'English'}
      </button>
    </div>
  );
}
```

### Option 2: Direct Import

For simpler needs, directly import the desired language:

```typescript
// For English
import { APP_COPY } from '@/locales/en';

// For Italian
import { APP_COPY } from '@/locales/it';
```

## Best Practices

1. **Never hardcode text** - Always use translation keys
2. **Keep keys organized** - Group related translations together
3. **Use descriptive keys** - `form.projectTitle` not `form.field1`
4. **Maintain consistency** - Both language files should have identical structure
5. **Add comments** - Document complex or context-specific translations

## Type Safety

The `as const` assertion ensures TypeScript knows the exact structure:

```typescript
// ✅ Type-safe - autocomplete works
APP_COPY.form.projectTitle

// ❌ Type error - key doesn't exist
APP_COPY.form.nonExistentKey
```

## Future Enhancements

- Add more languages (French, German, Spanish, etc.)
- Implement dynamic language switching with localStorage persistence
- Add pluralization support for count-based translations
- Add date/number formatting per locale
- Extract translations to JSON files for easier management by non-developers
