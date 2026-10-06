/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');
const theme = require('./src/styles/theme');

// All colours, radius, fonts and shadows come from src/styles/theme.js — edit them there.
module.exports = {
    content: [
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: theme.tailwindColors,
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
