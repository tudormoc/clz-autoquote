import React from 'react';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { QuoteInput } from '@/lib/pricing/validation';
import { Input } from '@/components/ui/Input'; // Assuming existing Input component
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
}

export function GeneralSection({ control, errors }: Props) {
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
                            <Input
                                {...field}
                                label="Client Name"
                                error={errors.client_name?.message}
                            />
                        )}
                    />
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
