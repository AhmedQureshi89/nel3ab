import { beforeAll, describe, expect, test } from 'vitest'

import { displaySeconds, remainingMs } from './clock.js'
import { ROUND_SECONDS_OPTIONS } from './rules.js'
import { generatedRun, runEngine, scenarioRun, type RunResult } from './testing/harness.js'
import { mulberry32 } from './testing/prng.js'
import { prototypeOracle, type Arithmetic } from './testing/prototype-oracle.js'
import {
  PER_LENGTH_SAMPLES,
  POOL,
  SCENARIOS,
  SCENARIO_ROUND_SECONDS,
  SCENARIO_STARTING_TEAM,
  SEED,
  VERDICT_SAMPLE,
  sequences,
  type Sample,
  type Scenario,
} from './testing/sequences.js'
import type { Team } from './types.js'

// Equivalence with the prototype — verification.md Gate 6's ORDINARY boxes,
// in the gate's order: the generator's fingerprint (Table C), the oracles'
// anchors (Table A), oracle against oracle (Table B), the engine against the
// EXACT oracle, the scripted scenarios (Table D), and the cost of the owner's
// 2026-09-30 decision (engine against the FLOAT oracle, per-length sample
// only). See specs/phase-3/specs.md §2.8 (the samples, the oracle, the harness)
// and §2.9 (this file's row).
//
// The first three prove that the generator, the two oracles and the harness
// reproduce the planning session's measurement BEFORE the engine is judged
// against any of them. Every expected number below is transcribed from
// verification.md's "Pre-registered values" — Tables A, B and C here, Table D
// in testing/sequences.ts — and none is derived from a run.
//
// NOT HERE: the 🚦 verdict box of REQ-3.11 — the engine against the FLOAT
// oracle on the verdict's 45 s sample and on the scripted scenarios. It is a
// verdict gate, evaluated exactly once, by its own test. No run in this file
// asks the harness for that comparison: the verdict sample is run with
// `engineVsFloat` off, and the scenarios never step the float oracle at all.

// ============================================================================
// Pre-registered values (verification.md) — transcribed, never computed
// ============================================================================

/** Table A's columns: every legal bank length, 20 … 90 s. */
const TABLE_A_BANKS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90] as const

interface SilentRound {
  readonly ticksToEnd: readonly (number | null)[]
  readonly wrongSecondTicks: readonly number[]
}

/** Table A — the prototype's silent round: ticks to end, and wrong-second ticks, per bank length. */
const TABLE_A: Readonly<Record<Arithmetic, SilentRound>> = {
  float: {
    ticksToEnd: [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 801, 851, 901],
    wrongSecondTicks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 29, 54, 80, 85, 90],
  },
  exact: {
    ticksToEnd: [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900],
    wrongSecondTicks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
}

interface TableBRow {
  readonly roundSeconds: number
  readonly seed: number
  readonly n: number
  /** Sequences in which the float and exact oracles' observations differ at any consumed step. */
  readonly diverging: number
  /** Total steps consumed under the stop rule. */
  readonly steps: number
}

/** Table B — the verdict sample, then the 15 per-length samples. */
const TABLE_B: readonly TableBRow[] = [
  { roundSeconds: 45, seed: 0x20260930, n: 10_000, diverging: 0, steps: 2_422_066 },
  { roundSeconds: 20, seed: 0x20260930 + 20, n: 200, diverging: 51, steps: 30_373 },
  { roundSeconds: 25, seed: 0x20260930 + 25, n: 200, diverging: 1, steps: 34_012 },
  { roundSeconds: 30, seed: 0x20260930 + 30, n: 200, diverging: 0, steps: 38_528 },
  { roundSeconds: 35, seed: 0x20260930 + 35, n: 200, diverging: 0, steps: 42_157 },
  { roundSeconds: 40, seed: 0x20260930 + 40, n: 200, diverging: 0, steps: 45_306 },
  { roundSeconds: 45, seed: 0x20260930 + 45, n: 200, diverging: 0, steps: 51_299 },
  { roundSeconds: 50, seed: 0x20260930 + 50, n: 200, diverging: 0, steps: 52_582 },
  { roundSeconds: 55, seed: 0x20260930 + 55, n: 200, diverging: 0, steps: 54_604 },
  { roundSeconds: 60, seed: 0x20260930 + 60, n: 200, diverging: 0, steps: 57_798 },
  { roundSeconds: 65, seed: 0x20260930 + 65, n: 200, diverging: 165, steps: 59_370 },
  { roundSeconds: 70, seed: 0x20260930 + 70, n: 200, diverging: 192, steps: 63_901 },
  { roundSeconds: 75, seed: 0x20260930 + 75, n: 200, diverging: 193, steps: 62_545 },
  { roundSeconds: 80, seed: 0x20260930 + 80, n: 200, diverging: 192, steps: 65_081 },
  { roundSeconds: 85, seed: 0x20260930 + 85, n: 200, diverging: 191, steps: 72_902 },
  { roundSeconds: 90, seed: 0x20260930 + 90, n: 200, diverging: 189, steps: 71_514 },
]

/** Table C — `mulberry32(0x20260930)`'s first three draws to 10 places, and the verdict sample's sequence 0. */
const TABLE_C = {
  draws: ['0.6190389520', '0.3909395928', '0.0691457547'],
  sequence0: {
    index: 0,
    rate: 0.01,
    startingTeam: 'a',
    firstSixNonTick: [
      [100, 'correct'],
      [159, 'hint'],
      [174, 'skip'],
      [199, 'skip'],
      [272, 'skip'],
      [303, 'correct'],
    ],
  },
}

// ============================================================================
// The passes — every run of this file, made once, tallied per box
// ============================================================================

/** Failures kept per list, for an assertion's message. */
const KEEP = 5
const keep = (list: string[], entry: string): void => {
  if (list.length < KEEP) list.push(entry)
}

interface SampleTally {
  readonly roundSeconds: number
  readonly seed: number
  readonly n: number
  sequences: number
  steps: number
  /** Indices of the sequences whose float and exact observations differ at some consumed step. */
  floatVsExact: number[]
  /** Indices of the sequences whose engine and exact observations differ at some consumed step. */
  engineVsExact: number[]
  /** Indices of the sequences whose engine and float observations differ — per-length samples only; `null` where not compared. */
  engineVsFloat: number[] | null
  /** Sequences in which the engine's round, or the exact oracle's, ended. */
  ending: number
  /** Indices of the sequences whose engine and exact oracle name different losers. */
  loserMismatches: number[]
  first: string[]
}

const show = (label: string, name: string, r: RunResult['engineVsExact']): string =>
  r === null
    ? ''
    : `${label} ${name} step ${r.step}: ${JSON.stringify(r.left)} vs ${JSON.stringify(r.right)}`

/** One generated sample through the harness, every sequence, in order. */
function runSample(sample: Sample, engineVsFloat: boolean): SampleTally {
  const t: SampleTally = {
    roundSeconds: sample.roundSeconds,
    seed: sample.seed,
    n: sample.n,
    sequences: 0,
    steps: 0,
    floatVsExact: [],
    engineVsExact: [],
    engineVsFloat: engineVsFloat ? [] : null,
    ending: 0,
    loserMismatches: [],
    first: [],
  }
  for (const sequence of sequences(sample)) {
    const label = `${sample.roundSeconds} s #${sequence.index}`
    const r = runEngine(generatedRun(sample, sequence), { floatVsExact: true, engineVsFloat })
    t.sequences += 1
    t.steps += r.stepsConsumed
    if (r.floatVsExact === undefined) throw new Error(`${label}: float/exact was not compared`)
    if (r.floatVsExact !== null) t.floatVsExact.push(sequence.index)
    if (r.engineVsExact !== null) {
      t.engineVsExact.push(sequence.index)
      keep(t.first, show(label, 'engine/exact', r.engineVsExact))
    }
    if (t.engineVsFloat !== null) {
      if (r.engineVsFloat === undefined) throw new Error(`${label}: engine/float was not compared`)
      if (r.engineVsFloat !== null) t.engineVsFloat.push(sequence.index)
    }
    if (r.loser !== null || r.exactLoser !== null) t.ending += 1
    if (r.loser !== r.exactLoser) {
      t.loserMismatches.push(sequence.index)
      keep(t.first, `${label}: loser engine ${r.loser} exact ${r.exactLoser}`)
    }
  }
  return t
}

interface ScenarioTally {
  readonly id: string
  steps: number
  engineVsExact: RunResult['engineVsExact']
  loser: Team | null
  exactLoser: Team | null
  /** The 1-based step after which the engine's round has ended; `null` for never. */
  endsAt: number | null
  hintIndex: number
  questionIndex: number
  /** Team `b`'s display at every state from the started round on. */
  teamBDisplays: Set<number>
  /** Team `a`'s display at every state from the first reveal on; empty if none went up. */
  teamADisplaysFromReveal: Set<number>
  revealUpAtEnd: boolean
  teamADisplayAtEnd: number
  /** For a round that ended: the active bank's stored ms, which REQ-3.7 requires to be exactly 0. */
  endedBankMs: number | null
}

/** One scripted scenario through the harness, in full. The float oracle is never stepped. */
function runScenario(scenario: Scenario): ScenarioTally {
  const t: ScenarioTally = {
    id: scenario.id,
    steps: 0,
    engineVsExact: null,
    loser: null,
    exactLoser: null,
    endsAt: null,
    hintIndex: -1,
    questionIndex: -1,
    teamBDisplays: new Set(),
    teamADisplaysFromReveal: new Set(),
    revealUpAtEnd: false,
    teamADisplayAtEnd: -1,
    endedBankMs: null,
  }
  let revealSeen = false
  const r = runEngine(scenarioRun(scenario), {
    visit: (state, _prev, action, step) => {
      if (action === null) return // the fresh room: the round has not started
      t.teamBDisplays.add(displaySeconds(remainingMs(state.clock, 'b')))
      if (state.reveal !== null) revealSeen = true
      if (revealSeen) t.teamADisplaysFromReveal.add(displaySeconds(remainingMs(state.clock, 'a')))
      if (t.endsAt === null && state.screen === 'roundEnd') t.endsAt = step
    },
  })
  t.steps = r.stepsConsumed
  t.engineVsExact = r.engineVsExact
  t.loser = r.loser
  t.exactLoser = r.exactLoser
  t.hintIndex = r.final.hintIndex
  t.questionIndex = r.final.questionIndex
  t.revealUpAtEnd = r.final.reveal !== null
  t.teamADisplayAtEnd = displaySeconds(remainingMs(r.final.clock, 'a'))
  t.endedBankMs =
    r.final.screen === 'roundEnd' ? r.final.clock.banks[r.final.clock.active].ms : null
  return t
}

/** The EXACT oracle alone through a scenario, in full: its ends-at step and final indices. */
function exactScenario(scenario: Scenario): {
  readonly id: string
  readonly endsAt: number | null
  readonly hintIndex: number
  readonly questionIndex: number
  readonly teamBAlways45: boolean
} {
  const oracle = prototypeOracle(
    'exact',
    SCENARIO_ROUND_SECONDS,
    SCENARIO_STARTING_TEAM,
    scenario.pool,
  )
  let endsAt: number | null = null
  let teamBAlways45 = oracle.observe()[1] === 45
  scenario.events.forEach((event, i) => {
    oracle.step(event)
    const [, displayB, ended] = oracle.observe()
    if (displayB !== 45) teamBAlways45 = false
    if (endsAt === null && ended) endsAt = i + 1
  })
  const [, , , , hintIndex, questionIndex] = oracle.observe()
  return { id: scenario.id, endsAt, hintIndex, questionIndex, teamBAlways45 }
}

// ============================================================================
// Gate 6 — the ordinary boxes, in the gate's order
// ============================================================================

describe('Gate 6 — equivalence with the prototype (the ordinary boxes)', () => {
  let verdict: SampleTally
  let perLength: SampleTally[]
  let scenarios: ScenarioTally[]

  // ~3.2 million lockstep steps. The timeout is a ceiling for a slow runner,
  // not the budget: the budget is NFR-3.6's 20 s for the whole project.
  beforeAll(() => {
    // The verdict sample: float against exact (Table B, row 1) and the engine
    // against EXACT. `engineVsFloat` is off — see the header.
    verdict = runSample(VERDICT_SAMPLE, false)
    // The per-length samples: the one place the engine meets the float oracle
    // in this file ("The decision's cost, recorded").
    perLength = PER_LENGTH_SAMPLES.map((sample) => runSample(sample, true))
    scenarios = SCENARIOS.map(runScenario)
  }, 120_000)

  test('REQ-3.11: generator fingerprint — mulberry32(SEED) and the verdict sample’s sequence 0 reproduce Table C', () => {
    const rand = mulberry32(SEED)
    const draws = [rand(), rand(), rand()].map((d) => d.toFixed(10))

    const first = sequences(VERDICT_SAMPLE).next()
    if (first.done === true) throw new Error('the verdict sample yielded no sequence')
    const sequence0 = first.value
    const firstSixNonTick = sequence0.events
      .flatMap((event, i) => (event === 'tick' ? [] : [[i, event]]))
      .slice(0, 6)

    expect({
      seed: SEED,
      draws,
      sequence0: {
        index: sequence0.index,
        rate: sequence0.rate,
        startingTeam: sequence0.startingTeam,
        firstSixNonTick,
      },
    }).toStrictEqual({ seed: 0x20260930, ...TABLE_C })
  })

  test('REQ-3.11: oracle anchors — the float oracle reproduces every float row of Table A, the exact oracle every exact row', () => {
    expect([...ROUND_SECONDS_OPTIONS]).toStrictEqual([...TABLE_A_BANKS])

    // "Wrong-second ticks" (verification.md, above Table A): the ticks
    // k = 1, 2, … after which the bank is still above zero and the displayed
    // second is not ⌈(10·S − k) / 10⌉.
    const silentRound = (arithmetic: Arithmetic, roundSeconds: number) => {
      const oracle = prototypeOracle(arithmetic, roundSeconds, 'a', POOL)
      const limit = roundSeconds * 10 + 100
      let k = 0
      let wrong = 0
      while (!oracle.observe()[2]) {
        if (k === limit) return { ticksToEnd: null, wrong }
        oracle.step('tick')
        k += 1
        const [displayA] = oracle.observe()
        if (oracle.bank('a') > 0 && displayA !== Math.ceil((10 * roundSeconds - k) / 10)) {
          wrong += 1
        }
      }
      return { ticksToEnd: k, wrong }
    }

    const measure = (arithmetic: Arithmetic): SilentRound => {
      const rounds = TABLE_A_BANKS.map((s) => silentRound(arithmetic, s))
      return {
        ticksToEnd: rounds.map((r) => r.ticksToEnd),
        wrongSecondTicks: rounds.map((r) => r.wrong),
      }
    }
    const measured: Record<Arithmetic, SilentRound> = {
      float: measure('float'),
      exact: measure('exact'),
    }

    // Values matched, of 30 per arithmetic (two rows × 15 lengths).
    const matched = (arithmetic: Arithmetic): number =>
      (['ticksToEnd', 'wrongSecondTicks'] as const).reduce(
        (n, row) =>
          n +
          measured[arithmetic][row].filter((v, i) => Object.is(v, TABLE_A[arithmetic][row][i]))
            .length,
        0,
      )
    expect({ float: matched('float'), exact: matched('exact') }).toStrictEqual({
      float: 30,
      exact: 30,
    })
    expect(measured).toStrictEqual(TABLE_A)
  })

  test('REQ-3.11: oracle against oracle — float and exact through the harness reproduce all 16 rows of Table B', () => {
    const rows = [verdict, ...perLength].map((t): TableBRow => ({
      roundSeconds: t.roundSeconds,
      seed: t.seed,
      n: t.n,
      diverging: t.floatVsExact.length,
      steps: t.steps,
    }))
    const rowsMatched = rows.filter((row, i) => {
      const expected = TABLE_B[i]
      return (
        expected !== undefined &&
        row.roundSeconds === expected.roundSeconds &&
        row.seed === expected.seed &&
        row.n === expected.n &&
        row.diverging === expected.diverging &&
        row.steps === expected.steps
      )
    }).length
    expect(rowsMatched).toBe(16)
    expect(rows).toStrictEqual(TABLE_B)
    // Every sequence of every sample was run.
    expect([verdict, ...perLength].map((t) => t.sequences)).toStrictEqual(TABLE_B.map((r) => r.n))
  })

  test('REQ-3.4: the engine is exact arithmetic — its observation equals the exact oracle’s at every consumed step, with the same loser, in all 13,013 sequences', () => {
    const generated = [verdict, ...perLength]
    const scenarioEvents = SCENARIOS.reduce((n, s) => n + s.events.length, 0)
    const measured = {
      sequences: scenarios.length + generated.reduce((n, t) => n + t.sequences, 0),
      steps:
        scenarios.reduce((n, s) => n + s.steps, 0) + generated.reduce((n, t) => n + t.steps, 0),
      diverging: {
        scenarios: scenarios.filter((s) => s.engineVsExact !== null).map((s) => s.id),
        perLength: perLength.reduce((n, t) => n + t.engineVsExact.length, 0),
        verdict: verdict.engineVsExact.length,
      },
      loserMismatches:
        scenarios.filter((s) => s.loser !== s.exactLoser).length +
        generated.reduce((n, t) => n + t.loserMismatches.length, 0),
      first: [
        ...scenarios.map((s) => show(s.id, 'engine/exact', s.engineVsExact)).filter(Boolean),
        ...generated.flatMap((t) => t.first),
      ].slice(0, KEEP),
    }
    expect(measured).toStrictEqual({
      sequences: 13 + 15 * 200 + 10_000,
      // Every scenario in full; every generated sequence under the stop rule.
      steps: scenarioEvents + TABLE_B.reduce((n, r) => n + r.steps, 0),
      diverging: { scenarios: [], perLength: 0, verdict: 0 },
      loserMismatches: 0,
      first: [],
    })
    // The loser comparison has a population: rounds that end, in every set.
    expect([
      scenarios.filter((s) => s.loser !== null).length > 0,
      perLength.every((t) => t.ending > 0),
      verdict.ending > 0,
    ]).toStrictEqual([true, true, true])
  })

  test('REQ-3.11: scripted scenarios — the engine reproduces Table D: the step each round ends, the final indices, team b reading 45 throughout', () => {
    const expected = SCENARIOS.map((s) => ({
      id: s.id,
      endsAt: s.endsAt,
      hintIndex: s.hintIndex,
      questionIndex: s.questionIndex,
      teamBAlways45: true,
    }))
    const engine = scenarios.map((s) => ({
      id: s.id,
      endsAt: s.endsAt,
      hintIndex: s.hintIndex,
      questionIndex: s.questionIndex,
      teamBAlways45: s.teamBDisplays.size === 1 && s.teamBDisplays.has(45),
    }))
    expect(engine).toStrictEqual(expected)
    // The EXACT oracle, alone through each scenario, reproduces Table D too.
    expect(SCENARIOS.map(exactScenario)).toStrictEqual(expected)

    // What Table D's last column pins down, beyond the three columns above.
    const byId = new Map(scenarios.map((s) => [s.id, s]))
    const s8 = byId.get('S8')
    const s9 = byId.get('S9')
    expect({
      // S8: reveal up at the end; team a reads 35 from the reveal onward.
      s8: s8 && { revealUpAtEnd: s8.revealUpAtEnd, fromReveal: [...s8.teamADisplaysFromReveal] },
      // S9: one tick from zero — live, team a reads 1.
      s9: s9 && { endsAt: s9.endsAt, teamAAtEnd: s9.teamADisplayAtEnd },
      // S4–S6 and every other round that ends: the bank is exactly 0, not below.
      endedBanks: scenarios.filter((s) => s.endedBankMs !== null).map((s) => s.endedBankMs),
    }).toStrictEqual({
      s8: { revealUpAtEnd: true, fromReveal: [35] },
      s9: { endsAt: null, teamAAtEnd: 1 },
      endedBanks: SCENARIOS.filter((s) => s.endsAt !== null).map(() => 0),
    })
  })

  test('REQ-3.4: the decision’s cost, recorded — per per-length row, the engine diverges from the FLOAT oracle in exactly Table B’s count of sequences', () => {
    const perLengthRows = TABLE_B.slice(1)
    const measured = perLength.map((t) => ({
      roundSeconds: t.roundSeconds,
      engineVsFloat: t.engineVsFloat?.length ?? null,
    }))
    const rowsEqual = measured.filter(
      (row, i) => row.engineVsFloat === perLengthRows[i]?.diverging,
    ).length
    expect(rowsEqual).toBe(15)
    expect(measured).toStrictEqual(
      perLengthRows.map((r) => ({ roundSeconds: r.roundSeconds, engineVsFloat: r.diverging })),
    )
    // And they are the same sequences: the engine diverges from the prototype's
    // arithmetic exactly where exact arithmetic does.
    expect(perLength.map((t) => t.engineVsFloat)).toStrictEqual(
      perLength.map((t) => t.floatVsExact),
    )
  })
})
