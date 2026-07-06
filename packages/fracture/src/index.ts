// @vanilla-slice/fracture — Voronoi-based fracture fragment generation.
//
// Pure geometry, a sibling of `slicing`: it depends only on `geometry` (and its
// transitive `math`), owns no world state, and applies no impulses. `core`
// spawns the fragments and applies the radial impulses computed here
// (ownership rules, ADR 0009). Runtime generation and optional precomputed
// patterns are both supported; propagation is deferred (ROADMAP Phase 10).

export type * from './types';
export * from './rng';
export * from './voronoi';

export const FRACTURE_PACKAGE = '@vanilla-slice/fracture';
