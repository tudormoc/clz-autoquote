-- ============================================================================
-- ADD SETUP/PRODUCTION SPECIFIC MULTIPLIERS - STEP BY STEP
-- ============================================================================

-- First, let's verify the table exists and see current structure
PRINT '=== Current operations table structure ===';
SELECT TOP 1 * FROM operations;
GO

-- Step 1a: Add discount_multiplier_setup
PRINT 'Step 1a: Adding discount_multiplier_setup...';
ALTER TABLE operations ADD discount_multiplier_setup DECIMAL(3,2) NULL;
GO

-- Verify it was added
SELECT TOP 1 discount_multiplier_setup FROM operations;
GO

-- Step 1b: Add discount_multiplier_production
PRINT 'Step 1b: Adding discount_multiplier_production...';
ALTER TABLE operations ADD discount_multiplier_production DECIMAL(3,2) NULL;
GO

-- Step 1c: Add surcharge_multiplier_setup
PRINT 'Step 1c: Adding surcharge_multiplier_setup...';
ALTER TABLE operations ADD surcharge_multiplier_setup DECIMAL(3,2) NULL;
GO

-- Step 1d: Add surcharge_multiplier_production
PRINT 'Step 1d: Adding surcharge_multiplier_production...';
ALTER TABLE operations ADD surcharge_multiplier_production DECIMAL(3,2) NULL;
GO

PRINT 'All columns added! Now copying values...';

-- Step 2: Copy existing values
UPDATE operations
SET 
    discount_multiplier_setup = ISNULL(discount_multiplier, 1.00),
    discount_multiplier_production = ISNULL(discount_multiplier, 1.00),
    surcharge_multiplier_setup = ISNULL(surcharge_multiplier, 1.00),
    surcharge_multiplier_production = ISNULL(surcharge_multiplier, 1.00);
GO

PRINT 'Values copied! Checking results...';
SELECT * FROM operations;
GO

-- Step 3: Make columns NOT NULL with default
PRINT 'Making columns NOT NULL...';
ALTER TABLE operations ALTER COLUMN discount_multiplier_setup DECIMAL(3,2) NOT NULL;
ALTER TABLE operations ALTER COLUMN discount_multiplier_production DECIMAL(3,2) NOT NULL;
ALTER TABLE operations ALTER COLUMN surcharge_multiplier_setup DECIMAL(3,2) NOT NULL;
ALTER TABLE operations ALTER COLUMN surcharge_multiplier_production DECIMAL(3,2) NOT NULL;
GO

-- Step 4: Drop old columns
PRINT 'Dropping old columns...';
ALTER TABLE operations DROP COLUMN discount_multiplier;
ALTER TABLE operations DROP COLUMN surcharge_multiplier;
GO

-- Step 5: Add constraints
PRINT 'Adding constraints...';
ALTER TABLE operations ADD CONSTRAINT CK_discount_multiplier_setup_range 
    CHECK (discount_multiplier_setup >= 0.00 AND discount_multiplier_setup <= 1.00);
ALTER TABLE operations ADD CONSTRAINT CK_discount_multiplier_production_range 
    CHECK (discount_multiplier_production >= 0.00 AND discount_multiplier_production <= 1.00);
ALTER TABLE operations ADD CONSTRAINT CK_surcharge_multiplier_setup_range 
    CHECK (surcharge_multiplier_setup >= 0.00 AND surcharge_multiplier_setup <= 1.00);
ALTER TABLE operations ADD CONSTRAINT CK_surcharge_multiplier_production_range 
    CHECK (surcharge_multiplier_production >= 0.00 AND surcharge_multiplier_production <= 1.00);
GO

PRINT '=== MIGRATION COMPLETE ===';
SELECT * FROM operations;
GO
