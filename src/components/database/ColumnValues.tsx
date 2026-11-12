import type { DbColumn, DbValueCount } from '@/app/db-actions';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { Surface, surfaceClasses } from '@/components/ui/Surface';
import { Pressable } from '@/components/ui/Pressable';

const copy = APP_COPY.database;

interface ColumnValuesProps {
    columns: DbColumn[];
    onPickColumn: (column: string) => void;
    /** Most frequent values of the picked column (null until a column is picked) */
    values: DbValueCount[] | null;
    onPickValue: (value: string) => void;
    onClose: () => void;
}

/** Columns of the table as chips; picking one lists its most frequent values, picking a value filters the rows. */
export function ColumnValues({ columns, onPickColumn, values, onPickValue, onClose }: ColumnValuesProps) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-fg-secondary mb-2">{copy.structure}</h3>
                <div className="flex flex-wrap gap-2">
                    {columns.map((column) => (
                        <Pressable
                            key={column.COLUMN_NAME}
                            type="button"
                            onClick={() => onPickColumn(column.COLUMN_NAME)}
                            className={surfaceClasses('panel', 'px-2 py-1 border-border-strong rounded flex flex-col hover:bg-muted hover:border-primary transition-colors text-left')}
                        >
                            <span className="text-3xs font-mono font-bold text-primary">{column.COLUMN_NAME}</span>
                            <span className="text-3xs text-fg-subtle">{column.DATA_TYPE}</span>
                        </Pressable>
                    ))}
                </div>
            </div>

            {values && (
                <Surface kind="soft" className="p-4 bg-card/50 border-border-strong">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.topValues}</h3>
                        <Button variant="ghost" size="sm" onClick={onClose}>{APP_COPY.common.close}</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {values.map(({ value, count }, index) => (
                            <Pressable
                                key={index}
                                type="button"
                                disabled={value === null}
                                onClick={() => onPickValue(String(value))}
                                className="px-2 py-1 bg-muted border border-border-strong rounded enabled:hover:border-primary transition-colors flex items-center gap-2"
                            >
                                <span className="text-xs font-mono font-medium text-fg-soft">{value === null ? copy.nullValue : String(value)}</span>
                                <span className="text-3xs px-1.5 py-0.5 bg-muted-strong text-fg-secondary rounded-full font-bold">{count}</span>
                            </Pressable>
                        ))}
                    </div>
                </Surface>
            )}
        </div>
    );
}
