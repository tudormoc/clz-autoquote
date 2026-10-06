'use client';

import { useEffect, useState } from 'react';
import { getOrderRevenueDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd, getTodayDate } from '@/lib/dateUtils';
import { formatCurrency, formatHours } from '@/lib/format';

interface OrderRevenueRow {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    client_code: string;
    client_name: string;
    total_revenue: number;
    delivered_revenue: number;
    total_cost: number;
    total_quantity: number;
    work_time: number;
    work_cost: number;
    has_split_revenue: number;
}

interface Filters {
    commessa: string;
    client: string;
    dateFrom: string;
    dateTo: string;
    includeAllRevenueForSplit: boolean;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function OrderRevenueReport() {
    const [data, setData] = useState<OrderRevenueRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState<Filters>({
        commessa: '',
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
        const result = await getOrderRevenueDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
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
        loadData();
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            commessa: '',
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
        setPage(1);
    };

    const handleExportExcel = async () => {
        if (loading || !appliedFilters) return; // Prevent export if no data loaded
        setLoading(true);
        try {
            const result = await getOrderRevenueDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
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
                        [APP_COPY.analytics.orderRevenue.export.commessa]: row.commessa_display,
                        [APP_COPY.analytics.orderRevenue.export.description]: row.order_description || '',
                        [APP_COPY.analytics.orderRevenue.export.clientCode]: row.client_code,
                        [APP_COPY.analytics.orderRevenue.export.clientName]: row.client_name,
                        [APP_COPY.analytics.orderRevenue.export.quantity]: row.total_quantity,
                        [APP_COPY.analytics.orderRevenue.export.invoicedValue]: Number(row.total_revenue.toFixed(2)),
                        [APP_COPY.analytics.orderRevenue.export.deliveredValue]: Number(row.delivered_revenue.toFixed(2)),
                        [APP_COPY.analytics.orderRevenue.export.materialCost]: Number(row.total_cost.toFixed(2)),
                        [APP_COPY.analytics.orderRevenue.export.workTime]: Number(row.work_time.toFixed(2)),
                        [APP_COPY.analytics.orderRevenue.export.laborCost]: Number(row.work_cost.toFixed(2)),
                        [APP_COPY.analytics.orderRevenue.export.margin]: Number(margin.toFixed(2)),
                        [APP_COPY.analytics.orderRevenue.export.partialRevenue]: row.has_split_revenue === 1 ? 'SI' : 'NO'
                    };
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 10 },  // Commessa
                    { wch: 40 },  // Descrizione
                    { wch: 15 },  // Codice Cliente
                    { wch: 35 },  // Nome Cliente
                    { wch: 12 },  // Quantità
                    { wch: 15 },  // Fatturato
                    { wch: 15 },  // Fatturato Consegnato
                    { wch: 15 },  // Costo Materiali
                    { wch: 12 },  // Ore Lavoro
                    { wch: 15 },  // Costo Lavoro
                    { wch: 15 },  // Margine
                    { wch: 18 }   // Fatturato Parziale
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Order Revenue');

                const filename = `order_revenue_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;

                XLSX.writeFile(wb, filename);
            }
        } catch (err) {
            console.error('Export error:', err);
        }
        setLoading(false);
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

    return (
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
                                Commessa
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
                                Client
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
                            className={`flex items-center gap-1.5 transition-all ${filters.includeAllRevenueForSplit
                                ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/20'
                                : 'hover:border-warning-300/50'
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
                        <Button type="button" onClick={handleExportExcel} variant="secondary" className="flex items-center gap-2 ml-auto" disabled={loading}>
                            <Download size={16} />
                            {loading ? APP_COPY.analytics.common.exporting : APP_COPY.analytics.common.exportExcel}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Stats */}
            {appliedFilters !== null && total > 0 && (
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
            )}

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                {appliedFilters === null ? (
                    <table className="w-full">
                        <thead className="bg-card border-b border-border">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-fg-muted w-32">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.orderRevenue.commessa}</div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-fg-muted w-48">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.orderRevenue.client}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.deliveredValue}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.materialCost}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.workTime}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.laborCost}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">Total Cost</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.margin}</div>
                                </th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-fg-muted w-12" title="Partial Revenue">
                                    <div className="flex items-center justify-center">⚠️</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-fg-muted">
                                    Apply filters to load data
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : data.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-card border-b border-border">
                                <tr>
                                    <th
                                        className="px-4 py-3 text-left text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors w-32"
                                        onClick={() => handleSort('commessa')}
                                    >
                                        <div className="flex items-center gap-2">
                                            {APP_COPY.analytics.orderRevenue.commessa}
                                            {getSortIcon('commessa')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors w-48"
                                        onClick={() => handleSort('client')}
                                    >
                                        <div className="flex items-center gap-2">
                                            {APP_COPY.analytics.orderRevenue.client}
                                            {getSortIcon('client')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('delivered_revenue')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            {APP_COPY.analytics.orderRevenue.deliveredValue}
                                            {getSortIcon('delivered_revenue')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('cost')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            {APP_COPY.analytics.orderRevenue.materialCost}
                                            {getSortIcon('cost')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('work_time')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            {APP_COPY.analytics.orderRevenue.workTime}
                                            {getSortIcon('work_time')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('work_cost')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            {APP_COPY.analytics.orderRevenue.laborCost}
                                            {getSortIcon('work_cost')}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                        <div className="flex items-center justify-end gap-2">
                                            Total Cost
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('margin')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            {APP_COPY.analytics.orderRevenue.margin}
                                            {getSortIcon('margin')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-2 py-3 text-center text-xs font-semibold text-fg-muted w-12"
                                        title="Partial Revenue (outside date range)"
                                    >
                                        <div className="flex items-center justify-center">
                                            ⚠️
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-fg-muted">
                                            {APP_COPY.analytics.common.loading}
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-fg-muted">
                                            {APP_COPY.analytics.empty}
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row, idx) => {
                                        const totalCosts = row.total_cost + row.work_cost;
                                        const margin = row.delivered_revenue - totalCosts;
                                        const marginPercent = row.delivered_revenue > 0 ? (margin / row.delivered_revenue) * 100 : 0;

                                        return (
                                            <tr key={idx} className="hover:bg-card/50 transition-colors">
                                                <td className="px-4 py-3 text-sm w-32">
                                                    <div className="font-mono text-primary truncate max-w-[8rem]">{row.commessa_display}</div>
                                                    <div className="text-xs text-fg-subtle truncate max-w-[8rem]" title={row.order_description}>{row.order_description}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm w-48">
                                                    <div className="font-mono text-fg-muted truncate max-w-[12rem]">{row.client_code}</div>
                                                    <div className="text-xs text-fg-subtle truncate max-w-[12rem]" title={row.client_name}>{row.client_name}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-mono text-right text-fg-strong font-semibold">
                                                    {formatCurrency(row.delivered_revenue)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                    {formatCurrency(row.total_cost)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-mono text-right text-fg-strong font-semibold">
                                                    {formatHours(row.work_time)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                    {formatCurrency(row.work_cost)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-mono text-right text-fg-strong font-semibold">
                                                    {formatCurrency(totalCosts)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    <div className="font-mono text-fg-strong font-semibold">
                                                        {formatCurrency(margin)}
                                                    </div>
                                                    <div className={`text-xs font-mono ${marginPercent >= 20 ? 'text-success-500' : marginPercent >= 10 ? 'text-warning-300' : 'text-danger'}`}>
                                                        {marginPercent.toFixed(1)}%
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-sm text-center w-12">
                                                    <span className={`font-mono text-xs ${row.has_split_revenue === 1 ? 'text-warning-300' : 'text-fg-subtle'}`}>
                                                        {row.has_split_revenue === 1 ? 'Y' : 'N'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-card border-b border-border">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-fg-muted w-32">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.orderRevenue.commessa}</div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-fg-muted w-48">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.orderRevenue.client}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.deliveredValue}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.materialCost}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.workTime}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.laborCost}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">Total Cost</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.orderRevenue.margin}</div>
                                </th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-fg-muted w-12" title="Partial Revenue">
                                    <div className="flex items-center justify-center">⚠️</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-fg-muted">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-fg-muted">
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
