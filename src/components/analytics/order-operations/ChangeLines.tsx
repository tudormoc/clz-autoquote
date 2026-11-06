interface ChangeLinesProps {
    title: string;
    count: number;
    lines: string[];
}

/** What changes or differs of one kind: its name, how many and one line each (the Riallinea window, the orders to realign). */
export function ChangeLines({ title, count, lines }: ChangeLinesProps) {
    return (
        <div>
            <p className="font-semibold text-fg">
                {title} <span className="font-normal text-fg-muted">({count})</span>
            </p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-fg-muted">
                {lines.map((line, index) => (
                    <li key={index} className="break-words">{line}</li>
                ))}
            </ul>
        </div>
    );
}
