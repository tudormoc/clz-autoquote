'use server'

/** Login, logout and a user's own PIN. The superadmin comes from .env.local (SUPERADMIN_NAME / SUPERADMIN_PIN). */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { APP_CONFIG } from '@/config/constants';
import { LOGIN_PATH } from '@/config/navigation';
import { getAccess } from '@/lib/auth/access';
import { findAccountByName, updateAccountPin } from '@/lib/auth/accounts';
import { clearFailures, minutesLocked, recordFailure } from '@/lib/auth/lockout';
import { decryptPin, encryptPin, pinFingerprint, sameText } from '@/lib/auth/secrets';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SUPERADMIN, newSessionToken, superadminAccount, superadminFingerprint } from '@/lib/auth/session';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

type Result = { success: true } | { success: false; error: string };

const copy = APP_COPY.auth;
const { MIN_PIN_LENGTH, MAX_PIN_LENGTH } = APP_CONFIG.AUTH;

/** A link inside the app to go back to after the login (never another site) */
const safeNext = (next: unknown) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/');

/** Checks name and PIN; on success sets the login cookie and opens `next` (the page that asked for the login) */
export async function loginAction(name: string, pin: string, next?: string): Promise<Result> {
    const cleanName = String(name ?? '').trim();
    const cleanPin = String(pin ?? '').trim();
    const admin = superadminAccount();
    if (!process.env.AUTH_SECRET || !admin) return { success: false, error: copy.notConfigured };

    const wait = minutesLocked(cleanName);
    if (wait > 0) return { success: false, error: fmt(copy.locked, { minutes: wait }) };

    let token: string | null = null;
    try {
        if (cleanName.toLowerCase() === admin.name.toLowerCase()) {
            const fingerprint = superadminFingerprint();
            if (fingerprint && sameText(cleanPin, admin.pin)) token = newSessionToken(SUPERADMIN, fingerprint);
        } else if (cleanName) {
            const account = await findAccountByName(cleanName);
            if (account && sameText(cleanPin, decryptPin(account.pin))) token = newSessionToken(account.id, pinFingerprint(account.pin));
        }
    } catch (error) {
        console.error('Login failed:', error);
        return { success: false, error: errorMessage(error) };
    }

    if (!token) {
        recordFailure(cleanName);
        const locked = minutesLocked(cleanName);
        return { success: false, error: locked > 0 ? fmt(copy.locked, { minutes: locked }) : copy.wrong };
    }

    clearFailures(cleanName);
    (await cookies()).set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    redirect(safeNext(next));
}

export async function logoutAction(): Promise<void> {
    (await cookies()).delete(SESSION_COOKIE);
    redirect(LOGIN_PATH);
}

/** A user chooses a new PIN; the login stays valid (it is renewed with the new PIN) */
export async function changeOwnPinAction(newPin: string): Promise<Result> {
    const access = await getAccess();
    if (!access || access.id === null) return { success: false, error: copy.notAllowed };

    const pin = String(newPin ?? '').trim();
    if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
        return { success: false, error: fmt(copy.pinLength, { min: MIN_PIN_LENGTH, max: MAX_PIN_LENGTH }) };
    }
    try {
        const stored = encryptPin(pin);
        await updateAccountPin(access.id, stored);
        (await cookies()).set(SESSION_COOKIE, newSessionToken(access.id, pinFingerprint(stored)), SESSION_COOKIE_OPTIONS);
        return { success: true };
    } catch (error) {
        console.error('PIN change failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}
