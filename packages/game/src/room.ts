// The room constructor, the current question and when the judge may act
// (Phase 3) — REQ-3.1, REQ-3.2, REQ-3.6, REQ-3.8. See specs/phase-3/specs.md §2.4.
//
// A room is constructed valid. Its configuration is checked by MEMBERSHIP of
// the prototype's own option lists, not by a range check, so 47, 45.5 and NaN
// are all rejected by the same line — and rejected by throwing, never by
// clamping: a clamped 47 would silently be a different game from the one the
// caller asked for, and a 47-second round has left the space the prototype
// defines (REQ-3.2).
//
// Coverage rule (REQ-3.12, with no coverage-ignore comment anywhere): every
// branch here is reachable by some input. A branch that nothing can reach is
// deleted, not ignored (specs.md §2.4).

import { roundMs } from './clock.js'
import {
  ROUND_SECONDS_DEFAULT,
  ROUND_SECONDS_OPTIONS,
  WINS_NEEDED_DEFAULT,
  WINS_NEEDED_OPTIONS,
} from './rules.js'
import type { CreateRoomInput, Question, RoomConfig, RoomState } from './types.js'

const isOneOf = (options: readonly number[], value: number): boolean => options.includes(value)

export function createRoom(input: CreateRoomInput): RoomState {
  const roundSeconds = input.config?.roundSeconds ?? ROUND_SECONDS_DEFAULT
  const winsNeeded = input.config?.winsNeeded ?? WINS_NEEDED_DEFAULT

  if (!isOneOf(ROUND_SECONDS_OPTIONS, roundSeconds)) {
    throw new RangeError(
      `roundSeconds must be one of ${ROUND_SECONDS_OPTIONS.join(', ')}; got ${roundSeconds}`,
    )
  }
  if (!isOneOf(WINS_NEEDED_OPTIONS, winsNeeded)) {
    throw new RangeError(
      `winsNeeded must be one of ${WINS_NEEDED_OPTIONS.join(', ')}; got ${winsNeeded}`,
    )
  }

  const config: RoomConfig = { roundSeconds, winsNeeded }
  const full = roundMs(config)

  return {
    // From the input, unvalidated: Phase 11 generates codes, Phase 5 edits names.
    roomCode: input.roomCode,
    config,
    players: [],
    teamA: input.teamA,
    teamB: input.teamB,
    judgeIndex: 0,
    rotateJudge: false,
    pickedCategories: [],
    usedCategories: [],
    // The prototype's initial state: the setup screen, round 1, no score.
    screen: 'setup',
    round: 1,
    tallyA: 0,
    tallyB: 0,
    log: [],
    categoryId: null,
    questionPool: [],
    questionIndex: 0,
    hintIndex: 0,
    // Both banks full and stopped — the prototype's `a:{time:45,started:false}, b:{…}, active:'a'`.
    clock: {
      now: 0,
      active: 'a',
      runningSince: null,
      banks: { a: { ms: full, started: false }, b: { ms: full, started: false } },
    },
    reveal: null,
    revealedAt: null, // REQ-4.11 — no reveal, so no time it went up
  }
}

/**
 * The pool entry at `questionIndex mod poolLength`, so a skip past the end of
 * the pool wraps to its start (REQ-3.6); `null` when the pool is empty.
 *
 * Written with `?? null`, never a `!`: with an empty pool `x % 0` is NaN, the
 * lookup is `undefined`, and the result is `null` — so both sides of `??` are
 * reachable, and the empty-pool case is a tested branch rather than a hidden one.
 */
export function currentQuestion(state: RoomState): Question | null {
  return state.questionPool[state.questionIndex % state.questionPool.length] ?? null
}

/**
 * The question the judge may act on, or `null` when hint, skip and correct
 * are all inert (REQ-3.8) — the single definition of "the judge may act".
 * Internal: exported from this module for the reducer, never from index.ts.
 *
 * The three conditions, in this order (specs.md §2.4):
 * 1. no round in play, or the round has ended;
 * 2. the clock is stopped — compared with `=== null`, never by truthiness,
 *    because a round started at engine time 0 runs with `runningSince` 0; in
 *    every state an action can produce, this already covers a reveal;
 * 3. a reveal is up — a defence: it blocks the judge even in an inconsistent
 *    state whose clock is still running. No action produces that state; a
 *    hand-built one reaches this branch (the coverage rule above).
 * Then the current question, which is `null` for an empty pool.
 */
export function liveQuestion(state: RoomState): Question | null {
  if (state.screen !== 'play') return null
  if (state.clock.runningSince === null) return null
  if (state.reveal !== null) return null
  return currentQuestion(state)
}

/**
 * Whether hint, skip and correct count right now (REQ-3.8). Public, so that a
 * screen disables its buttons by the same rule the reducer applies: the
 * reducer calls `liveQuestion`, this is `liveQuestion(state) !== null`, and
 * the two cannot disagree.
 */
export function acceptsJudgeActions(state: RoomState): boolean {
  return liveQuestion(state) !== null
}
