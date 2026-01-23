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
          specifications: Json | null
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
          specifications?: Json | null
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
          specifications?: Json | null
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
      operations: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          category: 'internal' | 'cover' | 'packaging' | 'finishing' | 'other'
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          category: 'internal' | 'cover' | 'packaging' | 'finishing' | 'other'
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string | null
          category?: 'internal' | 'cover' | 'packaging' | 'finishing' | 'other'
          created_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          id: string
          category: 'paper' | 'cardboard' | 'cover_material' | 'foil' | 'glue' | 'other'
          name: string
          cost_per_unit: number
          unit_type: string
          properties: Json
          created_at: string
        }
        Insert: {
          id?: string
          category: 'paper' | 'cardboard' | 'cover_material' | 'foil' | 'glue' | 'other'
          name: string
          cost_per_unit: number
          unit_type: string
          properties?: Json
          created_at?: string
        }
        Update: {
          id?: string
          category?: 'paper' | 'cardboard' | 'cover_material' | 'foil' | 'glue' | 'other'
          name?: string
          cost_per_unit?: number
          unit_type?: string
          properties?: Json
          created_at?: string
        }
        Relationships: []
      }
      pricing_configs: {
        Row: {
          id: string
          operation_id: string
          setup_base_cost: number
          setup_variable_factor: number
          production_base_cost: number
          production_variable_factor: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          operation_id: string
          setup_base_cost?: number
          setup_variable_factor?: number
          production_base_cost?: number
          production_variable_factor?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          operation_id?: string
          setup_base_cost?: number
          setup_variable_factor?: number
          production_base_cost?: number
          production_variable_factor?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_configs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          }
        ]
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