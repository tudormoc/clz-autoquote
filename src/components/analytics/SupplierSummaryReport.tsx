'use client';

import { useEffect, useState } from 'react';
import { getSupplierSummaryAction, getSupplierSummaryStatsAction } from '@/app/analytics/queries/supplier-queries';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';
import { SummaryCards } from '@/components/analytics/SummaryCards';

interface SupplierRow {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    supplier_code: string;
    supplier_name: string;
    total_value: number;
}

interface Filters {
    commessa: string;
    supplier: string;
    dateFrom: string;
    dateTo: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function SupplierSummaryReport() {
    const [data, setData] = useState<SupplierRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const [summaryData, setSummaryData] = useState<any>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [filters, setFilters] = useState<Filters>({
        commessa: '',
        supplier: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'supplier',
        direction: 'asc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getSupplierSummaryAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            supplier: appliedFilters.supplier || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined
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
        setSummaryData(null); // Reset summary when filters change
        loadData();
    };

    const loadSummary = async () => {
        setSummaryLoading(true);
        const result = await getSupplierSummaryStatsAction(2024, {
            commessa: appliedFilters.commessa || undefined,
            supplier: appliedFilters.supplier || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined
        });

        if (result.success) {
            setSummaryData(result.data);
        }
        setSummaryLoading(false);
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

    const formatTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const summaryItems = summaryData ? [
        {
            label: 'Total Delivered Value',
            value: formatCurrencyRounded(summaryData.total_value),
            subItems: summaryData.suppliers.map((s: any) => ({
                label: s.supplier_name,
                value: formatCurrencyRounded(s.total_value)
            }))
        },
        {
            label: 'Equivalent Work Hours',
            value: `${Math.round(summaryData.total_value / 20)} hours`,
            subItems: []
        }
    ] : [];

    const handleClearFilters = () => {
        const clearedFilters = {
            commessa: '',
            supplier: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd()
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'supplier',
            direction: 'asc'
        });
        setPage(1);
    };

    const handleExportExcel = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const result = await getSupplierSummaryAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                supplier: appliedFilters.supplier || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined
            }, sortConfig);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => ({
                    'Codice Fornitore': row.supplier_code,
                    'Nome Fornitore': row.supplier_name,
                    'Commessa': row.commessa_display,
                    'Descrizione': row.order_description || '',
                    'Valore Consegnato': Number(row.total_value.toFixed(2))
                }));

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 18 },  // Codice Fornitore
                    { wch: 35 },  // Nome Fornitore
                    { wch: 10 },  // Commessa
                    { wch: 40 },  // Descrizione
                    { wch: 18 }   // Valore Consegnato
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Supplier Summary');

                const filename = `supplier_summary_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
                XLSX.writeFile(wb, filename);
            }
        } catch (err) {
            console.error('Export error:', err);
        }
        setLoading(false);
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

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-zinc-800 rounded-lg p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                Date From
                            </label>
                            <DatePicker
                                value={filters.dateFrom}
                                onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                Date To
                            </label>
                            <DatePicker
                                value={filters.dateTo}
                                onChange={(value) => setFilters({ ...filters, dateTo: value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                Commessa
                            </label>
                            <Input
                                type="text"
                                placeholder="Search..."
                                value={filters.commessa}
                                onChange={(e) => setFilters({ ...filters, commessa: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                Supplier
                            </label>
                            <Input
                                type="text"
                                placeholder="Search..."
                                value={filters.supplier}
                                onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button type="submit" className="flex items-center gap-2">
                            <Search size={16} />
                            Apply Filters
                        </Button>
                        <Button type="button" onClick={handleClearFilters} variant="secondary" className="flex items-center gap-2">
                            <X size={16} />
                            Clear
                        </Button>
                        <Button type="button" onClick={handleExportExcel} variant="secondary" className="flex items-center gap-2 ml-auto" disabled={loading}>
                            <Download size={16} />
                            {loading ? 'Exporting...' : 'Export Excel'}
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
                    Showing <span className="text-white font-mono">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="text-white font-mono">{Math.min(page * limit, total)}</span> of{' '}
                    <span className="text-white font-mono">{total}</span> records
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        variant="secondary"
                        className="flex items-center gap-1"
                    >
                        <ChevronLeft size={16} />
                        Previous
                    </Button>
                    <span className="text-zinc-400">
                        Page <span className="text-white font-mono">{page}</span> of{' '}
                        <span className="text-white font-mono">{totalPages}</span>
                    </span>
                    <Button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        variant="secondary"
                        className="flex items-center gap-1"
                    >
                        Next
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
                                    onClick={() => handleSort('supplier')}
                                >
                                    <div className="flex items-center gap-2">
                                        Supplier
                                        {getSortIcon('supplier')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('commessa')}
                                >
                                    <div className="flex items-center gap-2">
                                        Commessa
                                        {getSortIcon('commessa')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('value')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Delivered Value
                                        {getSortIcon('value')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">
                                        Loading...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-mono text-zinc-400">{row.supplier_code}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-xs" title={row.supplier_name}>
                                                {row.supplier_name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-mono text-primary">{row.commessa_display}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-xs" title={row.order_description}>
                                                {row.order_description}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                            {formatCurrency(row.total_value)}
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
