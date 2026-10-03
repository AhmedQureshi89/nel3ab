// Test support (Phase 5) — the setup invariants every visited state must
// satisfy. REQ-5.7. See specs/phase-5/specs.md §2.6 ("setup-invariants.ts"),
// whose table K1–K5 this file implements row for row.
//
// `assertSetupInvariants(state, prev?)` is called after every step of the setup
// sample (testing/setup-sequences.ts) TOGETHER WITH Phase 4's
// `assertMatchInvariants` — which checks Phase 3's I1–I10 through Phase 3's own
// `invariantViolations` and Phase 4's J1–J8 — both imported unchanged
// (verification.md Gate 2, "The invariants, over the sample"). It throws a
// `SetupInvariantViolation` naming EVERY K that failed, so a caller can tally
// violations by invariant rather than stop at the first.
//
// K5 is the one that would catch a setup action leaking into a match: off
// `setup`, nothing a host edits on setup may change, and the judge may move only
// where Phase 4's `nextRound` rotates it. Together with Phase 4's J6
// (`usedCategories.length === round`) it is the record REQ-5.7 asks for.
//
// One reading of K5, stated so that it is not a discovery: its judge clause is
// read as the table writes it — the judge index is `prev`'s, OR, only in a step
// whose screen goes `roundEnd → play` with `rotateJudge` on, the rotated index.
// Whether `nextRound` rotates when it should is Phase 4's REQ-4.9, checked by
// Phase 4's tests; K5 checks that nothing ELSE moves the judge off setup.
//
// Test support: excluded from coverage (REQ-5.9, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts` and by
// other files under `testing/`.

import type { RoomState } from '../types.js'

export const SETUP_INVARIANT_IDS = ['K1', 'K2', 'K3', 'K4', 'K5'] as const
export type SetupInvariantId = (typeof SETUP_INVARIANT_IDS)[number]

/** Every invariant K1–K5 of specs.md §2.6 that `state` (after `prev`, if given) violates; `[]` when all hold. */
export function setupInvariantViolations(state: RoomState, prev?: RoomState): SetupInvariantId[] {
  const violated: SetupInvariantId[] = []
  const { screen, players, pickedCategories } = state

  // K1 — on setup and ready: round === 1, both tallies 0, log and usedCategories
  // empty, categoryId, reveal and revealedAt null
  if (
    (screen === 'setup' || screen === 'ready') &&
    !(
      state.round === 1 &&
      state.tallyA === 0 &&
      state.tallyB === 0 &&
      state.log.length === 0 &&
      state.usedCategories.length === 0 &&
      state.categoryId === null &&
      state.reveal === null &&
      state.revealedAt === null
    )
  ) {
    violated.push('K1')
  }

  // K2 — pickedCategories has no repeats
  if (new Set(pickedCategories).size !== pickedCategories.length) violated.push('K2')

  // K3 — player ids are unique
  if (new Set(players.map((player) => player.id)).size !== players.length) violated.push('K3')

  // K4 — on ready: pickedCategories non-empty; at least two players; at least
  // one on each team
  if (
    screen === 'ready' &&
    !(
      pickedCategories.length > 0 &&
      players.length >= 2 &&
      players.some((player) => player.team === 'a') &&
      players.some((player) => player.team === 'b')
    )
  ) {
    violated.push('K4')
  }

  // K5 — when neither prev nor state is on setup: players, teamA, teamB,
  // rotateJudge and pickedCategories identical (===) to prev's; judgeIndex prev's
  // or — only in a step whose screen goes roundEnd → play — (prev.judgeIndex + 1)
  // mod max(1, players.length) with rotateJudge on
  if (prev !== undefined && prev.screen !== 'setup' && screen !== 'setup') {
    const kept =
      players === prev.players &&
      state.teamA === prev.teamA &&
      state.teamB === prev.teamB &&
      state.rotateJudge === prev.rotateJudge &&
      pickedCategories === prev.pickedCategories
    const rotated =
      prev.screen === 'roundEnd' &&
      screen === 'play' &&
      state.rotateJudge &&
      state.judgeIndex === (prev.judgeIndex + 1) % Math.max(1, players.length)
    if (!(kept && (state.judgeIndex === prev.judgeIndex || rotated))) violated.push('K5')
  }

  return violated
}

/** Thrown by `assertSetupInvariants`; `ids` names every invariant that failed, in table order. */
export class SetupInvariantViolation extends Error {
  readonly ids: readonly SetupInvariantId[]

  constructor(ids: readonly SetupInvariantId[]) {
    super(`setup invariants violated: ${ids.join(', ')}`)
    this.name = 'SetupInvariantViolation'
    this.ids = ids
  }
}

/** Throws a `SetupInvariantViolation` unless every invariant K1–K5 holds for `state` (after `prev`). */
export function assertSetupInvariants(state: RoomState, prev?: RoomState): void {
  const violated = setupInvariantViolations(state, prev)
  if (violated.length > 0) throw new SetupInvariantViolation(violated)
}
