// -----------------------------------------------------------------------------
// REFERENCE EXAMPLE — not part of the build, lint, or test pipeline.
//
// This is the Angular host that previously lived in `packages/angular`. Per
// ADR 0006, framework integrations live in their own repositories (e.g. a
// `slice-engine-angular` package) that consume the published engine + runtime.
// It is kept here only as a starting point for integrators.
//
// It depends on: @angular/core, three, @vanilla-slice/renderer-three, @vanilla-slice/core, and
// @vanilla-slice/runtime (for the framework-agnostic loop + swipe-to-slice input).
// -----------------------------------------------------------------------------

import {
  Component,
  ElementRef,
  Input,
  NgZone,
  ViewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Vector3,
} from 'three';
import { ThreeRenderer, inverseViewProjection } from '@vanilla-slice/renderer-three';
import { World, createPlane, fromNormalAndPoint } from '@vanilla-slice/core';
import type { Plane } from '@vanilla-slice/core';
import { EngineLoop, SwipeSlicer } from '@vanilla-slice/runtime';

/**
 * Angular host that mounts a canvas, wires a Three.js `WebGLRenderer` to the
 * engine, and runs the imperative {@link EngineLoop} **outside** Angular change
 * detection (ADR 0005 — Angular never drives the loop). Pointer gestures are
 * routed to a {@link SwipeSlicer}.
 *
 * The component only starts/stops the loop and forwards input; all simulation
 * lives in the framework-free engine.
 */
@Component({
  selector: 'slice-engine-host',
  standalone: true,
  template: `<canvas #canvas class="slice-engine-canvas"></canvas>`,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
      }
    `,
  ],
})
export class EngineHostComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  /** The simulation world to render and slice. */
  @Input({ required: true }) world!: World;

  /** The world plane the sliceable objects live on (defaults to z = 0). */
  @Input() playPlane: Plane = fromNormalAndPoint(
    createPlane(),
    [0, 0, 1],
    [0, 0, 0],
  );

  /** Distance of the camera from the origin along +Z. */
  @Input() cameraDistance = 6;

  /** Optional override for the bounded slice radius. */
  @Input() sliceRadius?: number;

  /** Scene clear color. */
  @Input() background = 0x101014;

  private loop?: EngineLoop;
  private renderer?: ThreeRenderer;
  private webgl?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private scene?: Scene;
  private slicer?: SwipeSlicer;
  private resizeObserver?: ResizeObserver;

  private onPointerDown?: (event: PointerEvent) => void;
  private onPointerMove?: (event: PointerEvent) => void;
  private onPointerUp?: (event: PointerEvent) => void;

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    // Everything runs outside Angular so per-frame work never triggers change
    // detection.
    this.zone.runOutsideAngular(() => this.setup());
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private setup(): void {
    const canvas = this.canvasRef.nativeElement;

    this.webgl = new WebGLRenderer({ canvas, antialias: true });
    this.webgl.setClearColor(this.background);

    this.scene = new Scene();
    this.scene.add(new AmbientLight(0xffffff, 0.7));
    const key = new DirectionalLight(0xffffff, 0.8);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    this.camera = new PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.set(0, 0, this.cameraDistance);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new ThreeRenderer({ scene: this.scene });

    this.slicer = new SwipeSlicer({
      world: this.world,
      getViewport: () => ({
        width: canvas.clientWidth || 1,
        height: canvas.clientHeight || 1,
      }),
      getInverseViewProjection: () => inverseViewProjection(this.camera!),
      getViewDirection: () => {
        const direction = this.camera!.getWorldDirection(new Vector3());
        return [direction.x, direction.y, direction.z];
      },
      playPlane: this.playPlane,
      radius: this.sliceRadius,
    });

    this.attachPointerHandlers(canvas);

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    const scene = this.scene;
    const camera = this.camera;
    const webgl = this.webgl;
    const renderer = this.renderer;
    this.loop = new EngineLoop((dt) => {
      this.world.update(dt);
      renderer.sync(this.world);
      webgl.render(scene, camera);
    });
    this.loop.start();
  }

  private resize(): void {
    if (!this.webgl || !this.camera) {
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    this.webgl.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private attachPointerHandlers(canvas: HTMLCanvasElement): void {
    const toLocal = (event: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    this.onPointerDown = (event) => {
      const [x, y] = toLocal(event);
      this.slicer?.pointerDown(x, y);
      canvas.setPointerCapture(event.pointerId);
    };
    this.onPointerMove = (event) => {
      const [x, y] = toLocal(event);
      this.slicer?.pointerMove(x, y);
    };
    this.onPointerUp = (event) => {
      const [x, y] = toLocal(event);
      this.slicer?.pointerUp(x, y);
    };

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
  }

  private teardown(): void {
    this.loop?.stop();
    this.resizeObserver?.disconnect();

    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      if (this.onPointerDown) {
        canvas.removeEventListener('pointerdown', this.onPointerDown);
      }
      if (this.onPointerMove) {
        canvas.removeEventListener('pointermove', this.onPointerMove);
      }
      if (this.onPointerUp) {
        canvas.removeEventListener('pointerup', this.onPointerUp);
      }
    }

    this.renderer?.clear();
    this.webgl?.dispose();
  }
}
