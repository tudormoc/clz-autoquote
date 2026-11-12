import { Mail, Phone, UserRound } from 'lucide-react';
import { linkHref } from '@/lib/tasks/links';
import type { Contact } from '@/lib/tasks/types';
import { Surface } from '@/components/ui/Surface';

/** One contact: name, role and company, phone and email clickable, notes */
function ContactCard({ contact }: { contact: Contact }) {
    const phone = contact.phone ? linkHref({ kind: 'phone', label: '', value: contact.phone }) : null;
    const email = contact.email ? linkHref({ kind: 'email', label: '', value: contact.email }) : null;
    const who = [contact.role, contact.company].filter(Boolean).join(' · ');

    return (
        <div className="flex items-start gap-2.5 px-3 py-2">
            <UserRound size={16} className="mt-0.5 shrink-0 text-fg-muted" />
            <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-fg-strong">{contact.name}</p>
                {who && <p className="text-xs text-fg-muted">{who}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    {contact.phone && (
                        <a href={phone ?? undefined} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Phone size={12} />
                            {contact.phone}
                        </a>
                    )}
                    {contact.email && (
                        <a href={email ?? undefined} className="inline-flex items-center gap-1 text-primary hover:underline break-all">
                            <Mail size={12} />
                            {contact.email}
                        </a>
                    )}
                </div>
                {contact.notes && <p className="text-xs text-fg-subtle whitespace-pre-line">{contact.notes}</p>}
            </div>
        </div>
    );
}

/** The contacts of a task or procedure */
export function ContactList({ contacts }: { contacts: Contact[] }) {
    if (contacts.length === 0) return null;
    return (
        <Surface kind="soft" className="divide-y divide-border/60">
            {contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
            ))}
        </Surface>
    );
}
