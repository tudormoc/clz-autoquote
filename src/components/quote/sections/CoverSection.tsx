import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/validation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function CoverSection({ control, errors }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Cover System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Cover Binding Type
                    </label>
                    <Controller
                        control={control}
                        name="cover_details.type"
                        render={({ field }) => (
                            <select
                                {...field}
                                className="flex h-12 w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#6B6B5F] focus:outline-none focus:ring-2 focus:ring-[#414131]/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                            >
                                <option value="">Select a binding type...</option>
                                <option value="hardcover">Classic Hardcover</option>
                                <option value="softcover">Softcover (Sewn)</option>
                                <option value="swiss_binding">Swiss Binding</option>
                                <option value="naked_binding">Naked Binding</option>
                            </select>
                        )}
                    />
                    {errors.cover_details?.type && (
                        <p className="text-sm text-red-500">{errors.cover_details.type.message}</p>
                    )}
                </div>

                {/* Future: Finishings multi-select */}
                <div className="space-y-2 pt-4 border-t border-dashed">
                    <p className="text-sm font-medium">Extra Finishings (Coming Soon)</p>
                    <div className="flex gap-2 text-xs text-gray-400">
                        <span className="px-2 py-1 bg-gray-100 rounded">Hot Stamping</span>
                        <span className="px-2 py-1 bg-gray-100 rounded">Debossing</span>
                        <span className="px-2 py-1 bg-gray-100 rounded">Silk Screen</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
