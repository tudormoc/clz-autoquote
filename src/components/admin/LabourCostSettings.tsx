import { Card } from '@/components/ui/Card';
import { APP_CONFIG } from '@/config/constants';
import { formatCurrency } from '@/lib/format';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.labourCost;
const EXAMPLE_HOURS = 10;

/** Hourly labour rate used by the analytics reports (APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE), shown with a worked example. */
export function LabourCostSettings() {
    const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

    return (
        <Card className="p-6 max-w-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-sm font-medium text-fg-secondary mb-1">{copy.hourlyRate}</h2>
                    <p className="text-xs text-fg-muted">{copy.hourlyRateHint}</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-bold text-primary font-mono">{formatCurrency(hourlyRate)}</p>
                    <p className="text-xs text-fg-muted mt-1">{copy.perHour}</p>
                </div>
            </div>
            <div className="pt-4 border-t border-border">
                <p className="text-xs text-fg-muted mb-2">{copy.example}</p>
                <div className="bg-background p-3 rounded font-mono text-xs text-fg-secondary">
                    {fmt(copy.exampleLine, { hours: EXAMPLE_HOURS, rate: formatCurrency(hourlyRate), total: formatCurrency(hourlyRate * EXAMPLE_HOURS) })}
                </div>
            </div>
        </Card>
    );
}
