'use client';

import { useId, useMemo, useRef } from 'react';
import { SYMBOL_GRID, SymbolShape, type FloorPlanSymbolArt } from '@/components/floorplan/SymbolShape';
import { TEXT_WEIGHT } from '@/components/floorplan/textStyle';
import { useFloorPlanMeasure } from '@/hooks/useFloorPlanMeasure';
import { buildScene, type FloorPlanSpec, type Polygon, type SceneText, type TextMeasure } from '@/lib/floorplan';
import { cn } from '@/lib/utils';

/** Line weights and patterns, in millimetres of the sheet */
const STROKE = { outline: 0.8, area: 0.4, wall: 0.4, breakLine: 0.4, cut: 0.4, grid: 0.2, hatch: 0.4 } as const;
const DASH = { grid: '1 1', cut: '1.6 1' } as const;
/** Distance between the lines of the hatch */
const HATCH_STEP = 2.1;
/** The rule under a heading, in heading sizes: how far below the baseline, how long, how thick */
const RULE = { drop: 0.5, length: 2.2, thickness: 0.2 } as const;
const GRID_LABEL_WEIGHT = 600;
/** Room between the letters of the text over the hatch, in sizes */
const EXCLUDED_LABEL_SPACING = 0.3;

const points = (polygon: Polygon) => polygon.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

interface FloorPlanProps {
    /** What to draw. With only a building and a sheet: the bare shape. */
    spec: FloorPlanSpec;
    /** How each symbol of the spec looks, by its id; one without art is drawn as a plain grey square */
    symbolArt?: FloorPlanSymbolArt;
    /** One size (mm) for the lines of several plans shown together: the smallest of their `fitTextSize` */
    textSize?: number;
    /**
     * How wide a text is. Left out, the browser measures with the plan's own font once the page is up; null means
     * someone else is measuring and the plan waits without text (FloorPlanSet).
     */
    measure?: TextMeasure | null;
    /** What the drawing is, for a screen reader; without it the drawing is hidden from them */
    title?: string;
    className?: string;
}

/**
 * A floor plan (src/lib/floorplan) as an SVG in millimetres of its sheet: it fills the width of its box on screen and
 * prints at true size. It holds no content of its own — the spec says what there is, `symbolArt` how its symbols
 * look. Colours are theme tokens (Tailwind fill / stroke classes); the text is the page's font.
 */
export function FloorPlan({ spec, symbolArt, textSize, measure, title, className }: FloorPlanProps) {
    const svg = useRef<SVGSVGElement>(null);
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const measured = useFloorPlanMeasure(svg, measure);

    const scene = useMemo(() => buildScene(spec, measured, { textSize }), [spec, measured, textSize]);

    const text = (item: SceneText, key: number) => (
        <g key={key}>
            <text x={item.x} y={item.y} fontSize={item.size} fontWeight={TEXT_WEIGHT[item.role]} letterSpacing={item.spacing} className={item.role === 'label' ? 'fill-primary' : 'fill-fg'}>
                {item.text}
            </text>
            {item.rule && <rect x={item.x} y={item.y + item.size * RULE.drop} width={item.size * RULE.length} height={item.size * RULE.thickness} className="fill-primary" />}
            {item.marks?.map((mark) => (
                <g key={mark.id} transform={`translate(${mark.x.toFixed(2)} ${mark.y.toFixed(2)}) scale(${(mark.side / SYMBOL_GRID).toFixed(4)})`}>
                    <SymbolShape art={symbolArt?.[mark.id]} />
                </g>
            ))}
        </g>
    );

    return (
        <svg
            ref={svg}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${scene.width} ${scene.height}`}
            className={cn('h-auto w-full font-sans', className)}
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <defs>
                <clipPath id={`${id}-building`}>
                    <path d={scene.outline} />
                </clipPath>
                {scene.clip && (
                    <clipPath id={`${id}-shown`}>
                        <polygon points={points(scene.clip)} />
                    </clipPath>
                )}
                <pattern id={`${id}-hatch`} width={HATCH_STEP} height={HATCH_STEP} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width={HATCH_STEP} height={HATCH_STEP} className="fill-muted-strong" />
                    <line x1="0" y1="0" x2="0" y2={HATCH_STEP} className="stroke-border-strong" strokeWidth={STROKE.hatch} />
                </pattern>
            </defs>

            {scene.grid && (
                <g>
                    <g className="stroke-border-strong" strokeWidth={STROKE.grid} fill="none">
                        <g strokeDasharray={DASH.grid}>
                            {scene.grid.lines.map(([from, to], i) => (
                                <line key={i} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
                            ))}
                        </g>
                        <rect x={scene.grid.frame.x} y={scene.grid.frame.y} width={scene.grid.frame.width} height={scene.grid.frame.height} />
                    </g>
                    <g className="fill-fg-muted" textAnchor="middle" fontWeight={GRID_LABEL_WEIGHT}>
                        {scene.grid.labels.map((label, i) => (
                            <text key={i} x={label.x} y={label.y} fontSize={label.size}>
                                {label.text}
                            </text>
                        ))}
                    </g>
                </g>
            )}

            <g clipPath={scene.clip ? `url(#${id}-shown)` : undefined}>
                <path d={scene.outline} className="fill-muted stroke-fg-strong" strokeWidth={STROKE.outline} strokeLinejoin="miter" />

                {scene.excluded && (
                    <g>
                        {scene.excluded.polygons.map((polygon, i) => (
                            <polygon key={i} points={points(polygon)} fill={`url(#${id}-hatch)`} />
                        ))}
                        {scene.excluded.cuts.map((line, i) => (
                            <polyline key={i} points={points(line)} fill="none" className="stroke-fg-strong" strokeWidth={STROKE.cut} strokeDasharray={DASH.cut} />
                        ))}
                        {scene.excluded.label && (
                            <text
                                transform={`translate(${scene.excluded.label.x} ${scene.excluded.label.y}) rotate(${scene.excluded.label.angle})`}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={scene.excluded.label.size}
                                fontWeight={TEXT_WEIGHT.label}
                                letterSpacing={scene.excluded.label.size * EXCLUDED_LABEL_SPACING}
                                className="fill-fg-muted"
                            >
                                {scene.excluded.label.text}
                            </text>
                        )}
                    </g>
                )}

                {scene.areas.map((area) => (
                    <g key={area.id}>
                        <polygon points={points(area.polygon)} className="fill-card stroke-fg-strong" strokeWidth={STROKE.area} strokeLinejoin="miter" />
                        {area.texts.map(text)}
                    </g>
                ))}

                {scene.walls.length > 0 && (
                    <g clipPath={`url(#${id}-building)`} fill="none" className="stroke-fg-strong" strokeWidth={STROKE.wall}>
                        {scene.walls.map((line, i) => (
                            <polyline key={i} points={points(line)} />
                        ))}
                    </g>
                )}
            </g>

            {scene.breakLines.map((line, i) => (
                <polyline key={i} points={points(line)} fill="none" className="stroke-fg-strong" strokeWidth={STROKE.breakLine} strokeLinejoin="round" />
            ))}
        </svg>
    );
}
