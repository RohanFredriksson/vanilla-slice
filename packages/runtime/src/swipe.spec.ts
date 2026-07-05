import { describe, it, expect } from 'vitest';
import { SwipeTracker } from './swipe';

describe('SwipeTracker', () => {
  it('produces a swipe for a movement above the threshold', () => {
    const tracker = new SwipeTracker({ minDistance: 8 });
    tracker.begin(100, 100);
    tracker.move(150, 100);
    const swipe = tracker.end(200, 100);
    expect(swipe).toEqual({ start: [100, 100], end: [200, 100] });
    expect(tracker.active).toBe(false);
  });

  it('returns null for a tap below the threshold', () => {
    const tracker = new SwipeTracker({ minDistance: 8 });
    tracker.begin(100, 100);
    expect(tracker.end(103, 101)).toBeNull();
  });

  it('ignores moves and ends when not tracking', () => {
    const tracker = new SwipeTracker();
    tracker.move(50, 50);
    expect(tracker.end(60, 60)).toBeNull();
  });

  it('can be cancelled mid-gesture', () => {
    const tracker = new SwipeTracker();
    tracker.begin(0, 0);
    expect(tracker.active).toBe(true);
    tracker.cancel();
    expect(tracker.active).toBe(false);
    expect(tracker.end(100, 100)).toBeNull();
  });
});
