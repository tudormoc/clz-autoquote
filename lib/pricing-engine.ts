import { z } from 'zod';
import { PRICING_CONSTANTS } from '../config/constants';
import type { Material, Client } from '../types/database';

// --- Zod Schemas for Validation ---

export const QuoteRequestSchema = z.object({
  materialId: z.string().min(1, "Material is required"),
  quantity: z.number()
    .int()
    .min(PRICING_CONSTANTS.MIN_QUANTITY, `Minimum quantity is ${PRICING_CONSTANTS.MIN_QUANTITY}`)
    .max(PRICING_CONSTANTS.MAX_QUANTITY, `Maximum quantity is ${PRICING_CONSTANTS.MAX_QUANTITY}`),
  dimensions: z.object({
    width: z.number().min(PRICING_CONSTANTS.MIN_DIMENSION).max(PRICING_CONSTANTS.MAX_DIMENSION),
    height: z.number().min(PRICING_CONSTANTS.MIN_DIMENSION).max(PRICING_CONSTANTS.MAX_DIMENSION),
    depth: z.number().min(PRICING_CONSTANTS.MIN_DIMENSION).max(PRICING_CONSTANTS.MAX_DIMENSION),
  }),
  clientId: z.string().optional(), // Optional, defaults to standard rates if missing
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export interface QuoteResult {
  materialCost: number;
  laborCost: number;
  subtotal: number;
  volumeDiscountAmount: number;
  clientDiscountAmount: number;
  totalPrice: number;
  pricePerUnit: number;
  breakdown: {
    volumeDiscountPercent: number;
    clientDiscountPercent: number;
  };
}

// --- Strategy Pattern Interfaces ---

interface PricingStrategy {
  calculateMaterialCost(material: Material, volumeMm3: number, quantity: number): number;
}

// --- Concrete Strategies ---

class MetalPricingStrategy implements PricingStrategy {
  calculateMaterialCost(material: Material, volumeMm3: number, quantity: number): number {
    // Metal calculation might involve specific density checks or higher processing overhead
    const volumeM3 = volumeMm3 / 1e9; // convert mm3 to m3
    const base = volumeM3 * material.base_cost * quantity;
    return base * PRICING_CONSTANTS.MATERIAL_STRATEGY_MULTIPLIERS.metal;
  }
}

class PlasticPricingStrategy implements PricingStrategy {
  calculateMaterialCost(material: Material, volumeMm3: number, quantity: number): number {
    const volumeM3 = volumeMm3 / 1e9;
    const base = volumeM3 * material.base_cost * quantity;
    return base * PRICING_CONSTANTS.MATERIAL_STRATEGY_MULTIPLIERS.plastic;
  }
}

class WoodPricingStrategy implements PricingStrategy {
  calculateMaterialCost(material: Material, volumeMm3: number, quantity: number): number {
    const volumeM3 = volumeMm3 / 1e9;
    const base = volumeM3 * material.base_cost * quantity;
    return base * PRICING_CONSTANTS.MATERIAL_STRATEGY_MULTIPLIERS.wood;
  }
}

class DefaultPricingStrategy implements PricingStrategy {
  calculateMaterialCost(material: Material, volumeMm3: number, quantity: number): number {
    const volumeM3 = volumeMm3 / 1e9;
    return volumeM3 * material.base_cost * quantity; // No extra multiplier
  }
}

// --- Context / Factory ---

const getStrategy = (category: string): PricingStrategy => {
  switch (category) {
    case 'metal': return new MetalPricingStrategy();
    case 'plastic': return new PlasticPricingStrategy();
    case 'wood': return new WoodPricingStrategy();
    default: return new DefaultPricingStrategy();
  }
};

// --- Main Engine Function ---

export function calculateQuote(
  request: QuoteRequest,
  material: Material,
  client?: Client | null
): QuoteResult {
  // 1. Validation (Double check, though UI should handle it too)
  const validated = QuoteRequestSchema.parse(request);

  // 2. Geometry
  const volumeMm3 = validated.dimensions.width * validated.dimensions.height * validated.dimensions.depth;
  
  // 3. Material Cost Strategy
  const strategy = getStrategy(material.category);
  const materialCost = strategy.calculateMaterialCost(material, volumeMm3, validated.quantity);

  // 4. Labor Cost (Fixed + Variable based on qty)
  // Simple model: Setup fee + (Labor per unit * quantity * complexity factor)
  // Complexity factor approximated by volume for this demo
  const laborCost = PRICING_CONSTANTS.SETUP_FEE + (PRICING_CONSTANTS.BASE_LABOR_COST * (validated.quantity * 0.05));

  const subtotal = materialCost + laborCost;

  // 5. Volume Discounts
  let volumeDiscountPercent = 0;
  if (validated.quantity >= PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_3.MIN_QTY) {
    volumeDiscountPercent = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_3.DISCOUNT;
  } else if (validated.quantity >= PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_2.MIN_QTY) {
    volumeDiscountPercent = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_2.DISCOUNT;
  } else if (validated.quantity >= PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.MIN_QTY) {
    volumeDiscountPercent = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.DISCOUNT;
  }

  const volumeDiscountAmount = subtotal * volumeDiscountPercent;
  const afterVolumeDiscount = subtotal - volumeDiscountAmount;

  // 6. Client Discounts
  const clientDiscountPercent = client ? (client.discount_percentage / 100) : 0;
  const clientDiscountAmount = afterVolumeDiscount * clientDiscountPercent;
  
  const totalPrice = afterVolumeDiscount - clientDiscountAmount;

  return {
    materialCost: Number(materialCost.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    volumeDiscountAmount: Number(volumeDiscountAmount.toFixed(2)),
    clientDiscountAmount: Number(clientDiscountAmount.toFixed(2)),
    totalPrice: Number(totalPrice.toFixed(2)),
    pricePerUnit: Number((totalPrice / validated.quantity).toFixed(2)),
    breakdown: {
      volumeDiscountPercent,
      clientDiscountPercent
    }
  };
}