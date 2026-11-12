'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type Matcher } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import { APP_COPY } from '@/locales';
import 'react-day-picker/dist/style.css';
import { surfaceClasses } from '@/components/ui/Surface';
import { Pressable } from '@/components/ui/Pressable';

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
    /** Name for screen readers when there is no visible label tied to it */
    ariaLabel?: string;
    /** Earliest / latest date that can be chosen (YYYY-MM-DD) */
    min?: string;
    max?: string;
    /** Emptying the field gives '' (a date that may be left out); otherwise the last valid date stays */
    clearable?: boolean;
    autoFocus?: boolean;
}

/** Room kept between the calendar and the field / the window edge (px) */
const GAP = 6;

/** YYYY-MM-DD → DD/MM/YYYY as shown in the field */
function toDisplay(value: string): string {
    if (!value) return '';
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : value;
}

const toDate = (value?: string) => (value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined);

/**
 * A date typed as DD/MM/YYYY or picked from a calendar. The calendar floats above the page (never cut off by a panel
 * that scrolls or a popup window) and opens upwards when there is no room below.
 */
export function DatePicker({ value, onChange, placeholder, id, ariaLabel, min, max, clearable, autoFocus }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<React.CSSProperties | null>(null);
    // Filled from the start, so the date shows before the page is interactive
    const [inputValue, setInputValue] = useState(() => toDisplay(value));
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(toDisplay(value));
    }, [value]);

    // Under the field, left edges aligned; above it when the window has no room below
    useLayoutEffect(() => {
        if (!isOpen || !containerRef.current || !popupRef.current) return;
        const field = containerRef.current.getBoundingClientRect();
        const { offsetHeight: height, offsetWidth: width } = popupRef.current;
        const below = field.bottom + GAP + height <= window.innerHeight;
        setPosition({
            left: Math.max(GAP, Math.min(field.left, window.innerWidth - width - GAP)),
            ...(below ? { top: field.bottom + GAP } : { top: Math.max(GAP, field.top - GAP - height) }),
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const inside = (target: EventTarget | null) => containerRef.current?.contains(target as Node) || popupRef.current?.contains(target as Node);
        const close = (event: Event) => {
            if (!inside(event.target)) setIsOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', escape, true);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', escape, true);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [isOpen]);

    const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;

        // Remove all non-numeric characters except slashes
        val = val.replace(/[^\d/]/g, '');

        // Auto-add slashes as user types
        if (val.length === 2 && !val.includes('/')) {
            val = val + '/';
        } else if (val.length === 5 && val.split('/').length === 2) {
            val = val + '/';
        }

        // Limit to DD/MM/YYYY format (10 characters)
        if (val.length > 10) {
            val = val.substring(0, 10);
        }

        setInputValue(val);
        if (clearable && val === '') onChange('');

        // Try to parse DD/MM/YYYY format
        if (val.length === 10) {
            const parsed = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsed) && inRange(format(parsed, 'yyyy-MM-dd'))) {
                onChange(format(parsed, 'yyyy-MM-dd'));
            }
        }
    };

    const choose = (date: Date) => {
        onChange(format(date, 'yyyy-MM-dd'));
        setInputValue(format(date, 'dd/MM/yyyy'));
        setIsOpen(false);
    };

    const selectedDate = toDate(value);
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const disabled: Matcher[] = [...(min ? [{ before: toDate(min) as Date }] : []), ...(max ? [{ after: toDate(max) as Date }] : [])];

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={placeholder || APP_COPY.common.datePlaceholder}
                    aria-label={ariaLabel}
                    maxLength={10}
                    autoFocus={autoFocus}
                    className="w-full px-3 py-2 pr-10 bg-card border border-border rounded-md text-sm text-fg-strong placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Pressable
                    type="button"
                    onClick={() => {
                        setPosition(null);
                        setIsOpen(!isOpen);
                    }}
                    aria-label={APP_COPY.common.pickDate}
                    title={APP_COPY.common.pickDate}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-fg-muted hover:text-primary transition-colors"
                >
                    <Calendar size={16} />
                </Pressable>
            </div>

            {isOpen &&
                createPortal(
                    <div
                        ref={popupRef}
                        style={{ position: 'fixed', ...(position ?? { top: 0, left: 0, visibility: 'hidden' }) }}
                        className={surfaceClasses('floating', 'z-[60] border-border p-3')}
                    >
                        <DayPicker
                            mode="single"
                            selected={selectedDate}
                            defaultMonth={selectedDate}
                            onSelect={(date) => date && choose(date)}
                            disabled={disabled}
                            locale={it}
                            className="rdp-custom"
                        />
                        <div className="border-t border-border pt-2 mt-2">
                            <Pressable
                                type="button"
                                onClick={() => choose(new Date())}
                                disabled={!inRange(todayIso)}
                                className="w-full px-3 py-2 text-sm text-fg-secondary hover:text-fg-strong hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                                {APP_COPY.common.today}
                            </Pressable>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
