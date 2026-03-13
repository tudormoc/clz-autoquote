'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import { APP_COPY } from '@/locales';

interface MonthSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (year: number, months: number[], separateByArea: boolean) => void;
    loading?: boolean;
}

const MONTHS = [
    { num: 1, name: 'Gennaio' },
    { num: 2, name: 'Febbraio' },
    { num: 3, name: 'Marzo' },
    { num: 4, name: 'Aprile' },
    { num: 5, name: 'Maggio' },
    { num: 6, name: 'Giugno' },
    { num: 7, name: 'Luglio' },
    { num: 8, name: 'Agosto' },
    { num: 9, name: 'Settembre' },
    { num: 10, name: 'Ottobre' },
    { num: 11, name: 'Novembre' },
    { num: 12, name: 'Dicembre' }
];

export function MonthSelectorModal({ isOpen, onClose, onGenerate, loading }: MonthSelectorModalProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
    const [separateByArea, setSeparateByArea] = useState<boolean>(false);

    // Generate available years (2024 to current year + 1)
    const availableYears = Array.from(
        { length: currentYear - 2024 + 2 },
        (_, i) => 2024 + i
    );

    if (!isOpen) return null;

    const toggleMonth = (monthNum: number) => {
        setSelectedMonths(prev => 
            prev.includes(monthNum)
                ? prev.filter(m => m !== monthNum)
                : [...prev, monthNum].sort((a, b) => a - b)
        );
    };

    const handleGenerate = () => {
        if (selectedMonths.length > 0) {
            onGenerate(selectedYear, selectedMonths, separateByArea);
        }
    };

    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        setSelectedMonths([]); // Clear month selection when year changes
    };

    const copy = APP_COPY.analytics.areaSummary;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-white">{copy.pdfTitle}</h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-sm text-zinc-400 mb-4">
                        Seleziona l'anno e i mesi da includere nel report:
                    </p>

                    {/* Year Selector */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-zinc-400 mb-2">
                            Anno
                        </label>
                        <div className="flex gap-2">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    onClick={() => handleYearChange(year)}
                                    disabled={loading}
                                    className={`
                                        px-4 py-2 rounded text-sm font-medium transition-all
                                        ${selectedYear === year
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }
                                        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Month Selector */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-zinc-400 mb-2">
                            Mesi
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                        {MONTHS.map(month => (
                            <button
                                key={month.num}
                                onClick={() => toggleMonth(month.num)}
                                disabled={loading}
                                className={`
                                    px-3 py-2 rounded text-sm font-medium transition-all
                                    ${selectedMonths.includes(month.num)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }
                                    ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {month.name.slice(0, 3)}
                            </button>
                        ))}
                        </div>
                    </div>

                    {/* Separate PDFs Toggle */}
                    <div className="mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="pt-0.5">
                                <input
                                    type="checkbox"
                                    checked={separateByArea}
                                    onChange={(e) => setSeparateByArea(e.target.checked)}
                                    disabled={loading}
                                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary focus:ring-offset-zinc-900"
                                />
                            </div>
                            <div className="flex-1">
                                <span className="block text-sm font-medium text-white group-hover:text-primary transition-colors">
                                    {copy.separateReports}
                                </span>
                                <span className="block text-xs text-zinc-400">
                                    {copy.separateReportsDescription}
                                </span>
                            </div>
                        </label>
                    </div>

                    {selectedMonths.length > 0 && (
                        <div className="text-xs text-zinc-400">
                            Selezionati: {selectedYear} - {selectedMonths.map(m => MONTHS[m - 1].name).join(', ')}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 p-4 border-t border-zinc-800">
                    <Button
                        onClick={onClose}
                        variant="secondary"
                        className="flex-1"
                        disabled={loading}
                    >
                        Annulla
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        className="flex-1"
                        disabled={selectedMonths.length === 0 || loading}
                    >
                        {loading ? 'Generazione...' : 'Genera PDF'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
