'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAccess } from '@/components/auth/AccessProvider';
import { buttonClasses } from '@/components/ui/Button';
import { TASK_PAGES } from '@/config/navigation';
import { canOpen } from '@/lib/auth/permissions';
import { APP_COPY } from '@/locales';

/** "Nuova attività", for someone who may create tasks (modifica on Attività) — also on pages that only show (Calendario) */
export function NewTaskButton() {
    const access = useAccess();
    if (!access || !canOpen(access, TASK_PAGES.list, 'edit')) return null;
    return (
        <Link href={`${TASK_PAGES.list}/new`} className={buttonClasses()}>
            <Plus size={16} />
            {APP_COPY.tasks.newTask}
        </Link>
    );
}
