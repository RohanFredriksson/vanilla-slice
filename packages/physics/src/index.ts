// @vanilla-slice/physics — rigid bodies, fixed-timestep integration, gravity, simple
// collision, and bounds cleanup. Depends only on @vanilla-slice/math and is fully
// headless (no rendering). See ARCHITECTURE.md.

export * from './body';
export * from './integration';
export * from './fixed-timestep';
export * from './aabb';
export * from './collision';
export * from './cleanup';

export const PHYSICS_PACKAGE = '@vanilla-slice/physics';
