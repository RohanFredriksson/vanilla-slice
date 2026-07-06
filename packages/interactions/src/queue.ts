import type { InteractionEvent } from './types';

/**
 * A per-step queue of interactions to resolve. Collision/impact detection and
 * slice gestures enqueue events; the interaction system drains them once, after
 * the physics solve, so geometry mutation never happens inside the collision
 * loop (re-entrancy safety, ADR 0009).
 */
export interface InteractionQueue {
  /** Add an event to the queue. */
  enqueue(event: InteractionEvent): void;
  /**
   * Remove and return all queued events in a deterministic order — by primary
   * entity, then the other entity, preserving insertion order for ties — so
   * resolution is stable under the fixed timestep (ADR 0005/0009).
   */
  drain(): InteractionEvent[];
  /** Discard all queued events without returning them. */
  clear(): void;
  /** Number of events currently queued. */
  readonly size: number;
}

/** Create an empty {@link InteractionQueue}. */
export function createInteractionQueue(): InteractionQueue {
  let events: InteractionEvent[] = [];
  return {
    enqueue(event: InteractionEvent): void {
      events.push(event);
    },
    drain(): InteractionEvent[] {
      const drained = events;
      events = [];
      drained.sort(
        (a, b) =>
          (a.entity as number) - (b.entity as number) ||
          ((a.other as number | undefined) ?? -1) -
            ((b.other as number | undefined) ?? -1),
      );
      return drained;
    },
    clear(): void {
      events = [];
    },
    get size(): number {
      return events.length;
    },
  };
}
