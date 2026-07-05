import { describe, it, expect } from 'vitest';
import { createFixedStepper, advance, alpha } from './fixed-timestep';

describe('fixed timestep', () => {
  it('rejects a non-positive timestep', () => {
    expect(() => createFixedStepper(0)).toThrow();
    expect(() => createFixedStepper(-1)).toThrow();
  });

  it('runs one step per whole dt consumed', () => {
    const stepper = createFixedStepper(0.02);
    let count = 0;
    const steps = advance(stepper, 0.05, () => count++);
    expect(steps).toBe(2);
    expect(count).toBe(2);
    expect(stepper.accumulator).toBeCloseTo(0.01, 10);
  });

  it('carries the remainder across frames', () => {
    const stepper = createFixedStepper(0.1);
    const first = advance(stepper, 0.12, () => undefined); // 1 step, ~0.02 left
    expect(first).toBe(1);
    const second = advance(stepper, 0.25, () => undefined); // 0.27 => 2 steps
    expect(second).toBe(2);
    expect(stepper.accumulator).toBeCloseTo(0.07, 6);
  });

  it('clamps to maxSubSteps and drops backlog', () => {
    const stepper = createFixedStepper(0.02, 3);
    let count = 0;
    const steps = advance(stepper, 10, () => count++);
    expect(steps).toBe(3);
    expect(count).toBe(3);
    expect(stepper.accumulator).toBeLessThan(stepper.dt);
  });

  it('reports interpolation alpha', () => {
    const stepper = createFixedStepper(0.02);
    advance(stepper, 0.03, () => undefined); // 0.01 remainder
    expect(alpha(stepper)).toBeCloseTo(0.5, 10);
  });
});
