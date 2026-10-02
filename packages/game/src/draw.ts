// The category draw and the question shuffle (Phase 4) — REQ-4.1, REQ-4.2, REQ-4.3.
// See specs/phase-4/specs.md §2.4.
//
// The driver draws, the engine checks (REQ-4.1, DECIDED 2026-10-02). The
// reducer draws nothing: the category and the question order of every round a
// match plays arrive in the action's payload. These are the helpers a driver
// draws them with — pure functions that take the random source as a parameter
// and never reach for one of their own, so the same random values always give
// the same draw, in a test and in a driver alike. Choosing the source is
// Phase 5's (the browser) and Phase 11's (the server).
//
// `unusedCategories` and `nextRoundChoices` are internal: exported from this
// module for match.ts, never from index.ts (specs.md §2.8).
// `drawableCategories`, `drawCategory` and `shuffleQuestions` are public.
//
// Coverage rule (REQ-4.15, inherited from REQ-3.12): every branch here is
// reachable by some input. That is why each random helper has exactly ONE
// guard, written so that every bad input reaches it, and no `!` or `as` to
// silence `noUncheckedIndexedAccess` (specs.md §4, R5). A branch nothing can
// reach is deleted, not ignored.

import type { CategoryId, Question, Random, RoomState } from './types.js'

/**
 * The selected categories this match has not used yet, in the order they were
 * SELECTED — not the order they were used (REQ-4.3). Selection order is what
 * lets a given random value pick the same category here as in the prototype,
 * whose list is `picked` filtered by `usedCats`.
 */
export function unusedCategories(state: RoomState): readonly CategoryId[] {
  return state.pickedCategories.filter((id) => !state.usedCategories.includes(id))
}

/**
 * The categories `nextRound` may be drawn from (REQ-4.3): the unused ones, or —
 * when every selected category has been used — the whole selection. The
 * fallback is unreachable in the prototype's own flow (requirements.md §1.1,
 * fact 1) and is kept because the roadmap names it.
 */
export function nextRoundChoices(state: RoomState): readonly CategoryId[] {
  const unused = unusedCategories(state)
  return unused.length > 0 ? unused : state.pickedCategories
}

/**
 * The list the NEXT round may be drawn from, given the screen the room is on
 * (REQ-4.3). On `ready` and `match` the next round is a match's first — the
 * first of a match or of a rematch — and its used list will start empty, so it
 * may be drawn from the whole selection; on every other screen it is
 * `nextRoundChoices`. A driver always draws with
 * `drawCategory(drawableCategories(state), random)` and never needs to know
 * which action follows.
 */
export function drawableCategories(state: RoomState): readonly CategoryId[] {
  if (state.screen === 'ready' || state.screen === 'match') return state.pickedCategories
  return nextRoundChoices(state)
}

/**
 * One category from `choices`, with exactly one call to `random` (REQ-4.3):
 * the element at `floor(random() × length)` — the prototype's own pick formula,
 * so that a given random value picks the same category here as there.
 *
 * ONE guard covers every bad input (REQ-4.1). An empty list, or a random value
 * of 1 or more, below 0, NaN or infinite, each puts the index outside the
 * list, so the element looked up is `undefined`. Testing that element — rather
 * than the list and the value separately — leaves no separate empty check, no
 * `!`, and no branch an input cannot reach.
 */
export function drawCategory(choices: readonly CategoryId[], random: Random): CategoryId {
  const value = random()
  const picked = choices[Math.floor(value * choices.length)]
  if (picked === undefined) {
    throw new RangeError(
      `drawCategory needs a non-empty list and a random value in [0, 1); got ${value} for a list of length ${choices.length}`,
    )
  }
  return picked
}

/**
 * A NEW array holding exactly `questions`' elements in a uniformly random
 * order (REQ-4.2, DECIDED 2026-10-02: a fair shuffle). `questions` is never
 * mutated.
 *
 * Random insertion: question i (0-based) is inserted into the output at
 * position `floor(r × (i + 1))`, r = random() — one call per question, in
 * order, so n questions cost exactly n calls, and the first always lands at 0.
 * The positions (j₁, …, jₙ₋₁), jᵢ ∈ 0 … i, map one-to-one onto the n!
 * orderings, so a uniform source gives every ordering probability exactly
 * 1/n!. The prototype's comparator sort cannot: every probability it produces
 * is a multiple of 1/2ᵏ (requirements.md §1.1, fact 3).
 *
 * Why insertion and not the swap form of Fisher–Yates (specs.md §2.4): both
 * are uniform, but a swap reads two elements by index, each typed
 * `Question | undefined`, and every way to make that typecheck is a `!`, an
 * `as`, or a guard no input reaches. `entries()` types each element as a
 * `Question`, and `splice` reads nothing by index.
 *
 * A random value outside [0, 1) throws. It is tested as `!(r >= 0 && r < 1)`
 * so that NaN throws too. Unchecked, it would not fail loudly: `splice` clamps
 * a position past the end and counts a negative one back from the end, so a
 * broken source would yield a plausible order that is not a fair one.
 */
export function shuffleQuestions(questions: readonly Question[], random: Random): Question[] {
  const shuffled: Question[] = []
  for (const [i, question] of questions.entries()) {
    const r = random()
    if (!(r >= 0 && r < 1)) {
      throw new RangeError(
        `shuffleQuestions needs every random value in [0, 1); got ${r} at draw ${i + 1} of ${questions.length}`,
      )
    }
    shuffled.splice(Math.floor(r * (i + 1)), 0, question)
  }
  return shuffled
}
