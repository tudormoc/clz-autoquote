import { z } from 'zod';
import { QuoteInputSchema } from './validation';
import {
  Operation,
  Material,
  PricingConfig,
  DiscountTier,
  PricingRule,
  SignatureType
} from '@/types';

export type {
  Operation,
  Material,
  PricingConfig,
  DiscountTier,
  PricingRule,
  SignatureType
};

export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export interface CostItem {
  id: string; // operation slug or material id
  name: string;
  type: 'setup' | 'production' | 'material';
  cost: number;
  setup_cost?: number;
  production_cost?: number;
  unit_production_cost?: number;
  details?: string; // "200 + (0.5 * 100)"
  discount_percentage?: number; // Discount applied to this line (0-1, e.g., 0.15 = 15%)
}

export interface QuoteBreakdown {
  total_price: number;
  unit_price: number;
  currency: string;
  items: CostItem[];
  metadata: {
    applied_discount?: number;
    setup_total: number;
    production_total: number;
    cover_production_type?: 'standard' | 'fast' | 'manual';
  };
}
