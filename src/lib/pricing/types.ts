export interface Operation {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: 'internal' | 'cover' | 'packaging' | 'finishing' | 'other';
}

export interface Material {
  id: string;
  category: 'paper' | 'cardboard' | 'cover_material' | 'foil' | 'glue' | 'other';
  name: string;
  cost_per_unit: number;
  unit_type: string;
  properties: Record<string, any>;
}

export interface PricingConfig {
  id: string;
  operation_id: string;
  setup_base_cost: number;
  setup_variable_factor: number;
  production_base_cost: number;
  production_variable_factor: number;
  active: boolean;
}

// Joined type for easier usage
export interface PricingRule extends Operation, PricingConfig {
  operation_name: string; // Alias for Operation.name
}

import { z } from 'zod';
import { QuoteInputSchema } from './validation';
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
