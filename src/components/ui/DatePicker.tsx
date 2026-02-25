'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Convert YYYY-MM-DD to DD/MM/YYYY for display
        if (value) {
            const parsed = parse(value, 'yyyy-MM-dd', new Date());
            if (isValid(parsed)) {
                setInputValue(format(parsed, 'dd/MM/yyyy'));
            } else {
                setInputValue(value);
            }
        } else {
            setInputValue('');
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

        // Try to parse DD/MM/YYYY format
        if (val.length === 10) {
            const parsed = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsed)) {
                onChange(format(parsed, 'yyyy-MM-dd'));
            }
        }
    };

    const handleDaySelect = (date: Date | undefined) => {
        if (date) {
            const formatted = format(date, 'yyyy-MM-dd');
            onChange(formatted);
            setInputValue(format(date, 'dd/MM/yyyy'));
            setIsOpen(false);
        }
    };

    const handleTodayClick = () => {
        const today = new Date();
        const formatted = format(today, 'yyyy-MM-dd');
        onChange(formatted);
        setInputValue(format(today, 'dd/MM/yyyy'));
        setIsOpen(false);
    };

    const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={placeholder || 'DD/MM/YYYY'}
                    maxLength={10}
                    className="w-full px-3 py-2 pr-10 bg-card border border-zinc-800 rounded-md text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-primary transition-colors"
                >
                    <Calendar size={16} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-2 bg-card border border-zinc-800 rounded-lg shadow-lg p-3">
                    <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDaySelect}
                        locale={it}
                        className="rdp-custom"
                    />
                    <div className="border-t border-zinc-800 pt-2 mt-2">
                        <button
                            type="button"
                            onClick={handleTodayClick}
                            className="w-full px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        >
                            Oggi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
