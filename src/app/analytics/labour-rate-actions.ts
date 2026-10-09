'use server'

/** Reading and saving the labour rates (Impostazioni → Costo del Lavoro). Storage and defaults: queries/shared/labour-rates.ts */

import { z } from 'zod';
import { LABOUR_RATES, isValidLabourRate, readLabourRates, type LabourRateKey, type LabourRates } from './queries/shared/labour-rates';
import { saveSettingValue } from '@/lib/settingsStore';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { authorize } from '@/lib/auth/access';

type Saved = { success: true } | { success: false; error: string };

const KeySchema = z.enum(Object.keys(LABOUR_RATES) as [LabourRateKey, ...LabourRateKey[]]);

export async function getLabourRatesAction(): Promise<LabourRates> {
    await authorize('view', '/settings/labour-cost');
    return readLabourRates();
}

/** Saves one rate (€ per hour); anything but a known rate and a sensible amount is refused */
export async function saveLabourRateAction(key: LabourRateKey, value: number): Promise<Saved> {
    await authorize('edit', '/settings/labour-cost');
    const parsedKey = KeySchema.safeParse(key);
    if (!parsedKey.success || typeof value !== 'number' || !isValidLabourRate(value)) {
        return { success: false, error: APP_COPY.admin.labourCost.invalid };
    }
    try {
        const rate = parsedKey.data;
        await saveSettingValue('ANALISI', LABOUR_RATES[rate].name, String(value), APP_COPY.admin.labourCost.rates[rate].label);
        return { success: true };
    } catch (error) {
        console.error('Labour rate save failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}
