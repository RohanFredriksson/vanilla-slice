// @vanilla-slice/renderer-three — rendering ADAPTER mapping engine state to Three.js.
// Depends on @vanilla-slice/core, @vanilla-slice/math, and three. Reads engine state only; it
// never owns or mutates simulation state (ARCHITECTURE.md, ADR 0002).

export * from './three-utils';
export * from './three-renderer';
export * from './interior-appearance';

export const RENDERER_THREE_PACKAGE = '@vanilla-slice/renderer-three';
