/**
 * Labour rates of the analytics reports, changed in Impostazioni → Costo del Lavoro and kept in NETPRO.VALORI_TABELLE
 * (TABELLA 'ANALISI', see src/lib/settingsStore.ts). Until a rate is saved, its default from APP_CONFIG.ANALYTICS applies.
 *
 * - hourly: cost of one hour of NetPro work (labour cost and margin of Report Clienti, Ricavo Ordini and their PDF)
 * - partial: the part of it that turns an external supplier's cost into equivalent hours (Lavorazioni Esterne)
 */

import { APP_CONFIG } from '@/config/constants';
import { readSettingValues } from '@/lib/settingsStore';

export const LABOUR_RATES = {
    hourly: { name: 'COSTO_ORARIO_LAVORO', fallback: APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE },
    partial: { name: 'COSTO_ORARIO_PARZIALE', fallback: APP_CONFIG.ANALYTICS.PARTIAL_LABOR_RATE },
} as const;

export type LabourRateKey = keyof typeof LABOUR_RATES;
export type LabourRates = Record<LabourRateKey, number>;

const KEYS = Object.keys(LABOUR_RATES) as LabourRateKey[];

/** A rate the reports accept: a positive amount up to APP_CONFIG.ANALYTICS.MAX_LABOUR_RATE */
export function isValidLabourRate(value: number): boolean {
    return Number.isFinite(value) && value > 0 && value <= APP_CONFIG.ANALYTICS.MAX_LABOUR_RATE;
}

/**
 * The saved rates; a rate never saved (or saved as something that is no rate) is its default. A read that fails
 * throws to the report's own catch: until 2026-11-12 it answered the defaults, and a report then showed labour costs
 * and margins at a rate that was not the one set in Costo del Lavoro, as if right.
 */
export async function readLabourRates(): Promise<LabourRates> {
    const stored = await readSettingValues('ANALISI');
    return Object.fromEntries(
        KEYS.map((key) => {
            const value = Number(stored.get(LABOUR_RATES[key].name));
            return [key, isValidLabourRate(value) ? value : LABOUR_RATES[key].fallback];
        })
    ) as LabourRates;
}
