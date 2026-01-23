-- Seed Operations
INSERT INTO operations (slug, name, category) VALUES
('hardcover', 'Hardcover Binding', 'cover'),
('softcover', 'Softcover Binding', 'cover'),
('folding', 'Folding', 'internal'),
('casing_in', 'Casing In', 'cover'),
('packaging', 'Standard Packaging', 'packaging')
ON CONFLICT (slug) DO NOTHING;

-- Seed Pricing Configs
-- Hardcover: Setup 200, Prod 1.5
INSERT INTO pricing_configs (operation_id, setup_base_cost, setup_variable_factor, production_base_cost, production_variable_factor, active)
SELECT id, 200, 0, 1.5, 0, true 
FROM operations 
WHERE slug = 'hardcover' 
AND NOT EXISTS (SELECT 1 FROM pricing_configs WHERE operation_id = operations.id);

-- Softcover: Setup 150, Prod 0.8
INSERT INTO pricing_configs (operation_id, setup_base_cost, setup_variable_factor, production_base_cost, production_variable_factor, active)
SELECT id, 150, 0, 0.8, 0, true 
FROM operations 
WHERE slug = 'softcover' 
AND NOT EXISTS (SELECT 1 FROM pricing_configs WHERE operation_id = operations.id);

-- Folding: Setup 50 + 5/sig, Prod 0.05 + 0.01/sig
INSERT INTO pricing_configs (operation_id, setup_base_cost, setup_variable_factor, production_base_cost, production_variable_factor, active)
SELECT id, 50, 5, 0.05, 0.01, true 
FROM operations 
WHERE slug = 'folding' 
AND NOT EXISTS (SELECT 1 FROM pricing_configs WHERE operation_id = operations.id);

-- Casing In: Setup 100, Prod 0.2
INSERT INTO pricing_configs (operation_id, setup_base_cost, setup_variable_factor, production_base_cost, production_variable_factor, active)
SELECT id, 100, 0, 0.2, 0, true 
FROM operations 
WHERE slug = 'casing_in' 
AND NOT EXISTS (SELECT 1 FROM pricing_configs WHERE operation_id = operations.id);
