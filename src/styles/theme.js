/**
 * DESIGN TOKENS — the single source of truth for every colour, radius, font and shadow, in two looks.
 *
 * How it works
 *   1. PALETTE picks a colour family for each role.
 *   2. NEUTRAL (light) and NEUTRAL_DARK map the grey roles (surfaces, lines, text) to exact shades of each look.
 *   3. tailwind.config.js turns every token into a CSS variable — the light values on :root, the dark ones under
 *      :root[data-theme="dark"] — and a Tailwind class:
 *        bg-card, bg-muted, border-border-strong, text-fg-muted, text-success-400, bg-danger/10 …
 *      Light is the default; the switch in the sidebar sets the attribute and a cookie (src/lib/theme.ts).
 *
 * Restyling the app = editing this file. Components never use raw palette classes
 * (text-zinc-400, bg-emerald-500 …): ESLint flags them.
 *
 * Status roles (success, warning, danger, info, highlight, primary) expose the full 50–950 scale
 * plus DEFAULT (= 500), so `text-danger-400`, `bg-success/10`, `border-warning/30` all work. A class names the
 * shade of the dark look; the light look mirrors it (LIGHT_SHADE), so `text-success-400` is a light green on dark
 * and a deep green on white, and `bg-success-950/60` a dark tint there and a pale one here.
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

/**
 * Light look: the shade a class names (chosen on dark) → the shade painted on white.
 * Text (200–400) gets deep, tints (700–950) get pale, fills (500–600) stay bright with dark text on them.
 */
const LIGHT_SHADE = {
    50: '950', 100: '900', 200: '800', 300: '700', 400: '700',
    500: '500', 600: '500',
    700: '300', 800: '200', 900: '100', 950: '100',
};
// The brand accent is also text (text-primary, in many places): on white it needs the deeper cyan, with white on it;
// its text shades (text-primary-400: the current page in the menu, today in the date picker) go deeper still
const LIGHT_PRIMARY_SHADE = { ...LIGHT_SHADE, 300: '800', 400: '800', 500: '700', 600: '700' };

// ─── 2. Neutral roles ──────────────────────────────────────────────────────────
const n = PALETTE.neutral;

/** Light look (the default) */
const NEUTRAL = {
    // Surfaces
    'background': n[100],       // page background, inputs
    'card': colors.white,       // panels, cards, sidebars, header
    'muted': n[100],            // secondary buttons, chips, row hover
    'muted-strong': n[200],     // hover on muted controls

    // Lines
    'border': n[200],           // default borders and dividers
    'border-strong': n[300],    // input borders, emphasised outlines

    // Text, strongest → faintest
    'fg-strong': n[950],        // page titles, key figures
    'fg': n[800],               // default text
    'fg-soft': n[700],          // emphasised values
    'fg-secondary': n[600],     // secondary text
    // Two steps between zinc-500 and 600: labels and hints stay readable on the grey page background (5.4:1, 4.9:1)
    'fg-muted': '#62626b',      // labels, icons
    'fg-subtle': '#6b6b74',     // hints, secondary lines of a cell
    // Between zinc-400 and 500: faint, but a past day in the calendar can still be read (3.6:1)
    'fg-faint': '#86868f',      // placeholders, disabled, decorative
    'fg-inverse': n[950],       // text on bright fills (warning / success buttons, ticks)
    'primary-fg': colors.white, // text on the primary fill (deep cyan here)
    'bright': colors.white,     // white in both looks: the knob of a switch

    'overlay': n[950],          // modal backdrops, always with opacity: bg-overlay/60
};

/** Dark look */
const NEUTRAL_DARK = {
    'background': n[950],
    'card': n[900],
    'muted': n[800],
    'muted-strong': n[700],

    'border': n[800],
    'border-strong': n[700],

    'fg-strong': colors.white,
    'fg': n[100],
    'fg-soft': n[200],
    'fg-secondary': n[300],
    'fg-muted': n[400],
    // Between zinc-400 and 500: small hint text stays readable on cards (5.2:1, above the 4.5:1 minimum)
    'fg-subtle': '#8a8a93',
    'fg-faint': n[500],
    'fg-inverse': n[950],
    'primary-fg': n[950],       // dark text on the bright cyan fill
    'bright': colors.white,

    'overlay': colors.black,
};

// ─── 3. Shape, type & layout ───────────────────────────────────────────────────
const RADIUS = '0.5rem';

// The fonts themselves (Inter, JetBrains Mono) are loaded in src/app/layout.tsx and exposed as these variables
const FONT_FAMILY = {
    sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
    mono: ['var(--font-mono)', 'Consolas', 'Monaco', 'monospace'],
};

// Sizes below Tailwind's text-xs (12px), for dense tables and badges: text-2xs, text-3xs (10px is the smallest text)
const FONT_SIZE = {
    '2xs': '0.6875rem', // 11px
    '3xs': '0.625rem',  // 10px
};

// Page frame dimensions (AppShell, sidebar): w-sidebar, w-sidebar-collapsed. Pages use the full width beside it.
const LAYOUT = {
    width: {
        sidebar: '16rem',             // open sidebar, and the phone menu
        'sidebar-collapsed': '4rem',  // sidebar folded to icons
        panel: '28rem',               // side panel sliding in from the right (Agenda calendar: a task's details)
    },
    minWidth: {
        matrix: '64rem',              // a month-by-month table (12 months + label + total) below this scrolls sideways
    },
    maxHeight: {
        // A table that scrolls inside its own box, column names in view (the lights of Gruppi): the screen less the
        // page title, the group's card and the search above the table
        panel: 'calc(100svh - 21rem)',
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

// ─── 4. Skin: what a look is made of besides its colours ───────────────────────
/**
 * A skin is this set of values: change them here and every screen follows, no component is touched (owner, 2026-11-12:
 * a whole new look must be one file). Today there is one skin, the app's own. What it holds, and what comes next
 * (docs/BACKLOG.md → Skins):
 *   radius   every rounded-* class: `rounded` (xs), -sm / -md / -lg (from RADIUS above), -xl / -2xl / -3xl, -full (pill)
 *   motion   how long a change of state takes and on which curve: every transition-* class; `duration-slide` for
 *            what slides across the screen (the menu, a side panel), `ease-out` for what arrives and settles;
 *            `enter` = the animation of whatever opens over the page (a menu, a popup, a window, a notice: every
 *            floating Surface), none today; `press` = how much a thing shrinks while it is pressed (every Pressable),
 *            1 = not at all. Who asks the computer for less motion gets CALM_MOTION instead, whatever the skin
 *   page     an image or gradient behind every page (none: the background colour alone)
 *   next     the borders and textures of surfaces, the icon set, a font for titles
 * Tables and numbers are not a skin's to dress up: they keep the number font (FONT_FAMILY.mono) and plain surfaces,
 * so a long list stays easy to read whatever the look (owner, 2026-11-12).
 */
const SKIN = {
    radius: { xs: '0.25rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', pill: '9999px' },
    motion: {
        duration: '150ms',
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        slide: '200ms',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        enter: 'none',
        press: '1',
    },
    page: { image: 'none' },
};

// The motion of who set "reduce motion" on their computer: changes land at once, nothing animates in or shrinks.
// The spinner still turns (it says "wait"); a pulse stops where it is used (motion-reduce:animate-none).
const CALM_MOTION = { duration: '0.01ms', slide: '0.01ms', enter: 'none', press: '1' };

// ─── Build: CSS variables + Tailwind colour map (no edits needed below) ────────

/** '#a1a1aa' → '161 161 170' (channels, so Tailwind opacity modifiers like /50 work) */
function toChannels(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
}

const color = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** The CSS variables of one look: neutrals, and each status shade painted with `shadeOf(role)[shade]` */
function variablesOf(neutral, shadeOf) {
    const vars = {};
    Object.entries(neutral).forEach(([name, hex]) => { vars[`--${name}`] = toChannels(hex); });
    STATUS_ROLES.forEach((role) => {
        const painted = shadeOf(role);
        SHADES.forEach((shade) => { vars[`--${role}-${shade}`] = toChannels(PALETTE[role][painted[shade]]); });
    });
    return vars;
}

const sameShade = Object.fromEntries(SHADES.map((shade) => [shade, shade]));

/** The skin as CSS variables: --radius-xl, --motion-duration, --page-image … */
const skinVariables = Object.fromEntries(
    Object.entries(SKIN).flatMap(([group, values]) => Object.entries(values).map(([name, value]) => [`--${group}-${name}`, value]))
);

/** CALM_MOTION as CSS variables, for @media (prefers-reduced-motion: reduce) */
const calmMotionVariables = Object.fromEntries(Object.entries(CALM_MOTION).map(([name, value]) => [`--motion-${name}`, value]));

/** Light look, on :root (with what both looks share: radius, shadows, the skin) */
const cssVariables = {
    '--radius': RADIUS,
    ...skinVariables,
    ...Object.fromEntries(Object.entries(SHADOWS).map(([name, value]) => [`--${name}`, value])),
    ...variablesOf(NEUTRAL, (role) => (role === 'primary' ? LIGHT_PRIMARY_SHADE : LIGHT_SHADE)),
};

/** Dark look, under :root[data-theme="dark"] */
const darkCssVariables = variablesOf(NEUTRAL_DARK, () => sameShade);

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
    bright: color('bright'),
    overlay: color('overlay'),
};
STATUS_ROLES.forEach((role) => {
    const scale = { DEFAULT: color(`${role}-500`) };
    SHADES.forEach((shade) => { scale[shade] = color(`${role}-${shade}`); });
    tailwindColors[role] = scale;
});
// Text placed on a solid primary fill
tailwindColors.primary.foreground = color('primary-fg');

module.exports = {
    PALETTE,
    NEUTRAL,
    NEUTRAL_DARK,
    RADIUS,
    FONT_FAMILY,
    FONT_SIZE,
    LAYOUT,
    SHADOWS,
    SKIN,
    cssVariables,
    calmMotionVariables,
    darkCssVariables,
    tailwindColors,
};
