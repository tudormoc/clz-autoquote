'use server'

/**
 * Login, logout and a user's own PIN. The superadmin comes from .env.local (SUPERADMIN_NAME / SUPERADMIN_PIN).
 * Every login, refused login, logout and PIN change is written in the log (Registro); the PIN itself never is.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LOGIN_PATH } from '@/config/navigation';
import { getAccess } from '@/lib/auth/access';
import { findAccountByName, recordLogin, updateAccountPin } from '@/lib/auth/accounts';
import { clearFailures, minutesLocked, recordFailure } from '@/lib/auth/lockout';
import { decryptPin, encryptPin, pinFingerprint, sameText, checkPin } from '@/lib/auth/secrets';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SUPERADMIN, newSessionToken, superadminAccount, superadminFingerprint } from '@/lib/auth/session';
import { LOG_AREAS, anonymous, logEvent, personOf, type LogPerson } from '@/lib/log/log';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

type Result = { success: true } | { success: false; error: string };

const copy = APP_COPY.auth;
const log = APP_COPY.log.entries;

/** A link inside the app to go back to after the login (never another site) */
const safeNext = (next: unknown) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/');

/** A login that was not let in, in the log: who tried (the name typed) and why */
const logRefusedLogin = (person: LogPerson, action: string, summary: string) =>
    logEvent(person, { page: LOG_AREAS.login, action, summary, outcome: 'refused' });

/**
 * Checks name and PIN; on success notes the time, sets the login cookie and opens `next` (the page that asked for
 * the login). A suspended user is told so only after the right PIN.
 */
export async function loginAction(name: string, pin: string, next?: string): Promise<Result> {
    const cleanName = String(name ?? '').trim();
    const cleanPin = String(pin ?? '').trim();
    const admin = superadminAccount();
    if (!process.env.AUTH_SECRET || !admin) return { success: false, error: copy.notConfigured };

    const wait = minutesLocked(cleanName);
    if (wait > 0) {
        await logRefusedLogin(anonymous(cleanName), 'login-locked', log.loginLocked);
        return { success: false, error: fmt(copy.locked, { minutes: wait }) };
    }

    let token: string | null = null;
    let person: LogPerson | null = null;
    try {
        if (cleanName.toLowerCase() === admin.name.toLowerCase()) {
            const fingerprint = superadminFingerprint();
            if (fingerprint && sameText(cleanPin, admin.pin)) {
                token = newSessionToken(SUPERADMIN, fingerprint);
                person = { id: SUPERADMIN, name: admin.name };
            }
        } else if (cleanName) {
            const account = await findAccountByName(cleanName);
            if (account && sameText(cleanPin, decryptPin(account.pin))) {
                person = { id: String(account.id), name: account.name };
                if (account.suspended) {
                    await logRefusedLogin(person, 'login-suspended', log.loginSuspended);
                    return { success: false, error: copy.suspended };
                }
                token = newSessionToken(account.id, pinFingerprint(account.pin));
                await recordLogin(account.id).catch((error) => console.error('Last login not saved:', error));
            }
        }
    } catch (error) {
        console.error('Login failed:', error);
        return { success: false, error: errorMessage(error) };
    }

    if (!token || !person) {
        recordFailure(cleanName);
        const locked = minutesLocked(cleanName);
        await logRefusedLogin(anonymous(cleanName), 'login-failed', locked > 0 ? log.loginLocked : log.loginFailed);
        return { success: false, error: locked > 0 ? fmt(copy.locked, { minutes: locked }) : copy.wrong };
    }

    clearFailures(cleanName);
    (await cookies()).set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    await logEvent(person, { page: LOG_AREAS.login, action: 'login', summary: log.login });
    redirect(safeNext(next));
}

export async function logoutAction(): Promise<void> {
    const access = await getAccess();
    if (access) await logEvent(personOf(access), { page: LOG_AREAS.login, action: 'logout', summary: log.logout });
    (await cookies()).delete(SESSION_COOKIE);
    redirect(LOGIN_PATH);
}

/** A user chooses a new PIN (their own: no longer "provvisorio"); the login stays valid, renewed with the new PIN */
export async function changeOwnPinAction(newPin: string): Promise<Result> {
    const access = await getAccess();
    if (!access || access.id === null) return { success: false, error: copy.notAllowed };

    const checked = checkPin(newPin);
    if ('error' in checked) return { success: false, error: checked.error };
    try {
        const stored = encryptPin(checked.pin);
        await updateAccountPin(access.id, stored, false);
        (await cookies()).set(SESSION_COOKIE, newSessionToken(access.id, pinFingerprint(stored)), SESSION_COOKIE_OPTIONS);
        await logEvent(personOf(access), { page: LOG_AREAS.login, action: 'pin-changed', entityKind: 'user', entityId: access.id, summary: log.pinChanged });
        return { success: true };
    } catch (error) {
        console.error('PIN change failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}
