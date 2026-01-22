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