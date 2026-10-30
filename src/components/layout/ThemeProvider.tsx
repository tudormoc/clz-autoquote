'use client';

import { createContext, useContext, useState } from 'react';
import { applyTheme, type Theme } from '@/lib/theme';

interface ThemeState {
    theme: Theme;
    /** Light ↔ dark, kept for this browser */
    toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: 'light', toggle: () => undefined });

/** The current theme (from the cookie, by the root layout) for the browser parts, and the way to switch it */
export function ThemeProvider({ theme: initial, children }: { theme: Theme; children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(initial);
    const toggle = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        setTheme(next);
    };
    return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
