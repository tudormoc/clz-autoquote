import { Control, Controller, FieldErrors, useWatch } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { APP_COPY } from '@/locales';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function CoverSection({ control, errors }: Props) {
    const headbandsEnabled = useWatch({ control, name: "cover_details.headbands_enabled" });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{APP_COPY.form.coverSystem}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 1. Cover Binding Type */}
                <div className="space-y-4">
                    <Controller
                        control={control}
                        name="cover_details.type"
                        render={({ field }) => (
                            <Select
                                {...field}
                                label={APP_COPY.form.coverBindingType}
                                options={[
                                    { label: APP_COPY.form.classicHardcover, value: 'hardcover' },
                                    { label: APP_COPY.form.softcoverSewn, value: 'softcover' },
                                    { label: APP_COPY.form.swissBinding, value: 'swiss_binding' },
                                    { label: APP_COPY.form.nakedBinding, value: 'naked_binding' }
                                ]}
                                error={errors.cover_details?.type?.message}
                            />
                        )}
                    />
                </div>

                {/* 2. Spine Type & Board Thickness */}
                <div className="grid grid-cols-2 gap-4">
                    <Controller
                        control={control}
                        name="cover_details.spine_type"
                        render={({ field }) => (
                            <Select
                                {...field}
                                label={APP_COPY.form.spineType}
                                options={[
                                    { label: APP_COPY.form.squareSpine, value: 'square' },
                                    { label: APP_COPY.form.roundSpine, value: 'round' }
                                ]}
                                error={errors.cover_details?.spine_type?.message}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="cover_details.board_thickness"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label={APP_COPY.form.boardThickness}
                                type="number"
                                step="0.1"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    field.onChange(val === '' ? '' : parseFloat(val) || 0);
                                }}
                                error={errors.cover_details?.board_thickness?.message}
                            />
                        )}
                    />
                </div>

                {/* 3. Headbands */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-semibold text-zinc-400">{APP_COPY.form.headbands}</h3>
                    <Controller
                        control={control}
                        name="cover_details.headbands_enabled"
                        render={({ field }) => (
                            <Checkbox
                                checked={field.value}
                                onChange={field.onChange}
                                label={APP_COPY.form.includeHeadbands}
                                id="headbands_enabled"
                            />
                        )}
                    />

                    {headbandsEnabled && (
                        <div className="pl-6 border-l-2 ml-1">
                            <Controller
                                control={control}
                                name="cover_details.headbands_type"
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        label={APP_COPY.form.headbandType}
                                        options={[
                                            { label: 'Politi', value: 'politi' },
                                            { label: 'G&W', value: 'g&w' }
                                        ]}
                                        error={errors.cover_details?.headbands_type?.message}
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
