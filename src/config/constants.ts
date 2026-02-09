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
    WIDTH: 148,
    HEIGHT: 210,
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
    ENDPAPERS_THICKNESS: 1.5,
    ENDPAPERS_TYPE: 'coated_matte',
  },

  // Fallback defaults / System constraints
  LIMITS: {
    MAX_FILE_UPLOAD_MB: 10,
  },
} as const;

// ============================================================================
// PRICING FORMULA CONSTANTS
// ============================================================================
// These constants control the mathematical formulas used in pricing calculations.
// Edit these values to adjust how prices are calculated across the system.

export const PRICING_FORMULAS = {
  // --- CFGS (Cutting, Folding, Gathering, Sewing) ---
  CFGS: {
    // Complexity calculation: max(MIN_COMPLEXITY, TotalSignatures - COMPLEXITY_BASE)
    // Example: 15 signatures → 15 - 1 = 14 complexity
    COMPLEXITY_BASE: 1,
    MIN_COMPLEXITY: 0,
  },

  // --- Cover Production Type Logic ---
  COVER: {
    // Manual production thresholds (if exceeded, must use manual production)
    MANUAL_WIDTH_THRESHOLD: 305,    // mm
    MANUAL_HEIGHT_THRESHOLD: 380,   // mm

    // Fast production requirements (all must be true for fast mode)
    FAST_MIN_WIDTH: 99,             // mm
    FAST_MAX_WIDTH: 296,            // mm
    FAST_MIN_HEIGHT: 119,           // mm
    FAST_MAX_HEIGHT: 381,           // mm
    FAST_MIN_QUANTITY: 1000,        // units
    FAST_SPINE_TYPE: 'square',      // spine type required
  },
} as const;