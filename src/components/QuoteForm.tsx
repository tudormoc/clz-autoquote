'use client';

import React from 'react';
import { Settings, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { APP_COPY } from '@/locales/en';

interface QuoteFormProps {
    formData: {
        bookName: string;
        email: string;
        quantity: number;
        width: number;
        height: number;
        pages: number;
    };
    formErrors: Record<string, string>;
    loading: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCalculate: () => void;
    onReset: () => void;
}

export const QuoteForm = ({
    formData,
    formErrors,
    loading,
    onChange,
    onCalculate,
    onReset,
}: QuoteFormProps) => {
    return (
        <Card className="border-[#E5E5E0] shadow-sm">
            <CardHeader className="border-b border-[#F5F5F0]">
                <CardTitle className="flex items-center gap-2 text-[#414131]">
                    <Settings className="h-5 w-5 opacity-70" />
                    Book Specification
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                {/* Book Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input
                        label={APP_COPY.form.bookNameLabel}
                        placeholder={APP_COPY.form.bookNamePlaceholder}
                        id="bookName"
                        name="bookName"
                        value={formData.bookName}
                        onChange={onChange}
                        error={formErrors.bookName}
                    />
                    <Input
                        label="Email Address"
                        placeholder="your@email.com"
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={onChange}
                        error={formErrors.email}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                    <Input
                        label={APP_COPY.form.quantityLabel}
                        type="number"
                        name="quantity"
                        id="quantity"
                        value={formData.quantity}
                        onChange={onChange}
                        error={formErrors.quantity}
                    />
                    <Input
                        label={APP_COPY.form.pagesLabel}
                        type="number"
                        name="pages"
                        id="pages"
                        value={formData.pages}
                        onChange={onChange}
                        error={formErrors.pages}
                    />
                </div>

                <div className="border-t border-[#F5F5F0] pt-6">
                    <h3 className="text-sm font-semibold text-[#414131] mb-5 uppercase tracking-wider">{APP_COPY.form.dimensionsLabel}</h3>
                    <div className="grid grid-cols-2 gap-8">
                        <Input
                            label={APP_COPY.form.width}
                            type="number"
                            name="width"
                            id="width"
                            value={formData.width}
                            onChange={onChange}
                            error={formErrors.width}
                        />
                        <Input
                            label={APP_COPY.form.height}
                            type="number"
                            name="height"
                            id="height"
                            value={formData.height}
                            onChange={onChange}
                            error={formErrors.height}
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between bg-[#FAF9F6] border-t border-[#E5E5E0] py-5 px-6 rounded-b-lg">
                <Button variant="ghost" onClick={onReset} className="text-[#6B6B5F] hover:text-[#1A1A1A]">
                    {APP_COPY.form.resetButton}
                </Button>
                <Button onClick={onCalculate} disabled={loading} className="bg-[#414131] hover:bg-[#2D2D22] text-white min-w-[160px] gap-2">
                    {loading ? 'Processing...' : APP_COPY.form.submitButton}
                    {!loading && <ChevronRight className="h-4 w-4" />}
                </Button>
            </CardFooter>
        </Card>
    );
};
