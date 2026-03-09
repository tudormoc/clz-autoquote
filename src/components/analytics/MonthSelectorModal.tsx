'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';

interface MonthSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (year: number, months: number[]) => void;
    loading?: boolean;
}

const MONTHS = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' }
];

export function MonthSelectorModal({ isOpen, onClose, onGenerate, loading }: MonthSelectorModalProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);

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
            onGenerate(selectedYear, selectedMonths);
        }
    };

    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        setSelectedMonths([]); // Clear month selection when year changes
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-white">Generate PDF Report</h2>
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
                        Select year and months to include in the report:
                    </p>

                    {/* Year Selector */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-zinc-400 mb-2">
                            Year
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
                            Months
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

                    {selectedMonths.length > 0 && (
                        <div className="text-xs text-zinc-400">
                            Selected: {selectedYear} - {selectedMonths.map(m => MONTHS[m - 1].name).join(', ')}
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
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        className="flex-1"
                        disabled={selectedMonths.length === 0 || loading}
                    >
                        {loading ? 'Generating...' : 'Generate PDF'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
