import { Control, Controller, FieldErrors, useWatch } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function CoverSection({ control, errors }: Props) {
    const headbandsEnabled = useWatch({ control, name: "cover_details.headbands_enabled" });
    return (
        <Card>
            <CardHeader>
                <CardTitle>Cover System</CardTitle>
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
                                label="Cover Binding Type"
                                options={[
                                    { label: 'Classic Hardcover', value: 'hardcover' },
                                    { label: 'Softcover (Sewn)', value: 'softcover' },
                                    { label: 'Swiss Binding', value: 'swiss_binding' },
                                    { label: 'Naked Binding', value: 'naked_binding' }
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
                                label="Spine Type"
                                options={[
                                    { label: 'Square Spine', value: 'square' },
                                    { label: 'Round Spine', value: 'round' }
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
                                label="Board Thickness (mm)"
                                type="number"
                                step="0.1"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                error={errors.cover_details?.board_thickness?.message}
                            />
                        )}
                    />
                </div>

                {/* 3. Headbands */}
                <div className="space-y-4 pt-2">
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Headbands</h3>
                    <Controller
                        control={control}
                        name="cover_details.headbands_enabled"
                        render={({ field }) => (
                            <Checkbox
                                checked={field.value}
                                onChange={field.onChange}
                                label="Include Headbands"
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
                                        label="Headband Type"
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
