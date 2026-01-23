-- Migration: Cleanup all pricing except the authorized cover production modes
-- This starts a clean slate to add operations one-by-one safely.

-- 1. Delete pricing configs for operations we are about to remove
DELETE FROM pricing_configs 
WHERE operation_id IN (
    SELECT id FROM operations 
    WHERE slug NOT IN ('cover_standard', 'cover_fast', 'cover_manual')
);

-- 2. Delete operations that are not our core cover production modes
DELETE FROM operations 
WHERE slug NOT IN ('cover_standard', 'cover_fast', 'cover_manual');

-- 3. Clear materials (to be added one-by-one later)
DELETE FROM materials;
