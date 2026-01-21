import { describe, it, expect } from 'vitest';
import { calculateQuote } from './pricing-engine';
import { PRICING_CONSTANTS } from '../config/constants';
import type { Material, Client } from '../types/database';

// Mocks
const mockMaterial: Material = {
  id: '1',
  name: 'Test Steel',
  base_cost: 1000, // $1000 per m3
  category: 'metal',
  density_multiplier: 1,
  created_at: new Date().toISOString()
};

const mockClient: Client = {
  id: 'c1',
  name: 'Big Corp',
  tier: 'enterprise',
  discount_percentage: 10,
  created_at: new Date().toISOString()
};

describe('Pricing Engine', () => {
  it('calculates standard price correctly without discounts', () => {
    const request = {
      materialId: '1',
      quantity: 10,
      dimensions: { width: 100, height: 100, depth: 100 }, // 1,000,000 mm3 = 0.001 m3
      clientId: undefined
    };

    const result = calculateQuote(request, mockMaterial);

    // Volume per unit = 0.001 m3. Total volume = 0.01 m3.
    // Base Material Cost = 0.01 * 1000 = 10.
    // Metal Strategy Multiplier = 1.1.
    // Material Cost = 11.
    
    // Labor = Setup(100) + (Base(50) * (10 * 0.05)) = 100 + 25 = 125.
    
    // Subtotal = 136.
    
    expect(result.materialCost).toBeCloseTo(11);
    expect(result.laborCost).toBe(125);
    expect(result.totalPrice).toBe(136);
  });

  it('applies volume discount correctly', () => {
    const qty = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.MIN_QTY; // 100
    const request = {
      materialId: '1',
      quantity: qty,
      dimensions: { width: 100, height: 100, depth: 100 },
    };

    const result = calculateQuote(request, mockMaterial);
    
    // Check if discount was applied
    expect(result.breakdown.volumeDiscountPercent).toBe(PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.DISCOUNT);
    expect(result.volumeDiscountAmount).toBeGreaterThan(0);
  });

  it('applies client discount on top of volume discount', () => {
    const qty = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.MIN_QTY;
    const request = {
      materialId: '1',
      quantity: qty,
      dimensions: { width: 100, height: 100, depth: 100 },
      clientId: 'c1'
    };

    const result = calculateQuote(request, mockMaterial, mockClient);

    expect(result.breakdown.clientDiscountPercent).toBe(0.10);
    expect(result.clientDiscountAmount).toBeGreaterThan(0);
    // Ensure math order: (Subtotal - Volume) - Client
    const expectedSub = result.subtotal - result.volumeDiscountAmount;
    expect(result.clientDiscountAmount).toBeCloseTo(expectedSub * 0.10);
  });

  it('throws validation error for invalid dimensions', () => {
    const request = {
      materialId: '1',
      quantity: 10,
      dimensions: { width: -100, height: 100, depth: 100 }, // Invalid width
    };

    expect(() => calculateQuote(request, mockMaterial)).toThrow();
  });
});