// @vanilla-slice/materials — data-driven physical material properties.
// A leaf package: it depends on nothing (see ARCHITECTURE.md §9, ADR 0009).
// Materials describe *properties* only; behaviour lives in the interaction
// framework and its processors, never here.

export type * from './types';
export * from './material';
export * from './library';

export const MATERIALS_PACKAGE = '@vanilla-slice/materials';
