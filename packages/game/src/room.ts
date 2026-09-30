// The room constructor and the current question (Phase 3) — REQ-3.1, REQ-3.2,
// REQ-3.6. See specs/phase-3/specs.md §2.4.
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
