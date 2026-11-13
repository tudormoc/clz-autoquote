/** The edge of a field: its corner, border and background. Alone, it frames a field made of parts (the formatted-text box) */
export const FIELD_FRAME = 'rounded border border-border-strong bg-background';

/**
 * The one look of everything one types or picks in: Input, Select, Textarea, the date field, a quick-add box, an
 * editor opened over a table cell. A field adds its height and width, never a border, corner or background of its own.
 */
export const FIELD = `w-full ${FIELD_FRAME} px-3 py-2 text-sm text-fg placeholder:text-fg-faint transition-colors focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50`;

/** A field whose value was refused */
export const FIELD_ERROR = 'border-danger focus-visible:border-danger';

/** A field opened over a table cell to change its value: low, edged with the accent, lifted off the row */
export const CELL_FIELD = 'h-7 px-2 py-0 text-xs border-primary shadow-lg';
