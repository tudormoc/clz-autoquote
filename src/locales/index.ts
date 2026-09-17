// Central language configuration - Italian Only

export { APP_COPY } from './it';

/**
 * Fill `{name}` placeholders in a copy string.
 * @example fmt("Attese {h}h", { h: 8 }) → "Attese 8h"
 */
export function fmt(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) =>
        key in values ? String(values[key]) : `{${key}}`
    );
}
