'use server'

/** Reading and saving the labour rates (Impostazioni → Costo del Lavoro). Storage and defaults: queries/shared/labour-rates.ts */

import { z } from 'zod';
import { LABOUR_RATES, isValidLabourRate, readLabourRates, type LabourRateKey, type LabourRates } from './queries/shared/labour-rates';
import { saveSettingValue } from '@/lib/settingsStore';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';
import { logEvent, personOf } from '@/lib/log/log';

/** The lines this file writes in the log (Registro) */
const log = APP_COPY.log.entries;

type Saved = { success: true } | { success: false; error: string };

const KeySchema = z.enum(Object.keys(LABOUR_RATES) as [LabourRateKey, ...LabourRateKey[]]);

/** The rates for Costo del Lavoro; when they cannot be read the page says so, it does not show the defaults as saved */
export async function getLabourRatesAction(): Promise<{ success: true; rates: LabourRates } | { success: false; error: string }> {
    await authorize('view', LINKS.settings['labour-cost']);
    try {
        return { success: true, rates: await readLabourRates() };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

/** Saves one rate (€ per hour); anything but a known rate and a sensible amount is refused */
export async function saveLabourRateAction(key: LabourRateKey, value: number): Promise<Saved> {
    const access = await authorize('edit', LINKS.settings['labour-cost']);
    const parsedKey = KeySchema.safeParse(key);
    if (!parsedKey.success || typeof value !== 'number' || !isValidLabourRate(value)) {
        return { success: false, error: APP_COPY.admin.labourCost.invalid };
    }
    try {
        const rate = parsedKey.data;
        const before = (await readLabourRates())[rate];
        await saveSettingValue('ANALISI', LABOUR_RATES[rate].name, String(value), APP_COPY.admin.labourCost.rates[rate].label);
        await logEvent(personOf(access), {
            page: LINKS.settings['labour-cost'],
            action: 'changed',
            entityKind: 'labour-rate',
            entityId: rate,
            summary: fmt(log.labourRate, { name: APP_COPY.admin.labourCost.rates[rate].label, from: before, value }),
            details: { before: { [rate]: before }, after: { [rate]: value } },
        });
        return { success: true };
    } catch (error) {
        console.error('Labour rate save failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}
