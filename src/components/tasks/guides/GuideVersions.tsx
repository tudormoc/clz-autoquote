'use client';

import { useState } from 'react';
import { History, RotateCcw } from '@/components/ui/icons';
import { getGuideVersionAction, restoreGuideVersionAction } from '@/app/tasks/guide-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import { askConfirm } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { formatMoment } from '@/lib/tasks/describe';
import type { GuideDetail, GuideVersion } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';

const copy = APP_COPY.tasks.guides;

/** Earlier texts of a procedure: open one to read it, put it back (the current text is kept as a version too) */
export function GuideVersions({ guide, reload }: { guide: GuideDetail; reload: () => Promise<void> }) {
    const canEdit = useCanEdit();
    const [shown, setShown] = useState<GuideVersion | null>(null);

    const show = async (versionId: number) => {
        if (shown?.id === versionId) return setShown(null);
        try {
            const result = await getGuideVersionAction(guide.id, versionId);
            if (result.success) setShown(result.version);
            else notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
    };

    const restore = async (version: GuideVersion) => {
        if (!(await askConfirm({ title: copy.restoreVersion, message: fmt(copy.restoreConfirm, { date: formatMoment(version.savedAt) }) }))) return;
        try {
            const result = await restoreGuideVersionAction(guide.id, guide.version, version.id);
            if (!result.success) notify.error(result.error);
            else {
                notify.success(copy.restored);
                setShown(null);
            }
        } catch (err) {
            notify.failure(err);
        }
        await reload();
    };

    return (
        <Panel title={copy.versions} icon={History}>
            {guide.versions.length === 0 ? (
                <p className="text-sm text-fg-subtle">{copy.noVersions}</p>
            ) : (
                <ul className="space-y-2">
                    {guide.versions.map((version) => (
                        <li key={version.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span>
                                    <span className="font-mono text-fg-secondary">{formatMoment(version.savedAt)}</span>
                                    <span className="text-fg-muted"> · {version.savedBy}</span>
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => show(version.id)}>
                                    {shown?.id === version.id ? copy.hideVersion : copy.showVersion}
                                </Button>
                            </div>
                            {shown?.id === version.id && (
                                <div className={surfaceClasses('inset', 'p-3 space-y-3')}>
                                    <p className="text-sm font-semibold text-fg-strong">{shown.title}</p>
                                    {shown.body ? <Markdown text={shown.body} /> : null}
                                    {canEdit && (
                                        <Button size="sm" variant="secondary" onClick={() => restore(shown)}>
                                            <RotateCcw size={14} />
                                            {copy.restoreVersion}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
