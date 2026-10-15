# @vanilla-slice/fracture

Voronoi-based real-time fracture fragment generation for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/fracture
```

## Overview

Real-time Voronoi fracture: deterministic seeded fragment generation using neighbour-limited cell clipping, with optional precomputed patterns. Produces closed convex fragments that inherit mesh attribute channels.

**Position in the stack:** Depends on `@vanilla-slice/geometry`.

## Highlights

- `fractureMesh(worldMesh, options)` → fragments
- `createRng(seed)` — deterministic RNG
- Types: `FractureFragment`, `FracturePattern`, `FractureOptions`

## Example

```ts
import { fractureMesh } from '@vanilla-slice/fracture';
import { createBox } from '@vanilla-slice/geometry';

const fragments = fractureMesh(createBox(1, 1, 1), { origin: [0, 0, 0] });
console.log(`${fragments.length} fragments`);
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
