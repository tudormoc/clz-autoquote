/**
 * Contacts (tsk_contacts): people and companies to call or write, used by tasks and procedures. Shared by everyone
 * who opens the Agenda. Never deleted, only archived (they stay where they are used). Server only.
 */

import type { UserAccess } from '@/lib/auth/permissions';
import type { ContactInput } from '@/lib/tasks/input';
import type { Contact, GuideState } from '@/lib/tasks/types';
import { THROW_IF_STALE, VERSION_MATCH, VERSION_SQL, logSql, personKey, rows, transaction } from '@/lib/tasks/db/shared';

interface ContactRow {
    id: number;
    name: string;
    company: string | null;
    role: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    state: GuideState;
    task_count: number;
    guide_count: number;
    version: string;
}

export async function listContacts(): Promise<Contact[]> {
    const list = await rows<ContactRow>(
        `SELECT c.id, c.name, c.company, c.role, c.phone, c.email, c.notes, c.state, ${VERSION_SQL('c.row_version')} AS version,
                (SELECT COUNT(*) FROM tsk_contact_refs r WITH (NOLOCK) WHERE r.contact_id = c.id AND r.owner_kind = 'task') AS task_count,
                (SELECT COUNT(*) FROM tsk_contact_refs r WITH (NOLOCK) WHERE r.contact_id = c.id AND r.owner_kind = 'guide') AS guide_count
         FROM tsk_contacts c WITH (NOLOCK) ORDER BY c.name`
    );
    return list.map((row) => ({
        id: row.id,
        name: row.name,
        company: row.company ?? '',
        role: row.role ?? '',
        phone: row.phone ?? '',
        email: row.email ?? '',
        notes: row.notes ?? '',
        state: row.state,
        taskCount: row.task_count,
        guideCount: row.guide_count,
        version: row.version,
    }));
}

const contactParams = (access: UserAccess, input: ContactInput) => ({
    me: personKey(access),
    name: input.name,
    company: input.company || null,
    role: input.role || null,
    phone: input.phone || null,
    email: input.email || null,
    notes: input.notes.trim() || null,
});

export async function insertContact(access: UserAccess, input: ContactInput): Promise<number> {
    const result = await rows<{ id: number }>(
        transaction(`
            DECLARE @id INT;
            INSERT INTO tsk_contacts (name, company, role, phone, email, notes, created_by, updated_by)
            VALUES (@name, @company, @role, @phone, @email, @notes, @me, @me);
            SET @id = SCOPE_IDENTITY();
            ${logSql('contact', '@id', 'NULL', 'created')}
            SELECT @id AS id;
        `),
        contactParams(access, input)
    );
    return result[0].id;
}

export async function updateContact(access: UserAccess, id: number, version: string, input: ContactInput): Promise<void> {
    await rows(
        transaction(`
            UPDATE tsk_contacts SET name = @name, company = @company, role = @role, phone = @phone, email = @email, notes = @notes,
                   updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${logSql('contact', '@id', 'NULL', 'changed')}
        `),
        { ...contactParams(access, input), id, version }
    );
}

export async function updateContactState(access: UserAccess, id: number, version: string, state: GuideState): Promise<void> {
    await rows(
        transaction(`
            UPDATE tsk_contacts SET state = @state, updated_at = GETDATE(), updated_by = @me WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${logSql('contact', '@id', 'NULL', state === 'archived' ? 'archived' : 'restored')}
        `),
        { id, version, state, me: personKey(access) }
    );
}
