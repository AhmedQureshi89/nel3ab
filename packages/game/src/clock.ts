// The clock (Phase 3) — REQ-3.4, REQ-3.7, REQ-3.9.
// See specs/phase-3/specs.md §2.3.
//
// Every bank is held in whole milliseconds. Seconds appear in exactly two
// places in this package — `config.roundSeconds` and the whole seconds a clock
// displays — and the conversion from the first to milliseconds is written
// once, in `roundMs` below (specs.md §2.2). Units are the silent failure here:
// a `roundSeconds` passed where milliseconds are expected yields a 45ms round
// that ends on the first tick, which looks like a round-end bug, not a unit bug.
//
// `roundMs` is internal: exported from this module for the room constructor
// and the reducer, never from index.ts (specs.md §2.6, NFR-3.5).
// `displaySeconds` is public: it is one of the twelve runtime exports that
// specs.md §2.6 names, so a timer card and the tests read the same rule.

import type { RoomConfig } from './types.js'

/** A full bank for this room, in whole milliseconds. The only place `roundSeconds × 1000` is written. */
export function roundMs(config: RoomConfig): number {
  return config.roundSeconds * 1000
}

/**
 * The whole seconds a clock shows for `ms` milliseconds remaining (REQ-3.9):
 * rounded UP, never below zero, never negative zero.
 *
 * Rounding up is the prototype's `Math.ceil(time)`: a team with 400ms left sees
 * 1, not 0, so a live clock never reads 0 while the round is still in play.
 * The clamp is `Math.max(0, …)` rather than a comparison because `Math.ceil`
 * of a small negative is `-0`, and `Math.max(0, -0)` is `+0` — so no negative
 * input can put "-0" on a timer card. A non-finite input throws, so "NaN" never
 * reaches one either.
 */
export function displaySeconds(ms: number): number {
  if (!Number.isFinite(ms)) {
    throw new RangeError(`displaySeconds needs a finite number of milliseconds; got ${ms}`)
  }
  return Math.max(0, Math.ceil(ms / 1000))
}
