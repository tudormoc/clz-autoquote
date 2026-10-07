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
        extend: {
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: theme.FONT_FAMILY,
            fontSize: theme.FONT_SIZE,
            maxWidth: theme.LAYOUT.maxWidth,
            width: theme.LAYOUT.width,
            height: theme.LAYOUT.height,
            boxShadow: {
                sm: 'var(--shadow-sm)',
                DEFAULT: 'var(--shadow)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
            },
        },
    },
    plugins: [
        // Publishes every token as a CSS variable on :root (e.g. --fg-muted, --success-400)
        plugin(({ addBase }) => addBase({ ':root': theme.cssVariables })),
    ],
}
