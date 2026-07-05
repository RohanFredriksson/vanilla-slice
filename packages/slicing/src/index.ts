// @slice/slicing — bounded slice volumes, candidate filtering, and fragment
// generation. Depends on @slice/geometry, @slice/spatial, and @slice/math.
// Slicing computes separation impulses but never applies physics (ADR 0004,
// ownership rules in ARCHITECTURE.md).

export * from './ray';
export * from './slice-volume';
export * from './fragment';

export const SLICING_PACKAGE = '@slice/slicing';
