import { X } from 'lucide-react';
import type { UserView } from '@/app/access-actions';
import { Select } from '@/components/ui/Select';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

interface GroupMembersProps {
    members: UserView[];
    /** Users not in the group, to add */
    others: UserView[];
    onAdd: (user: UserView) => void;
    onRemove: (user: UserView) => void;
}

/** The users of a group: a name with × takes them out, "Aggiungi utente…" puts one in. */
export function GroupMembers({ members, others, onAdd, onRemove }: GroupMembersProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="mr-1 text-fg-muted">{fmt(copy.members, { count: members.length })}:</span>
            {members.length === 0 && <span className="mr-1 text-fg-muted">{copy.noMembers}</span>}
            {members.map((user) => {
                const remove = fmt(copy.removeMember, { name: user.name });
                return (
                    <span key={user.id} className="inline-flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded bg-muted text-xs font-medium text-fg-secondary">
                        {user.name}
                        {user.suspended && <span className="font-normal text-warning-300">· {APP_COPY.admin.users.suspendedTag}</span>}
                        <button
                            type="button"
                            onClick={() => onRemove(user)}
                            aria-label={remove}
                            title={remove}
                            className="p-0.5 rounded text-fg-muted hover:text-danger hover:bg-muted-strong"
                        >
                            <X size={12} />
                        </button>
                    </span>
                );
            })}
            {others.length > 0 && (
                <div className="w-48">
                    <Select
                        aria-label={copy.addMember}
                        value=""
                        onChange={(event) => {
                            const user = others.find((other) => String(other.id) === event.target.value);
                            if (user) onAdd(user);
                        }}
                        options={[{ label: copy.addMember, value: '' }, ...others.map((user) => ({ label: user.name, value: String(user.id) }))]}
                    />
                </div>
            )}
        </div>
    );
}
