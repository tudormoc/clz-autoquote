import type { DbColumn, DbRow } from '@/app/db-actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { APP_COPY } from '@/locales';

interface TableRowsProps {
    columns: DbColumn[];
    rows: DbRow[];
}

/** The rows of the open table, one column per database column. */
export function TableRows({ columns, rows }: TableRowsProps) {
    return (
        <div className="border border-border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow still>
                        {columns.map((column) => (
                            <TableHead key={column.COLUMN_NAME} className="px-3 py-2 text-3xs">
                                {column.COLUMN_NAME}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, index) => (
                        <TableRow key={index}>
                            {columns.map((column) => {
                                const value = row[column.COLUMN_NAME];
                                return (
                                    <TableCell key={column.COLUMN_NAME} className="px-3 py-2 whitespace-nowrap text-2xs text-fg-muted font-mono">
                                        {value === null ? <span className="text-fg-faint italic">{APP_COPY.database.nullValue}</span> : String(value)}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
