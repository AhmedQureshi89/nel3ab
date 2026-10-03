// Test support (Phase 5) — the setup sample's generator. REQ-5.7, NFR-5.3.
// See specs/phase-5/specs.md §2.6 ("setup-sequences.ts") and
// specs/phase-5/verification.md, "Pre-registered values", Table U.
//
// `SETUP_SEED`, `SETUP_SEQUENCES`, `SETUP_MAX_STEPS`, `SETUP_EDITS` and
// `SETUP_TICK_MS` are EXACTLY as specs.md §2.6 gives them, and are fixed by that
// document: changing any of them changes the sample, which verification.md Gate 2
// forbids. Draw order is part of the contract — every `rand()` below is called
// in the order specs.md §2.6 writes it. The sample's TOTALS are reported, not
// pre-registered (Table U); what is required of it is that every population
// Table U names occurs at least once.
//
// One `mulberry32(SETUP_SEED)` is shared by the whole sample, so sequence `i`
// depends on every sequence before it, and they are run strictly in order.
// Sequence `i` first draws its room — on `setup` — then generates events, one at
// a time, from the ENGINE's current screen, and gives each to the engine before
// generating the next:
//
// | Screen     | Event |
// |------------|-------|
// | `setup`    | while fewer than `SETUP_EDITS` edits since the last arrival on `setup`: an edit. Then `openRoom`; if the guard refuses it (nothing picked), `pickCategory('c0', true)`, then `openRoom` |
// | `ready`    | `r = rand()`: `< 0.2` `backToSetup`; `< 0.4` one edit (inert); else `startMatch` with a draw |
// | `play`     | `rand() < 0.15` ? (`r = rand()`: `< 0.5` `correct`; `< 0.8` `skip`; else `hint`) : `tick(SETUP_TICK_MS)` then `passTurn` |
// | `roundEnd` | `r = rand()`: `< 0.7` `nextRound` with a draw; `< 0.8` `resetMatch`; else one edit (inert) |
// | `match`    | the first time: `resetMatch` (the sequence continues on `setup`); the second time: the sequence ends |
//
// An EVENT is one action, except a tick event, which is two: `tick` then
// `passTurn`, every time, as a driver sends them — the `passTurn` is inert until
// due, and after a tick that ended the round. A sequence also ends at
// `SETUP_MAX_STEPS` events.
//
// A DRAW is the engine's public draw and Phase 4's harness permutation:
// `categoryId = drawCategory(drawableCategories(state), rand)`, then
// `questions = permutation(rand, 3).map(k => categoryQuestions(categoryId)[k])`
// (match-sequences.ts's `drawnQuestions`), so the sample does not depend on
// `shuffleQuestions`.
//
// Two readings of specs.md §2.6's wording, stated so that they are not
// discoveries; neither changes a pre-registered value, since the sample's totals
// are not pre-registered:
// - A player id: "an existing player's (floor(rand() × players.length)) when
//   rand() < 0.8 and there is one, else 'ghost'" is drawn in the order written —
//   the `rand() < 0.8` first, always; the index only when that holds and the room
//   has a player. A name ("TEAM_NAMES[team][floor(rand() × 4)] when rand() <
//   0.8, else 'x'") is drawn the same way: the `rand() < 0.8` first, the index
//   only when it holds.
// - An ARRIVAL on `setup` is the sequence's start, or a step that moves the
//   screen onto `setup` from another (`backToSetup`, `resetMatch`). The guard's
//   `pickCategory('c0', true)` is not one of the `SETUP_EDITS` edits.
//
// Generation reads the engine's state, not an oracle's: this sample tests the
// engine against its own invariants (testing/invariants.ts, match-invariants.ts,
// setup-invariants.ts), not against the prototype.
//
// Every question here is synthetic (testing/rooms.ts). Nothing is copied from
// design/.
//
// Test support: excluded from coverage (REQ-5.9, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts` and by
// other files under `testing/`.

import { drawableCategories, drawCategory } from '../draw.js'
import { reduce } from '../reducer.js'
import { createRoom } from '../room.js'
import { TEAM_NAMES } from '../rules.js'
import type { Action, CategoryId, Player, PlayerId, Question, RoomState, Team } from '../types.js'
import { drawnQuestions, permutation } from './match-sequences.js'
import { mulberry32 } from './prng.js'
import { categoryIds } from './rooms.js'

export const SETUP_SEED = 0x20265005
export const SETUP_SEQUENCES = 300
export const SETUP_MAX_STEPS = 2_000 // events, not actions
export const SETUP_EDITS = 40 // setup edits before the room is opened
export const SETUP_TICK_MS = 1_000 // the sample's tick; the clock's own precision is Phases 3–4's

/** The sample's eleven categories, `c0 … c10`. */
const CATEGORIES = categoryIds(11)

type Rand = () => number

/**
 * Sequence `i`'s room, on `setup` — its draws in this order: `k = floor(rand() ×
 * 11)` players `p1 … pk`, each on team `rand() < 0.5 ? 'a' : 'b'`; `judgeIndex =
 * floor(rand() × max(1, k))`; `rotateJudge = rand() < 0.5`; `winsNeeded = [2, 3,
 * 4][floor(rand() × 3)]`; then those of `c0 … c10` for which `rand() < 0.5`, in
 * order.
 */
export function drawSetupRoom(rand: Rand): RoomState {
  const k = Math.floor(rand() * 11)
  const players = Array.from({ length: k }, (_, n): Player => {
    const team: Team = rand() < 0.5 ? 'a' : 'b'
    return { id: `p${n + 1}`, name: `p${n + 1}`, team }
  })
  const judgeIndex = Math.floor(rand() * Math.max(1, k))
  const rotateJudge = rand() < 0.5
  const winsNeeded = [2, 3, 4][Math.floor(rand() * 3)]
  if (winsNeeded === undefined) {
    throw new RangeError('drawSetupRoom needs rand() in [0, 1) for winsNeeded')
  }
  const pickedCategories = CATEGORIES.filter(() => rand() < 0.5)
  return {
    ...createRoom({
      roomCode: 'TEST05',
      teamA: 'أ',
      teamB: 'ب',
      config: { roundSeconds: 45, winsNeeded },
    }),
    players,
    judgeIndex,
    rotateJudge,
    pickedCategories,
  }
}

/** An existing player's id when `rand() < 0.8` and there is one, else `'ghost'`. */
function drawPlayerId(rand: Rand, state: RoomState): PlayerId {
  if (rand() < 0.8 && state.players.length > 0) {
    const player = state.players[Math.floor(rand() * state.players.length)]
    if (player === undefined) throw new RangeError('drawPlayerId needs rand() in [0, 1)')
    return player.id
  }
  return 'ghost'
}

/** A team's name from its list when `rand() < 0.8`, else `'x'`. */
function drawTeamName(rand: Rand, team: Team): string {
  if (rand() >= 0.8) return 'x'
  const name = TEAM_NAMES[team][Math.floor(rand() * 4)]
  if (name === undefined) throw new RangeError('drawTeamName needs rand() in [0, 1)')
  return name
}

/**
 * One setup edit (specs.md §2.6): `r = rand()` — `< 0.15` `removePlayer`, `<
 * 0.30` `swapTeam`, `< 0.40` `renameTeam`, `< 0.55` `setJudge`, `< 0.62`
 * `setRotateJudge(rand() < 0.5)`, else `pickCategory(c<floor(rand() × 11)>,
 * rand() < 0.5)`. A team is `rand() < 0.5 ? 'a' : 'b'`.
 */
export function drawSetupEdit(rand: Rand, state: RoomState): Action {
  const r = rand()
  if (r < 0.15) return { type: 'removePlayer', playerId: drawPlayerId(rand, state) }
  if (r < 0.3) return { type: 'swapTeam', playerId: drawPlayerId(rand, state) }
  if (r < 0.4) {
    const team: Team = rand() < 0.5 ? 'a' : 'b'
    return { type: 'renameTeam', team, name: drawTeamName(rand, team) }
  }
  if (r < 0.55) return { type: 'setJudge', playerId: drawPlayerId(rand, state) }
  if (r < 0.62) return { type: 'setRotateJudge', rotate: rand() < 0.5 }
  const categoryId: CategoryId = `c${Math.floor(rand() * 11)}`
  return { type: 'pickCategory', categoryId, picked: rand() < 0.5 }
}

/** A draw (specs.md §2.6): the engine's public category draw, then the harness's permutation of three. */
function drawRound(
  rand: Rand,
  state: RoomState,
): { readonly categoryId: CategoryId; readonly questions: readonly [Question, ...Question[]] } {
  const categoryId = drawCategory(drawableCategories(state), rand)
  return { categoryId, questions: drawnQuestions(categoryId, permutation(rand, 3)) }
}

/**
 * Called for the room each sequence starts from (`prev` and `action` `null`,
 * `event` 0), then for the state after every action the engine is given, with
 * the state before it, the action, and the 1-based number of the event the
 * action belongs to — a tick event's `tick` and `passTurn` share one.
 */
export type SetupVisit = (
  state: RoomState,
  prev: RoomState | null,
  action: Action | null,
  event: number,
) => void

export interface SetupRunOptions {
  /** Called for every state the engine visits (see `SetupVisit`). */
  readonly visit?: SetupVisit
  /** The reducer the sample drives — the engine's `reduce` unless a test wraps it. */
  readonly reduce?: (state: RoomState, action: Action) => RoomState
}

/** How a sequence ended (specs.md §2.6). */
export type SetupSequenceEnd =
  /** On `match` for the second time: the sequence ends before any event. */
  | 'twoMatches'
  /** `SETUP_MAX_STEPS` events. */
  | 'maxSteps'

export interface SetupSequenceRun {
  /** 0-based position in the sample. */
  readonly index: number
  /** The room the sequence started from, on `setup`. */
  readonly room: RoomState
  readonly events: number
  /** Actions given to the engine: one per event, two per tick event. */
  readonly actions: number
  /** Times the engine's screen became `match` from another screen. */
  readonly matchesEnded: number
  readonly end: SetupSequenceEnd
}

/** One sequence, generated from the engine's screen and given to the engine event by event. */
function runSequence(rand: Rand, index: number, options: SetupRunOptions): SetupSequenceRun {
  const step = options.reduce ?? reduce
  const { visit } = options
  const room = drawSetupRoom(rand)
  visit?.(room, null, null, 0)

  let state = room
  let events = 0
  let actions = 0
  let matchesEnded = 0
  /** Setup edits since the last arrival on `setup`. */
  let edits = 0
  /** The last `openRoom` was refused by the guard: the next event is the guard's pick. */
  let refused = false

  const apply = (action: Action): void => {
    const prev = state
    state = step(prev, action)
    actions += 1
    visit?.(state, prev, action, events)
    if (prev.screen !== 'match' && state.screen === 'match') matchesEnded += 1
    if (prev.screen !== 'setup' && state.screen === 'setup') {
      edits = 0
      refused = false
    }
  }
  const done = (end: SetupSequenceEnd): SetupSequenceRun => ({
    index,
    room,
    events,
    actions,
    matchesEnded,
    end,
  })

  while (events < SETUP_MAX_STEPS) {
    switch (state.screen) {
      case 'setup': {
        events += 1
        if (edits < SETUP_EDITS) {
          edits += 1
          apply(drawSetupEdit(rand, state))
        } else if (refused) {
          // The guard's recovery (specs.md §2.6). Not reached at SETUP_SEED: 0 of
          // the sample's 1,134 openRooms are refused — verification.md Table U,
          // Correction 2026-10-03, records it rather than working around it.
          refused = false
          apply({ type: 'pickCategory', categoryId: 'c0', picked: true })
        } else {
          apply({ type: 'openRoom' })
          if (state.screen === 'setup') refused = true
        }
        break
      }
      case 'ready': {
        events += 1
        const r = rand()
        if (r < 0.2) apply({ type: 'backToSetup' })
        else if (r < 0.4) apply(drawSetupEdit(rand, state))
        else apply({ type: 'startMatch', ...drawRound(rand, state) })
        break
      }
      case 'play': {
        events += 1
        if (rand() < 0.15) {
          const r = rand()
          apply({ type: r < 0.5 ? 'correct' : r < 0.8 ? 'skip' : 'hint' })
        } else {
          apply({ type: 'tick', ms: SETUP_TICK_MS })
          apply({ type: 'passTurn' })
        }
        break
      }
      case 'roundEnd': {
        events += 1
        const r = rand()
        if (r < 0.7) apply({ type: 'nextRound', ...drawRound(rand, state) })
        else if (r < 0.8) apply({ type: 'resetMatch' })
        else apply(drawSetupEdit(rand, state))
        break
      }
      case 'match': {
        if (matchesEnded >= 2) return done('twoMatches')
        events += 1
        apply({ type: 'resetMatch' })
        break
      }
    }
  }
  return done('maxSteps')
}

/**
 * The sample: `SETUP_SEQUENCES` sequences, in order, all drawn from ONE shared
 * `mulberry32(SETUP_SEED)`. Each is run as it is yielded — its visits made —
 * so the caller sees its result after every one of its states.
 */
export function* setupSequences(options: SetupRunOptions = {}): Generator<SetupSequenceRun> {
  const rand = mulberry32(SETUP_SEED)
  for (let index = 0; index < SETUP_SEQUENCES; index += 1) {
    yield runSequence(rand, index, options)
  }
}
