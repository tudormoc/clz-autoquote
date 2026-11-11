import type { ViewTarget } from '@/hooks/useAddress';

interface ViewLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
    /** Where it leads and what a plain click does: `link(...)` of useAddress */
    to: ViewTarget;
}

/** A click the browser should handle itself: another button, or a key held for a new tab / window / download */
export const opensElsewhere = (event: React.MouseEvent) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/**
 * A real link to another view of the same page (a tab, a record): middle-click, Ctrl+click and "copy link" work as
 * on any link, while a plain click changes the view in place, without loading the page again.
 * A link to another page is a Next <Link>.
 */
export function ViewLink({ to, ...rest }: ViewLinkProps) {
    return (
        <a
            {...rest}
            href={to.href}
            onClick={(event) => {
                if (opensElsewhere(event)) return;
                event.preventDefault();
                to.onOpen();
            }}
        />
    );
}
