'use client';

import { MatrixRow, MATRIX_COLUMNS, type MatrixTone } from '@/components/cashflow/MatrixRow';
import { amountValues, MONTHS_IN_YEAR, type MonthValues } from '@/lib/cashflow/matrix';
import type { MonthlyAmounts } from '@/lib/cashflow/types';
import { TableCell, TableRow } from '@/components/ui/Table';

interface MatrixItem {
    label: string;
    monthlyAmounts: MonthlyAmounts;
    totalAmount: number;
}

interface ExpandableMatrixCategoryProps {
    title: string;
    items: MatrixItem[];
    tone: MatrixTone;
    expanded: boolean;
    onToggle: () => void;
    /** Total of the category (right column) */
    total: number;
    /** Month figures of the category row (default: the sum of its items) */
    values?: MonthValues;
    /** Opens even without items and shows this line */
    emptyText?: string;
    loading?: boolean;
}

/** A category of the matrix (suppliers, payroll, taxes, clients …): its row, and its items when opened. */
export function ExpandableMatrixCategory({ title, items, tone, expanded, onToggle, total, values, emptyText, loading }: ExpandableMatrixCategoryProps) {
    const expandable = items.length > 0 || !!emptyText;
    const sums = values ?? Array.from({ length: MONTHS_IN_YEAR }, (_, month) => items.reduce((sum, item) => sum + (item.monthlyAmounts[month + 1] || 0), 0));

    return (
        <>
            <MatrixRow
                level="group"
                tone={tone}
                label={title}
                values={sums}
                total={total}
                dashes
                loading={loading}
                expandable={expandable ? { expanded, onToggle } : undefined}
            />
            {expanded &&
                (items.length > 0 ? (
                    items.map((item, index) => (
                        <MatrixRow
                            key={index}
                            level="item"
                            tone={tone}
                            label={item.label}
                            values={amountValues(item.monthlyAmounts)}
                            total={item.totalAmount}
                            dashes
                            loading={loading}
                        />
                    ))
                ) : (
                    <TableRow still className="text-3xs">
                        <TableCell colSpan={MATRIX_COLUMNS} className="pl-10 pr-2 py-1.5 font-medium text-fg-subtle">└ {emptyText}</TableCell>
                    </TableRow>
                ))}
        </>
    );
}
