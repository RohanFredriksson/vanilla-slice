import { describe, it, expect } from 'vitest';
import { EngineLoop } from './engine-loop';

/** A manual frame scheduler for deterministic loop testing. */
function manualScheduler() {
  let pending: ((timeMs: number) => void) | null = null;
  let nextHandle = 1;
  return {
    requestFrame: (cb: (timeMs: number) => void): number => {
      pending = cb;
      return nextHandle++;
    },
    cancelFrame: (): void => {
      pending = null;
    },
    flush: (timeMs: number): void => {
      const cb = pending;
      pending = null;
      cb?.(timeMs);
    },
    get hasPending(): boolean {
      return pending !== null;
    },
  };
}

describe('EngineLoop', () => {
  it('ticks with clamped deltas and running elapsed time', () => {
    const sched = manualScheduler();
    const ticks: Array<[number, number]> = [];
    const loop = new EngineLoop((dt, elapsed) => ticks.push([dt, elapsed]), {
      requestFrame: sched.requestFrame,
      cancelFrame: sched.cancelFrame,
    });

    loop.start();
    sched.flush(1000); // first frame: dt 0, elapsed 0
    sched.flush(1016); // dt 0.016, elapsed 0.016
    sched.flush(1032); // dt 0.016, elapsed 0.032
    loop.stop();

    expect(ticks[0]).toEqual([0, 0]);
    expect(ticks[1]![0]).toBeCloseTo(0.016, 10);
    expect(ticks[2]![1]).toBeCloseTo(0.032, 10);
  });

  it('clamps very long frame gaps to maxFrameDelta', () => {
    const sched = manualScheduler();
    let lastDelta = -1;
    const loop = new EngineLoop((dt) => (lastDelta = dt), {
      requestFrame: sched.requestFrame,
      cancelFrame: sched.cancelFrame,
      maxFrameDelta: 0.05,
    });
    loop.start();
    sched.flush(0);
    sched.flush(5000); // 5s gap => clamped to 0.05
    expect(lastDelta).toBe(0.05);
  });

  it('reports running state and stops rescheduling', () => {
    const sched = manualScheduler();
    const loop = new EngineLoop(() => undefined, {
      requestFrame: sched.requestFrame,
      cancelFrame: sched.cancelFrame,
    });
    expect(loop.running).toBe(false);
    loop.start();
    expect(loop.running).toBe(true);
    sched.flush(0);
    expect(sched.hasPending).toBe(true); // rescheduled
    loop.stop();
    expect(loop.running).toBe(false);
  });

  it('does not reschedule when the tick stops the loop', () => {
    const sched = manualScheduler();
    const loop: EngineLoop = new EngineLoop(() => loop.stop(), {
      requestFrame: sched.requestFrame,
      cancelFrame: sched.cancelFrame,
    });
    loop.start();
    sched.flush(0);
    expect(sched.hasPending).toBe(false);
    expect(loop.running).toBe(false);
  });

  it('is idempotent on repeated start/stop', () => {
    const sched = manualScheduler();
    const loop = new EngineLoop(() => undefined, {
      requestFrame: sched.requestFrame,
      cancelFrame: sched.cancelFrame,
    });
    loop.start();
    loop.start(); // no-op
    loop.stop();
    loop.stop(); // no-op
    expect(loop.running).toBe(false);
  });
});
