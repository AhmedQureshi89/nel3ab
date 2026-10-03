// The local room — the driver that sits between the judge app's screens and the rules engine until
// Phase 11 moves the room, its code and its clock to the server ("same screens, different source
// of truth").
//
// REQ-5.10 – REQ-5.13 — specs/phase-5/specs.md §2.9, `driver.ts`. One room per page load, held
// here: the engine decides every rule (`reduce`); the driver supplies what the engine refuses to
// touch — time, randomness and the room's one copy.
//
// The two obligations Phase 4 handed every driver are kept here, and only here:
//
// - **It draws** (REQ-5.11). Every round it starts — a match's first from room-ready, a rematch,
//   the next round — carries `drawRound`'s result: a category from
//   `drawCategory(drawableCategories(state), random)`, then that category's questions ordered by
//   `shuffleQuestions(…, random)` — one call to the source for the category, one per question,
//   nothing else. In the page the source is `Math.random`.
// - **It passes the turn** (REQ-5.12). On `play`, every `TICK_MS` of the browser's timer it
//   dispatches `tick` of exactly `TICK_MS`, then `passTurn` — every interval, unconditionally; the
//   engine refuses the pass until the reveal has been up its hold. No other screen runs a timer.
//   The driver never reads a clock: it counts intervals, not milliseconds (Phase 3's finding: a
//   loop that measures wall time and rounds each delta drifts by up to ±225 ms over a 45 s bank).
//   A browser that throttles a background tab's timers slows this room's clock exactly as it slows
//   the prototype's; the server owns the clock from Phase 11 (mission.md §5.2).
//
// And Phase 4's third: no path here dispatches Phase 3's unscored round primitive (REQ-5.13).
// `DriverAction` cannot express it, nor `startMatch` / `nextRound` (only through the methods that
// draw for them), nor `tick` / `passTurn` (only from the clock loop). The primitive is not named in
// this file at all: `host-source.test.ts` finds its name in no non-test source under apps/web.
//
// Framework-free: no React import (specs.md §1). `HostApp.tsx` subscribes through
// `useSyncExternalStore`, which is why `subscribe` and `getState` need no `this`.

import {
  drawableCategories,
  drawCategory,
  reduce,
  shuffleQuestions,
  shuffleTeamName as otherTeamName,
  TEAM_NAMES,
} from '@nel3ab/game'
import type { Action, CategoryId, Question, Random, RoomState, Team } from '@nel3ab/game'

import { CATALOG } from './catalog'
import type { CatalogEntry } from './catalog'
import { makeRoomCode } from './room-code'
import { seedRoom } from './seed'

/** The clock loop's interval and tick, in ms — the prototype's `setInterval(…, 100)`, draining 0.1 s. */
export const TICK_MS = 100

/**
 * What a screen may dispatch raw: the eight setup actions, the judge's three, and going back to
 * setup from a match. Never Phase 3's round primitive; `startMatch` / `nextRound` only through the
 * methods that draw for them; `tick` / `passTurn` only from the clock loop (REQ-5.13).
 */
export type DriverAction = Extract<
  Action,
  {
    readonly type:
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
  }
>

/** The two timer functions the clock loop uses — `globalThis`'s in the page, fakes in a test. */
export interface Timers {
  setInterval(callback: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

export interface LocalRoomOptions {
  /** The draws' and the room code's source. Default `Math.random`. */
  readonly random?: Random
  /** The clock loop's timers. Default `globalThis`. */
  readonly timers?: Timers
  /** Where a drawn category's questions come from. Default `CATALOG`. */
  readonly catalog?: readonly CatalogEntry[]
  /** Every action goes through it. Default `reduce`; a test passes a recording wrapper. */
  readonly reducer?: (state: RoomState, action: Action) => RoomState
  /** The room to start from. Default `seedRoom(makeRoomCode(random))`. */
  readonly initial?: RoomState
}

export interface LocalRoom {
  getState(): RoomState
  /** Calls `listener` after every action that changes the room; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
  dispatch(action: DriverAction): void
  /** On `ready` and `match` only: draw, then `startMatch`. Elsewhere nothing, and no random call. */
  startMatch(): void
  /** On `roundEnd` only: draw, then `nextRound`. Elsewhere nothing, and no random call. */
  nextRound(): void
  /** Renames `team` to another of its four names (the engine's `shuffleTeamName`). */
  shuffleTeamName(team: Team): void
  /** Stops the clock loop if it runs. The room stays usable; the loop restarts on entering `play`. */
  dispose(): void
}

/**
 * One round's draws (REQ-5.11): `categoryId = drawCategory(drawableCategories(state), random)`,
 * then `shuffleQuestions(entry.questions, random)` for that category's entry in `catalog` — one
 * call to `random` for the category, then exactly one per question, nothing else. A picked
 * category the catalog does not hold throws `RangeError`.
 */
export function drawRound(
  state: RoomState,
  catalog: readonly CatalogEntry[],
  random: Random,
): { readonly categoryId: CategoryId; readonly questions: readonly [Question, ...Question[]] } {
  const categoryId = drawCategory(drawableCategories(state), random)
  const entry = catalog.find((candidate) => candidate.id === categoryId)
  if (entry === undefined) {
    throw new RangeError(
      `drawRound: the catalog holds no category with id ${JSON.stringify(categoryId)}`,
    )
  }
  // `shuffleQuestions` returns a new array of the same length — non-empty, since the entry's list
  // is — typed `Question[]`. Re-asserted non-empty for the payload's type without a `!`.
  const [first, ...rest] = shuffleQuestions(entry.questions, random)
  if (first === undefined) {
    throw new RangeError(`drawRound: category ${JSON.stringify(categoryId)} has no questions`)
  }
  return { categoryId, questions: [first, ...rest] }
}

/** The room `/host` holds for the life of the page (specs.md §2.9). No timer starts until `play`. */
export function createLocalRoom(options: LocalRoomOptions = {}): LocalRoom {
  const random = options.random ?? Math.random
  const timers: Timers = options.timers ?? globalThis
  const catalog = options.catalog ?? CATALOG
  const reducer = options.reducer ?? reduce

  let state: RoomState = options.initial ?? seedRoom(makeRoomCode(random))
  const listeners = new Set<() => void>()
  /** The running clock loop's handle, boxed: a timer handle may be any value, `0` included. */
  let loop: { readonly handle: unknown } | null = null

  /** Reduces one action; on a change, notifies every listener, then starts or stops the loop. */
  const apply = (action: Action): void => {
    const next = reducer(state, action)
    if (next === state) return
    state = next
    for (const listener of [...listeners]) listener()
    sync()
  }

  /** The loop runs exactly while the room is on `play`. */
  const sync = (): void => {
    if (state.screen === 'play') {
      if (loop === null) loop = { handle: timers.setInterval(step, TICK_MS) }
    } else if (loop !== null) {
      timers.clearInterval(loop.handle)
      loop = null
    }
  }

  /** One interval: a tick of exactly `TICK_MS`, then a `passTurn` the engine refuses until due. */
  const step = (): void => {
    apply({ type: 'tick', ms: TICK_MS })
    apply({ type: 'passTurn' })
  }

  return {
    getState: () => state,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    dispatch: (action) => {
      apply(action)
    },

    startMatch: () => {
      if (state.screen !== 'ready' && state.screen !== 'match') return
      apply({ type: 'startMatch', ...drawRound(state, catalog, random) })
    },

    nextRound: () => {
      if (state.screen !== 'roundEnd') return
      apply({ type: 'nextRound', ...drawRound(state, catalog, random) })
    },

    shuffleTeamName: (team) => {
      const current = team === 'a' ? state.teamA : state.teamB
      apply({ type: 'renameTeam', team, name: otherTeamName(current, TEAM_NAMES[team], random) })
    },

    dispose: () => {
      if (loop === null) return
      timers.clearInterval(loop.handle)
      loop = null
    },
  }
}
