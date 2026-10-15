# @vanilla-slice/core

Framework-agnostic ECS world orchestrating physics, slicing, spatial, and geometry — the main entry point to the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/core
```

## Overview

A framework-agnostic ECS world that orchestrates physics, slicing, fracture, materials, interactions and spatial queries. It owns all simulation state; renderers only read it. Re-exports the commonly used pieces of the lower packages.

**Position in the stack:** The main entry point — depends on every engine package except the runtime and renderer.

## Highlights

- `createWorld(config)` → `World` with `spawn`, `despawn`, `update(dt)`, `slice(volume)`
- Config: gravity, bounds, materials, collisions, ground plane, `tipFactor`, `smallBodyCulling`
- Re-exports: `createBox`, `createPlane`, `defineMaterial`, `createSliceVolume`, `fractureMesh`, …

## Example

```ts
import { createWorld, createBox, defineMaterial } from '@vanilla-slice/core';

const world = createWorld({
  gravity: [0, -9.81, 0],
  materials: [defineMaterial('glass', { toughness: 0.4, brittleness: 0.85 })],
  // Optional: shrink-dissolve tiny fragments instead of letting them pile up.
  smallBodyCulling: { minVolume: 0.001, delaySeconds: 1 },
});

world.spawn({
  geometry: createBox(1, 1, 1),
  position: [0, 5, 0],
  mass: 1,
  material: 'glass',
  sliceable: true,
});

world.update(1 / 60); // drive from your own loop
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
