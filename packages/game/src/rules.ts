// The rules' numbers (Phase 3) — REQ-3.2, REQ-3.6, REQ-3.10.
// See specs/phase-3/specs.md §2.2.
//
// In one place, each exported, so that a screen's sub-label ("−٢ ثانية") and
// the reducer read the same value. Every one is the prototype's own
// (design/designs/Nel3ab - Arcade.dc.html, restated in design/README.md and
// design/user-stories.md), and REQ-3.10 requires each to be asserted against
// the value extracted from that file at test time — not remembered.
//
// There is deliberately NO tick constant: `tick(ms)` drains exactly `ms`, and
// how often a driver ticks is the driver's business. Costs are whole
// milliseconds (REQ-3.4, DECIDED 2026-09-30); `roundSeconds` is the one
// configured value kept in seconds, converted once, by `roundMs` in clock.ts.

export const HINT_COST_MS = 2000
export const SKIP_COST_MS = 3000
export const ROUND_SECONDS_DEFAULT = 45
export const ROUND_SECONDS_OPTIONS = [
  20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
] as const
export const WINS_NEEDED_DEFAULT = 3
export const WINS_NEEDED_OPTIONS = [2, 3, 4] as const

// Phase 4 — REQ-4.6, REQ-4.12; specs/phase-4/specs.md §2.2. How long the
// reveal stays up before the turn may pass: the prototype's 1000 ms timer
// before `passTurn`. Measured in engine time, like everything else here.
export const REVEAL_HOLD_MS = 1000
