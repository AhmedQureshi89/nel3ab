import { canOpenRoom, createRoom, currentJudge, reduce, TEAM_NAMES } from '@nel3ab/game'
import type { RoomState } from '@nel3ab/game'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { CATALOG, catalogEntry } from './catalog'
import { SEED_JUDGE_INDEX, SEED_PICKED, SEED_PLAYERS, seedRoom } from './seed'

// REQ-5.10 — specs/phase-5/verification.md Gate 4, "The seed". See specs.md §2.9 (`seed.ts`) and
// §2.12 (this file's row: `seedRoom` field for field; Phase 4's J8 and this phase's K1–K4 shapes
// hold on it).
//
// The expected room below is written out in full — all twenty-one fields of `RoomState` — so the
// seed is pinned field for field rather than through `createRoom`, which the second test checks
// separately. That this room is the prototype's own initial `state`, read from
// design/designs/Nel3ab - Arcade.dc.html at run time, is REQ-5.22's extraction W6
// (host-prototype.test.ts).
//
// J8 and K1–K4 are re-stated here as shapes over the room rather than imported: their
// implementations live in packages/game/src/testing/, test support that is never exported from
// @nel3ab/game (specs.md §2.6), and apps/web reaches the engine only through its public surface.

afterEach(() => {
  vi.restoreAllMocks()
})

/** The seed's eight picked categories, by name, in the prototype's order. */
const FREE_TILE_NAMES = [
  'صناعة',
  'حيوانات',
  'طبيعة',
  'إنسان ومجتمع',
  'أمثال',
  'تاريخ',
  'دين',
  'علوم',
]

/**
 * Phase 4's J8 and this phase's K1–K4 (specs/phase-4/specs.md §2.10; specs.md §2.6), as shapes of
 * one room: the ids of those that do NOT hold, in table order. K5 compares two consecutive states
 * of a match and has no shape on a single room.
 */
function violatedShapes(state: RoomState): string[] {
  const violated: string[] = []
  const { screen, players, pickedCategories } = state
  if (!(state.judgeIndex >= 0 && state.judgeIndex < Math.max(1, players.length))) {
    violated.push('J8')
  }
  if (
    (screen === 'setup' || screen === 'ready') &&
    !(
      state.round === 1 &&
      state.tallyA === 0 &&
      state.tallyB === 0 &&
      state.log.length === 0 &&
      state.usedCategories.length === 0 &&
      state.categoryId === null &&
      state.reveal === null &&
      state.revealedAt === null
    )
  ) {
    violated.push('K1')
  }
  if (new Set(pickedCategories).size !== pickedCategories.length) violated.push('K2')
  if (new Set(players.map((player) => player.id)).size !== players.length) violated.push('K3')
  if (
    screen === 'ready' &&
    !(
      pickedCategories.length > 0 &&
      players.length >= 2 &&
      players.some((player) => player.team === 'a') &&
      players.some((player) => player.team === 'b')
    )
  ) {
    violated.push('K4')
  }
  return violated
}

describe('REQ-5.10: the seed', () => {
  test("seedRoom('SKZJ62') is the prototype's initial room, field for field", () => {
    expect(seedRoom('SKZJ62')).toStrictEqual({
      roomCode: 'SKZJ62',
      config: { roundSeconds: 45, winsNeeded: 3 },
      players: [
        { id: 'seed-1', name: 'ريم', team: 'a' },
        { id: 'seed-2', name: 'سعد', team: 'b' },
        { id: 'seed-3', name: 'نورة', team: 'a' },
        { id: 'seed-4', name: 'خالد', team: 'b' },
        { id: 'seed-5', name: 'ماجد', team: 'a' },
      ],
      teamA: 'النمور',
      teamB: 'الصقور',
      judgeIndex: 4,
      rotateJudge: false,
      pickedCategories: [
        'industry',
        'animals',
        'nature',
        'society',
        'proverbs',
        'history',
        'religion',
        'science',
      ],
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
        banks: { a: { ms: 45_000, started: false }, b: { ms: 45_000, started: false } },
      },
      reveal: null,
      revealedAt: null,
    })
    expect(Object.keys(seedRoom('SKZJ62'))).toHaveLength(21)
  })

  test("it is createRoom's room with the first of each TEAM_NAMES, and exactly three fields replaced", () => {
    const room = seedRoom('SKZJ62')
    const base = createRoom({ roomCode: 'SKZJ62', teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] })
    expect(room).toStrictEqual({
      ...base,
      players: SEED_PLAYERS,
      judgeIndex: SEED_JUDGE_INDEX,
      pickedCategories: SEED_PICKED,
    })
    const keys = Object.keys(base) as (keyof RoomState)[]
    expect(keys.filter((key) => JSON.stringify(room[key]) !== JSON.stringify(base[key]))).toEqual([
      'players',
      'judgeIndex',
      'pickedCategories',
    ])
    // Rotation off, 45 s and three wins are createRoom's own defaults, not overrides.
    expect([base.rotateJudge, base.config.roundSeconds, base.config.winsNeeded]).toStrictEqual([
      false,
      45,
      3,
    ])
    expect([room.teamA, room.teamB]).toStrictEqual(['النمور', 'الصقور'])
    // The seed's own constants, by reference: the room copies none of them.
    expect(room.players).toBe(SEED_PLAYERS)
    expect(room.pickedCategories).toBe(SEED_PICKED)
    expect(SEED_JUDGE_INDEX).toBe(4)
  })

  test("the room code is the caller's, and nothing in the seed is random", () => {
    const random = vi.spyOn(Math, 'random')
    const one = seedRoom('SKZJ62')
    const other = seedRoom('ABC123')
    expect(random).toHaveBeenCalledTimes(0)
    expect([one.roomCode, other.roomCode]).toStrictEqual(['SKZJ62', 'ABC123'])
    expect({ ...other, roomCode: 'SKZJ62' }).toStrictEqual(one)
    // A fresh room each call, equal to the last.
    expect(seedRoom('SKZJ62')).not.toBe(one)
    expect(seedRoom('SKZJ62')).toStrictEqual(one)
  })

  test("SEED_PICKED is the catalog's eight free tiles, in the catalog's order", () => {
    expect(SEED_PICKED).toStrictEqual(
      CATALOG.filter((entry) => !entry.locked).map((entry) => entry.id),
    )
    expect(SEED_PICKED.map((id) => catalogEntry(id).name)).toStrictEqual(FREE_TILE_NAMES)
    expect(SEED_PICKED.filter((id) => catalogEntry(id).locked)).toStrictEqual([])
    // The prototype's picked indices, [0,1,2,3,5,6,7,10], are the catalog positions of these.
    expect(SEED_PICKED.map((id) => CATALOG.findIndex((entry) => entry.id === id))).toStrictEqual([
      0, 1, 2, 3, 5, 6, 7, 10,
    ])
  })

  test("Phase 4's J8 and K1–K4 hold on the seed, and on the room it opens", () => {
    const room = seedRoom('SKZJ62')
    expect(violatedShapes(room)).toStrictEqual([])
    expect(currentJudge(room)).toBe(SEED_PLAYERS[4])
    expect(currentJudge(room)?.name).toBe('ماجد')
    expect(canOpenRoom(room)).toBe(true)

    // Opening it needs no fill — three on team a, two on b — so the players are the seed's own.
    const opened = reduce(room, { type: 'openRoom' })
    expect(opened.screen).toBe('ready')
    expect(opened.players).toBe(SEED_PLAYERS)
    expect(violatedShapes(opened)).toStrictEqual([])

    // The shapes are live: each flags a room built to break it, and only that one.
    expect(violatedShapes({ ...room, judgeIndex: 5 })).toStrictEqual(['J8'])
    expect(violatedShapes({ ...room, round: 2 })).toStrictEqual(['K1'])
    expect(violatedShapes({ ...room, pickedCategories: ['industry', 'industry'] })).toStrictEqual([
      'K2',
    ])
    expect(
      violatedShapes({
        ...room,
        players: [...SEED_PLAYERS, { id: 'seed-1', name: 'x', team: 'b' }],
      }),
    ).toStrictEqual(['K3'])
    // Team b emptied on ready, the judge moved to the first of the three left so J8 still holds.
    expect(
      violatedShapes({
        ...opened,
        judgeIndex: 0,
        players: SEED_PLAYERS.filter((player) => player.team === 'a'),
      }),
    ).toStrictEqual(['K4'])
  })
})
