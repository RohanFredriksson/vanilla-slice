import { describe, it, expect } from 'vitest';
import type { EntityId } from '@vanilla-slice/spatial';
import { DEFAULT_MATERIAL, defineMaterial } from '@vanilla-slice/materials';
import { createInteractionRegistry } from './registry';
import type {
  InteractionContext,
  InteractionEvent,
  InteractionOutcome,
  InteractionProcessor,
} from './types';

interface FakeWorld {
  log: string[];
}

const sliceEvent: InteractionEvent = { type: 'slice', entity: 7 as EntityId };

function makeProcessor(
  overrides: Partial<InteractionProcessor<FakeWorld>> = {},
): InteractionProcessor<FakeWorld> {
  return {
    type: 'slice',
    evaluate: () => ({ applies: true }),
    apply: (ctx: InteractionContext<FakeWorld>): InteractionOutcome => {
      ctx.world.log.push('applied');
      return { removed: [ctx.event.entity], created: [] };
    },
    ...overrides,
  };
}

describe('createInteractionRegistry', () => {
  it('registers and looks up processors by type', () => {
    const registry = createInteractionRegistry<FakeWorld>();
    expect(registry.has('slice')).toBe(false);
    const processor = makeProcessor();
    registry.register(processor);
    expect(registry.has('slice')).toBe(true);
    expect(registry.get('slice')).toBe(processor);
  });

  it('processes an event through the matching processor', () => {
    const registry = createInteractionRegistry<FakeWorld>();
    registry.register(makeProcessor());
    const world: FakeWorld = { log: [] };
    const outcome = registry.process(world, sliceEvent, DEFAULT_MATERIAL);
    expect(world.log).toEqual(['applied']);
    expect(outcome).toEqual({ removed: [7], created: [] });
  });

  it('returns null when no processor is registered for the type', () => {
    const registry = createInteractionRegistry<FakeWorld>();
    const world: FakeWorld = { log: [] };
    expect(registry.process(world, sliceEvent, DEFAULT_MATERIAL)).toBeNull();
  });

  it('returns null and does not apply when the processor declines', () => {
    const registry = createInteractionRegistry<FakeWorld>();
    registry.register(makeProcessor({ evaluate: () => ({ applies: false }) }));
    const world: FakeWorld = { log: [] };
    expect(registry.process(world, sliceEvent, defineMaterial('x'))).toBeNull();
    expect(world.log).toEqual([]);
  });

  it('replaces a processor when re-registered for the same type', () => {
    const registry = createInteractionRegistry<FakeWorld>();
    registry.register(makeProcessor());
    const replacement = makeProcessor();
    registry.register(replacement);
    expect(registry.get('slice')).toBe(replacement);
  });
});
