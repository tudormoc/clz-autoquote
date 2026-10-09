/**
 * Wrong PINs: after APP_CONFIG.AUTH.MAX_PIN_ATTEMPTS in a row a name has to wait LOCKOUT_MINUTES, so a short PIN
 * cannot be found by trying them all. Kept in the server's memory (a restart clears it), per name, any case.
 */

import { APP_CONFIG } from '@/config/constants';

const { MAX_PIN_ATTEMPTS, LOCKOUT_MINUTES } = APP_CONFIG.AUTH;
const LOCKOUT_MS = LOCKOUT_MINUTES * 60_000;

const attempts = new Map<string, { failures: number; until: number }>();
const keyOf = (name: string) => name.trim().toLowerCase();

/** Minutes this name still has to wait (0 = may try) */
export function minutesLocked(name: string): number {
    const until = attempts.get(keyOf(name))?.until ?? 0;
    return until > Date.now() ? Math.ceil((until - Date.now()) / 60_000) : 0;
}

export function recordFailure(name: string): void {
    const entry = attempts.get(keyOf(name)) ?? { failures: 0, until: 0 };
    entry.failures += 1;
    if (entry.failures >= MAX_PIN_ATTEMPTS) {
        entry.failures = 0;
        entry.until = Date.now() + LOCKOUT_MS;
    }
    attempts.set(keyOf(name), entry);
}

export function clearFailures(name: string): void {
    attempts.delete(keyOf(name));
}
