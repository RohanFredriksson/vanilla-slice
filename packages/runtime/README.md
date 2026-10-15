# @vanilla-slice/runtime

Framework-agnostic engine loop and swipe-to-slice input for the Vanilla Slice engine.

Part of [Vanilla Slice](https://github.com/RohanFredriksson/vanilla-slice), a framework-agnostic, renderer-agnostic TypeScript engine for physics, mesh slicing and material-driven fracture.

## Install

```bash
npm install @vanilla-slice/runtime
```

## Overview

Framework-agnostic runtime glue: a requestAnimationFrame `EngineLoop` and swipe-to-slice input (`SwipeTracker`, `SwipeSlicer`). Works with any UI framework; nothing here depends on Angular, React or Vue.

**Position in the stack:** Depends on `@vanilla-slice/core`, `@vanilla-slice/math`.

## Highlights

- `EngineLoop` — `start()` / `stop()`, clamped frame delta
- `SwipeSlicer` — pointer events → slice volume → `world.slice`
- `SwipeTracker`, `swipeToSliceVolume`, `intersectRayPlane`

## Example

```ts
import { createWorld } from '@vanilla-slice/core';
import { EngineLoop } from '@vanilla-slice/runtime';

const world = createWorld({ gravity: [0, -9.81, 0] });

const loop = new EngineLoop((dt) => {
  world.update(dt);
});

loop.start();
// later: loop.stop();
```

## Documentation

- [Engine README](https://github.com/RohanFredriksson/vanilla-slice#readme) and package overview
- [Architecture](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ARCHITECTURE.md) · [Specification](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/SPEC.md) · [Roadmap](https://github.com/RohanFredriksson/vanilla-slice/blob/master/docs/ROADMAP.md)

## License

MIT
