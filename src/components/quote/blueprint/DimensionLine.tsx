
interface DimensionLineProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    text: string;
    /** Width of the whole drawing: line and text sizes scale with it */
    scale: number;
    vertical?: boolean;
    textAbove?: boolean;
    rotateText?: boolean;
    /** Dashed extension lines back to the object (at extensionY for horizontal, extensionX for vertical lines) */
    withExtension?: boolean;
    extensionY?: number;
    extensionX?: number;
}

/**
 * A measurement on the blueprint: line with end ticks and the value on a dark label.
 * When the segment is too short for the text, the text moves above the line.
 */
export function DimensionLine({
    x1, y1, x2, y2, text, scale,
    vertical = false,
    textAbove = false,
    rotateText = false,
    withExtension = false,
    extensionY = 0,
    extensionX = 0,
}: DimensionLineProps) {
    const fontSize = scale * 0.011;
    const tickSize = scale * 0.005;
    const textOffset = fontSize * 0.8;
    const thin = scale * 0.0005;
    const line = scale * 0.001;

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const segmentLength = vertical ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
    const isTooSmall = segmentLength < text.length * fontSize * 0.6 * 1.3;

    let textX = cx;
    let textY = cy;
    let anchor: 'start' | 'middle' | 'end' = 'middle';
    let baseline: 'auto' | 'middle' | 'hanging' = 'middle';

    if (vertical) {
        if (rotateText) {
            textX = cx - textOffset;
            baseline = 'auto';
        } else {
            textX = x1 - tickSize * 3;
            anchor = 'end';
        }
    } else if (isTooSmall) {
        textY = y1 - tickSize - fontSize * 2.5;
        baseline = 'auto';
    } else if (textAbove) {
        textY = y1 - tickSize - textOffset;
        baseline = 'auto';
    } else {
        textY = y1 + tickSize + textOffset;
        baseline = 'hanging';
    }

    const bgWidth = text.length * fontSize * 0.65;
    const bgHeight = fontSize * 1.3;
    const rotate = rotateText ? `rotate(-90, ${textX}, ${textY})` : '';
    const dim = 'stroke-fg-muted';

    return (
        <g>
            {withExtension && !vertical && (
                <>
                    <line x1={x1} y1={extensionY} x2={x1} y2={y1} className={dim} strokeWidth={thin} strokeDasharray="2 2" opacity="0.25" />
                    <line x1={x2} y1={extensionY} x2={x2} y2={y2} className={dim} strokeWidth={thin} strokeDasharray="2 2" opacity="0.25" />
                </>
            )}
            {withExtension && vertical && (
                <>
                    <line x1={extensionX} y1={y1} x2={x1} y2={y1} className={dim} strokeWidth={thin} strokeDasharray="2 2" opacity="0.25" />
                    <line x1={extensionX} y1={y2} x2={x2} y2={y2} className={dim} strokeWidth={thin} strokeDasharray="2 2" opacity="0.25" />
                </>
            )}

            <line x1={x1} y1={y1} x2={x2} y2={y2} className={dim} strokeWidth={line} />
            {vertical ? (
                <>
                    <line x1={x1 - tickSize} y1={y1} x2={x1 + tickSize} y2={y1} className={dim} strokeWidth={line} />
                    <line x1={x2 - tickSize} y1={y2} x2={x2 + tickSize} y2={y2} className={dim} strokeWidth={line} />
                </>
            ) : (
                <>
                    <line x1={x1} y1={y1 - tickSize} x2={x1} y2={y1 + tickSize} className={dim} strokeWidth={line} />
                    <line x1={x2} y1={y2 - tickSize} x2={x2} y2={y2 + tickSize} className={dim} strokeWidth={line} />
                </>
            )}

            {/* Dark label behind the value */}
            <rect
                x={textX - bgWidth / 2}
                y={textY - bgHeight / 2 - bgHeight * 0.15}
                width={bgWidth}
                height={bgHeight}
                className="fill-card"
                opacity="0.9"
                rx="1.5"
                transform={rotate}
            />
            <text
                x={textX}
                y={textY}
                className="fill-fg-soft font-mono"
                textAnchor={anchor}
                dominantBaseline={baseline}
                fontSize={fontSize}
                fontWeight="500"
                transform={rotate}
            >
                {text}
            </text>
        </g>
    );
}
