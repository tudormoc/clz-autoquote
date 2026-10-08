'use client'

import { errorMessage } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { getPresenceDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY, fmt } from '@/locales';
import { Button } from '@/components/ui/Button';
import { PresenceData } from '@/types';
import { Clock, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { formatDayMonth } from '@/lib/format';

const copy = APP_COPY.analytics.presence;

export function AnnualPresenceReport() {
    const year = new Date().getFullYear();
    const [data, setData] = useState<PresenceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filesProcessed, setFilesProcessed] = useState(0);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await getPresenceDataAction(year);

            if (result.success && result.data) {
                setData(result.data);
                setFilesProcessed(result.filesProcessed || 0);
            } else {
                setError(result.error || APP_COPY.common.loadError);
            }
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [year]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
        
        // Copy to clipboard silently
        copyToClipboard(text).catch(err => {
            console.error('Failed to copy:', err);
        });
    };

    return (
        <div className="space-y-4">
            {/* Year and files read on the left, reload on the right (the page title is above) */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
                <span>
                    <span className="font-semibold text-fg-strong">{fmt(copy.year, { year })}</span>
                    {filesProcessed > 0 && (
                        <>
                            {' · '}
                            {copy.filesProcessed}: <span className="font-mono text-fg-strong">{filesProcessed}</span>
                        </>
                    )}
                </span>
                <Button onClick={loadData} disabled={loading}>
                    <Clock size={16} />
                    {loading ? APP_COPY.analytics.common.loading : APP_COPY.analytics.common.refresh}
                </Button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-md">
                    <p className="text-sm text-danger">{error}</p>
                </div>
            )}

            {/* Loading */}
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

            {/* Empty State */}
            {!loading && !error && !data && (
                <div className="text-center py-12 text-fg-subtle">
                    {APP_COPY.analytics.common.noData}
                </div>
            )}
        </div>
    );
}
