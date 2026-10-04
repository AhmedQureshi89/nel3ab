import { currentQuestion, reduce } from '@nel3ab/game'
import type { Action, RoomState, Team } from '@nel3ab/game'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { CATALOG } from './catalog'
import { createLocalRoom, drawRound } from './driver'
import type { LocalRoom, LocalRoomOptions } from './driver'
import { playView } from './play-view'
import { seedRoom } from './seed'

// REQ-6.15, REQ-6.13 — specs/phase-6/verification.md Gate 1 and its Table V: the prototype's
// scripted round, replayed through the driver in CI. See specs.md §2.5 (this file's row) and
// requirements.md §1.1, fact 7 (the throwaway replay, measured before any code existed, that this
// file makes a regression test).
//
// The room is the page's: `createLocalRoom` with the random source `() => 0.5` — so the round
// draws أمثال (`proverbs`), its questions in the order ١، ٣، ٢ (Phase 5's Table T2) — on the seed,
// opened, then `room.startMatch()`. The loop runs under Vitest's fake timers through the driver's
// DEFAULT timers, `globalThis`, as driver.test.ts's do, so what runs is what the page runs: n of
// Table V's steps are `vi.advanceTimersByTime(100 × n)`, each one a `tick` of 100 ms then a
// `passTurn`. A press is the driver's `dispatch` of its action, as HostApp's three callbacks send
// it (specs.md §2.4), so V6's تلميح on the spent button reaches the engine, which refuses it
// (REQ-3.6), and V10's تخطي under the reveal reaches it and is refused too (REQ-4.6): both leave
// the room as it was (Table V's preamble).
//
// V1–V16 are read through `playView(room.getState(), CATALOG)`; V17, where the round is over and
// Table V has no play-screen cell, from the room. The question TEXTS are not part of the trace
// (requirements.md §1.1, fact 7): the app plays Phase 5's placeholders in the fair shuffle's order.

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** The seed, opened — on `ready` (Phase 5's Table T). */
const READY: RoomState = reduce(seedRoom('SKZJ62'), { type: 'openRoom' })

/** Table V's action: the match's start, `steps` loop steps, or a press of one of the three buttons. */
type Act = 'start' | 'hint' | 'skip' | 'correct' | { readonly steps: number }

/**
 * One row of Table V, its columns in the table's order. `question` is the N of the screen's
 * "سؤال N" (the view's `qNumber`); `hints` is spent / left; `bar` is the fill's width in percent,
 * to four decimals.
 */
type Row = readonly [
  at: string,
  act: Act,
  clockA: number,
  clockB: number,
  turn: Team,
  statusA: string,
  statusB: string,
  question: number,
  hints: readonly [spent: number, left: number],
  note: string,
  reveal: boolean,
  bar: number,
]

const NOW = 'دورهم الآن'
const WAITING = 'بالانتظار'
const FROZEN = 'مجمّد'

// The note under تلميح. Table V writes it in full at V1 and V3 and shortens it to "باقي N"
// elsewhere; the prototype's `hintBtnNote` has only these forms, so each is written out in full.
const NOTE_2 = '−٢ ثانية · باقي 2'
const NOTE_1 = '−٢ ثانية · باقي 1'
const NOTE_0 = 'انتهت التلميحات'

/** The strip's placeholder while no hint of the question is spent. */
const PLACEHOLDER = 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا'

/**
 * Table V, V1–V16, every cell. Where the table writes ″ (as above) the value is written out. V5's
 * "(button disabled)" is its 0 hints left: the hint Button's `disabled` is `hintsLeft === 0`
 * (specs.md §2.2). V9's reveal is "the answer box's answer": every reveal's answer is asserted
 * equal to the view's `answerText`.
 */
const TABLE_V: readonly Row[] = [
  ['V1', 'start', 45, 45, 'a', NOW, WAITING, 1, [0, 2], NOTE_2, false, 100],
  ['V2', { steps: 37 }, 42, 45, 'a', NOW, WAITING, 1, [0, 2], NOTE_2, false, 91.7778],
  ['V3', 'hint', 40, 45, 'a', NOW, WAITING, 1, [1, 1], NOTE_1, false, 87.3333],
  ['V4', { steps: 5 }, 39, 45, 'a', NOW, WAITING, 1, [1, 1], NOTE_1, false, 86.2222],
  ['V5', 'hint', 37, 45, 'a', NOW, WAITING, 1, [2, 0], NOTE_0, false, 81.7778],
  ['V6', 'hint', 37, 45, 'a', NOW, WAITING, 1, [2, 0], NOTE_0, false, 81.7778],
  ['V7', 'skip', 34, 45, 'a', NOW, WAITING, 2, [0, 2], NOTE_2, false, 75.1111],
  ['V8', { steps: 8 }, 33, 45, 'a', NOW, WAITING, 2, [0, 2], NOTE_2, false, 73.3333],
  ['V9', 'correct', 33, 45, 'a', NOW, WAITING, 2, [0, 2], NOTE_2, true, 73.3333],
  ['V10', 'skip', 33, 45, 'a', NOW, WAITING, 2, [0, 2], NOTE_2, true, 73.3333],
  ['V11', { steps: 9 }, 33, 45, 'a', NOW, WAITING, 2, [0, 2], NOTE_2, true, 73.3333],
  ['V12', { steps: 1 }, 33, 45, 'b', FROZEN, NOW, 3, [0, 2], NOTE_2, false, 100],
  ['V13', { steps: 1 }, 33, 45, 'b', FROZEN, NOW, 3, [0, 2], NOTE_2, false, 99.7778],
  ['V14', 'correct', 33, 45, 'b', FROZEN, NOW, 3, [0, 2], NOTE_2, true, 99.7778],
  ['V15', { steps: 10 }, 33, 45, 'a', NOW, FROZEN, 4, [0, 2], NOTE_2, false, 73.3333],
  ['V16', { steps: 329 }, 1, 45, 'a', NOW, FROZEN, 4, [0, 2], NOTE_2, false, 0.2222],
]

/** V17 — "+1 step (the 330th)": the round is over. */
const V17: Act = { steps: 1 }

/** The two presses Table V's preamble says the engine refuses: the room stays as it was. */
const REFUSED: ReadonlySet<string> = new Set(['V6', 'V10'])

/** Table V gives the bar to four decimals. */
const fourDecimals = (n: number): number => Math.round(n * 10_000) / 10_000

/** Plays one of Table V's actions on the room. */
const perform = (room: LocalRoom, act: Act): void => {
  if (act === 'start') room.startMatch()
  else if (typeof act === 'object') vi.advanceTimersByTime(100 * act.steps)
  else room.dispatch({ type: act })
}

/** The room the page holds, from the seed, opened, with the source `() => 0.5`. */
const pageRoom = (reducer?: LocalRoomOptions['reducer']): LocalRoom =>
  createLocalRoom({
    random: () => 0.5,
    initial: READY,
    ...(reducer === undefined ? {} : { reducer }),
  })

describe('REQ-6.15: the prototype’s round, replayed in CI', () => {
  test('Table V: V1–V16 through playView, every cell; V17 from the room — roundEnd, 0 – 1, team B', () => {
    const room = pageRoom()

    for (const [at, act, ...cells] of TABLE_V) {
      const before = room.getState()
      perform(room, act)
      const state = room.getState()
      const v = playView(state, CATALOG)
      const [, , turn, , , , [spent], , reveal] = cells

      // Every cell of the row, read from the view; hints spent from the room.
      expect(
        [
          v.timers.a.clock,
          v.timers.b.clock,
          v.activeTeam,
          v.timers.a.status,
          v.timers.b.status,
          v.qNumber,
          [state.hintIndex, v.hintsLeft],
          v.hintBtnNote,
          v.reveal !== null,
          fourDecimals(v.bankPct),
        ],
        at,
      ).toStrictEqual(cells)

      // The play screen throughout, its active card the turn's.
      expect(state.screen, at).toBe('play')
      expect([v.timers.a.active, v.timers.b.active], at).toStrictEqual([turn === 'a', turn === 'b'])
      // A spent hint is the question's own, shown in ink; none spent, the placeholder.
      expect([v.hintSpent, v.hintText], at).toStrictEqual(
        spent > 0 ? [true, currentQuestion(state)?.h[spent - 1]] : [false, PLACEHOLDER],
      )
      // A reveal that is up shows the answer box's answer.
      if (reveal) expect(v.reveal?.answer, at).toBe(v.answerText)
      // V6 and V10 reach the engine and are refused: the room is the one before the press.
      if (REFUSED.has(at)) expect(state, at).toBe(before)
      else expect(state, at).not.toBe(before)
    }

    perform(room, V17)
    const over = room.getState()
    expect(over.screen).toBe('roundEnd')
    expect([over.tallyA, over.tallyB]).toStrictEqual([0, 1])
    expect(over.log).toStrictEqual([{ n: 1, category: 'proverbs', winner: 'b' }])
    // The round ended on the 330th step after the last pass, and the loop stopped with it.
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('REQ-6.13: the three actions reach the reducer', () => {
  test('the dispatch log of Table V: startMatch 1, hint 3, skip 2, correct 2, each exactly that object; otherwise tick and passTurn; 0 startRound', () => {
    const log: Action[] = []
    const room = pageRoom((state, action) => {
      log.push(action)
      return reduce(state, action)
    })
    const acts: readonly Act[] = [...TABLE_V.map(([, act]) => act), V17]
    for (const act of acts) perform(room, act)
    expect(room.getState().screen).toBe('roundEnd')

    const count = (type: Action['type']): number =>
      log.filter((action) => action.type === type).length
    const types = [...new Set(log.map(({ type }) => type))]
    expect(Object.fromEntries(types.map((type) => [type, count(type)]))).toStrictEqual({
      startMatch: 1,
      tick: 401,
      passTurn: 401,
      hint: 3,
      skip: 2,
      correct: 2,
    })
    expect(count('startRound')).toBe(0)

    // Each press is exactly its object — nothing added, nothing dropped.
    expect(log.filter(({ type }) => type === 'hint')).toStrictEqual([
      { type: 'hint' },
      { type: 'hint' },
      { type: 'hint' },
    ])
    expect(log.filter(({ type }) => type === 'skip')).toStrictEqual([
      { type: 'skip' },
      { type: 'skip' },
    ])
    expect(log.filter(({ type }) => type === 'correct')).toStrictEqual([
      { type: 'correct' },
      { type: 'correct' },
    ])
    // The one startMatch carries the draw for the source 0.5: proverbs, questions ١، ٣، ٢.
    const startMatch = { type: 'startMatch', ...drawRound(READY, CATALOG, () => 0.5) }
    expect(startMatch.categoryId).toBe('proverbs')

    // And the whole log, in order: each press where the script presses, each step a tick of
    // exactly 100 ms then a passTurn — the step that ends the round included.
    const expected = acts.flatMap((act): unknown[] =>
      act === 'start'
        ? [startMatch]
        : typeof act === 'object'
          ? Array.from({ length: act.steps }, () => [
              { type: 'tick', ms: 100 },
              { type: 'passTurn' },
            ]).flat()
          : [{ type: act }],
    )
    expect(log).toStrictEqual(expected)
    expect(log).toHaveLength(810)
  })
})
