import { beforeAll, describe, expect, test, vi } from 'vitest'

import { displaySeconds, remainingMs } from './clock.js'
import { drawableCategories, drawCategory, shuffleQuestions } from './draw.js'
import { matchWinner } from './match.js'
import { reduce } from './reducer.js'
import { acceptsJudgeActions, currentQuestion } from './room.js'
import {
  MATCH_ENGINE,
  runMatch,
  scriptedRun,
  type MatchEngine,
  type MatchRun,
  type MatchVisit,
} from './testing/match-harness.js'
import {
  MATCH_PER_LENGTH_SAMPLES,
  MATCH_SEED,
  TABLE_G,
  TABLE_G_EVENT_TOTAL,
  matchSequences,
} from './testing/match-sequences.js'
import { mulberry32 } from './testing/prng.js'
import { readyRoom } from './testing/rooms.js'
import type { Action, Question, RoomState, Team } from './types.js'

// Purity of the match flow — specs/phase-4/verification.md Gate 4's NFR-4.3
// boxes: "Frozen inputs", "Deterministic, and identical when inert" and "No
// ambient time, randomness or timers — at run time". See specs/phase-4/specs.md
// §2.10 (the samples, the harness) and §2.11 (this file's row), and Phase 3's
// purity.test.ts, whose pattern this follows and which is not edited.
//
// What is walked. The PER-LENGTH SAMPLE — 20 generated full-match sequences for
// each of the 15 legal bank lengths, 300 in all, 841,487 events (verification.md
// Table F, rows 2–16) — and the 16 SCRIPTED MATCHES of Table G, 15,700 events,
// each through the match harness (testing/match-harness.ts) exactly as the
// equivalence run drives the engine: a tick event is `tick(100)` then
// `passTurn`, and every draw goes through `drawCategory(drawableCategories(state),
// () => r)`. The 45 s verdict sample (500 sequences, 1,156,355 events) is NOT
// walked here: by design (specs.md §4, R4) the expensive checks — freezing,
// double reduction — run on these two sets only, and the verdict sample is
// Gate 5's.
//
// The harness's own engine run is the UNFROZEN run: nothing in it is frozen.
// Beside it, this file keeps a FROZEN CHAIN — the same room built from separate
// objects, every state and every action deep-frozen before `reduce` sees it —
// fed the same actions, pair by pair. Each pair is reduced twice on the frozen
// chain; the first result is compared with the unfrozen run's result for the
// same pair, the two results with each other, and the result with its input.
//
// Counting. The harness visits the ready room once per run, then the state
// after every action it gives the engine: two per tick event (`tick`,
// `passTurn`), one per other event. So for the whole pass: pairs = 2 × ticks +
// other events.

/** Failures kept per check, for the assertion's message. */
const KEEP = 5
const keep = (list: string[], entry: string): void => {
  if (list.length < KEEP) list.push(entry)
}

/**
 * Every action type the reducer takes. Phase 3's `startRound` is never given
 * by the harness — no driver dispatches it (requirements.md, reading 1) — and
 * is counted all the same, so that each count is over every type.
 */
type ActionType = Action['type']
const perType = (): Record<ActionType, number> => ({
  tick: 0,
  passTurn: 0,
  correct: 0,
  skip: 0,
  hint: 0,
  startMatch: 0,
  nextRound: 0,
  resetMatch: 0,
  startRound: 0,
})

/** The two sets walked, kept apart so each box can name the set it is measured over. */
type SetName = 'perLength' | 'tableG'

interface LabelledRun {
  readonly label: string
  readonly set: SetName
  readonly run: MatchRun
}

function* perLengthSampleAndTableG(): Generator<LabelledRun> {
  for (const sample of MATCH_PER_LENGTH_SAMPLES) {
    for (const sequence of matchSequences(sample)) {
      yield {
        label: `${sample.roundSeconds} s #${sequence.index}`,
        set: 'perLength',
        run: sequence,
      }
    }
  }
  for (const match of TABLE_G) yield { label: match.id, set: 'tableG', run: scriptedRun(match) }
}

/** What a run should give the engine: two actions per tick event, one per other. */
const expectedPairs = (run: MatchRun): number =>
  run.events.reduce<number>((n, event) => n + (event === 'tick' ? 2 : 1), 0)

// ============================================================================
// The frozen chain's comparison with the unfrozen run
// ============================================================================

/**
 * Deep-freeze `value` and everything reachable from it through own
 * properties, CHILDREN FIRST, skipping whatever is already frozen; returns
 * `value`. testing/deep-freeze.ts (Phase 3's, unchanged) does the same, but
 * remembers every object it has walked in a WeakSet — about five million of
 * them over this pass, which made freezing a third of the file's run time.
 * Here `Object.isFrozen` stands in for that memory, which is sound because
 * nothing in this pass is frozen any other way: this function freezes an
 * object only after all its children, so a frozen object's descendants are
 * frozen too. A child that is a primitive or already frozen is not visited.
 */
function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  const record = value as Record<PropertyKey, unknown>
  for (const key of Reflect.ownKeys(record)) {
    const child = record[key]
    if (typeof child === 'object' && child !== null && !Object.isFrozen(child)) freezeDeep(child)
  }
  return Object.freeze(value)
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

/**
 * Whether `x` and `y` are deep-equal, with `deepEqual`'s strictness
 * (testing/invariants.ts: primitives by `Object.is`, objects by prototype, own
 * keys and values) — given a pair `knownX`, `knownY` already known to be
 * deep-equal, with which `x` and `y` may share parts. At every path where `x`
 * still holds the same value as `knownX` and `y` the same as `knownY`, the two
 * are equal, and that path is not walked; every other path is walked in full.
 * With no known pair (`undefined`), this is `deepEqual`.
 *
 * Its three uses below, each with a pair known equal:
 * - the frozen chain's result against the unfrozen run's — known: the last two
 *   states shown equal. Both chains keep their unchanged parts from state to
 *   state (a tick copies the top level and the clock and keeps everything
 *   else), so only what the pair changed is walked;
 * - the two reductions of one pair — known: the input, twice;
 * - a result against its input — nothing known.
 *
 * Why the first use is sound. The frozen side is deep-frozen, so it cannot
 * have changed since it was shown equal. The unfrozen side is written by
 * nothing but the reducer under test; a reducer that wrote to its input would
 * write to the frozen chain's matching object in the same step — the two
 * chains are given the same actions — and that write throws a TypeError, which
 * is counted. So the shortcut can hide a change only in a run that has already
 * failed the box.
 */
function equalGiven(x: unknown, y: unknown, knownX: unknown, knownY: unknown): boolean {
  if (Object.is(x, y)) return true
  if (Object.is(x, knownX) && Object.is(y, knownY)) return true
  const xr = asRecord(x)
  const yr = asRecord(y)
  if (xr === undefined || yr === undefined) return false
  if (Object.getPrototypeOf(xr) !== Object.getPrototypeOf(yr)) return false
  const keys = Object.keys(xr)
  if (keys.length !== Object.keys(yr).length) return false
  const kx = asRecord(knownX)
  const ky = asRecord(knownY)
  for (const key of keys) {
    if (!Object.hasOwn(yr, key)) return false
    const xv = xr[key]
    const yv = yr[key]
    if (Object.is(xv, yv)) continue
    const kxv = kx?.[key]
    const kyv = ky?.[key]
    if (Object.is(xv, kxv) && Object.is(yv, kyv)) continue
    if (!equalGiven(xv, yv, kxv, kyv)) return false
  }
  return true
}

/** The last pair of states shown deep-equal: the frozen chain's and the unfrozen run's, after the same pair. */
interface ShownEqual {
  readonly frozen: RoomState
  readonly unfrozen: RoomState
}

/** A question copied into new objects, nothing shared with the original. */
const copyQuestion = (q: Question): Question => ({ ...q, alts: [...q.alts], h: [...q.h] })

/**
 * An action copied into new objects for the frozen chain, so that freezing it
 * freezes nothing the unfrozen run holds: a round's `questions` become that
 * round's `questionPool` in the state it starts.
 */
function copyAction(action: Action): Action {
  switch (action.type) {
    case 'startRound':
    case 'startMatch':
    case 'nextRound': {
      const [first, ...rest] = action.questions
      return { ...action, questions: [copyQuestion(first), ...rest.map(copyQuestion)] }
    }
    default:
      return { ...action }
  }
}

// ============================================================================
// One pass, every check at every pair
// ============================================================================

interface SetTally {
  runs: number
  events: number
  /** Pairs the unfrozen run reduced (the harness's visits after an action), and pairs the frozen chain reduced, by type. */
  pairs: { expected: number; unfrozen: number; frozen: number; byType: Record<ActionType, number> }
  /** Gate 4 "Frozen inputs": TypeErrors from writing to frozen input; frozen results that differ from the unfrozen run's; runs whose ready rooms already differ. */
  frozen: { typeErrors: number; differences: number; roomDifferences: number; first: string[] }
  /** Gate 4 "Deterministic": the frozen chain's two reductions of each pair differ. */
  determinism: { differing: number; first: string[] }
  /** Gate 4 "identical when inert": results `===` their input, and results deep-equal to their input but not `===` — by action type. */
  inert: {
    returns: Record<ActionType, number>
    copies: Record<ActionType, number>
    first: string[]
  }
  /** Runs in which the harness stopped feeding the engine — a flow event on a screen without its button. */
  refusedRuns: number
}

const newSetTally = (): SetTally => ({
  runs: 0,
  events: 0,
  pairs: { expected: 0, unfrozen: 0, frozen: 0, byType: perType() },
  frozen: { typeErrors: 0, differences: 0, roomDifferences: 0, first: [] },
  determinism: { differing: 0, first: [] },
  inert: { returns: perType(), copies: perType(), first: [] },
  refusedRuns: 0,
})

/** Thrown out of a run when `reduce` wrote to its frozen input; the run is abandoned, the write tallied. */
class FrozenInputWrite extends Error {}

function checkEveryPair(): Record<SetName, SetTally> {
  const tallies: Record<SetName, SetTally> = { perLength: newSetTally(), tableG: newSetTally() }

  for (const { label, set, run } of perLengthSampleAndTableG()) {
    const t = tallies[set]
    t.runs += 1
    t.events += run.events.length
    t.pairs.expected += expectedPairs(run)

    // The frozen chain's room: the same setup, built from objects of its own —
    // `readyRoom` copies nothing it is given, so the selection is copied here.
    let frozenState = freezeDeep(readyRoom({ ...run.setup, picked: [...run.setup.picked] }))

    /** One reduction of the frozen chain; a TypeError is a write to frozen input. */
    const reduceFrozen = (state: RoomState, action: Action, at: () => string): RoomState => {
      try {
        return reduce(state, action)
      } catch (error) {
        if (!(error instanceof TypeError)) throw error
        t.frozen.typeErrors += 1
        keep(t.frozen.first, `${at()} (${action.type}): ${error.message}`)
        throw new FrozenInputWrite()
      }
    }

    let pair = 0
    /** The last pair of states shown equal; `null` until the ready rooms are. */
    let shown: ShownEqual | null = null
    const visit: MatchVisit = (state, prev, action, step) => {
      if (prev === null || action === null) {
        // The ready room: the two chains start equal — walked in full.
        if (equalGiven(frozenState, state, undefined, undefined)) {
          shown = { frozen: frozenState, unfrozen: state }
        } else {
          t.frozen.roomDifferences += 1
          keep(t.frozen.first, `${label}: the ready rooms differ`)
        }
        return
      }
      // Where this pair is, for a failure message — built only when one is kept.
      const thisPair = pair
      const at = (): string => `${label} step ${step} pair ${thisPair}`
      pair += 1
      t.pairs.unfrozen += 1

      // Gate 4 "Frozen inputs" — the pair deep-frozen, then reduced.
      const frozenAction = freezeDeep(copyAction(action))
      const first = reduceFrozen(frozenState, frozenAction, at)
      // Gate 4 "Deterministic" — and reduced again.
      const second = reduceFrozen(frozenState, frozenAction, at)
      t.pairs.frozen += 1
      const type: ActionType = action.type
      t.pairs.byType[type] += 1

      // …each result equal to the unfrozen run's.
      if (equalGiven(first, state, shown?.frozen, shown?.unfrozen)) {
        shown = { frozen: first, unfrozen: state }
      } else {
        t.frozen.differences += 1
        keep(t.frozen.first, `${at()} (${type}): differs from the unfrozen run`)
      }
      if (!equalGiven(first, second, frozenState, frozenState)) {
        t.determinism.differing += 1
        keep(t.determinism.first, `${at()} (${type})`)
      }

      // Gate 4 "identical when inert" — an action that changes nothing returns its input.
      if (first === frozenState) {
        t.inert.returns[type] += 1
      } else if (equalGiven(first, frozenState, undefined, undefined)) {
        t.inert.copies[type] += 1
        keep(t.inert.first, `${at()} (${type}): an inert action returned a copy`)
      }

      frozenState = freezeDeep(first)
    }

    try {
      const result = runMatch(run, { visit })
      if (!result.engineFedThroughout) t.refusedRuns += 1
    } catch (error) {
      if (!(error instanceof FrozenInputWrite)) throw error
    }
  }
  return tallies
}

describe('NFR-4.3: every pair of the per-length sample and Table G, frozen, reduced twice, against the unfrozen run', () => {
  let t: Record<SetName, SetTally>
  // One pass over 857,187 events — about 1.7 million (state, action) pairs —
  // every check at every pair. The timeout is a ceiling for a slow runner, not
  // the budget: the budget is NFR-4.5's 20 s for the whole project, measured by
  // verification.md Gate 6.
  beforeAll(() => {
    t = checkEveryPair()
  }, 120_000)

  test('the pass walked 15 × 20 generated sequences — 841,487 events, Table F — and all 16 scripted matches — 15,700 events, Table G — giving the engine every event', () => {
    expect({
      perLength: { runs: t.perLength.runs, events: t.perLength.events },
      tableG: { runs: t.tableG.runs, events: t.tableG.events },
      refusedRuns: t.perLength.refusedRuns + t.tableG.refusedRuns,
      // Every event became its action(s): two per tick, one per other event.
      unfrozenPairs: [t.perLength.pairs.unfrozen, t.tableG.pairs.unfrozen],
    }).toStrictEqual({
      perLength: { runs: 300, events: 841_487 },
      tableG: { runs: 16, events: TABLE_G_EVENT_TOTAL },
      refusedRuns: 0,
      unfrozenPairs: [t.perLength.pairs.expected, t.tableG.pairs.expected],
    })
  })

  test('NFR-4.3 (Frozen inputs): every pair of the per-length sample and Table G, deep-frozen, reduces with 0 TypeErrors to the unfrozen run’s result', () => {
    for (const set of ['perLength', 'tableG'] as const) {
      const { pairs, frozen } = t[set]
      expect({ set, frozenPairs: pairs.frozen, ...frozen }).toStrictEqual({
        set,
        frozenPairs: pairs.expected,
        typeErrors: 0,
        differences: 0,
        roomDifferences: 0,
        first: [],
      })
    }
  })

  test('NFR-4.3 (Deterministic): every pair reduced twice gives deep-equal results', () => {
    for (const set of ['perLength', 'tableG'] as const) {
      expect({ set, pairs: t[set].pairs.frozen, ...t[set].determinism }).toStrictEqual({
        set,
        pairs: t[set].pairs.expected,
        differing: 0,
        first: [],
      })
    }
  })

  test('NFR-4.3 (Identical when inert): every action that changes nothing returns its input (===), counted per action type over the per-length sample', () => {
    for (const set of ['perLength', 'tableG'] as const) {
      const { inert } = t[set]
      expect({ set, copies: inert.copies, first: inert.first }).toStrictEqual({
        set,
        copies: perType(),
        first: [],
      })
    }
    // The property is checked on a real population: inert actions occur —
    // a passTurn before the hold is up, a judge action under a reveal — and the
    // action types that never change nothing in this drive never return their
    // input. A tick of 100 ms always moves the engine time; a flow event is
    // given to the engine only on its button's screen, where it takes effect.
    const { returns } = t.perLength.inert
    expect({
      passTurn: returns.passTurn > 0,
      correct: returns.correct > 0,
      skip: returns.skip > 0,
      hint: returns.hint > 0,
      tick: returns.tick,
      startMatch: returns.startMatch,
      nextRound: returns.nextRound,
      resetMatch: returns.resetMatch,
      startRoundGiven: t.perLength.pairs.byType.startRound,
    }).toStrictEqual({
      passTurn: true,
      correct: true,
      skip: true,
      hint: true,
      tick: 0,
      startMatch: 0,
      nextRound: 0,
      resetMatch: 0,
      startRoundGiven: 0,
    })
    console.log(
      `NFR-4.3 inert returns per type, per-length sample: ${JSON.stringify(returns)} of ${JSON.stringify(t.perLength.pairs.byType)}; Table G: ${JSON.stringify(t.tableG.inert.returns)} of ${JSON.stringify(t.tableG.pairs.byType)}`,
    )
  })
})

// ============================================================================
// No ambient time, randomness or timers — at run time
// ============================================================================

describe('NFR-4.3 / REQ-4.1: no ambient time, randomness or timers — at run time', () => {
  // As above, the timeout is a ceiling for a slow runner, not the budget.
  test('the per-length sample and all of Table G run through the engine and the helpers with Date.now, Math.random, performance.now, setTimeout and setInterval throwing: spies shown live first, then 0 calls', () => {
    // Every public runtime function a driver or a screen calls, counted: the
    // reducer and the draw helpers through the harness's engine; the clock,
    // the room predicates and `matchWinner` on every visited state;
    // `shuffleQuestions` once per draw, on the drawn questions, with a seeded
    // source (its output is not used — the harness's draws carry their own
    // permutation). `readyRoom` is the engine's `createRoom` plus test data.
    const calls = {
      readyRoom: 0,
      reduce: 0,
      drawableCategories: 0,
      drawCategory: 0,
      shuffleQuestions: 0,
      remainingMs: 0,
      displaySeconds: 0,
      currentQuestion: 0,
      acceptsJudgeActions: 0,
      matchWinner: 0,
    }
    const counted: MatchEngine = {
      readyRoom: (setup) => {
        calls.readyRoom += 1
        return MATCH_ENGINE.readyRoom(setup)
      },
      reduce: (state, action) => {
        calls.reduce += 1
        return reduce(state, action)
      },
      drawableCategories: (state) => {
        calls.drawableCategories += 1
        return drawableCategories(state)
      },
      drawCategory: (choices, random) => {
        calls.drawCategory += 1
        return drawCategory(choices, random)
      },
    }
    const shuffleSource = mulberry32(MATCH_SEED)
    const TEAMS: readonly Team[] = ['a', 'b']
    const visit: MatchVisit = (state, _prev, action) => {
      for (const team of TEAMS) {
        calls.remainingMs += 1
        const ms = remainingMs(state.clock, team)
        calls.displaySeconds += 1
        displaySeconds(ms)
      }
      calls.currentQuestion += 1
      currentQuestion(state)
      calls.acceptsJudgeActions += 1
      acceptsJudgeActions(state)
      calls.matchWinner += 1
      matchWinner(state)
      if (action !== null && (action.type === 'startMatch' || action.type === 'nextRound')) {
        calls.shuffleQuestions += 1
        shuffleQuestions(action.questions, shuffleSource)
      }
    }

    const throwing = (name: string) => (): never => {
      throw new Error(`${name} was called during a run of the engine`)
    }
    const spies = {
      'Date.now': vi.spyOn(Date, 'now').mockImplementation(throwing('Date.now')),
      'Math.random': vi.spyOn(Math, 'random').mockImplementation(throwing('Math.random')),
      'performance.now': vi
        .spyOn(performance, 'now')
        .mockImplementation(throwing('performance.now')),
      setTimeout: vi.spyOn(globalThis, 'setTimeout').mockImplementation(throwing('setTimeout')),
      setInterval: vi.spyOn(globalThis, 'setInterval').mockImplementation(throwing('setInterval')),
    }
    const callsNow = (): Record<string, number> =>
      Object.fromEntries(Object.entries(spies).map(([name, spy]) => [name, spy.mock.calls.length]))
    /** Calls each spied function once; `true` for each that threw — the spy installed and live. */
    const fire = (): boolean[] =>
      [
        () => Date.now(),
        () => Math.random(),
        () => performance.now(),
        () => clearTimeout(setTimeout(() => undefined, 1_000_000)),
        () => clearInterval(setInterval(() => undefined, 1_000_000)),
      ].map((call) => {
        try {
          call()
          return false
        } catch {
          return true
        }
      })

    let liveBefore: boolean[]
    let before: Record<string, number>
    let after: Record<string, number>
    let liveAfter: boolean[]
    let runs = 0
    let steps = 0
    let pairs = 0
    let draws = 0
    try {
      // The spies are first shown to fire …
      liveBefore = fire()
      before = callsNow()
      // … then the whole workload runs under them: generating the sample,
      // drawing, reducing, reading.
      for (const { run } of perLengthSampleAndTableG()) {
        const result = runMatch(run, { visit, engine: counted })
        runs += 1
        steps += result.stepsConsumed
        pairs += expectedPairs(run)
        draws += run.events.filter((event) => typeof event !== 'string').length
      }
      after = callsNow()
      // … and are still installed at the end.
      liveAfter = fire()
    } finally {
      for (const spy of Object.values(spies)) spy.mockRestore()
    }

    expect({ liveBefore, liveAfter }).toStrictEqual({
      liveBefore: [true, true, true, true, true],
      liveAfter: [true, true, true, true, true],
    })
    // One call each from the first firing, and none from the run.
    expect(before).toStrictEqual({
      'Date.now': 1,
      'Math.random': 1,
      'performance.now': 1,
      setTimeout: 1,
      setInterval: 1,
    })
    expect(after).toStrictEqual(before)

    // The whole workload ran under the spies: every call the runs made is counted.
    const states = pairs + runs
    expect({ runs, steps, calls }).toStrictEqual({
      runs: 300 + 16,
      steps: 841_487 + TABLE_G_EVENT_TOTAL,
      calls: {
        readyRoom: runs,
        reduce: pairs,
        drawableCategories: draws,
        drawCategory: draws,
        shuffleQuestions: draws,
        remainingMs: 2 * states,
        displaySeconds: 2 * states,
        currentQuestion: states,
        acceptsJudgeActions: states,
        matchWinner: states,
      },
    })
    console.log(
      `NFR-4.3 ambient: ${runs} runs, ${steps} events, ${pairs} reductions, ${draws} draws, spy calls during the run ${JSON.stringify(Object.fromEntries(Object.keys(after).map((k) => [k, (after[k] ?? 0) - (before[k] ?? 0)])))}`,
    )
  }, 120_000)
})
