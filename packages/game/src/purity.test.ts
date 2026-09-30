import { beforeAll, describe, expect, test, vi } from 'vitest'

import { displaySeconds, remainingMs } from './clock.js'
import { reduce } from './reducer.js'
import { acceptsJudgeActions, createRoom, currentQuestion } from './room.js'
import { deepFreeze } from './testing/deep-freeze.js'
import {
  ENGINE,
  generatedRun,
  runEngine,
  scenarioRun,
  type Engine,
  type Run,
  type Visit,
} from './testing/harness.js'
import {
  INVARIANT_IDS,
  InvariantViolation,
  assertInvariants,
  deepEqual,
  type InvariantId,
} from './testing/invariants.js'
import { mulberry32 } from './testing/prng.js'
import { PER_LENGTH_SAMPLES, SCENARIOS, SEED, sequences, type Sample } from './testing/sequences.js'
import type { Action, RoomState, Team } from './types.js'

// Property checks over every step of the pre-registered samples — verification.md
// Gate 3 ("A tick that does not end the round changes only `now`", "Additivity",
// "Invariants I1–I10 hold at every step"), Gate 4 ("No zero bank in play", "The
// exported predicate and the reducer agree") and Gate 5 ("Never mutates its
// input", "Deterministic", "No ambient time, randomness or timers — at run
// time"). See specs/phase-3/specs.md §2.8 (the samples, the harness, the
// invariants) and §2.9 (this file's row).
//
// What is walked. The PER-LENGTH SAMPLE — 200 generated sequences for each of
// the 15 legal bank lengths, 3,000 in all, each consumed under §2.8's stop rule
// — and the 13 SCRIPTED SCENARIOS of Table D, each consumed in full. The
// verdict's 10,000-sequence sample is not walked here: by design (specs.md §4,
// R4) the expensive checks run on these two sets only.
//
// What is counted. A run visits the fresh room, the state `startRound` makes
// from it, and the state after each consumed event. Every visited state but
// the fresh room is the result of one (state, action) pair, so for the whole
// pass: pairs = states − runs.
//
// One pass does every check, step by step, and tallies each box's counts;
// each test below then asserts one box's tally in one `toStrictEqual`, so a
// failure reports the count and the first few places it happened.

const HINT: Action = { type: 'hint' }
const SKIP: Action = { type: 'skip' }
const CORRECT: Action = { type: 'correct' }
const tick = (ms: number): Action => ({ type: 'tick', ms })
const TEAMS: readonly Team[] = ['a', 'b']

/** The additivity box's pairs are drawn uniformly from 0 … 3000 each. */
const ADDITIVITY_MAX_MS = 3000

/** Failures kept per check, for the assertion's message. */
const KEEP = 5
const keep = (list: string[], entry: string): void => {
  if (list.length < KEEP) list.push(entry)
}

interface Tally {
  runs: { generated: number; scenarios: number; scenarioEvents: number }
  /** Events consumed, over every run. */
  steps: number
  /** States visited, over every run (see the header). */
  states: number
  /** `pairs`: the sample's (state, action) pairs, each deep-frozen and reduced twice. `typeErrors`: every `reduce` call of the pass that wrote to frozen input. */
  frozen: { pairs: number; typeErrors: number; first: string[] }
  determinism: { pairs: number; differences: number; first: string[] }
  ticks: { all: number; ending: number; checked: number; violations: number; first: string[] }
  invariants: { states: number; byInvariant: Record<InvariantId, number>; first: string[] }
  predicate: { states: number; disagreements: number; first: string[] }
  additivity: {
    states: number
    crossingZero: number
    straddlingZero: number
    violations: number
    first: string[]
  }
}

/** Thrown out of a run when `reduce` wrote to its frozen input; the run is abandoned, the write tallied. */
class FrozenInputWrite extends Error {}

interface LabelledRun {
  readonly label: string
  readonly run: Run
  readonly scenario: boolean
  /** Whether this run is in the 45 s per-length sample, over which additivity is checked. */
  readonly additivity: boolean
}

function* perLengthSampleAndScenarios(): Generator<LabelledRun> {
  for (const sample of PER_LENGTH_SAMPLES) {
    for (const sequence of sequences(sample)) {
      yield {
        label: `${sample.roundSeconds} s #${sequence.index}`,
        run: generatedRun(sample, sequence),
        scenario: false,
        additivity: sample.roundSeconds === 45,
      }
    }
  }
  for (const scenario of SCENARIOS) {
    yield { label: scenario.id, run: scenarioRun(scenario), scenario: true, additivity: false }
  }
}

function checkEveryStep(): Tally {
  const t: Tally = {
    runs: { generated: 0, scenarios: 0, scenarioEvents: 0 },
    steps: 0,
    states: 0,
    frozen: { pairs: 0, typeErrors: 0, first: [] },
    determinism: { pairs: 0, differences: 0, first: [] },
    ticks: { all: 0, ending: 0, checked: 0, violations: 0, first: [] },
    invariants: {
      states: 0,
      byInvariant: Object.fromEntries(INVARIANT_IDS.map((id) => [id, 0])) as Record<
        InvariantId,
        number
      >,
      first: [],
    },
    predicate: { states: 0, disagreements: 0, first: [] },
    additivity: { states: 0, crossingZero: 0, straddlingZero: 0, violations: 0, first: [] },
  }
  // The additivity pairs: one generator, drawn in visiting order (Gate 3).
  const pairRand = mulberry32(SEED + 1)

  // Every `reduce` call in the pass goes through here. Every state the pass
  // hands it is deep-frozen, so a TypeError is a write to frozen input: it is
  // tallied under Gate 5's "Never mutates its input", and the run is abandoned
  // (the pass goes on to the next run).
  const reduceChecked = (state: RoomState, action: Action, at: string): RoomState => {
    try {
      return reduce(state, action)
    } catch (error) {
      if (!(error instanceof TypeError)) throw error
      t.frozen.typeErrors += 1
      keep(t.frozen.first, `${at} (${action.type}): ${error.message}`)
      throw new FrozenInputWrite()
    }
  }

  for (const { label, run, scenario, additivity } of perLengthSampleAndScenarios()) {
    if (scenario) {
      t.runs.scenarios += 1
      t.runs.scenarioEvents += run.events.length
    } else {
      t.runs.generated += 1
    }
    let pair = 0

    // Gate 5 — every pair deep-frozen before `reduce` sees it, and reduced twice.
    const frozenTwice = (state: RoomState, action: Action): RoomState => {
      const at = `${label} pair ${pair}`
      pair += 1
      deepFreeze(state)
      deepFreeze(action)
      t.frozen.pairs += 1
      const first = reduceChecked(state, action, at)
      const second = reduceChecked(state, action, at)
      t.determinism.pairs += 1
      if (!deepEqual(first, second)) {
        t.determinism.differences += 1
        keep(t.determinism.first, at)
      }
      return first
    }

    const visit: Visit = (state, prev, action, step) => {
      const at = `${label} step ${step}`
      deepFreeze(state)
      t.states += 1
      if (action !== null && action.type !== 'startRound') t.steps += 1

      // Gate 3 — I1–I10 (and Gate 4's I5, tallied with them).
      t.invariants.states += 1
      try {
        assertInvariants(state, prev ?? undefined)
      } catch (error) {
        if (!(error instanceof InvariantViolation)) throw error
        for (const id of error.ids) t.invariants.byInvariant[id] += 1
        keep(t.invariants.first, `${at}: ${error.ids.join(' ')}`)
      }

      // Gate 3 — a tick that does not end the round changes only `now`. Whether
      // it ends the round is decided from the state BEFORE it, by the clock's
      // own arithmetic written out here, not by what the reducer returned.
      if (prev !== null && action !== null && action.type === 'tick') {
        t.ticks.all += 1
        const c = prev.clock
        const left =
          c.runningSince === null ? null : c.banks[c.active].ms - (c.now - c.runningSince)
        if (left !== null && left - action.ms <= 0) {
          t.ticks.ending += 1
        } else {
          t.ticks.checked += 1
          if (!deepEqual(state, { ...prev, clock: { ...c, now: c.now + action.ms } })) {
            t.ticks.violations += 1
            keep(t.ticks.first, at)
          }
        }
      }

      // Gate 4 — acceptsJudgeActions is false iff skip and correct are both
      // inert; whenever it is false, hint is inert too.
      t.predicate.states += 1
      const accepts = acceptsJudgeActions(state)
      const skipInert = reduceChecked(state, SKIP, at) === state
      const correctInert = reduceChecked(state, CORRECT, at) === state
      const hintInert = reduceChecked(state, HINT, at) === state
      if (!accepts !== (skipInert && correctInert) || (!accepts && !hintInert)) {
        t.predicate.disagreements += 1
        keep(
          t.predicate.first,
          `${at}: accepts ${accepts}, inert ${skipInert}/${correctInert}/${hintInert}`,
        )
      }

      // Gate 3 — additivity, over the 45 s per-length sample only.
      if (additivity) {
        const a = Math.floor(pairRand() * (ADDITIVITY_MAX_MS + 1))
        const b = Math.floor(pairRand() * (ADDITIVITY_MAX_MS + 1))
        t.additivity.states += 1
        if (state.clock.runningSince !== null) {
          const left = remainingMs(state.clock, state.clock.active)
          if (left <= a + b) {
            t.additivity.crossingZero += 1
            if (left > a) t.additivity.straddlingZero += 1
          }
        }
        const split = reduceChecked(reduceChecked(state, tick(a), at), tick(b), at)
        const whole = reduceChecked(state, tick(a + b), at)
        if (!deepEqual(split, whole)) {
          t.additivity.violations += 1
          keep(t.additivity.first, `${at}: (${a}, ${b})`)
        }
      }
    }

    try {
      runEngine(run, { visit, engine: { ...ENGINE, reduce: frozenTwice } })
    } catch (error) {
      if (!(error instanceof FrozenInputWrite)) throw error
    }
  }
  return t
}

describe('every step of the per-length sample and the scripted scenarios', () => {
  let t: Tally
  // One pass over ~800,000 steps, every check at every step. The timeout is a
  // ceiling for a slow runner, not the budget: the budget is NFR-3.6's 20 s for
  // the whole project, measured by verification.md Gate 7.
  beforeAll(() => {
    t = checkEveryStep()
  }, 120_000)

  test('the pass walked 15 × 200 generated sequences and all 13 scenarios, each scenario in full', () => {
    const scenarioEvents = SCENARIOS.reduce((n, s) => n + s.events.length, 0)
    const runs = t.runs.generated + t.runs.scenarios
    expect({ ...t.runs, states: t.states }).toStrictEqual({
      generated: 15 * 200,
      scenarios: 13,
      scenarioEvents,
      // the fresh room, the started round, and one state per consumed event
      states: t.steps + 2 * runs,
    })
  })

  test('REQ-3.3: never mutates its input — every (state, action) pair deep-frozen before reduce', () => {
    expect(t.frozen).toStrictEqual({
      pairs: t.states - (t.runs.generated + t.runs.scenarios),
      typeErrors: 0,
      first: [],
    })
  })

  test('REQ-3.3: deterministic — every such call made twice gives deep-equal results', () => {
    expect(t.determinism).toStrictEqual({ pairs: t.frozen.pairs, differences: 0, first: [] })
  })

  test('REQ-3.4: a tick that does not end the round changes only clock.now', () => {
    expect(t.ticks).toStrictEqual({
      all: t.ticks.all,
      ending: t.ticks.ending,
      checked: t.ticks.all - t.ticks.ending,
      violations: 0,
      first: [],
    })
    // Both kinds occur: the property is checked on a real population, and the
    // ticks it excludes are the round-ending ones only.
    expect([t.ticks.checked > 0, t.ticks.ending > 0]).toStrictEqual([true, true])
  })

  test('invariants I1–I10 hold at every visited state', () => {
    expect(t.invariants).toStrictEqual({
      states: t.states,
      byInvariant: { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0, I7: 0, I8: 0, I9: 0, I10: 0 },
      first: [],
    })
  })

  test('REQ-3.7: no zero bank in play — invariant I5, on its own', () => {
    expect({ states: t.invariants.states, I5: t.invariants.byInvariant.I5 }).toStrictEqual({
      states: t.states,
      I5: 0,
    })
  })

  test('REQ-3.8: acceptsJudgeActions is false iff skip and correct are inert, and then hint is too', () => {
    expect(t.predicate).toStrictEqual({ states: t.states, disagreements: 0, first: [] })
  })

  test('REQ-3.4: additivity — tick(a) then tick(b) equals tick(a + b) at every state of the 45 s sample', () => {
    expect({ violations: t.additivity.violations, first: t.additivity.first }).toStrictEqual({
      violations: 0,
      first: [],
    })
    // The box requires the pairs that cross zero, including those whose zero
    // falls between the two ticks, to be among those checked.
    expect([
      t.additivity.states > 0,
      t.additivity.crossingZero > 0,
      t.additivity.straddlingZero > 0,
    ]).toStrictEqual([true, true, true])
  })
})

describe('REQ-3.3: no ambient time, randomness or timers — at run time', () => {
  test('the 45 s per-length sample and all 13 scenarios run with Date.now, Math.random, performance.now, setTimeout and setInterval throwing: 0 spy calls', () => {
    const sample: Sample | undefined = PER_LENGTH_SAMPLES.find((s) => s.roundSeconds === 45)
    if (sample === undefined) throw new Error('no 45 s per-length sample')

    const calls = {
      reduce: 0,
      createRoom: 0,
      remainingMs: 0,
      displaySeconds: 0,
      currentQuestion: 0,
      acceptsJudgeActions: 0,
    }
    const counted: Engine = {
      createRoom: (input) => {
        calls.createRoom += 1
        return createRoom(input)
      },
      reduce: (state, action) => {
        calls.reduce += 1
        return reduce(state, action)
      },
    }
    const visit: Visit = (state) => {
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

    let runs = 0
    let steps = 0
    let during: Record<string, number>
    let live: boolean[]
    try {
      for (const sequence of sequences(sample)) {
        steps += runEngine(generatedRun(sample, sequence), { visit, engine: counted }).stepsConsumed
        runs += 1
      }
      for (const scenario of SCENARIOS) {
        steps += runEngine(scenarioRun(scenario), { visit, engine: counted }).stepsConsumed
        runs += 1
      }
      during = Object.fromEntries(
        Object.entries(spies).map(([name, spy]) => [name, spy.mock.calls.length]),
      )
      // Control: each spy was installed and live — calling it throws.
      live = [
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
    } finally {
      for (const spy of Object.values(spies)) spy.mockRestore()
    }

    expect(during).toStrictEqual({
      'Date.now': 0,
      'Math.random': 0,
      'performance.now': 0,
      setTimeout: 0,
      setInterval: 0,
    })
    expect(live).toStrictEqual([true, true, true, true, true])

    // The whole workload ran under the spies: every call the runs made is counted.
    const states = steps + 2 * runs
    expect({ runs, calls }).toStrictEqual({
      runs: 200 + 13,
      calls: {
        reduce: steps + runs,
        createRoom: runs,
        remainingMs: 2 * states,
        displaySeconds: 2 * states,
        currentQuestion: states,
        acceptsJudgeActions: states,
      },
    })
  })
})
