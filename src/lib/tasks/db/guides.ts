/**
 * Procedures (tsk_guides): how something is done. Every save keeps the earlier text in tsk_guide_versions, so nothing
 * written is ever lost. Procedures are shared: everyone who opens the Procedure page sees all of them. Server only.
 */

import type { UserAccess } from '@/lib/auth/permissions';
import type { SqlParams } from '@/lib/mssql';
import { addMonths } from '@/lib/dateUtils';
import type { GuideInput } from '@/lib/tasks/input';
import type { GuideDetail, GuideState, GuideSummary, GuideVersion, Person, TaskLink, TaskState } from '@/lib/tasks/types';
import {
    DATE_SQL,
    MOMENT_SQL,
    NotFound,
    THROW_IF_STALE,
    VERSION_MATCH,
    VERSION_SQL,
    logSql,
    nameResolver,
    personKey,
    rowSets,
    rows,
    today,
    transaction,
    visibleTasksSql,
} from '@/lib/tasks/db/shared';

interface GuideRow {
    id: number;
    title: string;
    area_id: number | null;
    area_name: string | null;
    state: GuideState;
    updated_at: string;
    review_months: number | null;
    reviewed_at: string | null;
    task_count: number;
}

const GUIDE_SELECT = `
    SELECT g.id, g.title, g.area_id, a.name AS area_name, g.state, ${MOMENT_SQL('g.updated_at')} AS updated_at,
           g.review_months, ${DATE_SQL('g.reviewed_at')} AS reviewed_at,
           (SELECT COUNT(*) FROM tsk_task_guides tg WITH (NOLOCK) WHERE tg.guide_id = g.id) AS task_count
    FROM tsk_guides g WITH (NOLOCK)
    LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = g.area_id`;

/** Due for a check: it has a review interval and that long has passed since the last check (or it was never checked) */
function toReview(row: GuideRow): boolean {
    if (!row.review_months) return false;
    return !row.reviewed_at || addMonths(row.reviewed_at, row.review_months) <= today();
}

const toSummary = (row: GuideRow): GuideSummary => ({
    id: row.id,
    title: row.title,
    areaId: row.area_id,
    areaName: row.area_name,
    state: row.state,
    updatedAt: row.updated_at,
    reviewMonths: row.review_months,
    reviewedAt: row.reviewed_at,
    toReview: toReview(row),
    taskCount: row.task_count,
});

export async function listGuides(): Promise<GuideSummary[]> {
    return (await rows<GuideRow>(`${GUIDE_SELECT} ORDER BY g.title`)).map(toSummary);
}

export async function getGuide(access: UserAccess, id: number, people: Person[]): Promise<GuideDetail | null> {
    const params: SqlParams = { id };
    const [found, extra, links, contacts, tasks, versions] = (await rowSets(
        `${GUIDE_SELECT} WHERE g.id = @id;
         SELECT g.body, ${MOMENT_SQL('g.created_at')} AS created_at, g.created_by, g.updated_by, ${VERSION_SQL('g.row_version')} AS version
         FROM tsk_guides g WITH (NOLOCK) WHERE g.id = @id;
         SELECT label, kind, value FROM tsk_links WITH (NOLOCK) WHERE owner_kind = 'guide' AND owner_id = @id ORDER BY sort_order, id;
         SELECT contact_id FROM tsk_contact_refs WITH (NOLOCK) WHERE owner_kind = 'guide' AND owner_id = @id;
         SELECT t.id, t.title, t.state FROM tsk_task_guides tg WITH (NOLOCK) JOIN tsk_tasks t WITH (NOLOCK) ON t.id = tg.task_id
         WHERE tg.guide_id = @id AND ${visibleTasksSql(access, params)} ORDER BY t.title;
         SELECT id, ${MOMENT_SQL('saved_at')} AS saved_at, saved_by FROM tsk_guide_versions WITH (NOLOCK) WHERE guide_id = @id ORDER BY id DESC;`,
        params
    )) as [
        GuideRow[],
        { body: string | null; created_at: string; created_by: string; updated_by: string; version: string }[],
        TaskLink[],
        { contact_id: number }[],
        { id: number; title: string; state: TaskState }[],
        { id: number; saved_at: string; saved_by: string }[],
    ];
    if (!found[0] || !extra[0]) return null;
    const nameOf = nameResolver(people);
    return {
        ...toSummary(found[0]),
        body: extra[0].body ?? '',
        links: links.map((link) => ({ label: link.label ?? '', kind: link.kind, value: link.value })),
        contactIds: contacts.map((contact) => contact.contact_id),
        createdAt: extra[0].created_at,
        createdBy: nameOf(extra[0].created_by) ?? '',
        updatedBy: nameOf(extra[0].updated_by) ?? '',
        version: extra[0].version,
        tasks,
        versions: versions.map((v) => ({ id: v.id, savedAt: v.saved_at, savedBy: nameOf(v.saved_by) ?? '' })),
    };
}

export async function getGuideVersion(guideId: number, versionId: number, people: Person[]): Promise<GuideVersion | null> {
    const found = await rows<{ id: number; title: string; body: string | null; saved_at: string; saved_by: string }>(
        `SELECT id, title, body, ${MOMENT_SQL('saved_at')} AS saved_at, saved_by FROM tsk_guide_versions WITH (NOLOCK) WHERE id = @versionId AND guide_id = @guideId`,
        { guideId, versionId }
    );
    const row = found[0];
    return row ? { id: row.id, title: row.title, body: row.body ?? '', savedAt: row.saved_at, savedBy: nameResolver(people)(row.saved_by) ?? '' } : null;
}

/** Links and contacts of a procedure, written again (inside a batch; @id, @links, @contactIds) */
const REPLACE_REFS_SQL = `
    DELETE FROM tsk_links WHERE owner_kind = 'guide' AND owner_id = @id;
    INSERT INTO tsk_links (owner_kind, owner_id, label, kind, value, sort_order)
    SELECT 'guide', @id, NULLIF(JSON_VALUE(j.value, '$.label'), ''), JSON_VALUE(j.value, '$.kind'), JSON_VALUE(j.value, '$.value'), CAST(j.[key] AS INT)
    FROM OPENJSON(@links) j;
    DELETE FROM tsk_contact_refs WHERE owner_kind = 'guide' AND owner_id = @id;
    INSERT INTO tsk_contact_refs (contact_id, owner_kind, owner_id)
    SELECT DISTINCT c.id, 'guide', @id FROM OPENJSON(@contactIds) j JOIN tsk_contacts c ON c.id = TRY_CAST(j.value AS INT);`;

const guideParams = (access: UserAccess, input: GuideInput): SqlParams => ({
    me: personKey(access),
    title: input.title,
    areaId: input.areaId,
    body: input.body.trim() || null,
    reviewMonths: input.reviewMonths,
    links: JSON.stringify(input.links),
    contactIds: JSON.stringify(input.contactIds),
});

export async function insertGuide(access: UserAccess, input: GuideInput): Promise<number> {
    const result = await rows<{ id: number }>(
        transaction(`
            DECLARE @id INT;
            INSERT INTO tsk_guides (title, area_id, body, review_months, reviewed_at, created_by, updated_by)
            VALUES (@title, @areaId, @body, @reviewMonths, CAST(GETDATE() AS date), @me, @me);
            SET @id = SCOPE_IDENTITY();
            ${REPLACE_REFS_SQL}
            ${logSql('guide', '@id', 'NULL', 'created')}
            SELECT @id AS id;
        `),
        guideParams(access, input)
    );
    return result[0].id;
}

/** Saves a procedure; when its text changes, the earlier text is kept as a version first */
export async function updateGuide(access: UserAccess, id: number, version: string, input: GuideInput): Promise<void> {
    await rows(
        transaction(`
            INSERT INTO tsk_guide_versions (guide_id, title, body, saved_at, saved_by)
            SELECT id, title, body, updated_at, updated_by FROM tsk_guides
            WHERE id = @id AND ${VERSION_MATCH()} AND (title <> @title OR ISNULL(body, N'') <> ISNULL(@body, N''));
            UPDATE tsk_guides SET title = @title, area_id = @areaId, body = @body, review_months = @reviewMonths,
                   updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${REPLACE_REFS_SQL}
            ${logSql('guide', '@id', 'NULL', 'changed')}
        `),
        { ...guideParams(access, input), id, version }
    );
}

/** Puts an earlier text back (the current one becomes a version, as with any save) */
export async function restoreGuideVersion(access: UserAccess, id: number, version: string, versionId: number, people: Person[]): Promise<void> {
    const old = await getGuideVersion(id, versionId, people);
    if (!old) throw new NotFound();
    await rows(
        transaction(`
            INSERT INTO tsk_guide_versions (guide_id, title, body, saved_at, saved_by)
            SELECT id, title, body, updated_at, updated_by FROM tsk_guides WHERE id = @id AND ${VERSION_MATCH()};
            UPDATE tsk_guides SET title = @title, body = @body, updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${logSql('guide', '@id', 'NULL', 'restored', 'details')}
        `),
        { id, version, me: personKey(access), title: old.title, body: old.body || null, details: JSON.stringify({ version: versionId }) }
    );
}

export async function markGuideReviewed(access: UserAccess, id: number, version: string): Promise<void> {
    await rows(
        transaction(`
            UPDATE tsk_guides SET reviewed_at = CAST(GETDATE() AS date) WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${logSql('guide', '@id', 'NULL', 'reviewed')}
        `),
        { id, version, me: personKey(access) }
    );
}

export async function updateGuideState(access: UserAccess, id: number, version: string, state: GuideState): Promise<void> {
    await rows(
        transaction(`
            UPDATE tsk_guides SET state = @state, updated_at = GETDATE(), updated_by = @me WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${logSql('guide', '@id', 'NULL', state === 'archived' ? 'archived' : 'restored')}
        `),
        { id, version, state, me: personKey(access) }
    );
}
