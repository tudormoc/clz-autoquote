'use client';

import { useEffect, useState } from 'react';
import { getClientDeliveriesDataAction, getClientDeliveriesStatsAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';
import { SummaryCards } from '@/components/analytics/SummaryCards';

interface ClientDeliveryRow {
    client_code: string;
    client_name: string;
    delivered_value: number;
}

interface Filters {
    client: string;
    dateFrom: string;
    dateTo: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function ClientDeliveriesReport() {
    const [data, setData] = useState<ClientDeliveryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        client: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'delivered_value',
        direction: 'desc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getClientDeliveriesDataAction(2024, page, limit, {
            client: appliedFilters.client || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined
        }, sortConfig);

        if (result.success) {
            setData(result.data);
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
        loadData();
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            client: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd()
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'delivered_value',
            direction: 'desc'
        });
        setSummaryData(null);
        setPage(1);
    };

    const loadSummary = async () => {
        setSummaryLoading(true);
        const result = await getClientDeliveriesStatsAction(2024, {
            client: appliedFilters.client || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined
        });

        if (result.success) {
            setSummaryData(result.data);
        }
        setSummaryLoading(false);
    };

    const handleExportExcel = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const result = await getClientDeliveriesDataAction(2024, 1, 999999, {
                client: appliedFilters.client || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => ({
                    [APP_COPY.analytics.clientDeliveries.export.clientCode]: row.client_code,
                    [APP_COPY.analytics.clientDeliveries.export.clientName]: row.client_name,
                    [APP_COPY.analytics.clientDeliveries.export.deliveredValue]: Number(row.delivered_value.toFixed(2))
                }));

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 15 },  // Codice Cliente
                    { wch: 35 },  // Nome Cliente
                    { wch: 18 }   // Valore Consegnato
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Client Deliveries');

                const filename = `client_deliveries_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;

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
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('it-IT');
    };

    const summaryItems = summaryData ? [
        {
            label: APP_COPY.analytics.clientDeliveries.summary,
            value: formatCurrencyRounded(summaryData.total_value),
            subItems: []
        }
    ] : [];

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
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-zinc-900 border-b border-zinc-800">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('client')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.clientDeliveries.headers.client}
                                        {getSortIcon('client')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('delivered_value')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.clientDeliveries.headers.deliveredValue}
                                        {getSortIcon('delivered_value')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-mono text-primary">{row.client_code}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-xs" title={row.client_name}>{row.client_name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                            {formatCurrency(row.delivered_value)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
