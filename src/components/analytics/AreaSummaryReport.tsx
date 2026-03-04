'use client';

import { useEffect, useState } from 'react';
import { getAreaSummaryDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales/en';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';

interface AreaSummaryRow {
    area_name: string;
    work_time: number;
    requested_quantity: number;
    velocity: number;
    target_velocity: number;
    efficiency: number;
    machine_count: number;
}

interface Filters {
    area: string;
    dateFrom: string;
    dateTo: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function AreaSummaryReport() {
    const [data, setData] = useState<AreaSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const [filters, setFilters] = useState<Filters>({
        area: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'work_time',
        direction: 'desc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getAreaSummaryDataAction(2024, page, limit, {
            machine: appliedFilters.area || undefined, // API still uses 'machine' param name
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
        setAppliedFilters({...filters}); // Force refresh even if filters unchanged
        setPage(1);
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            area: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd()
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'work_time',
            direction: 'desc'
        });
        setPage(1);
    };

    const handleExportExcel = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const result = await getAreaSummaryDataAction(2024, 1, 999999, {
                machine: appliedFilters.area || undefined, // API still uses 'machine' param name
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                const excelData = result.data.map(row => ({
                    'Area': row.area_name,
                    'Numero Macchine': row.machine_count,
                    'Quantità Richiesta': row.requested_quantity,
                    'Ore Lavorate': row.work_time.toFixed(2),
                    'Velocità (pz/h)': row.velocity.toFixed(1),
                    'Target (pz/h)': row.target_velocity,
                    'Efficienza (%)': row.efficiency.toFixed(0)
                }));

                const ws = XLSX.utils.json_to_sheet(excelData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Area Summary');
                XLSX.writeFile(wb, `area-summary-${new Date().toISOString().split('T')[0]}.xlsx`);
            }
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setLoading(false);
        }
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                Area
                            </label>
                            <Input
                                type="text"
                                placeholder="Search area..."
                                value={filters.area}
                                onChange={(e) => setFilters({ ...filters, area: e.target.value })}
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

            {/* Stats */}
            <div className="flex items-center justify-between text-sm text-zinc-400">
                <div>
                    Showing <span className="text-white font-mono">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="text-white font-mono">{Math.min(page * limit, total)}</span> of{' '}
                    <span className="text-white font-mono">{total}</span> areas
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
                {data.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-900 border-b border-zinc-800">
                                <tr>
                                    <th 
                                        className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('area_name')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Area
                                            {getSortIcon('area_name')}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400">
                                        Machines
                                    </th>
                                    <th 
                                        className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('requested_quantity')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            Quantity
                                            {getSortIcon('requested_quantity')}
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
                                        onClick={() => handleSort('velocity')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            Velocity
                                            {getSortIcon('velocity')}
                                        </div>
                                    </th>
                                    <th 
                                        className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => handleSort('efficiency')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            Efficiency
                                            {getSortIcon('efficiency')}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {data.map((row, idx) => {
                                    // Import thresholds from constants
                                    const { APP_CONFIG } = require('@/config/constants');
                                    const thresholds = APP_CONFIG.ANALYTICS.EFFICIENCY_THRESHOLDS;
                                    
                                    const efficiencyColor = 
                                        row.efficiency >= thresholds.EXCELLENT ? 'text-success-foreground' :
                                        row.efficiency >= thresholds.ACCEPTABLE ? 'text-warning-foreground' :
                                        'text-destructive';
                                    
                                    return (
                                        <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium text-white">{row.area_name}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded bg-zinc-800 text-zinc-300">
                                                    {row.machine_count}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-white">
                                                {row.requested_quantity.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-white">
                                                {formatTime(row.work_time)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-mono text-white">
                                                <div>{row.velocity.toFixed(1)}</div>
                                                <div className="text-xs text-zinc-500">/ {row.target_velocity}</div>
                                            </td>
                                            <td className={`px-4 py-3 text-sm text-right font-mono font-semibold ${efficiencyColor}`}>
                                                {row.efficiency.toFixed(0)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-zinc-500">
                        No data found for the selected filters
                    </div>
                )}
            </div>
        </div>
    );
}
