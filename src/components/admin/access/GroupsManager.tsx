'use client';

import { createGroupAction, deleteGroupAction, renameGroupAction, setGroupPagesAction } from '@/app/access-actions';
import { GroupCards } from '@/components/admin/access/GroupCards';
import { GroupEditor } from '@/components/admin/access/GroupEditor';
import { NewNameForm } from '@/components/admin/access/NewNameForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadState } from '@/components/ui/LoadState';
import { useAccounts } from '@/hooks/useAccounts';
import { useAddress } from '@/hooks/useAddress';
import { useGroupDrafts } from '@/hooks/useGroupDrafts';
import { numberParam } from '@/lib/address';
import type { Group } from '@/lib/auth/accounts';
import type { PagePermissions } from '@/lib/auth/permissions';
import { confirmDelete } from '@/lib/confirm';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

/** The group being worked on, in the address (?group=<id>) */
const VIEW = { group: numberParam() };

/**
 * Impostazioni → Gruppi (superadmin): the groups as cards, and the one picked with everything it can do as lights
 * that are on or off (GroupEditor); clicks save themselves and "Annulla" takes the last one back. New group, rename,
 * duplicate, delete. Who is in which group is ticked on the Utenti page.
 */
export function GroupsManager() {
    const { users, groups, loading, error, run } = useAccounts();
    const drafts = useGroupDrafts((id, pages) => run(setGroupPagesAction(id, pages)));
    /** The group being worked on; none picked yet (or it was deleted) = the first */
    const view = useAddress(VIEW);
    const selectedId = view.values.group;
    const setSelectedId = (id: number) => view.set({ group: id });

    if (loading || error) return <LoadState loading={loading} error={error} />;

    const selected = groups.find((group) => group.id === selectedId) ?? groups[0];
    const members = new Map(groups.map((group) => [group.id, users.filter((user) => user.groupIds.includes(group.id)).map((user) => user.name)]));

    /** A new group becomes the one being worked on */
    const create = (name: string, pages: PagePermissions = {}) => run(createGroupAction(name, pages), (result) => setSelectedId(result.id));

    const remove = async ({ id, name }: Group) => {
        if (!(await confirmDelete(fmt(copy.deleteConfirm, { name })))) return;
        drafts.forget(id);
        await run(deleteGroupAction(id));
    };

    /** Takes the last click back and shows the group it was made on */
    const undo = () => {
        const id = drafts.undo();
        if (id !== null) setSelectedId(id);
    };

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start">
            <div className="space-y-3">
                <NewNameForm placeholder={copy.namePlaceholder} buttonLabel={copy.add} onSubmit={(name) => create(name)} />
                {selected && (
                    <GroupCards groups={groups} selectedId={selected.id} pagesOf={drafts.pagesOf} members={members} linkOf={(group) => view.link({ group: group.id })} />
                )}
            </div>
            {selected ? (
                <GroupEditor
                    group={selected}
                    pages={drafts.pagesOf(selected)}
                    members={members.get(selected.id) ?? []}
                    saveState={drafts.state}
                    canUndo={drafts.canUndo}
                    onChange={(pages) => drafts.change(selected, pages)}
                    onUndo={undo}
                    onRename={(name) => run(renameGroupAction(selected.id, name), () => APP_COPY.admin.users.saved)}
                    onDuplicate={() => create(fmt(copy.copyName, { name: selected.name }), drafts.pagesOf(selected))}
                    onDelete={() => remove(selected)}
                />
            ) : (
                <EmptyState title={copy.empty} />
            )}
        </div>
    );
}
