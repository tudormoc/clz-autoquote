export const PRICING_CONSTANTS = {
  // Base operational costs
  BASE_LABOR_COST: 50,
  SETUP_FEE: 100,
  
  // Volume thresholds
  VOLUME_DISCOUNT_THRESHOLDS: {
    TIER_1: { MIN_QTY: 100, DISCOUNT: 0.05 }, // 5% off
    TIER_2: { MIN_QTY: 500, DISCOUNT: 0.10 }, // 10% off
    TIER_3: { MIN_QTY: 1000, DISCOUNT: 0.15 }, // 15% off
  },

  // Strategy specific multipliers (e.g. waste factor)
  MATERIAL_STRATEGY_MULTIPLIERS: {
    metal: 1.1, // 10% waste/processing overhead
    plastic: 1.05,
    wood: 1.2,
    composite: 1.3
  },

  // Validation Limits
  MAX_QUANTITY: 100000,
  MIN_QUANTITY: 1,
  MAX_DIMENSION: 5000, // mm
  MIN_DIMENSION: 1, // mm
} as const;