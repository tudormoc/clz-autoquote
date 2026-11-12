import type { LucideIcon } from 'lucide-react';
import { surfaceClasses } from '@/components/ui/Surface';

interface FormCardProps {
    title: string;
    icon?: LucideIcon;
    children: React.ReactNode;
}

/** One block of an Agenda form or page (Cosa, Quando, Come si fa …) */
export function FormCard({ title, icon: Icon, children }: FormCardProps) {
    return (
        <section className={surfaceClasses('panel', 'p-4 sm:p-5 space-y-4')}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-fg-soft">
                {Icon && <Icon size={16} className="text-primary" />}
                {title}
            </h2>
            {children}
        </section>
    );
}
