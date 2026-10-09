'use client';

import { useMemo } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import type { UserView } from '@/app/access-actions';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useClientSort } from '@/hooks/useClientSort';
import type { Group } from '@/lib/auth/accounts';
import { mergePermissions, pageLabels, type PagePermissions } from '@/lib/auth/permissions';
import { EMPTY_VALUE, formatDbDateTime } from '@/lib/format';
import { compareValues, type RowSortColumns } from '@/lib/sort';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.users;

const groupKey = (id: number) => `group:${id}`;
const byName = (a: UserView, b: UserView) => compareValues(a.name, b.name);
const countPages = (pages: PagePermissions | undefined) => Object.keys(pages ?? {}).length;

/** "Modifica: … / Vede: …" for the tooltip of the pages count */
function pagesTooltip(pages: PagePermissions): string {
    const lines = [
        [copy.edits, pageLabels(pages, 'edit')],
        [copy.sees, pageLabels(pages, 'view')],
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
    onNewPin: (user: UserView) => void;
    onDelete: (user: UserView) => void;
}

/**
 * All users in one table, every column sortable: name (click to change), active switch, a tick per group, how many
 * pages their groups open, last login, PIN with "Nuovo PIN", delete. On phones one card per user.
 */
export function UsersTable({ users, groups, emptyMessage, onRename, onSuspend, onGroup, onNewPin, onDelete }: UsersTableProps) {
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

    const columns: DataTableColumn<UserView>[] = [
        { key: 'name', header: copy.columns.name, mobileHidden: true, cellClassName: 'font-medium text-fg-strong', cell: nameCell },
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
                    <span className="font-mono text-fg-strong">{user.pin || EMPTY_VALUE}</span>
                    <Button variant="ghost" size="sm" title={copy.newPin} aria-label={copy.newPin} onClick={() => onNewPin(user)}>
                        <KeyRound size={14} />
                    </Button>
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
