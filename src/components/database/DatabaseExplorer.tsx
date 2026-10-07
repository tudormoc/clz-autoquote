'use client';

import { DatabaseCards } from '@/components/database/DatabaseCards';
import { TableList } from '@/components/database/TableList';
import { TableViewer } from '@/components/database/TableViewer';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDatabaseExplorer } from '@/hooks/useDatabaseExplorer';
import { APP_COPY } from '@/locales';

/** Database page: connection status of each database and a browser for its tables (first rows, filters, frequent values). */
export function DatabaseExplorer() {
    const explorer = useDatabaseExplorer();

    return (
        <div className="space-y-4">
            <DatabaseCards selected={explorer.db} onSelect={explorer.setDb} connections={explorer.connections} />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <TableList tables={explorer.tables} selected={explorer.table} onSelect={(table) => explorer.openTable(table)} />
                <Card className="lg:col-span-3 p-4 h-[70vh] flex flex-col">
                    {explorer.table ? (
                        <TableViewer explorer={explorer} table={explorer.table} />
                    ) : (
                        <EmptyState className="border-0 m-auto" title={APP_COPY.database.pickTable} />
                    )}
                </Card>
            </div>
        </div>
    );
}
