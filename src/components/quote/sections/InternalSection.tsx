import React from 'react';
import { Control, Controller, FieldErrors, useWatch } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { APP_COPY } from '@/locales/en';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function InternalSection({ control, errors }: Props) {
    const endpapersEnabled = useWatch({ control, name: "internals.endpapers_enabled" });
    return (
        <Card>
            <CardHeader>
                <CardTitle>Internal Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Printed Sheets Specifications */}
                <div className="space-y-4 border-b pb-4">
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Printed Sheets</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={control}
                            name="internals.sheet_width"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label="Sheet Width (mm)"
                                    type="number"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    error={errors.internals?.sheet_width?.message}
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="internals.sheet_height"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label="Sheet Height (mm)"
                                    type="number"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    error={errors.internals?.sheet_height?.message}
                                />
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={control}
                            name="internals.imposition"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label="Imposition (Pages/Sheet)"
                                    type="number"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    error={errors.internals?.imposition?.message}
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="internals.sheet_weight"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label="Weight (gsm)"
                                    type="number"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    error={errors.internals?.sheet_weight?.message}
                                />
                            )}
                        />
                    </div>
                    <Controller
                        control={control}
                        name="internals.sheet_type"
                        render={({ field }) => (
                            <Select
                                {...field}
                                label="Paper Type"
                                options={[
                                    { label: 'Coated Matte', value: 'coated_matte' },
                                    { label: 'Coated Gloss', value: 'coated_gloss' }
                                ]}
                                error={errors.internals?.sheet_type?.message}
                            />
                        )}
                    />
                </div>

                {/* Legacy Pages Field */}
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

                <div className="space-y-4 pt-2">
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Endpapers</h3>
                    <Controller
                        control={control}
                        name="internals.endpapers_enabled"
                        render={({ field }) => (
                            <Checkbox
                                checked={field.value}
                                onChange={field.onChange}
                                label="Include Endpapers"
                                id="endpapers_enabled"
                            />
                        )}
                    />

                    {endpapersEnabled && (
                        <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 ml-1">
                            <Controller
                                control={control}
                                name="internals.endpapers_weight"
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        label="Endpaper Weight (gsm)"
                                        type="number"
                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                        error={errors.internals?.endpapers_weight?.message}
                                    />
                                )}
                            />
                            <Controller
                                control={control}
                                name="internals.endpapers_type"
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        label="Endpaper Type"
                                        options={[
                                            { label: 'Coated Matte', value: 'coated_matte' },
                                            { label: 'Coated Gloss', value: 'coated_gloss' }
                                        ]}
                                        error={errors.internals?.endpapers_type?.message}
                                    />
                                )}
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
