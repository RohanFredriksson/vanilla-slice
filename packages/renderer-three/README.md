# @vanilla-slice/renderer-three

Three.js rendering adapter for the Vanilla Slice engine — maps engine state to meshes and provides raycasting.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/renderer-three three
```

## Overview

Three.js rendering adapter. Reads engine state and maps it to meshes (transform sync, dissolve scale, camera and raycasting helpers); it never owns simulation state. Cut and fracture surfaces can render a material-specific interior (wood grain, marble, flesh, …) through `InteriorAppearanceRegistry`.

**Position in the stack:** Depends on `@vanilla-slice/core`, `@vanilla-slice/math`. Peer dependency: `three >= 0.160`.

## Highlights

- `ThreeRenderer` — `sync(world)`, `clear()`
- `InteriorAppearanceRegistry` — interior presets keyed by material id
- `inverseViewProjection` and other three-utils helpers

## Example

```ts
import { Scene } from 'three';
import { createWorld } from '@vanilla-slice/core';
import { ThreeRenderer } from '@vanilla-slice/renderer-three';

const world = createWorld({ gravity: [0, -9.81, 0] });
const scene = new Scene();
const renderer = new ThreeRenderer({ scene });

// Each frame, after stepping the simulation:
world.update(1 / 60);
renderer.sync(world);
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
