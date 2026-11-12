// Floor plan module — pure functions, no DB, no React, no text of its own.
// A spec (a building plus whatever a caller puts on it) becomes a scene in millimetres, which
// src/components/floorplan/FloorPlan.tsx draws. See docs/FLOORPLAN.md.
// The static example of the headquarters (hqStatic.ts) is content and is imported by its own path, never from here.

export * from './types';
export * from './options';
export * from './geometry';
export * from './building';
export * from './frame';
export * from './placement';
export * from './textBlock';
export * from './breakLine';
export * from './scene';
export * from './duplicates';
