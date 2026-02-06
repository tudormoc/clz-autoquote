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
        <div className="space-y-6 max-w-full">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setSelectedDB('BUSINESS')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedDB === 'BUSINESS'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Business (ERP)
                        </button>
                        <button
                            onClick={() => setSelectedDB('NETPRO')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedDB === 'NETPRO'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            NetPro (PROD)
                        </button>
                        <button
                            onClick={() => setSelectedDB('QUOTES')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedDB === 'QUOTES'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Quotes (INTERNAL)
                        </button>
                    </div>
                </div>

                <div className="text-xs text-gray-400 font-mono">
                    Target: {selectedDB === 'BUSINESS' ? 'COOPZANARDI' : selectedDB === 'NETPRO' ? 'NETPRO' : 'CLZDWHQANDPROG'}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Tables Sidebar */}
                <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-[70vh] overflow-y-auto">
                    <h2 className="font-semibold text-gray-900 mb-4 sticky top-0 bg-white pb-2 border-b">Tables ({tables.length})</h2>
                    <div className="space-y-1">
                        {tables.map(table => (
                            <button
                                key={table}
                                onClick={() => {
                                    setSearchTerm('');
                                    handleSelectTable(table);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedTable === table
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {table}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table Content */}
                <div className="lg:col-span-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-[70vh] flex flex-col">
                    {!selectedTable ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            Select a table from the list to explore
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{selectedTable}</h2>
                                    <p className="text-xs text-gray-500 mt-1">Showing up to 100 rows</p>
                                </div>

                                <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            placeholder="Col (an_tipo)"
                                            value={filterColumn}
                                            onChange={(e) => setFilterColumn(e.target.value)}
                                            className="w-28 px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Value (C)"
                                            value={filterValue}
                                            onChange={(e) => setFilterValue(e.target.value)}
                                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="General Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                                    >
                                        Apply Filters
                                    </button>
                                </form>
                            </div>

                            {loading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : tableInfo && (
                                <div className="flex-1 overflow-auto">
                                    {/* Columns Info */}
                                    <div className="mb-6">
                                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Structure (Click to see unique values)</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {tableInfo.columns.map(col => (
                                                <button
                                                    key={col.COLUMN_NAME}
                                                    onClick={() => handleViewUniqueValues(col.COLUMN_NAME)}
                                                    className="px-2 py-1 bg-gray-50 border border-gray-200 rounded flex flex-col hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
                                                >
                                                    <span className="text-[10px] font-mono font-bold text-blue-800">{col.COLUMN_NAME}</span>
                                                    <span className="text-[9px] text-gray-500 uppercase">{col.DATA_TYPE}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Unique Values Panel */}
                                    {uniqueValues && (
                                        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-sm font-semibold text-blue-900 border-b border-blue-200 pb-1">Unique Values (Top 20)</h3>
                                                <button onClick={() => setUniqueValues(null)} className="text-blue-500 hover:text-blue-700 text-xs">✕ Close</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {uniqueValues.map((v, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleQuickFilter(v.value)}
                                                        className="px-2 py-1 bg-white border border-blue-200 rounded-md shadow-sm hover:border-blue-400 transition-all flex items-center gap-2 group"
                                                    >
                                                        <span className="text-xs font-mono font-medium text-gray-700">{v.value === null ? 'NULL' : String(v.value)}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">{v.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-[10px] text-blue-400 italic">Click a value above to <strong>instantly filter</strong> the table by this value.</p>
                                        </div>
                                    )}

                                    {/* Data Table */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Sample Data</h3>
                                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        {tableInfo.columns.map(col => (
                                                            <th key={col.COLUMN_NAME} className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b">
                                                                {col.COLUMN_NAME}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {tableInfo.rows.map((row, i) => (
                                                        <tr key={i} className="hover:bg-gray-50">
                                                            {tableInfo.columns.map(col => (
                                                                <td key={col.COLUMN_NAME} className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-600 font-mono">
                                                                    {row[col.COLUMN_NAME] !== null ? String(row[col.COLUMN_NAME]) : <span className="text-gray-300 italic">null</span>}
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
