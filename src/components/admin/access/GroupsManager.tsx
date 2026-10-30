'use client';

import { Check } from 'lucide-react';
import { createGroupAction, deleteGroupAction, renameGroupAction, setGroupPagesAction } from '@/app/access-actions';
import { GroupsMatrix } from '@/components/admin/access/GroupsMatrix';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadState } from '@/components/ui/LoadState';
import { Spinner } from '@/components/ui/Spinner';
import { useAccounts } from '@/hooks/useAccounts';
import { useGroupDrafts } from '@/hooks/useGroupDrafts';
import type { Group } from '@/lib/auth/accounts';
import type { PagePermissions } from '@/lib/auth/permissions';
import { confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

/**
 * Impostazioni → Gruppi (superadmin): all groups side by side, what each one opens page by page; clicks save
 * themselves. New group, rename, duplicate, delete. Who is in which group is ticked on the Utenti page.
 */
export function GroupsManager() {
    const { users, groups, loading, error, run } = useAccounts();
    const drafts = useGroupDrafts((id, pages) => run(setGroupPagesAction(id, pages)));

    if (loading || error) return <LoadState loading={loading} error={error} />;

    const members = new Map(groups.map((group) => [group.id, users.filter((user) => user.groupIds.includes(group.id)).map((user) => user.name)]));

    const create = (name: string, pages: PagePermissions = {}) => run(createGroupAction(name, pages));

    const remove = async ({ id, name }: Group) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteGroupAction(id));
    };

    return (
        <div className="space-y-4">
            <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-fg-muted md:max-w-xl">{copy.hint}</p>
                <div className="md:w-96 shrink-0">
                    <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={(name) => create(name)} />
                </div>
            </Card>

            {groups.length === 0 ? (
                <EmptyState title={copy.empty} />
            ) : (
                <div className="space-y-2">
                    <div className="h-5 flex justify-end text-xs">
                        {drafts.state === 'saving' && (
                            <span className="flex items-center gap-1.5 text-fg-muted">
                                <Spinner size={12} />
                                {copy.saving}
                            </span>
                        )}
                        {drafts.state === 'saved' && (
                            <span className="flex items-center gap-1 text-success-400">
                                <Check size={14} />
                                {copy.saved}
                            </span>
                        )}
                    </div>
                    <GroupsMatrix
                        groups={groups}
                        pagesOf={drafts.pagesOf}
                        members={members}
                        onChange={(group, pages) => drafts.change(group.id, pages)}
                        onRename={(group, name) => run(renameGroupAction(group.id, name), () => APP_COPY.admin.users.saved)}
                        onDuplicate={(group) => create(fmt(copy.copyName, { name: group.name }), drafts.pagesOf(group))}
                        onDelete={remove}
                    />
                </div>
            )}
        </div>
    );
}
