'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { APP_COPY } from '@/locales';

interface EditableHoursCellProps {
    value: number | string | null;
    onSave: (newValue: number | string | null) => Promise<boolean>;
    placeholder?: string;
    step?: number;
    min?: number;
    disabled?: boolean;
    presets?: string[];
}

/**
 * Reusable inline editable cell for hours distribution columns.
 * Supports numeric input as well as custom text presets (e.g. 'FESTA', 'ROL').
 */
export function EditableHoursCell({
    value,
    onSave,
    placeholder = '—',
    step = 0.5,
    min = 0,
    disabled = false,
    presets,
}: EditableHoursCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [openAbove, setOpenAbove] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const updatePopupPosition = (targetElement?: HTMLElement | null) => {
        const el = targetElement || inputRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const spaceBelowViewport = window.innerHeight - rect.bottom;

        // Check if this is the last (or only) row in the table
        const tr = el.closest('tr');
        const isLastRow = tr ? !tr.nextElementSibling : false;

        // Check closest table or horizontal scroll container bounds
        const tableContainer = el.closest('.overflow-x-auto') || el.closest('table');
        let tableSpaceBelow = spaceBelowViewport;
        if (tableContainer) {
            const tableRect = tableContainer.getBoundingClientRect();
            tableSpaceBelow = tableRect.bottom - rect.bottom;
        }

        // Check main scroll container bounds
        const mainContainer = el.closest('main');
        let mainSpaceBelow = spaceBelowViewport;
        if (mainContainer) {
            const mainRect = mainContainer.getBoundingClientRect();
            mainSpaceBelow = mainRect.bottom - rect.bottom;
        }

        const effectiveSpaceBelow = Math.min(spaceBelowViewport, mainSpaceBelow, tableSpaceBelow);

        // Always open above if it's the last/only row in the table or if space below is under 130px
        const shouldOpenAbove = isLastRow || effectiveSpaceBelow < 130;
        setOpenAbove(shouldOpenAbove);
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
        setEditValue(value !== null && value !== undefined ? String(value) : '');
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue('');
    };

    const handleSavePreset = async (presetText: string) => {
        setSaving(true);
        try {
            const success = await onSave(presetText);
            if (success) {
                setIsEditing(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCommit = async () => {
        if (!isEditing || saving) return;

        const trimmed = editValue.trim();
        if (trimmed === '') {
            if (value === null) {
                setIsEditing(false);
                return;
            }
            setSaving(true);
            try {
                const success = await onSave(null);
                if (success) setIsEditing(false);
            } finally {
                setSaving(false);
            }
            return;
        }

        // Check if input is a valid number
        const normalizedNumberStr = trimmed.replace(',', '.');
        const numericVal = parseFloat(normalizedNumberStr);
        const isStrictNumber = !isNaN(numericVal) && !isNaN(Number(normalizedNumberStr));

        const finalVal: number | string = isStrictNumber
            ? Math.round(numericVal * 10) / 10
            : trimmed.toUpperCase();

        // Only save if changed
        if (finalVal === value) {
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
            <div className="flex items-center justify-end px-2 py-1 text-xs text-primary font-mono gap-1">
                <Loader2 size={12} className="animate-spin" />
                <span>{editValue || '...'}</span>
            </div>
        );
    }

    if (isEditing) {
        const hasPresets = Boolean(presets && presets.length > 0);
        return (
            <div className="relative flex justify-end z-30">
                <input
                    ref={inputRef}
                    type={hasPresets ? 'text' : 'number'}
                    step={step}
                    min={min}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleCommit}
                    onKeyDown={handleKeyDown}
                    style={{
                        width: hasPresets ? `${Math.max(8, (editValue?.length || 0) + 3)}ch` : undefined,
                    }}
                    className="h-7 min-w-[5.5rem] max-w-[24rem] px-2 text-xs text-right font-mono bg-background text-fg border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-lg"
                />
                {hasPresets && presets && (
                    <div
                        className={`absolute right-0 ${
                            openAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                        } z-50 flex items-center gap-1 bg-card border border-border-strong p-1 rounded shadow-2xl backdrop-blur-sm whitespace-nowrap`}
                    >
                        {presets.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSavePreset(p);
                                }}
                                className="px-1.5 py-0.5 text-3xs font-medium bg-muted hover:bg-warning-600/30 hover:text-warning-300 text-fg-secondary border border-border-strong rounded transition-colors"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
    const isTextPreset = hasValue && isNaN(Number(value));

    if (isTextPreset) {
        return (
            <div className="flex justify-end">
                <span
                    onClick={handleStartEdit}
                    title={disabled ? undefined : APP_COPY.analytics.monthlySummary.headers.clickToEdit}
                    className="cursor-pointer inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-warning-500/15 text-warning-400 border border-warning-500/30 hover:bg-warning-500/25 transition-colors"
                >
                    {String(value)}
                </span>
            </div>
        );
    }

    const formatted = hasValue ? Number(value).toFixed(1) : placeholder;

    return (
        <span
            onClick={handleStartEdit}
            title={disabled ? undefined : APP_COPY.analytics.monthlySummary.headers.clickToEdit}
            className={`px-2 py-1 rounded text-sm font-mono text-right block transition-colors ${
                disabled
                    ? 'text-fg-faint cursor-default'
                    : 'cursor-pointer hover:bg-muted/80 hover:text-primary ' +
                      (hasValue && Number(value) > 0 ? 'text-fg-soft font-medium' : 'text-fg-subtle italic')
            }`}
        >
            {formatted}
        </span>
    );
}
