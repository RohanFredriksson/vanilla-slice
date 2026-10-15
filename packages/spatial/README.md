# @vanilla-slice/spatial

Spatial hashing and broad-phase queries for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/spatial
```

## Overview

A uniform spatial hash for broad-phase queries, so region, point, sphere and segment lookups avoid O(n²) scans.

**Position in the stack:** Depends on `@vanilla-slice/math`.

## Highlights

- `createSpatialHash(cellSize)`, `insert` / `update` / `remove` / `clear`
- Queries: `queryAabb`, `queryPoint`, `querySphere`, `querySegment`, `queryEntity`, `queryAll`

## Example

```ts
import { createSpatialHash, insert, queryAabb, queryPoint } from '@vanilla-slice/spatial';

const hash = createSpatialHash(2); // cell size

insert(hash, 1, { min: [0, 0, 0], max: [1, 1, 1] });
insert(hash, 2, { min: [5, 5, 5], max: [6, 6, 6] });

queryPoint(hash, [0.5, 0.5, 0.5]); // [1]
queryAabb(hash, { min: [-1, -1, -1], max: [2, 2, 2] }); // [1]
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
