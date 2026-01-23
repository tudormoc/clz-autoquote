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

export interface QuoteInput {
  display_id?: string; // For referencing existing quotes
  client_name?: string;
  email?: string;
  project_title: string;
  quantity: number;
  format: {
    width: number;
    height: number;
  };
  pages: number;
  cover_details: {
    type: string; // e.g., 'hardcover', 'softcover'
    material_id?: string;
    finishings?: string[]; // slugs of operations
  };
  internals: {
    paper_material_id?: string;
    printing_type?: string;
  };
  packaging?: {
    type?: string;
  };
}

export interface CostItem {
  id: string; // operation slug or material id
  name: string;
  type: 'setup' | 'production' | 'material';
  cost: number;
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
  };
}
