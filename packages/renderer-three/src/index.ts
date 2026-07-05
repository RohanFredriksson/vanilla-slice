// @slice/renderer-three — rendering ADAPTER mapping engine state to Three.js.
// Depends on @slice/core, @slice/math, and three. Reads engine state only; it
// never owns or mutates simulation state (ARCHITECTURE.md, ADR 0002).

export * from './three-utils';
export * from './three-renderer';

export const RENDERER_THREE_PACKAGE = '@slice/renderer-three';
