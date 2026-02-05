import { Control, Controller, FieldErrors, useWatch } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/types';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ClientAutocomplete } from '../ClientAutocomplete';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function GeneralSection({ control, errors }: Props) {
    const format = useWatch({ control, name: 'format' });
    const openedWidth = (format?.width || 0) * 2;
    const openedHeight = format?.height || 0;
    return (
        <Card>
            <CardHeader>
                <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller
                        control={control}
                        name="project_title"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label="Project Title"
                                error={errors.project_title?.message}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="client_name"
                        render={({ field }) => (
                            <ClientAutocomplete
                                {...field}
                                label="Client Name (from local Database)"
                                placeholder="Start typing client name..."
                                error={errors.client_name?.message}
                            />
                        )}
                    />
                </div>

                {/* Book Format Section */}
                <div className="space-y-4 pt-2 pb-4 border-y border-gray-50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Book Dimensions</h3>
                        {(openedWidth > 0 && openedHeight > 0) && (
                            <div className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 flex items-center gap-2">
                                <span className="uppercase tracking-tighter">Opened Format:</span>
                                <span className="text-gray-600">{openedWidth} x {openedHeight} mm</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            control={control}
                            name="format.width"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label="Closed Width (mm)"
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
                                    label="Closed Height (mm)"
                                    type="number"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    error={errors.format?.height?.message}
                                />
                            )}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Controller
                        control={control}
                        name="email"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label="Email Address"
                                error={errors.email?.message}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="quantity"
                        render={({ field }) => (
                            <Input
                                {...field}
                                label="Quantity"
                                type="number"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                error={errors.quantity?.message}
                            />
                        )}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
