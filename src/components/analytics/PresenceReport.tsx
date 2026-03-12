'use client'

import { useState, useEffect } from 'react';
import { getPresenceDataAction } from '@/app/analytics/analytics-actions';
import { Button } from '@/components/ui/Button';
import { Clock, Copy } from 'lucide-react';

interface WeekDateRange {
    weekNumber: number;
    startDate: string;
    endDate: string;
}

interface WeeklyGroupData {
    group: string;
    [key: string]: number | string; // Dynamic week keys
}

interface PresenceData {
    groups: WeeklyGroupData[];
    weekTotals: {
        [key: string]: number; // Dynamic week keys
    };
    weekNumbers: number[]; // Available week numbers
    weekDateRanges: WeekDateRange[];
}

export function PresenceReport() {
    const [data, setData] = useState<PresenceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number>(3); // Default: March
    const [filesProcessed, setFilesProcessed] = useState(0);

    const months = [
        { value: 1, label: 'Gennaio' },
        { value: 2, label: 'Febbraio' },
        { value: 3, label: 'Marzo' }
    ];

    const loadData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await getPresenceDataAction(2026, [selectedMonth]);
            
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
    }, [selectedMonth]);

    const formatHours = (hours: number) => {
        return hours.toFixed(1);
    };

    const formatDateRange = (startDate: string, endDate: string) => {
        // Convert YYYY-MM-DD to DD/MM format
        const formatShort = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}`;
        };
        return `${formatShort(startDate)} - ${formatShort(endDate)}`;
    };

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
            text += `${item.group}${tabs}${formatHours(item.hours)}\n`;
        });
        
        text += `Totale\t\t${formatHours(weekTotal)}\n`;
        
        // Copy to clipboard silently
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy:', err);
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-foreground">Presenza Settimanale</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ore ordinarie per gruppo operatori
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-2 bg-card border border-border rounded-md text-foreground"
                    >
                        {months.map(month => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>
                    <Button onClick={loadData} disabled={loading}>
                        <Clock className="w-4 h-4 mr-2" />
                        {loading ? 'Caricamento...' : 'Aggiorna'}
                    </Button>
                </div>
            </div>

            {/* Info */}
            {filesProcessed > 0 && (
                <div className="text-sm text-muted-foreground">
                    File elaborati: {filesProcessed}
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
                    <div className="text-muted-foreground">Caricamento dati...</div>
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
                                    <h3 className="text-lg font-semibold text-foreground">
                                        Settimana {weekNum}
                                        {getWeekDateRange(weekNum) && (
                                            <span className="text-sm font-normal text-muted-foreground ml-2">
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
                                        Copia
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-border">
                                            {weekData.map((item, idx) => (
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
                                                    Totale
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-foreground">
                                                    {formatHours(weekTotal)}
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
                <div className="text-center py-12 text-muted-foreground">
                    Nessun dato disponibile
                </div>
            )}
        </div>
    );
}
