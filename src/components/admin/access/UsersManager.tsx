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
import { UsersTable } from '@/components/admin/access/UsersTable';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { RecordCount } from '@/components/ui/RecordCount';
import { Spinner } from '@/components/ui/Spinner';
import { useAccounts } from '@/hooks/useAccounts';
import { askConfirm, confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

/**
 * Impostazioni → Utenti (superadmin): search, "Nuovo utente" (the app picks a random PIN, shown here), and the table
 * of all users where each change is saved at once.
 */
export function UsersManager() {
    const { users, groups, loading, error, run } = useAccounts();
    const [search, setSearch] = useState('');

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Spinner size={24} className="text-primary" />
            </div>
        );
    }
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;

    const text = search.trim().toLowerCase();
    const shown = text ? users.filter((user) => user.name.toLowerCase().includes(text)) : users;

    const create = async (name: string) => {
        const saved = await run(createUserAction(name), (res) => fmt(copy.created, { name: name.trim(), pin: res.pin }));
        if (saved) setSearch('');
        return saved;
    };

    const newPin = async ({ id, name }: UserView) => {
        if (!(await askConfirm({ title: copy.newPin, message: fmt(copy.newPinConfirm, { name }) }))) return;
        await run(newUserPinAction(id), (res) => fmt(copy.pinReset, { name, pin: res.pin }));
    };

    const remove = async ({ id, name }: UserView) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteUserAction(id));
    };

    const setGroup = (user: UserView, groupId: number, member: boolean) =>
        run(setUserGroupsAction(user.id, member ? [...user.groupIds, groupId] : user.groupIds.filter((id) => id !== groupId)));

    return (
        <div className="space-y-4">
            <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="md:w-72">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} aria-label={copy.search} />
                </div>
                <div className="md:w-96">
                    <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={create} />
                </div>
            </Card>

            {groups.length === 0 && <p className="text-sm text-fg-muted">{copy.noGroups}</p>}
            {shown.length > 0 && <RecordCount count={shown.length} />}

            <UsersTable
                users={shown}
                groups={groups}
                emptyMessage={users.length > 0 ? copy.noMatch : copy.empty}
                onRename={(user, name) => run(renameUserAction(user.id, name), () => copy.saved)}
                onSuspend={(user, suspended) => run(setUserSuspendedAction(user.id, suspended))}
                onGroup={setGroup}
                onNewPin={newPin}
                onDelete={remove}
            />
        </div>
    );
}
