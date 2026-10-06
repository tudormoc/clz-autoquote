'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { searchMSSQLClientsAction } from '@/app/client-search-actions';
import { Search, Loader2 } from 'lucide-react';

interface Props {
    value: string | undefined;
    onChange: (value: string) => void;
    onSelectClientId?: (id: string) => void;
    label?: string;
    placeholder?: string;
    error?: string;
}

export const ClientAutocomplete = React.forwardRef<HTMLInputElement, Props>(
    ({ value, onChange, onSelectClientId, label, placeholder, error }, ref) => {
        const [searchTerm, setSearchTerm] = useState(value || '');
        const [suggestions, setSuggestions] = useState<{ id: string, name: string }[]>([]);
        const [isOpen, setIsOpen] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const wrapperRef = useRef<HTMLDivElement>(null);

        // Update internal search term when external value changes (e.g. form reset)
        useEffect(() => {
            setSearchTerm(value || '');
        }, [value]);

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const fetchSuggestions = async (term: string) => {
            if (term.length < 2) {
                setSuggestions([]);
                return;
            }

            setIsLoading(true);
            try {
                const results = await searchMSSQLClientsAction(term);
                setSuggestions(results);
                setIsOpen(results.length > 0);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value;
            setSearchTerm(val);
            onChange(val);

            // Debounce search
            const timeoutId = setTimeout(() => {
                fetchSuggestions(val);
            }, 300);
            return () => clearTimeout(timeoutId);
        };

        const handleSelect = (id: string, name: string) => {
            setSearchTerm(name);
            onChange(name);
            if (onSelectClientId) onSelectClientId(id);
            setIsOpen(false);
        };

        return (
            <div ref={wrapperRef} className="relative w-full">
                <div className="relative">
                    <Input
                        ref={ref}
                        label={label}
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={handleInputChange}
                        error={error}
                        autoComplete="off"
                    />
                    <div className="absolute right-3 top-[30px] text-fg-subtle">
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                            <Search className="h-4 w-4" />
                        )}
                    </div>
                </div>

                {isOpen && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-card border border-border-strong rounded shadow-lg max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0 border-border flex items-center justify-between group"
                                onClick={() => handleSelect(suggestion.id, suggestion.name)}
                            >
                                <span className="font-medium text-fg-soft group-hover:text-primary truncate">
                                    {suggestion.name}
                                </span>
                                <span className="text-3xs text-fg-faint uppercase tracking-widest hidden group-hover:inline">Select</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

ClientAutocomplete.displayName = 'ClientAutocomplete';
