# @vanilla-slice/materials

Data-driven physical material properties (density, friction, toughness, brittleness) for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/materials
```

## Overview

Data-driven physical material properties (density, friction, restitution, toughness, brittleness, fracture propagation). Behaviour follows from the data, never from object-type branching.

**Position in the stack:** Leaf package — no dependencies.

## Highlights

- `defineMaterial(id, overrides)` — build a `Material` on top of `DEFAULT_MATERIAL`
- `createMaterialLibrary` — a registry keyed by material id
- `massFromDensity`, `fractureThreshold`, `fractureFragmentCount`

## Example

```ts
import { defineMaterial } from '@vanilla-slice/materials';

const glass = defineMaterial('glass', {
  density: 2.5,
  toughness: 0.4,
  brittleness: 0.85,
});
const steel = defineMaterial('steel', { density: 7.8, toughness: 1e6 });
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
