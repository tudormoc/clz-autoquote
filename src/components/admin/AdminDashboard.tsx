'use client';

import React from 'react';
import { DiscountTiersManager } from '@/components/admin/DiscountTiersManager';
import { PricingConfigsManager } from '@/components/admin/PricingConfigsManager';
import { SignaturesManager } from '@/components/admin/SignaturesManager';
import { ShieldCheck, Target, Tags, Layers } from 'lucide-react';

import { APP_COPY } from '@/locales/en';

export default function AdminDashboard() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldCheck className="text-blue-600" size={32} />
                        {APP_COPY.admin.title}
                    </h1>
                    <p className="text-gray-500 mt-1">{APP_COPY.admin.subtitle}</p>
                </div>
            </div>

            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section>
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <Target size={18} />
                        <h2 className="text-xs uppercase tracking-widest font-bold">{APP_COPY.admin.pricingRules.title}</h2>
                    </div>
                    <PricingConfigsManager />
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <Layers size={18} />
                        <h2 className="text-xs uppercase tracking-widest font-bold">{APP_COPY.admin.signatureTypes.title}</h2>
                    </div>
                    <SignaturesManager />
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <Tags size={18} />
                        <h2 className="text-xs uppercase tracking-widest font-bold">{APP_COPY.admin.discountTiers.title}</h2>
                    </div>
                    <DiscountTiersManager />
                </section>
            </div>
        </div>
    );
}
