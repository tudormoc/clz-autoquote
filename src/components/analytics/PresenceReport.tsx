'use client'

import { useState, useEffect, useMemo } from 'react';
import { getMonthlyPresenceDataAction, getAvailableMonthsAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Button } from '@/components/ui/Button';
import { MonthlyPresenceData } from '@/types';
import { Clock, Copy } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';

export function PresenceReport() {
    const [data, setData] = useState<MonthlyPresenceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = All months
    const [filesProcessed, setFilesProcessed] = useState(0);
    const [availableMonths, setAvailableMonths] = useState<number[]>([]);

    const monthNamesMap = useMemo<Record<number, string>>(() => ({
        1: APP_COPY.months.january,
        2: APP_COPY.months.february,
        3: APP_COPY.months.march,
        4: APP_COPY.months.april,
        5: APP_COPY.months.may,
        6: APP_COPY.months.june,
        7: APP_COPY.months.july,
        8: APP_COPY.months.august,
        9: APP_COPY.months.september,
        10: APP_COPY.months.october,
        11: APP_COPY.months.november,
        12: APP_COPY.months.december
    }), []);

    const allMonths = useMemo(() => [
        { value: 0, label: APP_COPY.analytics.presence.allMonths },
        ...availableMonths.map(num => ({
            value: num,
            label: monthNamesMap[num] || `Mese ${num}`
        }))
    ], [availableMonths, monthNamesMap]);

    const checkAvailableMonths = async () => {
        try {
            const result = await getAvailableMonthsAction(2026);
            if (result.success && result.months.length > 0) {
                setAvailableMonths(result.months);
            }
        } catch (err) {
            console.error('Error checking available months:', err);
            setAvailableMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const monthsFilter = selectedMonth === 0 ? [] : [selectedMonth];
            const result = await getMonthlyPresenceDataAction(2026, monthsFilter);
            
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
        checkAvailableMonths();
    }, []);

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const formatHours = (hours: number) => {
        return Math.round(hours).toString();
    };

    const getMonthName = (monthNum: number): string => {
        return monthNamesMap[monthNum] || `Mese ${monthNum}`;
    };

    const copyTableToClipboard = (monthNum: number) => {
        if (!data) return;

        const monthKey = `month${monthNum}`;
        const monthData = data.groups
            .map(g => ({
                group: g.group,
                hours: (g[monthKey] as number) || 0
            }))
            .filter(d => d.hours > 0);
        
        const monthTotal = data.monthTotals[monthKey] || 0;
        const monthName = getMonthName(monthNum);
        
        // Build formatted text table with tabs for alignment
        let text = `${monthName} 2026\n`;
        
        monthData.forEach((item, idx) => {
            // First row: 2 tabs, second row onwards: 1 tab
            const tabs = idx === 0 ? '\t\t' : '\t';
            text += `${item.group}${tabs}${formatHours(item.hours)}\n`;
        });
        
        text += `${APP_COPY.analytics.presence.total}\t\t${formatHours(monthTotal)}\n`;
        
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
                    <h2 className="text-2xl font-semibold text-foreground">{APP_COPY.analytics.presence.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {APP_COPY.analytics.presence.subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-2 bg-card border border-border rounded-md text-foreground"
                    >
                        {allMonths.map(month => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>
                    <Button onClick={loadData} disabled={loading}>
                        <Clock className="w-4 h-4 mr-2" />
                        {loading ? APP_COPY.analytics.common.loading : APP_COPY.analytics.common.refresh}
                    </Button>
                </div>
            </div>

            {/* Info */}
            {filesProcessed > 0 && (
                <div className="text-sm text-muted-foreground">
                    {APP_COPY.analytics.presence.filesProcessed}: {filesProcessed}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">{APP_COPY.analytics.common.loading}</div>
                </div>
            )}

            {/* Data Tables - One per month */}
            {!loading && data && data.monthNumbers && (
                <div className="space-y-6">
                    {data.monthNumbers.map(monthNum => {
                        const monthKey = `month${monthNum}`;
                        const monthData = data.groups
                            .map(g => ({
                                group: g.group,
                                hours: (g[monthKey] as number) || 0
                            }))
                            .filter(d => d.hours > 0);
                        
                        const monthTotal = data.monthTotals[monthKey] || 0;
                        
                        if (monthTotal === 0) return null;
                        
                        return (
                            <div key={monthNum} className="border border-border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {getMonthName(monthNum)} 2026
                                    </h3>
                                    <Button
                                        onClick={() => copyTableToClipboard(monthNum)}
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
                                            {monthData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                                                        {item.group}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-foreground">
                                                        {formatHours(item.hours)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-muted/50 font-semibold">
                                                <td className="px-4 py-3 text-sm text-foreground">
                                                    {APP_COPY.analytics.presence.total}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-foreground">
                                                    {formatHours(monthTotal)}
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
            {!loading && !error && (!data || !data.monthNumbers || data.monthNumbers.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                    {APP_COPY.analytics.common.noData}
                </div>
            )}
        </div>
    );
}
