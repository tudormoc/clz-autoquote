/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');
const theme = require('./src/styles/theme');

// All colours, radius, fonts and shadows come from src/styles/theme.js — edit them there.
// Tailwind's own palette (zinc-400, emerald-500, white …) is switched off on purpose:
// only theme tokens exist, so a colour cannot be hard-coded in a component.

// Base defaults are written into CSS as-is, so the opacity placeholder must be filled in here
const withOpacity = (color, opacity = 1) => color.replace('<alpha-value>', String(opacity));

module.exports = {
    content: [
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        colors: {
            transparent: 'transparent',
            current: 'currentColor',
            inherit: 'inherit',
            ...theme.tailwindColors,
        },
        // Colours used when a class names none (a plain `border`, `divide-y`, `ring-2`, `ring-offset-2`)
        borderColor: ({ theme: t }) => ({ ...t('colors'), DEFAULT: t('colors.border.DEFAULT') }),
        ringColor: ({ theme: t }) => ({
            ...t('colors'),
            DEFAULT: ({ opacityValue }) => withOpacity(t('colors.primary.DEFAULT'), opacityValue),
        }),
        ringOffsetColor: ({ theme: t }) => ({ ...t('colors'), DEFAULT: withOpacity(t('colors.background')) }),
        // The only layers there are: z-raised … z-notice. Tailwind's own numbers (z-10, z-50) are switched off
        zIndex: theme.LAYERS,
        extend: {
            // Every size of corner and the pace of every transition are the skin's (theme.js → SKIN), read as variables
            borderRadius: {
                DEFAULT: 'var(--radius-xs)',
                sm: 'calc(var(--radius) - 4px)',
                md: 'calc(var(--radius) - 2px)',
                lg: 'var(--radius)',
                xl: 'var(--radius-xl)',
                '2xl': 'var(--radius-2xl)',
                '3xl': 'var(--radius-3xl)',
                full: 'var(--radius-pill)',
            },
            transitionDuration: { DEFAULT: 'var(--motion-duration)', slide: 'var(--motion-slide)', unfold: 'var(--motion-unfold)' },
            transitionTimingFunction: { DEFAULT: 'var(--motion-ease)', out: 'var(--motion-ease-out)' },
            // animate-enter: how what opens over the page comes in (none until a skin names an animation)
            animation: { enter: 'var(--motion-enter)' },
            fontFamily: theme.FONT_FAMILY,
            fontSize: theme.FONT_SIZE,
            width: theme.LAYOUT.width,
            minWidth: theme.LAYOUT.minWidth,
            maxHeight: theme.LAYOUT.maxHeight,
            maxWidth: theme.LAYOUT.maxWidth,
            height: theme.LAYOUT.height,
            gridTemplateRows: theme.LAYOUT.gridTemplateRows,
            // transition-width, transition-visibility, transition-rows: what changes size, shows up, or unfolds, over time
            transitionProperty: { width: 'width', visibility: 'visibility', rows: 'grid-template-rows' },
            boxShadow: {
                sm: 'var(--shadow-sm)',
                DEFAULT: 'var(--shadow)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
                divider: 'var(--shadow-divider)',
                'divider-top': 'var(--shadow-divider-top)',
            },
        },
    },
    plugins: [
        // Publishes every token as a CSS variable (e.g. --fg-muted, --success-400): the light look on :root, the dark
        // one under <html data-theme="dark"> (set by the root layout from the cookie, switched in the sidebar).
        // color-scheme makes the browser's own parts (scrollbars, date pickers, checkboxes) follow the look.
        plugin(({ addBase }) =>
            addBase({
                ':root': { ...theme.cssVariables, colorScheme: 'light' },
                ':root[data-theme="dark"]': { ...theme.darkCssVariables, colorScheme: 'dark' },
                // Who asked their computer for less motion: the skin's motion gives way to the calm one
                '@media (prefers-reduced-motion: reduce)': { ':root': theme.calmMotionVariables },
            })
        ),
        // `collapsed:` — applies while the desktop sidebar is folded to icons (from lg up). The state is the
        // data-sidebar attribute on <html>, set by src/lib/sidebar.ts before the first paint, so there is no flash.
        plugin(({ addVariant, theme: t }) => {
            addVariant('collapsed', `@media (min-width: ${t('screens.lg')}) { :root[data-sidebar="collapsed"] & }`);
        }),
    ],
}
