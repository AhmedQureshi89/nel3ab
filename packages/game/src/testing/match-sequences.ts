// Test support (Phase 4) — the match generator's fixed pieces and the scripted
// matches. REQ-4.13, REQ-4.14. See specs/phase-4/specs.md §2.10 and
// specs/phase-4/verification.md, "Pre-registered values", Tables E, F and G.
//
// `MATCH_SEED`, `MATCH_RATES`, `MATCH_MAX_STEPS`, `drawMatchConfig` and
// `permutation` are EXACTLY as specs.md §2.10 gives them, and are fixed by that
// document: changing any of them changes the verdict's sample, which
// verification.md Gate 5 forbids. Draw order is part of the contract — five
// `rand()` calls per configuration, in the order written; one per category
// value, then n − 1 per permutation.
//
// What is here: those fixed pieces; verification.md Table G — the sixteen
// scripted matches — as data: per match its configuration, its script, event by
// event, with every draw naming its category, and its pre-registered outcome
// exactly as the table states it (match.test.ts plays them through the engine
// alone, Gate 3, REQ-4.13); and, at the end of the file, the generated
// sequences — the stepper that chooses each event from the EXACT match oracle's
// screen (testing/match-oracle.ts), and the two samples of specs.md §2.10.
//
// Every question here is synthetic (testing/rooms.ts). Nothing is copied from
// design/.
//
// Test support: excluded from coverage (REQ-4.15, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts` and by
// other files under `testing/`.

import { ROUND_SECONDS_OPTIONS } from '../rules.js'
import type { CategoryId, Question, Screen, Team } from '../types.js'
import { matchOracle, type MatchDraw, type MatchEvent } from './match-oracle.js'
import { mulberry32 } from './prng.js'
import { categoryIds, categoryQuestions, type ReadyRoomSetup } from './rooms.js'

export const MATCH_SEED = 0x20261002
export const MATCH_RATES = [0.02, 0.05, 0.1] as const
export const MATCH_MAX_STEPS = 40_000

/** One configuration: five rand() calls, in this order. */
export function drawMatchConfig(rand: () => number, roundSeconds: number): ReadyRoomSetup {
  const winsNeeded = [2, 3, 4][Math.floor(rand() * 3)]
  const picked = categoryIds(1 + Math.floor(rand() * 8)) // 1 … 8 categories
  const players = 2 + Math.floor(rand() * 9) // 2 … 10 players
  const rotateJudge = rand() < 0.5
  const judgeIndex = Math.floor(rand() * players)
  if (winsNeeded === undefined) {
    throw new RangeError('drawMatchConfig needs rand() in [0, 1) for winsNeeded')
  }
  return { roundSeconds, winsNeeded, picked, players, rotateJudge, judgeIndex }
}

/**
 * The harness's OWN permutation of [0 … n−1] — Durstenfeld, descending, n − 1
 * rand() calls: for i = n−1 … 1, j = floor(rand()·(i+1)), swap positions i and
 * j. Deliberately not the engine's `shuffleQuestions`: the sample must not
 * depend on engine code.
 */
export function permutation(rand: () => number, n: number): number[] {
  const order = Array.from({ length: n }, (_, k) => k)
  for (let i = n - 1; i >= 1; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const atI = order[i]
    const atJ = order[j]
    if (atI === undefined || atJ === undefined) {
      throw new RangeError(`permutation needs rand() in [0, 1); got position ${j} for 0 … ${i}`)
    }
    order[i] = atJ
    order[j] = atI
  }
  return order
}

/**
 * A round's question list, as every party to a draw builds it from a
 * permutation: `perm.map(k => categoryQuestions(categoryId)[k])` — the engine's
 * action payload (specs.md §2.10, the harness's table) and the oracle's
 * `startRound` alike. Throws on an index outside the category's three questions
 * or an empty `perm`, so the list is typed non-empty, as the action requires.
 */
export function drawnQuestions(
  categoryId: CategoryId,
  perm: readonly number[],
): readonly [Question, ...Question[]] {
  const all = categoryQuestions(categoryId)
  const [first, ...rest] = perm.map((k) => {
    const question = all[k]
    if (question === undefined) {
      throw new RangeError(`drawnQuestions: no question ${k} in ${categoryId}`)
    }
    return question
  })
  if (first === undefined) throw new RangeError('drawnQuestions needs a non-empty perm')
  return [first, ...rest]
}

// ============================================================================
// The scripted matches — verification.md Table G
// ============================================================================

/** The two flow events that start a round of a match, each carrying a draw. */
export type MatchFlow = 'startMatch' | 'nextRound'

/**
 * A scripted draw: it NAMES its category (Table G, "Every draw names its
 * category"), and `perm` orders that category's three questions.
 */
export interface NamedDraw {
  readonly type: MatchFlow
  readonly categoryId: CategoryId
  readonly perm: readonly number[]
}

/**
 * One event of a script. `tick` is 100 ms of engine time; a driver follows
 * each with `passTurn`, which is inert until due (specs.md §2.10's harness
 * table), and that `passTurn` is part of the tick's event, not an event of its
 * own.
 */
export type ScriptedEvent = 'tick' | 'hint' | 'skip' | 'correct' | 'resetMatch' | NamedDraw

/**
 * Table G's final state, after the last event — every column but "Rounds end
 * at", in the table's order. No reveal is up at the end of any match (the
 * table's heading), so that is not a column.
 */
export interface TableGFinal {
  readonly screen: Screen
  readonly round: number
  /** Tallies, A–B. */
  readonly tallies: readonly [a: number, b: number]
  readonly judgeIndex: number
  /** The active team. */
  readonly active: Team
  /** The used list, in the order it was recorded. */
  readonly used: readonly CategoryId[]
  /** The log, each entry written as the table writes it: `n·category·winner`. */
  readonly log: readonly string[]
  /** The whole seconds each clock displays, A/B. */
  readonly display: readonly [a: number, b: number]
  /** Each bank's `started`, A/B (the table's T/F). */
  readonly started: readonly [a: boolean, b: boolean]
  readonly questionIndex: number
  readonly hintIndex: number
}

export interface ScriptedMatch {
  /** Table G's `#`. */
  readonly id: TableGId
  /** Table G's "What it pins down" — so that a failure names the rule that broke (REQ-4.13). */
  readonly pins: string
  readonly setup: ReadyRoomSetup
  readonly script: readonly ScriptedEvent[]
  /**
   * Table G's "Rounds end at": the 1-based index of each event after which a
   * round has ended. Transcribed from the table as data; the box that compares
   * the engine with it is verification.md Gate 3's "REQ-4.13 (Table G through
   * the engine)", not this file.
   */
  readonly roundsEndAt: readonly number[]
  readonly final: TableGFinal
  /** `matchWinner` of the final state, where Table G states it: M3's tie, `null`. */
  readonly matchWinner?: Team | null
}

/**
 * Table G's "Event totals" line, transcribed on its own — separately from the
 * scripts below, which are transcribed from the "Events" column — so that each
 * can be checked against the other.
 */
export const TABLE_G_EVENT_TOTALS = {
  M1: 2_255,
  M2: 676,
  M3: 902,
  M4: 451,
  M5: 1_804,
  M6: 2_256,
  M7: 963,
  M8: 443,
  M9: 452,
  M10: 3_157,
  M11: 23,
  M12: 902,
  M13: 38,
  M14: 483,
  M15: 452,
  M16: 443,
} as const

/** The line's total. */
export const TABLE_G_EVENT_TOTAL = 15_700

export type TableGId = keyof typeof TABLE_G_EVENT_TOTALS

/**
 * Table G's default configuration: 45 s · `winsNeeded` 3 · picked c0–c7 · 5
 * players · judge 4 · rotation off — the prototype's own initial state, which
 * has five players, judge index 4 and eight free categories selected.
 */
export const TABLE_G_DEFAULT: ReadyRoomSetup = {
  roundSeconds: 45,
  winsNeeded: 3,
  picked: categoryIds(8),
  players: 5,
  rotateJudge: false,
  judgeIndex: 4,
}

/** `perm` unless stated: the category's questions in their listed order. */
const IDENTITY = [0, 1, 2] as const

/** `n` ticks. */
const ticks = (n: number): ScriptedEvent[] => Array.from({ length: n }, (): ScriptedEvent => 'tick')

const startMatch = (categoryId: CategoryId, perm: readonly number[] = IDENTITY): NamedDraw => ({
  type: 'startMatch',
  categoryId,
  perm,
})

const nextRound = (categoryId: CategoryId, perm: readonly number[] = IDENTITY): NamedDraw => ({
  type: 'nextRound',
  categoryId,
  perm,
})

/** M1's events — M6 replays them, then rematches. */
const M1_SCRIPT: readonly ScriptedEvent[] = [
  startMatch('c0'),
  ...ticks(450),
  nextRound('c1'),
  ...ticks(450),
  nextRound('c2'),
  ...ticks(450),
  nextRound('c3'),
  ...ticks(450),
  nextRound('c4'),
  ...ticks(450),
]

/** M1's round ends — M6's too. */
const M1_ROUNDS_END_AT = [451, 902, 1353, 1804, 2255] as const

export const TABLE_G: readonly ScriptedMatch[] = [
  {
    id: 'M1',
    pins: 'a silent match: starts alternate a, b, a, b, a; the starting team loses; the match ends at 3',
    setup: TABLE_G_DEFAULT,
    script: M1_SCRIPT,
    roundsEndAt: M1_ROUNDS_END_AT,
    final: {
      screen: 'match',
      round: 5,
      tallies: [2, 3],
      judgeIndex: 4,
      active: 'a',
      used: ['c0', 'c1', 'c2', 'c3', 'c4'],
      log: ['1·c0·b', '2·c1·a', '3·c2·b', '4·c3·a', '5·c4·b'],
      display: [0, 45],
      started: [true, false],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M2',
    pins: "the hold is exactly 10 ticks and every judge action inside it is inert; b's first turn starts full; a resumes its frozen 35 s",
    setup: TABLE_G_DEFAULT,
    script: [
      startMatch('c0'),
      ...ticks(100),
      'correct',
      ...ticks(9),
      'hint',
      'skip',
      'correct',
      ...ticks(1),
      ...ticks(200),
      'correct',
      ...ticks(10),
      ...ticks(350),
    ],
    roundsEndAt: [676],
    final: {
      screen: 'roundEnd',
      round: 1,
      tallies: [0, 1],
      judgeIndex: 4,
      active: 'a',
      used: ['c0'],
      log: ['1·c0·b'],
      display: [0, 25],
      started: [true, true],
      questionIndex: 2,
      hintIndex: 0,
    },
  },
  {
    id: 'M3',
    pins: 'categories run out: a tie — matchWinner is null',
    setup: { ...TABLE_G_DEFAULT, picked: ['c0', 'c1'] },
    script: [startMatch('c1'), ...ticks(450), nextRound('c0'), ...ticks(450)],
    roundsEndAt: [451, 902],
    final: {
      screen: 'match',
      round: 2,
      tallies: [1, 1],
      judgeIndex: 4,
      active: 'b',
      used: ['c1', 'c0'],
      log: ['1·c1·b', '2·c0·a'],
      display: [45, 0],
      started: [false, true],
      questionIndex: 0,
      hintIndex: 0,
    },
    matchWinner: null,
  },
  {
    id: 'M4',
    pins: 'one category: a one-round match',
    setup: { ...TABLE_G_DEFAULT, picked: ['c0'] },
    script: [startMatch('c0'), ...ticks(450)],
    roundsEndAt: [451],
    final: {
      screen: 'match',
      round: 1,
      tallies: [0, 1],
      judgeIndex: 4,
      active: 'a',
      used: ['c0'],
      log: ['1·c0·b'],
      display: [0, 45],
      started: [true, false],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M5',
    pins: 'judge 4 → 0 → 1 → 2: rotates on next round only, modulo 5',
    setup: { ...TABLE_G_DEFAULT, rotateJudge: true },
    script: [
      startMatch('c0'),
      ...ticks(450),
      nextRound('c1'),
      ...ticks(450),
      nextRound('c2'),
      ...ticks(450),
      nextRound('c3'),
      ...ticks(450),
    ],
    roundsEndAt: [451, 902, 1353, 1804],
    final: {
      screen: 'roundEnd',
      round: 4,
      tallies: [2, 2],
      judgeIndex: 2,
      active: 'b',
      used: ['c0', 'c1', 'c2', 'c3'],
      log: ['1·c0·b', '2·c1·a', '3·c2·b', '4·c3·a'],
      display: [45, 0],
      started: [false, true],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M6',
    pins: 'a rematch: round 1, tallies and log cleared, used list restarted, a starts, judge kept',
    setup: { ...TABLE_G_DEFAULT, rotateJudge: true },
    script: [...M1_SCRIPT, startMatch('c7')],
    roundsEndAt: M1_ROUNDS_END_AT,
    final: {
      screen: 'play',
      round: 1,
      tallies: [0, 0],
      judgeIndex: 3,
      active: 'a',
      used: ['c7'],
      log: [],
      display: [45, 45],
      started: [true, false],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M7',
    pins: 'a team wins a round it started; two wins take a two-win match',
    setup: { ...TABLE_G_DEFAULT, winsNeeded: 2 },
    script: [
      startMatch('c3'),
      ...ticks(50),
      'correct',
      ...ticks(10),
      ...ticks(450),
      nextRound('c5'),
      ...ticks(450),
    ],
    roundsEndAt: [512, 963],
    final: {
      screen: 'match',
      round: 2,
      tallies: [2, 0],
      judgeIndex: 4,
      active: 'b',
      used: ['c3', 'c5'],
      log: ['1·c3·a', '2·c5·a'],
      display: [45, 0],
      started: [false, true],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M8',
    pins: "the second team's skip spends exactly to zero; it does not advance questionIndex",
    setup: TABLE_G_DEFAULT,
    script: [startMatch('c0'), ...ticks(10), 'correct', ...ticks(10), ...ticks(420), 'skip'],
    roundsEndAt: [443],
    final: {
      screen: 'roundEnd',
      round: 1,
      tallies: [1, 0],
      judgeIndex: 4,
      active: 'b',
      used: ['c0'],
      log: ['1·c0·a'],
      display: [44, 0],
      started: [true, true],
      questionIndex: 1,
      hintIndex: 0,
    },
  },
  {
    id: 'M9',
    pins: 'back to setup from round end; the banks are left as they were',
    setup: TABLE_G_DEFAULT,
    script: [startMatch('c0'), ...ticks(450), 'resetMatch'],
    roundsEndAt: [451],
    final: {
      screen: 'setup',
      round: 1,
      tallies: [0, 0],
      judgeIndex: 4,
      active: 'a',
      used: [],
      log: [],
      display: [0, 45],
      started: [true, false],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M10',
    pins: 'a seven-round match',
    setup: { ...TABLE_G_DEFAULT, winsNeeded: 4 },
    // "startMatch(c0), 450 tick, then nextRound(c1) … nextRound(c6), each
    // followed by 450 tick" — the table's own wording.
    script: [
      startMatch('c0'),
      ...ticks(450),
      ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].flatMap((categoryId) => [
        nextRound(categoryId),
        ...ticks(450),
      ]),
    ],
    roundsEndAt: [451, 902, 1353, 1804, 2255, 2706, 3157],
    final: {
      screen: 'match',
      round: 7,
      tallies: [3, 4],
      judgeIndex: 4,
      active: 'a',
      used: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
      log: ['1·c0·b', '2·c1·a', '3·c2·b', '4·c3·a', '5·c4·b', '6·c5·a', '7·c6·b'],
      display: [0, 45],
      started: [true, false],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M11',
    pins: 'the pool wraps across a pass: question 3 is pool[0] again',
    setup: TABLE_G_DEFAULT,
    script: [
      startMatch('c2', [2, 0, 1]),
      'skip',
      'skip',
      ...ticks(5),
      'correct',
      ...ticks(10),
      'skip',
      ...ticks(3),
    ],
    roundsEndAt: [],
    final: {
      screen: 'play',
      round: 1,
      tallies: [0, 0],
      judgeIndex: 4,
      active: 'b',
      used: ['c2'],
      log: [],
      display: [39, 42],
      started: [true, true],
      questionIndex: 4,
      hintIndex: 0,
    },
  },
  {
    id: 'M12',
    pins: 'rotation with no players stays at 0',
    setup: { ...TABLE_G_DEFAULT, players: 0, judgeIndex: 0, rotateJudge: true },
    script: [startMatch('c0'), ...ticks(450), nextRound('c1'), ...ticks(450)],
    roundsEndAt: [451, 902],
    final: {
      screen: 'roundEnd',
      round: 2,
      tallies: [1, 1],
      judgeIndex: 0,
      active: 'b',
      used: ['c0', 'c1'],
      log: ['1·c0·b', '2·c1·a'],
      display: [45, 0],
      started: [false, true],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M13',
    pins: "the pass returns hintIndex to 0; a's hint stays paid",
    setup: TABLE_G_DEFAULT,
    script: [startMatch('c0'), 'hint', ...ticks(20), 'correct', ...ticks(10), ...ticks(5)],
    roundsEndAt: [],
    final: {
      screen: 'play',
      round: 1,
      tallies: [0, 0],
      judgeIndex: 4,
      active: 'b',
      used: ['c0'],
      log: [],
      display: [41, 45],
      started: [true, true],
      questionIndex: 1,
      hintIndex: 0,
    },
  },
  {
    id: 'M14',
    pins: "a team frozen with 100 ms keeps it across the other's turn, and its next tick ends the round",
    setup: TABLE_G_DEFAULT,
    script: [
      startMatch('c0'),
      ...ticks(449),
      'correct',
      ...ticks(10),
      ...ticks(10),
      'correct',
      ...ticks(10),
      ...ticks(1),
    ],
    roundsEndAt: [483],
    final: {
      screen: 'roundEnd',
      round: 1,
      tallies: [0, 1],
      judgeIndex: 4,
      active: 'a',
      used: ['c0'],
      log: ['1·c0·b'],
      display: [0, 44],
      started: [true, true],
      questionIndex: 2,
      hintIndex: 0,
    },
  },
  {
    id: 'M15',
    pins: 'back to setup from match end',
    setup: { ...TABLE_G_DEFAULT, picked: ['c0'] },
    script: [startMatch('c0'), ...ticks(450), 'resetMatch'],
    roundsEndAt: [451],
    final: {
      screen: 'setup',
      round: 1,
      tallies: [0, 0],
      judgeIndex: 4,
      active: 'a',
      used: [],
      log: [],
      display: [0, 45],
      started: [true, false],
      questionIndex: 0,
      hintIndex: 0,
    },
  },
  {
    id: 'M16',
    pins: "the second team's hint spends exactly to zero; it does not advance hintIndex",
    setup: TABLE_G_DEFAULT,
    script: [startMatch('c0'), 'correct', ...ticks(10), ...ticks(430), 'hint'],
    roundsEndAt: [443],
    final: {
      screen: 'roundEnd',
      round: 1,
      tallies: [1, 0],
      judgeIndex: 4,
      active: 'b',
      used: ['c0'],
      log: ['1·c0·a'],
      display: [45, 0],
      started: [true, true],
      questionIndex: 1,
      hintIndex: 0,
    },
  },
]

// ============================================================================
// The generated sequences — specs.md §2.10, "A sequence" and "A sample"
// ============================================================================

/**
 * A draw (specs.md §2.10): ONE `rand()` — the category value `r` — then
 * `permutation(rand, 3)`, two more. Every category has three questions
 * (testing/rooms.ts), so every permutation is of three.
 */
export function drawFor(rand: () => number, type: MatchFlow): MatchDraw {
  const r = rand()
  const perm = permutation(rand, 3)
  return { type, r, perm }
}

/** How a generated sequence ended (specs.md §2.10). */
export type SequenceEnd =
  /** A `resetMatch` was drawn — on round end or on match end — and is the sequence's last event. */
  | 'resetMatch'
  /** On match end with two matches already ended: the sequence ends before any draw. */
  | 'twoMatches'
  /** `MATCH_MAX_STEPS` events. No pre-registered sequence ends this way (verification.md Table F). */
  | 'maxSteps'

export interface GeneratedEvents {
  readonly events: readonly MatchEvent[]
  /** Times the exact oracle's screen became `match` from another screen. */
  readonly matchesEnded: number
  readonly end: SequenceEnd
}

/**
 * One sequence, generated one event at a time from the EXACT match oracle's
 * screen — the oracle that times everything, as Phase 3's exact oracle timed
 * its stop rule — so the sample never depends on the engine under test. Draw
 * order is part of the contract (specs.md §2.10's event table):
 *
 * | Exact oracle's screen | Event |
 * |---|---|
 * | `ready` (the start) | `startMatch` + a draw — always the first event |
 * | `play` | `rand() < rate` ? (`r = rand()`: `r < 0.5` → `correct`; `r < 0.8` → `skip`; else `hint`) : `tick` |
 * | `roundEnd` | `r = rand()`: `r < 0.25` → `tick`; `r < 0.95` → `nextRound` + a draw; else `resetMatch` — the sequence ends |
 * | `match` | two matches ended → the sequence ends before any draw. Else `r = rand()`: `r < 0.25` → `tick`; `r < 0.6` → `startMatch` + a draw (a rematch); else `resetMatch` — the sequence ends |
 *
 * A sequence also ends at `MATCH_MAX_STEPS` events. The only flow events are
 * those whose buttons the prototype shows on that screen. `setup` is reached
 * only by a `resetMatch`, which ends the sequence, so no event is ever chosen
 * there.
 */
export function generateMatchEvents(
  rand: () => number,
  setup: ReadyRoomSetup,
  rate: number,
): GeneratedEvents {
  const exact = matchOracle('exact', setup)
  const events: MatchEvent[] = []
  let matchesEnded = 0
  while (events.length < MATCH_MAX_STEPS) {
    const screen = exact.screen()
    let event: MatchEvent
    switch (screen) {
      case 'ready':
        event = drawFor(rand, 'startMatch')
        break
      case 'play':
        if (rand() < rate) {
          const r = rand()
          event = r < 0.5 ? 'correct' : r < 0.8 ? 'skip' : 'hint'
        } else {
          event = 'tick'
        }
        break
      case 'roundEnd': {
        const r = rand()
        event = r < 0.25 ? 'tick' : r < 0.95 ? drawFor(rand, 'nextRound') : 'resetMatch'
        break
      }
      case 'match': {
        if (matchesEnded >= 2) return { events, matchesEnded, end: 'twoMatches' }
        const r = rand()
        event = r < 0.25 ? 'tick' : r < 0.6 ? drawFor(rand, 'startMatch') : 'resetMatch'
        break
      }
      case 'setup':
        throw new Error(
          'generateMatchEvents: setup is reached only by the resetMatch that ends a sequence',
        )
    }
    exact.step(event)
    events.push(event)
    if (screen !== 'match' && exact.screen() === 'match') matchesEnded += 1
    if (event === 'resetMatch') return { events, matchesEnded, end: 'resetMatch' }
  }
  return { events, matchesEnded, end: 'maxSteps' }
}

/** A sample (specs.md §2.10): `(roundSeconds, seed, n)`. */
export interface MatchSample {
  readonly roundSeconds: number
  readonly seed: number
  readonly n: number
}

/** The verdict's sample: 45 s, `MATCH_SEED`, 500 sequences (verification.md Table F, first row). */
export const MATCH_VERDICT_SAMPLE: MatchSample = { roundSeconds: 45, seed: MATCH_SEED, n: 500 }

/** One sample per legal bank length: `MATCH_SEED + roundSeconds`, 20 sequences each (Table F, rows 2–16). */
export const MATCH_PER_LENGTH_SAMPLES: readonly MatchSample[] = ROUND_SECONDS_OPTIONS.map(
  (roundSeconds) => ({ roundSeconds, seed: MATCH_SEED + roundSeconds, n: 20 }),
)

export interface GeneratedMatch extends GeneratedEvents {
  /** 0-based position in its sample. */
  readonly index: number
  readonly rate: number
  readonly setup: ReadyRoomSetup
}

/**
 * The sample's sequences, in generation order, all drawn from ONE shared
 * `mulberry32(sample.seed)`: sequence `i` draws its configuration with
 * `drawMatchConfig`, then its events, at rate `MATCH_RATES[i % 3]`. Because
 * the generator is shared, sequence `i` depends on every sequence before it,
 * so they are yielded strictly in order.
 */
export function* matchSequences(sample: MatchSample): Generator<GeneratedMatch> {
  const rand = mulberry32(sample.seed)
  for (let index = 0; index < sample.n; index += 1) {
    const rate = MATCH_RATES[index % MATCH_RATES.length]
    if (rate === undefined) throw new Error(`no rate for sequence ${index}`)
    const setup = drawMatchConfig(rand, sample.roundSeconds)
    yield { index, rate, setup, ...generateMatchEvents(rand, setup, rate) }
  }
}
