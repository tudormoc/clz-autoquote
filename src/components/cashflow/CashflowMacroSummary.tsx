'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Building } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { CounterpartySummary } from '@/app/cashflow/cashflow-actions';

interface CashflowMacroSummaryProps {
    incomesTotal?: number;
    topClients?: CounterpartySummary[];
    expensesTotal?: number;
    topSuppliers?: CounterpartySummary[];
    loading?: boolean;
}

const formatEUR = (amount?: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '€ --';
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(amount);
};

export const CashflowMacroSummary: React.FC<CashflowMacroSummaryProps> = ({
    incomesTotal = 0,
    topClients = [],
    expensesTotal = 0,
    topSuppliers = [],
    loading = false,
}) => {
    const m = APP_COPY.cashflow.macro;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Incomes Macro Card */}
            <div className="bg-card border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-100">{m.incomesTitle}</h3>
                            <p className="text-xs text-zinc-400">{m.incomesSubtitle}</p>
                        </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-semibold">
                        {loading ? 'Caricamento...' : formatEUR(incomesTotal)}
                    </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-1">
                    <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Principali Clienti / Entrate</span>
                        <span>Importo Totale</span>
                    </div>

                    {loading ? (
                        <div className="text-xs text-zinc-500 py-6 text-center">Caricamento dati dal database ERP...</div>
                    ) : topClients.length > 0 ? (
                        topClients.slice(0, 5).map((client, idx) => (
                            <div
                                key={idx}
                                className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-2.5 flex items-center justify-between hover:border-zinc-700 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <Building size={14} className="text-emerald-400 flex-shrink-0" />
                                    <div className="truncate">
                                        <div className="text-xs font-medium text-zinc-200 truncate">
                                            {client.name}
                                        </div>
                                        <div className="text-[10px] text-zinc-500">
                                            Cod: {client.accountCode} • {client.count} scadenze
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-mono text-xs text-emerald-300 font-semibold">
                                        {formatEUR(client.totalAmount)}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-zinc-500 py-4 text-center">Nessun dato trovato per l'anno selezionato.</div>
                    )}
                </div>
            </div>

            {/* Expenses Macro Card */}
            <div className="bg-card border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                            <TrendingDown size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-100">{m.expensesTitle}</h3>
                            <p className="text-xs text-zinc-400">{m.expensesSubtitle}</p>
                        </div>
                    </div>
                    <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20 font-semibold">
                        {loading ? 'Caricamento...' : formatEUR(expensesTotal)}
                    </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-1">
                    <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Principali Fornitori / Uscite</span>
                        <span>Importo Totale</span>
                    </div>

                    {loading ? (
                        <div className="text-xs text-zinc-500 py-6 text-center">Caricamento dati dal database ERP...</div>
                    ) : topSuppliers.length > 0 ? (
                        topSuppliers.slice(0, 5).map((supplier, idx) => (
                            <div
                                key={idx}
                                className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-2.5 flex items-center justify-between hover:border-zinc-700 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <Building size={14} className="text-rose-400 flex-shrink-0" />
                                    <div className="truncate">
                                        <div className="text-xs font-medium text-zinc-200 truncate">
                                            {supplier.name}
                                        </div>
                                        <div className="text-[10px] text-zinc-500">
                                            Cod: {supplier.accountCode} • {supplier.count} scadenze
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-mono text-xs text-rose-300 font-semibold">
                                        {formatEUR(supplier.totalAmount)}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-zinc-500 py-4 text-center">Nessun dato trovato per l'anno selezionato.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
