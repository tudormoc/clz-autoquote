'use client';

import React from 'react';
import { Calculator } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { APP_COPY } from '@/locales/en';
import type { QuoteResult } from '@/lib/pricing-engine';

interface QuoteResultCardProps {
    result: QuoteResult | null;
}

export const QuoteResultCard = ({ result }: QuoteResultCardProps) => {
    if (!result) {
        return (
            <Card className="sticky top-24 border-dashed border-2 border-[#E5E5E0] bg-[#FAF9F6]">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-white p-5 rounded-full mb-6 shadow-sm border border-[#E5E5E0]">
                        <Calculator className="h-10 w-10 text-[#D1D1C7]" />
                    </div>
                    <p className="max-w-[240px] text-[#6B6B5F] leading-relaxed font-medium">
                        {APP_COPY.emptyState}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="sticky top-24 border-[#414131] border-2 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-[#414131] text-white border-b-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Calculator className="h-5 w-5 text-[#D1D1C7]" />
                    {APP_COPY.results.title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 px-8">
                <div className="space-y-4">
                    <div className="flex justify-between text-sm items-baseline">
                        <span className="text-[#6B6B5F]">{APP_COPY.results.basePrice}</span>
                        <span className="font-medium text-[#1A1A1A]">${result.breakdown.basePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm items-baseline">
                        <span className="text-[#6B6B5F]">{APP_COPY.results.areaCost}</span>
                        <span className="font-medium text-[#1A1A1A]">${result.breakdown.areaCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm items-baseline">
                        <span className="text-[#6B6B5F]">{APP_COPY.results.pageCost}</span>
                        <span className="font-medium text-[#1A1A1A]">${result.breakdown.pageCost.toLocaleString()}</span>
                    </div>

                    <div className="border-t border-[#F5F5F0] my-4"></div>

                    <div className="flex justify-between text-sm font-semibold text-[#1A1A1A]">
                        <span>{APP_COPY.results.subtotal}</span>
                        <span>${(result.breakdown.basePrice + result.breakdown.areaCost + result.breakdown.pageCost).toFixed(2)}</span>
                    </div>
                </div>

                {result.breakdown.quantityDiscount > 0 && (
                    <div className="bg-[#FAF9F6] p-4 rounded-lg flex justify-between text-sm text-[#414131] border border-[#E5E5E0]">
                        <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            {APP_COPY.results.discount}
                        </span>
                        <span className="font-bold">{(result.breakdown.quantityDiscount * 100).toFixed(0)}%</span>
                    </div>
                )}

                <div className="border-t-2 border-double border-[#E5E5E0] pt-6 pb-2 text-center" style={{ borderBottomStyle: 'double' }}>
                    <p className="text-xs text-[#6B6B5F] uppercase tracking-[0.2em] font-bold mb-2">{APP_COPY.results.total}</p>
                    <div className="text-5xl font-black text-[#1A1A1A] tracking-tighter mb-2">
                        ${result.totalPrice.toLocaleString()}
                    </div>
                    <p className="text-sm text-[#6B6B5F]">
                        {APP_COPY.results.unitPrice}: <span className="font-bold text-[#1A1A1A]">${result.pricePerUnit}</span>
                    </p>
                </div>
            </CardContent>
            <CardFooter className="bg-[#FAF9F6] p-6 border-t border-[#E5E5E0] flex flex-col gap-3">
                <Button className="w-full bg-[#1A1A1A] hover:bg-black text-white h-12 text-md font-bold" size="lg">
                    Finalize Specification
                </Button>
                <p className="text-[10px] text-center text-[#A1A19A] leading-relaxed">
                    *Quote is subject to material availability. All prices are in USD.
                    Generated on {new Date().toLocaleDateString()}.
                </p>
            </CardFooter>
        </Card>
    );
};
