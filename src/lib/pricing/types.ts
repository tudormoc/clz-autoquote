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
  id: string; // operation slug
  name: string;
  cost: number;
  setup_cost?: number;
  production_cost?: number;
  unit_production_cost?: number;
  // Values before format surcharge / volume discount
  original_setup_cost?: number;
  original_unit_production_cost?: number;
  details?: string; // Second line under the name (CFGS: the signatures used)
}

export interface QuoteBreakdown {
  total_price: number;
  unit_price: number;
  items: CostItem[];
  metadata: {
    applied_discount?: number;
    applied_surcharge?: number;
    setup_total: number;
    production_total: number;
  };
}
