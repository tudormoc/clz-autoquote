/**
 * Light or dark look. The palettes are in src/styles/theme.js: light is the default on :root, dark applies under
 * <html data-theme="dark">. The choice is a cookie, so the server already renders the right theme (no flash),
 * read by src/app/layout.tsx and changed by the switch in the sidebar (ThemeProvider).
 */

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'light';

/** Cookie with the chosen theme; readable by scripts on purpose (the switch writes it) */
export const THEME_COOKIE = 'clz_theme';
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 3600;

/** The theme a stored value names; anything else is the default */
export const parseTheme = (value: string | undefined | null): Theme => (value === 'dark' ? 'dark' : DEFAULT_THEME);

/** Switches the page now and remembers the choice for this browser */
export function applyTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
