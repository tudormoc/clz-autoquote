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
    QUANTITY: 1000,
    WIDTH: 148, // A5
    HEIGHT: 210, // A5
    PAGES: 100,
    BOOK_NAME: 'My Book Project',
    
    // Cover defaults
    COVER_TYPE: 'hardcover',
    SPINE_TYPE: 'square',
    BOARD_THICKNESS: 2.5,
    HEADBANDS_ENABLED: false,
    HEADBANDS_TYPE: 'politi',
    
    // Internal sheet defaults
    SHEET_WIDTH: 700,
    SHEET_HEIGHT: 1000,
    SHEET_THICKNESS: 1.5,
    SHEET_WEIGHT: 170,
    SHEET_TYPE: 'coated_matte',
    
    // Endpapers defaults
    ENDPAPERS_ENABLED: false,
    ENDPAPERS_WEIGHT: 170,
    ENDPAPERS_THICKNESS: 0.15,
    ENDPAPERS_TYPE: 'coated_matte',
  },

  // Fallback defaults / System constraints
  LIMITS: {
    MAX_FILE_UPLOAD_MB: 10,
  },
} as const;