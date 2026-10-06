'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import { APP_COPY } from '@/locales';

interface MonthSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (year: number, months: number[], separateByArea: boolean, format: 'A4' | 'A3', mode?: 'months' | 'weeks', weeks?: number[]) => void;
    loading?: boolean;
    title?: string;
    hideSeparateToggle?: boolean;
    /** Opt-in: shows Mesi / Settimane toggle — only used by area-summary */
    showWeekMode?: boolean;
    /** When true, hides the A4/A3 page format selector (e.g. client summary always uses A4 portrait) */
    hideFormatSelector?: boolean;
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

/** Returns the number of ISO weeks in a given year (52 or 53). */
const getISOWeeksInYear = (year: number): number => {
    // A year has 53 ISO weeks if Jan 1 or Dec 31 falls on Thursday
    const jan1Day = new Date(year, 0, 1).getDay();
    const dec31Day = new Date(year, 11, 31).getDay();
    return (jan1Day === 4 || dec31Day === 4) ? 53 : 52;
};

export function MonthSelectorModal({ isOpen, onClose, onGenerate, loading, title, hideSeparateToggle, showWeekMode, hideFormatSelector }: MonthSelectorModalProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
    const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
    const [separateByArea, setSeparateByArea] = useState<boolean>(false);
    const [pageFormat, setPageFormat] = useState<'A4' | 'A3'>('A4');
    const [mode, setMode] = useState<'months' | 'weeks'>('months');

    // Generate available years (2024 to current year + 1)
    const availableYears = Array.from(
        { length: currentYear - 2024 + 2 },
        (_, i) => 2024 + i
    );

    const totalWeeks = getISOWeeksInYear(selectedYear);

    if (!isOpen) return null;

    const toggleMonth = (monthNum: number) => {
        setSelectedMonths(prev =>
            prev.includes(monthNum)
                ? prev.filter(m => m !== monthNum)
                : [...prev, monthNum].sort((a, b) => a - b)
        );
    };

    const toggleWeek = (weekNum: number) => {
        setSelectedWeeks(prev =>
            prev.includes(weekNum)
                ? prev.filter(w => w !== weekNum)
                : [...prev, weekNum].sort((a, b) => a - b)
        );
    };

    const handleGenerate = () => {
        if (mode === 'weeks') {
            const weeksToGenerate = selectedWeeks.length > 0
                ? selectedWeeks
                : Array.from({ length: totalWeeks }, (_, i) => i + 1);
            onGenerate(selectedYear, [], separateByArea, pageFormat, 'weeks', weeksToGenerate);
        } else {
            const monthsToGenerate = selectedMonths.length > 0
                ? selectedMonths
                : MONTHS.map(m => m.num);
            onGenerate(selectedYear, monthsToGenerate, separateByArea, pageFormat, 'months', []);
        }
    };

    const handleYearChange = (year: number) => {
        setSelectedYear(year);
        // Clear period selections when year changes
        setSelectedMonths([]);
        setSelectedWeeks([]);
    };

    const handleModeChange = (newMode: 'months' | 'weeks') => {
        setMode(newMode);
        setSelectedMonths([]);
        setSelectedWeeks([]);
    };

    const copy = APP_COPY.analytics.areaSummary;
    const hasSelection = mode === 'weeks' ? selectedWeeks.length > 0 : selectedMonths.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-fg-strong">{title || copy.pdfTitle}</h2>
                    <button
                        onClick={onClose}
                        className="text-fg-muted hover:text-fg-strong transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-sm text-fg-muted mb-4">
                        Seleziona l&apos;anno e il periodo da includere nel report:
                    </p>

                    {/* Year Selector */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-fg-muted mb-2">Anno</label>
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
                                            : 'bg-muted text-fg-secondary hover:bg-muted-strong'
                                        }
                                        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mode Toggle — only shown when showWeekMode prop is true */}
                    {showWeekMode && (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                Tipo Periodo
                            </label>
                            <div className="flex gap-2">
                                {(['months', 'weeks'] as const).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => handleModeChange(m)}
                                        disabled={loading}
                                        className={`
                                            flex-1 px-4 py-2 rounded text-sm font-medium transition-all border
                                            ${mode === m
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : 'bg-muted border-border-strong text-fg-secondary hover:bg-muted-strong'
                                            }
                                            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {m === 'months' ? 'Mesi' : 'Settimane'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Period Selector: months grid or weeks grid */}
                    {mode === 'months' ? (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-fg-muted mb-2">Mesi</label>
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
                                                : 'bg-muted text-fg-secondary hover:bg-muted-strong'
                                            }
                                            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {month.name.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-fg-muted mb-2">
                                Settimane (1–{totalWeeks})
                            </label>
                            {/* 8 cols → 7 rows for 52 weeks; scrollable if 53 */}
                            <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto pr-1">
                                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => (
                                    <button
                                        key={week}
                                        onClick={() => toggleWeek(week)}
                                        disabled={loading}
                                        className={`
                                            py-1.5 rounded text-xs font-medium transition-all
                                            ${selectedWeeks.includes(week)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-fg-secondary hover:bg-muted-strong'
                                            }
                                            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {week}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Page Format Selector — hidden when report always uses a fixed format */}
                    {!hideFormatSelector && (
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-fg-muted mb-2">
                            Formato Pagina
                        </label>
                        <div className="flex gap-2">
                            {(['A4', 'A3'] as const).map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => setPageFormat(fmt)}
                                    disabled={loading}
                                    className={`
                                        flex-1 px-4 py-2 rounded text-sm font-medium transition-all border
                                        ${pageFormat === fmt
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'bg-muted border-border-strong text-fg-secondary hover:bg-muted-strong'
                                        }
                                        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    {fmt}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Separate PDFs Toggle */}
                    {!hideSeparateToggle && (
                        <div className="mb-4 p-3 bg-card/50 rounded-lg border border-border">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="pt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={separateByArea}
                                        onChange={(e) => setSeparateByArea(e.target.checked)}
                                        disabled={loading}
                                        className="w-4 h-4 rounded border-border-strong bg-muted text-primary focus:ring-primary focus:ring-offset-card"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="block text-sm font-medium text-fg-strong group-hover:text-primary transition-colors">
                                        {copy.separateReports}
                                    </span>
                                    <span className="block text-xs text-fg-muted">
                                        {copy.separateReportsDescription}
                                    </span>
                                </div>
                            </label>
                        </div>
                    )}

                    {hasSelection && (
                        <div className="text-xs text-fg-muted">
                            {mode === 'months'
                                ? `Selezionati: ${selectedYear} - ${selectedMonths.map(m => MONTHS[m - 1].name).join(', ')}`
                                : `Selezionate: ${selectedYear} - Settimane ${selectedWeeks.join(', ')}`
                            }
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 p-4 border-t border-border">
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
                        disabled={loading}
                    >
                        {loading
                            ? 'Generazione...'
                            : hasSelection
                                ? 'Genera PDF'
                                : 'Genera Tutto Anno'
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}
