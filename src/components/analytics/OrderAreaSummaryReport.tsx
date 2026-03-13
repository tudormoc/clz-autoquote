'use client';

import { useEffect, useState } from 'react';
import { getOrderAreaSummaryDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';
import { APP_CONFIG } from '@/config/constants';
import { SummaryCards } from '@/components/analytics/SummaryCards';

// Lookup table for expected velocity per area — sourced from constants (single source of truth)
const AREA_EXPECTED_VELOCITY = APP_CONFIG.ANALYTICS.AREA_EXPECTED_VELOCITY;

/**
 * Calculates expected hours for a commessa+area row.
 * Formula: qty_requested / AREA_EXPECTED_VELOCITY[area_name]
 * Returns null if velocity is 0 or qty_requested is null.
 */
function calcExpectedHours(areaName: string, qtyRequested: number | null): number | null {
    const velocity = AREA_EXPECTED_VELOCITY[areaName as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0;
    if (!velocity || qtyRequested == null) return null;
    return qtyRequested / velocity;
}

interface OrderAreaSummaryRow {
    commessa_full: string;
    commessa_display: string;
    order_description: string;
    area_name: string;
    work_time: number;
    qty_requested: number | null;
}

interface Filters {
    commessa: string;
    area: string;
    dateFrom: string;
    dateTo: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function OrderAreaSummaryReport() {
    const [data, setData] = useState<OrderAreaSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        commessa: '',
        area: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: '',
        direction: 'asc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig, refreshTrigger]);

    const loadData = async () => {
        setLoading(true);
        // Only pass sort when the user has explicitly selected a column
        const activeSort = sortConfig.column ? sortConfig : undefined;
        const result = await getOrderAreaSummaryDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            area: appliedFilters.area || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined,
        }, activeSort);

        if (result.success) {
            setData(result.data as OrderAreaSummaryRow[]);
            setTotal(result.pagination.total);
            setTotalPages(result.pagination.totalPages);
            setError(null);
        } else {
            setError(result.error ?? null);
        }
        setLoading(false);
    };

    const handleSort = (column: string) => {
        setSortConfig(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setPage(1);
    };

    const getSortIcon = (column: string) => {
        if (sortConfig.column !== column) {
            return <ArrowUpDown size={14} className="opacity-50" />;
        }
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={14} /> :
            <ArrowDown size={14} />;
    };

    const handleApplyFilters = () => {
        setAppliedFilters(filters);
        setPage(1);
        setSummaryData(null);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleClearFilters = () => {
        const cleared: Filters = {
            commessa: '',
            area: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd()
        };
        setFilters(cleared);
        setAppliedFilters(cleared);
        setSortConfig({ column: '', direction: 'asc' }); // no default sort
        setPage(1);
        setSummaryData(null);
    };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            // Only pass sort when a column is explicitly selected
            const activeSort = sortConfig.column ? sortConfig : undefined;
            const result = await getOrderAreaSummaryDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                area: appliedFilters.area || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined,
            }, activeSort, true);

            if (result.success && result.data.length > 0) {
                const rows = result.data as OrderAreaSummaryRow[];
                const excelData = rows.map(row => ({
                    [APP_COPY.analytics.orderAreaSummary.export.commessa]: Number(row.commessa_display),
                    [APP_COPY.analytics.orderAreaSummary.export.description]: row.order_description,
                    [APP_COPY.analytics.orderAreaSummary.export.area]: row.area_name,
                    [APP_COPY.analytics.orderAreaSummary.export.timeExpected]: (() => {
                        const h = calcExpectedHours(row.area_name, row.qty_requested);
                        return h != null ? Number(h.toFixed(2)) : '';
                    })(),
                    [APP_COPY.analytics.orderAreaSummary.export.workTime]: Number(row.work_time.toFixed(2)),
                    [APP_COPY.analytics.orderAreaSummary.export.qtyRequested]: row.qty_requested ?? '',
                }));

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 10 },
                    { wch: 30 },
                    { wch: 20 },
                    { wch: 12 },
                    { wch: 12 },
                    { wch: 15 },
                ];

                // Format commessa column as number
                const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                for (let r = 1; r <= range.e.r; r++) {
                    const cell = XLSX.utils.encode_cell({ r, c: 0 });
                    if (ws[cell]) {
                        ws[cell].t = 'n';
                        ws[cell].z = '0';
                    }
                }

                XLSX.utils.book_append_sheet(wb, ws, 'Order Area Summary');
                XLSX.writeFile(wb, `order_area_summary_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`);
            }
        } catch (err) {
            console.error('Export error:', err);
        }
        setLoading(false);
    };

    const formatTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const loadSummary = async () => {
        setSummaryLoading(true);
        try {
            const result = await getOrderAreaSummaryDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                area: appliedFilters.area || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined,
            }, undefined, true);

            if (result.success && result.data) {
                const rows = result.data as OrderAreaSummaryRow[];
                
                const grouped = new Map<string, any>();
                rows.forEach(row => {
                    const velocity = AREA_EXPECTED_VELOCITY[row.area_name as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0;
                    if (velocity <= 0) return;

                    const key = row.commessa_display;
                    if (!grouped.has(key)) {
                        grouped.set(key, {
                            display: row.commessa_display,
                            description: row.order_description,
                            total_time: 0,
                            total_expected: 0,
                            areas: []
                        });
                    }
                    
                    const group = grouped.get(key);
                    group.total_time += row.work_time;
                    
                    const expectedHours = calcExpectedHours(row.area_name, row.qty_requested);
                    if (expectedHours != null) {
                       group.total_expected += expectedHours;
                    }
                    
                    group.areas.push({
                        label: row.area_name,
                        time: row.work_time,
                        expected: expectedHours
                    });
                });
                
                const summaryArray = Array.from(grouped.values());
                summaryArray.sort((a, b) => a.display.localeCompare(b.display));
                
                setSummaryData(summaryArray);
            }
        } catch (err) {
            console.error('Failed to load summary', err);
        }
        setSummaryLoading(false);
    };

    const summaryItems = summaryData ? summaryData.map((group: any) => ({
        label: (
            <div className="flex flex-col min-w-0">
                <span className="font-mono text-primary truncate" title={group.display}>{group.display}</span>
                <span className="text-[10px] text-zinc-500 truncate" title={group.description}>{group.description}</span>
            </div>
        ),
        value: `${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatTime(group.total_time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${formatTime(group.total_expected)}`,
        subItems: group.areas.map((area: any) => ({
            label: area.label,
            value: `${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatTime(area.time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${area.expected != null ? formatTime(area.expected) : '—'}`
        }))
    })) : [];

    const handleCopySummary = () => {
        if (!summaryData) return;
        
        let text = `${APP_COPY.analytics.orderAreaSummary.stats.summary}\n\n`;
        
        summaryData.forEach((group: any) => {
            text += `${group.display} - ${group.description}\n`;
            text += `${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatTime(group.total_time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${formatTime(group.total_expected)}\n`;
            group.areas.forEach((area: any) => {
                 text += `  - ${area.label}:\t${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatTime(area.time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${area.expected != null ? formatTime(area.expected) : '—'}\n`;
            });
            text += '\n';
        });
        
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy summary:', err);
        });
    };

    if (loading && page === 1) {
        return (
            <div className="text-center py-12 text-zinc-400">
                {APP_COPY.analytics.loading}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-destructive">
                {APP_COPY.analytics.error}: {error}
            </div>
        );
    }

    interface Column {
        key: string;
        label: string;
        align: 'left' | 'right';
        noSort?: boolean;
    }

    const columns: Column[] = [
        { key: 'commessa', label: APP_COPY.analytics.orderAreaSummary.headers.commessa, align: 'left' },
        { key: 'area', label: APP_COPY.analytics.orderAreaSummary.headers.area, align: 'left' },
        { key: 'time_expected', label: APP_COPY.analytics.orderAreaSummary.headers.timeExpected, align: 'right', noSort: true },
        { key: 'time', label: APP_COPY.analytics.orderAreaSummary.headers.time, align: 'right' },
        { key: 'qty_requested', label: APP_COPY.analytics.orderAreaSummary.headers.qtyReq, align: 'right' },
    ];

    const tableHead = (
        <thead className="bg-zinc-900 border-b border-zinc-800">
            <tr>
                {columns.map(col => (
                    <th
                        key={col.key}
                        className={`px-4 py-3 text-${col.align} text-xs font-semibold text-zinc-400 ${col.noSort ? '' : 'cursor-pointer hover:text-primary transition-colors'}`}
                        onClick={col.noSort ? undefined : () => handleSort(col.key)}
                    >
                        <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : ''} gap-2`}>
                            {col.label}
                            {!col.noSort && getSortIcon(col.key)}
                        </div>
                    </th>
                ))}
            </tr>
        </thead>
    );

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-zinc-800 rounded-lg p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.common.dateFrom}
                            </label>
                            <DatePicker
                                value={filters.dateFrom}
                                onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.common.dateTo}
                            </label>
                            <DatePicker
                                value={filters.dateTo}
                                onChange={(value) => setFilters({ ...filters, dateTo: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.orderAreaSummary.headers.commessa}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.common.search}
                                value={filters.commessa}
                                onChange={(e) => setFilters({ ...filters, commessa: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.orderAreaSummary.headers.area}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.common.search}
                                value={filters.area}
                                onChange={(e) => setFilters({ ...filters, area: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button type="submit" className="flex items-center gap-2">
                            <Search size={16} />
                            {APP_COPY.analytics.common.apply}
                        </Button>
                        <Button type="button" onClick={handleClearFilters} variant="secondary" className="flex items-center gap-2">
                            <X size={16} />
                            {APP_COPY.analytics.common.clear}
                        </Button>
                        <Button type="button" onClick={handleExportExcel} variant="secondary" className="flex items-center gap-2 ml-auto">
                            <Download size={16} />
                            {loading ? APP_COPY.analytics.common.exporting : APP_COPY.analytics.common.exportExcel}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Summary Cards */}
            <SummaryCards
                items={summaryItems}
                loading={summaryLoading}
                onLoad={loadSummary}
                onCopy={handleCopySummary}
            />

            {/* Pagination stats */}
            <div className="flex items-center justify-between text-sm text-zinc-400">
                <div>
                    {APP_COPY.analytics.common.showing} <span className="text-white font-mono">{(page - 1) * limit + 1}</span> {APP_COPY.analytics.common.to}{' '}
                    <span className="text-white font-mono">{Math.min(page * limit, total)}</span> {APP_COPY.analytics.common.of}{' '}
                    <span className="text-white font-mono">{total}</span> {APP_COPY.analytics.common.records}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        variant="secondary"
                        className="flex items-center gap-1"
                    >
                        <ChevronLeft size={16} />
                        {APP_COPY.analytics.common.previous}
                    </Button>
                    <span className="text-zinc-400">
                        {APP_COPY.analytics.common.page} <span className="text-white font-mono">{page}</span> {APP_COPY.analytics.common.of}{' '}
                        <span className="text-white font-mono">{totalPages}</span>
                    </span>
                    <Button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        variant="secondary"
                        className="flex items-center gap-1"
                    >
                        {APP_COPY.analytics.common.next}
                        <ChevronRight size={16} />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-zinc-800 rounded-lg overflow-hidden">
                {data.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            {tableHead}
                            <tbody className="divide-y divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                                            {APP_COPY.analytics.common.loading}
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                                            {APP_COPY.analytics.empty}
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                                            {/* Commessa */}
                                            <td className="px-4 py-3 text-sm w-40">
                                                <div className="font-mono text-primary truncate max-w-[10rem]">{row.commessa_display}</div>
                                                <div className="text-xs text-zinc-500 truncate max-w-[10rem]" title={row.order_description}>{row.order_description}</div>
                                            </td>
                                            {/* Area */}
                                            <td className="px-4 py-3 text-sm text-zinc-300">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300">
                                                    {row.area_name}
                                                </span>
                                            </td>
                                            {/* Ore Attese: qty_requested / AREA_EXPECTED_VELOCITY[area] */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-zinc-400">
                                                {(() => {
                                                    const h = calcExpectedHours(row.area_name, row.qty_requested);
                                                    return h != null ? formatTime(h) : '—';
                                                })()}
                                            </td>
                                            {/* Ore Lavoro */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                                {formatTime(row.work_time)}
                                            </td>
                                            {/* Qta Richiesta */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                                {row.qty_requested?.toLocaleString() ?? '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <table className="w-full">
                        {tableHead}
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
