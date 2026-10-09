import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EditableCell } from '@/components/ui/EditableCell';
import { Input } from '@/components/ui/Input';
import type { Group } from '@/lib/auth/accounts';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.groups;

interface GroupHeaderProps {
    group: Group;
    /** Names of its users */
    members: string[];
    onRename: (name: string) => Promise<boolean>;
    onDuplicate: () => void;
    onDelete: () => void;
}

/** Top of a group's column in Gruppi: name (click to change), how many users (names in the tooltip), duplicate, delete. */
export function GroupHeader({ group, members, onRename, onDuplicate, onDelete }: GroupHeaderProps) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-semibold text-fg-strong">
                <EditableCell
                    display={group.name}
                    startValue={() => group.name}
                    renderEditor={(draft, setDraft) => (
                        <div className="w-36">
                            <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                        </div>
                    )}
                    onSave={onRename}
                />
            </div>
            <span className="text-2xs font-normal text-fg-muted" title={members.length > 0 ? members.join(', ') : copy.noMembers}>
                {fmt(copy.members, { count: members.length })}
            </span>
            <div className="flex">
                <Button variant="ghost" size="sm" title={copy.duplicate} aria-label={`${copy.duplicate} ${group.name}`} onClick={onDuplicate}>
                    <Copy size={14} />
                </Button>
                <Button variant="ghost" size="sm" title={APP_COPY.common.delete} aria-label={`${APP_COPY.common.delete} ${group.name}`} onClick={onDelete}>
                    <Trash2 size={14} className="text-danger" />
                </Button>
            </div>
        </div>
    );
}
