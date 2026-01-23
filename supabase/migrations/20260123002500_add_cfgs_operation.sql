-- Migration: Add CFGS Operation (Cutting, Folding, Gathering, Sewing)
-- This is a combined operation for internal block processing.

-- 1. Create the Operation
INSERT INTO operations (slug, name, category, description) VALUES
('cfgs', 'Internal Block (CFGS)', 'internal', 'Combined Cutting, Folding, Gathering, and Sewing process')
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Set Pricing Config
-- Setup: 130 (Fixed) + 6 (per signature/imposition)
-- Production: 0.774 (per unit)
INSERT INTO pricing_configs (
    operation_id, 
    setup_base_cost, 
    setup_variable_factor, 
    production_base_cost, 
    production_variable_factor, 
    active
)
SELECT 
    id, 
    130.00, -- Fixed setup
    6.00,   -- Multiplier per signature
    0.7740, -- Production cost per unit
    0,      -- No variable production factor per signature
    true
FROM operations 
WHERE slug = 'cfgs'
ON CONFLICT (operation_id) DO UPDATE SET
    setup_base_cost = EXCLUDED.setup_base_cost,
    setup_variable_factor = EXCLUDED.setup_variable_factor,
    production_base_cost = EXCLUDED.production_base_cost,
    production_variable_factor = EXCLUDED.production_variable_factor,
    updated_at = now();
