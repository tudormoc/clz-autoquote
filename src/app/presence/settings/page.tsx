import { Header } from '@/components/Header';
import { PresenceSidebar } from '@/components/presence/PresenceSidebar';
import { Settings, Clock, ShieldCheck, Calendar, Info } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { APP_CONFIG } from '@/config/constants';

export default function PresenceSettingsPage() {
    const copy = APP_COPY.analytics.presenceSettings;
    const presenceConfig = APP_CONFIG.PRESENCE;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <PresenceSidebar activeSection="settings" />

                {/* Main Content */}
                <main className="flex-1 bg-background overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto px-6 py-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Settings className="text-primary" size={24} />
                                <h1 className="text-2xl font-bold text-zinc-100">
                                    {copy.title}
                                </h1>
                            </div>
                            <p className="text-zinc-400">{copy.subtitle}</p>
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Auto Exit Configuration Card */}
                            <div className="bg-card border border-zinc-800 rounded-lg p-6 flex flex-col gap-4">
                                <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                                    <Clock className="text-primary" size={20} />
                                    <h2 className="text-lg font-semibold text-zinc-100">
                                        {copy.autoExitSection}
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/80">
                                        <span className="text-sm text-zinc-300 font-medium">
                                            {copy.autoExitWeekday}
                                        </span>
                                        <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded">
                                            {presenceConfig.AUTO_EXIT_TIME_WEEKDAY}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/80">
                                        <span className="text-sm text-zinc-300 font-medium">
                                            {copy.autoExitSaturday}
                                        </span>
                                        <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded">
                                            {presenceConfig.AUTO_EXIT_TIME_SATURDAY}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/80">
                                        <span className="text-sm text-zinc-300 font-medium">
                                            {copy.triggerHour}
                                        </span>
                                        <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded">
                                            {presenceConfig.TRIGGER_HOUR}:00
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* System Status & Rules Card */}
                            <div className="bg-card border border-zinc-800 rounded-lg p-6 flex flex-col gap-4">
                                <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                                    <ShieldCheck className="text-primary" size={20} />
                                    <h2 className="text-lg font-semibold text-zinc-100">
                                        {copy.systemInfo}
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 bg-zinc-900/50 p-3 rounded border border-zinc-800/80">
                                        <Info className="text-primary flex-shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <div className="text-sm font-medium text-zinc-200">
                                                {copy.activeStatus}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-1">
                                                {copy.activeDesc}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded border border-zinc-800/80">
                                        <span className="text-sm text-zinc-300 font-medium">
                                            Modulo Anagrafica Operatori
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                                            ATTIVO
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
