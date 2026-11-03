'use client';

import { useMemo } from 'react';
import { Dices, Trash2, UserRound } from 'lucide-react';
import type { UserView } from '@/app/access-actions';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useClientSort } from '@/hooks/useClientSort';
import type { Group } from '@/lib/auth/accounts';
import { PIN_KIND_OPTIONS, type PinKindId } from '@/lib/auth/pinKinds';
import { functionLabels, isFunctionKey, mergePermissions, pageLabels, type PagePermissions } from '@/lib/auth/permissions';
import { EMPTY_VALUE, formatDbDateTime } from '@/lib/format';
import { compareValues, type RowSortColumns } from '@/lib/sort';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

const groupKey = (id: number) => `group:${id}`;
const byName = (a: UserView, b: UserView) => compareValues(a.name, b.name);
/** Pages only: a function of a page is not a page */
const countPages = (pages: PagePermissions | undefined) => Object.keys(pages ?? {}).filter((key) => !isFunctionKey(key)).length;

/** "Modifica: … / Vede: … / Funzioni: …" for the tooltip of the pages count */
function pagesTooltip(pages: PagePermissions): string {
    const lines = [
        [copy.edits, pageLabels(pages, 'edit')],
        [copy.sees, pageLabels(pages, 'view')],
        [copy.uses, functionLabels(pages)],
    ] as const;
    const text = lines.filter(([, labels]) => labels.length > 0).map(([level, labels]) => `${level}: ${labels.join(', ')}`);
    return text.length > 0 ? text.join('\n') : copy.nothing;
}

interface UsersTableProps {
    users: UserView[];
    groups: Group[];
    emptyMessage: string;
    onRename: (user: UserView, name: string) => Promise<boolean>;
    onSuspend: (user: UserView, suspended: boolean) => void;
    /** Puts the user in the group (true) or takes them out */
    onGroup: (user: UserView, groupId: number, member: boolean) => void;
    /** Rolls a new random PIN of the kind (the dice next to the PIN) */
    onNewPin: (user: UserView, kind: PinKindId) => void;
    /** Saves a PIN typed by the superadmin; true when saved */
    onSetPin: (user: UserView, pin: string) => Promise<boolean>;
    onDelete: (user: UserView) => void;
    /** Opens the Scheda persona */
    onPerson: (user: UserView) => void;
    /** Per user id, how many facts differ between the programs (the "≠"); missing = none or not linked */
    drift: Record<number, number>;
}

/**
 * All users in one table, every column sortable: name (click to change), the person behind it (Scheda persona, with
 * "≠" when their data differ between the programs), active switch, a tick per group, how many pages their groups open,
 * last login, PIN (click to type one; the dice rolls a random one of the chosen kind), delete. On phones one card per user.
 */
export function UsersTable({ users, groups, emptyMessage, onRename, onSuspend, onGroup, onNewPin, onSetPin, onDelete, onPerson, drift }: UsersTableProps) {
    const pagesOf = useMemo(
        () => new Map(users.map((user) => [user.id, mergePermissions(groups.filter((group) => user.groupIds.includes(group.id)).map((group) => group.pages))])),
        [users, groups]
    );
    const pageCount = (user: UserView) => countPages(pagesOf.get(user.id));

    const sortColumns = useMemo<RowSortColumns<UserView>>(
        () => ({
            name: (user) => user.name,
            active: (user) => (user.suspended ? 1 : 0),
            // Members first
            ...Object.fromEntries(groups.map((group) => [groupKey(group.id), (user: UserView) => (user.groupIds.includes(group.id) ? 0 : 1)])),
            pages: (user) => countPages(pagesOf.get(user.id)),
            lastLogin: (user) => (user.lastLogin ? new Date(user.lastLogin).getTime() : null),
        }),
        [groups, pagesOf]
    );
    const { sorted, sort, toggleSort } = useClientSort(users, sortColumns, { column: 'name', direction: 'asc' }, byName);

    const nameCell = (user: UserView) => (
        <EditableCell
            display={user.name}
            startValue={() => user.name}
            renderEditor={(draft, setDraft) => (
                <div className="w-48">
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                </div>
            )}
            onSave={(name) => onRename(user, name)}
        />
    );
    const deleteButton = (user: UserView) => (
        <Button variant="ghost" size="sm" title={APP_COPY.common.delete} aria-label={APP_COPY.common.delete} onClick={() => onDelete(user)}>
            <Trash2 size={16} className="text-danger" />
        </Button>
    );

    const personButton = (user: UserView) => {
        const count = drift[user.id] ?? 0;
        return (
            <Button variant="ghost" size="sm" title={count > 0 ? fmt(APP_COPY.admin.person.driftBadge, { count }) : APP_COPY.admin.person.open} onClick={() => onPerson(user)}>
                <UserRound size={16} className={count > 0 ? 'text-warning-400' : undefined} />
                {count > 0 && <span className="text-2xs font-medium text-warning-400">≠ {count}</span>}
            </Button>
        );
    };

    const columns: DataTableColumn<UserView>[] = [
        { key: 'name', header: copy.columns.name, mobileHidden: true, cellClassName: 'font-medium text-fg-strong', cell: nameCell },
        { key: 'person', header: copy.columns.person, sortable: false, compact: true, className: 'w-20', cell: personButton },
        {
            key: 'active',
            header: copy.columns.active,
            align: 'center',
            className: 'w-24',
            cell: (user) => (
                <Switch
                    checked={!user.suspended}
                    onChange={(active) => onSuspend(user, !active)}
                    label={fmt(user.suspended ? copy.resumeUser : copy.suspendUser, { name: user.name })}
                />
            ),
        },
        ...groups.map(
            (group): DataTableColumn<UserView> => ({
                key: groupKey(group.id),
                header: group.name,
                headerTitle: fmt(copy.groupColumn, { group: group.name }),
                mobileLabel: fmt(copy.groupColumn, { group: group.name }),
                align: 'center',
                cell: (user) => (
                    <div className="inline-flex align-middle">
                        <Checkbox
                            checked={user.groupIds.includes(group.id)}
                            onChange={(e) => onGroup(user, group.id, e.target.checked)}
                            aria-label={fmt(copy.inGroup, { name: user.name, group: group.name })}
                        />
                    </div>
                ),
            })
        ),
        {
            key: 'pages',
            header: copy.columns.pages,
            headerTitle: copy.pagesHint,
            variant: 'number',
            cell: (user) => (
                <span title={pagesTooltip(pagesOf.get(user.id) ?? {})} className={pageCount(user) === 0 ? 'text-warning-300' : undefined}>
                    {pageCount(user)}
                </span>
            ),
        },
        {
            key: 'lastLogin',
            header: copy.columns.lastLogin,
            cellClassName: 'whitespace-nowrap text-fg-secondary',
            cell: (user) => (user.lastLogin ? formatDbDateTime(user.lastLogin) : <span className="text-fg-faint">{copy.never}</span>),
        },
        {
            key: 'pin',
            header: copy.pin,
            sortable: false,
            cell: (user) => (
                <div className="inline-flex items-center gap-1">
                    <span className="font-mono text-fg-strong">
                        <EditableCell
                            display={user.pin || EMPTY_VALUE}
                            startValue={() => user.pin}
                            renderEditor={(draft, setDraft) => (
                                <div className="w-32">
                                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={copy.pin} className="font-mono" autoFocus />
                                </div>
                            )}
                            // The same PIN again would still end their open logins: nothing to save
                            onSave={async (pin) => pin.trim() === user.pin || onSetPin(user, pin)}
                        />
                    </span>
                    {user.mustChangePin && (
                        <span className="text-2xs text-fg-muted" title={copy.provisionalHint}>
                            {copy.provisional}
                        </span>
                    )}
                    <ActionMenu
                        icon={Dices}
                        label={copy.newPin}
                        actions={PIN_KIND_OPTIONS.map((kind) => ({ label: kind.label, onSelect: () => onNewPin(user, kind.value) }))}
                    />
                </div>
            ),
        },
        { key: 'delete', header: '', sortable: false, compact: true, mobileHidden: true, className: 'w-12', cell: deleteButton },
    ];

    return (
        <DataTable
            columns={columns}
            rows={sorted}
            getRowKey={(user) => user.id}
            getRowClassName={(user) => (user.suspended ? 'bg-warning-500/5' : undefined)}
            sort={sort}
            onSort={toggleSort}
            emptyMessage={emptyMessage}
            mobileTitle={(user) => (
                <div className="flex items-center justify-between gap-2 font-medium text-fg-strong">
                    {nameCell(user)}
                    {deleteButton(user)}
                </div>
            )}
        />
    );
}
