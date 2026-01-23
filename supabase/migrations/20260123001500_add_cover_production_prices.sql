-- Migration: Add specific prices for Cover Production Modes
-- 0. Ensure operation_id is unique to support the ON CONFLICT clause and data integrity
ALTER TABLE pricing_configs DROP CONSTRAINT IF EXISTS pricing_configs_operation_id_key;
ALTER TABLE pricing_configs ADD CONSTRAINT pricing_configs_operation_id_key UNIQUE (operation_id);

-- 1. Ensure Operations exist
INSERT INTO operations (slug, name, category, description) VALUES
('cover_standard', 'Standard Cover Production', 'cover', 'Semi-automated cover production (Hörauf / Kolbus)'),
('cover_fast', 'Fast Cover Production', 'cover', 'High-speed automated production line'),
('cover_manual', 'Manual Cover Production', 'cover', 'Bespoke hand-made cover process')
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Set/Update Pricing Configs
-- Use CTE to map slugs to data easily
WITH pricing_data (slug, setup, prod) AS (
    VALUES 
        ('cover_standard', 80.00, 0.0900),
        ('cover_fast', 80.00, 0.0850),
        ('cover_manual', 155.00, 0.4200)
)
INSERT INTO pricing_configs (
    operation_id, 
    setup_base_cost, 
    setup_variable_factor, 
    production_base_cost, 
    production_variable_factor, 
    active
)
SELECT 
    o.id, 
    pd.setup, 
    0, -- variable setup factor
    pd.prod, 
    0, -- variable prod factor
    true
FROM operations o
JOIN pricing_data pd ON o.slug = pd.slug
ON CONFLICT (operation_id) DO UPDATE SET
    setup_base_cost = EXCLUDED.setup_base_cost,
    production_base_cost = EXCLUDED.production_base_cost,
    updated_at = now();
