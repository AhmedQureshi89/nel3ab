// Test support (Phase 3) — the invariants every visited state must satisfy.
// REQ-3.4, REQ-3.7, REQ-3.8, REQ-3.9. See specs/phase-3/specs.md §2.8, whose
// table I1–I10 this file implements row for row.
//
// `assertInvariants(state, prev?)` is called after every step of every sampled
// sequence and scripted scenario (verification.md Gate 3, "Invariants I1–I10
// hold at every step"; Gate 4 reports I5 on its own, "No zero bank in play").
// It throws an `InvariantViolation` naming EVERY invariant that failed, so a
// caller can tally violations by invariant rather than stop at the first.
//
// I7 compares with `prev` only "in the same round". Phase 3's only transition
// that begins a round is `startRound`, which moves the screen from something
// other than `play` INTO `play`; any other pair of consecutive states is in
// the same round. So `prev` may be passed for every step, the `startRound`
// step included — I7 is skipped on exactly that one.
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts` and by other files
// under `testing/`.

import { displaySeconds, remainingMs, roundMs } from '../clock.js'
import { currentQuestion } from '../room.js'
import type { RoomState, Team } from '../types.js'

export const INVARIANT_IDS = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10'] as const
export type InvariantId = (typeof INVARIANT_IDS)[number]

/**
 * Structural equality over plain data — the strictness of `toStrictEqual` for
 * the values a `RoomState` holds: primitives by `Object.is` (so `+0` and `-0`
 * differ), arrays and objects by prototype, own keys and values. Identical
 * references short-circuit, which keeps it cheap over structurally shared
 * states.
 */
export function deepEqual(x: unknown, y: unknown): boolean {
  if (Object.is(x, y)) return true
  if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return false
  if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return false
  const xKeys = Object.keys(x)
  if (xKeys.length !== Object.keys(y).length) return false
  for (const key of xKeys) {
    if (!Object.hasOwn(y, key)) return false
    const xv = (x as Record<string, unknown>)[key]
    const yv = (y as Record<string, unknown>)[key]
    if (!deepEqual(xv, yv)) return false
  }
  return true
}

const isNonNegativeSafeInteger = (n: number): boolean => Number.isSafeInteger(n) && n >= 0

const otherTeam = (team: Team): Team => (team === 'a' ? 'b' : 'a')

/** Every invariant of specs.md §2.8 that `state` (after `prev`, if given) violates; `[]` when all hold. */
export function invariantViolations(state: RoomState, prev?: RoomState): InvariantId[] {
  const violated: InvariantId[] = []
  const { clock, screen, reveal } = state
  const { active, banks, now, runningSince } = clock
  const live = remainingMs(clock, active)

  // I1 — clock.now, both banks.*.ms, questionIndex, hintIndex are non-negative safe integers
  const counters = [now, banks.a.ms, banks.b.ms, state.questionIndex, state.hintIndex]
  if (!counters.every(isNonNegativeSafeInteger)) violated.push('I1')

  // I2 — both banks ≤ roundMs(config)
  const full = roundMs(state.config)
  if (!(banks.a.ms <= full && banks.b.ms <= full)) violated.push('I2')

  // I3 — runningSince is null or an integer in [0, now]
  const anchorInRange =
    runningSince === null ||
    (Number.isInteger(runningSince) && runningSince >= 0 && runningSince <= now)
  if (!anchorInRange) violated.push('I3')

  // I4 — runningSince !== null ⇒ screen === 'play' and reveal === null
  if (runningSince !== null && !(screen === 'play' && reveal === null)) violated.push('I4')

  // I5 — screen === 'play' ⇒ remainingMs(active) > 0: a live bank is never zero
  if (screen === 'play' && !(live > 0)) violated.push('I5')

  // I6 — screen === 'roundEnd' ⇒ banks[active].ms === 0, runningSince === null, reveal === null
  if (
    screen === 'roundEnd' &&
    !(banks[active].ms === 0 && runningSince === null && reveal === null)
  ) {
    violated.push('I6')
  }

  // I7 — with prev in the same round: the inactive team's bank is deep-equal to prev's
  if (prev !== undefined && !(prev.screen !== 'play' && screen === 'play')) {
    const inactive = otherTeam(active)
    if (!deepEqual(banks[inactive], prev.clock.banks[inactive])) violated.push('I7')
  }

  // I8 — in play: hintIndex ≤ currentQuestion(state).h.length
  const question = currentQuestion(state)
  if (screen === 'play' && !(question !== null && state.hintIndex <= question.h.length)) {
    violated.push('I8')
  }

  // I9 — reveal !== null ⇒ it equals { answer: q.a, fact: q.f } of currentQuestion(state)
  if (
    reveal !== null &&
    !(question !== null && deepEqual(reveal, { answer: question.a, fact: question.f }))
  ) {
    violated.push('I9')
  }

  // I10 — in play with no reveal: displaySeconds(remainingMs(active)) ≥ 1 — a live clock never reads 0
  if (screen === 'play' && reveal === null && !(displaySeconds(live) >= 1)) violated.push('I10')

  return violated
}

/** Thrown by `assertInvariants`; `ids` names every invariant that failed, in table order. */
export class InvariantViolation extends Error {
  readonly ids: readonly InvariantId[]

  constructor(ids: readonly InvariantId[]) {
    super(`invariants violated: ${ids.join(', ')}`)
    this.name = 'InvariantViolation'
    this.ids = ids
  }
}

/** Throws an `InvariantViolation` unless every invariant I1–I10 holds for `state` (after `prev`). */
export function assertInvariants(state: RoomState, prev?: RoomState): void {
  const violated = invariantViolations(state, prev)
  if (violated.length > 0) throw new InvariantViolation(violated)
}
