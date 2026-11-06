import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/** Readable text of anything thrown (for `catch (err)` blocks and error messages shown to the user) */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Text for comparing and searching: lower case, accents dropped ("Attività" → "attivita") */
export const foldText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** `work` on every item, at most `atOnce` running together; the results keep the items' order */
export async function mapAtOnce<T, R>(items: readonly T[], atOnce: number, work: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await work(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, worker));
    return results;
}

/** Copy of `set` with `key` switched on or off */
export function toggleInSet<K>(set: ReadonlySet<K>, key: K): Set<K> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
}
