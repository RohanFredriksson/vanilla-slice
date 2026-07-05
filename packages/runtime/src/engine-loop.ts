/** A tick callback receiving the clamped frame delta and total elapsed seconds. */
export type TickFn = (deltaSeconds: number, elapsedSeconds: number) => void;

/** Options for {@link EngineLoop}, with injectable scheduling for testing. */
export interface EngineLoopOptions {
  /** Schedule a frame; defaults to `requestAnimationFrame`. */
  requestFrame?: (callback: (timeMs: number) => void) => number;
  /** Cancel a scheduled frame; defaults to `cancelAnimationFrame`. */
  cancelFrame?: (handle: number) => void;
  /** Clamp for the per-frame delta, in seconds (default 0.1). */
  maxFrameDelta?: number;
}

/**
 * An imperative, engine-driven animation loop. It owns `requestAnimationFrame`
 * and calls a tick callback each frame with a clamped delta. Frameworks must not
 * drive or gate this loop (ADR 0005); the Angular host merely starts/stops it
 * outside change detection.
 */
export class EngineLoop {
  private handle: number | null = null;
  private lastTime = Number.NaN;
  private startTime = Number.NaN;
  private readonly requestFrame: (cb: (timeMs: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly maxFrameDelta: number;

  constructor(
    private readonly tick: TickFn,
    options: EngineLoopOptions = {},
  ) {
    this.requestFrame =
      options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((h) => cancelAnimationFrame(h));
    this.maxFrameDelta = options.maxFrameDelta ?? 0.1;
  }

  /** Whether the loop is currently running. */
  get running(): boolean {
    return this.handle !== null;
  }

  /** Start the loop. No-op if already running. */
  start(): void {
    if (this.running) {
      return;
    }
    this.lastTime = Number.NaN;
    this.startTime = Number.NaN;
    this.handle = this.requestFrame(this.frame);
  }

  /** Stop the loop. No-op if already stopped. */
  stop(): void {
    if (this.handle !== null) {
      this.cancelFrame(this.handle);
      this.handle = null;
    }
  }

  private readonly frame = (timeMs: number): void => {
    if (Number.isNaN(this.startTime)) {
      this.startTime = timeMs;
      this.lastTime = timeMs;
    }

    let delta = (timeMs - this.lastTime) / 1000;
    if (delta < 0) {
      delta = 0;
    } else if (delta > this.maxFrameDelta) {
      delta = this.maxFrameDelta;
    }
    this.lastTime = timeMs;

    this.tick(delta, (timeMs - this.startTime) / 1000);

    // Reschedule only if the tick did not stop the loop.
    if (this.handle !== null) {
      this.handle = this.requestFrame(this.frame);
    }
  };
}
