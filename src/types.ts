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

export interface WeekDateRange {
    weekNumber: number;
    startDate: string;
    endDate: string;
}

export interface WeeklyGroupData {
    group: string;
    [key: string]: number | string;
}

export interface PresenceData {
    groups: WeeklyGroupData[];
    weekTotals: {
        [key: string]: number;
    };
    weekNumbers: number[];
    weekDateRanges: WeekDateRange[];
}

export interface MonthlyGroupData {
    group: string;
    [key: string]: number | string;
}

export interface MonthlyPresenceData {
    groups: MonthlyGroupData[];
    monthTotals: {
        [key: string]: number;
    };
    monthNumbers: number[];
}

export interface OperatorHoursRow {
    operatore: string;
    matricola: string | null;
    nome: string;
    gruppo: string | null;
    reparto: string | null;
    categoria: 'Interinali' | 'CLZ Produzione' | 'CLZ Ufficio' | 'Altro';
    turno: 'STD' | 'TURNO2';
    data: string;
    ora_inizio: string | null;
    ora_fine: string | null;
    sessioni_count: number;
    ore_lavoro: number;
    ore_totali: number;
    // Counted times after the entry/exit rules (src/lib/presence/formulas/counted-times.ts)
    turno_inizio: string | null;      // matched shift start ("HH:MM") or null when counted from rounded clock-in
    inizio_conteggiato: string | null; // "HH:MM"
    fine_conteggiata: string | null;   // "HH:MM"
    // Hours distribution fields (persisted in CLZDWHQANDPROG.presence_hours_distribution)
    ore_ordinarie: number | null;
    ore_straordinarie: number | null;
    ore_ferie: number | null;
    causale_ferie: string | null;
    ore_permesso: number | null;
    causale_permesso: string | null;
    ore_malattia: number | null;
    banca_ore: number | null;
    banca_ore_mese_n1: number | null;
    banca_ore_mese_n: number | null;
}

export type HoursDistributionField =
    | 'ore_ordinarie'
    | 'ore_straordinarie'
    | 'ore_ferie'
    | 'causale_ferie'
    | 'ore_permesso'
    | 'causale_permesso'
    | 'ore_malattia'
    | 'banca_ore'
    | 'banca_ore_mese_n1'
    | 'banca_ore_mese_n';

export interface PresenceSettingRow {
    TABELLA: string;
    PARAMETRO: string;
    VALORE: string;
    DESCRIZIONE: string | null;
    FVALUE01: number | null;
}

export interface CaricoDocument {
    anno: number;
    serie: string;
    numdoc: number;
    riga: number;
    datdoc: string;
    codart: string;
    descr: string;
    quant: number;
    valore: number;
    commeca: number;
}

export interface ReconciledMaterialRow {
    part_number: string;
    description: string;
    unit_of_measure: string;
    order_quantity: number;
    carico_quantity: number;
    diff_quantity: number;
    carico_valore: number;
    order_flevas?: string;
    status: 'MATCH' | 'DIFF' | 'ORDER_ONLY' | 'CARICO_ONLY';
    // Order row identifiers (movord)
    order_anno?: number;
    order_serie?: string;
    order_numord?: number;
    order_riga?: number;
    // Carico row identifiers (movmag)
    carico_anno?: number;
    carico_serie?: string;
    carico_numdoc?: number;
    carico_riga?: number;
    carico_prezzo?: number;
}

export interface ProductionOrderDocument {
    anno: number;
    serie: string;
    numord: number;
    riga: number;
    datord?: string;
    datcons?: string;
    codart: string;
    descr: string;
    quant: number;
    quaeva: number;
    flevas: string;
    commeca: number;
}

export interface MaterialReconciliationData {
    productionOrders: ProductionOrderDocument[];
    carichi: CaricoDocument[];
    materials: ReconciledMaterialRow[];
}

export interface DibaOperationRow {
    riga: number;
    fase: number;
    codlavo: number;
    descr_lavor: string;
    terzista: string;
    codcent: number;
    descr_centro: string;
    note: string;
    tesec: number;
    perqta: number;
    aggriga: string;
}

export interface DibaMaterialRow {
    riga: number;
    codfigli: string;
    description: string;
    quant: number;
    perpz: number;
    unmis: string;
}

export interface OrderMaterialSummaryRow {
    riga?: number;
    part_number: string;
    description: string;
    quant: number;
    unmis: string;
}

export interface OrderProductionOperationRow {
    id_oper: string;
    ordine: string;
    sequenza: number;
    descrizione: string;
    stato: string;
    centro_assegnato: string;
    machine_code: string;
    machine_name: string;
    area_name: string;
    note: string;
}

/** Phase of the Business production order (attivit + assris) */
export interface BusinessOrderOperationRow {
    fase: number;
    codlavo: number;
    descr_lavor: string;
    codcent: number;
    descr_centro: string;
    note: string;
}

export interface OrderOperationsManagementData {
    article_father: string;
    ordine_netpro: string;
    /** Full commessa of the edition shown (e.g. 260960410) */
    commessa_full?: string;
    order_bus_numord?: number;
    order_bus_anno?: number;
    order_bus_riga?: number;
    order_father_quant?: number;
    diba_operations: DibaOperationRow[];
    /** NetPro order phases (OPERAZIONI) */
    order_operations: OrderProductionOperationRow[];
    /** Business order phases (attivit + assris) */
    business_operations?: BusinessOrderOperationRow[];
    diba_materials?: DibaMaterialRow[];
    /** Business order materials (movord tipo Y) */
    order_materials?: OrderMaterialSummaryRow[];
    /** NetPro order materials (MATERIALI_ORDINI) */
    netpro_materials?: OrderMaterialSummaryRow[];
    has_discrepancies?: boolean;
    discrepancy_count?: number;
}



