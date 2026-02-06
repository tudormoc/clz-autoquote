'use client';

import React from 'react';
import { DiscountTiersManager } from '@/components/admin/DiscountTiersManager';
import { PricingConfigsManager } from '@/components/admin/PricingConfigsManager';
import { ShieldCheck, Target, Tags } from 'lucide-react';

export default function AdminDashboard() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldCheck className="text-blue-600" size={32} />
                        Control Center
                    </h1>
                    <p className="text-gray-500 mt-1">Manage the core pricing engine and discount structure</p>
                </div>
            </div>

            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section>
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <Target size={18} />
                        <h2 className="text-xs uppercase tracking-widest font-bold">Calculation Rules</h2>
                    </div>
                    <PricingConfigsManager />
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <Tags size={18} />
                        <h2 className="text-xs uppercase tracking-widest font-bold">Volume Discounts</h2>
                    </div>
                    <DiscountTiersManager />
                </section>
            </div>
        </div>
    );
}
