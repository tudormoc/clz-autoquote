'use client'

import { getPresenceDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY, fmt } from '@/locales';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { YearField } from '@/components/ui/YearField';
import { useAppliedQuery } from '@/hooks/useAppliedQuery';
import { Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { recentYears } from '@/lib/dateUtils';
import { formatDayMonth } from '@/lib/format';

const copy = APP_COPY.analytics.presence;
const thisYear = () => recentYears(1)[0];

/**
 * Presenze Annuali: the hours per group of every week of a year, read from the presence Excel files on "Applica" or
 * from a link that names the year (the files take a while to read, so a page opened bare loads nothing).
 */
export function AnnualPresenceReport() {
    const query = useAppliedQuery({
        initialFilters: () => ({ year: thisYear() }),
        load: (filters: { year: number }) => getPresenceDataAction(filters.year),
    });
    const { loading, error } = query;
    /** The year the tables show; null before "Applica" */
    const applied = query.applied?.year ?? null;
    // A year that could not be read shows its error, not the year read before it
    const result = error ? null : query.result;
    const data = result?.data ?? null;
    const filesProcessed = result?.filesProcessed ?? 0;

    // Plain whole hours (no thousands separator): also pasted into spreadsheets via the copy button
    const toWholeHours = (hours: number) => Math.round(hours).toString();

    const formatDateRange = (startDate: string, endDate: string) =>
        `${formatDayMonth(startDate)} - ${formatDayMonth(endDate)}`;

    const getWeekDateRange = (weekNum: number): string => {
        const range = data?.weekDateRanges?.find(r => r.weekNumber === weekNum);
        return range ? formatDateRange(range.startDate, range.endDate) : '';
    };

    const copyTableToClipboard = (weekNum: number) => {
        const weekKey = `week${weekNum}`;
        const weekData = data!.groups
            .map(g => ({
                group: g.group,
                hours: (g[weekKey] as number) || 0
            }))
            .filter(d => d.hours > 0);
        
        const weekTotal = data!.weekTotals[weekKey] || 0;
        const dateRange = getWeekDateRange(weekNum);
        
        // Build formatted text table with tabs for alignment
        let text = `${copy.week} ${weekNum}${dateRange ? ` (${dateRange})` : ''}\n`;
        
        weekData.forEach((item, idx) => {
            // First row: 2 tabs, second row onwards: 1 tab
            const tabs = idx === 0 ? '\t\t' : '\t';
            text += `${item.group}${tabs}${toWholeHours(item.hours)}\n`;
        });
        
        text += `${APP_COPY.analytics.presence.total}\t\t${toWholeHours(weekTotal)}\n`;
        
        copyToClipboard(text).catch(err => {
            console.error('Failed to copy:', err);
        });
    };

    return (
        <div className="space-y-4">
            <FilterPanel onApply={query.apply} onClear={query.clear} activeCount={query.activeFilterCount}>
                <YearField value={query.filters.year} onChange={(year) => query.updateFilters({ year })} />
            </FilterPanel>

            {/* The year shown and how many files were read */}
            {applied !== null && filesProcessed > 0 && (
                <p className="text-sm text-fg-muted">
                    <span className="font-semibold text-fg-strong">{fmt(copy.year, { year: applied })}</span>
                    {' · '}
                    {copy.filesProcessed}: <span className="font-mono text-fg-strong">{filesProcessed}</span>
                </p>
            )}

            {error && <EmptyState title={APP_COPY.common.loadError} description={error} />}

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="text-fg-subtle">{APP_COPY.analytics.common.loading}</div>
                </div>
            )}

            {/* Data Tables - One per week */}
            {!loading && data && data.weekNumbers && (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
                    {data.weekNumbers.map(weekNum => {
                        const weekKey = `week${weekNum}`;
                        const weekData = data.groups
                            .map(g => ({
                                group: g.group,
                                hours: (g[weekKey] as number) || 0
                            }))
                            .filter(d => d.hours > 0);
                        
                        const weekTotal = data.weekTotals[weekKey] || 0;
                        
                        if (weekTotal === 0) return null;
                        
                        return (
                            <div key={weekNum} className="border border-border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-fg">
                                        {APP_COPY.analytics.presence.week} {weekNum}
                                        {getWeekDateRange(weekNum) && (
                                            <span className="text-sm font-normal text-fg-subtle ml-2">
                                                ({getWeekDateRange(weekNum)})
                                            </span>
                                        )}
                                    </h3>
                                    <Button
                                        onClick={() => copyTableToClipboard(weekNum)}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <Copy size={14} />
                                        {APP_COPY.analytics.presence.copy}
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-border">
                                            {weekData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3 text-sm font-medium text-fg">
                                                        {item.group}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-mono text-fg">
                                                        {toWholeHours(item.hours)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-muted/50 font-semibold">
                                                <td className="px-4 py-3 text-sm text-fg">
                                                    {APP_COPY.analytics.presence.total}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-mono text-fg">
                                                    {toWholeHours(weekTotal)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Before "Applica", or a year without data */}
            {!loading && !error && !data && <EmptyState title={applied === null ? APP_COPY.analytics.applyFiltersHint : APP_COPY.analytics.common.noData} />}
        </div>
    );
}
