'use client';

import { createGroupAction, deleteGroupAction, renameGroupAction, setGroupPagesAction } from '@/app/access-actions';
import { GroupCard } from '@/components/admin/access/GroupCard';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useAccounts } from '@/hooks/useAccounts';
import { confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

/** Impostazioni → Gruppi (superadmin): create, rename, delete groups and choose what each sees or changes. */
export function GroupsManager() {
    const { users, groups, loading, error, run } = useAccounts();

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Spinner size={24} className="text-primary" />
            </div>
        );
    }
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;

    const remove = async (id: number, name: string) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteGroupAction(id));
    };

    return (
        <div className="space-y-4">
            <div className="max-w-4xl">
                <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={(name) => run(createGroupAction(name))} />
            </div>

            {groups.length === 0 ? (
                <EmptyState title={copy.empty} />
            ) : (
                groups.map((group) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        members={users.filter((user) => user.groupIds.includes(group.id)).length}
                        onRename={(name) => run(renameGroupAction(group.id, name), () => APP_COPY.admin.users.saved)}
                        onPages={(pages) => run(setGroupPagesAction(group.id, pages))}
                        onDelete={() => remove(group.id, group.name)}
                    />
                ))
            )}
        </div>
    );
}
