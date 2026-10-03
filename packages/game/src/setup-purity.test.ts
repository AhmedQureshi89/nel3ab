import { beforeAll, describe, expect, test, vi } from 'vitest'

import { displaySeconds, remainingMs } from './clock.js'
import { shuffleQuestions } from './draw.js'
import { matchWinner } from './match.js'
import { reduce } from './reducer.js'
import { acceptsJudgeActions, currentQuestion } from './room.js'
import { TEAM_NAMES } from './rules.js'
import { canOpenRoom, currentJudge, shuffleTeamName } from './setup.js'
import { mulberry32 } from './testing/prng.js'
import {
  SETUP_SEED,
  SETUP_SEQUENCES,
  setupSequences,
  type SetupVisit,
} from './testing/setup-sequences.js'
import type { Action, Question, RoomState, Screen, Team } from './types.js'

// Purity of the setup rules — specs/phase-5/verification.md Gate 2's NFR-5.3
// boxes: "Pure" and "No ambient time, randomness or timers". See
// specs/phase-5/requirements.md NFR-5.3 and NFR-5.2, specs.md §2.6 (the sample)
// and §2.7 (this file's row), and Phase 4's match-purity.test.ts, whose approach
// this follows and which is not edited.
//
// What is walked. Table U's sample — SETUP_SEQUENCES (300) sequences from
// SETUP_SEED, each generated from the ENGINE's current screen and given to it
// event by event (testing/setup-sequences.ts, unchanged) — the same sample
// setup-flow.test.ts checks the invariants over. It edits setup with all six
// edits, opens the room, goes back, opens it again, plays a match and resets:
// every one of the eight setup actions and every Phase 3–4 action but
// `startRound`, which no driver dispatches.
//
// The generator's own run is the UNFROZEN run: nothing in it is frozen. Beside
// it, this file keeps a FROZEN CHAIN — each sequence's room copied into separate
// objects, every state and every action deep-frozen before `reduce` sees it —
// fed the same actions, pair by pair, through the generator's `visit`. Each pair
// is reduced twice on the frozen chain; the first result is compared with the
// unfrozen run's result for the same pair, the two results with each other, and
// the result with its input.
//
// Validation precedes inertness. At every ARRIVAL on a screen — a sequence's
// room, and every state whose screen differs from the one before it — each of
// Gate 1's malformed forms (verification.md, the REQ-5.1 box) is given to the
// frozen chain's state and must throw a RangeError, on every screen, including
// those where the well-formed edit would be inert.
//
// Counting. The generator visits each sequence's room once, then the state after
// every action it gives the engine: two per tick event (`tick`, `passTurn`), one
// per other event. So for the whole pass: pairs = actions, states = sequences +
// actions.

/** Failures kept per check, for the assertion's message. */
const KEEP = 5
const keep = (list: string[], entry: string): void => {
  if (list.length < KEEP) list.push(entry)
}

/**
 * Every action type the reducer takes — Phase 3's five, Phase 4's four and
 * Phase 5's eight. `startRound` is never given by the sample (no driver
 * dispatches it) and is counted all the same, so that each count is over every
 * type.
 */
type ActionType = Action['type']
const perType = (): Record<ActionType, number> => ({
  tick: 0,
  passTurn: 0,
  correct: 0,
  skip: 0,
  hint: 0,
  startMatch: 0,
  nextRound: 0,
  resetMatch: 0,
  startRound: 0,
  removePlayer: 0,
  swapTeam: 0,
  renameTeam: 0,
  setJudge: 0,
  setRotateJudge: 0,
  pickCategory: 0,
  openRoom: 0,
  backToSetup: 0,
})

/** The six setup edits — inert off `setup` (REQ-5.1). */
const EDIT_TYPES = [
  'removePlayer',
  'swapTeam',
  'renameTeam',
  'setJudge',
  'setRotateJudge',
  'pickCategory',
] as const satisfies readonly ActionType[]

const SCREENS: readonly Screen[] = ['setup', 'ready', 'play', 'roundEnd', 'match']
const perScreen = (): Record<Screen, number> => ({
  setup: 0,
  ready: 0,
  play: 0,
  roundEnd: 0,
  match: 0,
})

// ============================================================================
// The frozen chain's machinery — as match-purity.test.ts's
// ============================================================================

/**
 * Deep-freeze `value` and everything reachable from it through own
 * properties, CHILDREN FIRST, skipping whatever is already frozen; returns
 * `value`. match-purity.test.ts's function, for the same reason: testing/
 * deep-freeze.ts (Phase 3's, unchanged) remembers every object it walks in a
 * WeakSet, and `Object.isFrozen` stands in for that memory here — sound because
 * nothing in this pass is frozen any other way, and this function freezes an
 * object only after all its children.
 */
function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  const record = value as Record<PropertyKey, unknown>
  for (const key of Reflect.ownKeys(record)) {
    const child = record[key]
    if (typeof child === 'object' && child !== null && !Object.isFrozen(child)) freezeDeep(child)
  }
  return Object.freeze(value)
}

/** Plain data — arrays, plain objects, primitives, as a `RoomState` is — copied into new objects, nothing shared. */
function copyDeep(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) return value.map((item: unknown) => copyDeep(item))
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyDeep(child)]))
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

/**
 * Whether `x` and `y` are deep-equal (primitives by `Object.is`, objects by
 * prototype, own keys and values) — given a pair `knownX`, `knownY` already
 * known to be deep-equal, with which `x` and `y` may share parts: a path where
 * `x` still holds `knownX`'s value and `y` `knownY`'s is not walked. With no
 * known pair (`undefined`), this is a full deep equality. match-purity.test.ts's
 * function, whose header gives why the shortcut is sound: the frozen side cannot
 * have changed since it was shown equal, and a reducer that wrote to the
 * unfrozen side's input would write to the frozen chain's in the same step —
 * which throws a TypeError, and is counted.
 */
function equalGiven(x: unknown, y: unknown, knownX: unknown, knownY: unknown): boolean {
  if (Object.is(x, y)) return true
  if (Object.is(x, knownX) && Object.is(y, knownY)) return true
  const xr = asRecord(x)
  const yr = asRecord(y)
  if (xr === undefined || yr === undefined) return false
  if (Object.getPrototypeOf(xr) !== Object.getPrototypeOf(yr)) return false
  const keys = Object.keys(xr)
  if (keys.length !== Object.keys(yr).length) return false
  const kx = asRecord(knownX)
  const ky = asRecord(knownY)
  for (const key of keys) {
    if (!Object.hasOwn(yr, key)) return false
    const xv = xr[key]
    const yv = yr[key]
    if (Object.is(xv, yv)) continue
    const kxv = kx?.[key]
    const kyv = ky?.[key]
    if (Object.is(xv, kxv) && Object.is(yv, kyv)) continue
    if (!equalGiven(xv, yv, kxv, kyv)) return false
  }
  return true
}

/** A question copied into new objects, nothing shared with the original. */
const copyQuestion = (q: Question): Question => ({ ...q, alts: [...q.alts], h: [...q.h] })

/**
 * An action copied into new objects for the frozen chain, so that freezing it
 * freezes nothing the unfrozen run holds: a round's `questions` become that
 * round's `questionPool`. Every setup action carries primitives only.
 */
function copyAction(action: Action): Action {
  switch (action.type) {
    case 'startRound':
    case 'startMatch':
    case 'nextRound': {
      const [first, ...rest] = action.questions
      return { ...action, questions: [copyQuestion(first), ...rest.map(copyQuestion)] }
    }
    default:
      return { ...action }
  }
}

// ============================================================================
// Gate 1's malformed forms
// ============================================================================

/** A malformed action. The type system rightly refuses it; it is asserted into shape only to prove the reducer refuses it too. */
const malformed = (action: object): Action => action as Action

/**
 * The malformed forms of verification.md Gate 1's REQ-5.1 box — `playerId` 7,
 * `{}` or `undefined`; `team` `'c'`; `name` `null`; `rotate` `'yes'`; `picked`
 * 1; `categoryId` 3 — each bad `playerId` on each of the three edits that carry
 * one. Fourteen forms, frozen like everything else the frozen chain is given.
 */
const MALFORMED: readonly (readonly [string, Action])[] = freezeDeep([
  ...(['removePlayer', 'swapTeam', 'setJudge'] as const).flatMap((type) =>
    (
      [
        ['7', 7],
        ['{}', {}],
        ['undefined', undefined],
      ] as const
    ).map(
      ([label, playerId]) => [`${type} playerId ${label}`, malformed({ type, playerId })] as const,
    ),
  ),
  ["renameTeam team 'c'", malformed({ type: 'renameTeam', team: 'c', name: 'x' })],
  ['renameTeam name null', malformed({ type: 'renameTeam', team: 'a', name: null })],
  ["setRotateJudge rotate 'yes'", malformed({ type: 'setRotateJudge', rotate: 'yes' })],
  ['pickCategory categoryId 3', malformed({ type: 'pickCategory', categoryId: 3, picked: true })],
  ['pickCategory picked 1', malformed({ type: 'pickCategory', categoryId: 'c0', picked: 1 })],
])

// ============================================================================
// One pass, every check at every pair
// ============================================================================

/** The last pair of states shown deep-equal: the frozen chain's and the unfrozen run's, after the same pair. */
interface ShownEqual {
  readonly frozen: RoomState
  readonly unfrozen: RoomState
}

interface PurityTally {
  sequences: number
  events: number
  /** Actions the generator gave the engine (its own count). */
  actions: number
  /** States the generator visited: each sequence's room, then one per action. */
  states: number
  /** Pairs the unfrozen run reduced (visits after an action), and pairs the frozen chain reduced twice, by type. */
  pairs: { unfrozen: number; frozen: number; byType: Record<ActionType, number> }
  /** "Pure", frozen: TypeErrors from writing to frozen input; frozen results that differ from the unfrozen run's; sequences whose rooms' copies already differ. */
  frozen: { typeErrors: number; differences: number; roomDifferences: number; first: string[] }
  /** "Pure", deterministic: the frozen chain's two reductions of a pair differ. */
  determinism: { differing: number; first: string[] }
  /** "Pure", inert: results `===` their input on the frozen chain and on the unfrozen run, and results deep-equal to their input but not `===` — by action type. */
  inert: {
    returns: Record<ActionType, number>
    unfrozenReturns: Record<ActionType, number>
    copies: Record<ActionType, number>
    first: string[]
  }
  /** `openRoom`s given where the guard refuses by its own definition — not on setup, or nothing picked. */
  guardRefusals: number
  /** "Pure", validation first: arrivals per screen, malformed forms that threw RangeError per screen, and those that did not throw or threw something else. */
  validation: {
    arrivals: Record<Screen, number>
    thrown: Record<Screen, number>
    notThrown: number
    wrongError: number
    first: string[]
  }
}

function checkEveryPair(): PurityTally {
  const t: PurityTally = {
    sequences: 0,
    events: 0,
    actions: 0,
    states: 0,
    pairs: { unfrozen: 0, frozen: 0, byType: perType() },
    frozen: { typeErrors: 0, differences: 0, roomDifferences: 0, first: [] },
    determinism: { differing: 0, first: [] },
    inert: { returns: perType(), unfrozenReturns: perType(), copies: perType(), first: [] },
    guardRefusals: 0,
    validation: {
      arrivals: perScreen(),
      thrown: perScreen(),
      notThrown: 0,
      wrongError: 0,
      first: [],
    },
  }

  /** The frozen chain's current state; replaced at each sequence's room. */
  let frozenState: RoomState | null = null
  /** The last pair of states shown equal; `null` until a sequence's rooms are. */
  let shown: ShownEqual | null = null
  let sequence = -1
  let pair = 0

  /** One reduction of the frozen chain; a TypeError is a write to frozen input, tallied, and gives `null`. */
  const reduceFrozen = (state: RoomState, action: Action, at: () => string): RoomState | null => {
    try {
      return reduce(state, action)
    } catch (error) {
      if (!(error instanceof TypeError)) throw error
      t.frozen.typeErrors += 1
      keep(t.frozen.first, `${at()} (${action.type}): ${error.message}`)
      return null
    }
  }

  /** At an arrival on a screen: every malformed form must throw a RangeError on the frozen state. */
  const checkMalformed = (state: RoomState, at: () => string): void => {
    t.validation.arrivals[state.screen] += 1
    for (const [label, action] of MALFORMED) {
      try {
        reduce(state, action)
        t.validation.notThrown += 1
        keep(t.validation.first, `${at()} on ${state.screen}: ${label} did not throw`)
      } catch (error) {
        if (error instanceof RangeError) {
          t.validation.thrown[state.screen] += 1
        } else {
          t.validation.wrongError += 1
          keep(t.validation.first, `${at()} on ${state.screen}: ${label} threw ${String(error)}`)
        }
      }
    }
  }

  const visit: SetupVisit = (state, prev, action, event) => {
    t.states += 1
    if (prev === null || action === null) {
      // A sequence's room: the frozen chain starts from a copy of it, made of
      // objects of its own, and the two are first shown equal — walked in full.
      sequence += 1
      pair = 0
      frozenState = freezeDeep(copyDeep(state) as RoomState)
      if (equalGiven(frozenState, state, undefined, undefined)) {
        shown = { frozen: frozenState, unfrozen: state }
      } else {
        shown = null
        t.frozen.roomDifferences += 1
        keep(t.frozen.first, `#${sequence}: the room's copy differs from the room`)
      }
      checkMalformed(frozenState, () => `#${sequence} room`)
      return
    }
    if (frozenState === null) throw new Error('a pair was visited before any room')

    // Where this pair is, for a failure message — built only when one is kept.
    const thisPair = pair
    const at = (): string => `#${sequence} event ${event} pair ${thisPair}`
    pair += 1
    t.pairs.unfrozen += 1
    const type: ActionType = action.type
    if (state === prev) t.inert.unfrozenReturns[type] += 1
    if (type === 'openRoom' && (prev.screen !== 'setup' || prev.pickedCategories.length === 0)) {
      t.guardRefusals += 1
    }

    // The pair deep-frozen, then reduced — and reduced again.
    const input = frozenState
    const frozenAction = freezeDeep(copyAction(action))
    const first = reduceFrozen(input, frozenAction, at)
    const second = first === null ? null : reduceFrozen(input, frozenAction, at)
    if (first === null || second === null) {
      // A write to frozen input, already tallied: the frozen chain resumes from
      // a fresh copy of the unfrozen run's state, walked in full next time.
      frozenState = freezeDeep(copyDeep(state) as RoomState)
      shown = null
    } else {
      t.pairs.frozen += 1
      t.pairs.byType[type] += 1

      // …the first result equal to the unfrozen run's.
      if (equalGiven(first, state, shown?.frozen, shown?.unfrozen)) {
        shown = { frozen: first, unfrozen: state }
      } else {
        t.frozen.differences += 1
        keep(t.frozen.first, `${at()} (${type}): differs from the unfrozen run`)
      }
      // …the second equal to the first.
      if (!equalGiven(first, second, input, input)) {
        t.determinism.differing += 1
        keep(t.determinism.first, `${at()} (${type})`)
      }
      // …and an action that changes nothing returns its input.
      if (first === input) {
        t.inert.returns[type] += 1
      } else if (equalGiven(first, input, undefined, undefined)) {
        t.inert.copies[type] += 1
        keep(t.inert.first, `${at()} (${type}): an inert action returned a copy`)
      }
      frozenState = freezeDeep(first)
    }

    if (prev.screen !== state.screen) checkMalformed(frozenState, at)
  }

  for (const run of setupSequences({ visit })) {
    t.sequences += 1
    t.events += run.events
    t.actions += run.actions
  }
  return t
}

describe('NFR-5.3: every pair of the setup sample, frozen, reduced twice, against the unfrozen run', () => {
  let t: PurityTally
  // One pass over Table U's sample — about 400,000 (state, action) pairs, each
  // frozen and reduced twice, and 14 malformed forms at every arrival on a
  // screen. The timeout is a ceiling for a slow runner, not the budget: the
  // budget is NFR-5.6's 20 s for the whole project, measured by
  // verification.md Gate 6.
  beforeAll(() => {
    t = checkEveryPair()
  }, 120_000)

  test('the pass walked Table U’s sample — 300 sequences from SETUP_SEED — and reduced every action the generator gave the engine on the frozen chain', () => {
    console.log(
      `NFR-5.3 setup sample: ${JSON.stringify({
        sequences: t.sequences,
        events: t.events,
        actions: t.actions,
        states: t.states,
        frozenPairs: t.pairs.frozen,
        byType: t.pairs.byType,
      })}`,
    )
    expect({ SETUP_SEED, SETUP_SEQUENCES }).toStrictEqual({
      SETUP_SEED: 0x20265005,
      SETUP_SEQUENCES: 300,
    })
    expect({
      sequences: t.sequences,
      states: t.states,
      unfrozenPairs: t.pairs.unfrozen,
      frozenPairs: t.pairs.frozen,
      // A tick event is two actions, every other event one.
      actionsAtLeastEvents: t.actions >= t.events,
    }).toStrictEqual({
      sequences: 300,
      states: 300 + t.actions,
      unfrozenPairs: t.actions,
      frozenPairs: t.actions,
      actionsAtLeastEvents: true,
    })
  })

  test('NFR-5.3 (Pure — frozen inputs): every pair, deep-frozen, reduces with 0 TypeErrors to the unfrozen run’s result', () => {
    expect({ frozenPairs: t.pairs.frozen, ...t.frozen }).toStrictEqual({
      frozenPairs: t.actions,
      typeErrors: 0,
      differences: 0,
      roomDifferences: 0,
      first: [],
    })
  })

  test('NFR-5.3 (Pure — deterministic): every pair reduced twice gives deep-equal results', () => {
    expect({ pairs: t.pairs.frozen, ...t.determinism }).toStrictEqual({
      pairs: t.actions,
      differing: 0,
      first: [],
    })
  })

  test('NFR-5.3 (Pure — identical when inert): every action that changes nothing returns its input (===), counted per action type, the eight setup types included', () => {
    const { returns, unfrozenReturns, copies, first } = t.inert
    console.log(
      `NFR-5.3 inert returns per type: ${JSON.stringify(returns)} of ${JSON.stringify(t.pairs.byType)}`,
    )
    // No inert action returned a copy, and the frozen chain and the unfrozen run
    // agree, type by type, on which actions returned their input.
    expect({ copies, first, returns }).toStrictEqual({
      copies: perType(),
      first: [],
      returns: unfrozenReturns,
    })
    // The property is checked on a real population. Each of the six edits
    // returns its input somewhere — every edit the sample gives on ready or
    // roundEnd is inert (REQ-5.1), and on setup an edit naming 'ghost' or
    // changing nothing is — as do passTurn before it is due and a judge action
    // under a reveal. `openRoom` returns its input exactly where the guard
    // refuses it — asserted equal to the refusals, not to a number: the sample
    // gives it on setup only, and Table U's Correction of 2026-10-03 records that
    // at SETUP_SEED the guard refuses none of them. The types the sample gives only where they take effect never return their
    // input: a tick of 1,000 ms on play always moves the engine time;
    // `backToSetup` is given on ready only, `startMatch` on ready, `nextRound`
    // on roundEnd, `resetMatch` on roundEnd and match.
    expect({
      edits: Object.fromEntries(EDIT_TYPES.map((type) => [type, returns[type] > 0])),
      passTurn: returns.passTurn > 0,
      correct: returns.correct > 0,
      skip: returns.skip > 0,
      hint: returns.hint > 0,
      openRoom: returns.openRoom,
      tick: returns.tick,
      backToSetup: returns.backToSetup,
      startMatch: returns.startMatch,
      nextRound: returns.nextRound,
      resetMatch: returns.resetMatch,
      everyTypeGiven: Object.entries(t.pairs.byType)
        .filter(([type]) => type !== 'startRound')
        .every(([, n]) => n > 0),
      startRoundGiven: t.pairs.byType.startRound,
    }).toStrictEqual({
      edits: Object.fromEntries(EDIT_TYPES.map((type) => [type, true])),
      passTurn: true,
      correct: true,
      skip: true,
      hint: true,
      openRoom: t.guardRefusals,
      tick: 0,
      backToSetup: 0,
      startMatch: 0,
      nextRound: 0,
      resetMatch: 0,
      everyTypeGiven: true,
      startRoundGiven: 0,
    })
  })

  test('NFR-5.3 (Pure — validation first): Gate 1’s 14 malformed forms throw RangeError at every arrival on each of the five screens the sample visits', () => {
    const { arrivals, thrown, notThrown, wrongError, first } = t.validation
    console.log(
      `NFR-5.3 malformed forms: arrivals ${JSON.stringify(arrivals)}, RangeErrors ${JSON.stringify(thrown)}`,
    )
    expect(MALFORMED).toHaveLength(14)
    expect({ thrown, notThrown, wrongError, first }).toStrictEqual({
      thrown: Object.fromEntries(SCREENS.map((s) => [s, MALFORMED.length * arrivals[s]])),
      notThrown: 0,
      wrongError: 0,
      first: [],
    })
    expect(Object.fromEntries(SCREENS.map((s) => [s, arrivals[s] > 0]))).toStrictEqual(
      Object.fromEntries(SCREENS.map((s) => [s, true])),
    )
  })
})

// ============================================================================
// No ambient time, randomness or timers — at run time
// ============================================================================

describe('NFR-5.3 / NFR-5.2: no ambient time, randomness or timers — at run time', () => {
  // As above, the timeout is a ceiling for a slow runner, not the budget.
  test('the setup sample and shuffleTeamName run through the engine and the helpers with Date.now, Math.random, performance.now, setTimeout and setInterval throwing: spies shown live first, then 0 calls', () => {
    // Every public runtime function a driver or a screen calls, counted: the
    // reducer through the generator's `reduce` option; the clock, the room
    // predicates, `matchWinner`, `canOpenRoom` and `currentJudge` on every
    // visited state; `shuffleTeamName` for both teams on every state on setup,
    // where the host can press ↺, with a seeded source; `shuffleQuestions` once
    // per draw, on the drawn questions, with a seeded source (its output is not
    // used — the sample's draws carry their own permutation). The generator
    // itself calls `createRoom`, `drawableCategories` and `drawCategory`, under
    // the same spies.
    const calls = {
      reduce: 0,
      remainingMs: 0,
      displaySeconds: 0,
      currentQuestion: 0,
      acceptsJudgeActions: 0,
      matchWinner: 0,
      canOpenRoom: 0,
      currentJudge: 0,
      shuffleTeamName: 0,
      shuffleQuestions: 0,
    }
    const counted = (state: RoomState, action: Action): RoomState => {
      calls.reduce += 1
      return reduce(state, action)
    }
    const source = mulberry32(SETUP_SEED + 1)
    const TEAMS: readonly Team[] = ['a', 'b']
    let setupStates = 0
    let draws = 0
    const visit: SetupVisit = (state, _prev, action) => {
      for (const team of TEAMS) {
        calls.remainingMs += 1
        const ms = remainingMs(state.clock, team)
        calls.displaySeconds += 1
        displaySeconds(ms)
      }
      calls.currentQuestion += 1
      currentQuestion(state)
      calls.acceptsJudgeActions += 1
      acceptsJudgeActions(state)
      calls.matchWinner += 1
      matchWinner(state)
      calls.canOpenRoom += 1
      canOpenRoom(state)
      calls.currentJudge += 1
      currentJudge(state)
      if (state.screen === 'setup') {
        setupStates += 1
        calls.shuffleTeamName += 2
        shuffleTeamName(state.teamA, TEAM_NAMES.a, source)
        shuffleTeamName(state.teamB, TEAM_NAMES.b, source)
      }
      if (action !== null && (action.type === 'startMatch' || action.type === 'nextRound')) {
        draws += 1
        calls.shuffleQuestions += 1
        shuffleQuestions(action.questions, source)
      }
    }

    const throwing = (name: string) => (): never => {
      throw new Error(`${name} was called during a run of the engine`)
    }
    const spies = {
      'Date.now': vi.spyOn(Date, 'now').mockImplementation(throwing('Date.now')),
      'Math.random': vi.spyOn(Math, 'random').mockImplementation(throwing('Math.random')),
      'performance.now': vi
        .spyOn(performance, 'now')
        .mockImplementation(throwing('performance.now')),
      setTimeout: vi.spyOn(globalThis, 'setTimeout').mockImplementation(throwing('setTimeout')),
      setInterval: vi.spyOn(globalThis, 'setInterval').mockImplementation(throwing('setInterval')),
    }
    const callsNow = (): Record<string, number> =>
      Object.fromEntries(Object.entries(spies).map(([name, spy]) => [name, spy.mock.calls.length]))
    /** Calls each spied function once; `true` for each that threw — the spy installed and live. */
    const fire = (): boolean[] =>
      [
        () => Date.now(),
        () => Math.random(),
        () => performance.now(),
        () => clearTimeout(setTimeout(() => undefined, 1_000_000)),
        () => clearInterval(setInterval(() => undefined, 1_000_000)),
      ].map((call) => {
        try {
          call()
          return false
        } catch {
          return true
        }
      })

    let liveBefore: boolean[]
    let before: Record<string, number>
    let after: Record<string, number>
    let liveAfter: boolean[]
    let sequences = 0
    let events = 0
    let actions = 0
    try {
      // The spies are first shown to fire …
      liveBefore = fire()
      before = callsNow()
      // … then the whole workload runs under them: generating the sample,
      // drawing, reducing, reading, shuffling.
      for (const run of setupSequences({ visit, reduce: counted })) {
        sequences += 1
        events += run.events
        actions += run.actions
      }
      after = callsNow()
      // … and are still installed at the end.
      liveAfter = fire()
    } finally {
      for (const spy of Object.values(spies)) spy.mockRestore()
    }

    expect({ liveBefore, liveAfter }).toStrictEqual({
      liveBefore: [true, true, true, true, true],
      liveAfter: [true, true, true, true, true],
    })
    // One call each from the first firing, and none from the run.
    expect(before).toStrictEqual({
      'Date.now': 1,
      'Math.random': 1,
      'performance.now': 1,
      setTimeout: 1,
      setInterval: 1,
    })
    expect(after).toStrictEqual(before)

    // The whole workload ran under the spies: every call the run made is counted.
    const states = sequences + actions
    expect({
      sequences,
      calls,
      setupStatesSeen: setupStates > 0,
      drawsMade: draws > 0,
    }).toStrictEqual({
      sequences: 300,
      calls: {
        reduce: actions,
        remainingMs: 2 * states,
        displaySeconds: 2 * states,
        currentQuestion: states,
        acceptsJudgeActions: states,
        matchWinner: states,
        canOpenRoom: states,
        currentJudge: states,
        shuffleTeamName: 2 * setupStates,
        shuffleQuestions: draws,
      },
      setupStatesSeen: true,
      drawsMade: true,
    })
    console.log(
      `NFR-5.3 ambient: ${sequences} sequences, ${events} events, ${actions} reductions, ${draws} draws, ${calls.shuffleTeamName} shuffleTeamName calls over ${setupStates} setup states, spy calls during the run ${JSON.stringify(Object.fromEntries(Object.keys(after).map((k) => [k, (after[k] ?? 0) - (before[k] ?? 0)])))}`,
    )
  }, 120_000)
})
