-- Create quotes table with essential columns for book quoting
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    book_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    width DECIMAL NOT NULL,
    height DECIMAL NOT NULL,
    pages INTEGER NOT NULL
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Simple policy for development (allow all access)
CREATE POLICY "Public Access" ON public.quotes FOR ALL USING (true);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
