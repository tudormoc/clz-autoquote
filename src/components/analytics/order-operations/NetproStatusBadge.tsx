import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';

const TONES: Record<string, StatusTone> = { EXE: 'info', SUS: 'warning', COM: 'success', REL: 'highlight' };

/** Status of a NetPro operation: running (EXE), suspended (SUS), completed (COM), released (REL). */
export function NetproStatusBadge({ status }: { status: string }) {
    return <StatusBadge tone={TONES[status] ?? 'neutral'}>{status}</StatusBadge>;
}
