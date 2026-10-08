import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/format';
import type { QuoteBreakdown } from '@/lib/pricing/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.breakdown;

interface QuoteTotalBarProps {
    breakdown: QuoteBreakdown | null;
    /** Scrolls to the full price breakdown */
    onShowDetail: () => void;
}

/** Phones: the live total pinned to the bottom of the screen while the quote form is filled in. */
export function QuoteTotalBar({ breakdown, onShowDetail }: QuoteTotalBarProps) {
    if (!breakdown) return null;

    return (
        <div className="lg:hidden sticky bottom-0 z-20 -mx-4 px-4 py-3 flex items-center justify-between gap-3 border-t border-border bg-card/95 backdrop-blur">
            <div className="min-w-0">
                <div className="text-lg font-bold text-fg-strong font-mono">{formatCurrency(breakdown.total_price)}</div>
                <div className="text-xs text-fg-muted font-mono">
                    {formatCurrency(breakdown.unit_price)} {copy.unitPrice}
                </div>
            </div>
            <Button type="button" variant="secondary" onClick={onShowDetail}>
                {copy.showDetail}
                <ChevronDown size={16} />
            </Button>
        </div>
    );
}
