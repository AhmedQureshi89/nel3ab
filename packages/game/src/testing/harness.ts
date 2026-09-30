// Test support (Phase 3) — the ENGINE side of the sequence harness. REQ-3.3,
// REQ-3.4, REQ-3.11. See specs/phase-3/specs.md §2.8 ("harness.ts").
//
// §2.8's harness runs one sequence through the engine and two oracles in
// lockstep. This file is its engine half — how the engine is built, how an
// event becomes an action, what the engine's observation is, and the stop
// rule — so that a later unit can add `testing/prototype-oracle.ts` and step
// both oracles beside the engine in `runEngine`'s loop without changing any of
// the definitions below.
//
// The engine is `createRoom({ roomCode: 'TEST01', teamA: 'أ', teamB: 'ب',
// config: { roundSeconds } })` followed by `startRound(startingTeam, pool)`;
// each event maps to `{ type: 'tick', ms: 100 }` or `{ type: event }`.
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts`.

import { displaySeconds, remainingMs } from '../clock.js'
import { reduce } from '../reducer.js'
import { createRoom } from '../room.js'
import type { Action, Question, RoomState, Team } from '../types.js'
import {
  POOL,
  SCENARIO_ROUND_SECONDS,
  SCENARIO_STARTING_TEAM,
  TAIL,
  type Event,
  type GeneratedSequence,
  type Sample,
  type Scenario,
} from './sequences.js'

/**
 * The harness's tick: the prototype's `setInterval` period, and tech-specs.md
 * §2.2's. The ENGINE has deliberately no tick constant (specs.md §2.2) — how
 * often a driver ticks is the driver's business, and this harness is a driver.
 */
export const TICK_MS = 100

/** The room every harness run is built from (specs.md §2.8). */
export const HARNESS_ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

const ACTION_OF: Readonly<Record<Event, Action>> = {
  tick: { type: 'tick', ms: TICK_MS },
  hint: { type: 'hint' },
  skip: { type: 'skip' },
  correct: { type: 'correct' },
}

/** 'tick' → `{ type: 'tick', ms: 100 }`; every other event → `{ type: event }`. */
export const toAction = (event: Event): Action => ACTION_OF[event]

/**
 * The engine's observation (specs.md §2.8): the 6-tuple (display a, display b,
 * ended, reveal up, hintIndex, questionIndex). The oracles' observations have
 * the same shape, which is what the lockstep comparison compares.
 */
export type Observation = readonly [
  displayA: number,
  displayB: number,
  ended: boolean,
  revealUp: boolean,
  hintIndex: number,
  questionIndex: number,
]

export function observe(state: RoomState): Observation {
  return [
    displaySeconds(remainingMs(state.clock, 'a')),
    displaySeconds(remainingMs(state.clock, 'b')),
    state.screen === 'roundEnd',
    state.reveal !== null,
    state.hintIndex,
    state.questionIndex,
  ]
}

/** Terminal: the round has ended, or the reveal is up (specs.md §2.8's stop rule). */
export const isTerminal = (state: RoomState): boolean =>
  state.screen === 'roundEnd' || state.reveal !== null

/** The losing team: the one whose bank emptied, which `active` still names (REQ-3.7); `null` if the round has not ended. */
export const loserOf = (state: RoomState): Team | null =>
  state.screen === 'roundEnd' ? state.clock.active : null

/** One run through the harness. */
export interface Run {
  readonly roundSeconds: number
  readonly startingTeam: Team
  readonly pool: readonly [Question, ...Question[]]
  readonly events: readonly Event[]
  /** Events consumed after the step at which the run first becomes terminal; `null` consumes every event. */
  readonly tail: number | null
}

/** A generated sequence of a sample: the three-question pool, and the stop rule with `TAIL`. */
export const generatedRun = (sample: Sample, sequence: GeneratedSequence): Run => ({
  roundSeconds: sample.roundSeconds,
  startingTeam: sequence.startingTeam,
  pool: POOL,
  events: sequence.events,
  tail: TAIL,
})

/**
 * A scripted scenario of verification.md Table D: 45 s, team `a`, and EVERY
 * event consumed. The stop rule is not applied to a scenario: S8 exists to
 * show that the hint, skip and correct it ends with — 1,000 ticks after its
 * reveal went up — are inert, and a `TAIL` of 50 would never reach them.
 */
export const scenarioRun = (scenario: Scenario): Run => ({
  roundSeconds: SCENARIO_ROUND_SECONDS,
  startingTeam: SCENARIO_STARTING_TEAM,
  pool: scenario.pool,
  events: scenario.events,
  tail: null,
})

/** The two engine functions a run calls — replaceable, so a test can wrap them (freeze, count, call twice). */
export interface Engine {
  readonly createRoom: typeof createRoom
  readonly reduce: typeof reduce
}

export const ENGINE: Engine = { createRoom, reduce }

/**
 * Called for every state a run visits, in order: first the fresh room
 * (`prev` and `action` null, `step` 0), then the state `startRound` produced
 * (`step` 0), then the state after each consumed event (`step` = that event's
 * 1-based index — Table D's "Ends at" numbering).
 */
export type Visit = (
  state: RoomState,
  prev: RoomState | null,
  action: Action | null,
  step: number,
) => void

export interface RunResult {
  /** Events consumed under the stop rule. */
  readonly stepsConsumed: number
  /** The 1-based step at which the run first became terminal; `null` if it never did. */
  readonly terminalAt: number | null
  readonly final: RoomState
  readonly loser: Team | null
}

export function runEngine(run: Run, visit?: Visit, engine: Engine = ENGINE): RunResult {
  const room = engine.createRoom({ ...HARNESS_ROOM, config: { roundSeconds: run.roundSeconds } })
  visit?.(room, null, null, 0)

  const start: Action = {
    type: 'startRound',
    startingTeam: run.startingTeam,
    questions: run.pool,
  }
  let state = engine.reduce(room, start)
  visit?.(state, room, start, 0)

  let consumed = 0
  let terminalAt: number | null = null
  for (const event of run.events) {
    // The stop rule (specs.md §2.8): consumption ends `tail` events after the
    // step at which the run first becomes terminal, or at the end of the
    // sequence, whichever is first.
    if (run.tail !== null && terminalAt !== null && consumed >= terminalAt + run.tail) break

    const action = toAction(event)
    const next = engine.reduce(state, action)
    consumed += 1
    visit?.(next, state, action, consumed)
    state = next

    // STAND-IN. §2.8 times the stop rule by the EXACT ORACLE's first terminal
    // step. That oracle does not exist yet (testing/prototype-oracle.ts is a
    // later unit's), so until then the ENGINE's own terminality stands in for
    // it. For an engine that is exact arithmetic the two are the same step;
    // the unit that adds the oracle switches this line to the exact oracle's
    // observation, as §2.8 specifies.
    if (terminalAt === null && isTerminal(state)) terminalAt = consumed
  }

  return { stepsConsumed: consumed, terminalAt, final: state, loser: loserOf(state) }
}
