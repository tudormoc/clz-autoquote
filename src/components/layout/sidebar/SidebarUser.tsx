'use client';

import { useState } from 'react';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { logoutAction } from '@/app/auth-actions';
import { ChangePinDialog } from '@/components/auth/ChangePinDialog';
import { useAccess } from '@/components/auth/AccessProvider';
import { SidebarAction } from '@/components/layout/sidebar/SidebarAction';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.auth;

/** Foot of the sidebar: who is logged in, their own PIN (not the superadmin's: that one is in .env.local), logout. */
export function SidebarUser() {
    const access = useAccess();
    const [changingPin, setChangingPin] = useState(false);
    if (!access) return null;

    return (
        <div className="space-y-0.5">
            <div className="flex items-center gap-3 h-9 px-3 text-sm text-fg-strong font-medium collapsed:justify-center collapsed:px-0" title={access.name}>
                <UserRound size={18} className="shrink-0 text-primary" />
                <span className="truncate collapsed:hidden">{access.name}</span>
            </div>
            {!access.superadmin && <SidebarAction icon={KeyRound} label={copy.changePin} onClick={() => setChangingPin(true)} />}
            <SidebarAction icon={LogOut} label={copy.logout} onClick={() => logoutAction()} />
            {changingPin && <ChangePinDialog onClose={() => setChangingPin(false)} />}
        </div>
    );
}
