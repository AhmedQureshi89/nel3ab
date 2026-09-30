// Test support (Phase 3) — the sequence harness. REQ-3.3, REQ-3.4, REQ-3.11.
// See specs/phase-3/specs.md §2.8 ("harness.ts").
//
// Runs one sequence through the ENGINE and the two PROTOTYPE ORACLES
// (`testing/prototype-oracle.ts`) in LOCKSTEP: every event is applied to all
// three, and after every event the engine's observation is compared with the
// exact oracle's. The run returns, per §2.8: the steps consumed, the first
// engine/exact divergence, the first engine/float divergence (when asked
// for, below), and the loser.
//
// The engine is `createRoom({ roomCode: 'TEST01', teamA: 'أ', teamB: 'ب',
// config: { roundSeconds } })` followed by `startRound(startingTeam, pool)`;
// each event maps to `{ type: 'tick', ms: 100 }` or `{ type: event }`. The
// engine's observation is `displaySeconds(remainingMs(clock, team))` for each
// team, `screen === 'roundEnd'`, `reveal !== null`, and the two indices.
//
// THE STOP RULE is timed by the EXACT ORACLE (§2.8): consumption ends `TAIL`
// events after the step at which the exact oracle first becomes terminal
// (ended, or reveal up), or at the end of the sequence, whichever is first. It
// applies to GENERATED sequences only. A scripted scenario of Table D is
// consumed in full (`scenarioRun`), because Table D states each outcome after
// the scenario's whole event list.
//
// WHAT IS COMPARED, and when:
// - engine ≡ exact — always. It is the engine's correctness (verification.md
//   Gate 6, "The engine is exact arithmetic"), and the exact oracle runs anyway
//   to time the stop rule.
// - float ≡ exact — only with `floatVsExact` (Gate 6, "Oracle against
//   oracle", Table B).
// - engine ≡ float — only with `engineVsFloat`. It is off unless a caller asks
//   for it, so that no run makes that comparison by accident: on the verdict's
//   45 s sample and on the scripted scenarios it is the 🚦 verdict box of
//   REQ-3.11, evaluated exactly once, by the test written for that box.
// The float oracle is stepped only when one of the last two is asked for.
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts`.

import { displaySeconds, remainingMs } from '../clock.js'
import { reduce } from '../reducer.js'
import { createRoom } from '../room.js'
import type { Action, Question, RoomState, Team } from '../types.js'
import { prototypeOracle, type Observation } from './prototype-oracle.js'
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

export type { Observation } from './prototype-oracle.js'

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
 * ended, reveal up, hintIndex, questionIndex) — the shape of the oracles'.
 */
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

/** Two observations are the same when all six entries are (`Object.is`). */
export function sameObservation(x: Observation, y: Observation): boolean {
  for (let i = 0; i < x.length; i += 1) {
    if (!Object.is(x[i], y[i])) return false
  }
  return true
}

/** Terminal: the round has ended, or the reveal is up — the engine's reading of §2.8's stop-rule condition. */
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
  /** Events consumed after the step at which the EXACT ORACLE first becomes terminal; `null` consumes every event. */
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
 * Called for every state the ENGINE visits, in order: first the fresh room
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

export interface RunOptions {
  /** Called for every state the engine visits (see `Visit`). */
  readonly visit?: Visit
  /** The engine functions; `ENGINE` unless a test wraps them. */
  readonly engine?: Engine
  /** Step the float oracle and compare it with the exact one (verification.md Table B). Default `false`. */
  readonly floatVsExact?: boolean
  /** Step the float oracle and compare the ENGINE with it — see the header before asking for it. Default `false`. */
  readonly engineVsFloat?: boolean
}

/** The first consumed step at which two observations differed, and both observations there. */
export interface Divergence {
  /** 1-based: the event after which they differed. */
  readonly step: number
  /** The pair's first-named side: the engine in engine/exact and engine/float, the float oracle in float/exact. */
  readonly left: Observation
  /** The pair's second-named side: the exact oracle in engine/exact and float/exact, the float oracle in engine/float. */
  readonly right: Observation
}

export interface RunResult {
  /** Events consumed under the stop rule. */
  readonly stepsConsumed: number
  /** The 1-based step at which the EXACT ORACLE first became terminal — the stop rule's trigger; `null` if it never did. */
  readonly terminalAt: number | null
  /** The engine's state after the last consumed event. */
  readonly final: RoomState
  /** The engine's loser (`loserOf` its final state). */
  readonly loser: Team | null
  /** The exact oracle's loser. */
  readonly exactLoser: Team | null
  /** The first engine ≠ exact step; `null` if they agreed at every consumed step. */
  readonly engineVsExact: Divergence | null
  /** Present only when the float oracle ran: its loser. */
  readonly floatLoser?: Team | null
  /** Present only with `floatVsExact`: the first float ≠ exact step, or `null`. */
  readonly floatVsExact?: Divergence | null
  /** Present only with `engineVsFloat`: the first engine ≠ float step, or `null`. */
  readonly engineVsFloat?: Divergence | null
}

export function runEngine(run: Run, options: RunOptions = {}): RunResult {
  const { visit, engine = ENGINE, floatVsExact = false, engineVsFloat = false } = options

  const room = engine.createRoom({ ...HARNESS_ROOM, config: { roundSeconds: run.roundSeconds } })
  visit?.(room, null, null, 0)

  const start: Action = {
    type: 'startRound',
    startingTeam: run.startingTeam,
    questions: run.pool,
  }
  let state = engine.reduce(room, start)
  visit?.(state, room, start, 0)

  // The two oracles start the same round: the prototype's `startRound`.
  const exact = prototypeOracle('exact', run.roundSeconds, run.startingTeam, run.pool)
  const float =
    floatVsExact || engineVsFloat
      ? prototypeOracle('float', run.roundSeconds, run.startingTeam, run.pool)
      : null

  let consumed = 0
  let terminalAt: number | null = null
  let engineExact: Divergence | null = null
  let floatExact: Divergence | null = null
  let engineFloat: Divergence | null = null
  for (const event of run.events) {
    // The stop rule (specs.md §2.8): consumption ends `tail` events after the
    // step at which the exact oracle first becomes terminal, or at the end of
    // the sequence, whichever is first.
    if (run.tail !== null && terminalAt !== null && consumed >= terminalAt + run.tail) break

    // Lockstep: the same event, to all three.
    const action = toAction(event)
    const next = engine.reduce(state, action)
    exact.step(event)
    float?.step(event)
    consumed += 1
    visit?.(next, state, action, consumed)
    state = next

    const e = observe(state)
    const x = exact.observe()
    if (engineExact === null && !sameObservation(e, x)) {
      engineExact = { step: consumed, left: e, right: x }
    }
    if (float !== null) {
      const f = float.observe()
      if (floatVsExact && floatExact === null && !sameObservation(f, x)) {
        floatExact = { step: consumed, left: f, right: x }
      }
      if (engineVsFloat && engineFloat === null && !sameObservation(e, f)) {
        engineFloat = { step: consumed, left: e, right: f }
      }
    }

    // The stop rule's trigger: the EXACT ORACLE's terminality (§2.8) — not
    // the engine's, so that the steps a sequence consumes do not depend on
    // the engine under test.
    if (terminalAt === null && exact.terminal()) terminalAt = consumed
  }

  return {
    stepsConsumed: consumed,
    terminalAt,
    final: state,
    loser: loserOf(state),
    exactLoser: exact.loser(),
    engineVsExact: engineExact,
    ...(float === null ? {} : { floatLoser: float.loser() }),
    ...(floatVsExact ? { floatVsExact: floatExact } : {}),
    ...(engineVsFloat ? { engineVsFloat: engineFloat } : {}),
  }
}
