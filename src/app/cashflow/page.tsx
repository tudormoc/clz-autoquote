'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Header } from '@/components/Header';
import { Wallet, Calendar, RefreshCw } from 'lucide-react';
import { APP_COPY } from '@/locales';

import { CashflowMonthlyMatrix } from '@/components/cashflow/CashflowMonthlyMatrix';
import { getCashflowMonthlyDataAction, CashflowDataResult } from '@/app/cashflow/cashflow-actions';

export default function CashflowPage() {
    const copy = APP_COPY.cashflow;
    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [isPending, startTransition] = useTransition();
    const [cashflowData, setCashflowData] = useState<CashflowDataResult | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const loadData = (year: number) => {
        setLoading(true);
        startTransition(async () => {
            const res = await getCashflowMonthlyDataAction(year);
            if (res.success) {
                setCashflowData(res);
            }
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData(selectedYear);
    }, [selectedYear]);

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Wallet size={24} />
                                </div>
                                <h1 className="text-2xl font-bold text-zinc-100">
                                    {copy.title}
                                </h1>
                            </div>
                            <p className="text-zinc-400 text-sm">{copy.subtitle}</p>
                        </div>

                        {/* Year Selector */}
                        <div className="flex items-center gap-3 bg-card border border-zinc-800 rounded-xl px-4 py-2">
                            <Calendar size={18} className="text-primary" />
                            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                                Anno:
                            </span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-zinc-900 border border-zinc-700/80 text-zinc-100 font-bold text-sm rounded-lg px-3 py-1 focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value={2026}>2026</option>
                                <option value={2025}>2025</option>
                                <option value={2024}>2024</option>
                            </select>
                            <button
                                onClick={() => loadData(selectedYear)}
                                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-primary transition-colors ml-1"
                                title="Ricarica Dati ERP"
                            >
                                <RefreshCw size={16} className={loading || isPending ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Monthly Executive Cashflow Matrix (Gennaio - Dicembre) */}

                    {/* Monthly Executive Cashflow Matrix (Gennaio - Dicembre) */}
                    <CashflowMonthlyMatrix
                        monthlyData={cashflowData?.monthlyBreakdown}
                        grandTotalIncome={cashflowData?.grandTotalIncome}
                        grandTotalExpense={cashflowData?.grandTotalExpense}
                        grandNetCashflow={cashflowData?.grandNetCashflow}
                        year={selectedYear}
                        loading={loading || isPending}
                    />
                </div>
            </main>
        </div>
    );
}
