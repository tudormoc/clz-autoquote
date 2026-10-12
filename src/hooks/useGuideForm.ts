'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getGuideFormAction, saveGuideAction } from '@/app/tasks/guide-actions';
import { useActionData } from '@/hooks/useActionData';
import { TASK_PAGES } from '@/config/navigation';
import { notify } from '@/lib/notify';
import { GuideInputSchema, inputProblem, type GuideInput } from '@/lib/tasks/input';
import { isFilledLink } from '@/lib/tasks/links';
import type { GuideDetail, TaskLink } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

export interface GuideDraft {
    title: string;
    /** '' = no area */
    areaId: string;
    body: string;
    /** '' = no review needed */
    reviewMonths: string;
    links: TaskLink[];
    contactIds: number[];
}

const fromGuide = (guide: GuideDetail | null): GuideDraft => ({
    title: guide?.title ?? '',
    areaId: guide?.areaId ? String(guide.areaId) : '',
    body: guide?.body ?? '',
    reviewMonths: guide?.reviewMonths ? String(guide.reviewMonths) : '',
    links: guide?.links ?? [],
    contactIds: guide?.contactIds ?? [],
});

function toInput(draft: GuideDraft): GuideInput {
    const months = Number(draft.reviewMonths);
    return {
        title: draft.title.trim(),
        areaId: draft.areaId ? Number(draft.areaId) : null,
        body: draft.body,
        reviewMonths: draft.reviewMonths.trim() ? (Number.isInteger(months) ? months : NaN) : null,
        links: draft.links.filter(isFilledLink).map((link) => ({ ...link, label: link.label.trim(), value: link.value.trim() })),
        contactIds: draft.contactIds,
    };
}

/** The procedure form: loads it (null id = new), holds the fields, saves and opens its page */
export function useGuideForm(id: number | null) {
    const router = useRouter();
    const load = useCallback(() => getGuideFormAction(id), [id]);
    const { data, loading, error } = useActionData(load);
    const [draft, setDraft] = useState<GuideDraft | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (data && !draft) setDraft(fromGuide(data.guide));
    }, [data, draft]);

    const set = (change: Partial<GuideDraft>) => setDraft((current) => (current ? { ...current, ...change } : current));

    const save = async () => {
        if (!draft || !data) return;
        const input = toInput(draft);
        const problem = inputProblem(GuideInputSchema, input);
        if (problem) {
            notify.error(problem);
            return;
        }
        setSaving(true);
        try {
            const result = await saveGuideAction(id, input, data.guide?.version ?? null);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(id === null ? APP_COPY.tasks.guides.created : APP_COPY.tasks.messages.saved);
            router.push(`${TASK_PAGES.guides}/${result.id}`);
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    return { draft, areas: data?.areas ?? [], contacts: data?.contacts ?? [], loading, error, saving, set, save };
}
