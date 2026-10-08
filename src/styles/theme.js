/**
 * DESIGN TOKENS — the single source of truth for every colour, radius, font and shadow.
 *
 * How it works
 *   1. PALETTE picks a colour family for each role.
 *   2. NEUTRAL maps the grey roles (surfaces, lines, text) to exact shades.
 *   3. tailwind.config.js turns every token into a CSS variable on :root and a Tailwind class:
 *        bg-card, bg-muted, border-border-strong, text-fg-muted, text-success-400, bg-danger/10 …
 *
 * Restyling the app = editing this file. Components never use raw palette classes
 * (text-zinc-400, bg-emerald-500 …): ESLint flags them.
 *
 * Status roles (success, warning, danger, info, highlight, primary) expose the full 50–950 scale
 * plus DEFAULT (= 500), so `text-danger-400`, `bg-success/10`, `border-warning/30` all work.
 */
const colors = require('tailwindcss/colors');

// ─── 1. Palette: which colour family paints each role ──────────────────────────
const PALETTE = {
    neutral: colors.zinc,
    primary: colors.cyan,      // brand / interactive accent
    success: colors.emerald,   // ok, completed, positive amounts
    warning: colors.amber,     // attention, pending, manual edits
    danger: colors.red,        // errors, delete, negative amounts
    info: colors.blue,         // informational, selection, bank rows
    highlight: colors.purple,  // secondary category accent (e.g. linked operations)
};

const STATUS_ROLES = ['primary', 'success', 'warning', 'danger', 'info', 'highlight'];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// ─── 2. Neutral roles ──────────────────────────────────────────────────────────
const n = PALETTE.neutral;
const NEUTRAL = {
    // Surfaces, darkest → lightest
    'background': n[950],       // page background, inputs
    'card': n[900],             // panels, cards, sidebars, header
    'muted': n[800],            // secondary buttons, chips, row hover
    'muted-strong': n[700],     // hover on muted controls

    // Lines
    'border': n[800],           // default borders and dividers
    'border-strong': n[700],    // input borders, emphasised outlines

    // Text, strongest → faintest
    'fg-strong': colors.white,  // page titles, key figures
    'fg': n[100],               // default text
    'fg-soft': n[200],          // emphasised values
    'fg-secondary': n[300],     // secondary text
    'fg-muted': n[400],         // labels, icons
    'fg-subtle': n[500],        // hints, placeholders
    'fg-faint': n[600],         // disabled, decorative
    'fg-inverse': n[950],       // text on bright fills (primary / warning buttons)

    'overlay': colors.black,    // modal backdrops, always with opacity: bg-overlay/60
};

// ─── 3. Shape, type & layout ───────────────────────────────────────────────────
const RADIUS = '0.5rem';

// The fonts themselves (Inter, JetBrains Mono) are loaded in src/app/layout.tsx and exposed as these variables
const FONT_FAMILY = {
    sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
    mono: ['var(--font-mono)', 'Consolas', 'Monaco', 'monospace'],
};

// Sizes below Tailwind's text-xs (12px), for dense tables and badges: text-2xs, text-3xs, text-4xs
const FONT_SIZE = {
    '2xs': '0.6875rem', // 11px
    '3xs': '0.625rem',  // 10px
    '4xs': '0.5625rem', // 9px
};

// Page frame dimensions (AppShell, sidebar): w-sidebar, w-sidebar-collapsed. Pages use the full width beside it.
const LAYOUT = {
    width: {
        sidebar: '16rem',             // open sidebar, and the phone menu
        'sidebar-collapsed': '4rem',  // sidebar folded to icons
    },
    minWidth: {
        matrix: '64rem',              // a month-by-month table (12 months + label + total) below this scrolls sideways
    },
};

const SHADOWS = {
    'shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    'shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    'shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    'shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    // Not shadows: the line under a table header / over a totals row, drawn on the cells so it stays when they stick
    'shadow-divider': 'inset 0 -1px 0 0 rgb(var(--border))',
    'shadow-divider-top': 'inset 0 1px 0 0 rgb(var(--border-strong))',
};

// ─── Build: CSS variables + Tailwind colour map (no edits needed below) ────────

/** '#a1a1aa' → '161 161 170' (channels, so Tailwind opacity modifiers like /50 work) */
function toChannels(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

const color = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const cssVariables = { '--radius': RADIUS };
Object.entries(SHADOWS).forEach(([name, value]) => { cssVariables[`--${name}`] = value; });
Object.entries(NEUTRAL).forEach(([name, hex]) => { cssVariables[`--${name}`] = toChannels(hex); });
STATUS_ROLES.forEach((role) => {
    SHADES.forEach((shade) => { cssVariables[`--${role}-${shade}`] = toChannels(PALETTE[role][shade]); });
});

const tailwindColors = {
    background: color('background'),
    card: color('card'),
    muted: { DEFAULT: color('muted'), strong: color('muted-strong') },
    border: { DEFAULT: color('border'), strong: color('border-strong') },
    fg: {
        DEFAULT: color('fg'),
        strong: color('fg-strong'),
        soft: color('fg-soft'),
        secondary: color('fg-secondary'),
        muted: color('fg-muted'),
        subtle: color('fg-subtle'),
        faint: color('fg-faint'),
        inverse: color('fg-inverse'),
    },
    overlay: color('overlay'),
};
STATUS_ROLES.forEach((role) => {
    const scale = { DEFAULT: color(`${role}-500`) };
    SHADES.forEach((shade) => { scale[shade] = color(`${role}-${shade}`); });
    tailwindColors[role] = scale;
});
// Text placed on a solid primary fill
tailwindColors.primary.foreground = color('fg-inverse');

module.exports = {
    PALETTE,
    NEUTRAL,
    RADIUS,
    FONT_FAMILY,
    FONT_SIZE,
    LAYOUT,
    SHADOWS,
    cssVariables,
    tailwindColors,
};
