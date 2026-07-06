// @vanilla-slice/interactions — the interaction framework.
//
// Framework only: it defines HOW interactions are evaluated and dispatched
// (types, registry, per-step queue, material-evaluation glue), NOT concrete
// world-mutating processors — those live in `core`, which owns entity lifecycle.
// Depends on materials, physics, and spatial (see ARCHITECTURE.md §9, ADR 0009);
// it never depends on core, slicing, or fracture.

export type * from './types';
export * from './registry';
export * from './queue';
export * from './evaluate';

export const INTERACTIONS_PACKAGE = '@vanilla-slice/interactions';
