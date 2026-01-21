import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// In a real environment, these would be process.env.NEXT_PUBLIC_SUPABASE_URL
// For this demo, we handle the case where they might be missing gracefully.
// We provide a valid URL format 'https://placeholder.supabase.co' to prevent createClient from throwing "supabaseUrl is required".
const supabaseUrl = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || 'https://placeholder.supabase.co';
const supabaseKey = (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || 'placeholder-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);