import React from 'react';
import { QuoteBreakdown } from '@/lib/pricing/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export function LiveBreakdown({ breakdown }: { breakdown: QuoteBreakdown | null }) {
    if (!breakdown) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-gray-500">
                    Fill in the form to see the price breakdown.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="sticky top-6 border-[#E5E5E0] shadow-sm">
            <CardHeader className="bg-[#FAF9F6] border-b border-[#F5F5F0]">
                <CardTitle className="text-[#414131]">Price Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div>
                    <p className="text-sm text-[#6B6B5F] uppercase tracking-wider mb-1">Total Estimated Price</p>
                    <div className="text-4xl font-light text-[#1A1A1A]">
                        €{breakdown.total_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-sm text-[#6B6B5F] mt-1">
                        €{breakdown.unit_price.toFixed(2)} per unit
                    </p>
                </div>

                <div className="space-y-3 border-t border-[#F5F5F0] pt-4">
                    <p className="text-xs font-semibold text-[#414131] uppercase">Operations & Materials</p>
                    {breakdown.items.length === 0 && <p className="text-sm text-gray-400 italic">No operations costed yet.</p>}
                    {breakdown.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm group">
                            <span className="text-[#414131]">{item.name}</span>
                            <div className="text-right">
                                <span className="font-medium text-[#1A1A1A]">€{item.cost.toFixed(2)}</span>
                                <p className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.details}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-[#F5F5F0] pt-4">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase">Setup Total</p>
                        <p className="font-mono text-sm">€{breakdown.metadata.setup_total.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase">Production Total</p>
                        <p className="font-mono text-sm">€{breakdown.metadata.production_total.toFixed(2)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
