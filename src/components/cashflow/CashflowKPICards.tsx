import React from 'react';
import { TrendingUp, TrendingDown, Scale, Landmark } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { BankAccountBalance } from '@/app/cashflow/cashflow-actions';

interface CashflowKPICardsProps {
    incomesTotal?: number;
    incomesOpen?: number;
    expensesTotal?: number;
    expensesOpen?: number;
    netCashflow?: number;
    bankBalances?: BankAccountBalance[];
    totalBankBalance?: number;
    year?: number;
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

export const CashflowKPICards: React.FC<CashflowKPICardsProps> = ({
    incomesTotal = 0,
    incomesOpen = 0,
    expensesTotal = 0,
    expensesOpen = 0,
    netCashflow = 0,
    bankBalances = [],
    totalBankBalance = 0,
    year = 2026,
    loading = false,
}) => {
    const kpi = APP_COPY.cashflow.kpi;

    const cards = [
        {
            title: `Saldo Banche (Attuale ERP)`,
            subtitle: bankBalances.length > 0
                ? `${bankBalances.length} Banche registrate`
                : `Etica, Banco Popolare, Credem`,
            value: loading ? 'Caricamento...' : formatEUR(totalBankBalance),
            icon: Landmark,
            colorClass: 'text-amber-400',
            bgClass: 'bg-amber-500/10 border-amber-500/20',
            breakdown: bankBalances,
        },
        {
            title: `${kpi.totalIncomes} (${year})`,
            subtitle: `Totale: ${formatEUR(incomesTotal)} | Residuo: ${formatEUR(incomesOpen)}`,
            value: loading ? 'Caricamento...' : formatEUR(incomesTotal),
            icon: TrendingUp,
            colorClass: 'text-emerald-400',
            bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        },
        {
            title: `${kpi.totalExpenses} (${year})`,
            subtitle: `Totale: ${formatEUR(expensesTotal)} | Residuo: ${formatEUR(expensesOpen)}`,
            value: loading ? 'Caricamento...' : formatEUR(expensesTotal),
            icon: TrendingDown,
            colorClass: 'text-rose-400',
            bgClass: 'bg-rose-500/10 border-rose-500/20',
        },
        {
            title: `${kpi.netCashflow} (${year})`,
            subtitle: `Differenza tra Entrate e Uscite`,
            value: loading ? 'Caricamento...' : formatEUR(netCashflow),
            icon: Scale,
            colorClass: netCashflow >= 0 ? 'text-sky-400' : 'text-amber-400',
            bgClass: netCashflow >= 0 ? 'bg-sky-500/10 border-sky-500/20' : 'bg-amber-500/10 border-amber-500/20',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, idx) => {
                const Icon = card.icon;
                return (
                    <div
                        key={idx}
                        className="bg-card border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                {card.title}
                            </span>
                            <div className={`p-2 rounded-lg border ${card.bgClass} ${card.colorClass}`}>
                                <Icon size={18} />
                            </div>
                        </div>

                        <div>
                            <div className="text-xl font-bold font-mono text-zinc-100 tracking-tight mb-1">
                                {card.value}
                            </div>
                            {card.breakdown && card.breakdown.length > 0 ? (
                                <div className="mt-2 pt-2 border-t border-zinc-800/80 space-y-2">
                                    {/* Attivo (+) */}
                                    <div>
                                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">
                                            Attivo (+)
                                        </div>
                                        {card.breakdown.filter(b => b.balance >= 0).map((b, i) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] py-0.5">
                                                <span className="text-zinc-300 truncate max-w-[160px]" title={b.name}>
                                                    {b.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                                </span>
                                                <span className="font-mono text-emerald-400 font-medium">
                                                    {formatEUR(b.balance)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Passivo (-) */}
                                    <div className="pt-1 border-t border-zinc-800/50">
                                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">
                                            Passivo (-)
                                        </div>
                                        {card.breakdown.filter(b => b.balance < 0).map((b, i) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] py-0.5">
                                                <span className="text-zinc-300 truncate max-w-[160px]" title={b.name}>
                                                    {b.name.replace('BANCA POPOLARE ', 'B. ').replace('BANCA POP. ', 'B. ')}
                                                </span>
                                                <span className="font-mono text-rose-400 font-medium">
                                                    {formatEUR(b.balance)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-500 truncate">
                                    {card.subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
