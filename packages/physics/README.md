# @vanilla-slice/physics

Headless rigid-body physics: fixed-timestep integration, GJK/EPA collisions, and impulse solving for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/physics
```

## Overview

Headless rigid-body physics: fixed-timestep integration, convex-hull collision (GJK + EPA), face-clipping contact manifolds and a sequential-impulse solver with restitution and Coulomb friction. Includes ground half-space contact with tipping/toppling for tall narrow bodies.

**Position in the stack:** Depends on `@vanilla-slice/math`.

## Highlights

- `createBody`, `RigidBody`, inertia helpers
- `integrateBody` and the fixed-timestep accumulator
- Collision: `resolveHalfSpace`, narrow-phase and contact resolution
- `Aabb` helpers and bounds cleanup

## Example

```ts
import { createBody, integrateBody } from '@vanilla-slice/physics';

const body = createBody({ position: [0, 5, 0], mass: 1 });

integrateBody(body, [0, -9.81, 0], 1 / 60);
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
