import React from 'react';
import { Control, Controller, FieldErrors, useWatch, useFieldArray, UseFormSetValue } from 'react-hook-form';
import { QuoteInput, SignatureType } from '@/lib/pricing/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales/en';

interface Props {
    control: Control<QuoteInput>;
    errors: FieldErrors<QuoteInput>;
    setValue: UseFormSetValue<QuoteInput>;
    signatureTypes?: SignatureType[];
}

export function InternalSection({ control, errors, setValue, signatureTypes = [] }: Props) {
    const endpapersEnabled = useWatch({ control, name: "internals.endpapers_enabled" });
    const pages = useWatch({ control, name: "pages" }) || 0;

    // Field Array for custom signatures
    const { fields, append, remove } = useFieldArray({
        control,
        name: "internals.custom_signatures"
    });

    const watchCustomSignatures = useWatch({ control, name: "internals.custom_signatures" });

    // Calculate total pages based on the size field (which we'll sync with the selected type)
    const totalManualPages = watchCustomSignatures?.reduce((sum, sig) => sum + ((sig.amount || 0) * (sig.size || 0)), 0) || 0;

    // Calculate informative signatures count
    const signatures = watchCustomSignatures?.reduce((sum, sig) => sum + (sig.amount || 0), 0) || 0;

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
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">{APP_COPY.form.endpapersTitle}</h3>
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
                        <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 ml-1">
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
                    )}
                </div>

                {/* Imposition Strategy (Signatures) */}
                <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">{APP_COPY.form.impositionTitle}</h3>
                        {configString && (
                            <div className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 flex items-center gap-2">
                                <span className="uppercase tracking-tighter text-[9px]">{APP_COPY.form.configurationLabel}</span>
                                <span className="text-gray-600 font-mono">{configString}</span>
                            </div>
                        )}
                    </div>


                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-3">
                            <div className="flex justify-between items-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                                                    placeholder="Qty"
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
                                    <div className="w-16 h-9 flex items-center justify-end text-sm font-mono text-muted-foreground">
                                        {((watchCustomSignatures?.[index]?.amount || 0) * (watchCustomSignatures?.[index]?.size || 0))} p
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="w-8 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
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
                                className="w-full mt-2 border-dashed text-muted-foreground hover:text-primary"
                            >
                                {APP_COPY.form.addSignatureBatch}
                            </Button>

                            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">{APP_COPY.form.totalImposedPages}</span>
                                <span className={`font-mono font-bold ${totalManualPages === pages ? 'text-green-600' : 'text-orange-500'}`}>
                                    {totalManualPages} <span className="text-xs font-normal text-muted-foreground">/ {pages} {APP_COPY.form.targetPagesSuffix}</span>
                                </span>
                            </div>
                            {totalManualPages !== pages && (
                                <p className="text-[11px] text-orange-500 mt-1">
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
