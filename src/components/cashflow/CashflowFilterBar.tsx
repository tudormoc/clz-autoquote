'use client';

import React, { useState } from 'react';
import { Calendar, Filter, Layers, Search, RefreshCw } from 'lucide-react';
import { APP_COPY } from '@/locales';

export const CashflowFilterBar = () => {
    const f = APP_COPY.cashflow.filters;
    const [selectedPeriod, setSelectedPeriod] = useState('next3Months');
    const [selectedFlowType, setSelectedFlowType] = useState('all');

    return (
        <div className="bg-card border border-zinc-800 rounded-xl p-4 mb-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Cerca per cliente, fornitore, n° documento..."
                        className="w-full bg-zinc-900 border border-zinc-700/60 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-primary/60 transition-colors"
                        disabled
                    />
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Period Selector */}
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700/60 rounded-lg px-3 py-1.5">
                        <Calendar size={16} className="text-zinc-400" />
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer"
                        >
                            <option value="currentMonth">{f.currentMonth}</option>
                            <option value="next3Months">{f.next3Months}</option>
                            <option value="next6Months">{f.next6Months}</option>
                            <option value="fullYear">{f.fullYear}</option>
                        </select>
                    </div>

                    {/* Flow Type Toggle Buttons */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-700/60 rounded-lg p-1">
                        <button
                            onClick={() => setSelectedFlowType('all')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                selectedFlowType === 'all'
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {f.allFlows}
                        </button>
                        <button
                            onClick={() => setSelectedFlowType('incomes')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                selectedFlowType === 'incomes'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {f.incomesOnly}
                        </button>
                        <button
                            onClick={() => setSelectedFlowType('expenses')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                selectedFlowType === 'expenses'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            {f.expensesOnly}
                        </button>
                    </div>

                    <button
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-zinc-700/50"
                        title="Reimposta Filtri"
                    >
                        <RefreshCw size={14} />
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            {/* Certainty / Status Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60 text-xs">
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mr-2">
                    <Layers size={14} />
                    {f.statusLabel}:
                </span>
                <span className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer hover:border-zinc-500 transition-colors">
                    ✓ {f.statusInvoiced}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-zinc-800/50 border border-zinc-800 text-zinc-400 cursor-pointer hover:border-zinc-700 transition-colors">
                    + {f.statusOrders}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-zinc-800/50 border border-zinc-800 text-zinc-400 cursor-pointer hover:border-zinc-700 transition-colors">
                    + {f.statusRecurring}
                </span>
            </div>
        </div>
    );
};
