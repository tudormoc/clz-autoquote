ALTER TABLE quotes ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb;
