'use client';

import { useEffect, useState } from 'react';
import { getOrderAreaSummaryDataAction } from '@/app/analytics/analytics-actions';
import { generateOrderAreaSummaryPDFAction } from '@/app/analytics/pdf-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { MonthSelectorModal } from './MonthSelectorModal';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';
import { APP_CONFIG } from '@/config/constants';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { copyToClipboard } from '@/lib/clipboard';
import { formatHours, formatNumber } from '@/lib/format';

// Lookup table for expected velocity per area — sourced from constants (single source of truth)
const AREA_EXPECTED_VELOCITY = APP_CONFIG.ANALYTICS.AREA_EXPECTED_VELOCITY;

/**
 * Calculates expected hours for a commessa+area row.
 * For 'Piega': fogli / AREA_EXPECTED_VELOCITY
 * For others: qty_requested / AREA_EXPECTED_VELOCITY
 * Returns null if velocity is 0 or target value is null.
 */
function calcExpectedHours(areaName: string, qtyRequested: number | null, fogli: number | null = null): number | null {
    const velocity = AREA_EXPECTED_VELOCITY[areaName as keyof typeof AREA_EXPECTED_VELOCITY] ?? 0;
    if (!velocity) return null;

    if (areaName === 'Piega') {
        if (fogli == null) return null;
        return fogli / velocity;
    }

    if (qtyRequested == null) return null;
    return qtyRequested / velocity;
}

interface OrderAreaSummaryRow {
    commessa_full: string;
    commessa_display: string;
    order_description: string;
    area_name: string;
    work_time: number;
    qty_requested: number | null;
    pages: number | null;
    composition: string | null;
    fogli: number | null;
    client_name: string | null;
}
interface Filters {
    commessa: string;
    area: string;
    dateFrom: string;
    dateTo: string;
    complexOnly: boolean;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function OrderAreaSummaryReport() {
    const [data, setData] = useState<OrderAreaSummaryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showMonthModal, setShowMonthModal] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        commessa: '',
        area: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd(),
        complexOnly: false
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: '',
        direction: 'asc'
    });

    const limit = 100;

    useEffect(() => {
        if (appliedFilters !== null) {
            loadData();
        }
    }, [page, appliedFilters, sortConfig, refreshTrigger]);

    const loadData = async () => {
        if (!appliedFilters) return;
        
        setLoading(true);
        // Only pass sort when the user has explicitly selected a column
        const activeSort = sortConfig.column ? sortConfig : undefined;
        const result = await getOrderAreaSummaryDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            area: appliedFilters.area || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined,
            complexOnly: appliedFilters.complexOnly
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

    const handleGeneratePDF = async (year: number, months: number[], separateByArea: boolean, format: 'A4' | 'A3') => {
        if (!appliedFilters) return;
        
        setPdfLoading(true);
        try {
            // If separateByArea is true and no specific area filter is active, 
            // generate one PDF for each area visible in the current results.
            const areasToProcess = (separateByArea && !appliedFilters.area)
                ? Array.from(new Set(data.map(row => row.area_name)))
                : [appliedFilters.area || undefined];

            for (const area of areasToProcess) {
                const result = await generateOrderAreaSummaryPDFAction(
                    year, 
                    months, 
                    appliedFilters.commessa || undefined, 
                    area,
                    format,
                    appliedFilters.complexOnly
                );
                
                if (result.success && result.pdf) {
                    const byteCharacters = atob(result.pdf);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                    
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = result.filename;
                    document.body.appendChild(a);
                    a.click();
                    
                    setTimeout(() => {
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }, 100);

                    if (areasToProcess.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 600));
                    }
                } else {
                    console.error(`PDF generation failed for area ${area}:`, result.error);
                }
            }
            
            setShowMonthModal(false);
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF');
        } finally {
            setPdfLoading(false);
        }
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
    };

    const handleClearFilters = () => {
        const cleared: Filters = {
            commessa: '',
            area: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd(),
            complexOnly: false
        };
        setFilters(cleared);
        setAppliedFilters(null);
        setData([]);
        setTotal(0);
        setTotalPages(1);
        setSortConfig({ column: '', direction: 'asc' });
        setPage(1);
        setSummaryData(null);
    };

    const handleExportExcel = async () => {
        if (!appliedFilters) return;
        
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
                    [APP_COPY.analytics.common.client]: row.client_name ?? '',
                    [APP_COPY.analytics.orderAreaSummary.export.area]: row.area_name,
                    [APP_COPY.analytics.orderAreaSummary.export.composition]: row.composition ?? '',
                    [APP_COPY.analytics.orderAreaSummary.export.fogli]: row.fogli ?? '',
                    [APP_COPY.analytics.orderAreaSummary.export.pages]: row.pages ?? '',
                    [APP_COPY.analytics.orderAreaSummary.export.timeExpected]: (() => {
                        const h = calcExpectedHours(row.area_name, row.qty_requested, row.fogli);
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
                    { wch: 25 }, // client
                    { wch: 20 },
                    { wch: 20 },
                    { wch: 10 },
                    { wch: 10 },
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

    const loadSummary = async () => {
        if (!appliedFilters) return;
        
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
                            client: row.client_name ?? '',
                            total_time: 0,
                            total_expected: 0,
                            areas: []
                        });
                    }
                    
                    const group = grouped.get(key);
                    group.total_time += row.work_time;
                    
                    const expectedHours = calcExpectedHours(row.area_name, row.qty_requested, row.fogli);
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
                <span className="font-mono text-primary truncate" title={`${group.display}${group.client ? ' - ' + group.client : ''}`}>
                    {group.display}
                    {group.client ? <span className="font-sans text-fg-muted font-medium ml-2">- {group.client}</span> : null}
                </span>
                <span className="text-3xs text-fg-subtle truncate" title={group.description}>
                    {group.description}
                </span>
            </div>
        ),
        value: `${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatHours(group.total_time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${formatHours(group.total_expected)}`,
        subItems: group.areas.map((area: any) => ({
            label: area.label,
            value: `${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatHours(area.time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${area.expected != null ? formatHours(area.expected) : '—'}`
        }))
    })) : [];

    const handleCopySummary = () => {
        if (!summaryData) return;
        
        let text = `${APP_COPY.analytics.orderAreaSummary.stats.summary}\n\n`;
        
        summaryData.forEach((group: any) => {
            const clientStr = group.client ? ` - ${group.client}` : '';
            text += `${group.display}${clientStr} - ${group.description}\n`;
            text += `${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatHours(group.total_time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${formatHours(group.total_expected)}\n`;
            group.areas.forEach((area: any) => {
                 text += `  - ${area.label}:\t${APP_COPY.analytics.orderAreaSummary.stats.timeWorked}: ${formatHours(area.time)} | ${APP_COPY.analytics.orderAreaSummary.stats.timeExpected}: ${area.expected != null ? formatHours(area.expected) : '—'}\n`;
            });
            text += '\n';
        });
        
        copyToClipboard(text).catch(err => {
            console.error('Failed to copy summary:', err);
        });
    };

    if (loading && page === 1 && appliedFilters !== null) {
        return (
            <div className="text-center py-12 text-fg-muted">
                {APP_COPY.analytics.loading}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-danger">
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
        { key: 'client_name', label: APP_COPY.analytics.common.client, align: 'left' },
        { key: 'area', label: APP_COPY.analytics.orderAreaSummary.headers.area, align: 'left' },
        { key: 'composition', label: APP_COPY.analytics.orderAreaSummary.headers.composition, align: 'left' },
        { key: 'fogli', label: APP_COPY.analytics.orderAreaSummary.headers.fogli, align: 'right' },
        { key: 'pages', label: APP_COPY.analytics.orderAreaSummary.headers.pages, align: 'right' },
        { key: 'time_expected', label: APP_COPY.analytics.orderAreaSummary.headers.timeExpected, align: 'right', noSort: true },
        { key: 'time', label: APP_COPY.analytics.orderAreaSummary.headers.time, align: 'right' },
        { key: 'qty_requested', label: APP_COPY.analytics.orderAreaSummary.headers.qtyReq, align: 'right' },
    ];

    const tableHead = (
        <thead className="bg-card border-b border-border">
            <tr>
                {columns.map(col => (
                    <th
                        key={col.key}
                        className={`px-4 py-3 text-${col.align} text-xs font-semibold text-fg-muted ${col.noSort ? '' : 'cursor-pointer hover:text-primary transition-colors'}`}
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
        <>
            <MonthSelectorModal
                isOpen={showMonthModal}
                onClose={() => setShowMonthModal(false)}
                onGenerate={handleGeneratePDF}
                loading={pdfLoading}
                title={APP_COPY.analytics.orderAreaSummary.pdfTitle}
            />
            <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-lg p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                {APP_COPY.analytics.common.dateFrom}
                            </label>
                            <DatePicker
                                value={filters.dateFrom}
                                onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                {APP_COPY.analytics.common.dateTo}
                            </label>
                            <DatePicker
                                value={filters.dateTo}
                                onChange={(value) => setFilters({ ...filters, dateTo: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fg-muted mb-2">
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
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                {APP_COPY.analytics.orderAreaSummary.headers.area}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.common.search}
                                value={filters.area}
                                onChange={(e) => setFilters({ ...filters, area: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                            <input
                                type="checkbox"
                                id="complexOnly"
                                checked={filters.complexOnly}
                                onChange={(e) => setFilters({ ...filters, complexOnly: e.target.checked })}
                                className="w-4 h-4 rounded border-border-strong bg-muted text-primary focus:ring-primary"
                            />
                            <label htmlFor="complexOnly" className="text-xs font-medium text-fg-muted cursor-pointer select-none">
                                Solo Progetti Complessi (3+ aree)
                            </label>
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
                        <Button type="button" onClick={() => setShowMonthModal(true)} variant="secondary" className="flex items-center gap-2" disabled={pdfLoading}>
                            <FileText size={16} />
                            {APP_COPY.analytics.orderAreaSummary.pdfButton}
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
            <div className="flex items-center justify-between text-sm text-fg-muted">
                <div>
                    {APP_COPY.analytics.common.showing} <span className="text-fg-strong font-mono">{(page - 1) * limit + 1}</span> {APP_COPY.analytics.common.to}{' '}
                    <span className="text-fg-strong font-mono">{Math.min(page * limit, total)}</span> {APP_COPY.analytics.common.of}{' '}
                    <span className="text-fg-strong font-mono">{total}</span> {APP_COPY.analytics.common.records}
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
                    <span className="text-fg-muted">
                        {APP_COPY.analytics.common.page} <span className="text-fg-strong font-mono">{page}</span> {APP_COPY.analytics.common.of}{' '}
                        <span className="text-fg-strong font-mono">{totalPages}</span>
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
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                {data.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            {tableHead}
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                                            {APP_COPY.analytics.common.loading}
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                                            {APP_COPY.analytics.empty}
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-card/50 transition-colors">
                                            {/* Commessa */}
                                            <td className="px-4 py-3 text-sm w-40">
                                                <div className="font-mono text-primary truncate max-w-[10rem]">{row.commessa_display}</div>
                                                <div className="text-xs text-fg-subtle truncate max-w-[10rem]" title={row.order_description}>{row.order_description}</div>
                                            </td>
                                            {/* Cliente */}
                                            <td className="px-4 py-3 text-sm text-fg-secondary">
                                                <div className="truncate max-w-[12rem]" title={row.client_name ?? ''}>
                                                    {row.client_name ?? '—'}
                                                </div>
                                            </td>
                                            {/* Area */}
                                            <td className="px-4 py-3 text-sm text-fg-secondary">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-fg-secondary">
                                                    {row.area_name}
                                                </span>
                                            </td>
                                            {/* Composizione */}
                                            <td className="px-4 py-3 text-sm text-fg-secondary">
                                                <div className="text-xs truncate max-w-[12rem]" title={row.composition ?? ''}>
                                                    {row.composition ?? '—'}
                                                </div>
                                            </td>
                                            {/* Fogli */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                {formatNumber(row.fogli)}
                                            </td>
                                            {/* Pagine */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                {row.pages ?? '—'}
                                            </td>
                                            {/* Ore Attese */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-muted">
                                                {(() => {
                                                    const h = calcExpectedHours(row.area_name, row.qty_requested, row.fogli);
                                                    return h != null ? formatHours(h) : '—';
                                                })()}
                                            </td>
                                            {/* Ore Lavoro */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-strong font-semibold">
                                                {formatHours(row.work_time)}
                                            </td>
                                            {/* Qta Richiesta */}
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                {formatNumber(row.qty_requested)}
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
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-fg-muted">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
        </>
    );
}
