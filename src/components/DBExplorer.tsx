'use client';

import { useState, useEffect } from 'react';
import { getTablesAction, getTableDataAction, getColumnDistinctValuesAction } from '../app/db-actions';
import { MSSQL_DB } from '@/lib/mssql';

export function DBExplorer() {
    const [selectedDB, setSelectedDB] = useState<MSSQL_DB>('BUSINESS');
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [tableInfo, setTableInfo] = useState<{ columns: any[], rows: any[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterColumn, setFilterColumn] = useState('');
    const [filterValue, setFilterValue] = useState('');
    const [uniqueValues, setUniqueValues] = useState<{ value: any, count: number }[] | null>(null);

    useEffect(() => {
        loadTables();
    }, [selectedDB]);

    const loadTables = async () => {
        setLoading(true);
        setTables([]);
        setSelectedTable('');
        setTableInfo(null);
        const res = await getTablesAction(selectedDB);
        if (res.success) setTables(res.tables || []);
        setLoading(false);
    };



    const [activeColForUnique, setActiveColForUnique] = useState('');

    const handleSelectTable = async (name: string, search?: string, fCol?: string, fVal?: string) => {
        setSelectedTable(name);
        setLoading(true);
        setUniqueValues(null); // Clear unique values on table change
        setActiveColForUnique('');
        const res = await getTableDataAction(name, search, fCol, fVal, selectedDB);
        if (res.success) {
            setTableInfo({ columns: res.columns || [], rows: res.rows || [] });
        }
        setLoading(false);
    };

    const handleViewUniqueValues = async (colName: string) => {
        setLoading(true);
        setActiveColForUnique(colName);
        const res = await getColumnDistinctValuesAction(selectedTable, colName, selectedDB);
        if (res.success) {
            setUniqueValues(res.values || []);
        }
        setLoading(false);
    };

    const handleQuickFilter = (val: string) => {
        const stringVal = String(val);
        setFilterColumn(activeColForUnique);
        setFilterValue(stringVal);
        handleSelectTable(selectedTable, searchTerm, activeColForUnique, stringVal);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTable) {
            handleSelectTable(selectedTable, searchTerm, filterColumn, filterValue);
        }
    };

    return (
        <div className="space-y-4 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center gap-4">
                    <div className="flex bg-card p-1 rounded">
                        <button
                            onClick={() => setSelectedDB('BUSINESS')}
                            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${selectedDB === 'BUSINESS'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-fg-muted hover:text-fg-soft'
                                }`}
                        >
                            Business (ERP)
                        </button>
                        <button
                            onClick={() => setSelectedDB('NETPRO')}
                            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${selectedDB === 'NETPRO'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-fg-muted hover:text-fg-soft'
                                }`}
                        >
                            NetPro (PROD)
                        </button>
                        <button
                            onClick={() => setSelectedDB('QUOTES')}
                            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${selectedDB === 'QUOTES'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-fg-muted hover:text-fg-soft'
                                }`}
                        >
                            Quotes (INTERNAL)
                        </button>
                    </div>
                </div>

                <div className="text-xs text-fg-faint font-mono">
                    Target: {selectedDB === 'BUSINESS' ? 'COOPZANARDI' : selectedDB === 'NETPRO' ? 'NETPRO' : 'CLZDWHQANDPROG'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Tables Sidebar */}
                <div className="lg:col-span-1 bg-card p-4 rounded-lg border border-border h-[70vh] overflow-y-auto">
                    <h2 className="font-semibold text-fg mb-4 sticky top-0 bg-card pb-2 border-b border-border">Tables ({tables.length})</h2>
                    <div className="space-y-1">
                        {tables.map(table => (
                            <button
                                key={table}
                                onClick={() => {
                                    setSearchTerm('');
                                    handleSelectTable(table);
                                }}
                                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedTable === table
                                    ? 'bg-muted text-primary font-medium'
                                    : 'text-fg-muted hover:bg-card'
                                    }`}
                            >
                                {table}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table Content */}
                <div className="lg:col-span-3 bg-card p-4 rounded-lg border border-border h-[70vh] flex flex-col">
                    {!selectedTable ? (
                        <div className="flex-1 flex items-center justify-center text-fg-subtle">
                            Select a table from the list to explore
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-fg">{selectedTable}</h2>
                                    <p className="text-xs text-fg-subtle mt-1">Showing up to 100 rows</p>
                                </div>

                                <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            placeholder="Col (an_tipo)"
                                            value={filterColumn}
                                            onChange={(e) => setFilterColumn(e.target.value)}
                                            className="w-28 px-2 py-1.5 border border-border-strong bg-background rounded text-xs text-fg focus:border-primary outline-none transition-colors"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Value (C)"
                                            value={filterValue}
                                            onChange={(e) => setFilterValue(e.target.value)}
                                            className="w-20 px-2 py-1.5 border border-border-strong bg-background rounded text-xs text-fg focus:border-primary outline-none transition-colors"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="General Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="px-3 py-1.5 border border-border-strong bg-background rounded text-sm text-fg focus:border-primary outline-none transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
                                    >
                                        Apply Filters
                                    </button>
                                </form>
                            </div>

                            {loading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : tableInfo && (
                                <div className="flex-1 overflow-auto">
                                    {/* Columns Info */}
                                    <div className="mb-6">
                                        <h3 className="text-sm font-semibold text-fg-secondary mb-2">Structure (Click to see unique values)</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {tableInfo.columns.map(col => (
                                                <button
                                                    key={col.COLUMN_NAME}
                                                    onClick={() => handleViewUniqueValues(col.COLUMN_NAME)}
                                                    className="px-2 py-1 bg-card border border-border-strong rounded flex flex-col hover:bg-muted hover:border-primary transition-colors text-left"
                                                >
                                                    <span className="text-3xs font-mono font-bold text-primary">{col.COLUMN_NAME}</span>
                                                    <span className="text-4xs text-fg-subtle uppercase">{col.DATA_TYPE}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Unique Values Panel */}
                                    {uniqueValues && (
                                        <div className="mb-6 p-4 bg-card/50 border border-border-strong rounded-lg">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-sm font-semibold text-primary border-b border-border-strong pb-1">Unique Values (Top 20)</h3>
                                                <button onClick={() => setUniqueValues(null)} className="text-fg-muted hover:text-fg-soft text-xs">✕ Close</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {uniqueValues.map((v, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleQuickFilter(v.value)}
                                                        className="px-2 py-1 bg-muted border border-border-strong rounded hover:border-primary transition-all flex items-center gap-2 group"
                                                    >
                                                        <span className="text-xs font-mono font-medium text-fg-soft">{v.value === null ? 'NULL' : String(v.value)}</span>
                                                        <span className="text-3xs px-1.5 py-0.5 bg-muted-strong text-fg-secondary rounded-full font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{v.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-3xs text-fg-subtle italic">Click a value above to <strong>instantly filter</strong> the table by this value.</p>
                                        </div>
                                    )}

                                    {/* Data Table */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-fg-secondary mb-2">Sample Data</h3>
                                        <div className="overflow-x-auto border border-border rounded-lg">
                                            <table className="min-w-full divide-y divide-border">
                                                <thead className="bg-card/50">
                                                    <tr>
                                                        {tableInfo.columns.map(col => (
                                                            <th key={col.COLUMN_NAME} className="px-3 py-2 text-left text-3xs font-bold text-fg-muted uppercase tracking-wider border-b border-border">
                                                                {col.COLUMN_NAME}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-card divide-y divide-border">
                                                    {tableInfo.rows.map((row, i) => (
                                                        <tr key={i} className="hover:bg-card/50">
                                                            {tableInfo.columns.map(col => (
                                                                <td key={col.COLUMN_NAME} className="px-3 py-2 whitespace-nowrap text-2xs text-fg-muted font-mono">
                                                                    {row[col.COLUMN_NAME] !== null ? String(row[col.COLUMN_NAME]) : <span className="text-fg-faint italic">null</span>}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div >
    );
}
