import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/validation';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { APP_COPY } from '@/locales/en';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function InternalSection({ control, errors }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Internal Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Controller
                        control={control}
                        name="format.width"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label={APP_COPY.form.width}
                                type="number"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                error={errors.format?.width?.message}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="format.height"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label={APP_COPY.form.height}
                                type="number"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                error={errors.format?.height?.message}
                            />
                        )}
                    />
                </div>
                <div>
                    <Controller
                        control={control}
                        name="pages"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label={APP_COPY.form.pagesLabel}
                                type="number"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                error={errors.pages?.message}
                            />
                        )}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
