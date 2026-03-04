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

  // Design System - Spacing & Typography
  // Single source of truth for consistent spacing across the app
  DESIGN: {
    // Spacing scale (use these instead of arbitrary values)
    SPACING: {
      CARD_PADDING: 'p-4',           // Standard card padding (reduced from p-6)
      SECTION_GAP: 'gap-4',          // Gap between form sections
      GRID_GAP: 'gap-4',             // Standard grid gap
      SMALL_GAP: 'gap-2',            // Small gaps (icons, inline elements)
      INPUT_PADDING: 'px-3 py-2',    // Standard input padding
      BUTTON_PADDING_SM: 'px-3',
      BUTTON_PADDING_MD: 'px-4',
      BUTTON_PADDING_LG: 'px-6',
    },
    
    // Typography scale
    TYPOGRAPHY: {
      HEADING_XL: 'text-xl font-semibold',
      HEADING_LG: 'text-lg font-semibold',
      HEADING_MD: 'text-base font-semibold',
      HEADING_SM: 'text-sm font-semibold',
      BODY: 'text-sm',
      BODY_SMALL: 'text-xs',
      LABEL: 'text-xs font-medium',
      MONO: 'font-mono',
    },
    
    // Border radius
    RADIUS: {
      CARD: 'rounded-lg',
      INPUT: 'rounded',
      BUTTON: 'rounded',
      SMALL: 'rounded',
    },
    
    // Shadows (minimal)
    SHADOW: {
      CARD: 'shadow-none',           // No shadows for clean look
      DEFAULT: 'shadow-none',
      DROPDOWN: 'shadow-lg',         // Only for floating elements
    },
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

  // Analytics Configuration
  ANALYTICS: {
    HOURLY_LABOR_RATE: 40,  // €/hour - Default hourly rate for labor cost calculations
    
    // Production Flow Configuration
    // Defines the 3-phase production flow: Parallel flows A & B → Assembly → Finishing
    PRODUCTION_FLOW: {
      // Flow A: Block/Internal Production (runs in parallel with Flow B)
      FLOW_A_AREAS: ['Taglio Carta', 'Piega', 'Raccolta', 'Cucitura'],
      
      // Flow B: Cover Production (runs in parallel with Flow A)
      FLOW_B_AREAS: ['Taglio Cartone', 'Taglio Plancia', 'Copertine'],
      
      // Assembly Phase: Requires both Flow A and Flow B to be complete
      ASSEMBLY_AREAS: ['Messa in colla', 'Incassatura', 'Imbavatura'],
      
      // Finishing Phase: Final operations after assembly
      FINISHING_AREAS: ['Accavallatura', 'Stampa a caldo', 'Finissaggio/lavori manuali', 'Lavorazione esterna', 'Generico'],
    },
    
    // Custom Machine Area Groupings for Analytics Dashboard
    // Maps area names to machine codes for aggregated reporting
    // Machine codes are from NETPRO.SITUAZIONI.MACCHINA column
    MACHINE_AREAS: {
      // 'Campioni': ['178'],
      'Cellofanatura': ['169', '180'],
      'Copertine': ['144'],
      'Cucitura': ['109', '180', '113', '101', '118', '183'],
      // 'Finissaggio': ['170', '146', '147', '139', '138', '165', '185'],
      'Incassatura': ['161', '153', '157'],
      // 'Incollaggio': ['115'],
      // 'Logistica e manutenzione': ['158', '119', '106', '169', '177', '111', '129', '136', '128', '116', '102'],
      'Piega': ['174', '105', '173', '167', '143', '135', '145', '175', '141', '156', '155', '176', '134', '103', '168', '164', '123', '142', '149', '124', '121', '133', '126', '120', '256', '181', '160', '100', '172'],
      'Raccolta': ['137', '179', '130', '107', '127', '150', '131', '122'],
      'Stampa a caldo': ['159', '154', '198', '148', '108', '110', '152', '112', '184'],
      'Taglio': ['114'],
    } as const,
    
    // Target Velocity (pieces per hour) for each area
    // Used to calculate efficiency: (actual velocity / target velocity) × 100%
    AREA_TARGET_VELOCITY: {
      'Cellofanatura': 1125,
      'Copertine': 1260,
      'Cucitura': 1120,
      'Incassatura': 2800,
      'Piega': 4200,
      'Raccolta': 1120,
      'Stampa a caldo': 1050,
      'Taglio': 3000,
    } as const,
    
    // Efficiency thresholds for color coding
    EFFICIENCY_THRESHOLDS: {
      EXCELLENT: 60,  // >= 100% = Green (meeting or exceeding target)
      ACCEPTABLE: 40,  // >= 80% = Yellow (below target but acceptable)
      // < 80% = Red (significantly below target)
    } as const,
  },

  // Blueprint Preview Defaults
  BLUEPRINT: {
    HINGE_GAP: 7,        // mm - Space between board and spine
    TURN_IN: 18,         // mm - Wrap around material
    BLEED: 0,            // mm - Extra print margin
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

  // --- Block Thickness Calculation ---
  BLOCK: {
    // Density divisor for converting gsm to thickness factor
    DENSITY_DIVISOR: 1000,          // Converts gsm to proper density
    
    // Pages to sheets conversion
    PAGES_PER_SHEET: 2,             // 2 pages per sheet (front + back)
    
    // Endpapers configuration
    ENDPAPER_PAGES: 8,              // Endpapers add 8 pages (4 sheets) to block
  },

  // --- Gluing Operations ---
  GLUING: {
    // Square Spine Gluing - Tiered by block thickness
    SQUARE_HIGH_THRESHOLD: 50,      // mm - Above this = high rate
    SQUARE_MID_THRESHOLD: 30,       // mm - Above this = mid rate, below = low rate
    SQUARE_RATES: {
      HIGH: 0.124,                  // €/unit - Block > 50mm
      MID: 0.093,                   // €/unit - Block 30-50mm
      LOW: 0.062,                   // €/unit - Block ≤ 30mm
    },

    // Round Spine Gluing - Tiered by block thickness
    ROUND_HIGH_THRESHOLD: 50,       // mm - Above this = high rate
    ROUND_MID_THRESHOLD: 30,        // mm - Above this = mid rate, below = low rate
    ROUND_RATES: {
      HIGH: 0.21,                   // €/unit - Block > 50mm
      MID: 0.16,                    // €/unit - Block 30-50mm
      LOW: 0.105,                   // €/unit - Block ≤ 30mm
    },

    // Manual Loading Gluing - Tiered by dimensions
    MANUAL_HEIGHT_THRESHOLD: 380,   // mm - Height above this = default rate
    MANUAL_WIDTH_TIER_1: 305,       // mm - Width ≤ this = default rate
    MANUAL_WIDTH_TIER_2: 310,       // mm - Width 305-310 = tier 2 rate
    MANUAL_WIDTH_TIER_3: 320,       // mm - Width 310-320 = tier 3 rate
    MANUAL_RATES: {
      DEFAULT: 0.28,                // €/unit - Height>380 OR Width≤305 OR Width>320
      TIER_2: 0.13,                 // €/unit - Width 305-310mm
      TIER_3: 0.18,                 // €/unit - Width 310-320mm
    },
  },
} as const;

// ============================================================================
// OPERATION CATEGORIES
// ============================================================================
// Categories for organizing operations in the admin UI and pricing engine

export const OPERATION_CATEGORIES = [
  { value: 'internal', label: 'Internal', order: 1 },
  { value: 'cover', label: 'Cover', order: 2 },
  { value: 'gluing', label: 'Gluing', order: 3 },
  { value: 'casing_in', label: 'Casing-in', order: 4 },
  { value: 'finishing', label: 'Finishing', order: 5 },
  { value: 'packaging', label: 'Packaging', order: 6 },
  { value: 'other', label: 'Other', order: 7 },
] as const;

export type OperationCategoryValue = typeof OPERATION_CATEGORIES[number]['value'];

// Helper to get category label from value
export function getCategoryLabel(value: string): string {
  return OPERATION_CATEGORIES.find(c => c.value === value)?.label || value;
}

// ============================================================================
