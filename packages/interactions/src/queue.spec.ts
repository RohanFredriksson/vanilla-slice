import { describe, it, expect } from 'vitest';
import type { EntityId } from '@vanilla-slice/spatial';
import { createInteractionQueue } from './queue';
import type { InteractionEvent } from './types';

const ev = (entity: number, other?: number): InteractionEvent => ({
  type: 'impact',
  entity: entity as EntityId,
  ...(other !== undefined ? { other: other as EntityId } : {}),
});

describe('createInteractionQueue', () => {
  it('starts empty', () => {
    const queue = createInteractionQueue();
    expect(queue.size).toBe(0);
    expect(queue.drain()).toEqual([]);
  });

  it('enqueues and reports size', () => {
    const queue = createInteractionQueue();
    queue.enqueue(ev(1));
    queue.enqueue(ev(2));
    expect(queue.size).toBe(2);
  });

  it('drains and clears the queue', () => {
    const queue = createInteractionQueue();
    queue.enqueue(ev(1));
    const drained = queue.drain();
    expect(drained).toHaveLength(1);
    expect(queue.size).toBe(0);
  });

  it('drains in a deterministic order (by entity, then other)', () => {
    const queue = createInteractionQueue();
    queue.enqueue(ev(3, 1));
    queue.enqueue(ev(1, 2));
    queue.enqueue(ev(1, 1));
    queue.enqueue(ev(2));
    const order = queue.drain().map((e) => [e.entity, e.other ?? -1]);
    expect(order).toEqual([
      [1, 1],
      [1, 2],
      [2, -1],
      [3, 1],
    ]);
  });

  it('clear discards without returning', () => {
    const queue = createInteractionQueue();
    queue.enqueue(ev(1));
    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.drain()).toEqual([]);
  });
});
