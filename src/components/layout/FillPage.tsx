interface FillPageProps {
    /** The page title row (PageHeader) */
    header: React.ReactNode;
    children: React.ReactNode;
}

/**
 * A page whose content takes the free height on desktop: the title stays put and a list below it (DataTable `fill`)
 * scrolls inside, its column names in view. Content that is taller scrolls under the title. Phones: a normal page.
 */
export function FillPage({ header, children }: FillPageProps) {
    return (
        <div className="lg:h-full lg:flex lg:flex-col">
            {header}
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">{children}</div>
        </div>
    );
}
