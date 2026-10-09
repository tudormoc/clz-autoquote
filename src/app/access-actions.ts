'use server'

/**
 * Users and groups (Impostazioni → Utenti / Gruppi): superadmin only. New users get a random PIN that the
 * superadmin reads here and hands over; the user can keep it or change it.
 */

import { randomInt } from 'node:crypto';
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
import { checkPin, decryptPin, encryptPin } from '@/lib/auth/secrets';
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
}

const copy = APP_COPY.admin.users;
const { GENERATED_PIN_LENGTH, MAX_NAME_LENGTH } = APP_CONFIG.AUTH;

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

const randomPin = () => String(randomInt(0, 10 ** GENERATED_PIN_LENGTH)).padStart(GENERATED_PIN_LENGTH, '0');

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

/** New user without groups (ticked afterwards) and a random PIN; answers its id and PIN */
export async function createUserAction(name: string): Promise<Created> {
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    const pin = randomPin();
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

/** A new random PIN: the old one stops working and the user's open logins end */
export async function newUserPinAction(id: number): Promise<WithPin> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    const pin = randomPin();
    return run(async () => {
        await updateAccountPin(id, encryptPin(pin));
        return { pin };
    });
}

/** A PIN chosen by the superadmin (same length rule as "Cambia PIN"); the user's open logins end */
export async function setUserPinAction(id: number, pin: string): Promise<WithPin> {
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    const checked = checkPin(pin);
    if ('error' in checked) return { success: false, error: checked.error };
    return run(async () => {
        await updateAccountPin(id, encryptPin(checked.pin));
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
