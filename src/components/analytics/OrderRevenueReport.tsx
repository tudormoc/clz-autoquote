'use client';

import { useEffect, useState } from 'react';
import { getOrderRevenueDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales/en';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd, getTodayDate } from '@/lib/dateUtils';

interface OrderRevenueRow {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    client_code: string;
    client_name: string;
    total_revenue: number;
    total_cost: number;
    total_quantity: number;
    work_time: number;
    work_cost: number;
}

interface Filters {
    commessa: string;
    client: string;
    dateFrom: string;
    dateTo: string;
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
        dateTo: getLastYearEnd()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'revenue',
        direction: 'desc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getOrderRevenueDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            client: appliedFilters.client || undefined,
            dateFrom: appliedFilters.dateFrom || undefined,
            dateTo: appliedFilters.dateTo || undefined,
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
            dateTo: getLastYearEnd()
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'revenue',
            direction: 'desc'
        });
        setPage(1);
    };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            const result = await getOrderRevenueDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                client: appliedFilters.client || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined,
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => {
                    const totalCosts = row.total_cost + row.work_cost;
                    const margin = row.total_revenue - totalCosts;
                    
                    return {
                        'Commessa': row.commessa_display,
                        'Codice Cliente': row.client_code,
                        'Nome Cliente': row.client_name,
                        'Fatturato': Number(row.total_revenue.toFixed(2)),
                        'Costo Materiali': Number(row.total_cost.toFixed(2)),
                        'Ore Lavoro': Number(row.work_time.toFixed(2)),
                        'Costo Lavoro': Number(row.work_cost.toFixed(2)),
                        'Margine': Number(margin.toFixed(2))
                    };
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 10 },  // Commessa
                    { wch: 15 },  // Codice Cliente
                    { wch: 35 },  // Nome Cliente
                    { wch: 15 },  // Fatturato
                    { wch: 15 },  // Costo Materiali
                    { wch: 12 },  // Ore Lavoro
                    { wch: 15 },  // Costo Lavoro
                    { wch: 15 }   // Margine
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
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
                                Client
                            </label>
                            <Input
                                type="text"
                                placeholder="Search..."
                                value={filters.client}
                                onChange={(e) => setFilters({ ...filters, client: e.target.value })}
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
                        <Button type="button" onClick={handleExportExcel} variant="secondary" className="flex items-center gap-2 ml-auto">
                            <Download size={16} />
                            Export Excel
                        </Button>
                    </div>
                </form>
            </div>

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
                    <table className="w-full table-fixed">
                        <colgroup>
                            <col className="w-[180px]" />
                            <col className="w-[200px]" />
                            <col className="w-[130px]" />
                            <col className="w-[130px]" />
                            <col className="w-[110px]" />
                            <col className="w-[130px]" />
                            <col className="w-[140px]" />
                        </colgroup>
                        <thead className="bg-zinc-900 border-b border-zinc-800">
                            <tr>
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
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('client')}
                                >
                                    <div className="flex items-center gap-2">
                                        Client
                                        {getSortIcon('client')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('revenue')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Revenue
                                        {getSortIcon('revenue')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('cost')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Material Cost
                                        {getSortIcon('cost')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('work_time')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Work Time
                                        {getSortIcon('work_time')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('work_cost')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Labor Cost
                                        {getSortIcon('work_cost')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('margin')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Margin
                                        {getSortIcon('margin')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                                        Loading...
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
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-mono text-primary truncate">{row.commessa_display}</div>
                                                <div className="text-xs text-zinc-500 truncate">{row.order_description}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-mono text-zinc-400 truncate">{row.client_code}</div>
                                                <div className="text-xs text-zinc-500 truncate">{row.client_name}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                                {formatCurrency(row.total_revenue)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                                {formatCurrency(row.total_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                                {formatTime(row.work_time)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                                {formatCurrency(row.work_cost)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <div className="font-mono text-white font-semibold">
                                                    {formatCurrency(margin)}
                                                </div>
                                                <div className={`text-xs font-mono ${marginPercent >= 20 ? 'text-success-foreground' : marginPercent >= 10 ? 'text-warning-foreground' : 'text-destructive'}`}>
                                                    {marginPercent.toFixed(1)}%
                                                </div>
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
