import { supabase } from '../lib/supabase';
import type { Material, Client } from '../types/database';

// Mock data to fall back on if no Supabase connection is available
const MOCK_MATERIALS: Material[] = [
  { id: '1', name: 'Aluminum 6061', base_cost: 2700, category: 'metal', density_multiplier: 1, created_at: new Date().toISOString() },
  { id: '2', name: 'Stainless Steel 304', base_cost: 4000, category: 'metal', density_multiplier: 1, created_at: new Date().toISOString() },
  { id: '3', name: 'ABS Plastic', base_cost: 1200, category: 'plastic', density_multiplier: 1, created_at: new Date().toISOString() },
  { id: '4', name: 'Oak Wood', base_cost: 1500, category: 'wood', density_multiplier: 1, created_at: new Date().toISOString() },
  { id: '5', name: 'Carbon Fiber', base_cost: 8000, category: 'composite', density_multiplier: 1, created_at: new Date().toISOString() },
];

const MOCK_CLIENTS: Client[] = [
  { id: 'c1', name: 'Guest (Standard)', tier: 'standard', discount_percentage: 0, created_at: new Date().toISOString() },
  { id: 'c2', name: 'TechStart (Premium)', tier: 'premium', discount_percentage: 5, created_at: new Date().toISOString() },
  { id: 'c3', name: 'MegaCorp (Enterprise)', tier: 'enterprise', discount_percentage: 15, created_at: new Date().toISOString() },
];

// Helper to check if Supabase is actually configured with real credentials
const isSupabaseConfigured = () => {
  return supabase.supabaseUrl && 
         supabase.supabaseKey && 
         !supabase.supabaseUrl.includes('placeholder');
};

export const dataService = {
  getMaterials: async (): Promise<Material[]> => {
    // Try fetch from Supabase if keys exist and aren't placeholders
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('materials').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn("Supabase fetch failed, falling back to mocks", e);
      }
    }
    
    // Fallback to mock
    console.warn("Using mock material data");
    return new Promise(resolve => setTimeout(() => resolve(MOCK_MATERIALS), 500));
  },

  getClients: async (): Promise<Client[]> => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('clients').select('*');
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn("Supabase fetch failed, falling back to mocks", e);
      }
    }
    
    // Fallback to mock
    console.warn("Using mock client data");
    return new Promise(resolve => setTimeout(() => resolve(MOCK_CLIENTS), 500));
  }
};