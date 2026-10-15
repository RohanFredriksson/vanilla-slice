# @vanilla-slice/interactions

The Vanilla Slice interaction framework: interaction types, processor registry, per-step event queue, and material evaluation.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/interactions
```

## Overview

The interaction framework: slice, fracture and impact are stateless processors dispatched over a per-step, stably-ordered event queue. New interactions are added as processors rather than new top-level systems. Most users get this through `@vanilla-slice/core`.

**Position in the stack:** Depends on `@vanilla-slice/materials`, `@vanilla-slice/physics`, `@vanilla-slice/spatial`.

## Highlights

- `createInteractionRegistry`, `createInteractionQueue`
- `InteractionProcessor`, `InteractionEvent`, `InteractionDecision` types
- `exceedsFractureThreshold` and material evaluation

## Example

```ts
import { createInteractionRegistry } from '@vanilla-slice/interactions';

// The world type is whatever your processors operate on.
const registry = createInteractionRegistry<{ tick: number }>();
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
