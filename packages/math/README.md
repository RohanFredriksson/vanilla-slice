# @vanilla-slice/math

Zero-dependency 3D math primitives (vectors, matrices, quaternions) for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/math
```

## Overview

Zero-dependency 3D math: `Vec2`, `Vec3`, `Mat4` and `Quat` as namespaces of allocation-free functions that write into an `out` argument, plus common helpers (e.g. `toDegrees`).

**Position in the stack:** Foundation — no dependencies.

## Highlights

- `Vec2`, `Vec3`, `Mat4`, `Quat` — function namespaces (`Vec3.add(out, a, b)`, `Vec3.normalize(out, a)`, `Quat.multiply(out, a, b)`, …)
- Types: `Vec3`, `Quat`, `Mat4`, `ReadonlyVec3`, … (type-only exports)
- Common scalar helpers from `common`

## Example

```ts
import { Vec3 } from '@vanilla-slice/math';

const a = Vec3.fromValues(1, 2, 3);
const b = Vec3.fromValues(0, 1, 0);
const sum = Vec3.create();

Vec3.add(sum, a, b); // writes into `sum`, no allocation
Vec3.length(sum);
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
