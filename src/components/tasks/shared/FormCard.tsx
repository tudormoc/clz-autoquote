import type { LucideIcon } from 'lucide-react';

interface FormCardProps {
    title: string;
    icon?: LucideIcon;
    /** One line under the title */
    hint?: string;
    children: React.ReactNode;
}

/** One block of an Agenda form or page (Cosa, Quando, Come si fa …) */
export function FormCard({ title, icon: Icon, hint, children }: FormCardProps) {
    return (
        <section className="bg-card border border-border rounded-lg p-4 sm:p-5 space-y-4">
            <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-fg-soft">
                    {Icon && <Icon size={16} className="text-primary" />}
                    {title}
                </h2>
                {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
            </div>
            {children}
        </section>
    );
}
