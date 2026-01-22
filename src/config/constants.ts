export const PRICING_CONSTANTS = {
  // Volume thresholds for books
  VOLUME_DISCOUNT_THRESHOLDS: {
    TIER_1: { MIN_QTY: 100, DISCOUNT: 0.05 }, // 5% off
    TIER_2: { MIN_QTY: 500, DISCOUNT: 0.10 }, // 10% off
    TIER_3: { MIN_QTY: 1000, DISCOUNT: 0.15 }, // 15% off
  },

  // Base costs for bookbinding (Conceptual)
  BOOKBINDING: {
    BASE_FEE: 10,
    COST_PER_AREA_M2: 5,
    COST_PER_PAGE: 0.05,
  },

  // Validation Limits
  MAX_QUANTITY: 100000,
  MIN_QUANTITY: 1,
  MAX_DIMENSION: 1000, // mm (e.g. 1 meter max)
  MIN_DIMENSION: 50,   // mm (5cm min)
  MAX_PAGES: 2000,
  MIN_PAGES: 1,

  // Default Form Values
  DEFAULTS: {
    QUANTITY: 100,
    WIDTH: 210, // A4
    HEIGHT: 297, // A4
    PAGES: 120,
    BOOK_NAME: '',
  }
} as const;