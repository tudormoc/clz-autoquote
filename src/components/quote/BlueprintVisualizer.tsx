'use client';

import React from 'react';

interface BlueprintDimensions {
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

export function BlueprintVisualizer({ dimensions }: BlueprintVisualizerProps) {
  const { boardWidth, boardHeight, spineWidth, hingeGap, turnIn, bleed } = dimensions;

  // Calculate total dimensions
  const totalWidth = turnIn + boardWidth + hingeGap + spineWidth + hingeGap + boardWidth + turnIn;
  const totalHeight = turnIn + boardHeight + turnIn;

  // Calculate key positions
  const spineStart = turnIn + boardWidth + hingeGap;
  const spineEnd = spineStart + spineWidth;
  const frontBoardStart = spineEnd + hingeGap;

  // Padding for dimensions - reduced for more compact view
  const padTop = totalHeight * 0.15;
  const padBottom = totalHeight * 0.15;
  const padX = totalWidth * 0.15;

  const viewBoxX = -bleed - (padX * 0.5);
  const viewBoxY = -bleed - padTop;
  const viewBoxW = totalWidth + (bleed * 2) + (padX * 1.2);
  const viewBoxH = totalHeight + (bleed * 2) + padTop + padBottom;

  // Colors from design system
  const guideColor = "#06b6d4"; // Cyan-500
  const boardColor = "#52525b"; // Zinc-600 - lighter grey for boards
  const foldColor = "#d946ef"; // Fuschia-500
  const dimColor = "#a1a1aa"; // Zinc-400
  const bleedColor = "#ef4444"; // Red-500
  const cutLineColor = "#52525b"; // Zinc-600
  const labelColor = "#ffffff";

  // Dimension line component with smart positioning to avoid overlap
  const DimLine = ({
    x1, y1, x2, y2,
    text,
    vertical = false,
    textAbove = false,
    rotateText = false,
    withExtension = false,
    extensionY = 0,
    extensionX = 0,
    forceOffset = false // Force text to be offset above/below the line
  }: any) => {
    const fontSize = totalWidth * 0.011; // Slightly smaller for better fit
    const tickSize = totalWidth * 0.005;
    const textOffset = fontSize * 0.8;

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const segmentLength = vertical ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
    
    // Calculate if segment is too small for centered text
    const textLength = text.length;
    const estimatedTextWidth = textLength * fontSize * 0.6;
    const isTooSmall = segmentLength < estimatedTextWidth * 1.3;

    let textX = cx;
    let textY = cy;
    let anchor: "start" | "middle" | "end" = "middle";
    let baseline: "auto" | "middle" | "hanging" = "middle";

    if (vertical) {
      if (rotateText) {
        textX = cx - textOffset;
        textY = cy;
        anchor = "middle";
        baseline = "auto";
      } else {
        textX = x1 - tickSize * 3;
        anchor = "end";
      }
    } else {
      // Horizontal dimensions
      if (isTooSmall || forceOffset) {
        // For small segments, move text much higher above the line
        textY = y1 - tickSize - (fontSize * 2.5); // Increased from 1.5 to 2.5
        baseline = "auto";
      } else if (textAbove) {
        textY = y1 - tickSize - textOffset;
        baseline = "auto";
      } else {
        textY = y1 + tickSize + textOffset;
        baseline = "hanging";
      }
    }

    // Calculate background dimensions based on text length
    const bgWidth = textLength * fontSize * 0.65; // Increased from 0.58 for more horizontal padding
    const bgHeight = fontSize * 1.3;
    const bgX = textX - (bgWidth / 2);
    const bgY = textY - (bgHeight / 2);

    return (
      <g>
        {withExtension && !vertical && (
          <>
            <line x1={x1} y1={extensionY} x2={x1} y2={y1} stroke={dimColor} strokeWidth={totalWidth * 0.0005} strokeDasharray="2 2" opacity="0.25" />
            <line x1={x2} y1={extensionY} x2={x2} y2={y2} stroke={dimColor} strokeWidth={totalWidth * 0.0005} strokeDasharray="2 2" opacity="0.25" />
          </>
        )}
        {withExtension && vertical && (
          <>
            <line x1={extensionX} y1={y1} x2={x1} y2={y1} stroke={dimColor} strokeWidth={totalWidth * 0.0005} strokeDasharray="2 2" opacity="0.25" />
            <line x1={extensionX} y1={y2} x2={x2} y2={y2} stroke={dimColor} strokeWidth={totalWidth * 0.0005} strokeDasharray="2 2" opacity="0.25" />
          </>
        )}

        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={dimColor} strokeWidth={totalWidth * 0.001} />

        {vertical ? (
          <>
            <line x1={x1 - tickSize} y1={y1} x2={x1 + tickSize} y2={y1} stroke={dimColor} strokeWidth={totalWidth * 0.001} />
            <line x1={x2 - tickSize} y1={y2} x2={x2 + tickSize} y2={y2} stroke={dimColor} strokeWidth={totalWidth * 0.001} />
          </>
        ) : (
          <>
            <line x1={x1} y1={y1 - tickSize} x2={x1} y2={y1 + tickSize} stroke={dimColor} strokeWidth={totalWidth * 0.001} />
            <line x1={x2} y1={y2 - tickSize} x2={x2} y2={y2 + tickSize} stroke={dimColor} strokeWidth={totalWidth * 0.001} />
          </>
        )}

        {/* Text background for better visibility */}
        <rect
          x={bgX}
          y={bgY - (bgHeight * 0.15)}
          width={bgWidth}
          height={bgHeight}
          fill="#18181b"
          opacity="0.9"
          rx="1.5"
          transform={rotateText ? `rotate(-90, ${textX}, ${textY})` : ""}
        />

        <text
          x={textX}
          y={textY}
          fill="#e4e4e7"
          textAnchor={anchor}
          dominantBaseline={baseline}
          fontSize={fontSize}
          fontWeight="500"
          fontFamily="monospace"
          transform={rotateText ? `rotate(-90, ${textX}, ${textY})` : ""}
        >
          {text}
        </text>
      </g>
    );
  };

  const RegMark = ({ x, y }: { x: number, y: number }) => (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="0" r={totalWidth * 0.002} fill="none" stroke="black" strokeWidth={totalWidth * 0.0005} />
      <line x1={-totalWidth * 0.006} y1="0" x2={totalWidth * 0.006} y2="0" stroke="black" strokeWidth={totalWidth * 0.0005} />
      <line x1="0" y1={-totalWidth * 0.006} x2="0" y2={totalWidth * 0.006} stroke="black" strokeWidth={totalWidth * 0.0005} />
    </g>
  );

  const BleedTick = ({ x }: { x: number }) => (
    <g>
      <line x1={x} y1={-bleed} x2={x} y2={-bleed * 0.2} stroke="black" strokeWidth={totalWidth * 0.001} />
      <line x1={x} y1={totalHeight + bleed} x2={x} y2={totalHeight + bleed * 0.2} stroke="black" strokeWidth={totalWidth * 0.001} />
    </g>
  );

  const labelY = turnIn + (boardHeight * 0.2);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 text-xs font-mono text-zinc-500 z-10 pointer-events-none">
        Blueprint Preview {bleed > 0 && <span className="text-destructive ml-2">• Bleed Active ({bleed}mm)</span>}
      </div>

      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
        className="w-full h-full blueprint-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" style={{ stroke: bleedColor, strokeWidth: 1, opacity: 0.1 }} />
          </pattern>
        </defs>

        {bleed > 0 && (
          <rect
            x={-bleed}
            y={-bleed}
            width={totalWidth + (bleed * 2)}
            height={totalHeight + (bleed * 2)}
            fill="url(#diagonalHatch)"
            stroke={bleedColor}
            strokeWidth={totalWidth * 0.001}
            strokeDasharray="4 2"
          />
        )}

        {bleed > 0 && (
          <>
            <RegMark x={totalWidth / 2} y={-bleed / 2} />
            <RegMark x={-bleed / 2} y={totalHeight / 2} />
            <RegMark x={totalWidth + bleed / 2} y={totalHeight / 2} />
            <RegMark x={totalWidth / 2} y={totalHeight + bleed / 2} />

            <BleedTick x={spineStart} />
            <BleedTick x={spineEnd} />
            <BleedTick x={frontBoardStart} />
            <BleedTick x={turnIn + boardWidth} />
          </>
        )}

        <rect
          x="0"
          y="0"
          width={totalWidth}
          height={totalHeight}
          fill="#f4f4f5"
          stroke={cutLineColor}
          strokeWidth={totalWidth * 0.002}
        />

        <rect
          x={turnIn}
          y={turnIn}
          width={boardWidth}
          height={boardHeight}
          fill={boardColor}
          opacity="0.8"
        />
        <text x={turnIn + boardWidth / 2} y={labelY} textAnchor="middle" fill={labelColor} fontSize={totalWidth * 0.02} fontFamily="monospace" style={{ pointerEvents: 'none' }}>BACK</text>

        <rect
          x={turnIn + boardWidth + hingeGap}
          y={turnIn}
          width={spineWidth}
          height={boardHeight}
          fill={boardColor}
          opacity="0.8"
        />
        <text
          x={turnIn + boardWidth + hingeGap + spineWidth / 2}
          y={labelY}
          textAnchor="middle"
          fill={labelColor}
          fontSize={totalWidth * 0.015}
          fontFamily="monospace"
          transform={`rotate(90, ${turnIn + boardWidth + hingeGap + spineWidth / 2}, ${labelY})`}
          style={{ pointerEvents: 'none' }}
        >
          SPINE
        </text>

        <rect
          x={turnIn + boardWidth + hingeGap + spineWidth + hingeGap}
          y={turnIn}
          width={boardWidth}
          height={boardHeight}
          fill={boardColor}
          opacity="0.8"
        />
        <text x={frontBoardStart + boardWidth / 2} y={labelY} textAnchor="middle" fill={labelColor} fontSize={totalWidth * 0.02} fontFamily="monospace" style={{ pointerEvents: 'none' }}>FRONT</text>

        <line x1="0" y1={turnIn} x2={totalWidth} y2={turnIn} stroke={guideColor} strokeDasharray="4" strokeWidth={totalWidth * 0.001} />
        <line x1="0" y1={totalHeight - turnIn} x2={totalWidth} y2={totalHeight - turnIn} stroke={guideColor} strokeDasharray="4" strokeWidth={totalWidth * 0.001} />
        <line x1={spineStart} y1={0} x2={spineStart} y2={totalHeight} stroke={foldColor} strokeDasharray="4" strokeWidth={totalWidth * 0.002} />
        <line x1={spineEnd} y1={0} x2={spineEnd} y2={totalHeight} stroke={foldColor} strokeDasharray="4" strokeWidth={totalWidth * 0.002} />

        {/* --- Dimensions Annotations --- */}

        {/* Total Width (Top) */}
        <DimLine
          x1={0} y1={-bleed - (totalHeight * 0.06)}
          x2={totalWidth} y2={-bleed - (totalHeight * 0.06)}
          text={`Total Width: ${totalWidth.toFixed(1)}mm`}
          textAbove={true}
        />

        {/* Total Height (Far Left) */}
        <DimLine
          x1={-bleed - (totalWidth * 0.03)} y1={0}
          x2={-bleed - (totalWidth * 0.03)} y2={totalHeight}
          text={`Total Height: ${totalHeight.toFixed(1)}mm`}
          vertical={true}
          rotateText={true}
        />

        {/* Detailed Vertical Breakdown (Right Side) */}
        {(() => {
          const dimRightX = totalWidth + bleed + (totalWidth * 0.03);
          const objRightEdge = totalWidth;

          return (
            <>
              <DimLine
                x1={dimRightX} y1={0}
                x2={dimRightX} y2={turnIn}
                text={`${turnIn}`}
                vertical={true}
                rotateText={true}
                withExtension={true}
                extensionX={objRightEdge}
              />

              <DimLine
                x1={dimRightX} y1={turnIn}
                x2={dimRightX} y2={totalHeight - turnIn}
                text={`${boardHeight}`}
                vertical={true}
                rotateText={true}
                withExtension={true}
                extensionX={objRightEdge}
              />

              <DimLine
                x1={dimRightX} y1={totalHeight - turnIn}
                x2={dimRightX} y2={totalHeight}
                text={`${turnIn}`}
                vertical={true}
                rotateText={true}
                withExtension={true}
                extensionX={objRightEdge}
              />
            </>
          );
        })()}

        {/* Detailed Horizontal Breakdown (Bottom) */}
        {(() => {
          const dimY = totalHeight + bleed + (totalHeight * 0.10); // Increased from 0.06 to 0.10 to move further down
          const objBottom = totalHeight;
          return (
            <>
              <DimLine x1={0} y1={dimY} x2={turnIn} y2={dimY} text={`${turnIn}`} textAbove={true} withExtension={true} extensionY={objBottom} />
              <DimLine x1={turnIn} y1={dimY} x2={turnIn + boardWidth} y2={dimY} text={`${boardWidth}`} textAbove={true} withExtension={true} extensionY={objBottom} />
              <DimLine x1={turnIn + boardWidth} y1={dimY} x2={spineStart} y2={dimY} text={`${hingeGap}`} textAbove={true} withExtension={true} extensionY={objBottom} />
              <DimLine x1={spineStart} y1={dimY} x2={spineEnd} y2={dimY} text={`${spineWidth.toFixed(1)}`} textAbove={true} withExtension={true} extensionY={objBottom} />
              <DimLine x1={spineEnd} y1={dimY} x2={frontBoardStart} y2={dimY} text={`${hingeGap}`} textAbove={true} withExtension={true} extensionY={objBottom} />
              <DimLine x1={frontBoardStart} y1={dimY} x2={frontBoardStart + boardWidth} y2={dimY} text={`${boardWidth}`} textAbove={true} withExtension={true} extensionY={objBottom} />
              <DimLine x1={frontBoardStart + boardWidth} y1={dimY} x2={totalWidth} y2={dimY} text={`${turnIn}`} textAbove={true} withExtension={true} extensionY={objBottom} />
            </>
          );
        })()}
      </svg>
    </div>
  );
}
