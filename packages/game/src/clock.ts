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

import type { RoomConfig } from './types.js'

/** A full bank for this room, in whole milliseconds. The only place `roundSeconds × 1000` is written. */
export function roundMs(config: RoomConfig): number {
  return config.roundSeconds * 1000
}
