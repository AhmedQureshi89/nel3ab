import { describe, expect, test } from 'vitest'

import { createRoom, currentQuestion } from './room.js'
import type { Question, RoomConfig, RoomState } from './types.js'

// REQ-3.1, REQ-3.2, REQ-3.6 — verification.md Gate 2. See specs/phase-3/specs.md
// §2.1 (the contract table) and §2.4 (the constructor and the current question).
//
// Every question below is synthetic. Nothing is copied from design/: the
// prototype's question content is not this package's to ship.

const ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

// --- REQ-3.1: the handoff's state contract, field for field ------------------

/**
 * specs.md §2.1's table, row for row: every name in design/README.md "State
 * Management" (rows 1–20) and both configurable values (rows 21–22), each with
 * the path that is its counterpart in `RoomState`.
 */
const CONTRACT: readonly (readonly [handoffName: string, path: readonly string[]])[] = [
  ['roomCode', ['roomCode']],
  ['players', ['players']],
  ['teamA', ['teamA']],
  ['teamB', ['teamB']],
  ['judgeIndex', ['judgeIndex']],
  ['rotateJudge', ['rotateJudge']],
  ['pickedCategories', ['pickedCategories']],
  ['usedCategories', ['usedCategories']],
  ['screen', ['screen']],
  ['round', ['round']],
  ['tallyA', ['tallyA']],
  ['tallyB', ['tallyB']],
  ['log', ['log']],
  ['categoryIndex', ['categoryId']], // renamed: it holds an id, not an index
  ['questionPool', ['questionPool']],
  ['questionIndex', ['questionIndex']],
  ['hintIndex', ['hintIndex']],
  ['banks', ['clock', 'banks']], // grouped under `clock`; `time` seconds → `ms`
  ['active', ['clock', 'active']], // grouped under `clock`
  ['reveal', ['reveal']],
  ['roundSeconds', ['config', 'roundSeconds']],
  ['winsNeeded', ['config', 'winsNeeded']],
]

/**
 * The table's three `+` rows: fields with no handoff counterpart, each with its
 * reason in §2.1 — the third, `revealedAt`, is Phase 4's (specs/phase-4/specs.md §2.1).
 */
const ADDED: readonly (readonly string[])[] = [
  ['clock', 'now'],
  ['clock', 'runningSince'],
  ['revealedAt'],
]

const TOP_LEVEL_KEYS = [
  'roomCode',
  'config',
  'players',
  'teamA',
  'teamB',
  'judgeIndex',
  'rotateJudge',
  'pickedCategories',
  'usedCategories',
  'screen',
  'round',
  'tallyA',
  'tallyB',
  'log',
  'categoryId',
  'questionPool',
  'questionIndex',
  'hintIndex',
  'clock',
  'reveal',
  'revealedAt',
]
const CLOCK_KEYS = ['now', 'active', 'runningSince', 'banks']
const CONFIG_KEYS = ['roundSeconds', 'winsNeeded']

/** Own properties only, so an inherited name such as `toString` never counts as present. */
const hasPath = (root: unknown, path: readonly string[]): boolean => {
  let node: unknown = root
  for (const key of path) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, key)) return false
    node = Reflect.get(node, key)
  }
  return true
}

/** The distinct keys one level below `prefix` among the table's paths (the `+` rows included). */
const keysAt = (prefix: readonly string[]) =>
  [
    ...new Set(
      [...CONTRACT.map(([, path]) => path), ...ADDED]
        .filter((path) => prefix.every((key, i) => path[i] === key))
        .map((path) => path[prefix.length])
        .filter((key) => key !== undefined),
    ),
  ].sort()

describe('REQ-3.1: RoomState covers the handoff contract, field for field', () => {
  test('all 22 handoff names map to a path present on a created room', () => {
    expect(CONTRACT).toHaveLength(22)
    expect(new Set(CONTRACT.map(([name]) => name)).size).toBe(22)

    const room = createRoom(ROOM)
    const unmapped = CONTRACT.filter(([, path]) => !hasPath(room, path)).map(([name]) => name)
    expect(unmapped).toStrictEqual([])
    for (const path of ADDED) expect(hasPath(room, path), path.join('.')).toBe(true)
  })

  test('the key sets are exactly 21 top-level, 4 in clock and 2 in config — no extra keys', () => {
    expect(TOP_LEVEL_KEYS).toHaveLength(21)
    expect(CLOCK_KEYS).toHaveLength(4)
    expect(CONFIG_KEYS).toHaveLength(2)

    // The expected sets are the table's own: a field added to RoomState without
    // a row in specs.md §2.1 fails here, not just a field that goes missing.
    expect(keysAt([])).toStrictEqual([...TOP_LEVEL_KEYS].sort())
    expect(keysAt(['clock'])).toStrictEqual([...CLOCK_KEYS].sort())
    expect(keysAt(['config'])).toStrictEqual([...CONFIG_KEYS].sort())

    const room = createRoom(ROOM)
    expect(Object.keys(room).sort()).toStrictEqual([...TOP_LEVEL_KEYS].sort())
    expect(Object.keys(room.clock).sort()).toStrictEqual([...CLOCK_KEYS].sort())
    expect(Object.keys(room.config).sort()).toStrictEqual([...CONFIG_KEYS].sort())
  })
})

// --- REQ-3.2: constructed valid ----------------------------------------------

describe('REQ-3.2: a room is constructed valid', () => {
  test('with only roomCode, teamA and teamB, every initial value is that of specs.md §2.4', () => {
    const expected = {
      roomCode: 'TEST01',
      config: { roundSeconds: 45, winsNeeded: 3 },
      players: [],
      teamA: 'أ',
      teamB: 'ب',
      judgeIndex: 0,
      rotateJudge: false,
      pickedCategories: [],
      usedCategories: [],
      screen: 'setup',
      round: 1,
      tallyA: 0,
      tallyB: 0,
      log: [],
      categoryId: null,
      questionPool: [],
      questionIndex: 0,
      hintIndex: 0,
      clock: {
        now: 0,
        active: 'a',
        runningSince: null,
        banks: { a: { ms: 45000, started: false }, b: { ms: 45000, started: false } },
      },
      reveal: null,
      revealedAt: null, // Phase 4 (REQ-4.11; specs/phase-4/specs.md §2.9, correction 2026-10-02)
    } satisfies RoomState

    // toStrictEqual: `null` is not `undefined`, and no key may be added or missing.
    expect(createRoom(ROOM)).toStrictEqual(expected)
  })

  test('roomCode, teamA and teamB come from the input, as given', () => {
    const room = createRoom({ roomCode: 'QZ7K2M', teamA: 'الفريق الأول', teamB: 'Team B' })
    expect([room.roomCode, room.teamA, room.teamB]).toStrictEqual([
      'QZ7K2M',
      'الفريق الأول',
      'Team B',
    ])
  })
})

describe('REQ-3.2: configuration is checked by membership, and rejected by throwing', () => {
  // Written out, not imported from rules.ts: a constant that lost or gained an
  // option must fail here rather than agree with itself.
  const ROUND_SECONDS_ACCEPTED = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]
  const ROUND_SECONDS_REJECTED = [15, 19, 21, 44, 46, 47, 95, 0, -45, 45.5, NaN]
  const WINS_NEEDED_ACCEPTED = [2, 3, 4]
  const WINS_NEEDED_REJECTED = [1, 5, 0, 3.5, NaN]

  const rejects = (config: Partial<RoomConfig>, field: keyof RoomConfig, value: number) => {
    const attempt = () => createRoom({ ...ROOM, config })
    expect(attempt).toThrow(RangeError)
    expect(attempt).toThrow(`${field} must be one of`)
    expect(attempt).toThrow(`got ${value}`)
  }

  test('the case lists are the sizes verification.md names', () => {
    expect(ROUND_SECONDS_ACCEPTED).toHaveLength(15)
    expect(ROUND_SECONDS_REJECTED).toHaveLength(11)
    expect(WINS_NEEDED_ACCEPTED).toHaveLength(3)
    expect(WINS_NEEDED_REJECTED).toHaveLength(5)
  })

  test.for(ROUND_SECONDS_ACCEPTED)(
    'roundSeconds %s is accepted, with both banks at roundSeconds × 1000',
    (roundSeconds) => {
      const room = createRoom({ ...ROOM, config: { roundSeconds } })
      expect(room.config).toStrictEqual({ roundSeconds, winsNeeded: 3 })
      expect(room.clock.banks).toStrictEqual({
        a: { ms: roundSeconds * 1000, started: false },
        b: { ms: roundSeconds * 1000, started: false },
      })
    },
  )

  test.for(ROUND_SECONDS_REJECTED)(
    'roundSeconds %s throws a RangeError naming the field and the value',
    (roundSeconds) => rejects({ roundSeconds }, 'roundSeconds', roundSeconds),
  )

  test.for(WINS_NEEDED_ACCEPTED)('winsNeeded %s is accepted', (winsNeeded) => {
    const room = createRoom({ ...ROOM, config: { winsNeeded } })
    expect(room.config).toStrictEqual({ roundSeconds: 45, winsNeeded })
  })

  test.for(WINS_NEEDED_REJECTED)(
    'winsNeeded %s throws a RangeError naming the field and the value',
    (winsNeeded) => rejects({ winsNeeded }, 'winsNeeded', winsNeeded),
  )
})

// --- REQ-3.6: the current question -------------------------------------------

const question = (n: number): Question => ({
  q: `سؤال تجريبي ${n}`,
  a: `جواب ${n}`,
  alts: [],
  h: [`تلميح ${n}-1`, `تلميح ${n}-2`],
  f: `معلومة ${n}`,
})

describe('REQ-3.6: the current question is pool[questionIndex mod poolLength]', () => {
  test('null on an empty pool — a fresh room, and at any index', () => {
    const room = createRoom(ROOM)
    expect(room.questionPool).toHaveLength(0)
    expect(currentQuestion(room)).toBeNull()
    expect(currentQuestion({ ...room, questionIndex: 4 })).toBeNull()
  })

  test('for a pool of 3, indices 0…6 give entries 0, 1, 2, 0, 1, 2, 0 — the same objects', () => {
    const room = createRoom(ROOM)
    const pool = [question(0), question(1), question(2)]
    const entries = [0, 1, 2, 3, 4, 5, 6].map((questionIndex) => {
      const current = currentQuestion({ ...room, questionPool: pool, questionIndex })
      return current === null ? -1 : pool.indexOf(current)
    })
    expect(entries).toStrictEqual([0, 1, 2, 0, 1, 2, 0])
  })
})
