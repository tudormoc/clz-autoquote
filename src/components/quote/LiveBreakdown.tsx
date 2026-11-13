import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROW_SUMMARY, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { EMPTY_VALUE, formatCurrency, formatNumber } from '@/lib/format';
import type { QuoteBreakdown } from '@/lib/pricing/types';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.breakdown;

/** Setup / unit price as listed before surcharge and discount (the total column has them applied) */
const listed = (original: number | undefined, current: number | undefined, decimals: number) => {
    const value = original || current;
    return value ? formatCurrency(value, decimals) : EMPTY_VALUE;
};

/** Live price breakdown of the quote being edited: one row per operation, totals and the adjustments applied. */
export function LiveBreakdown({ breakdown }: { breakdown: QuoteBreakdown | null }) {
    if (!breakdown) {
        return (
            <EmptyState title={copy.fillForm} />
        );
    }

    const { setup_total, production_total, applied_surcharge = 0, applied_discount = 0 } = breakdown.metadata;
    const adjustments = [
        { label: copy.formatSurcharge, sign: '+', percent: applied_surcharge, tone: 'text-warning-300' },
        { label: copy.volumeDiscount, sign: '-', percent: applied_discount, tone: 'text-success-500' },
    ].filter((adjustment) => adjustment.percent > 0);

    return (
        <Panel
            title={copy.title}
            aside={
                <div className="text-right">
                    <div className={titleClasses('page', 'font-mono')}>{formatCurrency(breakdown.total_price)}</div>
                    <div className="text-xs text-fg-subtle font-mono">
                        {formatCurrency(breakdown.unit_price)} {copy.unitPrice}
                    </div>
                </div>
            }
        >
            <Table>
                <TableHeader>
                    <TableRow still>
                        <TableHead className="w-[40%]">{copy.operation}</TableHead>
                        <TableHead className="text-right">{copy.setup}</TableHead>
                        <TableHead className="text-right">{copy.unit}</TableHead>
                        <TableHead className="text-right">{copy.total}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {breakdown.items.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center text-fg-subtle italic h-20">
                                {copy.noOperations}
                            </TableCell>
                        </TableRow>
                    )}
                    {breakdown.items.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span className="text-sm">{item.name}</span>
                                    {item.details && <span className="text-3xs text-fg-subtle font-normal">{item.details}</span>}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-fg-muted">
                                {listed(item.original_setup_cost, item.setup_cost, 2)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-fg-muted">
                                {listed(item.original_unit_production_cost, item.unit_production_cost, 4)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">{formatCurrency(item.cost)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter className="bg-muted/50">
                    <TableRow still className={ROW_SUMMARY}>
                        <TableCell colSpan={3} className="font-medium text-xs">{copy.setupTotal}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(setup_total)}</TableCell>
                    </TableRow>
                    <TableRow still className={cn(ROW_SUMMARY, 'border-t-0')}>
                        <TableCell colSpan={3} className="font-medium text-xs">{copy.productionTotal}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(production_total)}</TableCell>
                    </TableRow>
                    {adjustments.length > 0 && (
                        <>
                            <TableRow className="border-t border-border-strong">
                                <TableCell colSpan={4} className="py-2 text-xs text-fg-subtle font-normal">
                                    {copy.appliedAdjustments}
                                </TableCell>
                            </TableRow>
                            {adjustments.map(({ label, sign, percent, tone }) => (
                                <TableRow key={label} still className={ROW_SUMMARY}>
                                    <TableCell colSpan={3} className={`text-xs pl-6 ${tone}`}>
                                        {label} {sign}{formatNumber(percent * 100, 1)}%
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-fg-subtle">{copy.included}</TableCell>
                                </TableRow>
                            ))}
                        </>
                    )}
                </TableFooter>
            </Table>
        </Panel>
    );
}
