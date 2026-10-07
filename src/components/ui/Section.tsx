interface SectionProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
}

/** A titled block inside a settings page (title, one line of explanation, then the content). */
export function Section({ title, description, children }: SectionProps) {
    return (
        <section className="space-y-3">
            <div className="pb-2 border-b border-border/60">
                <h3 className="text-sm font-semibold text-fg-soft">{title}</h3>
                {description && <p className="text-xs text-fg-muted">{description}</p>}
            </div>
            {children}
        </section>
    );
}
