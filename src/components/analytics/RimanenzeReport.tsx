'use client';

import { useEffect, useState } from 'react';
import { getRimanenzeDataAction, getRimanenzeStatsAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { formatCurrencyRounded, formatHours } from '@/lib/format';

interface RimanenzeRow {
    commessa_display: string;
    commessa_full: number;
    order_description: string;
    client_code: string;
    client_name: string;
    material_cost: number;
    total_quantity: number;
    work_time: number;
    work_cost: number;
}

interface Filters {
    commessa: string;
    client: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function RimanenzeReport() {
    const [data, setData] = useState<RimanenzeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        commessa: '',
        client: ''
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'total_invested',
        direction: 'desc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getRimanenzeDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            client: appliedFilters.client || undefined
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
            commessa: '',
            client: ''
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'total_invested',
            direction: 'desc'
        });
        setSummaryData(null);
        setPage(1);
    };

    const loadSummary = async () => {
        setSummaryLoading(true);
        const result = await getRimanenzeStatsAction(2024, {
            commessa: appliedFilters.commessa || undefined,
            client: appliedFilters.client || undefined
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
            const result = await getRimanenzeDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                client: appliedFilters.client || undefined
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => {
                    const totalInvested = row.material_cost + row.work_cost;
                    return {
                        [APP_COPY.analytics.rimanenze.export.commessa]: row.commessa_display,
                        [APP_COPY.analytics.rimanenze.export.description]: row.order_description || '',
                        [APP_COPY.analytics.rimanenze.export.clientCode]: row.client_code || '',
                        [APP_COPY.analytics.rimanenze.export.clientName]: row.client_name || '',
                        [APP_COPY.analytics.rimanenze.export.materialCost]: Math.round(row.material_cost),
                        [APP_COPY.analytics.rimanenze.export.workTime]: Number(row.work_time.toFixed(2)),
                        [APP_COPY.analytics.rimanenze.export.laborCost]: Math.round(row.work_cost),
                        [APP_COPY.analytics.rimanenze.export.totalInvested]: Math.round(totalInvested)
                    };
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 10 },  // Commessa
                    { wch: 40 },  // Descrizione
                    { wch: 15 },  // Codice Cliente
                    { wch: 35 },  // Nome Cliente
                    { wch: 15 },  // Costo Materiali
                    { wch: 12 },  // Ore Lavoro
                    { wch: 15 },  // Costo Lavoro
                    { wch: 18 }   // Valore Investito
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Rimanenze');

                const filename = `rimanenze_ordini_attivi.xlsx`;

                XLSX.writeFile(wb, filename);
            }
        } catch (err) {
            console.error('Export error:', err);
        }
        setLoading(false);
    };

    const summaryItems = summaryData ? [
        {
            label: APP_COPY.analytics.rimanenze.summary.totalValue,
            value: formatCurrencyRounded(summaryData.total_material_cost),
            subItems: [
                {
                    label: APP_COPY.analytics.rimanenze.summary.totalOrders,
                    value: summaryData.total_orders.toString()
                }
            ]
        }
    ] : [];

    if (loading && page === 1) {
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-card border-b border-border">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('commessa')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.rimanenze.headers.commessa}
                                        {getSortIcon('commessa')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('client')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.rimanenze.headers.client}
                                        {getSortIcon('client')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('material_cost')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.rimanenze.headers.materialCost}
                                        {getSortIcon('material_cost')}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.rimanenze.headers.workTime}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-fg-muted">
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.rimanenze.headers.laborCost}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-semibold text-fg-muted cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('total_invested')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.rimanenze.headers.totalInvested}
                                        {getSortIcon('total_invested')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">
                                        {APP_COPY.analytics.common.loading}
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => {
                                    const totalInvested = row.material_cost + row.work_cost;
                                    return (
                                        <tr key={idx} className="hover:bg-card/50 transition-colors">
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-mono text-primary">{row.commessa_display}</div>
                                                <div className="text-xs text-fg-subtle truncate max-w-xs" title={row.order_description}>
                                                    {row.order_description}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {row.client_code ? (
                                                    <>
                                                        <div className="font-mono text-fg-muted">{row.client_code}</div>
                                                        <div className="text-xs text-fg-subtle truncate max-w-xs" title={row.client_name}>
                                                            {row.client_name}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-xs text-fg-faint italic">Non assegnato</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                {formatCurrencyRounded(row.material_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-strong font-semibold">
                                                {formatHours(row.work_time)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-secondary">
                                                {formatCurrencyRounded(row.work_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-fg-strong font-semibold">
                                                {formatCurrencyRounded(totalInvested)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
