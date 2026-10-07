import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Spinning loader: small inside buttons and cells, large (with a colour class) when it fills a panel. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
    return <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden />;
}
