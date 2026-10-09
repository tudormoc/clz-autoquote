/**
 * Users and groups of the login, in the QUOTES tables (created 2026-10-09 with the owner's yes):
 *   app_users  (id, name UNIQUE, pin = encrypted, group_ids = "1,3")
 *   app_groups (id, name UNIQUE, pages = JSON { "/page/link": "view" | "edit" })
 * Names compare without case (the columns' collation). Server only; callers check who may do it.
 */

import { queryMSSQL } from '@/lib/mssql';
import { cleanPermissions, mergePermissions, type PagePermissions } from '@/lib/auth/permissions';

interface UserRow {
    id: number;
    name: string;
    pin: string;
    group_ids: string;
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
}

export interface Group {
    id: number;
    name: string;
    pages: PagePermissions;
}

const DB = 'QUOTES';

const toIds = (text: string) => text.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
const toAccount = (row: UserRow): Account => ({ id: row.id, name: row.name, pin: row.pin, groupIds: toIds(row.group_ids) });

function toGroup(row: GroupRow): Group {
    let pages: unknown = {};
    try {
        pages = JSON.parse(row.pages);
    } catch {
        // A damaged value gives no pages
    }
    return { id: row.id, name: row.name, pages: cleanPermissions(pages) };
}

export async function findAccountByName(name: string): Promise<Account | null> {
    const result = await queryMSSQL<UserRow>(`SELECT id, name, pin, group_ids FROM app_users WITH (NOLOCK) WHERE name = @name`, { name }, DB);
    return result.recordset[0] ? toAccount(result.recordset[0]) : null;
}

/** One user with the pages of all their groups (one round trip) */
export async function loadAccountAccess(id: number): Promise<{ account: Account; pages: PagePermissions } | null> {
    const result = await queryMSSQL(
        `SELECT id, name, pin, group_ids FROM app_users WITH (NOLOCK) WHERE id = @id;
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
    const result = await queryMSSQL<UserRow>(`SELECT id, name, pin, group_ids FROM app_users WITH (NOLOCK) ORDER BY name`, {}, DB);
    return result.recordset.map(toAccount);
}

export async function listGroups(): Promise<Group[]> {
    const result = await queryMSSQL<GroupRow>(`SELECT id, name, pages FROM app_groups WITH (NOLOCK) ORDER BY name`, {}, DB);
    return result.recordset.map(toGroup);
}

// ── Writes (superadmin; changeOwnPin for the user themselves) ──

export async function insertAccount(name: string, encryptedPin: string, groupIds: number[]): Promise<void> {
    await queryMSSQL(`INSERT INTO app_users (name, pin, group_ids) VALUES (@name, @pin, @groupIds)`, { name, pin: encryptedPin, groupIds: groupIds.join(',') }, DB);
}

export async function updateAccountName(id: number, name: string): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET name = @name WHERE id = @id`, { id, name }, DB);
}

export async function updateAccountGroups(id: number, groupIds: number[]): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET group_ids = @groupIds WHERE id = @id`, { id, groupIds: groupIds.join(',') }, DB);
}

export async function updateAccountPin(id: number, encryptedPin: string): Promise<void> {
    await queryMSSQL(`UPDATE app_users SET pin = @pin WHERE id = @id`, { id, pin: encryptedPin }, DB);
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

/** Deletes a group and takes it off its users (a group id left on a user would be ignored anyway) */
export async function deleteGroup(id: number): Promise<void> {
    const members = (await listAccounts()).filter((account) => account.groupIds.includes(id));
    for (const account of members) await updateAccountGroups(account.id, account.groupIds.filter((groupId) => groupId !== id));
    await queryMSSQL(`DELETE FROM app_groups WHERE id = @id`, { id }, DB);
}
