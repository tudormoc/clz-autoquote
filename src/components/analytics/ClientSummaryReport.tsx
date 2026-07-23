'use client';

import { useEffect, useState } from 'react';
import { getClientSummaryDataAction, getClientSummaryStatsAction } from '@/app/analytics/analytics-actions';
import { generateClientSummaryPDFAction } from '@/app/analytics/pdf-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { MonthSelectorModal } from '@/components/analytics/MonthSelectorModal';

interface ClientSummaryRow {
    client_code: string;
    client_name: string;
    total_orders: number;
    total_revenue: number;
    total_cost: number;
    total_quantity: number;
    work_cost: number;
    split_orders_count: number;
}

interface Filters {
    client: string;
    dateFrom: string;
    dateTo: string;
    includeAllRevenueForSplit: boolean;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function ClientSummaryReport() {
    const [data, setData] = useState<ClientSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    
    const [pdfLoading, setPdfLoading] = useState(false);
    const [showMonthModal, setShowMonthModal] = useState(false);
    
    const [filters, setFilters] = useState<Filters>({
        client: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd(),
        includeAllRevenueForSplit: false
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'revenue',
        direction: 'desc'
    });

    const limit = 100;

    useEffect(() => {
        if (appliedFilters !== null) {
            loadData();
        }
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        if (!appliedFilters) return;
        
        setLoading(true);
        const result = await getClientSummaryDataAction(2024, page, limit, {
            client: appliedFilters.client || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined,
            includeAllRevenueForSplit: appliedFilters.includeAllRevenueForSplit
        }, sortConfig);
        
        if (result.success) {
            setData(result.data);
            setTotal(result.pagination.total);
            setTotalPages(result.pagination.totalPages);
            setError(null);
        } else {
            setError(result.error);
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
        loadData();
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            client: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd(),
            includeAllRevenueForSplit: false
        };
        setFilters(clearedFilters);
        setAppliedFilters(null);
        setData([]);
        setTotal(0);
        setTotalPages(1);
        setSortConfig({
            column: 'revenue',
            direction: 'desc'
        });
        setSummaryData(null);
        setPage(1);
    };

    const loadSummary = async () => {
        if (!appliedFilters) return;
        setSummaryLoading(true);
        const result = await getClientSummaryStatsAction(2024, {
            client: appliedFilters.client || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined,
            includeAllRevenueForSplit: appliedFilters.includeAllRevenueForSplit
        });

        if (result.success) {
            setSummaryData(result.data);
        }
        setSummaryLoading(false);
    };

    const handleGeneratePDF = async (year: number, months: number[], separateByArea: boolean, format: 'A4' | 'A3') => {
        if (!appliedFilters) return;
        setPdfLoading(true);
        try {
            const result = await generateClientSummaryPDFAction(
                year,
                months,
                appliedFilters.client || undefined,
                appliedFilters.includeAllRevenueForSplit,
                format
            );

            if (result.success && result.pdf) {
                const linkSource = `data:application/pdf;base64,${result.pdf}`;
                const downloadLink = document.createElement('a');
                downloadLink.href = linkSource;
                downloadLink.download = result.filename || 'report.pdf';
                downloadLink.click();
                setShowMonthModal(false);
            } else {
                console.error('Failed to generate PDF:', result.error);
                alert('Errore durante la generazione del PDF');
            }
        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('Errore imprevisto durante la generazione del PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!appliedFilters || loading) return; // Prevent multiple clicks
        setLoading(true);
        try {
            const result = await getClientSummaryDataAction(2024, 1, 999999, {
                client: appliedFilters.client || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined,
                includeAllRevenueForSplit: appliedFilters.includeAllRevenueForSplit
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => {
                    const totalCosts = row.total_cost + row.work_cost;
                    const margin = row.total_revenue - totalCosts;
                    
                    return {
                        [APP_COPY.analytics.clientSummary.export.clientCode]: row.client_code,
                        [APP_COPY.analytics.clientSummary.export.clientName]: row.client_name,
                        [APP_COPY.analytics.clientSummary.export.totalOrders]: row.total_orders,
                        [APP_COPY.analytics.clientSummary.export.revenue]: Math.round(row.total_revenue),
                        [APP_COPY.analytics.clientSummary.export.materialCost]: Math.round(row.total_cost),
                        [APP_COPY.analytics.clientSummary.export.laborCost]: Math.round(row.work_cost),
                        'Costo Totale': Math.round(totalCosts),
                        [APP_COPY.analytics.clientSummary.export.margin]: Math.round(margin),
                        [APP_COPY.analytics.clientSummary.export.quantity]: row.total_quantity,
                        [APP_COPY.analytics.clientSummary.export.splitWarning]: row.split_orders_count
                    };
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 15 },  // Codice Cliente
                    { wch: 35 },  // Nome Cliente
                    { wch: 12 },  // Ordini Totali
                    { wch: 15 },  // Fatturato
                    { wch: 15 },  // Costo Materiali
                    { wch: 15 },  // Costo Lavoro
                    { wch: 15 },  // Costo Totale
                    { wch: 15 },  // Margine
                    { wch: 10 },  // Quantità
                    { wch: 28 }   // Ordini con Fatturato Parziale
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Client Summary');

                const filename = `client_summary_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
                
                XLSX.writeFile(wb, filename);
            }
        } catch (err) {
            console.error('Export error:', err);
        }
        setLoading(false);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatCurrencyRounded = (value: number) => {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(value));
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('it-IT');
    };

    const summaryItems = summaryData ? [
        {
            label: APP_COPY.analytics.common.totalRevenue,
            value: formatCurrencyRounded(summaryData.total_value),
            subItems: []
        }
    ] : [];

    if (loading && page === 1 && appliedFilters !== null) {
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

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-zinc-800 rounded-lg p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                {APP_COPY.analytics.common.client}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.common.search}
                                value={filters.client}
                                onChange={(e) => setFilters({ ...filters, client: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button type="submit" className="flex items-center gap-2">
                            <Search size={16} />
                            {APP_COPY.analytics.common.apply}
                        </Button>
                        <Button 
                            type="button" 
                            onClick={() => setFilters({ ...filters, includeAllRevenueForSplit: !filters.includeAllRevenueForSplit })}
                            variant={filters.includeAllRevenueForSplit ? "primary" : "secondary"}
                            className={`flex items-center gap-1.5 transition-all ${
                                filters.includeAllRevenueForSplit 
                                    ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/20' 
                                    : 'hover:border-warning-foreground/50'
                            }`}
                            title={filters.includeAllRevenueForSplit ? APP_COPY.analytics.clientSummary.toggleFullTitle : APP_COPY.analytics.clientSummary.toggleSplitTitle}
                        >
                            <span className="text-base leading-none">⚠️</span>
                            <span className="text-sm font-medium">
                                {filters.includeAllRevenueForSplit ? APP_COPY.analytics.clientSummary.toggleFull : APP_COPY.analytics.clientSummary.toggleSplit}
                            </span>
                        </Button>
                        <Button type="button" onClick={handleClearFilters} variant="secondary" className="flex items-center gap-2">
                            <X size={16} />
                            {APP_COPY.analytics.common.clear}
                        </Button>
                        <div className="flex gap-2 ml-auto">
                            <Button 
                                type="button" 
                                onClick={() => setShowMonthModal(true)} 
                                variant="secondary" 
                                className="flex items-center gap-2" 
                                disabled={pdfLoading}
                            >
                                <FileText size={16} />
                                {APP_COPY.analytics.clientSummary.pdfButton}
                            </Button>
                            <Button type="button" onClick={handleExportExcel} variant="secondary" className="flex items-center gap-2" disabled={loading}>
                                <Download size={16} />
                                {loading ? APP_COPY.analytics.common.exporting : APP_COPY.analytics.common.exportExcel}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Summary Cards */}
            <SummaryCards
                items={summaryItems}
                loading={summaryLoading}
                onLoad={loadSummary}
            />

            {/* Stats */}
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
                        <thead className="bg-zinc-900 border-b border-zinc-800">
                            <tr>
                                <th 
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors w-48"
                                    onClick={() => handleSort('client')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.clientSummary.headers.client}
                                        {getSortIcon('client')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('revenue')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.clientSummary.headers.revenue}
                                        {getSortIcon('revenue')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('cost')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.clientSummary.headers.materialCost}
                                        {getSortIcon('cost')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('work_cost')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.clientSummary.headers.laborCost}
                                        {getSortIcon('work_cost')}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">
                                        Costo Totale
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('margin')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.clientSummary.headers.margin}
                                        {getSortIcon('margin')}
                                    </div>
                                </th>
                            <th className="px-2 py-3 text-center text-xs font-semibold text-zinc-400 w-12" title="Has split revenue (orders outside date range)"><div className="flex items-center justify-center">⚠️</div></th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => {
                                    const totalCosts = row.total_cost + row.work_cost;
                                    const margin = row.total_revenue - totalCosts;
                                    const marginPercent = row.total_revenue > 0 ? (margin / row.total_revenue) * 100 : 0;
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                                            <td className="px-4 py-3 text-sm w-48">
                                                <div className="font-mono text-primary truncate max-w-[12rem]">{row.client_code}</div>
                                                <div className="text-xs text-zinc-500 truncate max-w-[12rem]" title={row.client_name}>{row.client_name}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                                {formatCurrencyRounded(row.total_revenue)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                                {formatCurrencyRounded(row.total_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                                {formatCurrencyRounded(row.work_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                                {formatCurrencyRounded(totalCosts)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <div className="font-mono text-white font-semibold">
                                                    {formatCurrencyRounded(margin)}
                                                </div>
                                                <div className={`text-xs font-mono ${marginPercent >= 20 ? 'text-success-foreground' : marginPercent >= 10 ? 'text-warning-foreground' : 'text-destructive'}`}>
                                                    {marginPercent.toFixed(1)}%
                                                </div>
                                            </td>
                                        <td className="px-2 py-3 text-sm text-center w-12"><span className={`font-mono text-xs ${row.split_orders_count > 0 ? 'text-warning-foreground' : 'text-zinc-500'}`}>{row.split_orders_count > 0 ? 'Y' : 'N'}</span></td></tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-zinc-900 border-b border-zinc-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 w-48">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.clientSummary.headers.client}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.clientSummary.headers.revenue}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.clientSummary.headers.materialCost}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.clientSummary.headers.laborCost}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">Costo Totale</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.clientSummary.headers.margin}</div>
                                </th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-zinc-400 w-12" title={APP_COPY.analytics.clientSummary.headers.splitWarning}>
                                    <div className="flex items-center justify-center">⚠️</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <MonthSelectorModal
                isOpen={showMonthModal}
                onClose={() => setShowMonthModal(false)}
                onGenerate={handleGeneratePDF}
                loading={pdfLoading}
                title={APP_COPY.analytics.clientSummary.pdfTitle}
                hideSeparateToggle={true}
            />
        </div>
    );
}


// Updated version with split revenue column indicator

