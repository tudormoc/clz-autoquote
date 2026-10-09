'use client';

import { KeyRound, Trash2, UserCheck, UserX } from 'lucide-react';
import type { UserView } from '@/app/access-actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { ToggleChips } from '@/components/ui/ToggleChips';
import type { Group } from '@/lib/auth/accounts';
import { EMPTY_VALUE, formatDbDateTime } from '@/lib/format';
import { grantablePage, mergePermissions, type AccessLevel } from '@/lib/auth/permissions';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

interface UserEditorProps {
    user: UserView;
    groups: Group[];
    onRename: (name: string) => Promise<boolean>;
    onGroups: (groupIds: number[]) => void;
    onNewPin: () => void;
    onSuspend: (suspended: boolean) => void;
    onDelete: () => void;
}

/**
 * One user: name (click to change), last login, PIN in clear, suspend / let back in, groups to tick, and what those
 * groups let them see and change.
 */
export function UserEditor({ user, groups, onRename, onGroups, onNewPin, onSuspend, onDelete }: UserEditorProps) {
    const own = new Set(user.groupIds);
    const pages = mergePermissions(groups.filter((group) => own.has(group.id)).map((group) => group.pages));
    const labels = (level: AccessLevel) =>
        Object.entries(pages)
            .filter(([, granted]) => granted === level)
            .map(([href]) => grantablePage(href)?.label)
            .filter(Boolean)
            .join(', ');
    const sees = labels('view');
    const edits = labels('edit');

    return (
        <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-lg font-semibold text-fg-strong">
                        <EditableCell
                            display={user.name}
                            startValue={() => user.name}
                            renderEditor={(draft, setDraft) => (
                                <div className="w-56">
                                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                                </div>
                            )}
                            onSave={onRename}
                        />
                    </div>
                    <p className="text-sm text-fg-muted">
                        {user.lastLogin ? fmt(copy.lastLogin, { date: formatDbDateTime(user.lastLogin) }) : copy.neverLoggedIn}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-fg-muted">{copy.pin}</span>
                    <span className="px-2 py-1 rounded bg-muted font-mono text-fg-strong">{user.pin || EMPTY_VALUE}</span>
                    <Button variant="secondary" size="sm" onClick={onNewPin}>
                        <KeyRound size={14} />
                        {copy.newPin}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onSuspend(!user.suspended)}>
                        {user.suspended ? <UserCheck size={14} /> : <UserX size={14} />}
                        {user.suspended ? copy.resume : copy.suspend}
                    </Button>
                    <Button variant="ghost" size="sm" title={APP_COPY.common.delete} onClick={onDelete}>
                        <Trash2 size={16} className="text-danger" />
                    </Button>
                </div>
            </div>

            {user.suspended && (
                <p className="px-3 py-2 rounded-md border border-warning-500/30 bg-warning-500/10 text-sm text-warning-300">{copy.suspendedNote}</p>
            )}

            {groups.length === 0 ? (
                <p className="text-sm text-fg-muted">{copy.noGroups}</p>
            ) : (
                <ToggleChips
                    label={copy.groups}
                    options={groups.map((group) => ({ key: group.id, label: group.name }))}
                    active={own}
                    onToggle={(id) => onGroups(Array.from(toggleInSet(own, id)))}
                />
            )}

            <dl className="text-sm space-y-1">
                {!sees && !edits && <p className="text-fg-muted">{copy.nothing}</p>}
                {edits && (
                    <div className="flex gap-2">
                        <dt className="shrink-0 text-warning-300">{copy.edits}:</dt>
                        <dd className="text-fg-secondary">{edits}</dd>
                    </div>
                )}
                {sees && (
                    <div className="flex gap-2">
                        <dt className="shrink-0 text-primary">{copy.sees}:</dt>
                        <dd className="text-fg-secondary">{sees}</dd>
                    </div>
                )}
            </dl>
        </Card>
    );
}
