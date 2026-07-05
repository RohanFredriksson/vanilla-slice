/**
 * Fixed-timestep accumulator. Decouples the fixed simulation step from a
 * variable frame delta so physics advances deterministically (see ADR 0005).
 */
export interface FixedStepper {
  /** The fixed simulation timestep, in seconds. */
  readonly dt: number;
  /** Maximum sub-steps per {@link advance} call, to avoid the "spiral of death". */
  readonly maxSubSteps: number;
  /** Unconsumed time carried into the next frame, in seconds. */
  accumulator: number;
}

/** Create a fixed-timestep accumulator. */
export function createFixedStepper(dt: number, maxSubSteps = 8): FixedStepper {
  if (dt <= 0) {
    throw new Error('Fixed timestep must be positive.');
  }
  return { dt, maxSubSteps, accumulator: 0 };
}

/**
 * Add `frameDelta` to the accumulator and invoke `step` once per whole `dt`
 * consumed, up to `maxSubSteps`. Returns the number of steps taken. Any time
 * beyond `maxSubSteps` is dropped to keep the simulation from falling behind
 * indefinitely.
 */
export function advance(
  stepper: FixedStepper,
  frameDelta: number,
  step: (dt: number) => void,
): number {
  stepper.accumulator += frameDelta;

  let steps = 0;
  while (stepper.accumulator >= stepper.dt && steps < stepper.maxSubSteps) {
    step(stepper.dt);
    stepper.accumulator -= stepper.dt;
    steps++;
  }

  // Drop backlog beyond the sub-step budget.
  if (stepper.accumulator >= stepper.dt) {
    stepper.accumulator = stepper.accumulator % stepper.dt;
  }
  return steps;
}

/**
 * Interpolation factor in `[0, 1)` representing how far the accumulator is
 * toward the next step. Renderers can use this to interpolate between the
 * previous and current physics state for smooth motion.
 */
export function alpha(stepper: FixedStepper): number {
  return stepper.accumulator / stepper.dt;
}
