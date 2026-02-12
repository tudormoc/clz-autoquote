-- ============================================================================
-- ADD SETUP/PRODUCTION SPECIFIC MULTIPLIERS TO OPERATIONS TABLE
-- ============================================================================
-- This migration splits the existing multipliers into setup and production specific ones
-- 
-- BEFORE: discount_multiplier, surcharge_multiplier (apply to both setup and production)
-- AFTER:  discount_multiplier_setup, discount_multiplier_production,
--         surcharge_multiplier_setup, surcharge_multiplier_production
--
-- MIGRATION STRATEGY:
-- 1. Add new columns with default value 1.0
-- 2. Copy existing values to new columns (preserve current behavior)
-- 3. Drop old columns
-- ============================================================================

-- Step 1: Add new columns ONE BY ONE
PRINT 'Adding discount_multiplier_setup column...';
ALTER TABLE operations
ADD discount_multiplier_setup DECIMAL(3,2) NOT NULL DEFAULT 1.00;

PRINT 'Adding discount_multiplier_production column...';
ALTER TABLE operations
ADD discount_multiplier_production DECIMAL(3,2) NOT NULL DEFAULT 1.00;

PRINT 'Adding surcharge_multiplier_setup column...';
ALTER TABLE operations
ADD surcharge_multiplier_setup DECIMAL(3,2) NOT NULL DEFAULT 1.00;

PRINT 'Adding surcharge_multiplier_production column...';
ALTER TABLE operations
ADD surcharge_multiplier_production DECIMAL(3,2) NOT NULL DEFAULT 1.00;

PRINT 'All new columns added successfully.';

-- Step 2: Copy existing values to new columns (preserve current behavior)
PRINT 'Copying existing multiplier values to new columns...';

UPDATE operations
SET 
    discount_multiplier_setup = ISNULL(discount_multiplier, 1.00),
    discount_multiplier_production = ISNULL(discount_multiplier, 1.00),
    surcharge_multiplier_setup = ISNULL(surcharge_multiplier, 1.00),
    surcharge_multiplier_production = ISNULL(surcharge_multiplier, 1.00);

PRINT 'Values copied successfully.';
SELECT * FROM operations;

-- Step 3: Drop old columns
PRINT 'Dropping old multiplier columns...';

ALTER TABLE operations
DROP COLUMN discount_multiplier, surcharge_multiplier;

PRINT 'Old columns dropped successfully.';

-- Step 4: Add constraints to ensure values are between 0.00 and 1.00
PRINT 'Adding constraints...';

ALTER TABLE operations
ADD CONSTRAINT CK_discount_multiplier_setup_range 
    CHECK (discount_multiplier_setup >= 0.00 AND discount_multiplier_setup <= 1.00);

ALTER TABLE operations
ADD CONSTRAINT CK_discount_multiplier_production_range 
    CHECK (discount_multiplier_production >= 0.00 AND discount_multiplier_production <= 1.00);

ALTER TABLE operations
ADD CONSTRAINT CK_surcharge_multiplier_setup_range 
    CHECK (surcharge_multiplier_setup >= 0.00 AND surcharge_multiplier_setup <= 1.00);

ALTER TABLE operations
ADD CONSTRAINT CK_surcharge_multiplier_production_range 
    CHECK (surcharge_multiplier_production >= 0.00 AND surcharge_multiplier_production <= 1.00);

PRINT 'Constraints added successfully.';

-- Verify final structure
PRINT 'Final table structure:';
SELECT * FROM operations;

PRINT 'Migration completed successfully!';
