'use server'

/**
 * Users and groups (Impostazioni → Utenti / Gruppi): superadmin only. New users get a random PIN of the kind chosen
 * on the page, which the superadmin reads here and hands over; a PIN given out here shows as "provvisorio" until the
 * person changes it from the sidebar (must_change_pin), which they may or may not do.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { requireSuperadmin } from '@/lib/auth/access';
import {
    deleteAccount,
    deleteGroup,
    insertAccount,
    insertGroup,
    listAccounts,
    listGroups,
    updateAccountGroups,
    updateAccountName,
    updateAccountPin,
    updateAccountSuspended,
    updateGroupName,
    updateGroupPages,
    type Group,
} from '@/lib/auth/accounts';
import { cleanPermissions } from '@/lib/auth/permissions';
import { DEFAULT_PIN_KIND, isPinKind, type PinKindId } from '@/lib/auth/pinKinds';
import { checkPin, decryptPin, encryptPin, randomPin } from '@/lib/auth/secrets';
import { superadminAccount } from '@/lib/auth/session';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

type Saved = { success: true } | { success: false; error: string };
type WithPin = { success: true; pin: string } | { success: false; error: string };
type Created = { success: true; id: number; pin: string } | { success: false; error: string };

/** A user as the superadmin sees them, PIN readable */
export interface UserView {
    id: number;
    name: string;
    pin: string;
    groupIds: number[];
    lastLogin: Date | null;
    suspended: boolean;
    /** Still the PIN the superadmin gave out, never changed by the person ("provvisorio") */
    mustChangePin: boolean;
    /** The same person in NetPro and Business (Scheda persona); null = not linked */
    operatorCode: string | null;
    netproUser: string | null;
    erpUser: string | null;
}

const copy = APP_COPY.admin.users;
const { MAX_NAME_LENGTH } = APP_CONFIG.AUTH;

const IdSchema = z.number().int().positive();
const IdsSchema = z.array(IdSchema);
const FlagSchema = z.boolean();

/** SQL Server: duplicate key on a UNIQUE column */
const isDuplicate = (error: unknown) => {
    const number = (error as { number?: number })?.number;
    return number === 2627 || number === 2601;
};

/** Runs a write after the superadmin check, turning failures into an error text */
async function run<T extends object>(write: () => Promise<T>): Promise<({ success: true } & T) | { success: false; error: string }> {
    try {
        await requireSuperadmin();
        return { success: true, ...(await write()) };
    } catch (error) {
        if (isDuplicate(error)) return { success: false, error: copy.nameTaken };
        console.error('Access write failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}

/** A valid user / group name, or an error text */
function checkName(name: unknown): { name: string } | { error: string } {
    const clean = String(name ?? '').trim();
    if (clean.length === 0 || clean.length > MAX_NAME_LENGTH) return { error: fmt(copy.nameInvalid, { max: MAX_NAME_LENGTH }) };
    if (clean.toLowerCase() === superadminAccount()?.name.toLowerCase()) return { error: copy.nameReserved };
    return { name: clean };
}

/** The kind of random PIN asked for, the default when unknown */
const pinKindOf = (kind: unknown): PinKindId => (isPinKind(kind) ? kind : DEFAULT_PIN_KIND);

export async function getAccountsAction(): Promise<{ users: UserView[]; groups: Group[] }> {
    await requireSuperadmin();
    const [accounts, groups] = await Promise.all([listAccounts(), listGroups()]);
    const users = accounts.map(({ pin, ...account }) => {
        let readable = '';
        try {
            readable = decryptPin(pin);
        } catch {
            // Scrambled with another AUTH_SECRET: give the user a new PIN
        }
        return { ...account, pin: readable };
    });
    return { users, groups };
}

// ── Users ──

/** New user without groups (ticked afterwards) and a random PIN of the kind; answers its id and PIN */
export async function createUserAction(name: string, kind?: string): Promise<Created> {
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    const pin = randomPin(pinKindOf(kind));
    return run(async () => ({ id: await insertAccount(checked.name, encryptPin(pin)), pin }));
}

export async function renameUserAction(id: number, name: string): Promise<Saved> {
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await updateAccountName(id, checked.name);
        return {};
    });
}

export async function setUserGroupsAction(id: number, groupIds: number[]): Promise<Saved> {
    const ids = IdsSchema.safeParse(groupIds);
    if (!IdSchema.safeParse(id).success || !ids.success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await updateAccountGroups(id, ids.data);
        return {};
    });
}

/** A new random PIN of the kind: the old one stops working and the user's open logins end */
export async function newUserPinAction(id: number, kind?: string): Promise<WithPin> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    const pin = randomPin(pinKindOf(kind));
    return run(async () => {
        await updateAccountPin(id, encryptPin(pin), true);
        return { pin };
    });
}

/** A PIN chosen by the superadmin (same length rule as "Cambia PIN"); the user's open logins end */
export async function setUserPinAction(id: number, pin: string): Promise<WithPin> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    const checked = checkPin(pin);
    if ('error' in checked) return { success: false, error: checked.error };
    return run(async () => {
        await updateAccountPin(id, encryptPin(checked.pin), true);
        return { pin: checked.pin };
    });
}

/** Suspended: the user cannot log in and their open logins end; PIN and groups stay for when they are let back in */
export async function setUserSuspendedAction(id: number, suspended: boolean): Promise<Saved> {
    if (!IdSchema.safeParse(id).success || !FlagSchema.safeParse(suspended).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await updateAccountSuspended(id, suspended);
        return {};
    });
}

export async function deleteUserAction(id: number): Promise<Saved> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await deleteAccount(id);
        return {};
    });
}

// ── Groups ──

/** New group, empty or with the pages of the group it copies; answers its id */
export async function createGroupAction(name: string, pages: Record<string, string> = {}): Promise<{ success: true; id: number } | { success: false; error: string }> {
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    return run(async () => ({ id: await insertGroup(checked.name, cleanPermissions(pages)) }));
}

export async function renameGroupAction(id: number, name: string): Promise<Saved> {
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await updateGroupName(id, checked.name);
        return {};
    });
}

/** The group's pages and levels; unknown pages are dropped and "edit" kept only where a page changes data */
export async function setGroupPagesAction(id: number, pages: Record<string, string>): Promise<Saved> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await updateGroupPages(id, cleanPermissions(pages));
        return {};
    });
}

export async function deleteGroupAction(id: number): Promise<Saved> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async () => {
        await deleteGroup(id);
        return {};
    });
}
