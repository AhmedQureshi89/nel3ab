import { describe, expect, test } from 'vitest'

import { displaySeconds, remainingMs } from './clock.js'
import { reduce } from './reducer.js'
import { acceptsJudgeActions, createRoom, currentQuestion } from './room.js'
import type { Action, Question, RoomState, Team } from './types.js'

// REQ-3.3 – REQ-3.8 — the direct boxes of verification.md Gates 3 and 4. See
// specs/phase-3/specs.md §2.5 (the reducer's table) and §2.4 (`liveQuestion`,
// `acceptsJudgeActions`).
//
// Every round here is driven the way a driver plays one — one reducer step per
// `tick(100)` — and every expected state is written as "the previous state with
// these fields replaced", compared with `toStrictEqual`, so "nothing else
// changed" is part of each assertion rather than a separate claim.
//
// Every question below is synthetic. Nothing is copied from design/: the
// prototype's question content is not this package's to ship.

const ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

const question = (n: number, hints = 2): Question => ({
  q: `سؤال تجريبي ${n}`,
  a: `جواب ${n}`,
  alts: [],
  h: [`تلميح ${n}-1`, `تلميح ${n}-2`].slice(0, hints),
  f: `معلومة ${n}`,
})

const Q0 = question(0)
const Q1 = question(1)
const Q2 = question(2)
/** Three questions with two hints each — every question in the prototype's dataset has exactly two. */
const POOL: readonly [Question, ...Question[]] = [Q0, Q1, Q2]

const tick = (ms: number): Action => ({ type: 'tick', ms })
const HINT: Action = { type: 'hint' }
const SKIP: Action = { type: 'skip' }
const CORRECT: Action = { type: 'correct' }
const startRound = (
  startingTeam: Team,
  questions: readonly [Question, ...Question[]] = POOL,
): Action => ({ type: 'startRound', startingTeam, questions })

/** A malformed action. The type system rightly refuses it; it is asserted into shape only to prove the reducer refuses it too. */
const malformed = (action: object): Action => action as Action

/** `n` steps of `tick(ms)`, one reducer call each. */
const ticks = (state: RoomState, n: number, ms = 100): RoomState => {
  let s = state
  for (let i = 0; i < n; i += 1) s = reduce(s, tick(ms))
  return s
}

/** A fresh 45 s room with a round started by `team` at engine time 0. */
const started = (
  team: Team = 'a',
  questions: readonly [Question, ...Question[]] = POOL,
): RoomState => reduce(createRoom(ROOM), startRound(team, questions))

/** What the active team has left. */
const left = (s: RoomState): number => remainingMs(s.clock, s.clock.active)

const otherTeam = (team: Team): Team => (team === 'a' ? 'b' : 'a')

// ============================================================================
// verification.md Gate 3 — the clock
// ============================================================================

describe('REQ-3.5: starting a round', () => {
  test.for([
    ['a', { a: true, b: false }],
    ['b', { a: false, b: true }],
  ] as const)(
    "startRound('%s') from a fresh room at now 0: play, running from 0, both banks full",
    ([team, isStarted]) => {
      const room = createRoom(ROOM)
      const s = reduce(room, startRound(team))

      // One toStrictEqual over all 20 top-level fields: every field not
      // replaced here — round, the tallies, log, categoryId, usedCategories
      // among them — is asserted unchanged.
      expect(s).toStrictEqual({
        ...room,
        screen: 'play',
        questionPool: POOL,
        questionIndex: 0,
        hintIndex: 0,
        reveal: null,
        clock: {
          now: 0,
          active: team,
          runningSince: 0,
          banks: {
            a: { ms: 45_000, started: isStarted.a },
            b: { ms: 45_000, started: isStarted.b },
          },
        },
      })
      // The value zero — not null, not "falsy but fine". toBe is Object.is.
      expect(s.clock.runningSince).toBe(0)
      expect(s.questionPool).toBe(POOL)

      // The round started at engine time zero really runs: one tick drains it,
      // and the judge may act in it.
      const after = reduce(s, tick(100))
      expect(remainingMs(after.clock, team)).toBe(44_900)
      expect(remainingMs(after.clock, otherTeam(team))).toBe(45_000)
      expect(acceptsJudgeActions(after)).toBe(true)
    },
  )

  test('from a later round: runs from the current engine time and leaves Phase 4’s fields alone', () => {
    const room = createRoom({ ...ROOM, config: { roundSeconds: 20 } })
    const ended: RoomState = {
      ...room,
      screen: 'roundEnd',
      round: 2,
      tallyA: 1,
      tallyB: 0,
      log: [{ n: 1, category: 'cat-1', winner: 'a' }],
      categoryId: 'cat-1',
      usedCategories: ['cat-1'],
      questionPool: [question(9)],
      questionIndex: 5,
      hintIndex: 1,
      clock: {
        now: 60_000,
        active: 'b',
        runningSince: null,
        banks: { a: { ms: 12_000, started: true }, b: { ms: 0, started: true } },
      },
    }

    const s = reduce(ended, startRound('a'))
    expect(s).toStrictEqual({
      ...ended,
      screen: 'play',
      questionPool: POOL,
      questionIndex: 0,
      hintIndex: 0,
      reveal: null,
      clock: {
        now: 60_000,
        active: 'a',
        runningSince: 60_000,
        // roundSeconds 20 → 20,000 ms: the unit is milliseconds, not seconds.
        banks: { a: { ms: 20_000, started: true }, b: { ms: 20_000, started: false } },
      },
    })
    expect(remainingMs(reduce(s, tick(100)).clock, 'a')).toBe(19_900)
  })
})

describe('REQ-3.5 / REQ-3.3: start is inert in play; a malformed start throws', () => {
  test('startRound while in play returns the same object — live, and with a reveal up', () => {
    const live = ticks(started('a'), 10)
    expect(reduce(live, startRound('b'))).toBe(live)
    expect(reduce(live, startRound('a', [question(7)]))).toBe(live)

    const revealUp = reduce(live, CORRECT)
    expect([revealUp.screen, revealUp.reveal === null]).toStrictEqual(['play', false])
    expect(reduce(revealUp, startRound('b'))).toBe(revealUp)
  })

  const BAD_STARTS: readonly (readonly [label: string, action: Action, message: string])[] = [
    [
      'questions: []',
      malformed({ type: 'startRound', startingTeam: 'a', questions: [] }),
      'got an empty array',
    ],
    [
      "startingTeam: 'c'",
      malformed({ type: 'startRound', startingTeam: 'c', questions: POOL }),
      "startingTeam 'a' or 'b'; got c",
    ],
    ['questions: undefined', malformed({ type: 'startRound', startingTeam: 'a' }), 'got undefined'],
  ]
  const CASES = (['setup', 'play'] as const).flatMap((screen) =>
    BAD_STARTS.map(([label, action, message]) => [screen, label, action, message] as const),
  )

  // Validation precedes inertness: the same malformed start throws in `play`,
  // where a well-formed one would be inert.
  test.for(CASES)(
    'in %s, startRound with %s throws a RangeError',
    ([screen, , action, message]) => {
      const s = screen === 'setup' ? createRoom(ROOM) : started('a')
      expect(s.screen).toBe(screen)
      expect(() => reduce(s, action)).toThrow(RangeError)
      expect(() => reduce(s, action)).toThrow(message)
    },
  )
})

describe('REQ-3.4: only the active bank drains', () => {
  test.for(['a', 'b'] as const)(
    'team %s started: after k × tick(100), k = 1 … 449, it has 45,000 − 100k and the other bank is untouched',
    (team) => {
      const start = started(team)
      const other = otherTeam(team)
      const initialOther = start.clock.banks[other]

      let s = start
      let checked = 0
      let inactiveChanges = 0
      const mismatches: (readonly [k: number, got: number])[] = []
      for (let k = 1; k <= 449; k += 1) {
        s = reduce(s, tick(100))
        checked += 1
        const got = remainingMs(s.clock, team)
        if (got !== 45_000 - 100 * k) mismatches.push([k, got])
        const bank = s.clock.banks[other]
        if (
          bank.ms !== initialOther.ms ||
          bank.started !== initialOther.started ||
          remainingMs(s.clock, other) !== 45_000
        ) {
          inactiveChanges += 1
        }
      }

      expect({
        checked,
        mismatches: mismatches.length,
        first: mismatches.slice(0, 5),
        inactiveChanges,
      }).toStrictEqual({ checked: 449, mismatches: 0, first: [], inactiveChanges: 0 })
      expect(s.screen).toBe('play')
    },
  )
})

describe('REQ-3.4 / REQ-3.7: a tick that crosses zero ends the round in the same step', () => {
  test.for([
    ['a', 45_000],
    ['a', 45_001],
    ['b', 45_000],
    ['b', 45_001],
  ] as const)('team %s: one tick(%s) — roundEnd, bank 0, clock stopped', ([team, ms]) => {
    const s = started(team)
    expect(reduce(s, tick(ms))).toStrictEqual({
      ...s,
      screen: 'roundEnd',
      clock: {
        now: ms,
        active: team,
        runningSince: null,
        banks: { ...s.clock.banks, [team]: { ms: 0, started: true } },
      },
    })
  })

  test('one tick(44999) leaves a live round with 1ms, which the clock shows as 1', () => {
    const s = started('a')
    const live = reduce(s, tick(44_999))
    expect(live).toStrictEqual({ ...s, clock: { ...s.clock, now: 44_999 } })
    expect(left(live)).toBe(1)
    expect(displaySeconds(left(live))).toBe(1)
  })
})

describe('REQ-3.3: malformed ticks throw in every state; a zero tick is inert', () => {
  // Each state has advanced past engine time 0, so that "now + ms is not a safe
  // integer" can be reached by an ms that is itself a safe integer.
  const STATES = {
    setup: () => ticks(createRoom(ROOM), 1),
    play: () => ticks(started('a'), 1),
    roundEnd: () => reduce(started('a'), tick(45_000)),
  } as const

  const BAD: readonly (readonly [label: string, ms: (s: RoomState) => number])[] = [
    ['-1', () => -1],
    ['1.5', () => 1.5],
    ['NaN', () => NaN],
    ['Infinity', () => Infinity],
    ['2 ** 53', () => 2 ** 53],
    ['MAX_SAFE_INTEGER − now + 1', (s) => Number.MAX_SAFE_INTEGER - s.clock.now + 1],
  ]
  const CASES = (['setup', 'play', 'roundEnd'] as const).flatMap((screen) =>
    BAD.map(([label, ms]) => [screen, label, ms] as const),
  )

  test('6 bad values × 3 states = 18 cases', () => {
    expect(CASES).toHaveLength(18)
  })

  test.for(CASES)('in %s, tick(%s) throws a RangeError', ([screen, , msOf]) => {
    const s = STATES[screen]()
    expect(s.screen).toBe(screen)
    expect(s.clock.now).toBeGreaterThan(0)
    const ms = msOf(s)
    expect(() => reduce(s, tick(ms))).toThrow(RangeError)
    expect(() => reduce(s, tick(ms))).toThrow(`got ${ms}`)
  })

  test('the last case isolates the engine-time check: its ms is itself a non-negative safe integer', () => {
    const s = STATES.play()
    const ms = Number.MAX_SAFE_INTEGER - s.clock.now + 1
    expect(Number.isSafeInteger(ms) && ms >= 0).toBe(true)
    expect(Number.isSafeInteger(s.clock.now + ms)).toBe(false)
  })

  test.for(['setup', 'play', 'roundEnd'] as const)(
    'in %s, tick(0) returns the same object',
    (screen) => {
      const s = STATES[screen]()
      expect(reduce(s, tick(0))).toBe(s)
    },
  )

  test('with a reveal up, tick(0) returns the same object', () => {
    const s = reduce(ticks(started('a'), 10), CORRECT)
    expect(s.reveal).not.toBeNull()
    expect(reduce(s, tick(0))).toBe(s)
  })
})

describe('REQ-3.4: a stopped clock drains nothing', () => {
  const STOPPED = {
    setup: () => createRoom(ROOM),
    roundEnd: () => reduce(started('a'), tick(45_000)),
    reveal: () => reduce(ticks(started('a'), 37), CORRECT),
  } as const

  test.for(['setup', 'roundEnd', 'reveal'] as const)(
    'in %s, 50 × tick(100) and one tick(1,000,000) advance only clock.now',
    (name) => {
      const s = STOPPED[name]()
      expect(s.clock.runningSince).toBeNull()

      const after = reduce(ticks(s, 50), tick(1_000_000))
      expect(after).toStrictEqual({ ...s, clock: { ...s.clock, now: s.clock.now + 1_005_000 } })
      expect(after.clock.banks).toStrictEqual(s.clock.banks)
      expect([remainingMs(after.clock, 'a'), remainingMs(after.clock, 'b')]).toStrictEqual([
        remainingMs(s.clock, 'a'),
        remainingMs(s.clock, 'b'),
      ])
    },
  )
})

// ============================================================================
// verification.md Gate 4 — the judge's actions
// ============================================================================

describe('REQ-3.6: hint', () => {
  test('in a live round, drains exactly 2,000ms and advances hintIndex by one', () => {
    const s = ticks(started('a'), 37) // 41,300 left at now 3,700, running since 0
    const h = reduce(s, HINT)
    expect(h).toStrictEqual({
      ...s,
      hintIndex: 1,
      clock: {
        ...s.clock,
        runningSince: 3_700,
        banks: { ...s.clock.banks, a: { ms: 39_300, started: true } },
      },
    })
    expect(left(s) - left(h)).toBe(2_000)
  })

  test('on a two-hint question, the third hint returns the same object and costs nothing', () => {
    const two = reduce(reduce(started('a'), HINT), HINT)
    expect([two.hintIndex, left(two)]).toStrictEqual([2, 41_000])
    expect(currentQuestion(two)).toBe(Q0)
    expect(reduce(two, HINT)).toBe(two)
  })

  test('on a question with no hints, the first hint returns the same object', () => {
    const s = ticks(started('a', [question(0, 0), Q1]), 10)
    expect(currentQuestion(s)?.h).toStrictEqual([])
    expect(reduce(s, HINT)).toBe(s)
  })
})

describe('REQ-3.6: skip', () => {
  test('in a live round, drains exactly 3,000ms, advances questionIndex and resets hintIndex', () => {
    // A hint first (so hintIndex is 1 and runningSince 3,700), then 13 more ticks.
    const s = ticks(reduce(ticks(started('a'), 37), HINT), 13) // 38,000 left at now 5,000
    expect([s.hintIndex, s.clock.runningSince, left(s)]).toStrictEqual([1, 3_700, 38_000])

    const k = reduce(s, SKIP)
    expect(k).toStrictEqual({
      ...s,
      questionIndex: 1,
      hintIndex: 0,
      clock: {
        ...s.clock,
        runningSince: 5_000,
        banks: { ...s.clock.banks, a: { ms: 35_000, started: true } },
      },
    })
    expect(left(s) - left(k)).toBe(3_000)
  })

  test('on a pool of three, the third skip makes the current question the first entry again', () => {
    let s = started('a')
    const seen: (Question | null)[] = [currentQuestion(s)]
    for (let i = 0; i < 3; i += 1) {
      s = reduce(s, SKIP)
      seen.push(currentQuestion(s))
    }
    expect(s.questionIndex).toBe(3)
    expect(seen.map((q) => (q === null ? -1 : POOL.indexOf(q)))).toStrictEqual([0, 1, 2, 0])
    expect(currentQuestion(s)).toBe(Q0)
  })
})

describe('REQ-3.4 / REQ-3.6: a spend re-anchors the clock', () => {
  test.for([
    ['hint', 23_000, HINT],
    ['skip', 22_000, SKIP],
  ] as const)(
    '100 × tick(100), %s, 100 × tick(100) leaves exactly %s ms',
    ([, expected, spend]) => {
      const s = ticks(reduce(ticks(started('a'), 100), spend), 100)
      expect(s.screen).toBe('play')
      expect(s.clock.now).toBe(20_000)
      expect(left(s)).toBe(expected)
    },
  )
})

describe('REQ-3.7: exactly zero, past zero, and one millisecond above', () => {
  /** The same state, ended: the active bank at 0, the clock stopped, the screen at roundEnd. */
  const endedFrom = (s: RoomState): RoomState => ({
    ...s,
    screen: 'roundEnd',
    clock: {
      ...s.clock,
      runningSince: null,
      banks: { ...s.clock.banks, [s.clock.active]: { ms: 0, started: true } },
    },
  })

  test('skip with exactly 3,000ms left ends the round in that step; questionIndex unchanged', () => {
    const s = reduce(reduce(started('a'), SKIP), tick(39_000))
    expect([left(s), s.questionIndex]).toStrictEqual([3_000, 1])
    expect(reduce(s, SKIP)).toStrictEqual(endedFrom(s))
  })

  test('hint with exactly 2,000ms left ends the round in that step; hintIndex unchanged', () => {
    const s = reduce(reduce(started('a'), HINT), tick(41_000))
    expect([left(s), s.hintIndex]).toStrictEqual([2_000, 1])
    expect(reduce(s, HINT)).toStrictEqual(endedFrom(s))
  })

  test('skip with 1,000ms left ends the round with the bank at 0, not −2,000', () => {
    const s = reduce(started('a'), tick(44_000))
    expect(left(s)).toBe(1_000)
    const end = reduce(s, SKIP)
    expect(end).toStrictEqual(endedFrom(s))
    expect(end.clock.banks.a.ms).toBe(0)
  })

  test('hint with 1,000ms left ends the round with the bank at 0, not −1,000', () => {
    const s = reduce(started('a'), tick(44_000))
    expect(reduce(s, HINT)).toStrictEqual(endedFrom(s))
  })

  test('skip with 3,001ms left leaves a live round with 1ms, which the clock shows as 1', () => {
    const s = reduce(started('a'), tick(41_999))
    const k = reduce(s, SKIP)
    expect([k.screen, k.questionIndex, left(k)]).toStrictEqual(['play', 1, 1])
    expect(displaySeconds(left(k))).toBe(1)
  })

  test('with team b active, the round ends on b’s bank and a’s is untouched', () => {
    const s = reduce(started('b'), tick(42_000))
    const end = reduce(s, SKIP)
    expect(end).toStrictEqual(endedFrom(s))
    expect([end.clock.active, end.clock.banks.a]).toStrictEqual([
      'b',
      { ms: 45_000, started: false },
    ])
  })
})

describe('REQ-3.8: correct raises the reveal and stops the clock', () => {
  test('the reveal is the current question’s answer and fact; the bank is settled; nothing else changes', () => {
    // A skip first, so the current question is Q1 — not merely the first in the pool.
    const s = ticks(reduce(started('a'), SKIP), 37) // 38,300 left at now 3,700
    expect([currentQuestion(s), left(s)]).toStrictEqual([Q1, 38_300])

    const c = reduce(s, CORRECT)
    expect(c).toStrictEqual({
      ...s,
      reveal: { answer: Q1.a, fact: Q1.f },
      revealedAt: 3_700, // Phase 4 (REQ-4.6, REQ-4.11): the engine time the reveal went up
      clock: {
        ...s.clock,
        runningSince: null,
        banks: { ...s.clock.banks, a: { ms: 38_300, started: true } },
      },
    })

    // 1,000 × tick(100) during the reveal drain nothing and advance now by 100,000.
    const after = ticks(c, 1_000)
    expect(after).toStrictEqual({ ...c, clock: { ...c.clock, now: c.clock.now + 100_000 } })
    expect([left(after), remainingMs(after.clock, 'b')]).toStrictEqual([38_300, 45_000])
  })
})

describe('REQ-3.8: hint, skip and correct are inert during a reveal and with the clock stopped', () => {
  const STATES = {
    // (a) a reveal, produced by `correct` — a double-tapped correct scores nothing twice
    reveal: () => reduce(ticks(started('a'), 10), CORRECT),
    // (b) no round in play
    setup: () => createRoom(ROOM),
    // (c) the round has ended
    roundEnd: () => reduce(started('a'), tick(45_000)),
    // (d) hand-built, no action produces it: a RUNNING clock and a reveal. After
    // a hint, so the clock runs since 1,000 (not 0) and a hint remains —
    // only liveQuestion's third condition can make these inert.
    'running clock with a reveal (hand-built)': () => ({
      ...reduce(ticks(started('a'), 10), HINT),
      reveal: { answer: Q0.a, fact: Q0.f },
    }),
    // (e) hand-built: a running round in play with an empty pool
    'play with an empty pool (hand-built)': () => ({
      ...ticks(started('a'), 10),
      questionPool: [],
    }),
  } as const satisfies Record<string, () => RoomState>

  const NAMES = Object.keys(STATES) as (keyof typeof STATES)[]
  const ACTIONS = [
    ['hint', HINT],
    ['skip', SKIP],
    ['correct', CORRECT],
  ] as const
  const CASES = NAMES.flatMap((name) =>
    ACTIONS.map(([label, action]) => [name, label, action] as const),
  )

  test('3 actions × 5 states = 15 cases, and the two hand-built states are what they claim', () => {
    expect(CASES).toHaveLength(15)
    const d = STATES['running clock with a reveal (hand-built)']()
    expect([d.screen, d.clock.runningSince, d.reveal === null, d.hintIndex]).toStrictEqual([
      'play',
      1_000,
      false,
      1,
    ])
    const e = STATES['play with an empty pool (hand-built)']()
    expect([e.screen, e.clock.runningSince, e.reveal, e.questionPool]).toStrictEqual([
      'play',
      0,
      null,
      [],
    ])
  })

  test.for(CASES)('%s: %s returns the same object', ([name, , action]) => {
    const s = STATES[name]()
    expect(reduce(s, action)).toBe(s)
  })

  test.for(NAMES)('%s: acceptsJudgeActions is false', (name) => {
    expect(acceptsJudgeActions(STATES[name]())).toBe(false)
  })

  test('control: in a live round, acceptsJudgeActions is true and all three actions take effect', () => {
    const live = ticks(started('a'), 10)
    expect(acceptsJudgeActions(live)).toBe(true)
    for (const [, action] of ACTIONS) expect(reduce(live, action)).not.toBe(live)
  })
})

describe('REQ-3.3: an unknown action type throws, in every state', () => {
  test.for(['setup', 'play', 'roundEnd'] as const)('in %s, a TypeError', (screen) => {
    const s =
      screen === 'setup'
        ? createRoom(ROOM)
        : screen === 'play'
          ? started('a')
          : reduce(started('a'), tick(45_000))
    expect(s.screen).toBe(screen)
    const bogus = malformed({ type: 'bogus' })
    expect(() => reduce(s, bogus)).toThrow(TypeError)
    expect(() => reduce(s, bogus)).toThrow('unknown action type: bogus')
  })
})
