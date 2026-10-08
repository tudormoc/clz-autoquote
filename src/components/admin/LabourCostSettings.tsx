'use client';

import { useEffect, useState } from 'react';
import { getLabourRatesAction, saveLabourRateAction } from '@/app/analytics/labour-rate-actions';
import type { LabourRateKey, LabourRates } from '@/app/analytics/queries/shared/labour-rates';
import { Card } from '@/components/ui/Card';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/format';
import { notify } from '@/lib/notify';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.labourCost;
const RATE_KEYS = Object.keys(copy.rates) as LabourRateKey[];
const EXAMPLE_HOURS = 10;

/** The labour rates of the analytics reports: click an amount to change it; the reports use the new value at once. */
export function LabourCostSettings() {
    const [rates, setRates] = useState<LabourRates | null>(null);

    useEffect(() => {
        getLabourRatesAction().then(setRates).catch(notify.failure);
    }, []);

    if (!rates) {
        return (
            <Card className="max-w-2xl p-8 flex justify-center">
                <Spinner size={24} className="text-primary" />
            </Card>
        );
    }

    const save = async (key: LabourRateKey, draft: string) => {
        const value = Number(draft.replace(',', '.'));
        try {
            const res = await saveLabourRateAction(key, value);
            if (!res.success) {
                notify.error(res.error);
                return false;
            }
            setRates({ ...rates, [key]: value });
            notify.success(copy.saved);
            return true;
        } catch (err) {
            notify.failure(err);
            return false;
        }
    };

    return (
        <Card className="max-w-2xl divide-y divide-border">
            {RATE_KEYS.map((key) => (
                <div key={key} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-fg-strong">{copy.rates[key].label}</h2>
                        <p className="text-sm text-fg-muted mt-0.5">{copy.rates[key].hint}</p>
                        {key === 'hourly' && (
                            <p className="text-sm text-fg-muted mt-2">
                                {fmt(copy.exampleLine, {
                                    hours: EXAMPLE_HOURS,
                                    rate: formatCurrency(rates.hourly),
                                    total: formatCurrency(rates.hourly * EXAMPLE_HOURS),
                                })}
                            </p>
                        )}
                    </div>
                    <EditableCell
                        display={
                            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                                <span className="text-2xl font-bold text-primary font-mono">{formatCurrency(rates[key])}</span>
                                <span className="text-xs text-fg-muted">{copy.perHour}</span>
                            </span>
                        }
                        startValue={() => String(rates[key])}
                        renderEditor={(draft, setDraft) => (
                            <div className="w-28">
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min={0}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    className="font-mono text-right"
                                    autoFocus
                                />
                            </div>
                        )}
                        onSave={(draft) => save(key, draft)}
                    />
                </div>
            ))}
        </Card>
    );
}
