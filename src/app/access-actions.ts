'use server'

/**
 * Users and groups (Impostazioni → Utenti / Gruppi): superadmin only, since giving pages and reading PINs cannot be
 * handed to a group. New users get a random PIN of the kind chosen on the page, which the superadmin reads here and
 * hands over; a PIN given out here shows as "provvisorio" until the person changes it from the sidebar
 * (must_change_pin), which they may or may not do. Every change is written in the log (Registro); a PIN never is.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import { requireSuperadmin, superadminRefusal } from '@/lib/auth/access';
import {
    deleteAccount,
    deleteGroup,
    findAccountById,
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
import { logEvent, personOf, type LogPerson } from '@/lib/log/log';
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
const log = APP_COPY.log.entries;
const { MAX_NAME_LENGTH, MAX_USER_GROUPS } = APP_CONFIG.AUTH;

const IdSchema = z.number().int().positive();
const IdsSchema = z.array(IdSchema).max(MAX_USER_GROUPS);
const FlagSchema = z.boolean();

/** SQL Server: duplicate key on a UNIQUE column */
const isDuplicate = (error: unknown) => {
    const number = (error as { number?: number })?.number;
    return number === 2627 || number === 2601;
};

/**
 * Runs a write after the superadmin check, turning failures into an error text; `who` is for the log. An action that
 * looks at what was sent before calling this starts with superadminRefusal(), so the check always comes first.
 */
async function run<T extends object>(write: (who: LogPerson) => Promise<T>): Promise<({ success: true } & T) | { success: false; error: string }> {
    try {
        const access = await requireSuperadmin();
        return { success: true, ...(await write(personOf(access))) };
    } catch (error) {
        if (isDuplicate(error)) return { success: false, error: copy.nameTaken };
        console.error('Access write failed:', error);
        return { success: false, error: errorMessage(error) };
    }
}

const logUser = (who: LogPerson, action: string, id: number, summary: string, details?: unknown) =>
    logEvent(who, { page: LINKS.settings.users, action, entityKind: 'user', entityId: id, summary, details });
const logGroup = (who: LogPerson, action: string, id: number, summary: string, details?: unknown) =>
    logEvent(who, { page: LINKS.settings.groups, action, entityKind: 'group', entityId: id, summary, details });

/** The name of a user or group for a log line, the id when it is gone */
const nameOr = (record: { name: string } | null | undefined, id: number) => record?.name ?? `#${id}`;
/** Group names for the log, in the given order (the id for one that is gone) */
const groupNames = (ids: number[], groups: Group[]) => ids.map((id) => nameOr(groups.find((group) => group.id === id), id));
const findGroup = async (id: number) => (await listGroups()).find((group) => group.id === id);

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
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    const pin = randomPin(pinKindOf(kind));
    return run(async (who) => {
        const id = await insertAccount(checked.name, encryptPin(pin));
        await logUser(who, 'created', id, fmt(log.userCreated, { name: checked.name }), { after: { name: checked.name } });
        return { id, pin };
    });
}

export async function renameUserAction(id: number, name: string): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const before = await findAccountById(id);
        await updateAccountName(id, checked.name);
        await logUser(who, 'renamed', id, fmt(log.userRenamed, { from: nameOr(before, id), name: checked.name }), { before: { name: before?.name }, after: { name: checked.name } });
        return {};
    });
}

export async function setUserGroupsAction(id: number, groupIds: number[]): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    const ids = IdsSchema.safeParse(groupIds);
    if (!IdSchema.safeParse(id).success || !ids.success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const [before, groups] = await Promise.all([findAccountById(id), listGroups()]);
        await updateAccountGroups(id, ids.data);
        await logUser(who, 'groups', id, fmt(log.userGroups, { name: nameOr(before, id) }), {
            before: { groups: groupNames(before?.groupIds ?? [], groups) },
            after: { groups: groupNames(ids.data, groups) },
        });
        return {};
    });
}

/** A random PIN of the kind, proposed and not stored: the superadmin rolls until they like one, then saves it */
export async function draftPinAction(kind?: string): Promise<WithPin> {
    try {
        await requireSuperadmin();
        return { success: true, pin: randomPin(pinKindOf(kind)) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

/** A PIN chosen or accepted by the superadmin (same length rule as "Cambia PIN"); the user's open logins end */
export async function setUserPinAction(id: number, pin: string): Promise<WithPin> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    const checked = checkPin(pin);
    if ('error' in checked) return { success: false, error: checked.error };
    return run(async (who) => {
        const account = await findAccountById(id);
        await updateAccountPin(id, encryptPin(checked.pin), true);
        await logUser(who, 'pin-set', id, fmt(log.userPin, { name: nameOr(account, id) }));
        return { pin: checked.pin };
    });
}

/** Suspended: the user cannot log in and their open logins end; PIN and groups stay for when they are let back in */
export async function setUserSuspendedAction(id: number, suspended: boolean): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    if (!IdSchema.safeParse(id).success || !FlagSchema.safeParse(suspended).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const account = await findAccountById(id);
        await updateAccountSuspended(id, suspended);
        await logUser(who, suspended ? 'suspended' : 'resumed', id, fmt(suspended ? log.userSuspended : log.userResumed, { name: nameOr(account, id) }), {
            before: { suspended: account?.suspended },
            after: { suspended },
        });
        return {};
    });
}

export async function deleteUserAction(id: number): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const [account, groups] = await Promise.all([findAccountById(id), listGroups()]);
        await deleteAccount(id);
        // What is gone, without the PIN
        await logUser(who, 'deleted', id, fmt(log.userDeleted, { name: nameOr(account, id) }), {
            before: account && { name: account.name, groups: groupNames(account.groupIds, groups), suspended: account.suspended },
        });
        return {};
    });
}

// ── Groups ──

/** New group, empty or with the pages of the group it copies; answers its id */
export async function createGroupAction(name: string, pages: Record<string, string> = {}): Promise<{ success: true; id: number } | { success: false; error: string }> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    return run(async (who) => {
        const clean = cleanPermissions(pages);
        const id = await insertGroup(checked.name, clean);
        await logGroup(who, 'created', id, fmt(log.groupCreated, { name: checked.name }), { after: { name: checked.name, pages: clean } });
        return { id };
    });
}

export async function renameGroupAction(id: number, name: string): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    const checked = checkName(name);
    if ('error' in checked) return { success: false, error: checked.error };
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const before = await findGroup(id);
        await updateGroupName(id, checked.name);
        await logGroup(who, 'renamed', id, fmt(log.groupRenamed, { from: nameOr(before, id), name: checked.name }), { before: { name: before?.name }, after: { name: checked.name } });
        return {};
    });
}

/** The group's pages and levels; unknown pages are dropped and "edit" kept only where a page changes data */
export async function setGroupPagesAction(id: number, pages: Record<string, string>): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const before = await findGroup(id);
        const clean = cleanPermissions(pages);
        await updateGroupPages(id, clean);
        await logGroup(who, 'pages', id, fmt(log.groupPages, { name: nameOr(before, id) }), { before: before?.pages ?? {}, after: clean });
        return {};
    });
}

export async function deleteGroupAction(id: number): Promise<Saved> {
    const refusal = await superadminRefusal();
    if (refusal) return refusal;
    if (!IdSchema.safeParse(id).success) return { success: false, error: APP_COPY.common.notAllowed };
    return run(async (who) => {
        const before = await findGroup(id);
        await deleteGroup(id);
        await logGroup(who, 'deleted', id, fmt(log.groupDeleted, { name: nameOr(before, id) }), { before: before && { name: before.name, pages: before.pages } });
        return {};
    });
}
