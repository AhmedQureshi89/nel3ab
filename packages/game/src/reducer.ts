// The reducer (Phase 3) — REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6, REQ-3.7, REQ-3.8.
// See specs/phase-3/specs.md §2.5, whose table this file implements row for row.
//
// Every state change goes through `reduce(state, action)`. It is pure: it
// never reads a clock, never draws a random number, never starts or clears a
// timer, never logs, and never mutates its inputs — unchanged sub-objects are
// shared between input and output, and everything else is a new object.
//
// Two rules hold for every action (REQ-3.3):
// - VALIDATION PRECEDES INERTNESS. A malformed action throws in every state —
//   a malformed tick silently ignored would be a clock that stops without
//   anyone noticing (mission.md §5.2).
// - An INERT action returns `state` itself (`===`), never a copy, so a
//   renderer can skip a render and a server can skip a broadcast.
//
// A spend (hint, skip) follows the prototype's order line for line
// (`giveHint`, `markSkip`): the inert checks, THEN the spend, THEN — only if
// the round survived — the index advance. A spend that survives re-anchors the
// clock (`runningSince = now`): the bank now holds its value as of `now`, and
// without the re-anchor the next reading would subtract the time already
// elapsed a second time (specs.md §2.3).

import { remainingMs, roundMs, startClock, stopClock, zeroActive } from './clock.js'
import { liveQuestion } from './room.js'
import { HINT_COST_MS, SKIP_COST_MS } from './rules.js'
import type { Action, ClockState, RoomState } from './types.js'

/**
 * The round ends (REQ-3.7): the active bank at exactly 0, the clock stopped,
 * the screen at `roundEnd`. The ONE function all three round-ending paths use
 * — a tick, a hint and a skip. Nothing else changes: `reveal` stays `null`,
 * and `active` still names the team whose bank emptied, which is how that team
 * is identifiable as the round's loser. Phase 4 extends this function with the
 * tally, the log and the match end.
 */
function endRound(state: RoomState, clock: ClockState): RoomState {
  return { ...state, clock: zeroActive(clock), screen: 'roundEnd' }
}

/**
 * Spend `cost` ms from the active bank (REQ-3.6, REQ-3.7). `null` when the
 * bank would reach zero or below — the caller then ends the round and
 * advances no index, as the prototype's `if(this.spend(n)) return;` does.
 * Otherwise the clock with the bank at what is left, re-anchored at `now`.
 */
function spend(clock: ClockState, cost: number): ClockState | null {
  const left = remainingMs(clock, clock.active) - cost
  if (left <= 0) return null
  const bank = clock.banks[clock.active]
  return {
    ...clock,
    runningSince: clock.now, // the re-anchor
    banks: { ...clock.banks, [clock.active]: { ...bank, ms: left } },
  }
}

export function reduce(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case 'tick': {
      const { ms } = action
      const { now } = state.clock
      if (!(Number.isSafeInteger(ms) && ms >= 0 && Number.isSafeInteger(now + ms))) {
        throw new RangeError(
          `tick needs a non-negative safe integer of milliseconds that keeps the engine time a safe integer; got ${ms} at now ${now}`,
        )
      }
      if (ms === 0) return state

      // Zero is tested at the ADVANCED time, so a tick that crosses zero ends
      // the round in this same step (REQ-3.4, REQ-3.7).
      const clock: ClockState = { ...state.clock, now: now + ms }
      if (clock.runningSince !== null && remainingMs(clock, clock.active) <= 0) {
        return endRound(state, clock)
      }
      return { ...state, clock }
    }

    case 'startRound': {
      const { startingTeam, questions } = action
      if (startingTeam !== 'a' && startingTeam !== 'b') {
        throw new RangeError(
          `startRound needs startingTeam 'a' or 'b'; got ${String(startingTeam)}`,
        )
      }
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new RangeError(
          `startRound needs at least one question; got ${Array.isArray(questions) ? 'an empty array' : typeof questions}`,
        )
      }
      if (state.screen === 'play') return state

      // Which team starts and which questions, in what order, are Phase 4's
      // to choose; `round`, the tallies, `log`, `categoryId` and
      // `usedCategories` are Phase 4's to change (requirements.md §1.3).
      return {
        ...state,
        screen: 'play',
        questionPool: questions,
        questionIndex: 0,
        hintIndex: 0,
        reveal: null,
        revealedAt: null, // cleared with the reveal (REQ-4.11)
        clock: startClock(state.clock.now, startingTeam, roundMs(state.config)),
      }
    }

    case 'hint': {
      // An exhausted hint is inert and costs nothing: the judge's screen shows
      // that button as disabled (REQ-3.6).
      const question = liveQuestion(state)
      if (question === null || state.hintIndex >= question.h.length) return state
      const clock = spend(state.clock, HINT_COST_MS)
      if (clock === null) return endRound(state, state.clock)
      return { ...state, clock, hintIndex: state.hintIndex + 1 }
    }

    case 'skip': {
      if (liveQuestion(state) === null) return state
      const clock = spend(state.clock, SKIP_COST_MS)
      if (clock === null) return endRound(state, state.clock)
      return { ...state, clock, questionIndex: state.questionIndex + 1, hintIndex: 0 }
    }

    case 'correct': {
      // The reveal stays up: the 1000ms hold, the reveal coming down and the
      // turn passing are Phase 4's (requirements.md §1.3).
      const question = liveQuestion(state)
      if (question === null) return state
      return {
        ...state,
        clock: stopClock(state.clock),
        reveal: { answer: question.a, fact: question.f },
        // The engine time the reveal went up: the hold before the turn may pass
        // is measured from here (REQ-4.6, REQ-4.11).
        revealedAt: state.clock.now,
      }
    }

    default: {
      // Exhaustive: an `Action` member with no case above fails to compile here.
      const unknown: never = action
      throw new TypeError(
        `reduce got an unknown action type: ${String((unknown as { readonly type?: unknown }).type)}`,
      )
    }
  }
}
