'use client';

import { useState } from 'react';
import { createGroupAction, deleteGroupAction, renameGroupAction, setGroupPagesAction } from '@/app/access-actions';
import { GroupEditor } from '@/components/admin/access/GroupEditor';
import { GroupList } from '@/components/admin/access/GroupList';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useAccounts } from '@/hooks/useAccounts';
import type { PagePermissions } from '@/lib/auth/permissions';
import { confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

/**
 * Impostazioni → Gruppi (superadmin): the groups on the left, the chosen one on the right with one tick per page,
 * per area or for all pages at once. New group, duplicate, rename, delete.
 */
export function GroupsManager() {
    const { users, groups, loading, error, run } = useAccounts();
    const [chosen, setChosen] = useState<number | null>(null);

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Spinner size={24} className="text-primary" />
            </div>
        );
    }
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;

    const members = new Map(groups.map((group) => [group.id, users.filter((user) => user.groupIds.includes(group.id)).length]));
    const group = groups.find((candidate) => candidate.id === chosen) ?? groups[0];

    /** Creates a group (empty or a copy) and opens it */
    const create = async (name: string, pages: PagePermissions = {}) => {
        let id: number | null = null;
        const saved = await run(
            createGroupAction(name, pages).then((res) => {
                if (res.success) id = res.id;
                return res;
            })
        );
        if (id !== null) setChosen(id);
        return saved;
    };

    const remove = async (id: number, name: string) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteGroupAction(id));
    };

    return (
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <aside className="w-full lg:w-64 shrink-0 space-y-3">
                {groups.length > 0 && (
                    <Card className="p-2">
                        <GroupList groups={groups} members={members} selected={group?.id ?? null} onSelect={setChosen} />
                    </Card>
                )}
                <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={(name) => create(name)} />
            </aside>

            {/* Not wider than this, so a page name and its ticks stay close */}
            <div className="flex-1 min-w-0 max-w-3xl">
                {group ? (
                    <GroupEditor
                        key={group.id}
                        group={group}
                        members={members.get(group.id) ?? 0}
                        onRename={(name) => run(renameGroupAction(group.id, name), () => APP_COPY.admin.users.saved)}
                        onPages={(pages) => run(setGroupPagesAction(group.id, pages))}
                        onDuplicate={(pages) => create(fmt(copy.copyName, { name: group.name }), pages)}
                        onDelete={() => remove(group.id, group.name)}
                    />
                ) : (
                    <EmptyState title={copy.empty} />
                )}
            </div>
        </div>
    );
}
