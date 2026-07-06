// apps/spinning-slices — a slicing showcase that CONSUMES the engine.
// A row of slowly spinning sliceable objects on a gravity-free stage; a pointer
// swipe cuts them. The imperative loop is owned here (ADR 0005).

import { createWorld, createBox, createPlane, fromNormalAndPoint, defineMaterial } from '@vanilla-slice/core';
import { ThreeRenderer, inverseViewProjection } from '@vanilla-slice/renderer-three';
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

/** A running spinning-slices showcase that can be stopped to release resources. */
export interface SpinningSlicesHandle {
  stop(): void;
}

/** Start the spinning-slices showcase on a canvas. */
export function startSpinningSlices(canvas: HTMLCanvasElement): SpinningSlicesHandle {
  // Data-driven materials (ADR 0009): brittle glass fractures on impact; tough
  // steel resists. Bounds keep drifting fragments from accumulating forever.
  const world = createWorld({
    gravity: [0, 0, 0],
    bounds: { min: [-14, -9, -9], max: [14, 9, 9] },
    materials: [
      defineMaterial('glass', {
        density: 2.5,
        toughness: 10,
        brittleness: 0.85,
        restitution: 0.1,
      }),
      defineMaterial('steel', {
        density: 7.8,
        toughness: 1e6,
        brittleness: 0,
        friction: 0.4,
      }),
    ],
  });

  const webgl = new WebGLRenderer({ canvas, antialias: true });
  webgl.setClearColor(0x0f0f16);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 0.8));
  const key = new DirectionalLight(0xffffff, 0.7);
  key.position.set(2, 4, 5);
  scene.add(key);

  const camera = new PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);

  const renderer = new ThreeRenderer({
    scene,
    createMaterial: (item) => {
      switch (item.meshRef) {
        case 'steel':
          return new MeshStandardMaterial({
            color: 0x8a8f98,
            roughness: 0.3,
            metalness: 0.6,
          });
        case 'glass':
          return new MeshStandardMaterial({
            color: 0x8ce0ff,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85,
          });
        default:
          return new MeshStandardMaterial({ color: 0x40c4ff, roughness: 0.4 });
      }
    },
  });

  // A row of gently spinning showcase objects.
  for (let i = -2; i <= 2; i++) {
    world.spawn({
      geometry: createBox(1.2, 1.2, 1.2),
      meshRef: 'showcase',
      position: [i * 2, 0, 0],
      angularVelocity: [0.3, 0.6, 0],
      mass: 1,
      tags: ['showcase'],
    });
  }

  // Collision-driven fracture demo (ADR 0009): a static steel slab above the row
  // that launched glass cubes shatter against. Steel's huge toughness makes it
  // immovable and unbreakable; glass fractures because its material says so.
  world.spawn({
    geometry: createBox(0.6, 3, 3),
    meshRef: 'steel',
    position: [0, 3, 0],
    mass: 0,
    material: 'steel',
    tags: ['wall'],
  });

  const launchGlass = (): void => {
    world.spawn({
      geometry: createBox(1, 1, 1),
      meshRef: 'glass',
      position: [-8, 3, 0],
      velocity: [8, 0, 0],
      angularVelocity: [0.6, 0.4, 0.5],
      material: 'glass',
      tags: ['glass'],
    });
  };
  const LAUNCH_INTERVAL = 2.5;
  let sinceLaunch = LAUNCH_INTERVAL;

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
    // Cut thickness perpendicular to the swipe; the cut spans the whole swipe
    // (start -> end) by default, so a single stroke slices every cube in a row.
    radius: 1.2,
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

  const loop = new EngineLoop((dt) => {
    sinceLaunch += dt;
    if (sinceLaunch >= LAUNCH_INTERVAL) {
      sinceLaunch = 0;
      launchGlass();
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
      webgl.dispose();
    },
  };
}

