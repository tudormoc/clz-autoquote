-- Check what categories are currently in the operations table
SELECT DISTINCT category 
FROM operations 
ORDER BY category;

-- See all operations with their categories
SELECT id, slug, name, category 
FROM operations 
ORDER BY category, name;
