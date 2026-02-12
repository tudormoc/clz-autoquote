-- ============================================================================
-- CLEANUP: Drop old multiplier columns and their constraints
-- ============================================================================

-- Step 1: Drop the old constraints first
PRINT 'Dropping old constraints...';

-- Drop discount_multiplier constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'chk_discount_multiplier')
BEGIN
    ALTER TABLE operations DROP CONSTRAINT chk_discount_multiplier;
    PRINT 'Dropped chk_discount_multiplier';
END

-- Drop surcharge_multiplier constraint (if exists)
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'chk_surcharge_multiplier')
BEGIN
    ALTER TABLE operations DROP CONSTRAINT chk_surcharge_multiplier;
    PRINT 'Dropped chk_surcharge_multiplier';
END

-- Check for any other constraints on these columns
PRINT 'Checking for other constraints...';
SELECT 
    cc.name AS constraint_name,
    c.name AS column_name
FROM sys.check_constraints cc
INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id
WHERE cc.parent_object_id = OBJECT_ID('operations')
    AND c.name IN ('discount_multiplier', 'surcharge_multiplier');
GO

-- Step 2: Now drop the old columns
PRINT 'Dropping old columns...';
ALTER TABLE operations DROP COLUMN discount_multiplier;
PRINT 'Dropped discount_multiplier';
GO

ALTER TABLE operations DROP COLUMN surcharge_multiplier;
PRINT 'Dropped surcharge_multiplier';
GO

-- Step 3: Verify final structure
PRINT '=== FINAL TABLE STRUCTURE ===';
SELECT * FROM operations;
GO

PRINT 'Cleanup complete! Old columns removed.';
