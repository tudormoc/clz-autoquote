import React from 'react';
import { QuoteBreakdown } from '@/lib/pricing/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter
} from "@/components/ui/Table";
import { APP_COPY } from '@/locales';


export function LiveBreakdown({ breakdown }: { breakdown: QuoteBreakdown | null }) {
    if (!breakdown) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-fg-subtle">
                    {APP_COPY.breakdown.fillForm}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border">
            <CardHeader className="bg-card/50 border-b border-border">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-fg-strong">{APP_COPY.breakdown.title}</CardTitle>
                    <div className="text-right">
                        <div className="text-xl font-bold text-fg-strong font-mono">
                            €{breakdown.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-fg-subtle font-mono">
                            €{breakdown.unit_price.toFixed(2)} {APP_COPY.breakdown.unitPrice}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40%]">{APP_COPY.breakdown.operation}</TableHead>
                            <TableHead className="text-right">{APP_COPY.breakdown.setup}</TableHead>
                            <TableHead className="text-right">{APP_COPY.breakdown.unit}</TableHead>
                            <TableHead className="text-right">{APP_COPY.breakdown.total}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {breakdown.items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-fg-subtle italic h-20">
                                    {APP_COPY.breakdown.noOperations}
                                </TableCell>
                            </TableRow>
                        )}
                        {breakdown.items.map((item, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span className="text-sm">{item.name}</span>
                                        {item.details && (
                                            <span className="text-3xs text-fg-subtle font-normal">{item.details}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-fg-muted">
                                    {item.original_setup_cost ? `€${item.original_setup_cost.toFixed(2)}` : (item.setup_cost ? `€${item.setup_cost.toFixed(2)}` : '-')}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-fg-muted">
                                    {item.original_unit_production_cost ? `€${item.original_unit_production_cost.toFixed(4)}` : (item.unit_production_cost ? `€${item.unit_production_cost.toFixed(4)}` : '-')}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    €{item.cost.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-card/30 hover:bg-card/30">
                            <TableCell colSpan={3} className="font-medium text-xs">{APP_COPY.breakdown.setupTotal}</TableCell>
                            <TableCell className="text-right font-mono text-sm">€{breakdown.metadata.setup_total.toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-card/30 hover:bg-card/30 border-t-0">
                            <TableCell colSpan={3} className="font-medium text-xs">{APP_COPY.breakdown.productionTotal}</TableCell>
                            <TableCell className="text-right font-mono text-sm">€{breakdown.metadata.production_total.toFixed(2)}</TableCell>
                        </TableRow>
                        {(breakdown.metadata.applied_surcharge && breakdown.metadata.applied_surcharge > 0) || (breakdown.metadata.applied_discount && breakdown.metadata.applied_discount > 0) ? (
                            <>
                                <TableRow className="border-t border-border-strong">
                                    <TableCell colSpan={4} className="py-2">
                                        <div className="text-xs text-fg-subtle font-normal">{APP_COPY.breakdown.appliedAdjustments}</div>
                                    </TableCell>
                                </TableRow>
                                {breakdown.metadata.applied_surcharge && breakdown.metadata.applied_surcharge > 0 ? (
                                    <TableRow className="bg-card/20 hover:bg-card/20">
                                        <TableCell colSpan={3} className="text-xs text-warning-300 pl-6">
                                            {APP_COPY.breakdown.formatSurcharge} +{(breakdown.metadata.applied_surcharge * 100).toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-fg-subtle">
                                            {APP_COPY.breakdown.included}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {breakdown.metadata.applied_discount && breakdown.metadata.applied_discount > 0 ? (
                                    <TableRow className="bg-card/20 hover:bg-card/20">
                                        <TableCell colSpan={3} className="text-xs text-success-500 pl-6">
                                            {APP_COPY.breakdown.volumeDiscount} -{(breakdown.metadata.applied_discount * 100).toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-fg-subtle">
                                            {APP_COPY.breakdown.included}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </>
                        ) : null}
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}
