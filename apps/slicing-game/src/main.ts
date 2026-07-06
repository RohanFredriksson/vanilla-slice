// apps/slicing-game — Fruit Ninja-style slicing game that CONSUMES the engine.
// The imperative animation loop is owned here (via @vanilla-slice/runtime's EngineLoop)
// and runs independent of any framework change detection (ADR 0005).

import { createWorld, createBox, createPlane, fromNormalAndPoint, defineMaterial } from '@vanilla-slice/core';
import type { Mesh } from '@vanilla-slice/core';
import {
  ThreeRenderer,
  inverseViewProjection,
  InteriorAppearanceRegistry,
} from '@vanilla-slice/renderer-three';
import { EngineLoop, SwipeSlicer } from '@vanilla-slice/runtime';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Vector3,
  MeshStandardMaterial,
} from 'three';

const FRUIT_COLORS = [0xff5252, 0x69f0ae, 0xffd740, 0x40c4ff, 0xb388ff];

/** A running slicing game that can be stopped to release resources. */
export interface SlicingGameHandle {
  stop(): void;
}

/**
 * A box carrying UVs and a rest-pose `tex3` (its local positions), so cut faces
 * can be textured as a solid material interior (ADR 0010).
 */
function texturedBox(size = 1): Mesh {
  const box = createBox(size, size, size);
  const uvs: number[] = [];
  for (let i = 0; i < box.positions.length; i += 3) {
    uvs.push(box.positions[i]! / size + 0.5, box.positions[i + 1]! / size + 0.5);
  }
  return { ...box, uvs, tex3: box.positions.slice() };
}

/**
 * Start the fruit-slicing game on a canvas. Fruits are launched upward on an
 * interval; a pointer swipe slices any fruit within the bounded slice volume.
 */
export function startSlicingGame(canvas: HTMLCanvasElement): SlicingGameHandle {
  const world = createWorld({
    gravity: [0, -9.81, 0],
    bounds: { min: [-20, -20, -20], max: [20, 20, 20] },
    materials: [
      // Watermelon: cuts cleanly; its interior renders as solid red flesh.
      defineMaterial('watermelon', {
        density: 0.9,
        toughness: 1e6,
        brittleness: 0.2,
        restitution: 0.1,
        friction: 0.6,
      }),
    ],
  });

  const webgl = new WebGLRenderer({ canvas, antialias: true });
  webgl.setClearColor(0x0b0b12);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 0.7));
  const key = new DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 6, 5);
  scene.add(key);

  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // Solid watermelon-flesh interior for cut faces, keyed by material id.
  const interior = new InteriorAppearanceRegistry().registerPreset('watermelon', {
    pattern: 'flesh',
    colorA: 0xe23b52,
    colorB: 0xffb3ad,
    frequency: 1.4,
  });

  const renderer = new ThreeRenderer({
    scene,
    interior,
    createMaterial: (item) =>
      item.meshRef === 'watermelon'
        ? new MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 })
        : new MeshStandardMaterial({ color: pickColor(), roughness: 0.5 }),
  });

  const playPlane = fromNormalAndPoint(createPlane(), [0, 0, 1], [0, 0, 0]);
  const slicer = new SwipeSlicer({
    world,
    getViewport: () => ({
      width: canvas.clientWidth || 1,
      height: canvas.clientHeight || 1,
    }),
    getInverseViewProjection: () => inverseViewProjection(camera),
    getViewDirection: () => {
      const direction = camera.getWorldDirection(new Vector3());
      return [direction.x, direction.y, direction.z];
    },
    playPlane,
  });

  const toLocal = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const onDown = (event: PointerEvent): void => {
    const [x, y] = toLocal(event);
    slicer.pointerDown(x, y);
    canvas.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent): void => {
    const [x, y] = toLocal(event);
    slicer.pointerMove(x, y);
  };
  const onUp = (event: PointerEvent): void => {
    const [x, y] = toLocal(event);
    slicer.pointerUp(x, y);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);

  const resize = (): void => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    webgl.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const spawnFruit = (): void => {
    const x = (Math.random() * 2 - 1) * 3;
    world.spawn({
      geometry: texturedBox(1),
      meshRef: 'watermelon',
      material: 'watermelon',
      position: [x, -6, 0],
      velocity: [-x * 0.5, 9 + Math.random() * 2, 0],
      angularVelocity: [Math.random(), Math.random(), Math.random()],
      mass: 1,
      tags: ['fruit'],
    });
  };

  let nextSpawn = 0;
  const loop = new EngineLoop((dt, elapsed) => {
    if (elapsed >= nextSpawn) {
      spawnFruit();
      nextSpawn = elapsed + 1.1;
    }
    world.update(dt);
    renderer.sync(world);
    webgl.render(scene, camera);
  });
  loop.start();

  return {
    stop(): void {
      loop.stop();
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      renderer.clear();
      interior.dispose();
      webgl.dispose();
    },
  };
}

function pickColor(): number {
  return FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)]!;
}

