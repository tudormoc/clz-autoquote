export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Quote {
    id: string
    created_at: Date | null
    updated_at: Date | null
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
    specifications: unknown // The quote form values (JSON)
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

/** One presence event (EVENTI, TASK 'presenza') of the Daily Events list */
export interface PresenceEventRow {
    OGGETTO: string;
    operator_name: string | null;
    EVENTO: string;
    /** Stored wall-clock time (server actions keep Dates) */
    ORA_EVENTO: Date;
    /** NetPro's counter of the events of one instant: with operator, event and time it names the row */
    PROGRESSIVO: number;
}

/** Columns of presence_hours_distribution the monthly table may change (the server refuses any other) */
export const HOURS_DISTRIBUTION_FIELDS = [
    'ore_ordinarie',
    'ore_straordinarie',
    'ore_ferie',
    'causale_ferie',
    'ore_permesso',
    'causale_permesso',
    'ore_malattia',
    'banca_ore',
    'banca_ore_mese_n1',
    'banca_ore_mese_n',
] as const;

export type HoursDistributionField = (typeof HOURS_DISTRIBUTION_FIELDS)[number];

export interface PresenceSettingRow {
    TABELLA: string;
    PARAMETRO: string;
    VALORE: string;
    DESCRIZIONE: string | null;
    FVALUE01: number | null;
}

export interface DibaOperationRow {
    riga: number;
    fase: number;
    codlavo: number;
    descr_lavor: string;
    /** Done by a third party: 'S' or 'N', as Business holds it (cicli.dd_terzista) and as Riallinea writes it to the order */
    terzista: 'S' | 'N';
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
    /** Internal description of the article (ar_desint), copied to new order rows */
    desint?: string | null;
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

/** One edition (commessa) of a master order, as listed on the work progress page */
export interface OrderEdition {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    master_order_title?: string;
    client_name: string;
    /** NetPro order id */
    ordine?: string;
    part_number?: string;
}

/** A material row that stays on an order: its row in the order (mo_riga = NetPro SEQUENZA) and its code */
export interface KeptMaterial {
    riga: number;
    code: string;
}

/**
 * What Riallinea leaves on an order although the DiBa no longer has it, because it was already used
 * (src/lib/orders/syncBlocks.ts)
 */
export interface SyncKeeps {
    /** The phases somebody already worked on (fase numbers) */
    phases: number[];
    /** The material rows already withdrawn */
    materials: KeptMaterial[];
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
    /** Year and number of the impegno cliente behind the edition, when found */
    impegno_anno?: number;
    impegno_numord?: number;
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
    /** Why the comparison could not be read. With it the rest says nothing about the order: neither aligned nor not */
    load_error?: string;
    /** Why Riallinea would be refused as the order is now, in words (src/lib/orders/syncBlocks.ts); none when it would not */
    sync_blocks?: string[];
    /** What Riallinea leaves on the order although the DiBa no longer has it: phases already worked on, materials already withdrawn */
    sync_keeps?: SyncKeeps;
    /** The quantities of the edition in the impegno cliente, the Business order and the NetPro order (the "Quantità" tab) */
    quantities?: OrderQuantities;
    /** The title of the article in the same documents and the article masters (the "Articolo" tab) */
    article?: OrderArticle;
}

/** A distinct value found in a place and how many records hold it */
export interface PlaceValue<V> {
    value: V;
    rows: number;
}

/** A table and column of a document that holds the fact, with the distinct values found there */
export interface DocumentPlace<V> {
    table: string;
    column: string;
    values: PlaceValue<V>[];
    /** Text places: how many characters the column keeps (a longer title is cut there) */
    maxLength?: number;
}

/** The fact in one document: the value of its row (the one shown) and every place of the document that holds it */
export interface DocumentSide<V> {
    value?: V;
    places: DocumentPlace<V>[];
}

/** One fact of the edition in the impegno cliente (the truth), the Business production order and the NetPro order */
export interface DocumentFactRow<K extends string, V> {
    key: K;
    /** The document (none = not found) */
    impegno?: DocumentSide<V>;
    bus?: DocumentSide<V>;
    net?: DocumentSide<V>;
}

export type QuantityKey = 'ordered' | 'maxProduction';
export type OrderQuantityRow = DocumentFactRow<QuantityKey, number>;
export type ArticleKey = 'name' | 'composition' | 'width' | 'height' | 'pages';
export type OrderArticleRow = DocumentFactRow<ArticleKey, string>;

/** A comparison tab ("Quantità", "Articolo"): the impegno cliente behind the edition and its facts compared with the two orders */
export interface DocumentFacts<R> {
    /** Impegno cliente number ("2026/9999") when found */
    impegnoRef?: string;
    rows: R[];
}
export type OrderQuantities = DocumentFacts<OrderQuantityRow>;
export type OrderArticle = DocumentFacts<OrderArticleRow>;
