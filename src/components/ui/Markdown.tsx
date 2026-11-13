'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { titleClasses } from '@/components/ui/titleLook';
import { linkClasses } from '@/components/ui/linkLook';

/** Each Markdown element drawn with the app's tokens (no typography plugin); raw HTML in the text is never run */
const ELEMENTS: Components = {
    h1: ({ children }) => <h3 className={titleClasses('panel', 'mt-4 first:mt-0 mb-2')}>{children}</h3>,
    h2: ({ children }) => <h4 className={titleClasses('section', 'mt-4 first:mt-0 mb-2')}>{children}</h4>,
    h3: ({ children }) => <h5 className={titleClasses('label', 'mt-3 first:mt-0 mb-1.5')}>{children}</h5>,
    p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
    ul: ({ children, className }) => <ul className={cn('my-2 pl-5 space-y-1', className?.includes('contains-task-list') ? 'list-none pl-1' : 'list-disc')}>{children}</ul>,
    ol: ({ children }) => <ol className="my-2 pl-5 space-y-1 list-decimal">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed marker:text-fg-muted">{children}</li>,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClasses('accent', 'underline underline-offset-2 break-words')}>
            {children}
        </a>
    ),
    strong: ({ children }) => <strong className="font-semibold text-fg-strong">{children}</strong>,
    code: ({ children }) => <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted text-fg-soft break-all">{children}</code>,
    pre: ({ children }) => <pre className="my-2 p-3 rounded bg-muted overflow-x-auto text-xs">{children}</pre>,
    blockquote: ({ children }) => <blockquote className="my-2 pl-3 border-l-2 border-primary/50 text-fg-secondary">{children}</blockquote>,
    hr: () => <hr className="my-3 border-border" />,
    table: ({ children }) => (
        <div className="my-2 overflow-x-auto">
            <table className="text-xs border border-border">{children}</table>
        </div>
    ),
    th: ({ children }) => <th className="px-2 py-1 border border-border bg-muted text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="px-2 py-1 border border-border">{children}</td>,
    input: ({ checked }) => <input type="checkbox" checked={checked} readOnly className="mr-2 align-middle" />,
};

/** Text written with simple formatting (bold, lists, links, tables, tick lists), shown with the app's look */
export function Markdown({ text, className }: { text: string; className?: string }) {
    return (
        <div className={cn('text-sm text-fg break-words', className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={ELEMENTS}>
                {text}
            </ReactMarkdown>
        </div>
    );
}
