import type { Material } from '@vanilla-slice/materials';
import type {
  InteractionContext,
  InteractionEvent,
  InteractionOutcome,
  InteractionProcessor,
  InteractionType,
} from './types';

/**
 * A registry of {@link InteractionProcessor}s keyed by {@link InteractionType},
 * plus the dispatch used by the interaction system. The registry owns no world
 * state — the concrete world `W` is supplied per call (ADR 0009).
 */
export interface InteractionRegistry<W> {
  /** Register (or replace) the processor for its declared type. */
  register(processor: InteractionProcessor<W>): void;
  /** The processor for a type, if one is registered. */
  get(type: InteractionType): InteractionProcessor<W> | undefined;
  /** Whether a processor is registered for a type. */
  has(type: InteractionType): boolean;
  /**
   * Evaluate and, if the processor applies, apply it. Returns `null` when no
   * processor is registered for the event's type or the processor declines.
   */
  process(
    world: W,
    event: InteractionEvent,
    material: Material,
  ): InteractionOutcome | null;
}

/** Create an empty {@link InteractionRegistry}. */
export function createInteractionRegistry<W>(): InteractionRegistry<W> {
  const processors = new Map<InteractionType, InteractionProcessor<W>>();
  return {
    register(processor: InteractionProcessor<W>): void {
      processors.set(processor.type, processor);
    },
    get(type: InteractionType): InteractionProcessor<W> | undefined {
      return processors.get(type);
    },
    has(type: InteractionType): boolean {
      return processors.has(type);
    },
    process(
      world: W,
      event: InteractionEvent,
      material: Material,
    ): InteractionOutcome | null {
      const processor = processors.get(event.type);
      if (!processor) {
        return null;
      }
      const ctx: InteractionContext<W> = { world, event, material };
      const decision = processor.evaluate(ctx);
      if (!decision.applies) {
        return null;
      }
      return processor.apply(ctx, decision);
    },
  };
}
