import type { EntityId } from '@vanilla-slice/spatial';
import type { ContactManifold } from '@vanilla-slice/physics';
import type { Material } from '@vanilla-slice/materials';

/**
 * The kind of interaction an object experiences. `slice`, `fracture`,
 * `collision`, and `impact` are active in the current milestones; the remaining
 * values are **reserved** for future milestones and have no processors yet
 * (ADR 0009 — add the processor, not a new top-level system).
 */
export type InteractionType =
  | 'slice'
  | 'fracture'
  | 'collision'
  | 'impact'
  | 'deformation'
  | 'explosion'
  | 'laser'
  | 'constraint-failure';

/**
 * A queued interaction to evaluate. Events are plain data — they carry no
 * behaviour — so the queue stays serialisable and deterministic (ADR 0009).
 */
export interface InteractionEvent {
  readonly type: InteractionType;
  /** The primary entity the interaction targets. */
  readonly entity: EntityId;
  /** A secondary entity, e.g. the other body in a collision/impact. */
  readonly other?: EntityId;
  /** Impact energy (J-ish), for threshold checks against material toughness. */
  readonly energy?: number;
  /** Narrow-phase contact data, when the event originates from a collision. */
  readonly contact?: ContactManifold;
  /**
   * Processor-specific data (e.g. a slice volume). Kept opaque so the framework
   * need not depend on `slicing`/`fracture`; the owning processor narrows it.
   */
  readonly payload?: unknown;
}

/** The result of a processor's `evaluate`: whether it will act on the event. */
export interface InteractionDecision {
  readonly applies: boolean;
}

/** Entities removed and created by applying an interaction. */
export interface InteractionOutcome {
  readonly removed: readonly EntityId[];
  readonly created: readonly EntityId[];
}

/**
 * The context handed to a processor. `world` is the concrete simulation world
 * (typed by the consumer — `core` uses its `SimWorld`), keeping the framework
 * decoupled from `core`. `material` is pre-resolved from the entity's material.
 */
export interface InteractionContext<W> {
  readonly world: W;
  readonly event: InteractionEvent;
  readonly material: Material;
}

/**
 * A stateless unit that handles one {@link InteractionType}. New interactions
 * are added as new processors — never as new top-level systems (ADR 0009).
 */
export interface InteractionProcessor<W> {
  readonly type: InteractionType;
  /** Decide, from event + material data, whether this processor acts. Pure. */
  evaluate(ctx: InteractionContext<W>): InteractionDecision;
  /** Produce the geometry/physics response (spawn/despawn via `world`). */
  apply(ctx: InteractionContext<W>, decision: InteractionDecision): InteractionOutcome;
}
