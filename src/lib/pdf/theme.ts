/**
 * Look of the PDF reports. They are printed on white paper, so they have their own light colours instead of the app's
 * theme (src/styles/theme.js); every colour and font of the PDFs is here.
 */

export const PDF_COLORS = {
    text: '#1f2937',
    textSoft: '#4b5563',
    muted: '#6b7280',
    slate: '#475569',
    slateMuted: '#64748b',
    faint: '#94a3b8',
    subtle: '#9ca3af',
    brand: '#1e40af',
    accent: '#3b82f6',
    accentSoft: '#eff6ff',
    surface: '#f9fafb',
    surfaceCool: '#f8fafc',
    headerCell: '#f1f5f9',
    border: '#e5e7eb',
    borderCool: '#e2e8f0',
    rowLine: '#f3f4f6',
    good: '#10b981',
    fair: '#f59e0b',
    bad: '#ef4444',
    white: '#ffffff',
} as const;

export const PDF_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
export const PDF_MONO = "'Courier New', monospace";

/** Green from `good` up, amber from `fair` up, red below */
export function toneColor(value: number, good: number, fair: number): string {
    if (value >= good) return PDF_COLORS.good;
    if (value >= fair) return PDF_COLORS.fair;
    return PDF_COLORS.bad;
}

/** Same colour at about 12% strength, for a tinted badge background ("#10b981" → "#10b98120") */
export const tint = (color: string) => `${color}20`;
