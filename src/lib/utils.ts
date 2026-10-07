import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/** Readable text of anything thrown (for `catch (err)` blocks and error messages shown to the user) */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Copy of `set` with `key` switched on or off */
export function toggleInSet<K>(set: ReadonlySet<K>, key: K): Set<K> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
}
