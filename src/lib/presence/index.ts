// Presence rules module — pure functions, no DB, no React.
// Both the server actions (src/app/presence/*-actions.ts) and the
// dashboard components import from here. See docs/PRESENCE.md.

export * from './types';
export * from './config';
export * from './calendar';
export * from './categories';
export * from './events';
export * from './eventDelete';
export * from './usualExit';
export * from './formulas/rounding';
export * from './formulas/counted-times';
export * from './formulas/distribution';
export * from './formulas/coverage';
export * from './formulas/edit-effects';
