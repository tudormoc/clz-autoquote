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
        <Card className="border-zinc-800">
            <CardHeader className="bg-zinc-900/50 border-b border-zinc-800">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-white">Price Breakdown</CardTitle>
                    <div className="text-right">
                        <div className="text-xl font-bold text-white font-mono">
                            €{breakdown.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
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
                                <TableCell colSpan={4} className="text-center text-zinc-500 italic h-20">
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
                                            <span className="text-[10px] text-zinc-500 font-normal">{item.details}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-zinc-400">
                                    {item.original_setup_cost ? `€${item.original_setup_cost.toFixed(2)}` : (item.setup_cost ? `€${item.setup_cost.toFixed(2)}` : '-')}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-zinc-400">
                                    {item.original_unit_production_cost ? `€${item.original_unit_production_cost.toFixed(4)}` : (item.unit_production_cost ? `€${item.unit_production_cost.toFixed(4)}` : '-')}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                    €{item.cost.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-zinc-900/30 hover:bg-zinc-900/30">
                            <TableCell colSpan={3} className="font-medium text-xs">Setup Total</TableCell>
                            <TableCell className="text-right font-mono text-sm">€{breakdown.metadata.setup_total.toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-zinc-900/30 hover:bg-zinc-900/30 border-t-0">
                            <TableCell colSpan={3} className="font-medium text-xs">Production Total</TableCell>
                            <TableCell className="text-right font-mono text-sm">€{breakdown.metadata.production_total.toFixed(2)}</TableCell>
                        </TableRow>
                        {(breakdown.metadata.applied_surcharge && breakdown.metadata.applied_surcharge > 0) || (breakdown.metadata.applied_discount && breakdown.metadata.applied_discount > 0) ? (
                            <>
                                <TableRow className="border-t border-zinc-700">
                                    <TableCell colSpan={4} className="py-2">
                                        <div className="text-xs text-zinc-500 font-normal">Applied adjustments:</div>
                                    </TableCell>
                                </TableRow>
                                {breakdown.metadata.applied_surcharge && breakdown.metadata.applied_surcharge > 0 ? (
                                    <TableRow className="bg-zinc-900/20 hover:bg-zinc-900/20">
                                        <TableCell colSpan={3} className="text-xs text-warning-foreground pl-6">
                                            Format Surcharge: +{(breakdown.metadata.applied_surcharge * 100).toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-zinc-500">
                                            (included above)
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {breakdown.metadata.applied_discount && breakdown.metadata.applied_discount > 0 ? (
                                    <TableRow className="bg-zinc-900/20 hover:bg-zinc-900/20">
                                        <TableCell colSpan={3} className="text-xs text-success-foreground pl-6">
                                            Volume Discount: -{(breakdown.metadata.applied_discount * 100).toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-zinc-500">
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
