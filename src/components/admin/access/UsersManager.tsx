'use client';

import { useEffect, useState } from 'react';
import {
    createUserAction,
    deleteUserAction,
    newUserPinAction,
    renameUserAction,
    setUserGroupsAction,
    setUserPinAction,
    setUserSuspendedAction,
    type UserView,
} from '@/app/access-actions';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { NewPinDialog } from '@/components/admin/access/NewPinDialog';
import { PersonCardDialog } from '@/components/admin/access/PersonCardDialog';
import { UsersTable } from '@/components/admin/access/UsersTable';
import { getPersonDriftAction } from '@/app/person-actions';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { LoadState } from '@/components/ui/LoadState';
import { RecordCount } from '@/components/ui/RecordCount';
import { useAccounts } from '@/hooks/useAccounts';
import { DEFAULT_PIN_KIND, pinKindLabel, type PinKindId } from '@/lib/auth/pinKinds';
import { askConfirm, confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

/**
 * Impostazioni → Utenti (superadmin): search, "Nuovo utente" (a 4-digit PIN, shown in a window to copy), and the table
 * of all users where each change is saved at once. The dice next to a PIN rolls a new one of the chosen kind (4 or 6
 * digits, 8 letters and digits, 16 characters), shown the same way; a PIN can also be typed. Either way their open
 * logins end and the person must choose their own PIN at the next login.
 */
export function UsersManager() {
    const { users, groups, loading, error, run, reload } = useAccounts();
    const [search, setSearch] = useState('');
    /** The user whose Scheda persona is open */
    const [person, setPerson] = useState<UserView | null>(null);
    /** Per user id, how many facts differ between the programs; read again whenever the list is */
    const [drift, setDrift] = useState<Record<number, number>>({});

    useEffect(() => {
        if (users.length === 0) return;
        getPersonDriftAction()
            .then((result) => setDrift(result.success ? result.drift : {}))
            .catch(() => setDrift({}));
    }, [users]);
    /** The PIN just given out, open in its window until closed; "Un altro" draws again for the same user and kind */
    const [newPin, setNewPin] = useState<{ id: number; name: string; pin: string; kind: PinKindId } | null>(null);

    if (loading || error) return <LoadState loading={loading} error={error} />;

    const text = search.trim().toLowerCase();
    const shown = text ? users.filter((user) => user.name.toLowerCase().includes(text)) : users;

    const create = async (name: string) => {
        const saved = await run(createUserAction(name), (res) => setNewPin({ id: res.id, name: name.trim(), pin: res.pin, kind: DEFAULT_PIN_KIND }));
        if (saved) setSearch('');
        return saved;
    };

    const rollPin = async ({ id, name }: UserView, kind: PinKindId) => {
        if (!(await askConfirm({ title: copy.newPin, message: fmt(copy.newPinConfirm, { name }) }))) return;
        await run(newUserPinAction(id, kind), (res) => setNewPin({ id, name, pin: res.pin, kind }));
    };

    /** Another PIN of the same kind for the user in the window (the one shown was never handed out, so no question) */
    const rollAgain = async () => {
        if (!newPin) return;
        const { id, kind } = newPin;
        await run(newUserPinAction(id, kind), (res) => setNewPin((current) => (current ? { ...current, pin: res.pin } : current)));
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
                onNewPin={rollPin}
                onSetPin={(user, pin) => run(setUserPinAction(user.id, pin), (res) => fmt(copy.pinReset, { name: user.name, pin: res.pin }))}
                onDelete={remove}
                onPerson={setPerson}
                drift={drift}
            />

            {newPin && <NewPinDialog name={newPin.name} pin={newPin.pin} kindLabel={pinKindLabel(newPin.kind)} onReroll={rollAgain} onClose={() => setNewPin(null)} />}
            {person && <PersonCardDialog user={person} onSaved={reload} onClose={() => setPerson(null)} />}
        </div>
    );
}
