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


export function LiveBreakdown({ breakdown }: { breakdown: QuoteBreakdown | null }) {
    if (!breakdown) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-muted-foreground">
                    Fill in the form to see the price breakdown.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="bg-secondary border-b border-border py-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-medium text-primary">Price Breakdown</CardTitle>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-foreground">
                            €{breakdown.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            €{breakdown.unit_price.toFixed(2)} / unit
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40%]">Operation</TableHead>
                            <TableHead className="text-right">Setup</TableHead>
                            <TableHead className="text-right">Unit</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {breakdown.items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground italic h-24">
                                    No operations costed yet.
                                </TableCell>
                            </TableRow>
                        )}
                        {breakdown.items.map((item, i) => (
                            <TableRow key={i}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span className="text-sm">{item.name}</span>
                                        {item.details && (
                                            <span className="text-[10px] text-muted-foreground font-normal">{item.details}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                    {item.original_setup_cost ? `€${item.original_setup_cost.toFixed(2)}` : (item.setup_cost ? `€${item.setup_cost.toFixed(2)}` : '-')}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                    {item.original_unit_production_cost ? `€${item.original_unit_production_cost.toFixed(4)}` : (item.unit_production_cost ? `€${item.unit_production_cost.toFixed(4)}` : '-')}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    €{item.cost.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={3} className="font-medium">Setup Total</TableCell>
                            <TableCell className="text-right font-mono">€{breakdown.metadata.setup_total.toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50 hover:bg-muted/50 border-t-0">
                            <TableCell colSpan={3} className="font-medium">Production Total</TableCell>
                            <TableCell className="text-right font-mono">€{breakdown.metadata.production_total.toFixed(2)}</TableCell>
                        </TableRow>
                        {(breakdown.metadata.applied_surcharge && breakdown.metadata.applied_surcharge > 0) || (breakdown.metadata.applied_discount && breakdown.metadata.applied_discount > 0) ? (
                            <>
                                <TableRow className="border-t-2 border-gray-300">
                                    <TableCell colSpan={4} className="py-2">
                                        <div className="text-xs text-muted-foreground font-normal">Applied adjustments:</div>
                                    </TableCell>
                                </TableRow>
                                {breakdown.metadata.applied_surcharge && breakdown.metadata.applied_surcharge > 0 ? (
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableCell colSpan={3} className="text-sm text-orange-700 pl-8">
                                            Format Surcharge: +{(breakdown.metadata.applied_surcharge * 100).toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                            (included above)
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {breakdown.metadata.applied_discount && breakdown.metadata.applied_discount > 0 ? (
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableCell colSpan={3} className="text-sm text-green-700 pl-8">
                                            Volume Discount: -{(breakdown.metadata.applied_discount * 100).toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                            (included above)
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
