import { describe, expect, test } from 'vitest'

import { remainingMs } from './clock.js'
import { matchWinner } from './match.js'
import { reduce } from './reducer.js'
import { createRoom } from './room.js'
import { REVEAL_HOLD_MS } from './rules.js'
import { categoryIds, categoryQuestions, readyRoom } from './testing/rooms.js'
import type { ReadyRoomSetup } from './testing/rooms.js'
import type { Action, CategoryId, Question, RoomState, Screen, Team } from './types.js'

// Phase 4 — the round and match flow: the direct boxes of
// specs/phase-4/verification.md Gates 1 and 3, and Gate 2's "A bad draw
// throws, in every state", which needs the reducer. See specs/phase-4/specs.md
// §2.5 (match.ts), §2.6 (the reducer's table, including the Phase 3 rows that
// change) and §2.11.
//
// As in Phase 3's reducer tests, every expected state is written as "the
// previous state with these fields replaced", compared with `toStrictEqual`, so
// "nothing else changed" is part of each assertion rather than a separate claim.
//
// Every match starts from `readyRoom` (testing/rooms.ts), which stands in for
// Phase 5's setup. Not here yet: Table G (REQ-4.13).
//
// Every question below is synthetic. Nothing is copied from design/.

const ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

const question = (n: number): Question => ({
  q: `سؤال تجريبي ${n}`,
  a: `جواب ${n}`,
  alts: [],
  h: [`تلميح ${n}-1`, `تلميح ${n}-2`],
  f: `معلومة ${n}`,
})

const POOL: readonly [Question, ...Question[]] = [question(0), question(1), question(2)]

const tick = (ms: number): Action => ({ type: 'tick', ms })
const CORRECT: Action = { type: 'correct' }
const startRound = (startingTeam: Team): Action => ({
  type: 'startRound',
  startingTeam,
  questions: POOL,
})

/** `n` steps of `tick(ms)`, one reducer call each. */
const ticks = (state: RoomState, n: number, ms = 100): RoomState => {
  let s = state
  for (let i = 0; i < n; i += 1) s = reduce(s, tick(ms))
  return s
}

// ============================================================================
// verification.md Gate 1 — the one new field
// ============================================================================

describe('REQ-4.11: revealedAt — the engine time the reveal went up', () => {
  test('a created room has no reveal, so no time it went up', () => {
    const room = createRoom(ROOM)
    expect([room.reveal, room.revealedAt]).toStrictEqual([null, null])
  })

  test('correct records clock.now — 3,700 after 37 ticks, and 0 at engine time 0, never null', () => {
    const live = ticks(reduce(createRoom(ROOM), startRound('a')), 37)
    expect(live.clock.now).toBe(3_700)
    expect(reduce(live, CORRECT).revealedAt).toBe(3_700)

    // A reveal raised at engine time 0 records 0: the first round of every room
    // starts there, and 0 must not read as "no reveal" (the trap Phase 3 named
    // for runningSince).
    const atZero = reduce(reduce(createRoom(ROOM), startRound('b')), CORRECT)
    expect([atZero.clock.now, atZero.revealedAt, atZero.reveal === null]).toStrictEqual([
      0,
      0,
      false,
    ])
  })

  test('ticks during the reveal leave it where it went up', () => {
    const revealed = reduce(ticks(reduce(createRoom(ROOM), startRound('a')), 10), CORRECT)
    const later = ticks(revealed, 25)
    expect([later.clock.now, later.revealedAt]).toStrictEqual([3_500, 1_000])
  })

  test('startRound clears it with the reveal', () => {
    // From a round that ended normally — nothing to clear.
    const ended = reduce(reduce(createRoom(ROOM), startRound('a')), tick(45_000))
    expect(reduce(ended, startRound('b')).revealedAt).toBeNull()

    // From a hand-built state no action produces — the round over with a reveal
    // still recorded — so that the clearing is visible rather than vacuous.
    const stale: RoomState = {
      ...ended,
      reveal: { answer: POOL[0].a, fact: POOL[0].f },
      revealedAt: 12_000,
    }
    const restarted = reduce(stale, startRound('b'))
    expect([restarted.screen, restarted.reveal, restarted.revealedAt]).toStrictEqual([
      'play',
      null,
      null,
    ])
  })
})

// ============================================================================
// Shared by Gates 2 and 3 — the match flow's actions and hand-built rooms
// ============================================================================

type Kind = 'startMatch' | 'nextRound'

const HINT: Action = { type: 'hint' }
const SKIP: Action = { type: 'skip' }
const RESET: Action = { type: 'resetMatch' }
const PASS: Action = { type: 'passTurn' }
const startMatch = (
  categoryId: CategoryId,
  questions: readonly [Question, ...Question[]] = categoryQuestions(categoryId),
): Action => ({ type: 'startMatch', categoryId, questions })
const nextRound = (
  categoryId: CategoryId,
  questions: readonly [Question, ...Question[]] = categoryQuestions(categoryId),
): Action => ({ type: 'nextRound', categoryId, questions })
const roundAction = (
  kind: Kind,
  categoryId: CategoryId,
  questions: readonly [Question, ...Question[]] = categoryQuestions(categoryId),
): Action =>
  kind === 'startMatch' ? startMatch(categoryId, questions) : nextRound(categoryId, questions)

/** A malformed action. The type system rightly refuses it; it is asserted into shape only to prove the reducer refuses it too. */
const malformed = (action: object): Action => action as Action

/** The error `fn` throws, or `undefined` when it returns. */
const caught = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

/**
 * The prototype's initial state, as a ready room — verification.md Table G's
 * default: 45 s, three wins, c0–c7 selected, five players, judge 4, rotation off.
 */
const DEFAULT: ReadyRoomSetup = {
  roundSeconds: 45,
  winsNeeded: 3,
  picked: categoryIds(8),
  players: 5,
  rotateJudge: false,
  judgeIndex: 4,
}

/** A full 45 s bank in ms: one tick of it empties the active bank of any 45 s round. */
const FULL = 45_000

/**
 * From `readyRoom(setup)`, a match whose rounds draw `drawn` in order — every
 * round but the last silent: one tick(45,000) empties the starting team's bank —
 * returning the last round live, at its start.
 */
const playedTo = (setup: ReadyRoomSetup, drawn: readonly [CategoryId, ...CategoryId[]]) => {
  const [first, ...rest] = drawn
  let s = reduce(readyRoom(setup), startMatch(first))
  for (const categoryId of rest) s = reduce(reduce(s, tick(FULL)), nextRound(categoryId))
  return s
}

/**
 * The state an effective turn pass leaves (specs.md §2.6, the `passTurn` row),
 * built by hand from a live round on the other team's first turn: the active
 * team answers — `correct` settles and keeps its bank — then the reveal is
 * down, the question index advanced, and the other team active with a full
 * bank, started, running from now. It is the only way a round of a match is
 * lost by the team that did not start it. Built by hand rather than through
 * `passTurn`, so that the scoring boxes below rest on `correct` and `tick` alone.
 */
const passedByHand = (s: RoomState): RoomState => {
  const answered = reduce(s, CORRECT)
  const next: Team = answered.clock.active === 'a' ? 'b' : 'a'
  return {
    ...answered,
    questionIndex: answered.questionIndex + 1,
    hintIndex: 0,
    reveal: null,
    revealedAt: null,
    clock: {
      ...answered.clock,
      active: next,
      runningSince: answered.clock.now,
      banks: {
        ...answered.clock.banks,
        [next]: { ms: answered.config.roundSeconds * 1000, started: true },
      },
    },
  }
}

// ============================================================================
// verification.md Gate 2 — a bad draw throws, in every state
// ============================================================================

describe('REQ-4.1: a bad draw throws in every state — validation precedes inertness', () => {
  /** Two categories, so the second round runs them out and ends the match. */
  const TWO: ReadyRoomSetup = { ...DEFAULT, picked: ['c0', 'c1'] }
  const roundOne = (): RoomState => ticks(playedTo(TWO, ['c0']), 10)
  const roundOneEnded = (): RoomState => reduce(playedTo(TWO, ['c0']), tick(FULL))

  /** The six states of the box, each reached by actions — "a reveal" by `correct` in a round. */
  const STATES = {
    ready: () => readyRoom(TWO),
    play: roundOne,
    reveal: () => reduce(roundOne(), CORRECT),
    roundEnd: roundOneEnded,
    match: () => reduce(reduce(roundOneEnded(), nextRound('c1')), tick(FULL)),
    setup: () => reduce(roundOneEnded(), RESET),
  } as const satisfies Record<string, () => RoomState>
  type StateName = keyof typeof STATES

  test('the six states are what they claim: screen, whether a reveal is up, the used list', () => {
    const got = Object.entries(STATES).map(([name, make]) => {
      const s = make()
      return [name, s.screen, s.reveal !== null, s.usedCategories]
    })
    expect(got).toStrictEqual([
      ['ready', 'ready', false, []],
      ['play', 'play', false, ['c0']],
      ['reveal', 'play', true, ['c0']],
      ['roundEnd', 'roundEnd', false, ['c0']],
      ['match', 'match', false, ['c0', 'c1']],
      ['setup', 'setup', false, []],
    ])
  })

  /**
   * Per state and action: a category the rules allow, one they refuse, and the
   * allowed list the refusal must name. `startMatch` may draw any selected
   * category, so the refused one is outside the selection. `nextRound` may draw
   * the selected-but-unused: where c0 is used and c1 is not, the refused one is
   * c0 — selected, but used; where none is used, or none is unused (on `match`,
   * both are — the fallback), the whole selection is allowed and the refused
   * one is outside it.
   */
  const ROWS = [
    ['ready', 'startMatch', 'c0', 'c9', 'c0, c1'],
    ['ready', 'nextRound', 'c0', 'c9', 'c0, c1'],
    ['play', 'startMatch', 'c0', 'c9', 'c0, c1'],
    ['play', 'nextRound', 'c1', 'c0', 'c1'],
    ['reveal', 'startMatch', 'c0', 'c9', 'c0, c1'],
    ['reveal', 'nextRound', 'c1', 'c0', 'c1'],
    ['roundEnd', 'startMatch', 'c0', 'c9', 'c0, c1'],
    ['roundEnd', 'nextRound', 'c1', 'c0', 'c1'],
    ['match', 'startMatch', 'c0', 'c9', 'c0, c1'],
    ['match', 'nextRound', 'c0', 'c9', 'c0, c1'],
    ['setup', 'startMatch', 'c0', 'c9', 'c0, c1'],
    ['setup', 'nextRound', 'c0', 'c9', 'c0, c1'],
  ] as const satisfies readonly (readonly [
    state: StateName,
    kind: Kind,
    allowed: CategoryId,
    refused: CategoryId,
    allowedList: string,
  ])[]

  /** The four bad inputs: each builds its action and the text its message must contain. */
  const BAD: readonly (readonly [
    input: string,
    make: (
      kind: Kind,
      allowed: CategoryId,
      refused: CategoryId,
      allowedList: string,
    ) => readonly [action: Action, message: string],
  ])[] = [
    [
      'a category the rules refuse',
      (kind, _allowed, refused, allowedList) => [
        roundAction(kind, refused),
        `${kind} needs a category from [${allowedList}]; got ${refused}`,
      ],
    ],
    [
      'questions: []',
      (kind, allowed) => [
        malformed({ type: kind, categoryId: allowed, questions: [] }),
        `${kind} needs at least one question; got an empty array`,
      ],
    ],
    [
      // Array-like, with a length of 1: a length check alone would pass it.
      'questions: an array-like object, not an array',
      (kind, allowed) => [
        malformed({
          type: kind,
          categoryId: allowed,
          questions: { length: 1, 0: categoryQuestions(allowed)[0] },
        }),
        `${kind} needs at least one question; got object`,
      ],
    ],
    [
      // A different question object, answer and fact, with the first one's text.
      'two questions sharing a q',
      (kind, allowed) => {
        const [q0, q1, q2] = categoryQuestions(allowed)
        return [
          roundAction(kind, allowed, [q0, q1, { ...q2, q: q0.q }]),
          `${kind} needs questions with distinct text; got "${allowed}-q0" more than once`,
        ]
      },
    ],
  ]

  test('48 cases — 2 actions × 4 inputs × 6 states — each a RangeError whose message says what was wrong', () => {
    const results = ROWS.flatMap(([state, kind, allowed, refused, allowedList]) =>
      BAD.map(([input, make]) => {
        const [action, message] = make(kind, allowed, refused, allowedList)
        const error = caught(() => reduce(STATES[state](), action))
        return {
          state,
          kind,
          input,
          rangeError: error instanceof RangeError,
          message: error instanceof Error && error.message.includes(message),
        }
      }),
    )
    expect(results).toStrictEqual(
      ROWS.flatMap(([state, kind]) =>
        BAD.map(([input]) => ({ state, kind, input, rangeError: true, message: true })),
      ),
    )
    expect(results).toHaveLength(48)
  })

  /** Where each action takes effect; on every other screen a well-formed one is inert. */
  const EFFECTIVE: Record<Kind, readonly StateName[]> = {
    startMatch: ['ready', 'match'],
    nextRound: ['roundEnd'],
  }

  test('a well-formed draw: the same object on the 9 inert screens, a round started on the 3 others', () => {
    const results = ROWS.map(([state, kind, allowed]) => {
      const s = STATES[state]()
      const after = reduce(s, roundAction(kind, allowed))
      return [state, kind, after === s ? 'same object' : after.screen]
    })
    expect(results).toStrictEqual(
      ROWS.map(([state, kind]) => [
        state,
        kind,
        EFFECTIVE[kind].includes(state) ? 'play' : 'same object',
      ]),
    )
    expect(results.filter(([, , got]) => got === 'same object')).toHaveLength(9)
  })
})

// ============================================================================
// verification.md Gate 3 — the flow
// ============================================================================

describe('REQ-4.4: startMatch from ready', () => {
  test.for([
    [0, 45],
    [0, 20],
    [123_400, 45],
    [123_400, 20],
  ] as const)(
    'at engine time %i, %i s: round 1 of a match, team a running from that time — all 21 fields by toStrictEqual',
    ([t, roundSeconds]) => {
      // Rotation on, judge 4, five players, eight categories: every setup field
      // away from its created default, so that "unchanged" is visible.
      const ready = reduce(readyRoom({ ...DEFAULT, roundSeconds, rotateJudge: true }), tick(t))
      expect([ready.screen, ready.clock.now]).toStrictEqual(['ready', t])

      const questions = categoryQuestions('c5')
      const s = reduce(ready, startMatch('c5', questions))
      const full = roundSeconds * 1000
      expect(s).toStrictEqual({
        ...ready,
        round: 1,
        tallyA: 0,
        tallyB: 0,
        log: [],
        usedCategories: ['c5'],
        categoryId: 'c5',
        screen: 'play',
        questionPool: questions,
        questionIndex: 0,
        hintIndex: 0,
        reveal: null,
        revealedAt: null,
        clock: {
          now: t,
          active: 'a',
          runningSince: t,
          banks: { a: { ms: full, started: true }, b: { ms: full, started: false } },
        },
      })
      expect(Object.keys(s)).toHaveLength(21)
      expect(s.questionPool).toBe(questions)

      // It runs: one tick drains team a, and only team a.
      const after = reduce(s, tick(100))
      expect([remainingMs(after.clock, 'a'), remainingMs(after.clock, 'b')]).toStrictEqual([
        full - 100,
        full,
      ])
    },
  )
})

describe('REQ-4.4: startMatch from match — a rematch', () => {
  const SETUP: ReadyRoomSetup = { ...DEFAULT, rotateJudge: true, judgeIndex: 2 }

  /**
   * A finished match, built by hand: round 4, b won it 3–1, a four-entry log,
   * four categories used, judge 2, rotation on. Tallies of 1–3 after four
   * rounds need a round won by the team that did not start it — round 4, which
   * b started and passed, and in which a's bank emptied — and the clock is
   * where that round left it.
   */
  const FINISHED: RoomState = {
    ...readyRoom(SETUP),
    screen: 'match',
    round: 4,
    tallyA: 1,
    tallyB: 3,
    log: [
      { n: 1, category: 'c3', winner: 'b' },
      { n: 2, category: 'c0', winner: 'a' },
      { n: 3, category: 'c6', winner: 'b' },
      { n: 4, category: 'c1', winner: 'b' },
    ],
    usedCategories: ['c3', 'c0', 'c6', 'c1'],
    categoryId: 'c1',
    questionPool: categoryQuestions('c1'),
    questionIndex: 2,
    hintIndex: 1,
    clock: {
      now: 187_300,
      active: 'a',
      runningSince: null,
      banks: { a: { ms: 0, started: true }, b: { ms: 12_400, started: true } },
    },
  }

  test('round 1 again — 0–0, log [], used [c3], a starting — with the judge still 2; equal to the ready case', () => {
    // c3 opened the last match: the used list restarts, so it may open this one.
    const questions = categoryQuestions('c3')
    const rematch = reduce(FINISHED, startMatch('c3', questions))
    expect(rematch).toStrictEqual({
      ...FINISHED,
      round: 1,
      tallyA: 0,
      tallyB: 0,
      log: [],
      usedCategories: ['c3'],
      categoryId: 'c3',
      screen: 'play',
      questionPool: questions,
      questionIndex: 0,
      hintIndex: 0,
      reveal: null,
      revealedAt: null,
      clock: {
        now: 187_300,
        active: 'a',
        runningSince: 187_300,
        banks: { a: { ms: 45_000, started: true }, b: { ms: 45_000, started: false } },
      },
    })
    expect(rematch.judgeIndex).toBe(2)

    // The ready case: the same setup on room-ready, at the same engine time.
    const ready = reduce(readyRoom(SETUP), tick(187_300))
    expect(rematch).toStrictEqual(reduce(ready, startMatch('c3', questions)))
  })

  test.for(['setup', 'play', 'roundEnd'] as const)('on %s it returns the same object', (screen) => {
    const play = playedTo(DEFAULT, ['c0'])
    const roundEnd = reduce(play, tick(FULL))
    const s = { play, roundEnd, setup: reduce(roundEnd, RESET) }[screen]
    expect(s.screen).toBe(screen)
    expect(reduce(s, startMatch('c3'))).toBe(s)
  })
})

describe('REQ-4.5: odd rounds start with team a, even rounds with team b', () => {
  /** Round, active team, and both started flags — at a round's start. */
  const startOf = (s: RoomState) =>
    [s.round, s.clock.active, s.clock.banks.a.started, s.clock.banks.b.started] as const

  test('rounds 1 … 7 of a four-win match start a, b, a, b, a, b, a; its rematch starts with a', () => {
    let s = reduce(readyRoom({ ...DEFAULT, winsNeeded: 4 }), startMatch('c0'))
    const starts = [startOf(s)]
    for (let k = 1; k < 7; k += 1) {
      s = reduce(reduce(s, tick(FULL)), nextRound(`c${k}`))
      starts.push(startOf(s))
    }
    expect(starts).toStrictEqual([
      [1, 'a', true, false],
      [2, 'b', false, true],
      [3, 'a', true, false],
      [4, 'b', false, true],
      [5, 'a', true, false],
      [6, 'b', false, true],
      [7, 'a', true, false],
    ])

    const over = reduce(s, tick(FULL))
    expect([over.screen, over.round, over.tallyA, over.tallyB]).toStrictEqual(['match', 7, 3, 4])
    expect(startOf(reduce(over, startMatch('c7')))).toStrictEqual([1, 'a', true, false])
  })
})

// ----------------------------------------------------------------------------
// REQ-4.6 — صحيح → a 1000 ms reveal → the other team's turn
// ----------------------------------------------------------------------------

/** What each bank has left at the state's engine time: team a's, then team b's. */
const left = (s: RoomState): readonly [number, number] => [
  remainingMs(s.clock, 'a'),
  remainingMs(s.clock, 'b'),
]

describe('REQ-4.6: the hold, to the millisecond', () => {
  /** Round 1 of a match: team a plays 37 ticks, then صحيح — the reveal goes up at T. */
  const T = 3_700
  const REVEALED = reduce(ticks(playedTo(DEFAULT, ['c0']), 37), CORRECT)

  /** What one effective pass at T + 1,000 leaves: b's first turn, full, running from then. */
  const PASSED: RoomState = {
    ...REVEALED,
    questionIndex: 1,
    hintIndex: 0,
    reveal: null,
    revealedAt: null,
    clock: {
      now: T + 1_000,
      active: 'b',
      runningSince: T + 1_000,
      banks: { a: { ms: FULL - T, started: true }, b: { ms: FULL, started: true } },
    },
  }

  test('correct at T = 3,700: revealedAt is T, the reveal up, the clock stopped with a at 41,300; the hold is 1,000 ms', () => {
    expect(REVEAL_HOLD_MS).toBe(1_000)
    expect([
      REVEALED.screen,
      REVEALED.clock.now,
      REVEALED.revealedAt,
      REVEALED.reveal,
      REVEALED.clock.runningSince,
      left(REVEALED),
    ]).toStrictEqual(['play', T, T, { answer: 'c0-a0', fact: 'c0-f0' }, null, [41_300, FULL]])
  })

  test('inert after 9 × tick(100) and after tick(999): passTurn returns the same object', () => {
    const at900 = ticks(REVEALED, 9)
    const at999 = reduce(REVEALED, tick(999))
    expect([at900.clock.now - T, at999.clock.now - T]).toStrictEqual([900, 999])
    expect(reduce(at900, PASS)).toBe(at900)
    expect(reduce(at999, PASS)).toBe(at999)
  })

  test('to the millisecond: after one tick of k ms, for every k = 0 … 1,000, it takes effect at k = 1,000 only', () => {
    const effectiveAt: number[] = []
    for (let k = 0; k <= 1_000; k += 1) {
      const s = reduce(REVEALED, tick(k))
      if (reduce(s, PASS) !== s) effectiveAt.push(k)
    }
    expect(effectiveAt).toStrictEqual([1_000])
  })

  test('effective at 1,000 ms by three routes — the 10th tick(100), tick(999) then tick(1), one tick(1000) — each leaving the same state', () => {
    const routes = [
      ticks(REVEALED, 10),
      reduce(reduce(REVEALED, tick(999)), tick(1)),
      reduce(REVEALED, tick(1_000)),
    ]
    expect(routes.map((s) => s.clock.now - T)).toStrictEqual([1_000, 1_000, 1_000])
    expect(routes.map((s) => reduce(s, PASS))).toStrictEqual([PASSED, PASSED, PASSED])
  })

  test('throughout the hold — at 0, 100, …, 1,000 ms and at 999 — hint, skip and correct return the same object and no bank drains', () => {
    const hold = [
      ...Array.from({ length: 11 }, (_, i) => ticks(REVEALED, i)),
      reduce(REVEALED, tick(999)),
    ]
    const notInert = hold.flatMap((s) =>
      [HINT, SKIP, CORRECT]
        .filter((action) => reduce(s, action) !== s)
        .map((action) => [s.clock.now - T, action.type]),
    )
    expect(notInert).toStrictEqual([])
    expect(hold.map(left)).toStrictEqual(hold.map(() => [41_300, FULL]))
  })
})

describe('REQ-4.6: the pass, exactly', () => {
  // One round of a match, three passes. Every turn spends a hint before صحيح,
  // so that the pass's return of `hintIndex` to 0 is visible, and each hold is
  // reached by a different route:
  //   a — a hint, 5,000 ms, صحيح at 5,000 (a at 38,000); the hold by 10 × tick(100);
  //   b — a hint, 3,000 ms, صحيح at 9,000 (b at 40,000); the hold by one tick(1000);
  //   a — 2,000 ms, a hint, صحيح at 12,000 (a at 34,000); the hold by 4 × tick(250).
  const before1 = ticks(reduce(ticks(reduce(playedTo(DEFAULT, ['c0']), HINT), 50), CORRECT), 10)
  const after1 = reduce(before1, PASS)
  const before2 = reduce(reduce(ticks(reduce(after1, HINT), 30), CORRECT), tick(1_000))
  const after2 = reduce(before2, PASS)
  const before3 = ticks(reduce(reduce(ticks(after2, 20), HINT), CORRECT), 4, 250)
  const after3 = reduce(before3, PASS)

  test('the three states before the pass: the answering team, the reveal 1,000 ms old, both indices, both banks', () => {
    const shape = (s: RoomState) => [
      s.clock.active,
      s.clock.now,
      s.revealedAt,
      s.questionIndex,
      s.hintIndex,
      s.clock.banks,
    ]
    expect([before1, before2, before3].map(shape)).toStrictEqual([
      [
        'a',
        6_000,
        5_000,
        0,
        1,
        { a: { ms: 38_000, started: true }, b: { ms: FULL, started: false } },
      ],
      [
        'b',
        10_000,
        9_000,
        1,
        1,
        { a: { ms: 38_000, started: true }, b: { ms: 40_000, started: true } },
      ],
      [
        'a',
        13_000,
        12_000,
        2,
        1,
        { a: { ms: 34_000, started: true }, b: { ms: 40_000, started: true } },
      ],
    ])
  })

  test("a → b, b's first turn: b full and started, running from now; a's bank the same object", () => {
    expect(after1).toStrictEqual({
      ...before1,
      questionIndex: 1,
      hintIndex: 0,
      reveal: null,
      revealedAt: null,
      clock: {
        now: 6_000,
        active: 'b',
        runningSince: 6_000,
        banks: { a: { ms: 38_000, started: true }, b: { ms: FULL, started: true } },
      },
    })
    expect(after1.clock.banks.a).toBe(before1.clock.banks.a)
    expect(after1.clock.banks.b).not.toBe(before1.clock.banks.b)
  })

  test("b → a, a's second turn: a's part-spent bank the same object, running from now; b's the same object", () => {
    expect(after2).toStrictEqual({
      ...before2,
      questionIndex: 2,
      hintIndex: 0,
      reveal: null,
      revealedAt: null,
      clock: {
        now: 10_000,
        active: 'a',
        runningSince: 10_000,
        banks: { a: { ms: 38_000, started: true }, b: { ms: 40_000, started: true } },
      },
    })
    expect(after2.clock.banks.a).toBe(before2.clock.banks.a)
    expect(after2.clock.banks.b).toBe(before2.clock.banks.b)
  })

  test("a → b again: b's frozen bank the same object, running from now; a's the same object", () => {
    expect(after3).toStrictEqual({
      ...before3,
      questionIndex: 3,
      hintIndex: 0,
      reveal: null,
      revealedAt: null,
      clock: {
        now: 13_000,
        active: 'b',
        runningSince: 13_000,
        banks: { a: { ms: 34_000, started: true }, b: { ms: 40_000, started: true } },
      },
    })
    expect(after3.clock.banks.a).toBe(before3.clock.banks.a)
    expect(after3.clock.banks.b).toBe(before3.clock.banks.b)
  })

  test('after each pass the new team, and only it, runs: one tick(100) drains it by 100', () => {
    expect([after1, after2, after3].map((s) => left(reduce(s, tick(100))))).toStrictEqual([
      [38_000, 44_900],
      [37_900, 40_000],
      [34_000, 39_900],
    ])
  })
})

describe('REQ-4.6: a late passTurn charges nobody (R2)', () => {
  // The one place mutation N1 — anchoring the next team's clock at the
  // reveal's time plus the hold rather than at `now` — can show: a driver that
  // passes exactly on time makes the two the same number (specs.md §2.3, R2).
  const T = 3_700
  const REVEALED = reduce(ticks(playedTo(DEFAULT, ['c0']), 37), CORRECT)
  const LATE = reduce(reduce(REVEALED, tick(1_500)), PASS)

  test("correct at T, tick(1500), passTurn: b's clock runs from T + 1,500, not T + 1,000; one tick(100) leaves b 44,900", () => {
    expect(REVEALED.revealedAt).toBe(T)
    expect([LATE.clock.active, LATE.clock.runningSince, left(LATE)]).toStrictEqual([
      'b',
      T + 1_500,
      [41_300, FULL],
    ])
    expect(left(reduce(LATE, tick(100)))).toStrictEqual([41_300, FULL - 100])
  })

  test('on a later turn too: b → a passed 2,300 ms late, a resumes its frozen 41,300 exactly', () => {
    // b plays 2,000 ms of its first turn and answers at T + 3,500.
    const answered = reduce(ticks(LATE, 20), CORRECT)
    expect([answered.revealedAt, left(answered)]).toStrictEqual([T + 3_500, [41_300, 43_000]])
    const lateAgain = reduce(reduce(answered, tick(2_300)), PASS)
    expect([lateAgain.clock.active, lateAgain.clock.runningSince, left(lateAgain)]).toStrictEqual([
      'a',
      T + 5_800,
      [41_300, 43_000],
    ])
    expect(left(reduce(lateAgain, tick(100)))).toStrictEqual([41_200, 43_000])
  })
})

describe('REQ-4.6: passTurn is inert without a due reveal', () => {
  test.for(['ready', 'setup', 'roundEnd', 'match', 'play'] as const)(
    'on %s, with no reveal up, it returns the same object',
    (screen) => {
      const play = ticks(playedTo(DEFAULT, ['c0']), 10)
      const roundEnd = reduce(play, tick(FULL))
      const s = {
        ready: readyRoom(DEFAULT),
        setup: reduce(roundEnd, RESET),
        roundEnd,
        // One selected category: its round ends the match.
        match: reduce(playedTo({ ...DEFAULT, picked: ['c0'] }, ['c0']), tick(FULL)),
        play,
      }[screen]
      expect([s.screen, s.reveal, s.revealedAt]).toStrictEqual([screen, null, null])
      expect(reduce(s, PASS)).toBe(s)
    },
  )

  test('a second passTurn straight after an effective one returns the same object — a driver sending it after every tick passes the turn once', () => {
    const passed = reduce(reduce(reduce(playedTo(DEFAULT, ['c0']), CORRECT), tick(1_000)), PASS)
    expect([passed.clock.active, passed.revealedAt]).toStrictEqual(['b', null])
    expect(reduce(passed, PASS)).toBe(passed)
  })
})

describe('REQ-4.7: a round of a match is scored in the step it ends', () => {
  /** A live round whose active bank is `loser`'s: round 1, which a starts; round 2, which b starts. */
  const LIVE: Record<Team, () => RoomState> = {
    a: () => playedTo(DEFAULT, ['c0']),
    b: () => playedTo(DEFAULT, ['c0', 'c1']),
  }
  /** Each path: the lead-in that leaves the active bank exactly at its threshold, the ending action, and how far it moves engine time. */
  const PATHS = [
    ['tick', 0, tick(FULL), FULL],
    ['hint', 43_000, HINT, 0],
    ['skip', 42_000, SKIP, 0],
  ] as const
  /** The tallies and log before the round ends, and after: the winner's tally + 1 and one log entry. */
  const SCORING = {
    a: {
      before: [0, 0, []],
      after: { tallyA: 0, tallyB: 1, log: [{ n: 1, category: 'c0', winner: 'b' }] },
    },
    b: {
      before: [0, 1, [{ n: 1, category: 'c0', winner: 'b' }]],
      after: {
        tallyA: 1,
        tallyB: 1,
        log: [
          { n: 1, category: 'c0', winner: 'b' },
          { n: 2, category: 'c1', winner: 'a' },
        ],
      },
    },
  } as const
  const CASES = PATHS.flatMap(([path, leadIn, ending, advance]) =>
    (['a', 'b'] as const).map((loser) => [path, loser, leadIn, ending, advance] as const),
  )

  test('6 cases: a tick, a hint and a skip, each with team a and with team b losing', () => {
    expect(CASES).toHaveLength(6)
  })

  test.for(CASES)(
    "%s taking team %s's bank to zero: Phase 3's round end, plus the tally, the log entry and roundEnd",
    ([, loser, leadIn, ending, advance]) => {
      const before = reduce(LIVE[loser](), tick(leadIn))
      expect([
        before.screen,
        before.clock.active,
        before.tallyA,
        before.tallyB,
        before.log,
      ]).toStrictEqual(['play', loser, ...SCORING[loser].before])
      // The threshold: the whole bank for the tick, exactly the cost for a spend.
      expect(remainingMs(before.clock, loser)).toBe(FULL - leadIn)

      // Phase 3's round end: the losing bank at exactly 0, the clock stopped.
      const phase3End: RoomState = {
        ...before,
        screen: 'roundEnd',
        clock: {
          ...before.clock,
          now: before.clock.now + advance,
          runningSince: null,
          banks: { ...before.clock.banks, [loser]: { ms: 0, started: true } },
        },
      }
      expect(reduce(before, ending)).toStrictEqual({
        ...phase3End,
        ...SCORING[loser].after,
        screen: 'roundEnd',
      })
    },
  )
})

describe('REQ-4.7: a round with no category is not scored', () => {
  test.for(['a', 'b'] as const)(
    "Phase 3's startRound('%s') then tick(45,000): roundEnd, 0–0, log [] — Phase 3's round end, unchanged",
    (team) => {
      const s = reduce(createRoom(ROOM), startRound(team))
      expect(s.categoryId).toBeNull()
      const end = reduce(s, tick(45_000))
      expect(end).toStrictEqual({
        ...s,
        screen: 'roundEnd',
        clock: {
          now: 45_000,
          active: team,
          runningSince: null,
          banks: { ...s.clock.banks, [team]: { ms: 0, started: true } },
        },
      })
      expect([end.screen, end.tallyA, end.tallyB, end.log]).toStrictEqual(['roundEnd', 0, 0, []])
    },
  )

  test("in a room with a selection too: it is the round's category that counts, not the room's", () => {
    const s = reduce(readyRoom(DEFAULT), startRound('a'))
    expect([s.screen, s.categoryId]).toStrictEqual(['play', null])
    const end = reduce(s, tick(FULL))
    expect([end.screen, end.tallyA, end.tallyB, end.log]).toStrictEqual(['roundEnd', 0, 0, []])
  })
})

describe('REQ-4.8: when a match is over — and a tie is a result', () => {
  type End = readonly [round: number, tallyA: number, tallyB: number, screen: Screen]
  const endOf = (s: RoomState): End => [s.round, s.tallyA, s.tallyB, s.screen]

  test.for([2, 3, 4] as const)(
    'winsNeeded %i: roundEnd until a tally reaches it, then match — whichever team reaches it',
    (winsNeeded) => {
      // Rounds 1 … 2w − 2 silent: the team that starts each loses it, so the
      // tallies climb in turn to (w − 1)–(w − 1), with categories to spare.
      let s = reduce(readyRoom({ ...DEFAULT, winsNeeded }), startMatch('c0'))
      const ends: End[] = []
      for (let k = 1; k <= 2 * winsNeeded - 2; k += 1) {
        s = reduce(s, tick(FULL))
        ends.push(endOf(s))
        s = reduce(s, nextRound(`c${k}`))
      }
      // Round 2w − 1, live: a started it.
      expect([s.round, s.clock.active, s.tallyA, s.tallyB]).toStrictEqual([
        2 * winsNeeded - 1,
        'a',
        winsNeeded - 1,
        winsNeeded - 1,
      ])
      const bReaches = reduce(s, tick(FULL)) // a's bank empties
      const aReaches = reduce(passedByHand(s), tick(FULL)) // b's bank empties
      ends.push(endOf(bReaches), endOf(aReaches))

      expect(ends).toStrictEqual([
        ...Array.from({ length: 2 * winsNeeded - 2 }, (_, i): End => [
          i + 1,
          Math.floor((i + 1) / 2),
          Math.ceil((i + 1) / 2),
          'roundEnd',
        ]),
        [2 * winsNeeded - 1, winsNeeded - 1, winsNeeded, 'match'],
        [2 * winsNeeded - 1, winsNeeded, winsNeeded - 1, 'match'],
      ])
      expect([matchWinner(bReaches), matchWinner(aReaches)]).toStrictEqual(['b', 'a'])
    },
  )

  test('the round that uses the last unused category ends the match: at 1–1 matchWinner is null, at 2–1 a, at 1–2 b', () => {
    // Two categories, winsNeeded 3: a silent match runs out at 1–1 — a tie.
    const twoFirst = reduce(playedTo({ ...DEFAULT, picked: ['c0', 'c1'] }, ['c0']), tick(FULL))
    const tie = reduce(reduce(twoFirst, nextRound('c1')), tick(FULL))

    // Three categories: round 3 lost by a (1–2), or — after a pass — by b (2–1).
    const THREE: ReadyRoomSetup = { ...DEFAULT, picked: ['c0', 'c1', 'c2'] }
    const threeFirst = reduce(playedTo(THREE, ['c0']), tick(FULL))
    const threeSecond = reduce(playedTo(THREE, ['c0', 'c1']), tick(FULL))
    const third = playedTo(THREE, ['c0', 'c1', 'c2'])
    const bWins = reduce(third, tick(FULL))
    const aWins = reduce(passedByHand(third), tick(FULL))

    expect([twoFirst, tie, threeFirst, threeSecond, bWins, aWins].map(endOf)).toStrictEqual([
      [1, 0, 1, 'roundEnd'],
      [2, 1, 1, 'match'],
      [1, 0, 1, 'roundEnd'],
      [2, 1, 1, 'roundEnd'],
      [3, 1, 2, 'match'],
      [3, 2, 1, 'match'],
    ])
    expect([tie, aWins, bWins].map(matchWinner)).toStrictEqual([null, 'a', 'b'])
  })
})

describe('REQ-4.9: nextRound', () => {
  test("from round 1's end and round 2's: round + 1, the category set and appended, REQ-4.5's starting team, REQ-4.4's clock", () => {
    // Round 1 spends a skip and a hint, so the indices' return to 0 is visible.
    const roundOne = reduce(reduce(reduce(readyRoom(DEFAULT), startMatch('c0')), SKIP), HINT)
    const endOne = reduce(roundOne, tick(FULL))
    expect([endOne.screen, endOne.clock.now, endOne.questionIndex, endOne.hintIndex]).toStrictEqual(
      ['roundEnd', 45_000, 1, 1],
    )

    const q4 = categoryQuestions('c4')
    const roundTwo = reduce(endOne, nextRound('c4', q4))
    expect(roundTwo).toStrictEqual({
      ...endOne,
      round: 2,
      categoryId: 'c4',
      usedCategories: ['c0', 'c4'],
      screen: 'play',
      questionPool: q4,
      questionIndex: 0,
      hintIndex: 0,
      reveal: null,
      revealedAt: null,
      clock: {
        now: 45_000,
        active: 'b',
        runningSince: 45_000,
        banks: { a: { ms: 45_000, started: false }, b: { ms: 45_000, started: true } },
      },
    })

    const endTwo = reduce(roundTwo, tick(FULL))
    const q2 = categoryQuestions('c2')
    expect(reduce(endTwo, nextRound('c2', q2))).toStrictEqual({
      ...endTwo,
      round: 3,
      categoryId: 'c2',
      usedCategories: ['c0', 'c4', 'c2'],
      screen: 'play',
      questionPool: q2,
      questionIndex: 0,
      hintIndex: 0,
      reveal: null,
      revealedAt: null,
      clock: {
        now: 90_000,
        active: 'a',
        runningSince: 90_000,
        banks: { a: { ms: 45_000, started: true }, b: { ms: 45_000, started: false } },
      },
    })
  })

  /** Players; the judge at the last index; the judge after nextRound with rotation on, and off. */
  const ROTATION = [
    [0, 0, 0, 0],
    [1, 0, 0, 0],
    [2, 1, 0, 1],
    [5, 4, 0, 4],
  ] as const

  test('the judge: 8 cases — players 0, 1, 2 and 5, the judge at the last index, rotation on and off', () => {
    const results = ROTATION.flatMap(([players, judgeIndex]) =>
      [true, false].map((rotateJudge) => {
        const first = reduce(
          readyRoom({ ...DEFAULT, players, judgeIndex, rotateJudge }),
          startMatch('c0'),
        )
        const second = reduce(reduce(first, tick(FULL)), nextRound('c1'))
        return [players, rotateJudge, first.judgeIndex, second.judgeIndex]
      }),
    )
    expect(results).toStrictEqual(
      ROTATION.flatMap(([players, judgeIndex, on, off]) => [
        [players, true, judgeIndex, on],
        [players, false, judgeIndex, off],
      ]),
    )
  })

  test('the judge, away from the end: judge 2 of five becomes 3 with rotation on', () => {
    const first = reduce(
      readyRoom({ ...DEFAULT, judgeIndex: 2, rotateJudge: true }),
      startMatch('c0'),
    )
    expect(reduce(reduce(first, tick(FULL)), nextRound('c1')).judgeIndex).toBe(3)
  })

  test.for(['ready', 'setup', 'play', 'match'] as const)(
    'on %s, a well-formed nextRound returns the same object',
    (screen) => {
      const play = playedTo(DEFAULT, ['c0'])
      // One selected category: its round ends the match, and the fallback allows it again.
      const match = reduce(playedTo({ ...DEFAULT, picked: ['c0'] }, ['c0']), tick(FULL))
      const STATES = {
        ready: [readyRoom(DEFAULT), 'c0'],
        setup: [reduce(reduce(play, tick(FULL)), RESET), 'c0'],
        play: [play, 'c1'],
        match: [match, 'c0'],
      } as const
      const [s, categoryId] = STATES[screen]
      expect(s.screen).toBe(screen)
      expect(reduce(s, nextRound(categoryId))).toBe(s)
    },
  )
})

describe('REQ-4.3 / REQ-4.9: the fallback, by a hand-built state', () => {
  const PICKED = ['c3', 'c0', 'c5'] as const
  const ended = reduce(playedTo({ ...DEFAULT, picked: PICKED }, ['c3']), tick(FULL))

  /**
   * Round end with every selected category used. No action reaches it: the
   * round that uses the last category ends the match, and both ways back to a
   * draw clear the used list (requirements.md §1.1, fact 1).
   */
  const EXHAUSTED: RoomState = { ...ended, usedCategories: ['c5', 'c3', 'c0'] }

  test.for(PICKED)(
    'nextRound(%s) is accepted; the used list is unchanged — the category is not appended again',
    (categoryId) => {
      expect(EXHAUSTED.screen).toBe('roundEnd')
      const questions = categoryQuestions(categoryId)
      const next = reduce(EXHAUSTED, nextRound(categoryId, questions))
      expect(next).toStrictEqual({
        ...EXHAUSTED,
        round: 2,
        categoryId,
        screen: 'play',
        questionPool: questions,
        questionIndex: 0,
        hintIndex: 0,
        reveal: null,
        revealedAt: null,
        clock: {
          now: 45_000,
          active: 'b',
          runningSince: 45_000,
          banks: { a: { ms: 45_000, started: false }, b: { ms: 45_000, started: true } },
        },
      })
      expect(next.usedCategories).toBe(EXHAUSTED.usedCategories)
    },
  )

  test('a category outside the selection throws, naming the whole selection as the allowed list', () => {
    expect(() => reduce(EXHAUSTED, nextRound('c9'))).toThrow(RangeError)
    expect(() => reduce(EXHAUSTED, nextRound('c9'))).toThrow(
      'nextRound needs a category from [c3, c0, c5]; got c9',
    )
  })
})

describe('REQ-4.10: resetMatch — back to setup with the room intact', () => {
  /**
   * Three categories, rotation on from judge 2. Round 2 spends a skip and a
   * hint and ends on roundEnd at 1–1; round 3 runs the categories out.
   */
  const SETUP: ReadyRoomSetup = {
    ...DEFAULT,
    picked: ['c0', 'c1', 'c2'],
    rotateJudge: true,
    judgeIndex: 2,
  }
  const ROUND_END = reduce(reduce(reduce(playedTo(SETUP, ['c0', 'c1']), SKIP), HINT), tick(FULL))
  const MATCH = reduce(reduce(ROUND_END, nextRound('c2')), tick(FULL))
  const ENDED = { roundEnd: ROUND_END, match: MATCH } as const

  /** What resetMatch must leave as it was: every setup field, the clock, the pool and both indices. */
  const KEPT = [
    'roomCode',
    'config',
    'players',
    'teamA',
    'teamB',
    'judgeIndex',
    'rotateJudge',
    'pickedCategories',
    'clock',
    'questionPool',
    'questionIndex',
    'hintIndex',
  ] as const

  test('the two states, mid-match: round, tallies, log, used list, judge and indices all away from setup', () => {
    const shape = (s: RoomState) => [
      s.screen,
      s.round,
      s.tallyA,
      s.tallyB,
      s.log.length,
      s.usedCategories,
      s.judgeIndex,
      s.questionIndex,
      s.hintIndex,
    ]
    expect([shape(ROUND_END), shape(MATCH)]).toStrictEqual([
      ['roundEnd', 2, 1, 1, 2, ['c0', 'c1'], 3, 1, 1],
      ['match', 3, 1, 2, 3, ['c0', 'c1', 'c2'], 4, 0, 0],
    ])
  })

  test.for(['roundEnd', 'match'] as const)(
    'from %s: setup, round 1, 0–0, log [], used [], no category, no reveal — and the 12 kept fields the same values',
    (screen) => {
      const s = ENDED[screen]
      const reset = reduce(s, RESET)
      expect(reset).toStrictEqual({
        ...s,
        screen: 'setup',
        round: 1,
        tallyA: 0,
        tallyB: 0,
        log: [],
        usedCategories: [],
        categoryId: null,
        reveal: null,
        revealedAt: null,
      })
      expect(KEPT.filter((key) => reset[key] === s[key])).toStrictEqual([...KEPT])
    },
  )

  test('it clears a reveal: from a hand-built round end still holding one, so the clearing is visible', () => {
    const stale: RoomState = {
      ...ROUND_END,
      reveal: { answer: 'c1-a1', fact: 'c1-f1' },
      revealedAt: 12_000,
    }
    const reset = reduce(stale, RESET)
    expect([reset.screen, reset.reveal, reset.revealedAt]).toStrictEqual(['setup', null, null])
  })

  test.for(['ready', 'setup', 'play'] as const)('on %s it returns the same object', (screen) => {
    const s = {
      ready: readyRoom(SETUP),
      setup: reduce(ROUND_END, RESET),
      play: playedTo(SETUP, ['c0']),
    }[screen]
    expect(s.screen).toBe(screen)
    expect(reduce(s, RESET)).toBe(s)
  })
})
