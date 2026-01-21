export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      materials: {
        Row: {
          id: string
          created_at: string
          name: string
          base_cost: number
          category: 'metal' | 'plastic' | 'wood' | 'composite'
          density_multiplier: number
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          base_cost: number
          category: string
          density_multiplier?: number
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          base_cost?: number
          category?: string
          density_multiplier?: number
        }
      }
      clients: {
        Row: {
          id: string
          created_at: string
          name: string
          tier: 'standard' | 'premium' | 'enterprise'
          discount_percentage: number
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          tier: string
          discount_percentage: number
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          tier?: string
          discount_percentage?: number
        }
      }
    }
  }
}

export type Material = Database['public']['Tables']['materials']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];