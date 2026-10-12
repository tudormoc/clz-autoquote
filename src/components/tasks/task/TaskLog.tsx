import { formatIsoDate, formatMoment } from '@/lib/tasks/describe';
import type { ChecklistItem, LogEntry } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';

const log = APP_COPY.tasks.log;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** The words of one log line: what happened, and its details (new dates, notes, fields changed) */
export function logText(entry: LogEntry, checklist: ChecklistItem[]): { action: string; detail: string } {
    const action = (log as Record<string, unknown>)[entry.action];
    const details = entry.details ?? {};
    let detail = '';
    switch (entry.action) {
        case 'changed': {
            const fields = Array.isArray(details.fields) ? details.fields.map((f) => (log.fields as Record<string, string>)[String(f)] ?? String(f)) : [];
            detail = fields.join(', ');
            break;
        }
        case 'postponed':
            detail = [fmt(log.moved, { from: formatIsoDate(text(details.from) || null), to: formatIsoDate(text(details.to) || null) }), text(details.reason)].filter(Boolean).join(' · ');
            break;
        case 'checklist': {
            const step = checklist.find((item) => item.id === details.step);
            detail = `${details.done ? '✓' : '✗'} ${step?.text ?? ''}`.trim();
            break;
        }
        default:
            detail = text(details.text) || text(details.note) || text(details.outcome);
    }
    return { action: typeof action === 'string' ? action : entry.action, detail };
}

/** Every change, completion and comment of the task, newest first */
export function TaskLog({ entries, checklist }: { entries: LogEntry[]; checklist: ChecklistItem[] }) {
    return (
        <>
            {entries.length === 0 ? (
                <p className="text-sm text-fg-subtle">{APP_COPY.tasks.detail.noLog}</p>
            ) : (
                <ol className="space-y-2">
                    {entries.map((entry) => {
                        const { action, detail } = logText(entry, checklist);
                        return (
                            <li key={entry.id} className="text-xs leading-relaxed">
                                <span className="font-mono text-fg-subtle">{formatMoment(entry.at)}</span>
                                <span className="text-fg-muted"> · {entry.personName}</span>
                                <span className="block text-fg">
                                    <span className="font-medium">{action}</span>
                                    {detail && <span className="text-fg-secondary"> — {detail}</span>}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </>
    );
}
