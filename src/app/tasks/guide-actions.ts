'use server'

/**
 * Agenda → Procedure and Contatti. Reading needs any Agenda page (tasks show their procedures and contacts);
 * changing needs "modifica" on Procedure or on Contatti.
 */

import { z } from 'zod';
import { TASK_PAGES } from '@/config/navigation';
import { authorize } from '@/lib/auth/access';
import { ContactInputSchema, GuideInputSchema, inputProblem, type ContactInput, type GuideInput } from '@/lib/tasks/input';
import { insertContact, listContacts, updateContact, updateContactState } from '@/lib/tasks/db/contacts';
import { getGuide, getGuideVersion, insertGuide, listGuides, markGuideReviewed, restoreGuideVersion, updateGuide, updateGuideState } from '@/lib/tasks/db/guides';
import { listAreas } from '@/lib/tasks/db/settings';
import { NotFound, loadPeople } from '@/lib/tasks/db/shared';
import { GUIDE_STATES, type Contact, type GuideDetail, type GuideSummary, type GuideVersion, type NamedItem } from '@/lib/tasks/types';
import { attempt, refused, type Result, type Saved } from '@/app/tasks/results';

const ALL_PAGES = Object.values(TASK_PAGES);

const IdSchema = z.number().int().positive();
const VersionSchema = z.string().regex(/^0x[0-9A-Fa-f]{16}$/);
const valid = (id: unknown, version: unknown) => IdSchema.safeParse(id).success && VersionSchema.safeParse(version).success;

// ── Procedures ──

export async function getGuidesAction(): Promise<Result<{ guides: GuideSummary[]; areas: NamedItem[] }>> {
    await authorize('view', ...ALL_PAGES);
    return attempt('guides', async () => {
        const [guides, areas] = await Promise.all([listGuides(), listAreas()]);
        return { guides, areas };
    });
}

/** A procedure with its links, contacts, tasks and versions; the areas and contacts to choose from in its form */
export async function getGuideAction(id: number): Promise<Result<{ guide: GuideDetail; areas: NamedItem[]; contacts: Contact[] }>> {
    const access = await authorize('view', ...ALL_PAGES);
    if (!IdSchema.safeParse(id).success) return refused();
    return attempt('guide', async () => {
        const [guide, areas, contacts] = await Promise.all([getGuide(access, id, await loadPeople()), listAreas(), listContacts()]);
        if (!guide) throw new NotFound();
        return { guide, areas, contacts };
    });
}

/** The procedure form: the procedure to change (null for a new one) and the areas and contacts to choose from */
export async function getGuideFormAction(id: number | null): Promise<Result<{ guide: GuideDetail | null; areas: NamedItem[]; contacts: Contact[] }>> {
    const access = await authorize('view', ...ALL_PAGES);
    if (id !== null && !IdSchema.safeParse(id).success) return refused();
    return attempt('guide form', async () => {
        const [guide, areas, contacts] = await Promise.all([id === null ? null : getGuide(access, id, await loadPeople()), listAreas(), listContacts()]);
        if (id !== null && !guide) throw new NotFound();
        return { guide, areas, contacts };
    });
}

export async function getGuideVersionAction(guideId: number, versionId: number): Promise<Result<{ version: GuideVersion }>> {
    await authorize('view', ...ALL_PAGES);
    if (!IdSchema.safeParse(guideId).success || !IdSchema.safeParse(versionId).success) return refused();
    return attempt('guide version', async () => {
        const version = await getGuideVersion(guideId, versionId, await loadPeople());
        if (!version) throw new NotFound();
        return { version };
    });
}

/** Creates (id null) or saves a procedure; answers its id */
export async function saveGuideAction(id: number | null, input: GuideInput, version: string | null): Promise<Result<{ id: number }>> {
    const access = await authorize('edit', TASK_PAGES.guides);
    const problem = inputProblem(GuideInputSchema, input);
    if (problem) return refused(problem);
    if (id !== null && !valid(id, version)) return refused();
    const clean = GuideInputSchema.parse(input);
    return attempt('save guide', async () => {
        if (id === null) return { id: await insertGuide(access, clean) };
        await updateGuide(access, id, version as string, clean);
        return { id };
    });
}

export async function restoreGuideVersionAction(id: number, version: string, versionId: number): Promise<Saved> {
    const access = await authorize('edit', TASK_PAGES.guides);
    if (!valid(id, version) || !IdSchema.safeParse(versionId).success) return refused();
    return attempt('restore guide version', async () => {
        await restoreGuideVersion(access, id, version, versionId, await loadPeople());
        return {};
    });
}

export async function markGuideReviewedAction(id: number, version: string): Promise<Saved> {
    const access = await authorize('edit', TASK_PAGES.guides);
    if (!valid(id, version)) return refused();
    return attempt('guide reviewed', async () => {
        await markGuideReviewed(access, id, version);
        return {};
    });
}

export async function setGuideStateAction(id: number, version: string, state: string): Promise<Saved> {
    const access = await authorize('edit', TASK_PAGES.guides);
    const parsed = z.enum(GUIDE_STATES).safeParse(state);
    if (!valid(id, version) || !parsed.success) return refused();
    return attempt('guide state', async () => {
        await updateGuideState(access, id, version, parsed.data);
        return {};
    });
}

// ── Contacts ──

export async function getContactsAction(): Promise<Result<{ contacts: Contact[] }>> {
    await authorize('view', ...ALL_PAGES);
    return attempt('contacts', async () => ({ contacts: await listContacts() }));
}

/** Creates (id null) or saves a contact; answers its id */
export async function saveContactAction(id: number | null, input: ContactInput, version: string | null): Promise<Result<{ id: number }>> {
    const access = await authorize('edit', TASK_PAGES.contacts);
    const problem = inputProblem(ContactInputSchema, input);
    if (problem) return refused(problem);
    if (id !== null && !valid(id, version)) return refused();
    const clean = ContactInputSchema.parse(input);
    return attempt('save contact', async () => {
        if (id === null) return { id: await insertContact(access, clean) };
        await updateContact(access, id, version as string, clean);
        return { id };
    });
}

export async function setContactStateAction(id: number, version: string, state: string): Promise<Saved> {
    const access = await authorize('edit', TASK_PAGES.contacts);
    const parsed = z.enum(GUIDE_STATES).safeParse(state);
    if (!valid(id, version) || !parsed.success) return refused();
    return attempt('contact state', async () => {
        await updateContactState(access, id, version, parsed.data);
        return {};
    });
}
