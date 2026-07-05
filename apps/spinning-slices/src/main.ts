// apps/spinning-slices — a slicing showcase that CONSUMES the engine.
// A row of slowly spinning sliceable objects on a gravity-free stage; a pointer
// swipe cuts them. The imperative loop is owned here (ADR 0005).

import { createWorld, createBox, createPlane, fromNormalAndPoint } from '@vanilla-slice/core';
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
  const world = createWorld({ gravity: [0, 0, 0] });

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
    createMaterial: () =>
      new MeshStandardMaterial({ color: 0x40c4ff, roughness: 0.4 }),
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

