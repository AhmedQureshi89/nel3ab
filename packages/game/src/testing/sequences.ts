// Test support (Phase 3) — the pre-registered samples and the scripted scenarios.
// REQ-3.3, REQ-3.4, REQ-3.11. See specs/phase-3/specs.md §2.8 and
// specs/phase-3/verification.md, "Pre-registered values", Tables B, C and D.
//
// `SEED`, `RATES`, `TAIL`, `Event` and `generate` are EXACTLY as specs.md §2.8
// gives them, and are fixed by that document: changing any of them changes the
// verdict's sample, which verification.md Gate 6 forbids. Draw order is part of
// the contract — one `rand()` per step, plus one more when the step acts.
//
// A SAMPLE is `(roundSeconds, seed, n)`: ONE `mulberry32(seed)` shared by the
// whole sample, and sequence `i` (0-based, generated in order) uses
// `RATES[i % 3]` and starts with team `i % 2 === 0 ? 'a' : 'b'`. Because the
// generator is shared, sequence `i` depends on every sequence before it, so
// `sequences` yields them strictly in order.
//
// Every question here is synthetic. Nothing is copied from design/: the
// prototype's question content is not this package's to ship (specs.md §2.8).
//
// Test support: excluded from coverage (REQ-3.12's second exclusion), never
// exported from index.ts, imported only by `*.test.ts` and by other files
// under `testing/`.

import { ROUND_SECONDS_OPTIONS } from '../rules.js'
import type { Question, Team } from '../types.js'
import { mulberry32 } from './prng.js'

export const SEED = 0x20260930
export const RATES = [0.01, 0.03, 0.1] as const
export const TAIL = 50
export type Event = 'tick' | 'hint' | 'skip' | 'correct'

/** One sequence. Draw order is part of the contract: one rand() per step, plus one more when acting. */
export function generate(rand: () => number, roundSeconds: number, rate: number): Event[] {
  const events: Event[] = []
  const max = roundSeconds * 10 + 200
  while (events.length < max) {
    if (rand() < rate) {
      const r = rand()
      events.push(r < 0.45 ? 'hint' : r < 0.9 ? 'skip' : 'correct')
    } else events.push('tick')
  }
  return events
}

// ============================================================================
// The two samples (specs.md §2.8)
// ============================================================================

export interface Sample {
  readonly roundSeconds: number
  readonly seed: number
  readonly n: number
}

/** The verdict's sample: 45 s, `SEED`, 10,000 sequences (verification.md Table B, first row). */
export const VERDICT_SAMPLE: Sample = { roundSeconds: 45, seed: SEED, n: 10_000 }

/** One sample per legal bank length: `SEED + roundSeconds`, 200 sequences each (Table B, rows 2–16). */
export const PER_LENGTH_SAMPLES: readonly Sample[] = ROUND_SECONDS_OPTIONS.map((roundSeconds) => ({
  roundSeconds,
  seed: SEED + roundSeconds,
  n: 200,
}))

export interface GeneratedSequence {
  /** 0-based position in its sample. */
  readonly index: number
  readonly rate: number
  readonly startingTeam: Team
  readonly events: readonly Event[]
}

/** The sample's sequences, in generation order, all drawn from one shared `mulberry32(sample.seed)`. */
export function* sequences(sample: Sample): Generator<GeneratedSequence> {
  const rand = mulberry32(sample.seed)
  for (let index = 0; index < sample.n; index += 1) {
    const rate = RATES[index % RATES.length]
    if (rate === undefined) throw new Error(`no rate for sequence ${index}`)
    const startingTeam: Team = index % 2 === 0 ? 'a' : 'b'
    yield { index, rate, startingTeam, events: generate(rand, sample.roundSeconds, rate) }
  }
}

// ============================================================================
// The question pool
// ============================================================================

/** A synthetic question with `hints` hints (at most two). */
export const syntheticQuestion = (n: number, hints = 2): Question => ({
  q: `سؤال تجريبي ${n}`,
  a: `جواب ${n}`,
  alts: [],
  h: [`تلميح ${n}-1`, `تلميح ${n}-2`].slice(0, hints),
  f: `معلومة ${n}`,
})

/**
 * The pool of every generated sequence and of every scripted scenario but S10:
 * three questions with TWO hints each — every question in the prototype's
 * dataset has exactly two (specs.md §2.8).
 */
export const POOL: readonly [Question, ...Question[]] = [
  syntheticQuestion(0),
  syntheticQuestion(1),
  syntheticQuestion(2),
]

/** S10's pool: hint counts `[0, 2, 2]`, so the first question has none. */
export const POOL_HINTS_0_2_2: readonly [Question, ...Question[]] = [
  syntheticQuestion(0, 0),
  syntheticQuestion(1),
  syntheticQuestion(2),
]

// ============================================================================
// The scripted scenarios — verification.md Table D
// ============================================================================

/** Every scenario is a 45 s round started by team `a` (Table D's heading). */
export const SCENARIO_ROUND_SECONDS = 45
export const SCENARIO_STARTING_TEAM: Team = 'a'

export interface Scenario {
  /** Table D's `#`. */
  readonly id: string
  readonly pool: readonly [Question, ...Question[]]
  readonly events: readonly Event[]
  /**
   * Table D's "Ends at": the 1-based index of the event after which the round
   * has ended, or `null` for "never". Transcribed from the table as data; the
   * box that compares the engine with it is verification.md Gate 6's
   * "Scripted scenarios", not this file.
   */
  readonly endsAt: number | null
  /** Table D's final `hintIndex` · `questionIndex`. */
  readonly hintIndex: number
  readonly questionIndex: number
}

/** `n` ticks. */
const ticks = (n: number): Event[] => Array.from({ length: n }, (): Event => 'tick')

export const SCENARIOS: readonly Scenario[] = [
  // a silent round
  { id: 'S1', pool: POOL, events: ticks(450), endsAt: 450, hintIndex: 0, questionIndex: 0 },
  // a hint's cost
  {
    id: 'S2',
    pool: POOL,
    events: ['hint', ...ticks(430)],
    endsAt: 431,
    hintIndex: 1,
    questionIndex: 0,
  },
  // a skip's cost
  {
    id: 'S3',
    pool: POOL,
    events: ['skip', 'skip', ...ticks(390)],
    endsAt: 392,
    hintIndex: 0,
    questionIndex: 2,
  },
  // skip spends exactly to zero; index not advanced
  {
    id: 'S4',
    pool: POOL,
    events: [...ticks(420), 'skip'],
    endsAt: 421,
    hintIndex: 0,
    questionIndex: 0,
  },
  // hint spends exactly to zero; index not advanced
  {
    id: 'S5',
    pool: POOL,
    events: [...ticks(430), 'hint'],
    endsAt: 431,
    hintIndex: 0,
    questionIndex: 0,
  },
  // spend past zero; bank 0, not −2000
  {
    id: 'S6',
    pool: POOL,
    events: [...ticks(440), 'skip'],
    endsAt: 441,
    hintIndex: 0,
    questionIndex: 0,
  },
  // the third hint is inert and free
  {
    id: 'S7',
    pool: POOL,
    events: ['hint', 'hint', 'hint', ...ticks(410)],
    endsAt: 413,
    hintIndex: 2,
    questionIndex: 0,
  },
  // reveal up at the end; team a reads 35 from the reveal onward
  {
    id: 'S8',
    pool: POOL,
    events: [...ticks(100), 'correct', ...ticks(1000), 'hint', 'skip', 'correct'],
    endsAt: null,
    hintIndex: 0,
    questionIndex: 0,
  },
  // one tick from zero: live, team a reads 1
  { id: 'S9', pool: POOL, events: ticks(449), endsAt: null, hintIndex: 0, questionIndex: 0 },
  // …and the next tick ends it
  { id: 'S9′', pool: POOL, events: ticks(450), endsAt: 450, hintIndex: 0, questionIndex: 0 },
  // a hint on a hintless question is inert
  {
    id: 'S10',
    pool: POOL_HINTS_0_2_2,
    events: ['hint', 'skip', 'hint', ...ticks(430)],
    endsAt: 403,
    hintIndex: 1,
    questionIndex: 1,
  },
  // the pool wraps: the current question is pool[0] again
  {
    id: 'S11',
    pool: POOL,
    events: ['skip', 'skip', 'skip', ...ticks(360)],
    endsAt: 363,
    hintIndex: 0,
    questionIndex: 3,
  },
  // a mixed round
  {
    id: 'S12',
    pool: POOL,
    events: [
      ...ticks(50),
      'hint',
      ...ticks(70),
      'skip',
      ...ticks(80),
      'hint',
      'hint',
      'hint',
      ...ticks(98),
      'skip',
      ...ticks(1000),
    ],
    endsAt: 336,
    hintIndex: 0,
    questionIndex: 2,
  },
]
