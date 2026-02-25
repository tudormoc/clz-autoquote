'use client';

import { useEffect, useState } from 'react';
import { getOrderSummaryDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales/en';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface OrderSummaryRow {
    machine: string;
    machine_name: string;
    work_time: number;
    qty_completed: number;
    qty_requested: number;
    commessa_full: string;
    commessa_display: string;
    order_description: string;
}

interface Filters {
    commessa: string;
    machine: string;
    dateFrom: string;
    dateTo: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function OrderSummaryReport() {
    const [data, setData] = useState<OrderSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const getTodayDate = () => new Date().toISOString().split('T')[0];
    
    const [filters, setFilters] = useState<Filters>({
        commessa: '',
        machine: '',
        dateFrom: '2024-01-01',
        dateTo: getTodayDate()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'commessa',
        direction: 'asc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getOrderSummaryDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            machine: appliedFilters.machine || undefined,
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
            machine: '',
            dateFrom: '2024-01-01',
            dateTo: getTodayDate()
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'commessa',
            direction: 'asc'
        });
        setPage(1);
    };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            const result = await getOrderSummaryDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                machine: appliedFilters.machine || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined,
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => {
                    return {
                        'Commessa': Number(row.commessa_display),
                        'Descrizione': row.order_description,
                        'Macchina': Number(row.machine),
                        'Nome Macchina': row.machine_name,
                        'Ore Lavoro': Number(row.work_time.toFixed(2)),
                        'Quantità Richiesta': row.qty_requested || 0,
                        'Quantità Completata': row.qty_completed
                    };
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                ws['!cols'] = [
                    { wch: 10 },
                    { wch: 30 },
                    { wch: 10 },
                    { wch: 25 },
                    { wch: 12 },
                    { wch: 15 },
                    { wch: 15 }
                ];

                // Format ID columns as numbers (remove text-to-number conversion warnings)
                const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                for (let row = 1; row <= range.e.r; row++) {
                    // Commessa column (A)
                    const commessaCell = XLSX.utils.encode_cell({ r: row, c: 0 });
                    if (ws[commessaCell]) {
                        ws[commessaCell].t = 'n'; // number type
                        ws[commessaCell].z = '0'; // number format
                    }
                    // Machine column (C)
                    const machineCell = XLSX.utils.encode_cell({ r: row, c: 2 });
                    if (ws[machineCell]) {
                        ws[machineCell].t = 'n'; // number type
                        ws[machineCell].z = '0'; // number format
                    }
                }

                XLSX.utils.book_append_sheet(wb, ws, 'Order Summary');

                const filename = `order_summary_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
                
                XLSX.writeFile(wb, filename);
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB');
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
                                Machine
                            </label>
                            <Input
                                type="text"
                                placeholder="Search..."
                                value={filters.machine}
                                onChange={(e) => setFilters({ ...filters, machine: e.target.value })}
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
                    <table className="w-full">
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
                                    onClick={() => handleSort('machine')}
                                >
                                    <div className="flex items-center gap-2">
                                        Machine
                                        {getSortIcon('machine')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('time')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Time
                                        {getSortIcon('time')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('qty_requested')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Qty Req
                                        {getSortIcon('qty_requested')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('qty')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Qty Done
                                        {getSortIcon('qty')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                                        Loading...
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
                                        <td className="px-4 py-3 text-sm">
                                            <div className="font-mono text-primary">{row.commessa_display}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-xs">{row.order_description}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-300">
                                            <div className="font-mono text-zinc-400">{row.machine}</div>
                                            <div className="text-xs text-zinc-500">{row.machine_name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-right text-white font-semibold">
                                            {formatTime(row.work_time)}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                            {row.qty_requested?.toLocaleString() || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-right text-zinc-300">
                                            {row.qty_completed.toLocaleString()}
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
