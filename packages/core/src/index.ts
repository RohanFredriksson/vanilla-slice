// @slice/core — light ECS world orchestrating entities, components, and systems.
// Orchestrates the core packages (physics, slicing, spatial, geometry, math);
// it never depends on rendering adapters or framework integrations
// (see ARCHITECTURE.md, ADR 0002/0003).

export * from './types';
export * from './mesh-util';
export * from './systems';
export * from './slice-system';
export * from './world';

export const CORE_PACKAGE = '@slice/core';
