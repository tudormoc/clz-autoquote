import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// In a real environment, these would be import.meta.env.VITE_SUPABASE_URL
// We provide a valid URL format 'https://placeholder.supabase.co' to prevent createClient from throwing "supabaseUrl is required".
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);