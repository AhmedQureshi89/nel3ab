// The round and match flow (Phase 4) — REQ-4.1, REQ-4.4 – REQ-4.10.
// See specs/phase-4/specs.md §2.5, and §2.6 for the reducer cases built on it.
//
// Everything between one round of a match and the next: which team starts a
// round, who judges it, how it starts, how it is scored in the step it ends,
// and who won the match. The reducer calls these; none of them calls the
// reducer, and none draws anything — a round's category and question order
// arrive in the action that starts it (REQ-4.1, DECIDED 2026-10-02).
//
// `matchWinner` is public. `startingTeam`, `nextJudgeIndex`,
// `assertRoundPayload`, `beginRound` and `scoreRound` are internal: exported
// from this module for the reducer, never from index.ts (specs.md §2.8).
//
// "A round of a match" is a round with a category (requirements.md, reading 1).
// Phase 3's `startRound` sets none, so a round it starts ends exactly as Phase 3
// specified — `roundEnd`, no tally, no log — and `scoreRound` leaves it alone.
//
// Coverage rule (REQ-4.15, inherited from REQ-3.12): every branch here is
// reachable by some input. A branch nothing can reach is deleted, not ignored.

import { otherTeam, roundMs, startClock } from './clock.js'
import { nextRoundChoices, unusedCategories } from './draw.js'
import type { CategoryId, Question, RoomState, Team } from './types.js'

/**
 * The match's result (REQ-4.8): the team with more round wins, or `null` when
 * the tallies are equal — a tie, which a match reaches only by running out of
 * categories. Meaningful on `match`; defined on every screen.
 */
export function matchWinner(state: RoomState): Team | null {
  if (state.tallyA > state.tallyB) return 'a'
  if (state.tallyB > state.tallyA) return 'b'
  return null
}

/**
 * The team that starts round `round` (REQ-4.5): a on odd rounds, b on even —
 * the prototype's `startingTeam` getter, verbatim. Alternating the start is
 * what makes a silent match fair: the team that starts a round is the team
 * whose clock runs first.
 */
export function startingTeam(round: number): Team {
  return round % 2 === 1 ? 'a' : 'b'
}

/**
 * The judge index for the next round (REQ-4.9): rotated when the rotation
 * toggle is on, unchanged otherwise — the prototype's `nextRound` line,
 * verbatim. `max(1, …)` keeps a room with no players at index 0
 * (requirements.md, reading 6). Only `nextRound` calls this: neither a match's
 * first round nor a rematch rotates the judge.
 */
export function nextJudgeIndex(state: RoomState): number {
  return state.rotateJudge
    ? (state.judgeIndex + 1) % Math.max(1, state.players.length)
    : state.judgeIndex
}

/**
 * Throws a `RangeError` unless a round's draws are well-formed and allowed
 * (REQ-4.1, REQ-4.3; specs.md §2.5). Called FIRST by `startMatch` and
 * `nextRound`, in every state — validation precedes inertness (REQ-3.3,
 * NFR-4.3), so a bad draw throws even on a screen where a good one is inert.
 *
 * 1. The category must be one the rules allow at this moment: any selected
 *    category for `startMatch` (a match's first round, whose used list starts
 *    empty); `nextRoundChoices` for `nextRound` — the selected-but-unused, or
 *    the whole selection when none is unused.
 * 2. The questions must be an array with at least one element.
 * 3. No two questions may share the same text — the one field a player sees,
 *    so a repeat would ask the same question twice before the pool wraps
 *    (`design/user-stories.md` H-06, "بلا تكرار").
 */
export function assertRoundPayload(
  kind: 'startMatch' | 'nextRound',
  state: RoomState,
  action: { readonly categoryId: CategoryId; readonly questions: readonly Question[] },
): void {
  const { categoryId, questions } = action
  const allowed = kind === 'startMatch' ? state.pickedCategories : nextRoundChoices(state)
  if (!allowed.includes(categoryId)) {
    throw new RangeError(
      `${kind} needs a category from [${allowed.join(', ')}]; got ${String(categoryId)}`,
    )
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new RangeError(
      `${kind} needs at least one question; got ${Array.isArray(questions) ? 'an empty array' : typeof questions}`,
    )
  }
  // Read through `action.questions`, not the local `questions`: after the
  // `Array.isArray` test above, TypeScript narrows the local to `any[]`, which
  // would type each question as `any`.
  const seen = new Set<string>()
  for (const question of action.questions) {
    if (seen.has(question.q)) {
      throw new RangeError(
        `${kind} needs questions with distinct text; got "${question.q}" more than once`,
      )
    }
    seen.add(question.q)
  }
}

/**
 * The start every round of a match shares (REQ-4.4, REQ-4.9): round `round`,
 * with `categoryId` as its category and `questions` as its pool, on `play`,
 * both indices at 0 and no reveal. The category is recorded as used ONCE — not
 * appended again when the draw fell back to an already-used one (REQ-4.3).
 *
 * The clock is Phase 3's own `startClock`, from the current engine time: the
 * starting team of `startingTeam(round)` running with a full bank, the other
 * full and not yet started.
 */
export function beginRound(
  state: RoomState,
  round: number,
  categoryId: CategoryId,
  questions: readonly Question[],
): RoomState {
  return {
    ...state,
    round,
    categoryId,
    usedCategories: state.usedCategories.includes(categoryId)
      ? state.usedCategories
      : [...state.usedCategories, categoryId],
    screen: 'play',
    questionPool: questions,
    questionIndex: 0,
    hintIndex: 0,
    reveal: null,
    revealedAt: null,
    clock: startClock(state.clock.now, startingTeam(round), roundMs(state.config)),
  }
}

/**
 * A round that has just ended, scored (REQ-4.7, REQ-4.8) — applied by the
 * reducer to Phase 3's round end, in the same step, so no state exists in which
 * a round has ended and its result is not yet recorded.
 *
 * A round with no category is returned unchanged (requirements.md, reading 1).
 * Otherwise the winner is the team whose bank did NOT empty — `otherTeam` of
 * `active`, which still names the team whose bank emptied — and:
 * - the winner's tally rises by one;
 * - one log entry records the round number, the round's category and the
 *   winning team (requirements.md, readings 3 and 4);
 * - the screen is `match` when either tally has reached `winsNeeded` or no
 *   selected category is left unused, and `roundEnd` otherwise — the
 *   prototype's `endRound` condition, in its order.
 */
export function scoreRound(state: RoomState): RoomState {
  const { categoryId } = state
  if (categoryId === null) return state
  const winner = otherTeam(state.clock.active)
  const tallyA = winner === 'a' ? state.tallyA + 1 : state.tallyA
  const tallyB = winner === 'b' ? state.tallyB + 1 : state.tallyB
  const { winsNeeded } = state.config
  const over = tallyA >= winsNeeded || tallyB >= winsNeeded || unusedCategories(state).length === 0
  return {
    ...state,
    tallyA,
    tallyB,
    log: [...state.log, { n: state.round, category: categoryId, winner }],
    screen: over ? 'match' : 'roundEnd',
  }
}
