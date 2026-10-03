import { describe, expect, test } from 'vitest'

import { reduce } from './reducer.js'
import { createRoom } from './room.js'
import { TEAM_NAMES } from './rules.js'
import {
  canOpenRoom,
  currentJudge,
  FILL_NAMES,
  fillPlayers,
  judgeAfterRemoval,
  shuffleTeamName,
} from './setup.js'
import { categoryQuestions } from './testing/rooms.js'
import type { Action, CategoryId, Player, RoomState, Team } from './types.js'

// Phase 5 — the setup rules: the direct boxes of specs/phase-5/verification.md
// Gate 1 (REQ-5.1 – REQ-5.6). See specs/phase-5/specs.md §2.3 (setup.ts) and
// §2.4 (the reducer's eight cases). The extractions from the prototype
// (REQ-5.8) are setup-rules.test.ts's; the sample and its invariants
// (REQ-5.7) are setup-flow.test.ts's.
//
// As in Phases 3 and 4, every expected state is written as "the previous state
// with these fields replaced", compared with `toStrictEqual`, so "nothing else
// changed" is part of each assertion; an inert action is asserted with `toBe`,
// the same object.
//
// The room below has the prototype's initial shape — five players, ماجد judging
// at index 4, eight categories picked — under ids of this test's own. It stands
// in for apps/web's `seedRoom`, which the engine cannot import. Every question
// is synthetic; nothing is copied from design/.

const PLAYERS: readonly Player[] = [
  { id: 'seed-1', name: 'ريم', team: 'a' },
  { id: 'seed-2', name: 'سعد', team: 'b' },
  { id: 'seed-3', name: 'نورة', team: 'a' },
  { id: 'seed-4', name: 'خالد', team: 'b' },
  { id: 'seed-5', name: 'ماجد', team: 'a' },
]
const PICKED: readonly CategoryId[] = [
  'industry',
  'animals',
  'nature',
  'society',
  'proverbs',
  'history',
  'religion',
  'science',
]

const room = (fields: Partial<RoomState> = {}): RoomState => ({
  ...createRoom({ roomCode: 'TEST05', teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] }),
  players: PLAYERS,
  judgeIndex: 4,
  pickedCategories: PICKED,
  ...fields,
})

const SEED = room()

const players = (...teams: readonly Team[]): readonly Player[] =>
  teams.map((team, i) => ({ id: `p${i + 1}`, name: `p${i + 1}`, team }))

const start = (state: RoomState): RoomState => {
  const [categoryId] = state.pickedCategories
  if (categoryId === undefined) throw new Error('start needs a picked category')
  return reduce(state, { type: 'startMatch', categoryId, questions: categoryQuestions(categoryId) })
}

/** One state on each of the five screens, every one holding the seed's players. */
const READY = reduce(SEED, { type: 'openRoom' })
const PLAY = start(READY)
const ROUND_END = reduce(PLAY, { type: 'tick', ms: 45_000 })
const MATCH = reduce(
  start(reduce(room({ pickedCategories: ['industry'] }), { type: 'openRoom' })),
  { type: 'tick', ms: 45_000 },
)
const SCREENS: readonly (readonly [string, RoomState])[] = [
  ['setup', SEED],
  ['ready', READY],
  ['play', PLAY],
  ['roundEnd', ROUND_END],
  ['match', MATCH],
]

test('the five screens the setup tests run on are the ones they are named after', () => {
  expect(SCREENS.map(([name, state]) => [name, state.screen])).toStrictEqual(
    SCREENS.map(([name]) => [name, name]),
  )
})

describe('REQ-5.2: removing a player keeps the right judge', () => {
  test('removing the judge (seed-5, ماجد, at 4) leaves four players and judge 3 (خالد)', () => {
    const next = reduce(SEED, { type: 'removePlayer', playerId: 'seed-5' })
    expect(next).toStrictEqual({ ...SEED, players: PLAYERS.slice(0, 4), judgeIndex: 3 })
    expect(currentJudge(next)?.name).toBe('خالد')
  })

  test('removing someone before the judge (seed-1) gives judge 3 — still ماجد', () => {
    const next = reduce(SEED, { type: 'removePlayer', playerId: 'seed-1' })
    expect(next).toStrictEqual({ ...SEED, players: PLAYERS.slice(1), judgeIndex: 3 })
    expect(currentJudge(next)?.name).toBe('ماجد')
  })

  test('removing the first player while they judge keeps judge 0 — the next player', () => {
    const judgedByFirst = room({ judgeIndex: 0 })
    const next = reduce(judgedByFirst, { type: 'removePlayer', playerId: 'seed-1' })
    expect(next).toStrictEqual({ ...judgedByFirst, players: PLAYERS.slice(1), judgeIndex: 0 })
    expect(currentJudge(next)?.name).toBe('سعد')
  })

  test('removing someone after the judge leaves the judge index alone', () => {
    const judgedBySecond = room({ judgeIndex: 1 })
    const next = reduce(judgedBySecond, { type: 'removePlayer', playerId: 'seed-4' })
    expect(next).toStrictEqual({
      ...judgedBySecond,
      players: [PLAYERS[0], PLAYERS[1], PLAYERS[2], PLAYERS[4]],
      judgeIndex: 1,
    })
  })

  test('removing the only player, judged at 0, leaves no players and judge 0', () => {
    const alone = room({ players: players('a'), judgeIndex: 0 })
    expect(reduce(alone, { type: 'removePlayer', playerId: 'p1' })).toStrictEqual({
      ...alone,
      players: [],
      judgeIndex: 0,
    })
  })

  test('an absent id returns the input', () => {
    expect(reduce(SEED, { type: 'removePlayer', playerId: 'ghost' })).toBe(SEED)
  })
})

describe('REQ-5.2: swapping a player moves them and nothing else', () => {
  test('swapping seed-1 puts ريم on team b; the other four player objects are the input’s', () => {
    const next = reduce(SEED, { type: 'swapTeam', playerId: 'seed-1' })
    expect(next).toStrictEqual({
      ...SEED,
      players: [{ ...PLAYERS[0], team: 'b' }, ...PLAYERS.slice(1)],
    })
    for (let i = 1; i < PLAYERS.length; i += 1) expect(next.players[i]).toBe(PLAYERS[i])
  })

  test('swapping a team b player moves them to a', () => {
    const next = reduce(SEED, { type: 'swapTeam', playerId: 'seed-2' })
    expect(next.players[1]).toStrictEqual({ ...PLAYERS[1], team: 'a' })
  })

  test('an absent id returns the input', () => {
    expect(reduce(SEED, { type: 'swapTeam', playerId: 'ghost' })).toBe(SEED)
  })
})

describe('REQ-5.3: renaming, the lists, and the shuffle', () => {
  test('renameTeam sets either team’s name to any text, the empty text included', () => {
    expect(reduce(SEED, { type: 'renameTeam', team: 'a', name: 'x' })).toStrictEqual({
      ...SEED,
      teamA: 'x',
    })
    expect(reduce(SEED, { type: 'renameTeam', team: 'b', name: '' })).toStrictEqual({
      ...SEED,
      teamB: '',
    })
  })

  test('renaming a team to the name it has returns the input', () => {
    expect(reduce(SEED, { type: 'renameTeam', team: 'a', name: TEAM_NAMES.a[0] })).toBe(SEED)
    expect(reduce(SEED, { type: 'renameTeam', team: 'b', name: TEAM_NAMES.b[0] })).toBe(SEED)
  })

  test('TEAM_NAMES are four names per team, and a new room’s defaults are the first of each', () => {
    expect(TEAM_NAMES).toStrictEqual({
      a: ['النمور', 'الأسود', 'الذئاب', 'النسور'],
      b: ['الصقور', 'الفهود', 'الأبطال', 'النجوم'],
    })
    expect([SEED.teamA, SEED.teamB]).toStrictEqual(['النمور', 'الصقور'])
  })

  test('shuffleTeamName: the pinned values, one call each', () => {
    const cases = [
      ['النمور', TEAM_NAMES.a, 0, 'الأسود'],
      ['النمور', TEAM_NAMES.a, 0.999, 'النسور'],
      ['الصقور', TEAM_NAMES.b, 0.5, 'الأبطال'],
      ['custom', TEAM_NAMES.a, 0, 'النمور'],
    ] as const
    for (const [current, names, r, expected] of cases) {
      let calls = 0
      const random = (): number => {
        calls += 1
        return r
      }
      expect(shuffleTeamName(current, names, random), `${current} at ${r}`).toBe(expected)
      expect(calls, `${current} at ${r}`).toBe(1)
    }
  })

  test('shuffleTeamName never returns the current name, for any listed name and value', () => {
    for (const names of [TEAM_NAMES.a, TEAM_NAMES.b]) {
      for (const current of names) {
        for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
          expect(shuffleTeamName(current, names, () => r)).not.toBe(current)
        }
      }
    }
  })

  test('shuffleTeamName throws RangeError for a value of 1, −0.1 or NaN, and when no other name exists', () => {
    for (const r of [1, -0.1, Number.NaN]) {
      expect(() => shuffleTeamName('النمور', TEAM_NAMES.a, () => r), String(r)).toThrow(RangeError)
    }
    expect(() => shuffleTeamName('النمور', ['النمور'], () => 0)).toThrow(RangeError)
  })
})

describe('REQ-5.4: the judge', () => {
  test('setJudge chooses a player by id; the current judge and an absent id return the input', () => {
    expect(reduce(SEED, { type: 'setJudge', playerId: 'seed-1' })).toStrictEqual({
      ...SEED,
      judgeIndex: 0,
    })
    expect(reduce(SEED, { type: 'setJudge', playerId: 'seed-5' })).toBe(SEED)
    expect(reduce(SEED, { type: 'setJudge', playerId: 'ghost' })).toBe(SEED)
  })

  test('setRotateJudge sets the flag; setting it to what it is returns the input', () => {
    const on = reduce(SEED, { type: 'setRotateJudge', rotate: true })
    expect(on).toStrictEqual({ ...SEED, rotateJudge: true })
    expect(reduce(on, { type: 'setRotateJudge', rotate: false })).toStrictEqual(SEED)
    expect(reduce(SEED, { type: 'setRotateJudge', rotate: false })).toBe(SEED)
  })

  test('currentJudge: ماجد on the seed; null with no players; the index taken modulo the players', () => {
    expect(currentJudge(SEED)).toBe(PLAYERS[4])
    expect(currentJudge(room({ players: [], judgeIndex: 0 }))).toBeNull()
    expect(currentJudge(room({ judgeIndex: 7 }))).toBe(PLAYERS[2]) // نورة
  })

  test('currentJudge falls back to the first player when the index names nobody', () => {
    expect(currentJudge(room({ judgeIndex: -1 }))).toBe(PLAYERS[0])
  })
})

describe('REQ-5.5: categories keep the order they were picked in', () => {
  test('unpicking the first and picking it again puts it last', () => {
    const without = reduce(SEED, { type: 'pickCategory', categoryId: 'industry', picked: false })
    expect(without).toStrictEqual({ ...SEED, pickedCategories: PICKED.slice(1) })
    expect(
      reduce(without, { type: 'pickCategory', categoryId: 'industry', picked: true }),
    ).toStrictEqual({ ...SEED, pickedCategories: [...PICKED.slice(1), 'industry'] })
  })

  test('the engine records any category — a tile the screen shows as locked included', () => {
    expect(
      reduce(SEED, { type: 'pickCategory', categoryId: 'culture', picked: true }),
    ).toStrictEqual({ ...SEED, pickedCategories: [...PICKED, 'culture'] })
  })

  test('picking a picked category, or unpicking an unpicked one, returns the input', () => {
    expect(reduce(SEED, { type: 'pickCategory', categoryId: 'industry', picked: true })).toBe(SEED)
    expect(reduce(SEED, { type: 'pickCategory', categoryId: 'culture', picked: false })).toBe(SEED)
  })
})

describe('REQ-5.6: opening the room, the guard, the fill, and going back', () => {
  test('openRoom on the seed gives ready with the same players array', () => {
    const ready = reduce(SEED, { type: 'openRoom' })
    expect(ready).toStrictEqual({ ...SEED, screen: 'ready' })
    expect(ready.players).toBe(SEED.players)
  })

  test('with nothing picked, openRoom returns the input and canOpenRoom is false', () => {
    const empty = room({ pickedCategories: [] })
    expect(reduce(empty, { type: 'openRoom' })).toBe(empty)
    expect(canOpenRoom(empty)).toBe(false)
    expect(canOpenRoom(SEED)).toBe(true)
    expect(canOpenRoom(READY)).toBe(false)
  })

  test('the fill, through openRoom: 0 players, 1 player, three on a, fill-1 and fill-2 both on a', () => {
    const open = (list: readonly Player[]): readonly Player[] =>
      reduce(room({ players: list, judgeIndex: 0 }), { type: 'openRoom' }).players
    const fill = (id: string, team: Team): Player => ({ id, name: FILL_NAMES[team], team })

    expect(open([])).toStrictEqual([fill('fill-1', 'a'), fill('fill-2', 'b')])
    expect(open(players('a'))).toStrictEqual([fill('fill-1', 'a'), fill('fill-2', 'b')])
    expect(open(players('a', 'a', 'a'))).toStrictEqual([
      ...players('a', 'a', 'a'),
      fill('fill-1', 'b'),
    ])
    expect(open([fill('fill-1', 'a'), fill('fill-2', 'a')])).toStrictEqual([
      fill('fill-1', 'a'),
      fill('fill-2', 'a'),
      fill('fill-3', 'b'),
    ])
  })

  test('the fill gives a team b with nobody on a its "لاعب ١"', () => {
    expect(fillPlayers(players('b', 'b'))).toStrictEqual([
      ...players('b', 'b'),
      { id: 'fill-1', name: 'لاعب ١', team: 'a' },
    ])
  })

  test('FILL_NAMES are "لاعب ١" and "لاعب ٢"', () => {
    expect(FILL_NAMES).toStrictEqual({ a: 'لاعب ١', b: 'لاعب ٢' })
  })

  test('backToSetup on ready changes the screen only; elsewhere it returns the input', () => {
    expect(reduce(READY, { type: 'backToSetup' })).toStrictEqual({ ...READY, screen: 'setup' })
    for (const [name, state] of SCREENS) {
      if (name !== 'ready') expect(reduce(state, { type: 'backToSetup' }), name).toBe(state)
    }
  })

  test('openRoom returns the input on every screen but setup', () => {
    for (const [name, state] of SCREENS) {
      if (name !== 'setup') expect(reduce(state, { type: 'openRoom' }), name).toBe(state)
    }
  })
})

describe('REQ-5.1: setup only, and validation first', () => {
  const EFFECTIVE: readonly Action[] = [
    { type: 'removePlayer', playerId: 'seed-1' },
    { type: 'swapTeam', playerId: 'seed-1' },
    { type: 'renameTeam', team: 'a', name: 'x' },
    { type: 'setJudge', playerId: 'seed-1' },
    { type: 'setRotateJudge', rotate: true },
    { type: 'pickCategory', categoryId: 'culture', picked: true },
  ]

  test('each edit takes effect on setup', () => {
    for (const action of EFFECTIVE) expect(reduce(SEED, action), action.type).not.toBe(SEED)
  })

  test('each edit returns its input on ready, play, roundEnd and match', () => {
    for (const [name, state] of SCREENS) {
      if (name === 'setup') continue
      for (const action of EFFECTIVE)
        expect(reduce(state, action), `${action.type} on ${name}`).toBe(state)
    }
  })

  const MALFORMED: readonly (readonly [string, unknown])[] = [
    ['removePlayer playerId 7', { type: 'removePlayer', playerId: 7 }],
    ['removePlayer playerId {}', { type: 'removePlayer', playerId: {} }],
    ['removePlayer playerId undefined', { type: 'removePlayer', playerId: undefined }],
    ['swapTeam playerId 7', { type: 'swapTeam', playerId: 7 }],
    ['setJudge playerId undefined', { type: 'setJudge', playerId: undefined }],
    ["renameTeam team 'c'", { type: 'renameTeam', team: 'c', name: 'x' }],
    ['renameTeam name null', { type: 'renameTeam', team: 'b', name: null }],
    ["setRotateJudge rotate 'yes'", { type: 'setRotateJudge', rotate: 'yes' }],
    ['pickCategory categoryId 3', { type: 'pickCategory', categoryId: 3, picked: true }],
    ['pickCategory picked 1', { type: 'pickCategory', categoryId: 'industry', picked: 1 }],
  ]

  test('each malformed form throws RangeError on all five screens', () => {
    for (const [name, state] of SCREENS) {
      for (const [label, action] of MALFORMED) {
        expect(() => reduce(state, action as Action), `${label} on ${name}`).toThrow(RangeError)
      }
    }
  })
})

test('judgeAfterRemoval is the prototype’s line at its three boundaries', () => {
  expect(judgeAfterRemoval(4, 4)).toBe(3) // the judge removed
  expect(judgeAfterRemoval(0, 0)).toBe(0) // the first, judging, removed
  expect(judgeAfterRemoval(1, 3)).toBe(1) // someone after the judge removed
})
