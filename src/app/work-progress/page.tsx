import { Header } from '@/components/Header';
import { OrderOperationsReport } from '@/components/analytics/OrderOperationsReport';

export default function WorkProgressPage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />

            {/* Full-height workspace: only the active panel scrolls, never the page */}
            <main className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 w-full max-w-[1920px] mx-auto px-4 py-3 flex flex-col">
                    <OrderOperationsReport />
                </div>
            </main>
        </div>
    );
}
