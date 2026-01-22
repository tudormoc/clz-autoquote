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
      quotes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          book_name: string
          quantity: number
          width: number
          height: number
          pages: number
          total_price: number | null
          unit_price: number | null
          customer_email: string | null
          applied_discount: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          book_name: string
          quantity: number
          width: number
          height: number
          pages: number
          total_price?: number | null
          unit_price?: number | null
          customer_email?: string | null
          applied_discount?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          book_name?: string
          quantity?: number
          width?: number
          height?: number
          pages?: number
          total_price?: number | null
          unit_price?: number | null
          customer_email?: string | null
          applied_discount?: number | null
        }
        Relationships: []
      }
      discount_tiers: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          min_quantity: number
          max_quantity: number | null
          discount_percentage: number
        }
        Insert: {
          id?: number
          created_at?: string
          updated_at?: string
          min_quantity: number
          max_quantity?: number | null
          discount_percentage: number
        }
        Update: {
          id?: number
          created_at?: string
          updated_at?: string
          min_quantity?: number
          max_quantity?: number | null
          discount_percentage?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Quote = Database['public']['Tables']['quotes']['Row'];
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];

export type DiscountTier = Database['public']['Tables']['discount_tiers']['Row'];