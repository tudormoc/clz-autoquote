'use client';

import { useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { getContactsAction, setContactStateAction } from '@/app/tasks/guide-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { ContactDialog } from '@/components/tasks/contacts/ContactDialog';
import { LoadState } from '@/components/ui/LoadState';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { MissingValue } from '@/components/ui/TableCells';
import { useActionData } from '@/hooks/useActionData';
import { useAddress } from '@/hooks/useAddress';
import { useAddressText } from '@/hooks/useAddressText';
import { useClientSort } from '@/hooks/useClientSort';
import { flagParam, textParam } from '@/lib/address';
import { askConfirm } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import type { RowSortColumns } from '@/lib/sort';
import { linkHref } from '@/lib/tasks/links';
import type { Contact } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';
import { Surface } from '@/components/ui/Surface';

const copy = APP_COPY.tasks.contacts;

const SORT_COLUMNS: RowSortColumns<Contact> = {
    name: (contact) => contact.name,
    company: (contact) => contact.company,
    role: (contact) => contact.role,
    phone: (contact) => contact.phone,
    email: (contact) => contact.email,
    used: (contact) => contact.taskCount + contact.guideCount,
};

/** The text searched (also a name picked in the search bar on top) and "Mostra archiviati", in the address */
const VIEW = { q: textParam(), archived: flagParam() };

/** "Contatti": people and companies to call or write, shared by tasks and procedures; new / change in a window */
export function ContactsView() {
    const { data, loading, error, reload } = useActionData(getContactsAction);
    const canEdit = useCanEdit();
    const view = useAddress(VIEW);
    const [search, setSearch] = useAddressText(view.values.q, (text) => view.set({ q: text }, 'replace'));
    const showArchived = view.values.archived;
    const [editing, setEditing] = useState<Contact | 'new' | null>(null);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (data?.contacts ?? []).filter(
            (contact) =>
                (showArchived || contact.state === 'active') &&
                (!term || [contact.name, contact.company, contact.role, contact.phone, contact.email, contact.notes].join(' ').toLowerCase().includes(term))
        );
    }, [data, search, showArchived]);
    const { sorted, sort, toggleSort } = useClientSort(visible, SORT_COLUMNS, { column: 'name', direction: 'asc' });
    if (!data) return <LoadState loading={loading} error={error} />;

    const changeState = async (contact: Contact) => {
        const archive = contact.state === 'active';
        if (archive && !(await askConfirm({ title: contact.name, message: fmt(copy.archiveConfirm, { name: contact.name }) }))) return;
        try {
            const result = await setContactStateAction(contact.id, contact.version, archive ? 'archived' : 'active');
            if (result.success) notify.success(archive ? APP_COPY.tasks.messages.archived : APP_COPY.tasks.messages.restored);
            else notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
        await reload();
    };

    const link = (kind: 'phone' | 'email', value: string) => {
        if (!value) return <MissingValue />;
        const href = linkHref({ kind, label: '', value });
        return href ? (
            <a href={href} className="text-primary hover:underline break-all">
                {value}
            </a>
        ) : (
            value
        );
    };

    const columns: DataTableColumn<Contact>[] = [
        {
            key: 'name',
            header: copy.columns.name,
            mobileHidden: true,
            cell: (contact) => (
                <div>
                    <span className="font-medium text-fg-strong">{contact.name}</span>
                    {contact.state === 'archived' && <span className="ml-2 text-2xs text-fg-faint">{APP_COPY.tasks.states.archived}</span>}
                    {contact.notes && <div className="text-2xs text-fg-subtle truncate max-w-xs" title={contact.notes}>{contact.notes}</div>}
                </div>
            ),
        },
        { key: 'company', header: copy.columns.company, cell: (contact) => contact.company || <MissingValue /> },
        { key: 'role', header: copy.columns.role, cell: (contact) => contact.role || <MissingValue /> },
        { key: 'phone', header: copy.columns.phone, cellClassName: 'whitespace-nowrap', cell: (contact) => link('phone', contact.phone) },
        { key: 'email', header: copy.columns.email, cell: (contact) => link('email', contact.email) },
        { key: 'used', header: copy.columns.used, cellClassName: 'text-xs text-fg-subtle whitespace-nowrap', cell: (contact) => fmt(copy.used, { tasks: contact.taskCount, guides: fmt(contact.guideCount === 1 ? copy.guidesCount.one : copy.guidesCount.many, { n: contact.guideCount }) }) },
        ...(canEdit
            ? [
                  {
                      key: 'actions',
                      header: '',
                      sortable: false,
                      align: 'right' as const,
                      cell: (contact: Contact) => (
                          <ActionMenu
                              actions={[
                                  { label: APP_COPY.tasks.actions.edit, icon: Pencil, onSelect: () => setEditing(contact) },
                                  contact.state === 'active'
                                      ? { label: APP_COPY.tasks.actions.archive, icon: Archive, tone: 'danger' as const, onSelect: () => changeState(contact) }
                                      : { label: APP_COPY.tasks.actions.restore, icon: RotateCcw, onSelect: () => changeState(contact) },
                              ]}
                          />
                      ),
                  },
              ]
            : []),
    ];

    return (
        <div className="flex flex-col gap-4 lg:h-full">
            <Surface className="p-4 flex flex-wrap items-end gap-3">
                <Field label={APP_COPY.tasks.filters.search} className="w-full sm:w-64">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={APP_COPY.common.search} />
                </Field>
                <div className="pb-2">
                    <Checkbox id="contacts-archived" label={APP_COPY.tasks.guides.showArchived} checked={showArchived} onChange={(e) => view.set({ archived: e.target.checked }, 'replace')} />
                </div>
                {canEdit && (
                    <Button className="sm:ml-auto" onClick={() => setEditing('new')}>
                        <Plus size={16} />
                        {copy.new}
                    </Button>
                )}
            </Surface>
            <DataTable
                fill
                columns={columns}
                rows={sorted}
                getRowKey={(contact) => contact.id}
                sort={sort}
                onSort={toggleSort}
                emptyMessage={data.contacts.length === 0 ? copy.empty : copy.noMatch}
                mobileTitle={(contact) => <span className="font-medium text-fg-strong">{contact.name}</span>}
            />
            {editing && <ContactDialog contact={editing === 'new' ? null : editing} onSaved={reload} onClose={() => setEditing(null)} />}
        </div>
    );
}
