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
// The representation (requirements.md §1.2). A bank's `ms` is its value AS OF
// `runningSince`; the remaining time is computed by `remainingMs`, never
// stored. So a tick that does not end the round changes nothing but
// `clock.now`, and every transition a client needs to hear about — a spend, a
// reveal, a round end — changes a bank or `runningSince`.
//
// `roundMs` and the four transitions (`startClock`, `settleActive`,
// `stopClock`, `zeroActive`) are internal: exported from this module for the
// room constructor and the reducer, never from index.ts (specs.md §2.6,
// NFR-3.5). `remainingMs` and `displaySeconds` are public: two of the twelve
// runtime exports that specs.md §2.6 names, so a timer card and the reducer
// read the same rule. Phase 4 adds `otherTeam` and `passClock`, internal in
// the same way (specs/phase-4/specs.md §2.3).
//
// Silent failure modes (specs.md §2.3 — each has a named mutation in
// verification.md Gate 7):
// - `runningSince` is 0 in the first round of every room, because engine time
//   starts at 0. Compare it with `!== null`, NEVER by truthiness: a truthiness
//   test treats that round as stopped, while the second round works.
// - `now − runningSince` is the elapsed time. Swapping the two makes a bank
//   that grows; both are `number`, so no type catches it.

import type { ClockState, RoomConfig, Team, TeamBank } from './types.js'

/** A full bank for this room, in whole milliseconds. The only place `roundSeconds × 1000` is written. */
export function roundMs(config: RoomConfig): number {
  return config.roundSeconds * 1000
}

/**
 * The milliseconds `team` has left at engine time `clock.now` (REQ-3.4): an
 * integer ≥ 0. Only the ACTIVE team's bank runs, and only while the clock
 * runs; the inactive bank is never reduced by elapsed time.
 */
export function remainingMs(clock: ClockState, team: Team): number {
  const { ms } = clock.banks[team]
  if (team !== clock.active || clock.runningSince === null) return ms
  return Math.max(0, ms - (clock.now - clock.runningSince))
}

/**
 * The team that is not `team` (Phase 4 — REQ-4.6, REQ-4.7; specs/phase-4/specs.md
 * §2.3). A round's winner is `otherTeam` of the team whose bank emptied, and the
 * turn passes to `otherTeam` of the team that answered.
 */
export function otherTeam(team: Team): Team {
  return team === 'a' ? 'b' : 'a'
}

/** The clock with the active team's bank replaced; nothing else changes. */
const withActiveBank = (clock: ClockState, bank: TeamBank): ClockState => ({
  ...clock,
  banks: { ...clock.banks, [clock.active]: bank },
})

/**
 * The clock of a round just started (REQ-3.5): both banks full, only `team`
 * marked as having started, `team` active, running from engine time `now`.
 */
export function startClock(now: number, team: Team, full: number): ClockState {
  return {
    now,
    active: team,
    runningSince: now,
    banks: {
      a: { ms: full, started: team === 'a' },
      b: { ms: full, started: team === 'b' },
    },
  }
}

/**
 * The active bank settled to what it has left at `clock.now`; `runningSince`
 * unchanged. The building block of every transition that stops the clock.
 */
export function settleActive(clock: ClockState): ClockState {
  const bank = clock.banks[clock.active]
  return withActiveBank(clock, { ...bank, ms: remainingMs(clock, clock.active) })
}

/** Settle, then stop: the remaining time is preserved and nothing drains (REQ-3.8). */
export function stopClock(clock: ClockState): ClockState {
  return { ...settleActive(clock), runningSince: null }
}

/**
 * The turn passes (Phase 4 — REQ-4.6; specs/phase-4/specs.md §2.3): the other
 * team becomes active, its clock running from `clock.now`. Its bank is `full`
 * and marked started on its first turn of the round; on every later turn it is
 * kept as it is — the same object, holding exactly the milliseconds it had when
 * its last turn ended. The prototype's `passTurn`:
 * `nx.started ? nx : {time:this.roundTime, started:true}`.
 *
 * The answering team's bank is not read and not written: `correct`'s
 * `stopClock` already settled it.
 *
 * Silent failure modes (specs/phase-4/specs.md §2.3 — named mutations N1 and N2
 * in its verification.md Gate 6):
 * - The anchor is `clock.now` — the engine time of the `passTurn` that took
 *   effect — never the time the reveal went up and never the end of the hold.
 *   A driver that passes the turn late must not charge the next team for time
 *   the reveal hid its question; and a driver that passes it exactly on time
 *   makes all three the same number, so only a late pass can tell them apart.
 * - `started ? bank : full`, never `full` alone: a team that has already played
 *   this round resumes its frozen bank, it does not get a new one.
 */
export function passClock(clock: ClockState, full: number): ClockState {
  const next = otherTeam(clock.active)
  const bank = clock.banks[next]
  return {
    ...clock,
    active: next,
    runningSince: clock.now,
    banks: { ...clock.banks, [next]: bank.started ? bank : { ms: full, started: true } },
  }
}

/**
 * The round-end clock (REQ-3.7): the active bank at exactly 0 — never
 * negative — and stopped. `active` still names the team whose bank emptied.
 */
export function zeroActive(clock: ClockState): ClockState {
  const bank = clock.banks[clock.active]
  return { ...withActiveBank(clock, { ...bank, ms: 0 }), runningSince: null }
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
