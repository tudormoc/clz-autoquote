import Link from 'next/link';
import type { NavGroup } from '@/config/navigation';
import { pressableSurfaceClasses } from '@/components/ui/SurfaceButton';
import { IconTile } from '@/components/ui/IconTile';
import { titleClasses } from '@/components/ui/titleLook';

/** One link card per page (icon, name) under the group headings: home page and area overview pages. */
export function NavCards({ groups }: { groups: NavGroup[] }) {
    return (
        <div className="space-y-6">
            {groups.map((group, index) => (
                <section key={group.label ?? index}>
                    {group.label && <h2 className={titleClasses('section', 'mb-3')}>{group.label}</h2>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                        {group.items.map(({ id, href, label, icon: Icon }) => (
                            <Link
                                key={id}
                                href={href}
                                className={pressableSurfaceClasses({}, 'group flex items-center gap-3 p-4')}
                            >
                                <IconTile>
                                    <Icon size={20} />
                                </IconTile>
                                <span className="min-w-0 font-semibold text-fg-strong">{label}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
