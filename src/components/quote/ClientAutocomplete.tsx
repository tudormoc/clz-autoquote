'use client';

import { Spinner } from '@/components/ui/Spinner';
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { searchMSSQLClientsAction } from '@/app/client-search-actions';
import { Search } from '@/components/ui/icons';
import { Surface } from '@/components/ui/Surface';
import { MenuRow } from '@/components/ui/MenuRow';

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
                            <Spinner size={16} className="text-primary" />
                        ) : (
                            <Search size={16} />
                        )}
                    </div>
                </div>

                {isOpen && suggestions.length > 0 && (
                    <Surface kind="floating" className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                            <MenuRow key={index} onClick={() => handleSelect(suggestion.id, suggestion.name)}>
                                <span className="truncate">
                                    {suggestion.name}
                                </span>
                            </MenuRow>
                        ))}
                    </Surface>
                )}
            </div>
        );
    }
);

ClientAutocomplete.displayName = 'ClientAutocomplete';
