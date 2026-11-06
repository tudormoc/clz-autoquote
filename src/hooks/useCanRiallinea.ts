'use client';

import { useCanEdit, useCanUse } from '@/components/auth/AccessProvider';
import { WORK_PROGRESS_FUNCTIONS } from '@/config/navigation';

/**
 * May the person realign an order from its DiBa? Riallinea needs "modifica" on the page and the function itself, given
 * apart in Gruppi. Only for the look of its buttons: the server action checks again.
 */
export function useCanRiallinea(): boolean {
    const canEdit = useCanEdit();
    const hasFunction = useCanUse(WORK_PROGRESS_FUNCTIONS.riallinea);
    return canEdit && hasFunction;
}
