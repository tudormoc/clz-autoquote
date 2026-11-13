'use client';

import { DimensionLine } from '@/components/quote/blueprint/DimensionLine';
import { APP_COPY, fmt } from '@/locales';
import { Surface } from '@/components/ui/Surface';

const copy = APP_COPY.blueprint;

export interface BlueprintDimensions {
    boardWidth: number;
    boardHeight: number;
    spineWidth: number;
    hingeGap: number;
    turnIn: number;
    bleed: number;
}

interface BlueprintVisualizerProps {
    dimensions: BlueprintDimensions;
}

/**
 * Flat drawing of a hard cover (all mm): rimbocco, back board, cerniera, dorso, cerniera, front board, rimbocco,
 * with bleed area, registration marks, fold and turn-in guides and the measurements around it.
 * Colours are theme tokens (Tailwind fill / stroke classes).
 */
export function BlueprintVisualizer({ dimensions }: BlueprintVisualizerProps) {
    const { boardWidth, boardHeight, spineWidth, hingeGap, turnIn, bleed } = dimensions;

    const totalWidth = turnIn + boardWidth + hingeGap + spineWidth + hingeGap + boardWidth + turnIn;
    const totalHeight = turnIn + boardHeight + turnIn;
    const spineStart = turnIn + boardWidth + hingeGap;
    const spineEnd = spineStart + spineWidth;
    const frontBoardStart = spineEnd + hingeGap;

    // Room around the drawing for the measurements
    const padY = totalHeight * 0.15;
    const padX = totalWidth * 0.15;
    const viewBox = [-bleed - padX * 0.5, -bleed - padY, totalWidth + bleed * 2 + padX * 1.2, totalHeight + bleed * 2 + padY * 2].join(' ');

    const stroke = (factor: number) => totalWidth * factor;
    const labelY = turnIn + boardHeight * 0.2;
    const boardLabel = { className: 'fill-fg-strong', fontSize: totalWidth * 0.02, fontFamily: 'monospace', textAnchor: 'middle' as const, pointerEvents: 'none' };

    /** Registration mark (circle with cross) in the bleed area */
    const regMark = (x: number, y: number) => {
        const arm = totalWidth * 0.006;
        return (
            <g key={`${x}-${y}`} transform={`translate(${x}, ${y})`} className="stroke-overlay" strokeWidth={stroke(0.0005)}>
                <circle cx="0" cy="0" r={totalWidth * 0.002} fill="none" />
                <line x1={-arm} y1="0" x2={arm} y2="0" />
                <line x1="0" y1={-arm} x2="0" y2={arm} />
            </g>
        );
    };

    /** Short marks in the top and bottom bleed where a fold or board edge falls */
    const bleedTick = (x: number) => (
        <g key={x} className="stroke-overlay" strokeWidth={stroke(0.001)}>
            <line x1={x} y1={-bleed} x2={x} y2={-bleed * 0.2} />
            <line x1={x} y1={totalHeight + bleed} x2={x} y2={totalHeight + bleed * 0.2} />
        </g>
    );

    const board = (x: number, width: number) => (
        <rect x={x} y={turnIn} width={width} height={boardHeight} className="fill-fg-faint" opacity="0.8" />
    );

    // Measurements along the bottom and the right side, with dashed lines back to the drawing
    const bottomY = totalHeight + bleed + totalHeight * 0.1;
    const bottomSegments: [number, number, string][] = [
        [0, turnIn, `${turnIn}`],
        [turnIn, turnIn + boardWidth, `${boardWidth}`],
        [turnIn + boardWidth, spineStart, `${hingeGap}`],
        [spineStart, spineEnd, spineWidth.toFixed(1)],
        [spineEnd, frontBoardStart, `${hingeGap}`],
        [frontBoardStart, frontBoardStart + boardWidth, `${boardWidth}`],
        [frontBoardStart + boardWidth, totalWidth, `${turnIn}`],
    ];
    const rightX = totalWidth + bleed + totalWidth * 0.03;
    const rightSegments: [number, number, string][] = [
        [0, turnIn, `${turnIn}`],
        [turnIn, totalHeight - turnIn, `${boardHeight}`],
        [totalHeight - turnIn, totalHeight, `${turnIn}`],
    ];

    return (
        <Surface className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative">
            <div className="absolute top-4 left-4 text-xs font-mono text-fg-subtle z-raised pointer-events-none">
                {copy.preview}
                {bleed > 0 && <span className="text-danger ml-2">• {fmt(copy.bleedActive, { mm: bleed })}</span>}
            </div>

            <svg viewBox={viewBox} className="w-full h-full blueprint-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" className="stroke-danger" strokeWidth={1} opacity={0.1} />
                    </pattern>
                </defs>

                {bleed > 0 && (
                    <>
                        <rect
                            x={-bleed}
                            y={-bleed}
                            width={totalWidth + bleed * 2}
                            height={totalHeight + bleed * 2}
                            fill="url(#diagonalHatch)"
                            className="stroke-danger"
                            strokeWidth={stroke(0.001)}
                            strokeDasharray="4 2"
                        />
                        {[
                            [totalWidth / 2, -bleed / 2],
                            [-bleed / 2, totalHeight / 2],
                            [totalWidth + bleed / 2, totalHeight / 2],
                            [totalWidth / 2, totalHeight + bleed / 2],
                        ].map(([x, y]) => regMark(x, y))}
                        {[spineStart, spineEnd, frontBoardStart, turnIn + boardWidth].map(bleedTick)}
                    </>
                )}

                {/* Cover sheet (cut line) and the three boards */}
                <rect x="0" y="0" width={totalWidth} height={totalHeight} className="fill-fg stroke-fg-faint" strokeWidth={stroke(0.002)} />
                {board(turnIn, boardWidth)}
                <text x={turnIn + boardWidth / 2} y={labelY} {...boardLabel}>{copy.back}</text>
                {board(spineStart, spineWidth)}
                <text
                    x={spineStart + spineWidth / 2}
                    y={labelY}
                    {...boardLabel}
                    fontSize={totalWidth * 0.015}
                    transform={`rotate(90, ${spineStart + spineWidth / 2}, ${labelY})`}
                >
                    {copy.spineLabel}
                </text>
                {board(frontBoardStart, boardWidth)}
                <text x={frontBoardStart + boardWidth / 2} y={labelY} {...boardLabel}>{copy.front}</text>

                {/* Turn-in guides and spine folds */}
                <line x1="0" y1={turnIn} x2={totalWidth} y2={turnIn} className="stroke-primary" strokeDasharray="4" strokeWidth={stroke(0.001)} />
                <line x1="0" y1={totalHeight - turnIn} x2={totalWidth} y2={totalHeight - turnIn} className="stroke-primary" strokeDasharray="4" strokeWidth={stroke(0.001)} />
                <line x1={spineStart} y1={0} x2={spineStart} y2={totalHeight} className="stroke-highlight" strokeDasharray="4" strokeWidth={stroke(0.002)} />
                <line x1={spineEnd} y1={0} x2={spineEnd} y2={totalHeight} className="stroke-highlight" strokeDasharray="4" strokeWidth={stroke(0.002)} />

                {/* Overall size */}
                <DimensionLine
                    x1={0} y1={-bleed - totalHeight * 0.06}
                    x2={totalWidth} y2={-bleed - totalHeight * 0.06}
                    text={fmt(copy.totalWidth, { mm: totalWidth.toFixed(1) })}
                    scale={totalWidth}
                    textAbove
                />
                <DimensionLine
                    x1={-bleed - totalWidth * 0.03} y1={0}
                    x2={-bleed - totalWidth * 0.03} y2={totalHeight}
                    text={fmt(copy.totalHeight, { mm: totalHeight.toFixed(1) })}
                    scale={totalWidth}
                    vertical
                    rotateText
                />

                {rightSegments.map(([from, to, text]) => (
                    <DimensionLine
                        key={`r${from}`}
                        x1={rightX} y1={from} x2={rightX} y2={to}
                        text={text}
                        scale={totalWidth}
                        vertical
                        rotateText
                        withExtension
                        extensionX={totalWidth}
                    />
                ))}
                {bottomSegments.map(([from, to, text]) => (
                    <DimensionLine
                        key={`b${from}`}
                        x1={from} y1={bottomY} x2={to} y2={bottomY}
                        text={text}
                        scale={totalWidth}
                        textAbove
                        withExtension
                        extensionY={totalHeight}
                    />
                ))}
            </svg>
        </Surface>
    );
}
