// @slice/core — light ECS world orchestrating entities, components, and systems.
// Orchestrates the core packages (physics, slicing, spatial, geometry, math);
// it never depends on rendering adapters or framework integrations
// (see ARCHITECTURE.md, ADR 0002/0003).

export * from './types';
export * from './mesh-util';
export * from './systems';
export * from './slice-system';
export * from './world';

// Facade: re-export the curated public API of the underlying engine packages so
// adapters and apps depend on @slice/core alone (respecting the layering rules).
export type { Mesh, Plane } from '@slice/geometry';
export {
  createBox,
  createPlane,
  fromNormalAndPoint,
  fromCoplanarPoints,
  computeVolume,
  computeBounds,
} from '@slice/geometry';
export type { SliceVolume, Fragment, Ray } from '@slice/slicing';
export {
  createSliceVolume,
  sliceVolumeFromSwipe,
  screenToNdc,
  rayFromNdc,
  rayFromScreen,
} from '@slice/slicing';

export const CORE_PACKAGE = '@slice/core';
