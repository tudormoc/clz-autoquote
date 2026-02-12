export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Quote {
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
    customer_id: string | null
    customer_name: string | null
    status: string | null
    internal_notes: string | null
    applied_discount: number | null
    specifications: any | null // Parsed JSON
}

export type QuoteInsert = Omit<Partial<Quote>, 'id' | 'created_at' | 'updated_at'> & {
    book_name: string
    quantity: number
    width: number
    height: number
    pages: number
}

export type QuoteUpdate = Partial<Omit<Quote, 'id' | 'created_at'>>

export interface Operation {
    id: string
    slug: string
    name: string
    description: string | null
    category: 'internal' | 'cover' | 'gluing' | 'casing_in' | 'finishing' | 'packaging' | 'other'
    discount_multiplier_setup?: number
    discount_multiplier_production?: number
    surcharge_multiplier_setup?: number
    surcharge_multiplier_production?: number
    created_at?: string
}

export interface Material {
    id: string
    category: 'paper' | 'cardboard' | 'cover_material' | 'foil' | 'glue' | 'other'
    name: string
    cost_per_unit: number
    unit_type: string
    properties: Json
    created_at?: string
}

export interface PricingConfig {
    id: string
    operation_id: string
    setup_base_cost: number
    setup_variable_factor: number
    production_base_cost: number
    production_variable_factor: number
    active: boolean
    created_at?: string
    updated_at?: string
}

export interface DiscountTier {
    id?: number | string
    min_quantity: number
    max_quantity: number | null
    discount_percentage: number
    created_at?: string
}

export interface FormatSurcharge {
    id?: number | string
    width_min: number
    width_max: number
    height_min: number
    height_max: number
    surcharge_percentage: number
    created_at?: string
    updated_at?: string
}

export interface SignatureType {
    id: string
    name: string
    pages: number
    sort_order: number
    unit_price: number
    is_active?: boolean
    created_at?: string
    updated_at?: string
}

// Joined type for easier usage
export interface PricingRule extends Operation, PricingConfig {
    operation_name: string; // Alias for Operation.name
}
