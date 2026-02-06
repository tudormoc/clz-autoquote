// This file serves as a placeholder for global application constants.
//
// NOTE:
// Most business logic (pricing, discounts, volumes) is NOT hardcoded here.
// Instead, it is fetched dynamically from our 3 local MSSQL databases.
//
// Use this file ONLY for true static configuration (e.g., UI timeouts, pagination limits).

export const APP_CONFIG = {
  // UI & UX Configuration
  UI: {
    TOAST_DURATION: 3000,
  },

  // Default Form Values (Fallbacks)
  DEFAULTS: {
    QUANTITY: 100,
    WIDTH: 210, // A4
    HEIGHT: 297, // A4
    PAGES: 120,
    BOOK_NAME: '',
  },

  // Fallback defaults / System constraints
  LIMITS: {
    MAX_FILE_UPLOAD_MB: 10,
  },
} as const;