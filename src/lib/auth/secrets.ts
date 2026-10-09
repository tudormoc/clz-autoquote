/**
 * The login's cryptography, all from AUTH_SECRET in .env.local (the same on every machine using these databases):
 * - PINs are stored scrambled (AES-256-GCM) and read back only for the superadmin's Utenti page and the login check;
 * - the login cookie is signed (HMAC-SHA256), so it cannot be made up or changed in the browser;
 * - the scheduler proves itself to /api/auto-exit with a key derived from the same secret.
 * Server only. Without AUTH_SECRET nothing works: nobody can log in (fail closed).
 */

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY, fmt } from '@/locales';

const PIN_FORMAT = 'v1';

function secret(): string {
    const value = process.env.AUTH_SECRET;
    if (!value || value.length < 32) throw new Error('AUTH_SECRET missing or too short in .env.local');
    return value;
}

/** A 32-byte key for one purpose, derived from AUTH_SECRET */
const keyFor = (purpose: string) => Buffer.from(hkdfSync('sha256', secret(), '', `clz-${purpose}`, 32));

/** A new PIN as typed, trimmed, or the error text when its length is not allowed (APP_CONFIG.AUTH) */
export function checkPin(value: unknown): { pin: string } | { error: string } {
    const pin = String(value ?? '').trim();
    const { MIN_PIN_LENGTH: min, MAX_PIN_LENGTH: max } = APP_CONFIG.AUTH;
    return pin.length >= min && pin.length <= max ? { pin } : { error: fmt(APP_COPY.auth.pinLength, { min, max }) };
}

export function encryptPin(pin: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyFor('pin'), iv);
    const data = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
    return `${PIN_FORMAT}:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

export function decryptPin(stored: string): string {
    const [format, payload] = stored.split(':');
    if (format !== PIN_FORMAT || !payload) throw new Error('Unknown PIN format');
    const raw = Buffer.from(payload, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', keyFor('pin'), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Equal texts, compared in constant time */
export function sameText(a: string, b: string): boolean {
    const x = Buffer.from(a, 'utf8');
    const y = Buffer.from(b, 'utf8');
    return x.length === y.length && timingSafeEqual(x, y);
}

const sign = (data: string, purpose: string) => createHmac('sha256', keyFor(purpose)).update(data).digest('base64url');

/** "payload.signature" for a JSON value */
export function signValue(value: unknown): string {
    const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
    return `${payload}.${sign(payload, 'session')}`;
}

/** The JSON value of a "payload.signature" text, or null when it was not signed by this app */
export function readSignedValue(token: string | undefined): unknown {
    if (!token) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    try {
        if (!sameText(signature, sign(payload, 'session'))) return null;
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

/** Short fingerprint of a stored PIN: a login made before the PIN changed stops working */
export const pinFingerprint = (storedPin: string) => sign(storedPin, 'pin-version').slice(0, 16);

/** Key the scheduler sends to /api/auto-exit (scripts/scheduler.js derives the same value) */
export const schedulerKey = () => sign('auto-exit', 'scheduler');
