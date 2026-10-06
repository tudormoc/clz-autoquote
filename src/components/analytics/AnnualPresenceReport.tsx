'use client'

import { useState, useEffect } from 'react';
import { getPresenceDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Button } from '@/components/ui/Button';
import { PresenceData } from '@/types';
import { Clock, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { formatDayMonth } from '@/lib/format';

export function AnnualPresenceReport() {
    const [data, setData] = useState<PresenceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filesProcessed, setFilesProcessed] = useState(0);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            // Empty months array = all months
            const result = await getPresenceDataAction(2026, []);
            
            if (result.success && result.data) {
                setData(result.data);
                setFilesProcessed(result.filesProcessed || 0);
            } else {
                setError(result.error || 'Failed to load data');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

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
        let text = `Settimana ${weekNum}${dateRange ? ` (${dateRange})` : ''}\n`;
        
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-fg">
                        {APP_COPY.analytics.presence.annualTitle}
                    </h2>
                    <p className="text-sm text-fg-subtle mt-1">
                        {APP_COPY.analytics.presence.annualSubtitle}
                    </p>
                </div>
                <Button onClick={loadData} disabled={loading}>
                    <Clock className="w-4 h-4 mr-2" />
                    {loading ? APP_COPY.analytics.common.loading : APP_COPY.analytics.common.refresh}
                </Button>
            </div>

            {/* Info */}
            {filesProcessed > 0 && (
                <div className="text-sm text-fg-subtle">
                    {APP_COPY.analytics.presence.filesProcessed}: {filesProcessed}
                </div>
            )}

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
                <div className="space-y-6">
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
                                    <h3 className="text-lg font-semibold text-fg">
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
                                        <Copy className="w-4 h-4 mr-2" />
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
                                                    <td className="px-4 py-3 text-sm text-right text-fg">
                                                        {toWholeHours(item.hours)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-muted/50 font-semibold">
                                                <td className="px-4 py-3 text-sm text-fg">
                                                    {APP_COPY.analytics.presence.total}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-fg">
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
