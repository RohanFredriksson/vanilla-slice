# @vanilla-slice/slicing

Bounded slice volumes, candidate filtering, and fragment generation for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/slicing
```

## Overview

Bounded slice volumes — a slice is a plane limited to a region (sphere, cylinder, box or unbounded), never an infinite plane — plus candidate filtering, fragment generation with separation impulses, and screen-space ray helpers for turning a swipe into a slice.

**Position in the stack:** Depends on `@vanilla-slice/geometry`, `@vanilla-slice/spatial`, `@vanilla-slice/math`.

## Highlights

- `createSliceVolume(plane, center, radius)`, `sliceVolume`
- Regions: `sphereRegion`, `cylinderRegion`, `boxRegion`, `unboundedRegion`, `regionContains`
- `sliceVolumeFromSwipe`, `screenToNdc`, `rayFromNdc`, `rayFromScreen`

## Example

```ts
import { createSliceVolume } from '@vanilla-slice/slicing';
import { createPlane, fromNormalAndPoint } from '@vanilla-slice/geometry';

const plane = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 1.5, 0]);

// Cut only within 4 units of (0, 1.5, 0).
const volume = createSliceVolume(plane, [0, 1.5, 0], 4);
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
