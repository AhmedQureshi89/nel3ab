import { isDeepStrictEqual } from 'node:util'

import { beforeAll, describe, expect, test } from 'vitest'

import { ROUND_SECONDS_OPTIONS } from './rules.js'
import { INVARIANT_IDS } from './testing/invariants.js'
import {
  runMatch,
  scriptedRun,
  type MatchDivergence,
  type MatchRun,
  type MatchVisit,
} from './testing/match-harness.js'
import {
  MATCH_INVARIANT_IDS,
  MatchInvariantViolation,
  assertMatchInvariants,
  type AnyInvariantId,
} from './testing/match-invariants.js'
import { matchOracle, type Arithmetic, type OracleView } from './testing/match-oracle.js'
import {
  MATCH_MAX_STEPS,
  MATCH_PER_LENGTH_SAMPLES,
  MATCH_RATES,
  MATCH_SEED,
  MATCH_VERDICT_SAMPLE,
  TABLE_G,
  TABLE_G_DEFAULT,
  TABLE_G_EVENT_TOTAL,
  matchSequences,
  type GeneratedMatch,
  type MatchSample,
  type ScriptedMatch,
  type TableGFinal,
  type TableGId,
} from './testing/match-sequences.js'
import { mulberry32 } from './testing/prng.js'
import type { Screen } from './types.js'

// Equivalence with the prototype — specs/phase-4/verification.md Gate 5, in the
// gate's order: its ORDINARY boxes. The generator's fingerprint (Table E), the
// match oracle's anchor (Phase 3's Table A), oracle against oracle (Table F),
// the scripted matches through both oracles (Table G), the engine against the
// EXACT oracle, the cost of the owner's 2026-09-30 decision (the engine against
// the FLOAT oracle, per-length sample only), and the invariants I1–I10 and
// J1–J8. See specs/phase-4/specs.md §2.10 (the samples, the oracle, the
// harness, the invariants) and §2.11 (this file's row), and Phase 3's
// prototype-equivalence.test.ts, whose pattern this follows and which is not
// edited.
//
// The first four prove that the generator, the two oracles and the harness
// reproduce the planning session's measurement BEFORE the engine is judged
// against any of them. Every expected number below is transcribed from
// verification.md's "Pre-registered values" — Phase 3's Table A anchor and
// Tables E and F here, Table G in testing/match-sequences.ts — and none is
// derived from a run.
//
// The 🚦 verdict box of REQ-4.14 — the engine against the FLOAT oracle on the
// 45 s verdict sample and on Table G — is a verdict gate, evaluated exactly
// once, by the test written for that box, in its own describe block after
// these. Nothing here makes that comparison: the pass over the verdict sample
// and the pass over Table G both leave the harness's `engineVsFloat` off, and
// the test "engine ≡ float was asked for on the per-length sample only" below
// asserts that neither result carries it.
//
// The budget (NFR-4.5, specs.md §4 R4). Each set is run ONCE, and every box
// reads that one run: the verdict sample with float ≡ exact on (Table F row 1;
// engine ≡ exact); the per-length sample with float ≡ exact and engine ≡ float
// on (Table F rows 2–16; engine ≡ exact; the decision's cost) and the
// invariants at every visited state; Table G with float ≡ exact on and the
// invariants. The invariants are NOT checked on the verdict sample (specs.md
// §2.10 names the per-length sample and Table G), and nothing of
// match-purity.test.ts's work is repeated here.

// ============================================================================
// Pre-registered values (verification.md) — transcribed, never computed
// ============================================================================

/** Phase 3's Table A columns: every legal bank length, 20 … 90 s. */
const TABLE_A_LENGTHS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90] as const

/**
 * Phase 3's Table A, reused as an anchor (Phase 4's verification.md,
 * "Pre-registered values"): a full bank drained by ticks alone ends after these
 * many ticks in float — 801, 851, 901 at 80, 85, 90 s, the prototype's known
 * defects — and after `10 × S` ticks in exact.
 */
const TABLE_A_TICKS_TO_END: Readonly<Record<Arithmetic, readonly number[]>> = {
  float: [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 801, 851, 901],
  exact: [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900],
}

/** One sequence's row of Table E. */
interface TableESequence {
  readonly index: number
  readonly setup: GeneratedMatch['setup']
  readonly rate: number
  readonly events: number
  readonly matchesEnded: number
  /** "Exact oracle at the end": screen, round, tallies A–B, judge — and the log, where the table states one. */
  readonly exactAtEnd: {
    readonly screen: Screen
    readonly round: number
    readonly tallies: readonly [a: number, b: number]
    readonly judgeIndex: number
    readonly log?: readonly string[]
  }
  /** "Event counts", every type; a type the table does not list occurs 0 times (the listed counts sum to the events). */
  readonly eventCounts: Readonly<Record<EventType, number>>
}

type EventType = 'startMatch' | 'nextRound' | 'tick' | 'correct' | 'skip' | 'hint' | 'resetMatch'

interface TableE {
  readonly draws: readonly string[]
  readonly sequences: readonly TableESequence[]
  readonly sequence0: {
    readonly nonTickSteps: readonly number[]
    readonly roundsEndAt: readonly number[]
    readonly eventAt367: EventType | 'none'
  }
}

/**
 * Table E — `mulberry32(0x20261002)`'s first three draws to 10 places, and the
 * verdict sample's first three sequences. "8 picked" is c0–c7: a configuration
 * selects `categoryIds(k)` (specs.md §2.10, `drawMatchConfig`).
 */
const TABLE_E: TableE = {
  draws: ['0.1825684069', '0.6584435350', '0.6478405960'],
  sequences: [
    {
      index: 0,
      setup: {
        roundSeconds: 45,
        winsNeeded: 2,
        picked: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'],
        players: 7,
        rotateJudge: true,
        judgeIndex: 5,
      },
      rate: 0.02,
      events: 368,
      matchesEnded: 0,
      exactAtEnd: { screen: 'setup', round: 1, tallies: [0, 0], judgeIndex: 5 },
      eventCounts: {
        startMatch: 1,
        nextRound: 0,
        tick: 362,
        correct: 0,
        skip: 2,
        hint: 2,
        resetMatch: 1,
      },
    },
    {
      index: 1,
      setup: {
        roundSeconds: 45,
        winsNeeded: 4,
        picked: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
        players: 2,
        rotateJudge: true,
        judgeIndex: 1,
      },
      rate: 0.05,
      events: 5_163,
      matchesEnded: 2,
      exactAtEnd: {
        screen: 'match',
        round: 4,
        tallies: [4, 0],
        judgeIndex: 0,
        log: ['1·c2·a', '2·c5·a', '3·c3·a', '4·c0·a'],
      },
      eventCounts: {
        startMatch: 2,
        nextRound: 7,
        tick: 4_903,
        correct: 125,
        skip: 74,
        hint: 52,
        resetMatch: 0,
      },
    },
    {
      index: 2,
      setup: {
        roundSeconds: 45,
        winsNeeded: 3,
        picked: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
        players: 8,
        rotateJudge: false,
        judgeIndex: 6,
      },
      rate: 0.1,
      events: 1_066,
      matchesEnded: 0,
      exactAtEnd: { screen: 'setup', round: 1, tallies: [0, 0], judgeIndex: 6 },
      eventCounts: {
        startMatch: 1,
        nextRound: 1,
        tick: 953,
        correct: 50,
        skip: 42,
        hint: 18,
        resetMatch: 1,
      },
    },
  ],
  /** Sequence 0's non-tick events, 1-based: "steps 1, 25, 114, 119, 367 (the hint that ends round 1), 368". */
  sequence0: { nonTickSteps: [1, 25, 114, 119, 367, 368], roundsEndAt: [367], eventAt367: 'hint' },
}

type SampleKind = 'verdict' | 'per-length'

interface TableFRow {
  readonly sample: SampleKind
  readonly roundSeconds: number
  readonly seed: number
  readonly n: number
  /** Sequences in which the float and exact oracles' observations differ at any step. */
  readonly diverging: number
  /** Total events consumed. */
  readonly steps: number
  /** Times a match ended. */
  readonly matchesEnded: number
  /** Sequences ended by `resetMatch`. */
  readonly endedByReset: number
}

/** One row of Table F as the table prints it, column for column. */
type TableFLine = readonly [
  sample: SampleKind,
  roundSeconds: number,
  seed: number,
  n: number,
  diverging: number,
  steps: number,
  matchesEnded: number,
  endedByReset: number,
]

/** Table F — the verdict sample, then the 15 per-length samples. No sequence reached `MATCH_MAX_STEPS` in any row. */
const TABLE_F: readonly TableFRow[] = (
  [
    // sample, roundSeconds, seed, n, diverging sequences, steps consumed, matches ended, ended by resetMatch
    ['verdict', 45, 0x20261002, 500, 0, 1_156_355, 593, 332],
    ['per-length', 20, 0x20261002 + 20, 20, 11, 16_248, 23, 13],
    ['per-length', 25, 0x20261002 + 25, 20, 1, 21_743, 22, 16],
    ['per-length', 30, 0x20261002 + 30, 20, 0, 30_327, 24, 13],
    ['per-length', 35, 0x20261002 + 35, 20, 0, 34_123, 24, 14],
    ['per-length', 40, 0x20261002 + 40, 20, 0, 37_965, 20, 14],
    ['per-length', 45, 0x20261002 + 45, 20, 0, 43_472, 19, 15],
    ['per-length', 50, 0x20261002 + 50, 20, 0, 51_514, 23, 14],
    ['per-length', 55, 0x20261002 + 55, 20, 0, 57_800, 23, 13],
    ['per-length', 60, 0x20261002 + 60, 20, 0, 60_472, 21, 14],
    ['per-length', 65, 0x20261002 + 65, 20, 20, 73_159, 29, 11],
    ['per-length', 70, 0x20261002 + 70, 20, 20, 85_873, 27, 10],
    ['per-length', 75, 0x20261002 + 75, 20, 20, 66_851, 24, 14],
    ['per-length', 80, 0x20261002 + 80, 20, 20, 96_182, 27, 11],
    ['per-length', 85, 0x20261002 + 85, 20, 20, 88_203, 21, 16],
    ['per-length', 90, 0x20261002 + 90, 20, 20, 77_555, 20, 16],
  ] satisfies readonly TableFLine[]
).map(
  ([sample, roundSeconds, seed, n, diverging, steps, matchesEnded, endedByReset]): TableFRow => ({
    sample,
    roundSeconds,
    seed,
    n,
    diverging,
    steps,
    matchesEnded,
    endedByReset,
  }),
)

/** Table F's own sentence: "The per-length rows total 841,487 steps; with the verdict row, 1,997,842." */
const TABLE_F_STEP_TOTALS = { perLength: 841_487, all: 1_997_842 }

// ============================================================================
// Shared helpers
// ============================================================================

/** Failures kept per list, for an assertion's message. */
const KEEP = 5
const keep = (list: string[], entry: string): void => {
  if (list.length < KEEP) list.push(entry)
}

const show = (label: string, pair: string, d: MatchDivergence | null | undefined): string =>
  d === null || d === undefined
    ? ''
    : `${label} ${pair} step ${d.step}: ${JSON.stringify(d.left)} vs ${JSON.stringify(d.right)}${d.refused === undefined ? '' : ` (refused: ${d.refused})`}`

const eventType = (event: GeneratedMatch['events'][number]): EventType =>
  typeof event === 'string' ? event : event.type

/** A round has ended after an event exactly when that event took the screen from `play` to `roundEnd` or `match`. */
const roundEnded = (before: Screen, after: Screen): boolean =>
  before === 'play' && (after === 'roundEnd' || after === 'match')

/** A log entry as Table G writes it: `n·category·winner`. */
const tabledLog = (view: OracleView): string[] =>
  view.log.map(({ n, category, winner }) => `${n}·${category}·${winner}`)

/** What Table G states of a final state, read from an oracle's view, in the table's shape. */
const tableGView = (view: OracleView): TableGFinal => ({
  screen: view.screen,
  round: view.round,
  tallies: [view.tallyA, view.tallyB],
  judgeIndex: view.judgeIndex,
  active: view.active,
  used: view.used,
  log: tabledLog(view),
  display: view.display,
  started: view.started,
  questionIndex: view.questionIndex,
  hintIndex: view.hintIndex,
})

/** What a run should give the engine: two actions per tick event (`tick`, `passTurn`), one per other. */
const expectedPairs = (run: MatchRun): number =>
  run.events.reduce<number>((n, event) => n + (event === 'tick' ? 2 : 1), 0)

// ============================================================================
// The invariants — tallied per set, at every state the engine visits
// ============================================================================

const ALL_INVARIANT_IDS: readonly AnyInvariantId[] = [...INVARIANT_IDS, ...MATCH_INVARIANT_IDS]

const noViolations = (): Record<AnyInvariantId, number> => ({
  I1: 0,
  I2: 0,
  I3: 0,
  I4: 0,
  I5: 0,
  I6: 0,
  I7: 0,
  I8: 0,
  I9: 0,
  I10: 0,
  J1: 0,
  J2: 0,
  J3: 0,
  J4: 0,
  J5: 0,
  J6: 0,
  J7: 0,
  J8: 0,
})

interface InvariantTally {
  runs: number
  /** Expected visits: the ready room once per run, then one per action given (two per tick event). */
  expectedStates: number
  states: number
  /** States per screen, and states with a reveal up — the population each conditional invariant speaks of. */
  byScreen: Record<Screen, number>
  revealUp: number
  violatingStates: number
  byInvariant: Record<AnyInvariantId, number>
  first: string[]
}

const newInvariantTally = (): InvariantTally => ({
  runs: 0,
  expectedStates: 0,
  states: 0,
  byScreen: { setup: 0, ready: 0, play: 0, roundEnd: 0, match: 0 },
  revealUp: 0,
  violatingStates: 0,
  byInvariant: noViolations(),
  first: [],
})

/** I1–I10 and J1–J8 at every state a run visits, `prev` the state before it (Phase 3's I7). */
const invariantVisit =
  (t: InvariantTally, label: string): MatchVisit =>
  (state, prev, _action, step) => {
    t.states += 1
    t.byScreen[state.screen] += 1
    if (state.reveal !== null) t.revealUp += 1
    try {
      assertMatchInvariants(state, prev ?? undefined)
    } catch (error) {
      if (!(error instanceof MatchInvariantViolation)) throw error
      t.violatingStates += 1
      for (const id of error.ids) t.byInvariant[id] += 1
      keep(t.first, `${label} step ${step}: ${error.ids.join(' ')}`)
    }
  }

// ============================================================================
// The passes — every run of this file, made once, tallied per box
// ============================================================================

interface SampleTally {
  readonly sample: SampleKind
  readonly roundSeconds: number
  readonly seed: number
  readonly n: number
  sequences: number
  steps: number
  matchesEnded: number
  endedByReset: number
  endedAtMaxSteps: number
  /** Sequences whose harness run and generator disagree on matches ended or on ending on `setup` — the machinery checking itself. */
  machineryMismatches: number
  /** Indices of the sequences whose float and exact observations differ at some step. */
  floatVsExact: number[]
  /** Indices of the sequences whose engine and exact observations differ at some step. */
  engineVsExact: number[]
  /** Indices of the sequences whose engine and float observations differ — the per-length samples only; `null` where not asked for. */
  engineVsFloat: number[] | null
  /** Runs in which the result carries an engine ≡ float comparison at all. */
  engineVsFloatCarried: number
  /** Runs in which the harness stopped feeding the engine — a flow event on a screen without its button. */
  refused: number
  first: string[]
}

/**
 * One generated sample through the harness, every sequence, in order, with
 * float ≡ exact on. engine ≡ float is asked for on the PER-LENGTH samples only
 * — on the verdict sample it is the 🚦 box's, and this function cannot ask for
 * it there. The invariants run where a tally is given.
 */
function runSample(
  sample: MatchSample,
  kind: SampleKind,
  invariants: InvariantTally | null,
): SampleTally {
  const engineVsFloat = kind === 'per-length'
  const t: SampleTally = {
    sample: kind,
    roundSeconds: sample.roundSeconds,
    seed: sample.seed,
    n: sample.n,
    sequences: 0,
    steps: 0,
    matchesEnded: 0,
    endedByReset: 0,
    endedAtMaxSteps: 0,
    machineryMismatches: 0,
    floatVsExact: [],
    engineVsExact: [],
    engineVsFloat: engineVsFloat ? [] : null,
    engineVsFloatCarried: 0,
    refused: 0,
    first: [],
  }
  for (const sequence of matchSequences(sample)) {
    const label = `${kind} ${sample.roundSeconds} s #${sequence.index}`
    if (invariants !== null) {
      invariants.runs += 1
      invariants.expectedStates += 1 + expectedPairs(sequence)
    }
    const r = runMatch(sequence, {
      floatVsExact: true,
      engineVsFloat,
      ...(invariants === null ? {} : { visit: invariantVisit(invariants, label) }),
    })
    t.sequences += 1
    t.steps += r.stepsConsumed
    t.matchesEnded += r.matchesEnded
    if (sequence.end === 'resetMatch') t.endedByReset += 1
    if (sequence.end === 'maxSteps') t.endedAtMaxSteps += 1
    if (
      r.matchesEnded !== sequence.matchesEnded ||
      (r.exactFinalScreen === 'setup') !== (sequence.end === 'resetMatch')
    ) {
      t.machineryMismatches += 1
      keep(t.first, `${label}: harness and generator disagree on how the sequence ended`)
    }
    if (r.floatVsExact === undefined) throw new Error(`${label}: float/exact was not compared`)
    if (r.floatVsExact !== null) t.floatVsExact.push(sequence.index)
    if (r.engineVsExact !== null) {
      t.engineVsExact.push(sequence.index)
      keep(t.first, show(label, 'engine/exact', r.engineVsExact))
    }
    if (r.engineVsFloat !== undefined) t.engineVsFloatCarried += 1
    if (t.engineVsFloat !== null) {
      if (r.engineVsFloat === undefined) throw new Error(`${label}: engine/float was not compared`)
      if (r.engineVsFloat !== null) t.engineVsFloat.push(sequence.index)
    }
    if (!r.engineFedThroughout) t.refused += 1
  }
  return t
}

interface ScriptedTally {
  readonly id: TableGId
  readonly steps: number
  /** Each oracle's round ends: the 1-based index of each event after which its round had ended. */
  readonly roundsEndAt: { readonly exact: readonly number[]; readonly float: readonly number[] }
  /** Each oracle's final state, in Table G's shape. */
  readonly final: { readonly exact: TableGFinal; readonly float: TableGFinal }
  readonly revealUpAtEnd: { readonly exact: boolean; readonly float: boolean }
  /** Events after which the float and exact observations differ. */
  readonly floatVsExactSteps: number
  readonly floatVsExact: MatchDivergence | null
  readonly engineVsExact: MatchDivergence | null
  readonly engineFedThroughout: boolean
  /** Whether the result carries an engine ≡ float comparison at all — it must not: on Table G that is the 🚦 box's. */
  readonly engineVsFloatCarried: boolean
}

/** One scripted match of Table G through the harness, in full, float ≡ exact on, engine ≡ float OFF, the invariants at every state. */
function runScripted(match: ScriptedMatch, invariants: InvariantTally): ScriptedTally {
  const run = scriptedRun(match)
  invariants.runs += 1
  invariants.expectedStates += 1 + expectedPairs(run)
  const r = runMatch(run, {
    floatVsExact: true,
    engineVsFloat: false,
    visit: invariantVisit(invariants, match.id),
  })
  const { float } = r
  const floatEnds = r.roundsEndAt.float
  if (float === undefined || floatEnds === undefined || r.floatVsExact === undefined) {
    throw new Error(`${match.id}: the float oracle did not run`)
  }
  const exactView = r.exact.view()
  const floatView = float.view()
  return {
    id: match.id,
    steps: r.stepsConsumed,
    roundsEndAt: { exact: r.roundsEndAt.exact, float: floatEnds },
    final: { exact: tableGView(exactView), float: tableGView(floatView) },
    revealUpAtEnd: { exact: exactView.revealUp, float: floatView.revealUp },
    floatVsExactSteps: r.floatVsExactSteps ?? -1,
    floatVsExact: r.floatVsExact,
    engineVsExact: r.engineVsExact,
    engineFedThroughout: r.engineFedThroughout,
    engineVsFloatCarried: r.engineVsFloat !== undefined,
  }
}

// ============================================================================
// Gate 5 — the machinery, anchored before anything is judged against it
// ============================================================================

describe('Gate 5 — the generator and the match oracle reproduce the planning session’s anchors', () => {
  test('REQ-4.14 (Generator fingerprint): mulberry32(MATCH_SEED) and the verdict sample’s sequences 0–2 reproduce Table E — configurations, event counts, steps, matches ended and the exact oracle’s final state', () => {
    // The generator's fixed pieces (specs.md §2.10) are the ones Table E was measured with.
    expect({
      MATCH_SEED,
      MATCH_RATES: [...MATCH_RATES],
      MATCH_MAX_STEPS,
      verdict: MATCH_VERDICT_SAMPLE,
    }).toStrictEqual({
      MATCH_SEED: 0x20261002,
      MATCH_RATES: [0.02, 0.05, 0.1],
      MATCH_MAX_STEPS: 40_000,
      verdict: { roundSeconds: 45, seed: 0x20261002, n: 500 },
    })

    const rand = mulberry32(MATCH_SEED)
    const draws = [rand(), rand(), rand()].map((d) => d.toFixed(10))

    // The verdict sample's first three sequences — the generator is lazy, so
    // nothing past the third is drawn.
    const firstThree: GeneratedMatch[] = []
    for (const sequence of matchSequences(MATCH_VERDICT_SAMPLE)) {
      firstThree.push(sequence)
      if (firstThree.length === 3) break
    }

    // Each replayed through a fresh EXACT match oracle: its state at the end,
    // its round ends, and the matches it ended — the last checked against the
    // generator's own count.
    const replays = firstThree.map((sequence) => {
      const exact = matchOracle('exact', sequence.setup)
      const roundsEndAt: number[] = []
      let matchesEnded = 0
      sequence.events.forEach((event, i) => {
        const before = exact.screen()
        exact.step(event)
        const after = exact.screen()
        if (roundEnded(before, after)) roundsEndAt.push(i + 1)
        if (before !== 'match' && after === 'match') matchesEnded += 1
      })
      return { sequence, view: exact.view(), roundsEndAt, matchesEnded }
    })

    const measured = replays.map(({ sequence, view }, k): TableESequence => {
      const eventCounts: Record<EventType, number> = {
        startMatch: 0,
        nextRound: 0,
        tick: 0,
        correct: 0,
        skip: 0,
        hint: 0,
        resetMatch: 0,
      }
      for (const event of sequence.events) eventCounts[eventType(event)] += 1
      const tabledLogStated = TABLE_E.sequences[k]?.exactAtEnd.log !== undefined
      return {
        index: sequence.index,
        setup: sequence.setup,
        rate: sequence.rate,
        events: sequence.events.length,
        matchesEnded: sequence.matchesEnded,
        exactAtEnd: {
          screen: view.screen,
          round: view.round,
          tallies: [view.tallyA, view.tallyB],
          judgeIndex: view.judgeIndex,
          // The log is compared where Table E states one.
          ...(tabledLogStated ? { log: tabledLog(view) } : {}),
        },
        eventCounts,
      }
    })
    const sequence0 = replays[0]
    if (sequence0 === undefined) throw new Error('the verdict sample yielded no sequence')
    const events0 = sequence0.sequence.events
    const event367 = events0[366]

    expect({
      draws,
      sequences: measured,
      sequence0: {
        nonTickSteps: events0.flatMap((event, i) => (event === 'tick' ? [] : [i + 1])),
        roundsEndAt: sequence0.roundsEndAt,
        eventAt367: event367 === undefined ? 'none' : eventType(event367),
      },
    }).toStrictEqual(TABLE_E)
    // The replay's exact oracle ends as many matches as the generator's did.
    expect(replays.map((r) => r.matchesEnded)).toStrictEqual(
      replays.map((r) => r.sequence.matchesEnded),
    )
    // Box measurement: 3 draws, 3 / 3 sequences, 0 mismatches.
    const mismatches = measured.filter(
      (row, k) => !isDeepStrictEqual(row, TABLE_E.sequences[k]),
    ).length
    expect({ draws: draws.length, sequences: measured.length, mismatches }).toStrictEqual({
      draws: 3,
      sequences: 3,
      mismatches: 0,
    })
    console.log(
      `REQ-4.14 Table E: draws ${draws.join(' · ')}; sequences ${measured
        .map(
          (s) =>
            `#${s.index} ${s.events} events, ${s.matchesEnded} matches ended, exact at end ${s.exactAtEnd.screen} round ${s.exactAtEnd.round} ${s.exactAtEnd.tallies.join('–')} judge ${s.exactAtEnd.judgeIndex}`,
        )
        .join('; ')}`,
    )
  })

  test('REQ-4.14 (Oracle anchor — Phase 3’s Table A): the match oracle’s silent first round ends after Table A’s float row in float — 801, 851, 901 at 80, 85, 90 s — and after 10 × S ticks in exact, at all 15 lengths', () => {
    expect([...ROUND_SECONDS_OPTIONS]).toStrictEqual([...TABLE_A_LENGTHS])

    /** A match's first round from room-ready, then ticks alone: the tick after which the round ended; `null` for not within 10·S + 100. */
    const silentFirstRound = (arithmetic: Arithmetic, roundSeconds: number): number | null => {
      const oracle = matchOracle(arithmetic, { ...TABLE_G_DEFAULT, roundSeconds })
      oracle.step({ type: 'startMatch', r: 0, perm: [0, 1, 2] })
      if (oracle.screen() !== 'play') return null
      const limit = roundSeconds * 10 + 100
      for (let k = 1; k <= limit; k += 1) {
        oracle.step('tick')
        if (oracle.screen() !== 'play') return k
      }
      return null
    }
    const measured: Record<Arithmetic, (number | null)[]> = {
      float: TABLE_A_LENGTHS.map((s) => silentFirstRound('float', s)),
      exact: TABLE_A_LENGTHS.map((s) => silentFirstRound('exact', s)),
    }
    const matched = (arithmetic: Arithmetic): number =>
      measured[arithmetic].filter((v, i) => v === TABLE_A_TICKS_TO_END[arithmetic][i]).length
    expect({ float: matched('float'), exact: matched('exact') }).toStrictEqual({
      float: 15,
      exact: 15,
    })
    expect(measured).toStrictEqual(TABLE_A_TICKS_TO_END)
    // The exact row is 10 × S, as the table states it.
    expect(TABLE_A_TICKS_TO_END.exact).toStrictEqual(TABLE_A_LENGTHS.map((s) => 10 * s))
    console.log(
      `REQ-4.14 Table A anchor: float ${measured.float.join(' · ')}; exact ${measured.exact.join(' · ')}`,
    )
  })
})

// ============================================================================
// Gate 5 — the ordinary boxes over the three sets, in the gate's order
// ============================================================================

describe('Gate 5 — equivalence with the prototype (the ordinary boxes)', () => {
  let verdict: SampleTally
  let perLength: SampleTally[]
  let scripted: ScriptedTally[]
  let invariants: { perLength: InvariantTally; tableG: InvariantTally }

  // About 2.0 million lockstep events. The timeout is a ceiling for a slow
  // runner, not the budget: the budget is NFR-4.5's 20 s for the whole
  // project, measured by verification.md Gate 6.
  beforeAll(() => {
    invariants = { perLength: newInvariantTally(), tableG: newInvariantTally() }
    // The verdict sample: float against exact (Table F, row 1) and the engine
    // against EXACT. engine ≡ float is off and the invariants are not run —
    // see the header.
    verdict = runSample(MATCH_VERDICT_SAMPLE, 'verdict', null)
    // The per-length samples: float against exact (Table F, rows 2–16), the
    // engine against exact, the engine against FLOAT ("The decision of
    // 2026-09-30"), the invariants at every state.
    perLength = MATCH_PER_LENGTH_SAMPLES.map((sample) =>
      runSample(sample, 'per-length', invariants.perLength),
    )
    // Table G: float against exact, the engine against exact, the invariants.
    // engine ≡ float is off.
    scripted = TABLE_G.map((match) => runScripted(match, invariants.tableG))
  }, 120_000)

  test('engine ≡ float was asked for on the per-length sample only — never on the verdict sample or Table G, whose comparison is the 🚦 box’s', () => {
    expect({
      verdict: { asked: verdict.engineVsFloat !== null, carried: verdict.engineVsFloatCarried },
      tableG: scripted.filter((s) => s.engineVsFloatCarried).map((s) => s.id),
      perLength: perLength.map((t) => t.engineVsFloatCarried),
    }).toStrictEqual({
      verdict: { asked: false, carried: 0 },
      tableG: [],
      perLength: TABLE_F.slice(1).map((row) => row.n),
    })
  })

  test('REQ-4.14 (Oracle against oracle): float vs exact over every sample reproduces all 16 rows of Table F — diverging sequences, steps consumed, matches ended, ended by resetMatch', () => {
    const tallies = [verdict, ...perLength]
    const rows = tallies.map((t): TableFRow => ({
      sample: t.sample,
      roundSeconds: t.roundSeconds,
      seed: t.seed,
      n: t.n,
      diverging: t.floatVsExact.length,
      steps: t.steps,
      matchesEnded: t.matchesEnded,
      endedByReset: t.endedByReset,
    }))
    const rowsMatched = rows.filter((row, i) => isDeepStrictEqual(row, TABLE_F[i])).length
    expect(rowsMatched).toBe(16)
    expect(rows).toStrictEqual(TABLE_F)
    // Every sequence of every sample was run; none reached MATCH_MAX_STEPS;
    // the harness's exact oracle and the generator's agree on every ending.
    expect({
      sequences: tallies.map((t) => t.sequences),
      endedAtMaxSteps: tallies.reduce((n, t) => n + t.endedAtMaxSteps, 0),
      machineryMismatches: tallies.reduce((n, t) => n + t.machineryMismatches, 0),
      steps: {
        perLength: perLength.reduce((n, t) => n + t.steps, 0),
        all: tallies.reduce((n, t) => n + t.steps, 0),
      },
    }).toStrictEqual({
      sequences: TABLE_F.map((row) => row.n),
      endedAtMaxSteps: 0,
      machineryMismatches: 0,
      steps: TABLE_F_STEP_TOTALS,
    })
    console.log(
      `REQ-4.14 Table F: ${rows
        .map(
          (r) =>
            `${r.sample} ${r.roundSeconds} s: ${r.diverging} · ${r.steps} · ${r.matchesEnded} · ${r.endedByReset}`,
        )
        .join('; ')}`,
    )
  })

  test('REQ-4.14 (Scripted matches through both oracles): both oracles produce Table G’s outcome for all 16 matches and agree with each other at all 15,700 events', () => {
    const measured = scripted.map((s) => ({
      id: s.id,
      exact: {
        roundsEndAt: s.roundsEndAt.exact,
        final: s.final.exact,
        revealUp: s.revealUpAtEnd.exact,
      },
      float: {
        roundsEndAt: s.roundsEndAt.float,
        final: s.final.float,
        revealUp: s.revealUpAtEnd.float,
      },
    }))
    const tabled = TABLE_G.map((m) => {
      const outcome = { roundsEndAt: m.roundsEndAt, final: m.final, revealUp: false }
      return { id: m.id, exact: outcome, float: outcome }
    })
    expect(measured).toStrictEqual(tabled)
    const matches = measured.filter((row, i) => isDeepStrictEqual(row, tabled[i])).length
    expect({
      matches,
      events: scripted.reduce((n, s) => n + s.steps, 0),
      disagreeingEvents: scripted.reduce((n, s) => n + s.floatVsExactSteps, 0),
      first: scripted.map((s) => show(s.id, 'float/exact', s.floatVsExact)).filter(Boolean),
    }).toStrictEqual({ matches: 16, events: TABLE_G_EVENT_TOTAL, disagreeingEvents: 0, first: [] })
    expect(TABLE_G_EVENT_TOTAL).toBe(15_700)
    console.log(
      `REQ-4.14 Table G through both oracles: ${matches} / 16 matches; ${scripted.reduce((n, s) => n + s.floatVsExactSteps, 0)} disagreeing events of ${scripted.reduce((n, s) => n + s.steps, 0)}`,
    )
  })

  test('REQ-4.14 (The engine is exact arithmetic): engine ≡ exact oracle at every step of all 16 scripted matches, all 500 verdict sequences and all 300 per-length sequences — 816 / 816', () => {
    const generated = [verdict, ...perLength]
    const measured = {
      sequences: scripted.length + generated.reduce((n, t) => n + t.sequences, 0),
      steps: scripted.reduce((n, s) => n + s.steps, 0) + generated.reduce((n, t) => n + t.steps, 0),
      diverging: {
        scripted: scripted.filter((s) => s.engineVsExact !== null).map((s) => s.id),
        verdict: verdict.engineVsExact.length,
        perLength: perLength.reduce((n, t) => n + t.engineVsExact.length, 0),
      },
      refused:
        scripted.filter((s) => !s.engineFedThroughout).length +
        generated.reduce((n, t) => n + t.refused, 0),
      first: [
        ...scripted.map((s) => show(s.id, 'engine/exact', s.engineVsExact)).filter(Boolean),
        ...generated.flatMap((t) => t.first),
      ].slice(0, KEEP),
    }
    expect(measured).toStrictEqual({
      sequences: 16 + 500 + 300,
      // Every scripted match in full; every generated sequence to its end — Table F.
      steps: TABLE_G_EVENT_TOTAL + TABLE_F_STEP_TOTALS.all,
      diverging: { scripted: [], verdict: 0, perLength: 0 },
      refused: 0,
      first: [],
    })
    console.log(
      `REQ-4.14 engine ≡ exact: ${measured.sequences} sequences, ${measured.steps} steps, diverging ${JSON.stringify(measured.diverging)}, refused ${measured.refused}`,
    )
  })

  test('REQ-4.14 (The decision of 2026-09-30, measured in full matches): per per-length row, the engine diverges from the FLOAT oracle in exactly Table F’s float-vs-exact count — 11 · 1 · 0 × 7 · 20 × 6', () => {
    const perLengthRows = TABLE_F.slice(1)
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
    // And they are the same sequences: the engine diverges from the
    // prototype's arithmetic exactly where exact arithmetic does.
    expect(perLength.map((t) => t.engineVsFloat)).toStrictEqual(
      perLength.map((t) => t.floatVsExact),
    )
    console.log(
      `REQ-4.14 engine vs float, per-length: ${measured.map((r) => `${r.roundSeconds} s ${r.engineVsFloat}`).join(' · ')}`,
    )
  })

  test('REQ-4.14 (Invariants): Phase 3’s I1–I10 and J1–J8 hold after every step of the per-length sample and of Table G', () => {
    const report = (t: InvariantTally) => ({
      runs: t.runs,
      states: t.states,
      violatingStates: t.violatingStates,
      byInvariant: t.byInvariant,
      first: t.first,
    })
    expect({
      perLength: report(invariants.perLength),
      tableG: report(invariants.tableG),
    }).toStrictEqual({
      perLength: {
        runs: 300,
        states: invariants.perLength.expectedStates,
        violatingStates: 0,
        byInvariant: noViolations(),
        first: [],
      },
      tableG: {
        runs: 16,
        states: invariants.tableG.expectedStates,
        violatingStates: 0,
        byInvariant: noViolations(),
        first: [],
      },
    })
    expect(Object.keys(noViolations())).toStrictEqual([...ALL_INVARIANT_IDS])
    // Each conditional invariant has a population: every screen is visited in
    // the per-length sample, and reveals go up — J1's non-null half.
    const { byScreen, revealUp } = invariants.perLength
    expect({
      setup: byScreen.setup > 0,
      ready: byScreen.ready > 0,
      play: byScreen.play > 0,
      roundEnd: byScreen.roundEnd > 0,
      match: byScreen.match > 0,
      revealUp: revealUp > 0,
    }).toStrictEqual({
      setup: true,
      ready: true,
      play: true,
      roundEnd: true,
      match: true,
      revealUp: true,
    })
    console.log(
      `REQ-4.14 invariants: per-length ${invariants.perLength.states} states (${JSON.stringify(invariants.perLength.byScreen)}, reveal up ${invariants.perLength.revealUp}), Table G ${invariants.tableG.states} states (${JSON.stringify(invariants.tableG.byScreen)}, reveal up ${invariants.tableG.revealUp}); violations ${JSON.stringify(invariants.perLength.byInvariant)} / ${JSON.stringify(invariants.tableG.byInvariant)}`,
    )
  })
})
