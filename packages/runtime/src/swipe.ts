/** A completed swipe gesture in screen (pixel) coordinates. */
export interface Swipe {
  start: [number, number];
  end: [number, number];
}

/** Options for {@link SwipeTracker}. */
export interface SwipeTrackerOptions {
  /** Minimum pixel distance for a gesture to count as a swipe (default 8). */
  minDistance?: number;
}

/**
 * A DOM-agnostic pointer state machine that turns down/move/up events (as plain
 * coordinates) into a {@link Swipe}. Kept free of DOM/framework types so it is
 * headless-testable; the Angular host feeds it pointer events.
 */
export class SwipeTracker {
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private tracking = false;
  private readonly minDistance: number;

  constructor(options: SwipeTrackerOptions = {}) {
    this.minDistance = options.minDistance ?? 8;
  }

  /** Whether a gesture is currently in progress. */
  get active(): boolean {
    return this.tracking;
  }

  /** Begin tracking a gesture at the given point. */
  begin(x: number, y: number): void {
    this.tracking = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
  }

  /** Update the current point (ignored if not tracking). */
  move(x: number, y: number): void {
    if (this.tracking) {
      this.currentX = x;
      this.currentY = y;
    }
  }

  /**
   * End the gesture. Returns the swipe if it traveled at least `minDistance`,
   * otherwise `null` (e.g. a tap).
   */
  end(x: number, y: number): Swipe | null {
    if (!this.tracking) {
      return null;
    }
    this.tracking = false;
    this.currentX = x;
    this.currentY = y;

    const dx = this.currentX - this.startX;
    const dy = this.currentY - this.startY;
    if (Math.hypot(dx, dy) < this.minDistance) {
      return null;
    }
    return {
      start: [this.startX, this.startY],
      end: [this.currentX, this.currentY],
    };
  }

  /** Abort the current gesture without producing a swipe. */
  cancel(): void {
    this.tracking = false;
  }
}
