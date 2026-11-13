import Link from 'next/link';
import { isWithin, type NavGroup } from '@/config/navigation';
import { menuRowClasses } from '@/components/ui/MenuRow';

interface SidebarPagesProps {
    groups: NavGroup[];
    pathname: string;
    onNavigate?: () => void;
}

/** Page links of one area under their group headings, the current page highlighted. */
export function SidebarPages({ groups, pathname, onNavigate }: SidebarPagesProps) {
    return (
        <div className="space-y-1.5">
            {groups.map((group, index) => (
                <div key={group.label ?? index}>
                    {group.label && <p className="px-2 pt-1 pb-0.5 text-xs text-fg-subtle">{group.label}</p>}
                    {group.items.map((item) => {
                        const active = isWithin(pathname, item.href);
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                onClick={onNavigate}
                                aria-current={active ? 'page' : undefined}
                                className={menuRowClasses({ selected: active, quiet: true }, 'h-9 lg:h-8 px-2 py-0 rounded-md')}
                            >
                                <span className="truncate">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
