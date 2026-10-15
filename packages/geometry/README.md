# @vanilla-slice/geometry

Mesh representation, plane intersection, convex hulls, and mesh splitting for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/geometry
```

## Overview

Mesh representation, planes, primitives, plane/mesh splitting with caps, convex hull generation and approximate convex decomposition. Meshes may carry optional `uvs`, `tex3` and per-triangle `groups` channels, preserved across splits.

**Position in the stack:** Depends on `@vanilla-slice/math`.

## Highlights

- `createBox`, `createMesh`, `computeVolume`, `computeBounds`
- `createPlane`, `fromNormalAndPoint`, `fromCoplanarPoints`
- `splitMeshByPlane` — closed fragments with cap faces
- Convex hulls and concave decomposition

## Example

```ts
import { createBox, createPlane, fromNormalAndPoint, computeVolume } from '@vanilla-slice/geometry';

const box = createBox(2, 2, 2);
const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);

computeVolume(box); // 8
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
