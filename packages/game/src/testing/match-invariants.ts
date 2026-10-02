// Test support (Phase 4) — the match invariants every visited state must
// satisfy. REQ-4.14. See specs/phase-4/specs.md §2.10 ("match-invariants.ts"),
// whose table J1–J8 this file implements row for row.
//
// `assertMatchInvariants(state, prev?)` is called after every step of every
// per-length sequence and every scripted match (verification.md Gate 5,
// "Invariants"). It checks Phase 3's I1–I10 TOGETHER WITH this phase's J1–J8:
// I1–I10 through Phase 3's own `invariantViolations` (testing/invariants.ts,
// imported unchanged), which applies to match states as it stands — its I6
// covers `roundEnd`, and J5 below covers `match` — and J1–J8 through
// `matchInvariantViolations` below. It throws a `MatchInvariantViolation`
// naming EVERY invariant of either table that failed, so a caller can tally
// violations by invariant rather than stop at the first. `prev` is for Phase
// 3's I7; no J reads the previous state.
//
// Phase 3's I7 compares the inactive bank with `prev`'s "in the same round",
// and skips exactly the step that moves the screen from something other than
// `play` INTO `play`. In the match flow too that is exactly the step that
// begins a round — `startMatch` from `ready` or `match`, `nextRound` from
// `roundEnd` — and every other pair of consecutive states is in the same
// round: `passTurn` stays on `play`, and leaves the answering team's bank, now
// the inactive one, untouched (specs.md §2.3).
//
// Two readings of the table, stated so that they are not discoveries:
// - J6's row opens "on `play`, `roundEnd` and `match`:", and EVERY clause of
//   the row is read under that opening — the used list's length equals the
//   round only while a round of a match is in play or has just ended. (On
//   `ready` and `setup` the used list is empty and the round is 1.)
// - `unusedCategories(state)` (specs.md §2.4) and `startingTeam(round)`
//   (specs.md §2.5) are restated below from their definitions, not imported
//   from draw.ts and match.ts, so that no invariant trusts the code it checks.
//
// J6's `usedCategories.length === round` holds because the flow never reaches
// the category draw's fallback (requirements.md §1.1, fact 1); a run that
// reached it would show here first (specs.md §2.10).
//
// Test support: excluded from coverage (REQ-4.15, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts` and by
// other files under `testing/`.

import type { CategoryId, RoomState, Screen, Team } from '../types.js'
import { invariantViolations, type InvariantId } from './invariants.js'

export const MATCH_INVARIANT_IDS = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8'] as const
export type MatchInvariantId = (typeof MATCH_INVARIANT_IDS)[number]

/** An invariant of either table: Phase 3's I1–I10 or this phase's J1–J8. */
export type AnyInvariantId = InvariantId | MatchInvariantId

/** specs.md §2.4: `state.pickedCategories` filtered to those not in `state.usedCategories`, selection order kept. */
const unusedCategories = (state: RoomState): readonly CategoryId[] =>
  state.pickedCategories.filter((id) => !state.usedCategories.includes(id))

/** specs.md §2.5: `round % 2 === 1 ? 'a' : 'b'`. */
const startingTeam = (round: number): Team => (round % 2 === 1 ? 'a' : 'b')

/** The screens J6 speaks of: a round of a match in play or just ended. */
const ROUND_SCREENS: readonly Screen[] = ['play', 'roundEnd', 'match']

/** Every invariant J1–J8 of specs.md §2.10 that `state` violates; `[]` when all hold. */
export function matchInvariantViolations(state: RoomState): MatchInvariantId[] {
  const violated: MatchInvariantId[] = []
  const { clock, screen, reveal, revealedAt, log, tallyA, tallyB, round } = state
  const { winsNeeded } = state.config

  // J1 — revealedAt !== null ⇔ reveal !== null; and when non-null, revealedAt
  // is an integer in [0, clock.now], screen === 'play' and runningSince === null
  const j1 =
    (revealedAt !== null) === (reveal !== null) &&
    (revealedAt === null ||
      (Number.isInteger(revealedAt) &&
        revealedAt >= 0 &&
        revealedAt <= clock.now &&
        screen === 'play' &&
        clock.runningSince === null))
  if (!j1) violated.push('J1')

  // J2 — tallyA + tallyB === log.length; each tally equals the number of log
  // entries naming that team; log[i].n === i + 1
  let namingA = 0
  let namingB = 0
  let numbered = true
  log.forEach((entry, i) => {
    if (entry.winner === 'a') namingA += 1
    if (entry.winner === 'b') namingB += 1
    if (entry.n !== i + 1) numbered = false
  })
  if (!(tallyA + tallyB === log.length && tallyA === namingA && tallyB === namingB && numbered)) {
    violated.push('J2')
  }

  // J3 — both tallies ≤ winsNeeded; at most one equals it
  if (!(
    tallyA <= winsNeeded &&
    tallyB <= winsNeeded &&
    !(tallyA === winsNeeded && tallyB === winsNeeded)
  )) {
    violated.push('J3')
  }

  // J4 — on roundEnd: both tallies < winsNeeded and unusedCategories(state) is non-empty
  if (
    screen === 'roundEnd' &&
    !(tallyA < winsNeeded && tallyB < winsNeeded && unusedCategories(state).length > 0)
  ) {
    violated.push('J4')
  }

  // J5 — on match: banks[active].ms === 0, runningSince === null, reveal ===
  // null, and either a tally equals winsNeeded or unusedCategories(state) is empty
  if (
    screen === 'match' &&
    !(
      clock.banks[clock.active].ms === 0 &&
      clock.runningSince === null &&
      reveal === null &&
      (tallyA === winsNeeded || tallyB === winsNeeded || unusedCategories(state).length === 0)
    )
  ) {
    violated.push('J5')
  }

  // J6 — on play, roundEnd and match: categoryId ∈ pickedCategories and
  // categoryId ∈ usedCategories; usedCategories ⊆ pickedCategories, without
  // repeats, and usedCategories.length === round
  if (ROUND_SCREENS.includes(screen)) {
    const { categoryId, pickedCategories: picked, usedCategories: used } = state
    const j6 =
      categoryId !== null &&
      picked.includes(categoryId) &&
      used.includes(categoryId) &&
      used.every((id) => picked.includes(id)) &&
      new Set(used).size === used.length &&
      used.length === round
    if (!j6) violated.push('J6')
  }

  // J7 — on play: banks[startingTeam(round)].started === true
  if (screen === 'play' && clock.banks[startingTeam(round)].started !== true) violated.push('J7')

  // J8 — 0 ≤ judgeIndex < max(1, players.length)
  if (!(state.judgeIndex >= 0 && state.judgeIndex < Math.max(1, state.players.length))) {
    violated.push('J8')
  }

  return violated
}

/** Thrown by `assertMatchInvariants`; `ids` names every invariant that failed — I1–I10 first, then J1–J8, each in table order. */
export class MatchInvariantViolation extends Error {
  readonly ids: readonly AnyInvariantId[]

  constructor(ids: readonly AnyInvariantId[]) {
    super(`invariants violated: ${ids.join(', ')}`)
    this.name = 'MatchInvariantViolation'
    this.ids = ids
  }
}

/** Throws a `MatchInvariantViolation` unless every invariant I1–I10 and J1–J8 holds for `state` (after `prev`). */
export function assertMatchInvariants(state: RoomState, prev?: RoomState): void {
  const violated: AnyInvariantId[] = [
    ...invariantViolations(state, prev),
    ...matchInvariantViolations(state),
  ]
  if (violated.length > 0) throw new MatchInvariantViolation(violated)
}
