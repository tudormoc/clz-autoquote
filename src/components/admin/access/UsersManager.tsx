'use client';

import { useState } from 'react';
import { createUserAction, deleteUserAction, newUserPinAction, renameUserAction, setUserGroupsAction } from '@/app/access-actions';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { UserCard } from '@/components/admin/access/UserCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { useAccounts } from '@/hooks/useAccounts';
import { askConfirm, confirmDelete } from '@/lib/confirm';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

/**
 * Impostazioni → Utenti (superadmin): create a user (the app picks a random PIN, shown here), rename, tick groups,
 * new PIN, delete. Each user shows what their groups let them see and change.
 */
export function UsersManager() {
    const { users, groups, loading, error, run } = useAccounts();
    const [newGroups, setNewGroups] = useState<ReadonlySet<number>>(new Set());

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Spinner size={24} className="text-primary" />
            </div>
        );
    }
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;

    const create = async (name: string) => {
        const saved = await run(createUserAction(name, Array.from(newGroups)), (res) => fmt(copy.created, { name: name.trim(), pin: res.pin }));
        if (saved) setNewGroups(new Set());
        return saved;
    };

    const newPin = async (id: number, name: string) => {
        if (!(await askConfirm({ title: copy.newPin, message: fmt(copy.newPinConfirm, { name }) }))) return;
        await run(newUserPinAction(id), (res) => fmt(copy.pinReset, { name, pin: res.pin }));
    };

    const remove = async (id: number, name: string) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteUserAction(id));
    };

    return (
        <div className="space-y-4 max-w-4xl">
            <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={create}>
                {groups.length > 0 && (
                    <ToggleChips
                        label={copy.groups}
                        options={groups.map((group) => ({ key: group.id, label: group.name }))}
                        active={newGroups}
                        onToggle={(id) => setNewGroups(toggleInSet(newGroups, id))}
                    />
                )}
            </NewNameForm>

            {users.length === 0 ? (
                <EmptyState title={copy.empty} />
            ) : (
                users.map((user) => (
                    <UserCard
                        key={user.id}
                        user={user}
                        groups={groups}
                        onRename={(name) => run(renameUserAction(user.id, name), () => copy.saved)}
                        onGroups={(ids) => run(setUserGroupsAction(user.id, ids))}
                        onNewPin={() => newPin(user.id, user.name)}
                        onDelete={() => remove(user.id, user.name)}
                    />
                ))
            )}
        </div>
    );
}
