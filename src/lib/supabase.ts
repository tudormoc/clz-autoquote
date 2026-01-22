import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// In Next.js, use process.env.NEXT_PUBLIC_...
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);