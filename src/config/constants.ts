// This file serves as a placeholder for global application constants.
//
// NOTE:
// Most business logic (pricing, discounts, volumes) is NOT hardcoded here.
// Instead, it is fetched dynamically from our 3 local MSSQL databases.
//
// Use this file ONLY for true static configuration (e.g., UI timeouts, pagination limits).

/** Company code (codditt) of every Business ERP row the app reads or writes */
export const BUSINESS_COMPANY = 'COOPZANARDI';

export const APP_CONFIG = {
  // UI & UX Configuration
  UI: {
    // How long an on-screen notice stays (ms); errors stay longer so they can be read
    TOAST_DURATION: 4000,
    ERROR_TOAST_DURATION: 8000,
  },

  // Display locale for numbers, money and dates (used by src/lib/format.ts).
  // Colours, radius, fonts and shadows live in src/styles/theme.js.
  LOCALE: {
    LANGUAGE: 'it-IT',
    CURRENCY: 'EUR',
  },

  // Default Form Values (Fallbacks)
  DEFAULTS: {
    QUANTITY: 1000,
    WIDTH: 148,
    HEIGHT: 210,
    PAGES: 100,

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

  // The three SQL Server databases (order = order on the database page); connection details are in .env.local
  DATABASES: ['BUSINESS', 'NETPRO', 'QUOTES'] as const,

  // Starting values when a signature type is added on the Settings page
  NEW_SIGNATURE: { PAGES: 16, SORT_ORDER: 100 },

  // Orders (work progress page, DiBa realign)
  ORDERS: {
    // Copies assumed when an order has no quantity (DiBa material quantities are per 1000 copies)
    DEFAULT_QUANTITY: 1000,
    // First 7 characters of a commessa = the master order (year + number), e.g. 2609493 of 260949305
    ROOT_KEY_LENGTH: 7,
  },

  // Database explorer page: rows shown per table, "most frequent values" list, text columns used by the search box
  DB_EXPLORER: {
    ROW_LIMIT: 100,
    VALUES_LIMIT: 20,
    SEARCH_COLUMNS: 10,
  },

  // Analytics Configuration
  ANALYTICS: {
    HOURLY_LABOR_RATE: 40,  // €/hour - Default hourly rate for labor cost calculations. 40=23+17, 37=20+17.
    PARTIAL_LABOR_RATE: 23,  // €/hour - Partial labor rate for supplier cost equivalence calculations.

    // Longest wait for one revenue/cost report query (Sommario Clienti, Ricavo Ordini), table or Excel export
    REPORT_QUERY_TIMEOUT_MS: 90000,

    // Company Information
    COMPANY_NAME: 'TM - CLZ',

    // Contropartita codes for supplier invoicing
    SUPPLIER_CONTROPARTITA_CODES: [5093],

    // Client codes to exclude from PDF reports (e.g., internal clients, test accounts)
    // Add client codes here to hide them from exported PDF reports
    EXCLUDED_CLIENTS_PDF: ['9010384', '9010383', '9010250', '9010262', '9010011', '9010194', '9010383', '9010389', '9010013', '9010013', '9010377', '9010365', '9010382', '9010179'] as string[],

    // Production Flow Configuration
    // Defines the 3-phase production flow: Parallel flows A & B → Assembly → Finishing
    PRODUCTION_FLOW: {
      // Flow A: Block/Internal Production (runs in parallel with Flow B)
      FLOW_A_AREAS: ['TAGLIO CARTA', 'PIEGA', 'IMBAVATURA', 'RACCOLTA', 'ACCAVALLATURA', 'CUCITURA'],

      // Flow B: Cover Production (runs in parallel with Flow A)
      FLOW_B_AREAS: ['TAGLIO CARTONE', 'TAGLIO PLANCIA', 'COPERTINE'],

      // Assembly Phase: Requires both Flow A and Flow B to be complete
      ASSEMBLY_AREAS: ['MESSA IN COLLA', 'INCASSATURA'],

      // Finishing Phase: Final operations after assembly
      FINISHING_AREAS: ['ACCAVALLATURA/ARROTONDATURA', 'STAMPA A CALDO', 'FINISSAGGIO/LAVORI MANUALI', 'LAVORAZIONE ESTERNA', 'GENERICO'],
    },

    // Custom Machine Area Groupings for Analytics Dashboard
    // Maps area names to machine codes for aggregated reporting
    // Machine codes are from NETPRO.SITUAZIONI.MACCHINA column
    MACHINE_AREAS: {
      'Taglio': ['154', '155', '156', '256'],
      'Piega': ['141', '143', '144', '145', '146', '147', '148', '149'],
      'Raccolta': ['115', '158'],
      'Cucitura': ['105', '106', '107', '108', '109'],
      'Copertine': ['103', '174'],
      'Stampa a caldo': ['167'],
      'Incassatura normale': ['159'],
      'Incassatura veloce': ['114'],
      'Incassatura manuale': ['113'],
      'Cellofanatura': ['169', '180'],
      // 'Campioni': ['176'],
      // 'Finissaggio': ['100', '117', '118', '119', '121', '123', '124', '126', '127', '128', '129', '130', '131', '134', '136', '138', '175', '198'],
      // 'Incollaggio': ['135', '137'],
      // 'Logistica e manutenzione': ['170', '171', '172', '173', '178', '179', '185'],
    } as const,

    // Target Velocity (pieces per hour) for each area
    // Used to calculate efficiency: (actual velocity / target velocity) × 100%
    AREA_TARGET_VELOCITY: {
      'Cellofanatura': 1125,
      'Copertine': 2160,
      'Cucitura': 1120,
      'Incassatura normale': 2800,
      'Incassatura veloce': 4000,
      'Incassatura manuale': 350,
      'Piega': 4200,
      'Raccolta': 1120,
      'Stampa a caldo': 1050,
      'Taglio': 3000,
    } as const,

    // Expected velocity (pieces per hour) per area — used in Order Area Summary report (Ore Attese)
    // Represents the planned/standard velocity expected per area for an order
    // Units: pieces per hour (pz/h)
    AREA_EXPECTED_VELOCITY: {
      'Cellofanatura': 479,
      'Copertine': 852,
      'Cucitura': 472,
      'Incassatura normale': 698,
      'Incassatura veloce': 1292,
      'Piega': 2098,
      'Raccolta': 595,
      'Stampa a caldo': 323,
      'Taglio': 756,
    } as const,

    // Efficiency thresholds for color coding
    // Area efficiency (%): >= EXCELLENT green, >= ACCEPTABLE amber, below red
    // PDF reports: area trend (% change of efficiency between first and last period that counts as up / down),
    // how many best areas are listed, and the Sommario Ordini per Area target and client ranking
    PDF: {
      TREND_CHANGE_PERCENT: 5,
      TOP_AREAS: 2,
      ORDER_TARGET_EFFICIENCY: 100,
      // Bars stop at this efficiency so a very fast area does not push the others to nothing
      BAR_MAX_PERCENT: 120,
      // Clients with fewer expected hours are ranked only when there are not enough bigger ones
      CLIENT_MIN_EXPECTED_HOURS: 2,
      CLIENT_MIN_FOR_RANKING: 5,
      CLIENT_RANK_SIZE: 5,
    },

    EFFICIENCY_THRESHOLDS: {
      EXCELLENT: 60,
      ACCEPTABLE: 40,
    } as const,

    // Margin on revenue (%): >= GOOD green, >= FAIR amber, below red
    MARGIN_THRESHOLDS: {
      GOOD: 20,
      FAIR: 10,
    } as const,

    // Year passed to the report queries; they only use it when no date filter is set
    FALLBACK_YEAR: 2024,
    // Row limit meaning "every row, no paging" (Excel exports, PDFs, summaries)
    ALL_ROWS_LIMIT: 999999,
    // First year offered by the PDF period picker (data before it is not reliable)
    PDF_FIRST_YEAR: 2024,

    // Minimum work time threshold (minutes) for rows to be included in Order Area Summary
    // Used to filter out short/insignificant tasks (noise)
    MIN_WORK_TIME_MINUTES: 30,
    // Production report rows with less work than this (hours) are left out (stray clicks)
    MIN_ROW_WORK_HOURS: 0.1,
    // Order numbers that are not real orders (internal / placeholders), left out of Sommario Ordini per Area
    EXCLUDED_ORDER_NUMBERS: ['9990', '9998', '9999'],
    // Sommario Area: the quantity used for the speed gets this excess (2% spoilage)
    AREA_QUANTITY_EXCESS: 1.02,
    // Sommario Area: order lines asking for fewer pieces than this are ignored for the quantity (samples, tests)
    AREA_MIN_REQUESTED_QTY: 10,
    // The folding area: its quantity is the sum of completed pieces (Sommario Area) and its expected hours are
    // measured in sheets (fogli) instead of requested pieces (Sommario Ordini per Area)
    FOLDING_AREA: 'Piega',
  },

  // Blueprint Preview Defaults
  BLUEPRINT: {
    HINGE_GAP: 7,        // mm - Space between board and spine
    TURN_IN: 18,         // mm - Wrap around material
    BLEED: 0,            // mm - Extra print margin
  },

  // Presence / Auto-Exit Configuration
  PRESENCE: {
    // Time used for auto-generated EXT events on weekdays (Mon–Fri)
    AUTO_EXIT_TIME_WEEKDAY: '16:30:00',
    // Time used for auto-generated EXT events on Saturdays
    AUTO_EXIT_TIME_SATURDAY: '11:00:00',
    // Hour of day (24h) when the auto-exit check runs (e.g. 19 = 19:00)
    TRIGGER_HOUR: 19,
    // Monthly production Excel files ("01 Produzione gennaio 2026.xlsx") read by the Presenze Annuali report:
    // folders tried in order (share, then the mapped drive on the VM), and the 0-based columns used
    EXCEL_FOLDERS: ['\\\\SERVER2019\\Office\\Preventivi LeZana\\COOPERATIVA\\PRODUZIONE', 'Z:\\'],
    EXCEL_FILE_MARK: 'Produzione',
    EXCEL_COLUMNS: { WEEK: 38 /* AM */, HOURS: 39 /* AN */, GROUP: 40 /* AO */ },
    // GRUPPO value of the operators on the special second shift (their own start times and rules)
    TURNO2_GROUP: 'TURNO2',
    // Starting values of the "Aggiungi Evento" form in Daily Events
    NEW_EVENT_DEFAULTS: { operator: '98', event: 'EXT', time: '17:35:00' },
    // Event types the form can add
    NEW_EVENT_TYPES: ['ENT', 'EXT'],
  },

  // External Report Services
  REPORTS: {
    NETPRO_PDF_ENDPOINT: 'http://192.168.1.91/SFCClient/Attachment/getPDFReport',
    COMMESSA_REPORT_NAME: 'BSORGCOMM2_NP.RPT',
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
// PRESENCE RULES — DEFAULTS
// ============================================================================
// Default values for every presence formula (monthly hours, 8h check, prefill).
// Each key can be overridden at runtime from NETPRO.VALORI_TABELLE
// (TABELLA = 'PRESENZE') — see src/lib/presence/config.ts for the mapping.
// Formulas live in src/lib/presence/formulas/*. Never hardcode these numbers.

export const PRESENCE_RULES = {
  // --- Shift inference (from the first clock-in of the day) ---
  // Possible shift starts ("HH:MM"). The clock-in picks the shift as follows:
  //   • clock-in within SHIFT_SNAP_WINDOW_MINUTES *before* a shift start → that shift, counted from its start
  //   • otherwise → counted from the clock-in rounded UP to ENTRY_ROUNDING_MINUTES
  //   Example (06:30 / 07:30, window 30, step 15): 06:12 → 06:30, 06:31 → 06:45, 07:00 → 07:30, 07:31 → 07:45
  SHIFT_STARTS: ['06:30', '07:30', '08:30'],
  SHIFT_SNAP_WINDOW_MINUTES: 30,
  ENTRY_ROUNDING_MINUTES: 15,
  // Last clock-out is rounded DOWN to EXIT_ROUNDING_MINUTES: 16:34 → 16:30, 15:46 → 15:45
  EXIT_ROUNDING_MINUTES: 15,
  // Clock-in up to N minutes AFTER a shift start still counts from the shift start (0 = off).
  ENTRY_GRACE_MINUTES: 0,

  // --- Compensation of minor penalties ---
  // If the penalised total falls short of the workday by at most COMPENSATION_TOLERANCE_MINUTES
  // AND the real minutes (Σ clocked sessions, minus the flat pause when no pause was clocked)
  // reach the workday, the day is granted in full. 2 min late + short pause + 3 min late exit
  // → real 8:09 ≥ 8:00 → 8.0 instead of 7.5. Set to 0 to disable.
  COMPENSATION_TOLERANCE_MINUTES: 30,
  // The real minutes may fall short of the workday by up to this much and still count as reaching it.
  REAL_MINUTES_TOLERANCE: 5,

  // --- Worked hours: counted end − counted start − pause ---
  // The pause is flat (intermediate clock-outs/ins are ignored) and is deducted ONLY
  // when the counted span covers the whole pause window: leaving before 13:00 or
  // arriving after 12:00 means no pause was taken, so nothing is deducted.
  PAUSE_MINUTES: 60,
  PAUSE_WINDOW_START: '12:00',
  PAUSE_WINDOW_END: '13:00',

  // --- Day kinds (ISO weekdays: 1 = Mon … 7 = Sun) ---
  // working → full rules above (shift, penalties, pause, 8h, permesso, banca ore)
  // extra   → EXTRA_* rules below (Saturday: optional half day, straordinarie only)
  // any other weekday → off: nothing computed, nothing written
  WORKING_DAYS: [1, 2, 3, 4, 5],
  EXTRA_DAYS: [6],

  // --- Workday ---
  WORKDAY_HOURS: 8.0,

  // --- Extra day (Saturday) ---
  // No shift snap, no penalties, no pause: worked = last clock-out − first clock-in.
  // No records → nothing. Records → EXTRA_FIELD = min(EXTRA_MAX_HOURS, round(worked)).
  // Excess above EXTRA_MAX_HOURS is dropped (never banca ore).
  EXTRA_MAX_HOURS: 4.0,
  EXTRA_FIELD: 'ore_straordinarie',
  EXTRA_ROUNDING_STEP: 0.5,
  EXTRA_ROUNDING_MODE: 'floor',

  // --- Coverage check: sum(COVERED_FIELDS) must equal WORKDAY_HOURS ---
  COVERED_FIELDS: ['ore_ordinarie', 'ore_ferie', 'ore_permesso', 'ore_malattia'],

  // --- Prefill distribution ---
  // No clock-in → WORKDAY_HOURS into ABSENCE_FIELD
  ABSENCE_FIELD: 'ore_ferie',
  // 0 < worked < WORKDAY_HOURS → ordinarie rounded, remainder into PARTIAL_FILL_FIELD
  PARTIAL_FILL_FIELD: 'ore_permesso',
  ORDINARIE_ROUNDING_STEP: 0.5,
  ORDINARIE_ROUNDING_MODE: 'floor',
  // worked ≥ WORKDAY_HOURS → WORKDAY_HOURS ordinarie, excess into OVERFLOW_FIELD
  OVERFLOW_FIELD: 'banca_ore',
  OVERFLOW_MIN_HOURS: 0.5,
  OVERFLOW_ROUNDING_STEP: 0.5,
  OVERFLOW_ROUNDING_MODE: 'floor',

  // --- Per-operator exceptions (defaults empty; set in Impostazioni Presenze) ---
  // ORE_GIORNATA_OPERATORE = "12345=6, 67890=7" → those operators use 6h / 7h instead of WORKDAY_HOURS
  WORKDAY_HOURS_BY_OPERATOR: {} as Record<string, number>,

  // --- Quick tags ---
  FERIE_PRESETS: ['FESTA'],
  PERMESSO_PRESETS: ['ROL', 'VISITA MEDICA', 'LUTTO'],

  // --- Employee categories (OPERATORI.ENTITA → label + rule profile) ---
  // profile decides which formulas "Precompila" applies on working days:
  //   standard → shift snap, penalties, pause, 8h, permesso, banca ore (formulas above)
  //   fixed    → flat WORKDAY_HOURS ordinarie whenever nothing is filled, regardless of clock records
  //              (no penalties, no pause, no straordinari, no banca ore); Totale Ore shown raw
  //   none     → never prefilled
  // Extra days (Saturday) use the EXTRA_* rules for every profile except 'none'.
  CATEGORIES: [
    { reparto: '2', label: 'CLZ Produzione', defaultActive: true, profile: 'standard' },
    { reparto: '1001', label: 'Interinali', defaultActive: true, profile: 'standard' },
    { reparto: '3', label: 'CLZ Ufficio', defaultActive: false, profile: 'fixed' },
  ],
  OTHER_CATEGORY_LABEL: 'Altro',
} as const;

// ============================================================================
// OPERATION CATEGORIES
// ============================================================================
// Categories for organizing operations in the admin UI and pricing engine

// Display order = order of this list; the names shown are in it.ts → admin.operationCategories
export const OPERATION_CATEGORIES = ['internal', 'cover', 'gluing', 'casing_in', 'finishing', 'packaging', 'other'] as const;

// ============================================================================
