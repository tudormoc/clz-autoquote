import { supabase } from '../lib/supabase';
import type { Quote, QuoteInsert, QuoteUpdate } from '../types/database';

// Helper to check if Supabase is actually configured with real credentials
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key && !url.includes('placeholder');
};

export const dataService = {
  /**
   * Fetches all quotes from Supabase
   */
  getQuotes: async (): Promise<Quote[]> => {
    if (!isSupabaseConfigured()) {
      console.warn("Supabase not configured. Returning empty list.");
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("Error fetching quotes:", e);
      return [];
    }
  },

  /**
   * Saves a new quote to Supabase
   */
  saveQuote: async (quote: QuoteInsert): Promise<{ data: Quote | null, error: any }> => {
    if (!isSupabaseConfigured()) {
      console.warn("Supabase not configured. Quote not saved.");
      return { data: null, error: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('quotes')
        .insert(quote)
        .select()
        .single();

      return { data, error };
    } catch (e) {
      console.error("Error saving quote:", e);
      return { data: null, error: e };
    }
  },

  /**
   * Updates an existing quote in Supabase
   */
  updateQuote: async (id: string, updates: QuoteUpdate): Promise<{ data: Quote | null, error: any }> => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (e) {
      console.error("Error updating quote:", e);
      return { data: null, error: e };
    }
  },

  /**
   * Fetches discount tiers from Supabase
   */
  getDiscountTiers: async () => {
    if (!isSupabaseConfigured()) {
      console.warn("Supabase not configured. Returning empty tiers.");
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('discount_tiers')
        .select('*')
        .order('min_quantity', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("Error fetching discount tiers:", e);
      return [];
    }
  }
};