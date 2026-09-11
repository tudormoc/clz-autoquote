'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { APP_COPY } from '@/locales';

interface PresetSelectCellProps {
    value: string | null;
    presets?: string[];
    onSave: (newValue: string | null) => Promise<boolean>;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Dedicated inline cell for Causale (Ferie / Permesso) preset tag selection and custom text.
 */
export function PresetSelectCell({
    value,
    presets = [],
    onSave,
    placeholder = '—',
    disabled = false,
}: PresetSelectCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [openAbove, setOpenAbove] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const updatePopupPosition = (targetElement?: HTMLElement | null) => {
        const el = targetElement || containerRef.current || inputRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const spaceBelowViewport = window.innerHeight - rect.bottom;

        const tr = el.closest('tr');
        const isLastRow = tr ? !tr.nextElementSibling : false;

        const tableContainer = el.closest('.overflow-x-auto') || el.closest('table');
        let tableSpaceBelow = spaceBelowViewport;
        if (tableContainer) {
            const tableRect = tableContainer.getBoundingClientRect();
            tableSpaceBelow = tableRect.bottom - rect.bottom;
        }

        const effectiveSpaceBelow = Math.min(spaceBelowViewport, tableSpaceBelow);
        setOpenAbove(isLastRow || effectiveSpaceBelow < 140);
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
            updatePopupPosition(inputRef.current);

            const handleScroll = () => updatePopupPosition(inputRef.current);
            window.addEventListener('scroll', handleScroll, true);
            return () => window.removeEventListener('scroll', handleScroll, true);
        }
    }, [isEditing]);

    const handleStartEdit = (e?: React.MouseEvent<HTMLElement>) => {
        if (disabled || saving) return;
        if (e?.currentTarget) {
            updatePopupPosition(e.currentTarget);
        }
        setEditValue(value || '');
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue('');
    };

    const handleSavePreset = async (presetText: string) => {
        setSaving(true);
        try {
            const trimmed = presetText.trim().toUpperCase();
            const success = await onSave(trimmed === '' ? null : trimmed);
            if (success) {
                setIsEditing(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        setSaving(true);
        try {
            const success = await onSave(null);
            if (success) {
                setIsEditing(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCommit = async () => {
        if (!isEditing || saving) return;
        const trimmed = editValue.trim().toUpperCase();
        const finalVal = trimmed === '' ? null : trimmed;

        if (finalVal === (value || null)) {
            setIsEditing(false);
            return;
        }

        setSaving(true);
        try {
            const success = await onSave(finalVal);
            if (success) {
                setIsEditing(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCommit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    if (saving) {
        return (
            <div className="flex items-center justify-center px-2 py-1 text-xs text-primary font-mono gap-1">
                <Loader2 size={12} className="animate-spin" />
                <span>{editValue || '...'}</span>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div ref={containerRef} className="relative flex items-center justify-center z-30">
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    placeholder="Causale..."
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleCommit}
                    onKeyDown={handleKeyDown}
                    className="h-7 min-w-[7rem] max-w-[14rem] px-2 text-xs text-center font-semibold uppercase bg-zinc-950 text-zinc-100 border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-lg"
                />
                <div
                    className={`absolute ${
                        openAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    } z-50 flex items-center gap-1 bg-zinc-900 border border-zinc-700 p-1.5 rounded shadow-2xl backdrop-blur-sm whitespace-nowrap`}
                >
                    {presets.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSavePreset(p);
                            }}
                            className="px-2 py-0.5 text-[10px] font-semibold bg-zinc-800 hover:bg-amber-600/30 hover:text-amber-300 text-zinc-300 border border-zinc-700 rounded transition-colors cursor-pointer"
                        >
                            {p}
                        </button>
                    ))}
                    {value && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleClear();
                            }}
                            title="Rimuovi causale"
                            className="px-1.5 py-0.5 text-[10px] font-medium bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <X size={10} />
                            <span>Rimuovi</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const hasValue = Boolean(value && value.trim() !== '');

    if (hasValue) {
        return (
            <div className="flex justify-center">
                <span
                    onClick={handleStartEdit}
                    title={disabled ? undefined : APP_COPY.analytics.monthlySummary.headers.clickToEdit}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        disabled
                            ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer'
                    }`}
                >
                    {value}
                </span>
            </div>
        );
    }

    return (
        <div className="flex justify-center">
            <span
                onClick={handleStartEdit}
                title={disabled ? undefined : APP_COPY.analytics.monthlySummary.headers.clickToEdit}
                className={`px-2 py-0.5 rounded text-xs font-mono text-center block transition-colors ${
                    disabled
                        ? 'text-zinc-600 cursor-default'
                        : 'cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-300 text-zinc-600 italic'
                }`}
            >
                {placeholder}
            </span>
        </div>
    );
}
