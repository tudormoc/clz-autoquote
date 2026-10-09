'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import type { UserView } from '@/app/access-actions';
import { PermissionTable } from '@/components/admin/access/PermissionTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { TagCell } from '@/components/ui/TableCells';
import { APP_CONFIG } from '@/config/constants';
import type { Group } from '@/lib/auth/accounts';
import type { PagePermissions } from '@/lib/auth/permissions';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

interface GroupEditorProps {
    group: Group;
    /** Users in the group */
    members: UserView[];
    onRename: (name: string) => Promise<boolean>;
    /** Saves the group's pages; true when saved */
    onPages: (pages: PagePermissions) => Promise<boolean>;
    onDuplicate: (pages: PagePermissions) => void;
    onDelete: () => void;
}

/**
 * One group: name (click to change), its users, what it opens, and its permission table. Clicks show at once and are
 * saved together a moment after the last one (APP_CONFIG.UI.AUTOSAVE_DELAY_MS).
 */
export function GroupEditor({ group, members, onRename, onPages, onDuplicate, onDelete }: GroupEditorProps) {
    const [draft, setDraft] = useState<PagePermissions>(group.pages);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Stored pages reloaded (after a save, or a rename): shown unless a change of ours is still waiting
    useEffect(() => {
        if (!pending.current) setDraft(group.pages);
    }, [group.pages]);

    const change = (pages: PagePermissions) => {
        setDraft(pages);
        setStatus('saving');
        if (pending.current) clearTimeout(pending.current);
        pending.current = setTimeout(async () => {
            pending.current = null;
            setStatus((await onPages(pages)) ? 'saved' : 'idle');
        }, APP_CONFIG.UI.AUTOSAVE_DELAY_MS);
    };

    const visible = Object.keys(draft).length;
    const editable = Object.values(draft).filter((level) => level === 'edit').length;

    return (
        <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-lg font-semibold text-fg-strong">
                        <EditableCell
                            display={group.name}
                            startValue={() => group.name}
                            renderEditor={(text, setText) => (
                                <div className="w-56">
                                    <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                                </div>
                            )}
                            onSave={onRename}
                        />
                    </div>
                    <p className="text-sm text-fg-muted">
                        {fmt(copy.summary, { view: visible, edit: editable })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'saving' && (
                        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                            <Spinner size={12} />
                            {copy.saving}
                        </span>
                    )}
                    {status === 'saved' && (
                        <span className="flex items-center gap-1 text-xs text-success-400">
                            <Check size={14} />
                            {copy.saved}
                        </span>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => onDuplicate(draft)}>
                        <Copy size={14} />
                        {copy.duplicate}
                    </Button>
                    <Button variant="ghost" size="sm" title={APP_COPY.common.delete} onClick={onDelete}>
                        <Trash2 size={16} className="text-danger" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="mr-1 text-fg-muted">{fmt(copy.members, { count: members.length })}:</span>
                {members.length === 0 ? (
                    <span className="text-fg-muted">{copy.noMembers}</span>
                ) : (
                    members.map((user) => <TagCell key={user.id}>{user.name}</TagCell>)
                )}
            </div>

            <PermissionTable pages={draft} onChange={change} />
        </Card>
    );
}
