import { matchWinner, reduce } from '@nel3ab/game'
import type { Action, CategoryId, Question, RoomState } from '@nel3ab/game'
import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest'

import { CATALOG, catalogEntry } from './catalog'
import type { CatalogEntry } from './catalog'
import { createLocalRoom, drawRound, TICK_MS } from './driver'
import type { DriverAction, LocalRoom, Timers } from './driver'
import { SEED_PICKED, seedRoom } from './seed'

// REQ-5.11, REQ-5.12, REQ-5.13 — specs/phase-5/verification.md Gate 4, "The draw", "The loop"
// and "No startRound", with Table T1–T5. See specs.md §2.9 (`driver.ts`) and §2.12 (this file's
// row: drawRound's pinned draws and call counts; the real-source statistics; the loop under fake
// timers; the dispatch log; startMatch / nextRound off their screens; dispose).
//
// Rooms are `seedRoom('SKZJ62')` after `openRoom` — on `ready` — unless stated (Table T). The
// loop runs under Vitest's fake timers through the driver's DEFAULT timers, `globalThis`, so
// what is tested is what the page runs. Every action the driver sends goes through a recording
// reducer that wraps the engine's `reduce`: the log is the dispatch log REQ-5.13 asks about.

const READY: RoomState = reduce(seedRoom('SKZJ62'), { type: 'openRoom' })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Spies first — some wrap the fake timers — then the real timers back.
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** A source that always returns `value`, counting its calls. */
const constant = (value: number) => vi.fn(() => value)

/** A source that returns `values` in turn, then `NaN`, counting its calls. */
const sequence = (values: readonly number[]) => {
  let next = 0
  return vi.fn(() => {
    const value = values[next] ?? Number.NaN
    next += 1
    return value
  })
}

/** The engine's reducer, recording every action the driver hands it, in order. */
const recorder = () => {
  const log: Action[] = []
  const reducer = (state: RoomState, action: Action): RoomState => {
    log.push(action)
    return reduce(state, action)
  }
  return { log, reducer }
}

/** How many of `log`'s actions are of `type`. */
const count = (log: readonly Action[], type: Action['type']): number =>
  log.filter((action) => action.type === type).length

/** The loop's own actions in `log`: every `tick` and `passTurn`. */
const loopActions = (log: readonly Action[]): Action[] =>
  log.filter((action) => action.type === 'tick' || action.type === 'passTurn')

/** The placeholder digit (١، ٢، ٣) of each drawn question, by its place in the catalog entry. */
const order = (categoryId: CategoryId, questions: readonly Question[]): string[] =>
  questions.map((question) => {
    const digit = ['١', '٢', '٣'][catalogEntry(categoryId).questions.indexOf(question)]
    if (digit === undefined) throw new Error(`not one of ${categoryId}'s questions: ${question.q}`)
    return digit
  })

/** A room on `ready` with a recording reducer and a source that always returns 0.5. */
const readyRoom = (): { room: LocalRoom; log: Action[]; random: ReturnType<typeof constant> } => {
  const random = constant(0.5)
  const { log, reducer } = recorder()
  return { room: createLocalRoom({ random, reducer, initial: READY }), log, random }
}

describe('REQ-5.11: the draw', () => {
  test('T1 — the sequence 0.5, 0, 0, 0: proverbs, questions ٣، ٢، ١, 4 calls', () => {
    const random = sequence([0.5, 0, 0, 0])
    const draw = drawRound(READY, CATALOG, random)
    expect(draw.categoryId).toBe('proverbs')
    // floor(0.5 × 8) = 4 — the fifth of SEED_PICKED.
    expect(SEED_PICKED[4]).toBe('proverbs')
    expect(order(draw.categoryId, draw.questions)).toStrictEqual(['٣', '٢', '١'])
    expect(random).toHaveBeenCalledTimes(4)
  })

  test('T2 — a source always 0.5: proverbs, questions ١، ٣، ٢, 4 calls', () => {
    const random = constant(0.5)
    const draw = drawRound(READY, CATALOG, random)
    expect(draw.categoryId).toBe('proverbs')
    expect(order(draw.categoryId, draw.questions)).toStrictEqual(['١', '٣', '٢'])
    expect(random).toHaveBeenCalledTimes(4)
    // The catalog's own question objects, in a new array; the entry's list is untouched.
    const entry = catalogEntry('proverbs')
    expect(draw.questions).toStrictEqual([
      entry.questions[0],
      entry.questions[2],
      entry.questions[1],
    ])
    expect(draw.questions).not.toBe(entry.questions)
    expect(order('proverbs', entry.questions)).toStrictEqual(['١', '٢', '٣'])
  })

  test('it draws from drawableCategories: the whole selection on ready, the unused on roundEnd', () => {
    // On ready, 0 picks the first of SEED_PICKED and 0.999 the last.
    expect(drawRound(READY, CATALOG, constant(0)).categoryId).toBe('industry')
    expect(drawRound(READY, CATALOG, constant(0.999)).categoryId).toBe('science')
    // On a round end with proverbs used, 0.5 picks the fourth of the seven unused: society.
    const roundEnd: RoomState = {
      ...READY,
      screen: 'roundEnd',
      categoryId: 'proverbs',
      usedCategories: ['proverbs'],
    }
    expect(drawRound(roundEnd, CATALOG, constant(0.5)).categoryId).toBe('society')
  })

  test('it looks the category up in the catalog it is given, not in CATALOG', () => {
    const question = (q: string): Question => ({ q, a: 'x', alts: [], h: [], f: 'x' })
    const two: CatalogEntry = {
      id: 'proverbs',
      name: 'two',
      emoji: '2',
      locked: false,
      questions: [question('p1'), question('p2')],
    }
    const random = constant(0.5)
    const draw = drawRound(READY, [two], random)
    // One call for the category, one per question: 3 for a two-question entry.
    expect(random).toHaveBeenCalledTimes(3)
    expect(draw).toStrictEqual({
      categoryId: 'proverbs',
      questions: [two.questions[0], two.questions[1]],
    })
    // A picked category the given catalog does not hold throws, after the one category call.
    const missing = constant(0.5)
    expect(() => drawRound(READY, [{ ...two, id: 'industry' }], missing)).toThrow(RangeError)
    expect(() => drawRound(READY, [], missing)).toThrow(
      'drawRound: the catalog holds no category with id "proverbs"',
    )
    // A bad source reaches the engine's guards.
    expect(() => drawRound(READY, CATALOG, constant(1))).toThrow(RangeError)
    expect(() => drawRound(READY, CATALOG, sequence([0.5, 0.5, 1]))).toThrow(RangeError)
  })

  test('startMatch() on ready dispatches the drawRound result, with 4 calls to the source', () => {
    const { room, log, random } = readyRoom()
    const expected = drawRound(READY, CATALOG, constant(0.5))
    room.startMatch()
    expect(log).toStrictEqual([{ type: 'startMatch', ...expected }])
    expect(expected.categoryId).toBe('proverbs')
    expect(random).toHaveBeenCalledTimes(4)
    const state = room.getState()
    expect([state.screen, state.round, state.categoryId]).toStrictEqual(['play', 1, 'proverbs'])
    expect(state.questionPool).toStrictEqual(expected.questions)
  })

  test('nextRound() on roundEnd, and startMatch() on match (a rematch), dispatch the drawRound result', () => {
    const { room, log, random } = readyRoom()
    room.startMatch()
    // With no answer given, the starting team's bank runs out: b, a, b, a, b win rounds 1–5.
    const draws: CategoryId[] = []
    for (let round = 1; round <= 5; round += 1) {
      vi.advanceTimersByTime(45_000)
      const ended = room.getState()
      expect([ended.screen, ended.round]).toStrictEqual([round < 5 ? 'roundEnd' : 'match', round])
      draws.push(ended.categoryId ?? '')
      if (round === 5) break
      const calls = random.mock.calls.length
      const expected = drawRound(ended, CATALOG, constant(0.5))
      room.nextRound()
      expect(log.at(-1)).toStrictEqual({ type: 'nextRound', ...expected })
      expect(random.mock.calls.length - calls).toBe(4)
      expect(room.getState().round).toBe(round + 1)
    }
    // floor(0.5 × the unused count) each round: 8 → proverbs, 7 → society, 6 → history,
    // 5 → nature, 4 → religion.
    expect(draws).toStrictEqual(['proverbs', 'society', 'history', 'nature', 'religion'])
    const over = room.getState()
    expect([over.tallyA, over.tallyB, matchWinner(over)]).toStrictEqual([2, 3, 'b'])

    // The rematch draws from the whole selection again.
    const calls = random.mock.calls.length
    const expected = drawRound(over, CATALOG, constant(0.5))
    expect(expected.categoryId).toBe('proverbs')
    room.startMatch()
    expect(log.at(-1)).toStrictEqual({ type: 'startMatch', ...expected })
    expect(random.mock.calls.length - calls).toBe(4)
    const rematch = room.getState()
    expect([rematch.screen, rematch.round, rematch.tallyA, rematch.tallyB]).toStrictEqual([
      'play',
      1,
      0,
      0,
    ])
  })

  test('startMatch() and nextRound() off their screens do nothing and call no random source', () => {
    const random = constant(0.5)
    const { log, reducer } = recorder()
    const room = createLocalRoom({ random, reducer, initial: seedRoom('SKZJ62') })
    const tryBoth = (): void => {
      room.startMatch()
      room.nextRound()
    }

    tryBoth() // setup
    room.dispatch({ type: 'openRoom' })
    room.nextRound() // ready
    room.startMatch() // ready → play: the one draw
    expect(random).toHaveBeenCalledTimes(4)
    tryBoth() // play
    vi.advanceTimersByTime(45_000)
    expect(room.getState().screen).toBe('roundEnd')
    room.startMatch() // roundEnd
    expect(random).toHaveBeenCalledTimes(4)
    expect(count(log, 'startMatch')).toBe(1)
    expect(count(log, 'nextRound')).toBe(0)
    // Not a single action reached the reducer from the no-ops: every logged action is accounted for.
    expect(log.length).toBe(1 + 1 + 450 + 450)
  })

  test('T3 — 8,000 draws with the real Math.random: every category and every order within ±5σ', () => {
    const random = vi.spyOn(Math, 'random')
    const categories = new Map<CategoryId, number>()
    const orders = new Map<string, number>()
    for (let k = 0; k < 8_000; k += 1) {
      const draw = drawRound(READY, CATALOG, Math.random)
      categories.set(draw.categoryId, (categories.get(draw.categoryId) ?? 0) + 1)
      const key = order(draw.categoryId, draw.questions).join('')
      orders.set(key, (orders.get(key) ?? 0) + 1)
    }
    // The real source, called through: one call for the category and three for the questions.
    expect(random).toHaveBeenCalledTimes(32_000)

    // Never a locked or unpicked category: exactly the eight picked, each 1,000 ± 5σ.
    expect([...categories.keys()].sort()).toStrictEqual([...SEED_PICKED].sort())
    expect([...categories.keys()].filter((id) => catalogEntry(id).locked)).toStrictEqual([])
    for (const [, drawn] of categories) {
      expect(drawn).toBeGreaterThanOrEqual(853)
      expect(drawn).toBeLessThanOrEqual(1_147)
    }
    // All six orders of three questions, each 1,333 ± 5σ.
    expect(orders.size).toBe(6)
    for (const [, drawn] of orders) {
      expect(drawn).toBeGreaterThanOrEqual(1_167)
      expect(drawn).toBeLessThanOrEqual(1_500)
    }
    console.info(
      `REQ-5.11 T3: ${JSON.stringify({
        categories: Object.fromEntries(SEED_PICKED.map((id) => [id, categories.get(id)])),
        orders: Object.fromEntries([...orders].sort(([a], [b]) => (a < b ? -1 : 1))),
      })}`,
    )
  })
})

describe('REQ-5.12: the loop', () => {
  test('T4 — tick 100 then passTurn every 100 ms on play; round end at 45,000 ms; set once, cleared once', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    const clearInterval = vi.spyOn(globalThis, 'clearInterval')
    const dateNow = vi.spyOn(Date, 'now')
    const performanceNow = vi.spyOn(performance, 'now')
    const { room, log } = readyRoom()
    expect(setInterval).toHaveBeenCalledTimes(0)

    room.startMatch() // at fake time 0
    expect(room.getState().screen).toBe('play')
    expect(setInterval).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 100)

    vi.advanceTimersByTime(99)
    expect(loopActions(log)).toStrictEqual([])

    vi.advanceTimersByTime(1)
    expect(loopActions(log)).toStrictEqual([{ type: 'tick', ms: 100 }, { type: 'passTurn' }])
    expect(room.getState().clock.now).toBe(100)

    vi.advanceTimersByTime(44_800) // 44,900 ms: still on play, 100 ms left in team a's bank
    expect(room.getState().screen).toBe('play')
    expect(clearInterval).toHaveBeenCalledTimes(0)

    vi.advanceTimersByTime(100) // 45,000 ms
    const ended = room.getState()
    expect(ended.screen).toBe('roundEnd')
    expect([ended.tallyA, ended.tallyB]).toStrictEqual([0, 1])
    expect(ended.log).toStrictEqual([{ n: 1, category: 'proverbs', winner: 'b' }])
    expect(count(log, 'tick')).toBe(450)
    expect(count(log, 'passTurn')).toBe(450)
    // Every tick was exactly TICK_MS, and each was followed by a passTurn.
    expect(log.filter((action) => action.type === 'tick' && action.ms !== 100)).toStrictEqual([])
    expect(loopActions(log)).toStrictEqual(
      Array.from({ length: 450 }, () => [{ type: 'tick', ms: 100 }, { type: 'passTurn' }]).flat(),
    )

    const sent = log.length
    vi.advanceTimersByTime(10_000)
    expect(log.length - sent).toBe(0)

    expect(setInterval).toHaveBeenCalledTimes(1)
    expect(clearInterval).toHaveBeenCalledTimes(1)
    expect(clearInterval).toHaveBeenCalledWith(setInterval.mock.results[0]?.value)
    expect(vi.getTimerCount()).toBe(0)
    // It counted intervals: no clock was read.
    expect(dateNow).toHaveBeenCalledTimes(0)
    expect(performanceNow).toHaveBeenCalledTimes(0)
    expect(TICK_MS).toBe(100)
  })

  test('T5 — correct at 5,000 ms: the reveal holds to 6,000 ms, then the turn passes to b', () => {
    const { room } = readyRoom()
    room.startMatch()
    vi.advanceTimersByTime(5_000)
    room.dispatch({ type: 'correct' })
    const revealed = room.getState()
    expect(revealed.revealedAt).toBe(5_000)
    expect(revealed.reveal).not.toBeNull()
    expect(revealed.clock.banks.a.ms).toBe(40_000)

    vi.advanceTimersByTime(900) // 5,900 ms
    const held = room.getState()
    expect(held.reveal).not.toBeNull()
    expect(held.clock.active).toBe('a')
    expect(held.questionIndex).toBe(0)

    vi.advanceTimersByTime(100) // 6,000 ms
    const passed = room.getState()
    expect(passed.clock.active).toBe('b')
    expect(passed.clock.banks.b).toStrictEqual({ ms: 45_000, started: true })
    expect(passed.clock.runningSince).toBe(6_000)
    expect(passed.questionIndex).toBe(1)
    expect(passed.clock.banks.a.ms).toBe(40_000)
    expect([passed.reveal, passed.revealedAt]).toStrictEqual([null, null])
  })

  test('no timer on any other screen; the loop stops in the step that leaves play, and starts in the one that enters it', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    const clearInterval = vi.spyOn(globalThis, 'clearInterval')
    const { log, reducer } = recorder()
    const room = createLocalRoom({ random: constant(0.5), reducer, initial: seedRoom('SKZJ62') })
    room.dispatch({ type: 'swapTeam', playerId: 'seed-1' })
    room.dispatch({ type: 'openRoom' })
    room.dispatch({ type: 'backToSetup' })
    room.dispatch({ type: 'openRoom' })
    vi.advanceTimersByTime(10_000)
    expect(setInterval).toHaveBeenCalledTimes(0)
    expect(loopActions(log)).toStrictEqual([])

    room.startMatch()
    expect(setInterval).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(44_000) // team a has 1,000 ms left
    // A skip costs 3,000 ms: it ends the round, and the loop stops in that same dispatch.
    room.dispatch({ type: 'skip' })
    expect(room.getState().screen).toBe('roundEnd')
    expect(clearInterval).toHaveBeenCalledTimes(1)
    const sent = loopActions(log).length
    vi.advanceTimersByTime(10_000)
    expect(loopActions(log).length).toBe(sent)

    room.nextRound()
    expect(setInterval).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(45_000)
    expect(room.getState().screen).toBe('roundEnd')
    expect(clearInterval).toHaveBeenCalledTimes(2)
    room.dispatch({ type: 'resetMatch' })
    expect(room.getState().screen).toBe('setup')
    vi.advanceTimersByTime(10_000)
    expect([setInterval.mock.calls.length, clearInterval.mock.calls.length]).toStrictEqual([2, 2])
    expect(vi.getTimerCount()).toBe(0)
  })

  test('dispose stops the loop; the room stays usable, and the next change on play restarts it', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    const clearInterval = vi.spyOn(globalThis, 'clearInterval')
    const { room, log } = readyRoom()
    room.dispose() // no loop yet: nothing to clear
    expect(clearInterval).toHaveBeenCalledTimes(0)

    room.startMatch()
    vi.advanceTimersByTime(1_000)
    room.dispose()
    expect(clearInterval).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    const sent = log.length
    vi.advanceTimersByTime(5_000)
    expect(log.length).toBe(sent)
    expect(room.getState().clock.now).toBe(1_000)

    room.dispatch({ type: 'hint' }) // a change that lands on play
    expect(setInterval).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(100)
    expect(loopActions(log.slice(sent))).toStrictEqual([
      { type: 'tick', ms: 100 },
      { type: 'passTurn' },
    ])
    expect(room.getState().clock.now).toBe(1_100)
  })

  test('the timers are injectable, and a handle of any value — 0 included — is the one cleared', () => {
    const setInterval = vi.fn<Timers['setInterval']>(() => 0)
    const clearInterval = vi.fn<Timers['clearInterval']>()
    const timers: Timers = { setInterval, clearInterval }
    const room = createLocalRoom({ random: constant(0.5), timers, initial: READY })
    room.startMatch()
    expect(setInterval).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), TICK_MS)
    const step = setInterval.mock.calls[0]?.[0]
    for (let k = 0; k < 450; k += 1) step?.()
    expect(room.getState().screen).toBe('roundEnd')
    expect(clearInterval).toHaveBeenCalledTimes(1)
    expect(clearInterval).toHaveBeenCalledWith(0)
  })
})

describe('the room: state, listeners and the team-name shuffle', () => {
  test('a listener hears every change and nothing else; unsubscribing stops it', () => {
    const { room } = readyRoom()
    const listener = vi.fn()
    const unsubscribe = room.subscribe(listener)
    const before = room.getState()
    room.dispatch({ type: 'openRoom' }) // inert on ready
    room.dispatch({ type: 'swapTeam', playerId: 'seed-1' }) // inert off setup
    expect(listener).toHaveBeenCalledTimes(0)
    expect(room.getState()).toBe(before)

    room.startMatch()
    expect(listener).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(300) // three intervals: each tick a change, each passTurn inert
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    vi.advanceTimersByTime(300)
    expect(listener).toHaveBeenCalledTimes(4)
    expect(room.getState().clock.now).toBe(600)
  })

  test('a listener sees the new state when it is called', () => {
    const { room } = readyRoom()
    const seen: string[] = []
    room.subscribe(() => seen.push(room.getState().screen))
    room.dispatch({ type: 'backToSetup' })
    room.dispatch({ type: 'openRoom' })
    expect(seen).toStrictEqual(['setup', 'ready'])
  })

  test("createLocalRoom's defaults: the seed with a code from the source, CATALOG and reduce", () => {
    const random = constant(0)
    const room = createLocalRoom({ random })
    expect(room.getState()).toStrictEqual(seedRoom('AAAAAA'))
    expect(random).toHaveBeenCalledTimes(6)
    room.dispatch({ type: 'openRoom' })
    room.startMatch()
    // CATALOG's questions, drawn by the same source: industry, ٣، ٢، ١ for always 0.
    const state = room.getState()
    expect(state.categoryId).toBe('industry')
    expect(order('industry', state.questionPool)).toStrictEqual(['٣', '٢', '١'])
  })

  test('shuffleTeamName renames the team to another of its four names, with one call', () => {
    const random = constant(0)
    const room = createLocalRoom({ random, initial: seedRoom('SKZJ62') })
    room.shuffleTeamName('a')
    room.shuffleTeamName('b')
    expect([room.getState().teamA, room.getState().teamB]).toStrictEqual(['الأسود', 'الفهود'])
    expect(random).toHaveBeenCalledTimes(2)
    room.shuffleTeamName('a')
    expect(room.getState().teamA).toBe('النمور')
    // Off setup the rename is inert, as every setup edit is.
    room.dispatch({ type: 'openRoom' })
    const ready = room.getState()
    room.shuffleTeamName('a')
    expect(room.getState()).toBe(ready)
  })
})

describe('REQ-5.13: no startRound', () => {
  test('a recorded session — edits, open, back, open, startMatch(), 450 intervals, nextRound(), 100 intervals — dispatches 0 startRound', () => {
    const { log, reducer } = recorder()
    const room = createLocalRoom({ random: constant(0.5), reducer, initial: seedRoom('SKZJ62') })
    room.dispatch({ type: 'swapTeam', playerId: 'seed-1' })
    room.dispatch({ type: 'removePlayer', playerId: 'seed-2' })
    room.dispatch({ type: 'renameTeam', team: 'b', name: 'النجوم' })
    room.shuffleTeamName('a')
    room.dispatch({ type: 'setJudge', playerId: 'seed-3' })
    room.dispatch({ type: 'setRotateJudge', rotate: true })
    room.dispatch({ type: 'pickCategory', categoryId: 'industry', picked: false })
    room.dispatch({ type: 'pickCategory', categoryId: 'industry', picked: true })
    room.dispatch({ type: 'openRoom' })
    room.dispatch({ type: 'backToSetup' })
    room.dispatch({ type: 'openRoom' })
    room.startMatch()
    vi.advanceTimersByTime(450 * TICK_MS)
    expect(room.getState().screen).toBe('roundEnd')
    room.nextRound()
    vi.advanceTimersByTime(100 * TICK_MS)
    expect([room.getState().screen, room.getState().round]).toStrictEqual(['play', 2])

    const types = log.map((action) => action.type)
    expect(types.filter((type) => type === 'startRound')).toStrictEqual([])
    expect(
      Object.fromEntries([...new Set(types)].map((type) => [type, count(log, type)])),
    ).toStrictEqual({
      swapTeam: 1,
      removePlayer: 1,
      renameTeam: 2,
      setJudge: 1,
      setRotateJudge: 1,
      pickCategory: 2,
      openRoom: 2,
      backToSetup: 1,
      startMatch: 1,
      tick: 550,
      passTurn: 550,
      nextRound: 1,
    })
    expect(log).toHaveLength(1113)
  })

  test('DriverAction admits exactly the twelve a screen may send — not startRound, startMatch, nextRound, tick or passTurn', () => {
    expectTypeOf<DriverAction['type']>().toEqualTypeOf<
      | 'removePlayer'
      | 'swapTeam'
      | 'renameTeam'
      | 'setJudge'
      | 'setRotateJudge'
      | 'pickCategory'
      | 'openRoom'
      | 'backToSetup'
      | 'hint'
      | 'skip'
      | 'correct'
      | 'resetMatch'
    >()
    expectTypeOf<Exclude<Action['type'], DriverAction['type']>>().toEqualTypeOf<
      'startRound' | 'startMatch' | 'nextRound' | 'tick' | 'passTurn'
    >()
    expectTypeOf<Extract<DriverAction, { type: 'startRound' }>>().toBeNever()
    expectTypeOf<Extract<DriverAction, { type: 'startMatch' }>>().toBeNever()
    expectTypeOf<Extract<DriverAction, { type: 'nextRound' }>>().toBeNever()
    expectTypeOf<Extract<DriverAction, { type: 'tick' }>>().toBeNever()
    expectTypeOf<Extract<DriverAction, { type: 'passTurn' }>>().toBeNever()
    // Each admitted member is the engine's own Action member, payload and all.
    expectTypeOf<Extract<DriverAction, { type: 'renameTeam' }>>().toEqualTypeOf<
      Extract<Action, { type: 'renameTeam' }>
    >()
    // And dispatch takes nothing else.
    expectTypeOf<LocalRoom['dispatch']>().parameter(0).toEqualTypeOf<DriverAction>()
  })
})
