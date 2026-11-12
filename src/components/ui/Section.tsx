interface SectionProps {
    title: React.ReactNode;
    children: React.ReactNode;
}

/** A titled block inside a settings page (title, then the content). */
export function Section({ title, children }: SectionProps) {
    return (
        <section className="space-y-3">
            <h3 className="pb-2 border-b border-border/60 text-sm font-semibold text-fg-soft">{title}</h3>
            {children}
        </section>
    );
}
