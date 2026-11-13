import type { DbColumn, DbValueCount } from '@/app/db-actions';
import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { Surface } from '@/components/ui/Surface';
import { SurfaceButton } from '@/components/ui/SurfaceButton';
import { titleClasses } from '@/components/ui/titleLook';

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
                <h3 className={titleClasses('section', 'mb-2')}>{copy.structure}</h3>
                <div className="flex flex-wrap gap-2">
                    {columns.map((column) => (
                        <SurfaceButton key={column.COLUMN_NAME} onClick={() => onPickColumn(column.COLUMN_NAME)} className="px-2 py-1 flex flex-col">
                            <span className="text-3xs font-mono font-bold text-primary">{column.COLUMN_NAME}</span>
                            <span className="text-3xs text-fg-subtle">{column.DATA_TYPE}</span>
                        </SurfaceButton>
                    ))}
                </div>
            </div>

            {values && (
                <Surface kind="inset" className="p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className={titleClasses('section')}>{copy.topValues}</h3>
                        <Button variant="ghost" size="sm" onClick={onClose}>{APP_COPY.common.close}</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {values.map(({ value, count }, index) => (
                            <Button key={index} type="button" variant="secondary" size="sm" disabled={value === null} onClick={() => onPickValue(String(value))}>
                                <span className="font-mono">{value === null ? copy.nullValue : String(value)}</span>
                                <span className="opacity-70">({count})</span>
                            </Button>
                        ))}
                    </div>
                </Surface>
            )}
        </div>
    );
}
