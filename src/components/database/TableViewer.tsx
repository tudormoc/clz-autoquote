import { ColumnValues } from '@/components/database/ColumnValues';
import { TableFilterForm } from '@/components/database/TableFilterForm';
import { TableRows } from '@/components/database/TableRows';
import { Spinner } from '@/components/ui/Spinner';
import { APP_CONFIG } from '@/config/constants';
import type { DatabaseExplorerState } from '@/hooks/useDatabaseExplorer';
import { APP_COPY, fmt } from '@/locales';

/** The open table: filters, its columns (with the most frequent values of one) and the first rows. */
export function TableViewer({ explorer, table }: { explorer: DatabaseExplorerState; table: string }) {
    const { data, filter, setFilter, values, loading } = explorer;

    return (
        <>
            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-fg">{table}</h2>
                    <p className="text-xs text-fg-subtle mt-1">{fmt(APP_COPY.database.rowLimit, { count: APP_CONFIG.DB_EXPLORER.ROW_LIMIT })}</p>
                </div>
                <TableFilterForm filter={filter} onChange={setFilter} onApply={explorer.applyFilter} />
            </div>

            {loading || !data ? (
                <div className="flex-1 flex items-center justify-center">
                    <Spinner size={32} className="text-primary" />
                </div>
            ) : (
                <div className="flex-1 overflow-auto space-y-6">
                    <ColumnValues
                        columns={data.columns}
                        onPickColumn={explorer.showValues}
                        values={values?.items ?? null}
                        onPickValue={explorer.filterByValue}
                        onClose={explorer.closeValues}
                    />
                    <TableRows columns={data.columns} rows={data.rows} />
                </div>
            )}
        </>
    );
}
