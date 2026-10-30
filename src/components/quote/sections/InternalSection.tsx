import React from 'react';
import { Control, Controller, FieldErrors, useWatch, useFieldArray, UseFormSetValue } from 'react-hook-form';
import { QuoteInput, SignatureType } from '@/lib/pricing/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InfoBadge } from '@/components/ui/InfoBadge';
import { calculateBlockThickness } from '@/lib/pricing/formulas';
import { APP_COPY } from '@/locales';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
    setValue: UseFormSetValue<QuoteInput>;
    signatureTypes?: SignatureType[];
}

export function InternalSection({ control, errors, setValue, signatureTypes = [] }: Props) {
    const endpapersEnabled = useWatch({ control, name: "internals.endpapers_enabled" });
    const pages = useWatch({ control, name: "pages" }) || 0;
    
    // Watch all values needed for block thickness calculation
    const sheetWeight = useWatch({ control, name: "internals.sheet_weight" }) || 0;
    const sheetThickness = useWatch({ control, name: "internals.sheet_thickness" }) || 0;
    const endpapersWeight = useWatch({ control, name: "internals.endpapers_weight" }) || 0;
    const endpapersThickness = useWatch({ control, name: "internals.endpapers_thickness" }) || 0;
    
    // Calculate block thickness
    const blockThickness = React.useMemo(() => {
        if (!pages || !sheetWeight || !sheetThickness) return 0;
        
        try {
            return calculateBlockThickness({
                pages,
                internals: {
                    sheet_weight: sheetWeight,
                    sheet_thickness: sheetThickness,
                    endpapers_enabled: endpapersEnabled,
                    endpapers_weight: endpapersWeight,
                    endpapers_thickness: endpapersThickness
                }
            } as QuoteInput);
        } catch {
            return 0;
        }
    }, [pages, sheetWeight, sheetThickness, endpapersEnabled, endpapersWeight, endpapersThickness]);

    // Field Array for custom signatures
    const { fields, append, remove } = useFieldArray({
        control,
        name: "internals.custom_signatures"
    });

    const watchCustomSignatures = useWatch({ control, name: "internals.custom_signatures" });

    // Calculate total pages based on the size field (which we'll sync with the selected type)
    const totalManualPages = watchCustomSignatures?.reduce((sum, sig) => sum + ((sig.amount || 0) * (sig.size || 0)), 0) || 0;

    // Map signature types to Select options
    const signatureOptions = signatureTypes.map(type => ({
        label: `${type.name} (${type.pages} pp)`,
        value: type.id
    }));

    // Construct configuration string for display (e.g., 1/16 + 18/32 + endpapers)
    const configString = [
        ...(watchCustomSignatures?.map(sig => `${sig.amount || 0}/${sig.size || 0}`) || []),
        ...(endpapersEnabled ? ['endpapers'] : [])
    ].join(' + ');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{APP_COPY.form.internalSpecsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Printed Sheets Specifications */}
                <div className="space-y-6 border-b pb-6">
                    {/* Common Sheet Specs */}
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <Controller
                            control={control}
                            name="internals.sheet_width"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label={APP_COPY.form.sheetWidth}
                                    type="number"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val === '' ? '' : parseInt(val) || 0);
                                    }}
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
                                    label={APP_COPY.form.sheetHeight}
                                    type="number"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val === '' ? '' : parseInt(val) || 0);
                                    }}
                                    error={errors.internals?.sheet_height?.message}
                                />
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Controller
                            control={control}
                            name="internals.sheet_weight"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label={APP_COPY.form.weightLabel}
                                    type="number"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val === '' ? '' : parseInt(val) || 0);
                                    }}
                                    error={errors.internals?.sheet_weight?.message}
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="internals.sheet_thickness"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    label={APP_COPY.form.thickness}
                                    type="number"
                                    step="0.01"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val === '' ? '' : parseFloat(val) || 0);
                                    }}
                                    error={errors.internals?.sheet_thickness?.message}
                                />
                            )}
                        />
                        <div className="col-span-2 sm:col-span-1">
                            <Controller
                                control={control}
                                name="internals.sheet_type"
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        label={APP_COPY.form.paperTypeLabel}
                                        options={[
                                            { label: APP_COPY.form.coatedMatte, value: 'coated_matte' },
                                            { label: APP_COPY.form.coatedGloss, value: 'coated_gloss' }
                                        ]}
                                        error={errors.internals?.sheet_type?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* Legacy Pages Field */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium leading-none">
                            {APP_COPY.form.pagesLabel}
                        </label>
                        <div className="flex gap-2">
                            {pages > 0 && (
                                <InfoBadge
                                    label={APP_COPY.form.totalLabel}
                                    value={`${pages + (endpapersEnabled ? 8 : 0)} pp`}
                                    detail={endpapersEnabled ? `(${pages} + 8)` : undefined}
                                />
                            )}
                            {blockThickness > 0 && (
                                <InfoBadge
                                    label={APP_COPY.form.blockLabel}
                                    value={`${blockThickness.toFixed(1)}mm`}
                                />
                            )}
                        </div>
                    </div>
                    <Controller
                        control={control}
                        name="pages"
                        render={({ field }) => (
                            <Input
                                {...field}
                                type="number"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    field.onChange(val === '' ? '' : parseInt(val) || 0);
                                }}
                                error={errors.pages?.message}
                            />
                        )}
                    />
                </div>

                <div className="space-y-4 pt-2 border-b pb-6">
                    <h3 className="text-sm font-semibold text-fg-muted">{APP_COPY.form.endpapersTitle}</h3>
                    <Controller
                        control={control}
                        name="internals.endpapers_enabled"
                        render={({ field }) => (
                            <Checkbox
                                checked={field.value}
                                onChange={field.onChange}
                                label={APP_COPY.form.includeEndpapers}
                                id="endpapers_enabled"
                            />
                        )}
                    />

                    {endpapersEnabled && (
                        <div className="space-y-4 pl-6 border-l-2 ml-1">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <Controller
                                    control={control}
                                    name="internals.endpapers_weight"
                                    render={({ field }) => (
                                        <Input
                                            {...field}
                                            label={APP_COPY.form.endpaperWeight}
                                            type="number"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? '' : parseInt(val) || 0);
                                            }}
                                            error={errors.internals?.endpapers_weight?.message}
                                        />
                                    )}
                                />
                                <Controller
                                    control={control}
                                    name="internals.endpapers_thickness"
                                    render={({ field }) => (
                                        <Input
                                            {...field}
                                            label={APP_COPY.form.thickness}
                                            type="number"
                                            step="0.01"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? '' : parseFloat(val) || 0);
                                            }}
                                            error={errors.internals?.endpapers_thickness?.message}
                                        />
                                    )}
                                />
                                <div className="col-span-2 sm:col-span-1">
                                    <Controller
                                        control={control}
                                        name="internals.endpapers_type"
                                        render={({ field }) => (
                                            <Select
                                                {...field}
                                                label={APP_COPY.form.endpaperType}
                                                options={[
                                                    { label: APP_COPY.form.coatedMatte, value: 'coated_matte' },
                                                    { label: APP_COPY.form.coatedGloss, value: 'coated_gloss' }
                                                ]}
                                                error={errors.internals?.endpapers_type?.message}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Imposition Strategy (Signatures) */}
                <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-fg-muted">{APP_COPY.form.impositionTitle}</h3>
                        {configString && (
                            <InfoBadge
                                label={APP_COPY.form.configurationLabel}
                                value={configString}
                            />
                        )}
                    </div>


                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-3">
                            <div className="flex justify-between items-center text-xs font-medium text-fg-subtle">
                                <span className="w-24">{APP_COPY.form.amountLabel}</span>
                                <span className="flex-1 px-4">{APP_COPY.form.signatureTypeLabel}</span>
                                <span className="w-16 text-right">{APP_COPY.form.totalPpLabel}</span>
                                <span className="w-8"></span>
                            </div>

                            {fields.map((field, index) => (
                                <div key={field.id} className="flex gap-4 items-start group">
                                    <Controller
                                        control={control}
                                        name={`internals.custom_signatures.${index}.amount`}
                                        render={({ field: f }) => (
                                            <div className="w-24">
                                                <Input
                                                    {...f}
                                                    type="number"
                                                    className="h-9"
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        f.onChange(val === '' ? '' : parseInt(val) || 0);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    />
                                    <div className="flex-1">
                                        <Controller
                                            control={control}
                                            name={`internals.custom_signatures.${index}.signature_type_id`}
                                            render={({ field: f }) => (
                                                <Select
                                                    {...f}
                                                    value={f.value}
                                                    onChange={(e) => {
                                                        const typeId = e.target.value;
                                                        f.onChange(typeId);
                                                        // Sync the 'size' helper field for calculations
                                                        const selectedType = signatureTypes.find(t => t.id === typeId);
                                                        if (selectedType) {
                                                            setValue(`internals.custom_signatures.${index}.size`, selectedType.pages);
                                                        } else {
                                                            // Fallback for legacy values
                                                            const pages = parseInt(typeId.replace('legacy-', '')) || 0;
                                                            setValue(`internals.custom_signatures.${index}.size`, pages);
                                                        }
                                                    }}
                                                    options={signatureOptions.length > 0 ? signatureOptions : [{ label: 'Loading signatures...', value: '' }]}
                                                    className="h-9"
                                                    disabled={signatureOptions.length === 0}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="w-16 h-9 flex items-center justify-end text-sm font-mono text-fg-subtle">
                                        {((watchCustomSignatures?.[index]?.amount || 0) * (watchCustomSignatures?.[index]?.size || 0))} p
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="w-8 h-9 flex items-center justify-center text-fg-subtle hover:text-danger transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                </div>
                            ))}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const defaultType = signatureTypes.find(t => t.pages === 16) || signatureTypes[0];
                                    if (defaultType) {
                                        append({
                                            amount: 1,
                                            signature_type_id: defaultType.id,
                                            size: defaultType.pages
                                        });
                                    }
                                }}
                                className="w-full mt-2 border-dashed text-fg-subtle hover:text-primary"
                            >
                                {APP_COPY.form.addSignatureBatch}
                            </Button>

                            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                                <span className="text-sm text-fg-subtle">{APP_COPY.form.totalImposedPages}</span>
                                <InfoBadge
                                    label=""
                                    value={`${totalManualPages} / ${pages}`}
                                    detail={APP_COPY.form.targetPagesSuffix}
                                    className={totalManualPages === pages ? 'text-success-500' : 'text-warning-300'}
                                />
                            </div>
                            {totalManualPages !== pages && (
                                <p className="text-2xs text-warning-300 mt-1">
                                    {APP_COPY.form.impositionWarning}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card >
    );
}
