// Test support (Phase 4) — the match harness. REQ-4.13, REQ-4.14, NFR-4.3.
// See specs/phase-4/specs.md §2.10 ("match-harness.ts").
//
// Runs one sequence — generated (testing/match-sequences.ts, `matchSequences`)
// or scripted (verification.md Table G, `TABLE_G`) — through the ENGINE and the
// two MATCH ORACLES (testing/match-oracle.ts) in LOCKSTEP: every event is
// applied to all three, and after every event the engine's observation is
// compared with the exact oracle's. The engine starts from `readyRoom(setup)`
// (testing/rooms.ts), the oracles from the same setup on room-ready.
//
// EACH EVENT, AS THE ENGINE RECEIVES IT (specs.md §2.10, the harness's table):
//
//   | Event                                  | Engine action(s)                                         |
//   |----------------------------------------|----------------------------------------------------------|
//   | tick                                   | { type: 'tick', ms: 100 }, then { type: 'passTurn' } —   |
//   |                                        | every tick, as a driver would; it is inert until due     |
//   | correct · skip · hint · resetMatch     | { type: event }                                          |
//   | startMatch / nextRound with r and perm | categoryId = drawCategory(drawableCategories(state),     |
//   |                                        | () => r); questions = perm.map(k =>                      |
//   |                                        | categoryQuestions(categoryId)[k]); { type, categoryId,   |
//   |                                        | questions } — the engine's public helpers, exactly as a  |
//   |                                        | driver uses them                                         |
//
// A FLOW EVENT — startMatch, nextRound, resetMatch — is dispatched to the
// engine only if the engine is on a screen where that event's button exists
// (`BUTTON_SCREENS`, the prototype's buttons: verification.md Gate 4,
// extraction #16). Otherwise the step is recorded as the engine's divergence
// and the engine is fed nothing further.
//
// A SCRIPTED DRAW names its category. The harness turns it into `r = (i + 0.5)
// / length`, where `i` is the named category's position in the EXACT oracle's
// drawable list, and gives that same `r` to all three — so the engine draws
// through `drawCategory(drawableCategories(state), () => r)` like every other
// draw, and lands on the named category only if its drawable list agrees with
// the prototype's.
//
// WHAT IS COMPARED, and when:
// - engine ≡ exact — always. The exact oracle runs anyway: it counts the
//   matches ended and places scripted draws.
// - float ≡ exact — only with `floatVsExact` (verification.md Gate 5, "Oracle
//   against oracle", Table F; "Scripted matches through both oracles").
// - engine ≡ float — only with `engineVsFloat`. It is OFF unless a caller asks
//   for it, so that no run makes that comparison by accident: on the 45 s
//   verdict sample and on the scripted matches it is the 🚦 verdict box of
//   REQ-4.14, evaluated exactly once, by the test written for that box.
// The float oracle is stepped only when one of the last two is asked for.
//
// Test support: excluded from coverage (REQ-4.15, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts`.

import { displaySeconds, remainingMs } from '../clock.js'
import { drawableCategories, drawCategory } from '../draw.js'
import { reduce } from '../reducer.js'
import type { Action, RoomState, Screen } from '../types.js'
import {
  logEntryText,
  matchOracle,
  type MatchDraw,
  type MatchEvent,
  type MatchObservation,
  type MatchOracle,
} from './match-oracle.js'
import {
  drawnQuestions,
  type MatchFlow,
  type NamedDraw,
  type ScriptedEvent,
  type ScriptedMatch,
} from './match-sequences.js'
import { readyRoom, type ReadyRoomSetup } from './rooms.js'

export type { MatchObservation } from './match-oracle.js'

/**
 * The harness's tick: the prototype's `setInterval` period. The ENGINE has
 * deliberately no tick constant — how often a driver ticks is the driver's
 * business, and this harness is a driver.
 */
export const MATCH_TICK_MS = 100

/** The flow events: the three whose buttons exist on some screens only. */
export type FlowEvent = MatchFlow | 'resetMatch'

/**
 * The screens on which each flow event's button exists — the prototype's
 * (verification.md Gate 4, extraction #16): `goWheel` on room-ready and
 * `rematch` on match end ('startMatch'), `nextRound` on round end, `resetAll`
 * on round end and match end ('resetMatch').
 */
export const BUTTON_SCREENS: Readonly<Record<FlowEvent, readonly Screen[]>> = {
  startMatch: ['ready', 'match'],
  nextRound: ['roundEnd'],
  resetMatch: ['roundEnd', 'match'],
}

/** An event the harness accepts: a generated event, or a scripted one whose draw names its category. */
export type HarnessEvent = MatchEvent | ScriptedEvent

/** One run: a configuration and its events. A generated sequence (`GeneratedMatch`) is one as it stands. */
export interface MatchRun {
  readonly setup: ReadyRoomSetup
  readonly events: readonly HarnessEvent[]
}

/** A scripted match of verification.md Table G as a run: its configuration and its whole script. */
export const scriptedRun = (match: ScriptedMatch): MatchRun => ({
  setup: match.setup,
  events: match.script,
})

/** The engine's observation (specs.md §2.10): the 17-tuple, read off the state as the oracles' is read off theirs. */
export function observeEngine(state: RoomState): MatchObservation {
  const { clock, log } = state
  const last = log[log.length - 1]
  return [
    state.screen,
    state.round,
    state.tallyA,
    state.tallyB,
    clock.active,
    displaySeconds(remainingMs(clock, 'a')),
    displaySeconds(remainingMs(clock, 'b')),
    clock.banks.a.started,
    clock.banks.b.started,
    state.reveal !== null,
    state.hintIndex,
    state.questionIndex,
    state.categoryId,
    state.usedCategories,
    state.judgeIndex,
    log.length,
    last === undefined ? '' : logEntryText(last),
  ]
}

/** Two observations are the same when every entry is — the used list element by element, everything else by `Object.is`. */
export function sameMatchObservation(x: MatchObservation, y: MatchObservation): boolean {
  for (let i = 0; i < x.length; i += 1) {
    const xi = x[i]
    const yi = y[i]
    if (Array.isArray(xi) && Array.isArray(yi)) {
      if (xi.length !== yi.length) return false
      for (let k = 0; k < xi.length; k += 1) if (xi[k] !== yi[k]) return false
    } else if (!Object.is(xi, yi)) {
      return false
    }
  }
  return true
}

/**
 * The engine functions a run calls — replaceable, so a test can wrap them
 * (freeze, count, call twice). `readyRoom` stands in for Phase 5's setup and
 * calls the engine's `createRoom`.
 */
export interface MatchEngine {
  readonly readyRoom: typeof readyRoom
  readonly reduce: typeof reduce
  readonly drawableCategories: typeof drawableCategories
  readonly drawCategory: typeof drawCategory
}

export const MATCH_ENGINE: MatchEngine = { readyRoom, reduce, drawableCategories, drawCategory }

/**
 * Called for every state the ENGINE visits, in order: first the ready room
 * (`prev` and `action` null, `step` 0), then the state after each action the
 * engine is given (`step` = the 1-based index of the event that action belongs
 * to — Table G's "Rounds end at" numbering). A tick event gives two actions,
 * `tick` and `passTurn`, so two visits with the same `step`.
 */
export type MatchVisit = (
  state: RoomState,
  prev: RoomState | null,
  action: Action | null,
  step: number,
) => void

export interface MatchRunOptions {
  /** Called for every state the engine visits (see `MatchVisit`). */
  readonly visit?: MatchVisit
  /** The engine functions; `MATCH_ENGINE` unless a test wraps them. */
  readonly engine?: MatchEngine
  /** Step the float oracle and compare it with the exact one (verification.md Table F, Table G). Default `false`. */
  readonly floatVsExact?: boolean
  /** Step the float oracle and compare the ENGINE with it — see the header before asking for it. Default `false`. */
  readonly engineVsFloat?: boolean
}

/** The first step at which two observations differed, and both observations there. */
export interface MatchDivergence {
  /** 1-based: the event after which they differed. */
  readonly step: number
  /** The pair's first-named side: the engine in engine/exact and engine/float, the float oracle in float/exact. */
  readonly left: MatchObservation
  /** The pair's second-named side: the exact oracle in engine/exact and float/exact, the float oracle in engine/float. */
  readonly right: MatchObservation
  /** Set when the engine's divergence is a flow event on a screen with no button for it: the event and the engine's screen. */
  readonly refused?: string
}

export interface MatchRunResult {
  /** Events consumed: every event of the run. */
  readonly stepsConsumed: number
  /** Times the EXACT oracle's screen became `match` from another screen. */
  readonly matchesEnded: number
  /** The exact oracle's screen after the last event. */
  readonly exactFinalScreen: Screen
  /** Each party's round ends: the 1-based index of each event after which its screen went from `play` to `roundEnd` or `match`. */
  readonly roundsEndAt: {
    readonly engine: readonly number[]
    readonly exact: readonly number[]
    readonly float?: readonly number[]
  }
  /** The engine's state after the last event it was given. */
  readonly final: RoomState
  /** Whether the engine was given every event — `false` after a flow event it had no button for. */
  readonly engineFedThroughout: boolean
  /** The two oracles, after the last event — for their views. `float` only when it ran. */
  readonly exact: MatchOracle
  readonly float?: MatchOracle
  /** The first engine ≠ exact step; `null` if they agreed at every step. */
  readonly engineVsExact: MatchDivergence | null
  /** Present only with `floatVsExact`: the first float ≠ exact step, or `null`. */
  readonly floatVsExact?: MatchDivergence | null
  /** Present only with `floatVsExact`: the number of steps at which float ≠ exact. */
  readonly floatVsExactSteps?: number
  /** Present only with `engineVsFloat`: the first engine ≠ float step, or `null`. */
  readonly engineVsFloat?: MatchDivergence | null
}

const isDraw = (event: HarnessEvent): event is MatchDraw | NamedDraw => typeof event !== 'string'

/** A scripted draw placed in the exact oracle's drawable list: `r = (i + 0.5) / length` (specs.md §2.10). */
function placeNamedDraw(draw: NamedDraw, exact: MatchOracle, step: number): MatchDraw {
  const list = exact.drawable(draw.type)
  if (list === null) {
    throw new Error(
      `step ${step}: ${draw.type}(${draw.categoryId}) on ${exact.screen()}, where the prototype has no such button`,
    )
  }
  const i = list.indexOf(draw.categoryId)
  if (i < 0) {
    throw new Error(
      `step ${step}: ${draw.type} names ${draw.categoryId}, not in the exact oracle's drawable list [${list.join(', ')}]`,
    )
  }
  return { type: draw.type, r: (i + 0.5) / list.length, perm: draw.perm }
}

export function runMatch(run: MatchRun, options: MatchRunOptions = {}): MatchRunResult {
  const { visit, engine = MATCH_ENGINE, floatVsExact = false, engineVsFloat = false } = options

  let state = engine.readyRoom(run.setup)
  visit?.(state, null, null, 0)

  const exact = matchOracle('exact', run.setup)
  const float = floatVsExact || engineVsFloat ? matchOracle('float', run.setup) : null

  /** One action to the engine, visited. */
  let step = 0
  const give = (action: Action): void => {
    const next = engine.reduce(state, action)
    visit?.(next, state, action, step)
    state = next
  }

  let fed = true
  let refused: string | null = null
  let matchesEnded = 0
  const ends = { engine: [] as number[], exact: [] as number[], float: [] as number[] }
  let engineExact: MatchDivergence | null = null
  let floatExact: MatchDivergence | null = null
  let floatExactSteps = 0
  let engineFloat: MatchDivergence | null = null

  for (const scripted of run.events) {
    step += 1
    // A scripted draw names its category; a generated one carries `r`.
    const event: MatchEvent =
      isDraw(scripted) && 'categoryId' in scripted
        ? placeNamedDraw(scripted, exact, step)
        : scripted

    const before = { engine: state.screen, exact: exact.screen(), float: float?.screen() }

    // The engine — while it is still fed.
    if (fed) {
      if (event === 'tick') {
        give({ type: 'tick', ms: MATCH_TICK_MS })
        give({ type: 'passTurn' })
      } else if (event === 'correct' || event === 'skip' || event === 'hint') {
        give({ type: event })
      } else {
        const flow: FlowEvent = event === 'resetMatch' ? event : event.type
        if (!BUTTON_SCREENS[flow].includes(state.screen)) {
          fed = false
          refused = `${flow} on ${state.screen}`
        } else if (event === 'resetMatch') {
          give({ type: 'resetMatch' })
        } else {
          const categoryId = engine.drawCategory(engine.drawableCategories(state), () => event.r)
          give({ type: event.type, categoryId, questions: drawnQuestions(categoryId, event.perm) })
        }
      }
    }

    // The oracles — the same event.
    exact.step(event)
    float?.step(event)

    if (before.exact !== 'match' && exact.screen() === 'match') matchesEnded += 1
    const ended = (from: Screen | undefined, to: Screen): boolean =>
      from === 'play' && (to === 'roundEnd' || to === 'match')
    if (fed && ended(before.engine, state.screen)) ends.engine.push(step)
    if (ended(before.exact, exact.screen())) ends.exact.push(step)
    if (float !== null && ended(before.float, float.screen())) ends.float.push(step)

    // Lockstep comparison. An engine that has stopped being fed diverged at
    // the step it was refused.
    const e = observeEngine(state)
    const x = exact.observe()
    if (engineExact === null && (!fed || !sameMatchObservation(e, x))) {
      engineExact = { step, left: e, right: x, ...(refused === null ? {} : { refused }) }
    }
    if (float !== null) {
      const f = float.observe()
      if (floatVsExact && !sameMatchObservation(f, x)) {
        floatExactSteps += 1
        if (floatExact === null) floatExact = { step, left: f, right: x }
      }
      if (engineVsFloat && engineFloat === null && (!fed || !sameMatchObservation(e, f))) {
        engineFloat = { step, left: e, right: f, ...(refused === null ? {} : { refused }) }
      }
    }
  }

  return {
    stepsConsumed: step,
    matchesEnded,
    exactFinalScreen: exact.screen(),
    roundsEndAt: {
      engine: ends.engine,
      exact: ends.exact,
      ...(float === null ? {} : { float: ends.float }),
    },
    final: state,
    engineFedThroughout: fed,
    exact,
    ...(float === null ? {} : { float }),
    engineVsExact: engineExact,
    ...(floatVsExact ? { floatVsExact: floatExact, floatVsExactSteps: floatExactSteps } : {}),
    ...(engineVsFloat ? { engineVsFloat: engineFloat } : {}),
  }
}
