import { Vec3 } from '@vanilla-slice/math';
import type { ReadonlyMat4 } from '@vanilla-slice/math';
import { rayFromNdc, screenToNdc, sliceVolumeFromSwipe } from '@vanilla-slice/core';
import type { Plane, Ray, SliceVolume, SliceOutcome, World } from '@vanilla-slice/core';
import { SwipeTracker } from './swipe';
import type { Swipe } from './swipe';

type Vec3T = [number, number, number];

/**
 * Intersect a ray with a plane, returning the world-space hit point or `null`
 * when the ray is parallel to the plane or points away from it.
 */
export function intersectRayPlane(ray: Ray, plane: Plane): Vec3T | null {
  const denom = Vec3.dot(plane.normal, ray.direction);
  if (Math.abs(denom) < 1e-8) {
    return null;
  }
  const t = -(Vec3.dot(plane.normal, ray.origin) + plane.constant) / denom;
  if (t < 0) {
    return null;
  }
  const out: Vec3T = [0, 0, 0];
  return Vec3.scaleAndAdd(out, ray.origin, ray.direction, t);
}

/** Inputs for {@link swipeToSliceVolume}. */
export interface SwipeSliceParams {
  swipe: Swipe;
  width: number;
  height: number;
  /** Inverse view-projection of the camera (e.g. from `inverseViewProjection`). */
  invViewProjection: ReadonlyMat4;
  /** Camera view direction, used to orient the cut plane. */
  viewDirection: Vec3T;
  /** The world plane the sliceable objects live on. */
  playPlane: Plane;
  /**
   * Perpendicular cut thickness in world units (not the reach along the swipe,
   * which spans `start`->`end` by default). Defaults to a fraction of the swipe
   * length — see {@link swipeToSliceVolume}'s underlying `sliceVolumeFromSwipe`.
   */
  radius?: number;
  /**
   * Extend the slice region into a cylinder along the view direction so objects
   * at any depth along the swipe are sliceable (not just those near the play
   * plane). Default `false`.
   */
  extendAlongView?: boolean;
}

/**
 * Convert a screen-space swipe into a bounded world-space {@link SliceVolume}:
 * unproject the swipe endpoints, intersect them with the play plane, then build
 * the slice volume spanned by the swipe and the view direction. Returns `null`
 * if either endpoint does not meet the play plane.
 */
export function swipeToSliceVolume(params: SwipeSliceParams): SliceVolume | null {
  const rayA: Ray = { origin: [0, 0, 0], direction: [0, 0, -1] };
  const rayB: Ray = { origin: [0, 0, 0], direction: [0, 0, -1] };

  const [ax, ay] = screenToNdc(
    params.swipe.start[0],
    params.swipe.start[1],
    params.width,
    params.height,
  );
  const [bx, by] = screenToNdc(
    params.swipe.end[0],
    params.swipe.end[1],
    params.width,
    params.height,
  );
  rayFromNdc(rayA, ax, ay, params.invViewProjection);
  rayFromNdc(rayB, bx, by, params.invViewProjection);

  const worldStart = intersectRayPlane(rayA, params.playPlane);
  const worldEnd = intersectRayPlane(rayB, params.playPlane);
  if (!worldStart || !worldEnd) {
    return null;
  }
  return sliceVolumeFromSwipe(
    worldStart,
    worldEnd,
    params.viewDirection,
    params.radius,
    { extendAlongView: params.extendAlongView ?? false },
  );
}

/** Options for {@link SwipeSlicer}. */
export interface SwipeSlicerOptions {
  /** The world to slice (only its `slice` method is used). */
  world: Pick<World, 'slice'>;
  getViewport: () => { width: number; height: number };
  getInverseViewProjection: () => ReadonlyMat4;
  getViewDirection: () => Vec3T;
  playPlane: Plane;
  /** Perpendicular cut thickness (see {@link SwipeSliceParams.radius}). */
  radius?: number;
  minDistance?: number;
  separationSpeed?: number;
  /** Extend the slice region along the view direction (see {@link SwipeSliceParams}). */
  extendAlongView?: boolean;
}

/**
 * Ties pointer input to slicing: it tracks a swipe and, on release, builds a
 * bounded slice volume and applies it to the world. Framework-agnostic — the
 * Angular host feeds it pointer coordinates.
 */
export class SwipeSlicer {
  private readonly tracker: SwipeTracker;

  constructor(private readonly options: SwipeSlicerOptions) {
    this.tracker = new SwipeTracker({ minDistance: options.minDistance });
  }

  pointerDown(x: number, y: number): void {
    this.tracker.begin(x, y);
  }

  pointerMove(x: number, y: number): void {
    this.tracker.move(x, y);
  }

  /** Complete the gesture and slice the world. Returns the outcome, or `null`. */
  pointerUp(x: number, y: number): SliceOutcome | null {
    const swipe = this.tracker.end(x, y);
    if (!swipe) {
      return null;
    }
    const { width, height } = this.options.getViewport();
    const volume = swipeToSliceVolume({
      swipe,
      width,
      height,
      invViewProjection: this.options.getInverseViewProjection(),
      viewDirection: this.options.getViewDirection(),
      playPlane: this.options.playPlane,
      radius: this.options.radius,
      extendAlongView: this.options.extendAlongView ?? false,
    });
    if (!volume) {
      return null;
    }
    return this.options.world.slice(
      volume,
      this.options.separationSpeed !== undefined
        ? { separationSpeed: this.options.separationSpeed }
        : undefined,
    );
  }

  cancel(): void {
    this.tracker.cancel();
  }
}
