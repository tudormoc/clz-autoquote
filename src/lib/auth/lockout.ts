/**
 * Wrong PINs: after APP_CONFIG.AUTH.MAX_PIN_ATTEMPTS in a row a name has to wait, so a short PIN cannot be found by
 * trying them all. Counted twice:
 *  - per name AND computer (the address the request comes from), so the wrong tries of one computer do not lock the
 *    same name on another: nobody can keep a colleague out from their own desk;
 *  - per name on all computers together, with a higher limit (NAME_MAX_PIN_ATTEMPTS). The address is what the caller
 *    says it is (Next keeps an `x-forwarded-for` the caller sends itself), so somebody who knows how can pose as a new
 *    computer at every try: this second count is what stops them.
 * The wait grows every time a limit is reached again (LOCKOUT_STEPS_MINUTES) and starts over after
 * LOCKOUT_FORGET_HOURS without a wrong PIN, or when the superadmin takes it away in Utenti (the lock on the user's
 * row). The right PIN clears the count of that computer; of the name-wide count it clears the tries, not the step.
 * Kept in the server's memory: a restart clears it. Rules only, no database: examples in permissions:examples.
 */

import { networkInterfaces } from 'node:os';
import { APP_CONFIG } from '@/config/constants';

export interface LockoutRules {
    /** Wrong PINs in a row before a wait, for a name on one computer */
    attempts: number;
    /** … and for a name on all computers together */
    nameAttempts: number;
    /** The wait in minutes at each step; the last one repeats */
    stepsMinutes: readonly number[];
    /** Hours without a wrong PIN after which a count is forgotten */
    forgetHours: number;
    /** Most counts kept */
    maxEntries: number;
    /** Longest name told apart (a longer one counts as its first characters) */
    nameLength: number;
}

const { MAX_PIN_ATTEMPTS, NAME_MAX_PIN_ATTEMPTS, LOCKOUT_STEPS_MINUTES, LOCKOUT_FORGET_HOURS, LOCKOUT_MAX_ENTRIES, MAX_NAME_LENGTH } = APP_CONFIG.AUTH;

const RULES: LockoutRules = {
    attempts: MAX_PIN_ATTEMPTS,
    nameAttempts: NAME_MAX_PIN_ATTEMPTS,
    stepsMinutes: LOCKOUT_STEPS_MINUTES,
    forgetHours: LOCKOUT_FORGET_HOURS,
    maxEntries: LOCKOUT_MAX_ENTRIES,
    nameLength: MAX_NAME_LENGTH,
};

const MINUTE = 60_000;
/** Between a name and a computer in a key: a character neither can hold */
const SEPARATOR = '\u0000';
/** In place of the computer, in the count of a name on all computers */
const EVERYWHERE = '*';

interface Count {
    /** Wrong PINs since the last wait (or the last right PIN) */
    failures: number;
    /** How many waits this count has been given: the next one takes this step */
    step: number;
    /** When the wait ends (0 = none yet) */
    until: number;
    /** The last wrong PIN */
    last: number;
}

/** What a computer calls itself when the browser runs on the same machine as the app */
const LOOPBACK = new Set(['::1', '127.0.0.1', 'localhost']);
/** The address ranges of a company network, the usual one first */
const NETWORK_RANGES = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];

/** This machine's own address on the company network (null when it has none) */
function ownAddress(): string | null {
    const addresses = Object.values(networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((item) => item.family === 'IPv4' && !item.internal)
        .map((item) => item.address);
    for (const range of NETWORK_RANGES) {
        const found = addresses.find((address) => range.test(address));
        if (found) return found;
    }
    return addresses[0] ?? null;
}

/**
 * The computer a request comes from, out of its `x-forwarded-for`: the address Next read from the connection, or
 * whatever the caller put there itself. Only ever a key to count by and a text for the Registro, never proof of who
 * is calling. Written the way a person reads it: "192.168.1.57" also when the system sends "::ffff:192.168.1.57", and
 * for a browser on the app's own machine ("::1") that machine's address on the network (`own`), as its colleagues see it.
 */
export function computerOf(forwardedFor: string | null | undefined, own: string | null = ownAddress()): string {
    const first = (forwardedFor ?? '').split(',')[0].trim().slice(0, 64);
    if (!first) return 'unknown';
    const address = first.replace(/^::ffff:/i, '');
    return LOOPBACK.has(address.toLowerCase()) ? (own ?? 'localhost') : address;
}

/** The counts of wrong PINs and the waits they give. `now` is passed in by the examples; the app uses the clock. */
export function createLockout(rules: LockoutRules = RULES) {
    const counts = new Map<string, Count>();
    const nameOf = (name: string) => name.trim().toLowerCase().slice(0, rules.nameLength);
    const keyOf = (name: string, computer: string) => `${nameOf(name)}${SEPARATOR}${computer}`;
    const forgotten = (count: Count, now: number) => now >= count.until && now - count.last > rules.forgetHours * 60 * MINUTE;

    /** The count under a key, without the ones that are over */
    const read = (key: string, now: number): Count | undefined => {
        const count = counts.get(key);
        if (count && forgotten(count, now)) counts.delete(key);
        return counts.get(key);
    };
    const minutesLeft = (count: Count | undefined, now: number) => (count && count.until > now ? Math.ceil((count.until - now) / MINUTE) : 0);

    /** Room for one more count: the forgotten ones go first, then the ones longest without a wrong PIN */
    const makeRoom = (now: number) => {
        if (counts.size < rules.maxEntries) return;
        for (const [key, count] of counts) if (forgotten(count, now)) counts.delete(key);
        const oldestFirst = [...counts].sort(([, a], [, b]) => a.last - b.last);
        for (const [key] of oldestFirst.slice(0, Math.max(0, counts.size - rules.maxEntries + 1))) counts.delete(key);
    };

    const fail = (key: string, limit: number, now: number) => {
        let count = read(key, now);
        if (!count) {
            makeRoom(now);
            count = { failures: 0, step: 0, until: 0, last: now };
            counts.set(key, count);
        }
        count.failures += 1;
        count.last = now;
        if (count.failures >= limit) {
            count.failures = 0;
            count.until = now + rules.stepsMinutes[Math.min(count.step, rules.stepsMinutes.length - 1)] * MINUTE;
            count.step += 1;
        }
    };

    return {
        /** Minutes this name still has to wait on this computer (0 = may try) */
        minutesLocked(name: string, computer: string, now = Date.now()): number {
            return Math.max(minutesLeft(read(keyOf(name, computer), now), now), minutesLeft(read(keyOf(name, EVERYWHERE), now), now));
        },

        /** A wrong PIN for this name from this computer */
        recordFailure(name: string, computer: string, now = Date.now()): void {
            fail(keyOf(name, computer), rules.attempts, now);
            fail(keyOf(name, EVERYWHERE), rules.nameAttempts, now);
        },

        /** The right PIN: this computer's count is gone; the name-wide one keeps its step, so tries by others still add up */
        clearFailures(name: string, computer: string): void {
            counts.delete(keyOf(name, computer));
            const everywhere = counts.get(keyOf(name, EVERYWHERE));
            if (everywhere) everywhere.failures = 0;
        },

        /** The longest wait this name has on any computer, in minutes (0 = none): the lock on the user's row in Utenti */
        waitOfName(name: string, now = Date.now()): number {
            const prefix = `${nameOf(name)}${SEPARATOR}`;
            let longest = 0;
            for (const [key, count] of counts) if (key.startsWith(prefix)) longest = Math.max(longest, minutesLeft(count, now));
            return longest;
        },

        /** The superadmin takes every wait and count of this name away; true when there was one */
        unlockName(name: string): boolean {
            const prefix = `${nameOf(name)}${SEPARATOR}`;
            let found = false;
            for (const key of [...counts.keys()]) if (key.startsWith(prefix)) found = counts.delete(key) || found;
            return found;
        },

        /** How many counts are kept (for the examples) */
        size: () => counts.size,
    };
}

/**
 * The app's own counts: one set for the whole server, whichever part asks (the login counts, Utenti shows and clears),
 * so it hangs on the process and not on the copy of this file a bundle may make.
 */
const server = globalThis as typeof globalThis & { clzLockout?: ReturnType<typeof createLockout> };
export const lockout = (server.clzLockout ??= createLockout());
