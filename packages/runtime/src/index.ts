// @vanilla-slice/runtime — framework-agnostic browser runtime for the Vanilla Slice.
// Provides the imperative engine loop and swipe-to-slice input. Depends only on
// @vanilla-slice/core and @vanilla-slice/math; consumed by apps and by external framework
// integrations. The engine drives the loop; no framework controls it (ADR 0005).

export * from './engine-loop';
export * from './swipe';
export * from './slice-input';

export const RUNTIME_PACKAGE = '@vanilla-slice/runtime';
