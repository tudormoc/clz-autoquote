'use client';

import { useState } from 'react';
import {
    createUserAction,
    deleteUserAction,
    newUserPinAction,
    renameUserAction,
    setUserGroupsAction,
    setUserSuspendedAction,
    type UserView,
} from '@/app/access-actions';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { PickList } from '@/components/admin/access/PickList';
import { UserEditor } from '@/components/admin/access/UserEditor';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useAccounts } from '@/hooks/useAccounts';
import { askConfirm, confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

/** Group filter values besides a group id */
const ALL_GROUPS = '';
const WITHOUT_GROUP = 'none';

/**
 * Impostazioni → Utenti (superadmin): the users on the left (search, filter by group), the chosen one on the right:
 * rename, PIN, new PIN, suspend, groups, delete. A new user gets a random PIN (shown here) and opens at once.
 */
export function UsersManager() {
    const { users, groups, loading, error, run } = useAccounts();
    const [chosen, setChosen] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Spinner size={24} className="text-primary" />
            </div>
        );
    }
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;

    const text = search.trim().toLowerCase();
    const shown = users.filter(
        (user) =>
            user.name.toLowerCase().includes(text) &&
            (groupFilter === ALL_GROUPS ||
                (groupFilter === WITHOUT_GROUP ? user.groupIds.length === 0 : user.groupIds.includes(Number(groupFilter))))
    );
    const user = shown.find((candidate) => candidate.id === chosen) ?? shown[0];

    const create = async (name: string) => {
        let id: number | null = null;
        const saved = await run(
            createUserAction(name).then((res) => {
                if (res.success) id = res.id;
                return res;
            }),
            (res) => fmt(copy.created, { name: name.trim(), pin: res.pin })
        );
        if (id !== null) {
            setSearch('');
            setGroupFilter(ALL_GROUPS);
            setChosen(id);
        }
        return saved;
    };

    const newPin = async ({ id, name }: UserView) => {
        if (!(await askConfirm({ title: copy.newPin, message: fmt(copy.newPinConfirm, { name }) }))) return;
        await run(newUserPinAction(id), (res) => fmt(copy.pinReset, { name, pin: res.pin }));
    };

    const suspend = async ({ id, name }: UserView, suspended: boolean) => {
        if (suspended && !(await askConfirm({ title: copy.suspend, message: fmt(copy.suspendConfirm, { name }) }))) return;
        await run(setUserSuspendedAction(id, suspended));
    };

    const remove = async ({ id, name }: UserView) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteUserAction(id));
    };

    return (
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <aside className="w-full lg:w-64 shrink-0 space-y-3">
                {users.length > 0 && (
                    <Card className="p-2 space-y-2">
                        <div className="space-y-2 p-1">
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} aria-label={copy.search} />
                            {groups.length > 0 && (
                                <Select
                                    aria-label={copy.groups}
                                    value={groupFilter}
                                    onChange={(e) => setGroupFilter(e.target.value)}
                                    options={[
                                        { label: copy.allGroups, value: ALL_GROUPS },
                                        ...groups.map((group) => ({ label: group.name, value: String(group.id) })),
                                        { label: copy.withoutGroup, value: WITHOUT_GROUP },
                                    ]}
                                />
                            )}
                        </div>
                        {shown.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-fg-muted">{copy.noMatch}</p>
                        ) : (
                            <PickList
                                items={shown.map(({ id, name, suspended }) => ({ id, label: name, note: suspended ? copy.suspendedTag : undefined }))}
                                selected={user?.id ?? null}
                                onSelect={setChosen}
                            />
                        )}
                    </Card>
                )}
                <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={create} />
            </aside>

            <div className="flex-1 min-w-0 max-w-3xl">
                {user ? (
                    <UserEditor
                        key={user.id}
                        user={user}
                        groups={groups}
                        onRename={(name) => run(renameUserAction(user.id, name), () => copy.saved)}
                        onGroups={(ids) => run(setUserGroupsAction(user.id, ids))}
                        onNewPin={() => newPin(user)}
                        onSuspend={(suspended) => suspend(user, suspended)}
                        onDelete={() => remove(user)}
                    />
                ) : (
                    users.length === 0 && <EmptyState title={copy.empty} />
                )}
            </div>
        </div>
    );
}
