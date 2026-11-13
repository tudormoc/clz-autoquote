'use client';

import Link from 'next/link';
import { Save } from '@/components/ui/icons';
import { Button, buttonClasses } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

interface AgendaFormProps {
    onSave: () => void;
    saving: boolean;
    /** Where "Annulla" goes */
    cancelHref: string;
    saveLabel: string;
    /** The blocks of the form, one entry per column (side by side on wide screens, one under the other below) */
    columns: React.ReactNode[];
}

/**
 * The frame of the Agenda's page forms (task, procedure): their blocks in columns that fit the screen (each scrolls
 * on its own when long), then "Annulla" / "Salva" always in view at the bottom. Enter in a one-line field does not
 * save the whole form; only the button does.
 */
export function AgendaForm({ onSave, saving, cancelHref, saveLabel, columns }: AgendaFormProps) {
    return (
        <form
            className="flex flex-col lg:h-full"
            onSubmit={(event) => {
                event.preventDefault();
                onSave();
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
            }}
        >
            <div
                className={cn(
                    'grid grid-cols-1 gap-4 items-start lg:flex-1 lg:min-h-0 lg:overflow-y-auto',
                    columns.length > 1 && 'xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden'
                )}
            >
                {columns.map((column, index) => (
                    <div key={index} className="space-y-4 xl:max-h-full xl:overflow-y-auto xl:pr-1">
                        {column}
                    </div>
                ))}
            </div>
            <div className="shrink-0 sticky bottom-0 lg:static mt-3 py-3 flex justify-end gap-2 bg-background/95 border-t border-border">
                <Link href={cancelHref} className={buttonClasses({ variant: 'secondary' })}>
                    {APP_COPY.common.cancel}
                </Link>
                <Button type="submit" disabled={saving}>
                    <Save size={16} />
                    {saveLabel}
                </Button>
            </div>
        </form>
    );
}
