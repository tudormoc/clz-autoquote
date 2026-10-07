import { redirect } from 'next/navigation';
import { ADMIN_TABLES } from '@/config/adminTables';

/** /settings opens the first table */
export default function SettingsPage() {
    redirect(`/settings/${ADMIN_TABLES[0].id}`);
}
