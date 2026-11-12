/**
 * Users and groups of the login, in the QUOTES tables (created 2026-10-09 with the owner's yes):
 *   app_users  (id, name UNIQUE, pin = encrypted, group_ids = "1,3", last_login, suspended,
 *               must_change_pin = the PIN is still the one the superadmin gave out, never changed by the person,
 *               operator_code / netpro_user / erp_user = the same person in NetPro and Business, see src/lib/persons)
 *   app_groups (id, name UNIQUE, pages = JSON { "/page/link": "view" | "edit" })
 * Names compare without case (the columns' collation). Server only; callers check who may do it.
 */

import { queryMSSQL, withTransactions, type SqlRunner } from '@/lib/mssql';
import { cleanPermissions, mergePermissions, type PagePermissions } from '@/lib/auth/permissions';
import type { PersonLinks } from '@/lib/persons/places';

interface UserRow {
    id: number;
    name: string;
    pin: string;
    group_ids: string;
    last_login: Date | null;
    suspended: boolean;
    must_change_pin: boolean;
    operator_code: string | null;
    netpro_user: string | null;
    erp_user: string | null;
}

interface GroupRow {
    id: number;
    name: string;
    pages: string;
}

export interface Account {
    id: number;
    name: string;
    /** Encrypted PIN as stored */
    pin: string;
    groupIds: number[];
    /** Last successful login (database wall-clock time), null = never */
    lastLogin: Date | null;
    /** Suspended: cannot log in, open logins end */
    suspended: boolean;
    /** The PIN is still the one the superadmin gave out (shown as "provvisorio" in Utenti); the person may keep it */
    mustChangePin: boolean;
    /** The same person in NetPro (operator, login) and Business (login); null = not linked */
    operatorCode: string | null;
    netproUser: string | null;
    erpUser: string | null;
}

export interface Group {
    id: number;
    name: string;
    pages: PagePermissions;
}

const DB = 'QUOTES';
const USER_COLUMNS = 'id, name, pin, group_ids, last_login, suspended, must_change_pin, operator_code, netpro_user, erp_user';

const toIds = (text: string) => text.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
const toAccount = (row: UserRow): Account => ({
    id: row.id,
    name: row.name,
    pin: row.pin,
    groupIds: toIds(row.group_ids),
    lastLogin: row.last_login,
    suspended: Boolean(row.suspended),
    mustChangePin: Boolean(row.must_change_pin),
    operatorCode: row.operator_code,
    netproUser: row.netpro_user,
    erpUser: row.erp_user,
});

function toGroup(row: GroupRow): Group {
    let pages: unknown = {};
    try {
        pages = JSON.parse(row.pages);
    } catch {
        // A damaged value gives no pages
    }
    return { id: row.id, name: row.name, pages: cleanPermissions(pages) };
}

export async function findAccountById(id: number): Promise<Account | null> {
    const result = await queryMSSQL<UserRow>(`SELECT ${USER_COLUMNS} FROM app_users WITH (NOLOCK) WHERE id = @id`, { id }, DB);
    return result.recordset[0] ? toAccount(result.recordset[0]) : null;
}

export async function findAccountByName(name: string): Promise<Account | null> {
    const result = await queryMSSQL<UserRow>(`SELECT ${USER_COLUMNS} FROM app_users WITH (NOLOCK) WHERE name = @name`, { name }, DB);
    return result.recordset[0] ? toAccount(result.recordset[0]) : null;
}

/** One user with the pages of all their groups (one round trip) */
export async function loadAccountAccess(id: number): Promise<{ account: Account; pages: PagePermissions } | null> {
    const result = await queryMSSQL(
        `SELECT ${USER_COLUMNS} FROM app_users WITH (NOLOCK) WHERE id = @id;
         SELECT id, name, pages FROM app_groups WITH (NOLOCK);`,
        { id },
        DB
    );
    const [users, groups] = result.recordsets as unknown as [UserRow[], GroupRow[]];
    if (!users[0]) return null;
    const account = toAccount(users[0]);
    const own = groups.filter((group) => account.groupIds.includes(group.id)).map((group) => toGroup(group).pages);
    return { account, pages: mergePermissions(own) };
}

export async function listAccounts(): Promise<Account[]> {
    const result = await queryMSSQL<UserRow>(`SELECT ${USER_COLUMNS} FROM app_users WITH (NOLOCK) ORDER BY name`, {}, DB);
    return result.recordset.map(toAccount);
}

/** Names only (no PIN), for showing who did what (Agenda) */
export async function listAccountNames(): Promise<{ id: number; name: string; suspended: boolean }[]> {
    const result = await queryMSSQL<{ id: number; name: string; suspended: boolean }>(
        `SELECT id, name, suspended FROM app_users WITH (NOLOCK) ORDER BY name`,
        {},
        DB
    );
    return result.recordset.map((row) => ({ ...row, suspended: Boolean(row.suspended) }));
}

export async function listGroups(): Promise<Group[]> {
    const result = await queryMSSQL<GroupRow>(`SELECT id, name, pages FROM app_groups WITH (NOLOCK) ORDER BY name`, {}, DB);
    return result.recordset.map(toGroup);
}

// ── Writes (superadmin; changeOwnPin for the user themselves) ──

/** New user without groups and with a provisional PIN (given out, not yet the person's own); returns its id */
export async function insertAccount(name: string, encryptedPin: string): Promise<number> {
    const result = await queryMSSQL<{ id: number }>(
        `INSERT INTO app_users (name, pin, must_change_pin) OUTPUT INSERTED.id VALUES (@name, @pin, 1)`,
        { name, pin: encryptedPin },
        DB
    );
    return result.recordset[0].id;
}

export async function updateAccountName(id: number, name: string): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET name = @name WHERE id = @id`, { id, name }, DB);
}

/** `run`: the caller's transaction, when the change is part of a larger one (a group deleted) */
export async function updateAccountGroups(id: number, groupIds: number[], run: SqlRunner = queryMSSQL): Promise<void> {
    await run(`UPDATE app_users SET group_ids = @groupIds WHERE id = @id`, { id, groupIds: groupIds.join(',') }, DB);
}

/** `provisional`: given out by the superadmin, or chosen by the person themselves */
export async function updateAccountPin(id: number, encryptedPin: string, provisional: boolean): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET pin = @pin, must_change_pin = @provisional WHERE id = @id`, { id, pin: encryptedPin, provisional }, DB);
}

/** Which records of NetPro and Business this login is (Scheda persona) */
export async function updateAccountLinks(id: number, links: PersonLinks): Promise<void> {
    await queryMSSQL(
        `UPDATE app_users SET operator_code = @operatorCode, netpro_user = @netproUser, erp_user = @erpUser WHERE id = @id`,
        { id, operatorCode: links.operatorCode, netproUser: links.netproUser, erpUser: links.erpUser },
        DB
    );
}

export async function updateAccountSuspended(id: number, suspended: boolean): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET suspended = @suspended WHERE id = @id`, { id, suspended }, DB);
}

/** Notes the time of a successful login */
export async function recordLogin(id: number): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET last_login = GETDATE() WHERE id = @id`, { id }, DB);
}

export async function deleteAccount(id: number): Promise<void> {
    await queryMSSQL(`DELETE FROM app_users WHERE id = @id`, { id }, DB);
}

/** New group (optionally with pages already chosen); returns its id */
export async function insertGroup(name: string, pages: PagePermissions = {}): Promise<number> {
    const result = await queryMSSQL<{ id: number }>(
        `INSERT INTO app_groups (name, pages) OUTPUT INSERTED.id VALUES (@name, @pages)`,
        { name, pages: JSON.stringify(pages) },
        DB
    );
    return result.recordset[0].id;
}

export async function updateGroupName(id: number, name: string): Promise<void> {
    await queryMSSQL(`UPDATE app_groups SET name = @name WHERE id = @id`, { id, name }, DB);
}

export async function updateGroupPages(id: number, pages: PagePermissions): Promise<void> {
    await queryMSSQL(`UPDATE app_groups SET pages = @pages WHERE id = @id`, { id, pages: JSON.stringify(pages) }, DB);
}

/**
 * Deletes a group and takes it off its users, in one transaction: all of it, or none (until 2026-11-12 it was one
 * write per user and then the delete, so a stop halfway left some users without the group and the group still there).
 */
export async function deleteGroup(id: number): Promise<void> {
    const members = (await listAccounts()).filter((account) => account.groupIds.includes(id));
    await withTransactions([DB], async (run) => {
        for (const account of members) await updateAccountGroups(account.id, account.groupIds.filter((groupId) => groupId !== id), run);
        await run(`DELETE FROM app_groups WHERE id = @id`, { id }, DB);
    });
}
