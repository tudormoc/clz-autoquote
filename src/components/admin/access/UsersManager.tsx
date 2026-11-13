'use client';

import { useEffect, useRef, useState } from 'react';
import {
    createUserAction,
    deleteUserAction,
    draftPinAction,
    renameUserAction,
    setUserGroupsAction,
    setUserPinAction,
    setUserSuspendedAction,
    unlockUserAction,
    type UserView,
} from '@/app/access-actions';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { NewPinDialog } from '@/components/admin/access/NewPinDialog';
import { PersonCardDialog } from '@/components/admin/access/PersonCardDialog';
import { UsersTable } from '@/components/admin/access/UsersTable';
import { getPersonDriftAction } from '@/app/person-actions';
import { Surface } from '@/components/ui/Surface';
import { Input } from '@/components/ui/Input';
import { LoadState } from '@/components/ui/LoadState';
import { RecordCount } from '@/components/ui/RecordCount';
import { useAccounts } from '@/hooks/useAccounts';
import { useAddress } from '@/hooks/useAddress';
import { numberParam } from '@/lib/address';
import { createGroupTicks } from '@/lib/auth/groupTicks';
import { DEFAULT_PIN_KIND, pinKindLabel, type PinKindId } from '@/lib/auth/pinKinds';
import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

/**
 * Impostazioni → Utenti (superadmin): search, "Nuovo utente" (a 4-digit PIN, shown in a window to copy), and the table
 * of all users where each change is saved at once. The dice next to a PIN rolls a new one of the chosen kind (4 or 6
 * digits, 8 letters and digits, 16 characters), shown the same way; a PIN can also be typed. Either way their open
 * logins end and the person must choose their own PIN at the next login. A user who has to wait after wrong PINs has
 * a lock at the start of the row: a click takes the wait away.
 */
/** The user whose Scheda persona is open, in the address (?person=<id>) */
const VIEW = { person: numberParam() };

export function UsersManager() {
    const { users, groups, loading, error, run, reload } = useAccounts();
    const [search, setSearch] = useState('');
    const view = useAddress(VIEW);
    /** The user whose Scheda persona is open */
    const person = users.find((user) => user.id === view.values.person) ?? null;
    /** Per user id, how many facts differ between the programs; read again whenever the list is */
    const [drift, setDrift] = useState<Record<number, number>>({});

    useEffect(() => {
        if (users.length === 0) return;
        getPersonDriftAction()
            .then((result) => setDrift(result.success ? result.drift : {}))
            .catch(() => setDrift({}));
    }, [users]);
    /** The PIN proposed in the window: nothing is written until Salva (a new user's first PIN is already stored) */
    const [newPin, setNewPin] = useState<{ id: number; name: string; pin: string; storedPin: string; kind: PinKindId } | null>(null);
    /** Group ticks whose save is still on its way (two quick ticks must both count) */
    const ticks = useRef(createGroupTicks());
    useEffect(() => {
        // The table shows the lists just read: a user whose saves are all back starts from what is stored
        ticks.current.readBack();
    }, [users]);

    if (loading || error) return <LoadState loading={loading} error={error} />;

    const text = search.trim().toLowerCase();
    const shown = text ? users.filter((user) => user.name.toLowerCase().includes(text)) : users;

    const create = async (name: string) => {
        const saved = await run(createUserAction(name), (res) => setNewPin({ id: res.id, name: name.trim(), pin: res.pin, storedPin: res.pin, kind: DEFAULT_PIN_KIND }));
        if (saved) setSearch('');
        return saved;
    };

    /** A PIN of the kind proposed for the user, in the window; the stored one stays until Salva */
    const draft = async (kind: PinKindId): Promise<string> => {
        const result = await draftPinAction(kind);
        if (!result.success) throw new Error(result.error);
        return result.pin;
    };

    const rollPin = async ({ id, name, pin }: UserView, kind: PinKindId) => {
        try {
            setNewPin({ id, name, pin: await draft(kind), storedPin: pin, kind });
        } catch (err) {
            notify.failure(err);
        }
    };

    /** Another proposal of the same kind, in the window */
    const rollAgain = async () => {
        if (!newPin) return;
        const pin = await draft(newPin.kind);
        setNewPin((current) => (current ? { ...current, pin } : current));
    };

    /** Writes the proposed PIN: the old one stops working and the user's open logins end */
    const savePin = async (pin: string) => {
        if (!newPin) return false;
        const { id, name } = newPin;
        const saved = await run(setUserPinAction(id, pin), () => fmt(copy.pinReset, { name, pin }));
        if (saved) setNewPin(null);
        return saved;
    };

    const remove = async ({ id, name }: UserView) => {
        if (await confirmDelete(fmt(copy.deleteConfirm, { name }))) await run(deleteUserAction(id));
    };

    /** A tick saves the user's whole list: it starts from the ticks made just before it, not only from the list last read */
    const setGroup = async (user: UserView, groupId: number, member: boolean) => {
        const groupIds = ticks.current.tick(user.id, user.groupIds, groupId, member);
        try {
            return await run(setUserGroupsAction(user.id, groupIds));
        } finally {
            ticks.current.settled(user.id);
        }
    };

    return (
        <div className="space-y-4">
            <Surface className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="md:w-72">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} aria-label={copy.search} />
                </div>
                <div className="md:w-96">
                    <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={create} />
                </div>
            </Surface>

            {groups.length === 0 && <p className="text-sm text-fg-muted">{copy.noGroups}</p>}
            {shown.length > 0 && <RecordCount count={shown.length} />}

            <UsersTable
                users={shown}
                groups={groups}
                emptyMessage={users.length > 0 ? copy.noMatch : copy.empty}
                onRename={(user, name) => run(renameUserAction(user.id, name), () => copy.saved)}
                onSuspend={(user, suspended) => run(setUserSuspendedAction(user.id, suspended))}
                onUnlock={(user) => run(unlockUserAction(user.id), () => fmt(copy.unlocked, { name: user.name }))}
                onGroup={setGroup}
                onNewPin={rollPin}
                onSetPin={(user, pin) => run(setUserPinAction(user.id, pin), (res) => fmt(copy.pinReset, { name: user.name, pin: res.pin }))}
                onDelete={remove}
                personLink={(user) => view.link({ person: user.id })}
                drift={drift}
            />

            {newPin && (
                <NewPinDialog
                    name={newPin.name}
                    pin={newPin.pin}
                    storedPin={newPin.storedPin}
                    kindLabel={pinKindLabel(newPin.kind)}
                    onReroll={rollAgain}
                    onSave={savePin}
                    onClose={() => setNewPin(null)}
                />
            )}
            {person && <PersonCardDialog user={person} onSaved={reload} onClose={() => view.set({ person: null })} />}
        </div>
    );
}
