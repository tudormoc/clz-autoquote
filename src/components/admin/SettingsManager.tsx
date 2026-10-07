import { DollarSign, FileCode } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { APP_CONFIG } from '@/config/constants';
import { formatCurrency } from '@/lib/format';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.analyticsSettings;
const EXAMPLE_HOURS = 10;

/** Read-only view of the analytics settings kept in src/config/constants.ts (hourly labour rate). */
export function SettingsManager() {
    const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

    return (
        <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <DollarSign className="text-primary" size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-fg-strong">{copy.title}</h2>
                    <p className="text-sm text-fg-muted">{copy.subtitle}</p>
                </div>
            </div>

            <div className="bg-card/50 p-6 rounded-lg border border-border">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-medium text-fg-secondary mb-1">{copy.hourlyRate}</h3>
                        <p className="text-xs text-fg-subtle">{copy.hourlyRateHint}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-primary font-mono">{formatCurrency(hourlyRate)}</p>
                        <p className="text-xs text-fg-subtle mt-1">{copy.perHour}</p>
                    </div>
                </div>
                <div className="pt-4 border-t border-border">
                    <p className="text-xs text-fg-muted mb-2">{copy.example}</p>
                    <div className="bg-background p-3 rounded font-mono text-xs text-fg-secondary">
                        {fmt(copy.exampleLine, { hours: EXAMPLE_HOURS, rate: formatCurrency(hourlyRate), total: formatCurrency(hourlyRate * EXAMPLE_HOURS) })}
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border p-4 rounded-lg flex items-start gap-3">
                <FileCode className="text-primary mt-0.5" size={18} />
                <div className="flex-1">
                    <h3 className="text-sm font-medium text-fg-strong mb-2">{copy.howToEdit}</h3>
                    <p className="text-xs text-fg-muted mb-3">{copy.howToEditHint}</p>
                    <div className="bg-background p-3 rounded border border-border">
                        <code className="text-xs text-primary">src/config/constants.ts</code>
                        <div className="mt-2 text-xs text-fg-muted">
                            {copy.lookFor} <code className="text-fg-secondary">APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE</code>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
