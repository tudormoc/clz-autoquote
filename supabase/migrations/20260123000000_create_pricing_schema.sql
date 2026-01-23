-- Create operations table
CREATE TABLE IF NOT EXISTS public.operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('internal', 'cover', 'packaging', 'finishing', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create materials table
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('paper', 'cardboard', 'cover_material', 'foil', 'glue', 'other')),
    name TEXT NOT NULL,
    cost_per_unit DECIMAL(10, 4) NOT NULL, -- 4 decimal places for precision
    unit_type TEXT NOT NULL, -- e.g., 'sheet', 'm2', 'kg'
    properties JSONB DEFAULT '{}'::jsonb, -- Store dynamic props like 'thickness', 'weight'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create pricing_configs table
CREATE TABLE IF NOT EXISTS public.pricing_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
    setup_base_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    setup_variable_factor DECIMAL(10, 4) NOT NULL DEFAULT 0,
    production_base_cost DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Per unit cost might be small
    production_variable_factor DECIMAL(10, 4) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add triggers for updated_at using moddatetime (assumes extension is already enabled from previous migrations)
CREATE TRIGGER handle_pricing_configs_updated_at
    BEFORE UPDATE ON public.pricing_configs
    FOR EACH ROW
    EXECUTE PROCEDURE extensions.moddatetime (updated_at);

-- Enable Row Level Security
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_configs ENABLE ROW LEVEL SECURITY;

-- Create Policies (Read-only for public, Write policies would be for service_role/admin)
CREATE POLICY "Allow public read access on operations" ON public.operations FOR SELECT USING (true);
CREATE POLICY "Allow public read access on materials" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Allow public read access on pricing_configs" ON public.pricing_configs FOR SELECT USING (true);
