/**
 * The login cookie: a signed token naming who is logged in, ended when the browser closes (no expiry date on the
 * cookie) and at the latest after APP_CONFIG.AUTH.SESSION_HOURS (date inside the token).
 * The token also carries a fingerprint of the PIN: a new PIN logs out the sessions made with the old one.
 * Read by src/proxy.ts (is anyone logged in?) and by the access checks (src/lib/auth/access.ts).
 */

import { APP_CONFIG } from '@/config/constants';
import { pinFingerprint, readSignedValue, signValue } from '@/lib/auth/secrets';

export const SESSION_COOKIE = 'clz_session';

/** Subject of the superadmin's session (users are their app_users.id) */
export const SUPERADMIN = 'superadmin';

export interface Session {
    sub: number | typeof SUPERADMIN;
    /** pinFingerprint of the PIN used to log in */
    pv: string;
    /** End of the session, ms since 1970 */
    exp: number;
}

/** httpOnly: scripts cannot read it; no maxAge: it ends with the browser. The app runs on plain http in the LAN. */
export const SESSION_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', path: '/', secure: false } as const;

export function newSessionToken(sub: Session['sub'], pv: string): string {
    const session: Session = { sub, pv, exp: Date.now() + APP_CONFIG.AUTH.SESSION_HOURS * 3_600_000 };
    return signValue(session);
}

/** The session of a cookie value, or null when missing, not ours or expired */
export function parseSession(token: string | undefined): Session | null {
    const value = readSignedValue(token) as Partial<Session> | null;
    if (!value || typeof value.exp !== 'number' || value.exp < Date.now() || typeof value.pv !== 'string') return null;
    if (value.sub !== SUPERADMIN && !(typeof value.sub === 'number' && Number.isInteger(value.sub))) return null;
    return value as Session;
}

/** The superadmin from .env.local, or null when not configured */
export function superadminAccount(): { name: string; pin: string } | null {
    const name = process.env.SUPERADMIN_NAME?.trim();
    const pin = process.env.SUPERADMIN_PIN;
    return name && pin && pin.length >= APP_CONFIG.AUTH.MIN_PIN_LENGTH ? { name, pin } : null;
}

/** Fingerprint of the superadmin's PIN (changing SUPERADMIN_PIN logs the superadmin out everywhere) */
export const superadminFingerprint = () => {
    const account = superadminAccount();
    return account ? pinFingerprint(`superadmin:${account.pin}`) : null;
};
