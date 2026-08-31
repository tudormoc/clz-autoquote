import { Header } from '@/components/Header';
import { OrderOperationsReport } from '@/components/analytics/OrderOperationsReport';
import { APP_COPY } from '@/locales';
import { Workflow } from 'lucide-react';

export default function WorkProgressPage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto px-6 py-6">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                <Workflow size={22} />
                            </div>
                            <h1 className="text-2xl font-bold text-white">
                                {APP_COPY.analytics.orderOperations.pageTitle}
                            </h1>
                        </div>
                        <p className="text-sm text-zinc-400 ml-11">
                            {APP_COPY.analytics.orderOperations.pageSubtitle}
                        </p>
                    </div>

                    {/* Dashboard Component */}
                    <OrderOperationsReport />
                </div>
            </main>
        </div>
    );
}
