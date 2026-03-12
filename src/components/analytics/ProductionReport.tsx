'use client';

import { useEffect, useState } from 'react';
import { getProductionDataAction } from '@/app/analytics/analytics-actions';
import { APP_COPY } from '@/locales';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getLastYearStart, getLastYearEnd } from '@/lib/dateUtils';

interface ProductionRow {
    date: string;
    machine: string;
    machine_name: string;
    operator: string;
    operator_name: string;
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
    operator: string;
    dateFrom: string;
    dateTo: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export function ProductionReport() {
    const [data, setData] = useState<ProductionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const [filters, setFilters] = useState<Filters>({
        commessa: '',
        machine: '',
        operator: '',
        dateFrom: getLastYearStart(),
        dateTo: getLastYearEnd()
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filters);
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        column: 'date',
        direction: 'asc'
    });

    const limit = 100;

    useEffect(() => {
        loadData();
    }, [page, appliedFilters, sortConfig]);

    const loadData = async () => {
        setLoading(true);
        const result = await getProductionDataAction(2024, page, limit, {
            commessa: appliedFilters.commessa || undefined,
            machine: appliedFilters.machine || undefined,
            operator: appliedFilters.operator || undefined,
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
        setPage(1); // Reset to first page when sorting
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
        setPage(1); // Reset to first page
        loadData(); // Force immediate refetch
    };

    const handleClearFilters = () => {
        const clearedFilters = {
            commessa: '',
            machine: '',
            operator: '',
            dateFrom: getLastYearStart(),
            dateTo: getLastYearEnd()
        };
        setFilters(clearedFilters);
        setAppliedFilters(clearedFilters);
        setSortConfig({
            column: 'date',
            direction: 'asc'
        });
        setPage(1);
    };

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            // Fetch all data with current filters (no pagination)
            const result = await getProductionDataAction(2024, 1, 999999, {
                commessa: appliedFilters.commessa || undefined,
                machine: appliedFilters.machine || undefined,
                operator: appliedFilters.operator || undefined,
                dateFrom: appliedFilters.dateFrom || undefined,
                dateTo: appliedFilters.dateTo || undefined,
            }, sortConfig, true);

            if (result.success && result.data.length > 0) {
                // Format data for Excel
                const excelData = result.data.map(row => {
                    // Parse date and remove time component
                    const date = new Date(row.date);
                    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    
                    return {
                        [APP_COPY.analytics.production.export.date]: dateOnly,
                        [APP_COPY.analytics.production.export.commessa]: Number(row.commessa_display),
                        [APP_COPY.analytics.production.export.description]: row.order_description,
                        [APP_COPY.analytics.production.export.machine]: Number(row.machine),
                        [APP_COPY.analytics.production.export.machineName]: row.machine_name,
                        [APP_COPY.analytics.production.export.operator]: Number(row.operator),
                        [APP_COPY.analytics.production.export.operatorName]: row.operator_name,
                        [APP_COPY.analytics.production.export.workTime]: Number(row.work_time.toFixed(2)),
                        [APP_COPY.analytics.production.export.qtyRequested]: row.qty_requested || 0,
                        [APP_COPY.analytics.production.export.qtyCompleted]: row.qty_completed
                    };
                });

                // Create workbook and worksheet
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(excelData);

                // Set column widths
                ws['!cols'] = [
                    { wch: 12 }, // Data
                    { wch: 10 }, // Commessa
                    { wch: 30 }, // Descrizione
                    { wch: 10 }, // Macchina
                    { wch: 25 }, // Nome Macchina
                    { wch: 10 }, // Operatore
                    { wch: 25 }, // Nome Operatore
                    { wch: 12 }, // Ore Lavoro
                    { wch: 15 }, // Quantità Richiesta
                    { wch: 15 }  // Quantità Completata
                ];

                // Format date and ID columns
                const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                for (let row = 1; row <= range.e.r; row++) {
                    // Date column (A)
                    const dateCell = XLSX.utils.encode_cell({ r: row, c: 0 });
                    if (ws[dateCell]) {
                        ws[dateCell].z = 'dd/mm/yyyy'; // Italian date format
                    }
                    // Commessa column (B)
                    const commessaCell = XLSX.utils.encode_cell({ r: row, c: 1 });
                    if (ws[commessaCell]) {
                        ws[commessaCell].t = 'n'; // number type
                        ws[commessaCell].z = '0'; // number format
                    }
                    // Machine column (D)
                    const machineCell = XLSX.utils.encode_cell({ r: row, c: 3 });
                    if (ws[machineCell]) {
                        ws[machineCell].t = 'n'; // number type
                        ws[machineCell].z = '0'; // number format
                    }
                    // Operator column (F)
                    const operatorCell = XLSX.utils.encode_cell({ r: row, c: 5 });
                    if (ws[operatorCell]) {
                        ws[operatorCell].t = 'n'; // number type
                        ws[operatorCell].z = '0'; // number format
                    }
                }

                XLSX.utils.book_append_sheet(wb, ws, 'Produzione');

                // Generate filename with date range
                const filename = `produzione_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
                
                // Download file
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                                {APP_COPY.analytics.production.headers.commessa}
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
                                {APP_COPY.analytics.production.headers.machine}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.common.search}
                                value={filters.machine}
                                onChange={(e) => setFilters({ ...filters, machine: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                                {APP_COPY.analytics.production.headers.operator}
                            </label>
                            <Input
                                type="text"
                                placeholder={APP_COPY.analytics.common.search}
                                value={filters.operator}
                                onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
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
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors w-28"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.production.headers.date}
                                        {getSortIcon('date')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors w-40"
                                    onClick={() => handleSort('commessa')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.production.headers.commessa}
                                        {getSortIcon('commessa')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors w-32"
                                    onClick={() => handleSort('machine')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.production.headers.machine}
                                        {getSortIcon('machine')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors w-32"
                                    onClick={() => handleSort('operator')}
                                >
                                    <div className="flex items-center gap-2">
                                        {APP_COPY.analytics.production.headers.operator}
                                        {getSortIcon('operator')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('time')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.production.headers.time}
                                        {getSortIcon('time')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('qty_requested')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.production.headers.qtyReq}
                                        {getSortIcon('qty_requested')}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => handleSort('qty')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        {APP_COPY.analytics.production.headers.qtyDone}
                                        {getSortIcon('qty')}
                                    </div>
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
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                                        {APP_COPY.analytics.empty}
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-zinc-300 w-28">
                                            {formatDate(row.date)}
                                        </td>
                                        <td className="px-4 py-3 text-sm w-40">
                                            <div className="font-mono text-primary truncate max-w-[10rem]">{row.commessa_display}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[10rem]" title={row.order_description}>{row.order_description}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-300 w-32">
                                            <div className="font-mono text-zinc-400 truncate max-w-[8rem]">{row.machine}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[8rem]" title={row.machine_name}>{row.machine_name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-300 w-32">
                                            <div className="font-mono text-zinc-400 truncate max-w-[8rem]">{row.operator}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[8rem]" title={row.operator_name}>{row.operator_name}</div>
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
                ) : (
                    <table className="w-full">
                        <thead className="bg-zinc-900 border-b border-zinc-800">
                             <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 w-28">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.production.headers.date}</div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 w-40">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.production.headers.commessa}</div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 w-32">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.production.headers.machine}</div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 w-32">
                                    <div className="flex items-center gap-2">{APP_COPY.analytics.production.headers.operator}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.production.headers.time}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.production.headers.qtyReq}</div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">
                                    <div className="flex items-center justify-end gap-2">{APP_COPY.analytics.production.headers.qtyDone}</div>
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
        </div>
    );
}
