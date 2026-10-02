import { describe, expect, test } from 'vitest'

import {
  drawableCategories,
  drawCategory,
  nextRoundChoices,
  shuffleQuestions,
  unusedCategories,
} from './draw.js'
import { createRoom } from './room.js'
import { deepFreeze } from './testing/deep-freeze.js'
import { mulberry32 } from './testing/prng.js'
import type { CategoryId, Question, Random, RoomState, Screen } from './types.js'

// Phase 4 — the draw: specs/phase-4/verification.md Gate 2, over the pure
// helpers of draw.ts. See specs/phase-4/specs.md §2.4 (the contracts) and §2.11
// (this file's row).
//
// REQ-4.3 — which categories the next round may be drawn from, and the pick.
// REQ-4.1 — the pick's one guard.
// REQ-4.2 — the shuffle: fair (every ordering exactly once), pinned to the
//           pre-registered values of verification.md Table H, pure, counted,
//           and guarded.
//
// Two Gate 2 boxes are deliberately not here yet (verification.md, "Gate
// ordering"): the 🚦 premise box — the prototype's own shuffle, measured — is
// evaluated once, after Gate 4's extraction #15 has pinned the line it runs;
// and "A bad draw throws, in every state" needs the reducer's `startMatch` and
// `nextRound`, which land in specs.md §1 STEP 3.
//
// Every random source below is scripted or seeded — `mulberry32` from Phase 3's
// test support — so every number this file asserts is reproducible. Where a box
// counts, one pass tallies and one `toStrictEqual` compares, so a failure
// reports the count and the first cases rather than stopping at the first.
// Every category and question is synthetic; nothing is copied from design/.

const ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

/** Table H's seed: `mulberry32(0x20261002)`, the same seed as the match generator's. */
const TABLE_H_SEED = 0x20261002

/** The largest double below 1: the top of the range a random source may return. */
const LARGEST_BELOW_ONE = 1 - 2 ** -53

/** Failures kept per check, for the assertion's message. */
const KEEP = 5

/**
 * A hand-built room on `screen` with this selection and used list. No action
 * in this phase builds a selection — that is Phase 5's setup — so every room
 * here is built by hand.
 */
const room = (
  screen: Screen,
  picked: readonly CategoryId[],
  used: readonly CategoryId[],
): RoomState => ({
  ...createRoom(ROOM),
  screen,
  pickedCategories: picked,
  usedCategories: used,
})

/** `c0 … c{L−1}`. */
const ids = (length: number): CategoryId[] => Array.from({ length }, (_, k) => `c${k}`)

const question = (n: number): Question => ({
  q: `Q${n}`,
  a: `A${n}`,
  alts: [],
  h: [`H${n}`],
  f: `F${n}`,
})

/** `Q0 … Q{n−1}`, in that order. */
const questions = (n: number): Question[] => Array.from({ length: n }, (_, k) => question(k))

/** An ordering as Table H writes it: `Q1,Q2,Q0`. */
const order = (list: readonly Question[]): string => list.map(({ q }) => q).join(',')

/** An ordering of `Q0 … Q{n−1}` as Table H's counts write it: `120`. */
const digits = (list: readonly Question[]): string => list.map(({ q }) => q.slice(1)).join('')

/** Whether `got` holds exactly the elements of `input`, each once, by identity. */
const sameElements = (got: readonly Question[], input: readonly Question[]): boolean =>
  got.length === input.length &&
  new Set(got).size === got.length &&
  got.every((q) => input.includes(q))

/** A random source and the number of times it has been called. */
interface Counted {
  readonly random: Random
  readonly calls: () => number
}

/** `source`, counting its calls. */
const counted = (source: Random): Counted => {
  let calls = 0
  return {
    random: () => {
      calls += 1
      return source()
    },
    calls: () => calls,
  }
}

/**
 * A source returning `values` in order. It throws if called more often than it
 * has values, so a helper that drew once too often fails loudly rather than
 * being handed an `undefined`.
 */
const scripted = (values: readonly number[]): Counted => {
  let next = 0
  return counted(() => {
    const value = values[next]
    next += 1
    if (value === undefined) {
      throw new Error(`scripted source called ${next} times; it holds ${values.length} values`)
    }
    return value
  })
}

/** The error `fn` throws, or `undefined` when it returns. */
const caught = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

// ============================================================================
// REQ-4.3 — which categories may be drawn
// ============================================================================

describe('REQ-4.3: drawableCategories — the list the next round may be drawn from', () => {
  // Selection order deliberately differs from id order and from use order, so
  // that a result in either of those orders shows as a mismatch.
  const PICKED: readonly CategoryId[] = ['c3', 'c0', 'c5', 'c1']
  const SCREENS: readonly Screen[] = ['setup', 'ready', 'play', 'roundEnd', 'match']
  /** Where the next round is a match's first, and the used list will start empty. */
  const MATCH_START: readonly Screen[] = ['ready', 'match']

  const CASES: readonly {
    readonly name: string
    readonly used: readonly CategoryId[]
    /** On `ready` and `match`. */
    readonly first: readonly CategoryId[]
    /** On `setup`, `play` and `roundEnd`. */
    readonly next: readonly CategoryId[]
  }[] = [
    { name: 'none used', used: [], first: PICKED, next: PICKED },
    // Used in the order c5, c3; the rest come back in SELECTION order.
    { name: 'two used', used: ['c5', 'c3'], first: PICKED, next: ['c0', 'c1'] },
    // The fallback — every selected category used. No action reaches this state
    // (requirements.md §1.1, fact 1); it is built by hand.
    { name: 'all used', used: ['c1', 'c5', 'c0', 'c3'], first: PICKED, next: PICKED },
  ]

  test('15 cases — five screens × none, two and all used — each the list of specs.md §2.4', () => {
    let cases = 0
    const mismatches: (readonly [name: string, screen: Screen, got: string, want: string])[] = []
    for (const { name, used, first, next } of CASES) {
      for (const screen of SCREENS) {
        cases += 1
        const want = (MATCH_START.includes(screen) ? first : next).join(',')
        const got = drawableCategories(room(screen, PICKED, used)).join(',')
        if (got !== want) mismatches.push([name, screen, got, want])
      }
    }
    expect({
      cases,
      mismatches: mismatches.length,
      first: mismatches.slice(0, KEEP),
    }).toStrictEqual({
      cases: 15,
      mismatches: 0,
      first: [],
    })
  })

  test.for(['setup', 'play', 'roundEnd'] as const)(
    'on %s, picked [c3, c0, c5, c1] with [c5, c3] used gives [c0, c1] — selection order kept',
    (screen) => {
      expect(drawableCategories(room(screen, PICKED, ['c5', 'c3']))).toStrictEqual(['c0', 'c1'])
    },
  )

  test.for(['ready', 'match'] as const)(
    'on %s, the whole selection in selection order — even with [c5, c3] used',
    (screen) => {
      expect(drawableCategories(room(screen, PICKED, ['c5', 'c3']))).toStrictEqual([
        'c3',
        'c0',
        'c5',
        'c1',
      ])
    },
  )

  test('the fallback: with every selected category used, the whole selection, in selection order', () => {
    const exhausted = room('roundEnd', PICKED, ['c1', 'c5', 'c0', 'c3'])
    expect(unusedCategories(exhausted)).toStrictEqual([])
    expect(nextRoundChoices(exhausted)).toStrictEqual(['c3', 'c0', 'c5', 'c1'])
    expect(drawableCategories(exhausted)).toStrictEqual(['c3', 'c0', 'c5', 'c1'])
  })

  test('the internal lists: unused in selection order, and no fallback while any is unused', () => {
    const partway = room('roundEnd', PICKED, ['c5', 'c3'])
    expect(unusedCategories(partway)).toStrictEqual(['c0', 'c1'])
    expect(nextRoundChoices(partway)).toStrictEqual(['c0', 'c1'])
    // One unused category left: the list is that one, not the whole selection.
    const last = room('roundEnd', PICKED, ['c5', 'c3', 'c1'])
    expect(nextRoundChoices(last)).toStrictEqual(['c0'])
  })
})

// ============================================================================
// REQ-4.3 — the pick
// ============================================================================

describe('REQ-4.3: drawCategory — the prototype formula, one call per pick', () => {
  test('for every L = 1 … 11 and every k, random (k + 0.5) / L picks element k — 66 pairs', () => {
    let pairs = 0
    let calls = 0
    const mismatches: (readonly [length: number, k: number, got: CategoryId])[] = []
    for (let length = 1; length <= 11; length += 1) {
      for (let k = 0; k < length; k += 1) {
        pairs += 1
        const source = scripted([(k + 0.5) / length])
        const got = drawCategory(ids(length), source.random)
        calls += source.calls()
        if (got !== `c${k}`) mismatches.push([length, k, got])
      }
    }
    expect({
      pairs,
      mismatches: mismatches.length,
      first: mismatches.slice(0, KEEP),
      calls,
    }).toStrictEqual({ pairs: 66, mismatches: 0, first: [], calls: 66 })
  })

  test('random 0 picks the first and 1 − 2⁻⁵³ the last, at every L = 1 … 11', () => {
    expect([LARGEST_BELOW_ONE < 1, LARGEST_BELOW_ONE]).toStrictEqual([true, 0.9999999999999999])
    let calls = 0
    const mismatches: (readonly [length: number, first: CategoryId, last: CategoryId])[] = []
    for (let length = 1; length <= 11; length += 1) {
      const low = scripted([0])
      const high = scripted([LARGEST_BELOW_ONE])
      const first = drawCategory(ids(length), low.random)
      const last = drawCategory(ids(length), high.random)
      calls += low.calls() + high.calls()
      if (first !== 'c0' || last !== `c${length - 1}`) mismatches.push([length, first, last])
    }
    expect({ mismatches, calls }).toStrictEqual({ mismatches: [], calls: 22 })
  })
})

// ============================================================================
// REQ-4.1 — the pick's one guard
// ============================================================================

describe("REQ-4.1: drawCategory's one guard — every bad input throws a RangeError", () => {
  const GUARD_CASES: readonly (readonly [
    name: string,
    choices: readonly CategoryId[],
    value: number,
  ])[] = [
    ['an empty list', [], 0.5],
    ['random 1', ids(3), 1],
    ['random −1e-9', ids(3), -1e-9],
    ['random NaN', ids(3), NaN],
    ['random Infinity', ids(3), Infinity],
  ]

  test('5 inputs thrown, each message naming the value and the length', () => {
    const results = GUARD_CASES.map(([name, choices, value]) => {
      const error = caught(() => drawCategory(choices, () => value))
      const message = error instanceof Error ? error.message : ''
      return {
        name,
        rangeError: error instanceof RangeError,
        namesValue: message.includes(`got ${value} `),
        namesLength: message.includes(`length ${choices.length}`),
      }
    })
    expect(results).toStrictEqual(
      GUARD_CASES.map(([name]) => ({
        name,
        rangeError: true,
        namesValue: true,
        namesLength: true,
      })),
    )
    expect(results).toHaveLength(5)
  })
})

// ============================================================================
// REQ-4.2 — fair: every ordering exactly once
// ============================================================================

/**
 * Every draw vector of Table H's fourth row for n questions: jᵢ ∈ 0 … i for
 * i = 0 … n − 1 — 1 × 2 × … × n = n! vectors.
 */
const drawVectors = (n: number): number[][] =>
  n === 0
    ? [[]]
    : drawVectors(n - 1).flatMap((vector) => Array.from({ length: n }, (_, j) => [...vector, j]))

describe('REQ-4.2: shuffleQuestions is fair — every ordering exactly once', () => {
  test('n = 1 … 6: every draw vector, fed as rᵢ = (jᵢ + 0.5) / (i + 1), gives n! distinct orderings, each once', () => {
    const results = [1, 2, 3, 4, 5, 6].map((n) => {
      const input = questions(n)
      const seen = new Map<string, number>()
      let vectors = 0
      let draws = 0
      let notPermutations = 0
      for (const vector of drawVectors(n)) {
        vectors += 1
        const source = scripted(vector.map((j, i) => (j + 0.5) / (i + 1)))
        const shuffled = shuffleQuestions(input, source.random)
        draws += source.calls()
        if (!sameElements(shuffled, input)) notPermutations += 1
        const key = order(shuffled)
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }
      return {
        n,
        vectors,
        distinct: seen.size,
        eachOnce: [...seen.values()].every((count) => count === 1),
        drawsPerVector: draws / vectors,
        notPermutations,
      }
    })
    expect(results).toStrictEqual(
      [
        [1, 1],
        [2, 2],
        [3, 6],
        [4, 24],
        [5, 120],
        [6, 720],
      ].map(([n, factorial]) => ({
        n,
        vectors: factorial,
        distinct: factorial,
        eachOnce: true,
        drawsPerVector: n,
        notPermutations: 0,
      })),
    )
  })
})

// ============================================================================
// REQ-4.2 — pinned, pure and counted
// ============================================================================

describe('REQ-4.2: shuffleQuestions — pinned to Table H, pure, and counted', () => {
  test("Table H's third row: three scripted draws, and five items from the seed in exactly 5 draws", () => {
    const SCRIPTED: readonly (readonly [draws: readonly number[], want: string])[] = [
      [[0.9, 0.1, 0.6], 'Q1,Q2,Q0'],
      [[0, 0.99, 0.99], 'Q0,Q1,Q2'],
      [[0.5, 0, 0], 'Q2,Q1,Q0'],
    ]
    const got = SCRIPTED.map(([draws]) => {
      const source = scripted(draws)
      return [order(shuffleQuestions(questions(3), source.random)), source.calls()]
    })
    expect(got).toStrictEqual(SCRIPTED.map(([, want]) => [want, 3]))

    const seeded = counted(mulberry32(TABLE_H_SEED))
    expect([order(shuffleQuestions(questions(5), seeded.random)), seeded.calls()]).toStrictEqual([
      'Q3,Q0,Q2,Q4,Q1',
      5,
    ])
  })

  test("Table H's second row: 60,000 shuffles of [Q0, Q1, Q2] from one seeded stream, counted exactly", () => {
    // One stream for the whole run, three draws per shuffle, the input
    // deep-frozen: a shuffle that wrote to it would throw here.
    const random = mulberry32(TABLE_H_SEED)
    const input = deepFreeze(questions(3))
    const counts: Record<string, number> = {}
    for (let k = 0; k < 60_000; k += 1) {
      const key = digits(shuffleQuestions(input, random))
      counts[key] = (counts[key] ?? 0) + 1
    }
    expect(counts).toStrictEqual({
      '012': 10_142,
      '021': 10_001,
      '102': 9_823,
      '120': 10_115,
      '201': 9_925,
      '210': 9_994,
    })
  })

  test('n = 0 … 6: exactly n draws; a new array, never the input; the same elements; a frozen input unchanged', () => {
    const random = mulberry32(TABLE_H_SEED)
    const results = [0, 1, 2, 3, 4, 5, 6].map((n) => {
      const input = deepFreeze(questions(n))
      const before = JSON.stringify(input)
      const source = counted(random)
      let shuffled: readonly Question[] = []
      const error = caught(() => {
        shuffled = shuffleQuestions(input, source.random)
      })
      return {
        n,
        draws: source.calls(),
        newArray: shuffled !== input,
        sameElements: sameElements(shuffled, input),
        typeError: error instanceof TypeError,
        inputUnchanged: JSON.stringify(input) === before && order(input) === order(questions(n)),
      }
    })
    expect(results).toStrictEqual(
      [0, 1, 2, 3, 4, 5, 6].map((n) => ({
        n,
        draws: n,
        newArray: true,
        sameElements: true,
        typeError: false,
        inputUnchanged: true,
      })),
    )
  })
})

// ============================================================================
// REQ-4.2 — the shuffle's guard
// ============================================================================

describe("REQ-4.2: shuffleQuestions' guard — a random value outside [0, 1) throws", () => {
  const BAD: readonly number[] = [1, -0.5, NaN]
  /** In a shuffle of three: the first, a middle and the last draw. */
  const AT: readonly (readonly [name: string, draw: number])[] = [
    ['first', 0],
    ['middle', 1],
    ['last', 2],
  ]

  test('9 cases — 1, −0.5 and NaN at the first, a middle and the last draw — each a RangeError at that draw', () => {
    const results = BAD.flatMap((value) =>
      AT.map(([at, draw]) => {
        const draws = [0.5, 0.5, 0.5].map((valid, i) => (i === draw ? value : valid))
        const source = scripted(draws)
        const error = caught(() => shuffleQuestions(questions(3), source.random))
        const message = error instanceof Error ? error.message : ''
        return {
          value: String(value),
          at,
          rangeError: error instanceof RangeError,
          // It stops at the bad draw: no later draw is made.
          drawsMade: source.calls(),
          named: message.includes(`got ${value} at draw ${draw + 1} of 3`),
        }
      }),
    )
    expect(results).toStrictEqual(
      BAD.flatMap((value) =>
        AT.map(([at, draw]) => ({
          value: String(value),
          at,
          rangeError: true,
          drawsMade: draw + 1,
          named: true,
        })),
      ),
    )
    expect(results).toHaveLength(9)
  })
})
