import { beforeAll, describe, expect, test } from 'vitest'

import { nextRoundChoices, unusedCategories } from './draw.js'
import { reduce } from './reducer.js'
import { createRoom } from './room.js'
import { deepEqual, INVARIANT_IDS } from './testing/invariants.js'
import {
  assertMatchInvariants,
  MATCH_INVARIANT_IDS,
  MatchInvariantViolation,
  type AnyInvariantId,
} from './testing/match-invariants.js'
import { categoryQuestions } from './testing/rooms.js'
import {
  assertSetupInvariants,
  SETUP_INVARIANT_IDS,
  SetupInvariantViolation,
  setupInvariantViolations,
  type SetupInvariantId,
} from './testing/setup-invariants.js'
import {
  SETUP_EDITS,
  SETUP_MAX_STEPS,
  SETUP_SEED,
  SETUP_SEQUENCES,
  SETUP_TICK_MS,
  setupSequences,
  type SetupVisit,
} from './testing/setup-sequences.js'
import type { Action, Player, RoomState, Screen } from './types.js'

// REQ-5.7 — specs/phase-5/verification.md Gate 2, "The invariants, over the
// sample" and "No path to the fallback". See specs/phase-5/requirements.md
// REQ-5.7 and specs.md §2.6 (the sample, K1–K5) and §2.7 (this file's row).
//
// The setup sample — Table U's 300 pre-registered sequences that edit setup,
// open the room, go back, open it again and play a match — runs through
// `reduce`, and after EVERY step Phase 3's I1–I10, Phase 4's J1–J8 (both through
// Phase 4's `assertMatchInvariants`, imported unchanged) and this phase's K1–K5
// (`assertSetupInvariants`) are asserted. J6 (`usedCategories.length === round`)
// holds only because no flow reaches a draw with every category used (Phase 4,
// R6); setup changes the selection, so this is where a new path to that draw
// would appear. None is added — setup actions are inert off `setup`, and on
// `setup` and `ready` the used list is always empty (K1) — and this file is the
// record Phase 4 asked for.
//
// The totals are reported, not pre-registered (Table U), and printed for the
// record; what is asserted of them is that every population Table U names —
// as its Correction of 2026-10-03 leaves the list — occurs at least once, so
// that "0 violations" is said of a sample that went everywhere it was meant
// to. Run with `--reporter=verbose` to see the print.
//
// Purity over the same sample (NFR-5.3) is setup-purity.test.ts's.

/** Failures kept per check, for the assertion's message. */
const KEEP = 5
const keep = (list: string[], entry: string): void => {
  if (list.length < KEEP) list.push(entry)
}

type ActionType = Action['type']
type InvariantId = AnyInvariantId | SetupInvariantId

const ALL_INVARIANT_IDS: readonly InvariantId[] = [
  ...INVARIANT_IDS,
  ...MATCH_INVARIANT_IDS,
  ...SETUP_INVARIANT_IDS,
]

const noViolations = (): Record<InvariantId, number> =>
  Object.fromEntries(ALL_INVARIANT_IDS.map((id) => [id, 0])) as Record<InvariantId, number>

/** The six setup edits — the actions REQ-5.1 makes effective on `setup` only. */
const EDIT_TYPES: ReadonlySet<ActionType> = new Set<ActionType>([
  'removePlayer',
  'swapTeam',
  'renameTeam',
  'setJudge',
  'setRotateJudge',
  'pickCategory',
])

const SCREENS: readonly Screen[] = ['setup', 'ready', 'play', 'roundEnd', 'match']
const perScreen = <T>(make: () => T): Record<Screen, T> =>
  Object.fromEntries(SCREENS.map((screen) => [screen, make()])) as Record<Screen, T>

interface FlowTally {
  sequences: number
  events: number
  actions: number
  /** States visited: each sequence's room, then one per action. */
  states: number
  ends: { twoMatches: number; maxSteps: number }
  statesByScreen: Record<Screen, number>
  violatingStates: number
  byInvariant: Record<InvariantId, number>
  first: string[]
  /** Actions given, and of them those that changed the state, by type. */
  byType: Partial<Record<ActionType, { given: number; effective: number }>>
  openRoom: {
    effective: number
    /** Refused by the zero-category guard (nothing picked). */
    refused: number
    /** Effective, and the fill added players. */
    fills: number
    /** Effective, and not the sequence's first effective one. */
    again: number
    /** Effective, and the first since a resetMatch — "a resetMatch back to setup followed by a second openRoom". */
    afterReset: number
  }
  backToSetup: number
  resetMatch: { fromRoundEnd: number; fromMatch: number }
  matchesEnded: number
  /** The six edits, by the screen they were given on: attempted, and inert (the state returned as is). */
  edits: Record<Screen, { attempted: number; inert: number }>
  /** `nextRound` draws, and those made where Phase 4's fallback answers — the unused list empty. */
  nextRound: { draws: number; fallback: number; choicesNotUnused: number }
  /** Sequences whose own count of matches ended disagrees with the visits' — the machinery checking itself. */
  machineryMismatches: number
}

function runSample(): FlowTally {
  const t: FlowTally = {
    sequences: 0,
    events: 0,
    actions: 0,
    states: 0,
    ends: { twoMatches: 0, maxSteps: 0 },
    statesByScreen: perScreen(() => 0),
    violatingStates: 0,
    byInvariant: noViolations(),
    first: [],
    byType: {},
    openRoom: { effective: 0, refused: 0, fills: 0, again: 0, afterReset: 0 },
    backToSetup: 0,
    resetMatch: { fromRoundEnd: 0, fromMatch: 0 },
    matchesEnded: 0,
    edits: perScreen(() => ({ attempted: 0, inert: 0 })),
    nextRound: { draws: 0, fallback: 0, choicesNotUnused: 0 },
    machineryMismatches: 0,
  }

  // Per sequence: effective openRooms so far, a resetMatch not yet followed by
  // one, and the matches the visits saw end.
  let opened = 0
  let resetPending = false
  let matchesSeen = 0
  let sequence = 0

  const visit: SetupVisit = (state, prev, action, event) => {
    t.states += 1
    t.statesByScreen[state.screen] += 1

    // I1–I10 and J1–J8, then K1–K5 — every one, at every state.
    const ids: InvariantId[] = []
    try {
      assertMatchInvariants(state, prev ?? undefined)
    } catch (error) {
      if (!(error instanceof MatchInvariantViolation)) throw error
      ids.push(...error.ids)
    }
    try {
      assertSetupInvariants(state, prev ?? undefined)
    } catch (error) {
      if (!(error instanceof SetupInvariantViolation)) throw error
      ids.push(...error.ids)
    }
    if (ids.length > 0) {
      t.violatingStates += 1
      for (const id of ids) t.byInvariant[id] += 1
      keep(t.first, `#${sequence} event ${event} (${action?.type ?? 'room'}): ${ids.join(' ')}`)
    }

    if (prev === null || action === null) {
      opened = 0
      resetPending = false
      matchesSeen = 0
      return
    }

    const effective = state !== prev
    const counts = (t.byType[action.type] ??= { given: 0, effective: 0 })
    counts.given += 1
    if (effective) counts.effective += 1
    if (prev.screen !== 'match' && state.screen === 'match') matchesSeen += 1

    if (EDIT_TYPES.has(action.type)) {
      t.edits[prev.screen].attempted += 1
      if (!effective) t.edits[prev.screen].inert += 1
    }
    switch (action.type) {
      case 'openRoom':
        if (!effective) {
          t.openRoom.refused += 1
          break
        }
        t.openRoom.effective += 1
        if (state.players !== prev.players) t.openRoom.fills += 1
        if (opened > 0) t.openRoom.again += 1
        if (resetPending) t.openRoom.afterReset += 1
        opened += 1
        resetPending = false
        break
      case 'backToSetup':
        if (effective) t.backToSetup += 1
        break
      case 'resetMatch':
        if (effective && prev.screen === 'roundEnd') t.resetMatch.fromRoundEnd += 1
        if (effective && prev.screen === 'match') t.resetMatch.fromMatch += 1
        if (effective) resetPending = true
        break
      case 'nextRound': {
        // The draw was made from `prev`, the round-end state: drawableCategories
        // answered with nextRoundChoices(prev), which falls back to the whole
        // selection exactly when the unused list is empty.
        t.nextRound.draws += 1
        const unused = unusedCategories(prev)
        if (unused.length === 0) t.nextRound.fallback += 1
        if (!deepEqual(nextRoundChoices(prev), unused)) t.nextRound.choicesNotUnused += 1
        break
      }
      default:
        break
    }
  }

  for (const run of setupSequences({ visit })) {
    t.sequences += 1
    t.events += run.events
    t.actions += run.actions
    t.matchesEnded += run.matchesEnded
    t.ends[run.end] += 1
    if (run.matchesEnded !== matchesSeen) t.machineryMismatches += 1
    sequence += 1
  }
  return t
}

describe('REQ-5.7: the setup sample through reduce, I1–I10, J1–J8 and K1–K5 after every step', () => {
  let t: FlowTally
  // Every state of 300 sequences of up to 2,000 events, 23 invariants at each.
  // The timeout is a ceiling for a slow runner, not the budget: the budget is
  // NFR-5.6's 20 s for the whole project, measured by verification.md Gate 6.
  beforeAll(() => {
    t = runSample()
  }, 120_000)

  test('the sample is Table U’s: 300 sequences from SETUP_SEED, every action’s state visited', () => {
    // The totals, for the record — printed before anything is asserted of them.
    console.log(
      `REQ-5.7 setup sample: ${JSON.stringify({
        sequences: t.sequences,
        events: t.events,
        actions: t.actions,
        states: t.states,
        ends: t.ends,
        statesByScreen: t.statesByScreen,
        openRoom: t.openRoom,
        backToSetup: t.backToSetup,
        resetMatch: t.resetMatch,
        matchesEnded: t.matchesEnded,
        edits: t.edits,
        nextRound: t.nextRound,
        byType: t.byType,
        violatingStates: t.violatingStates,
      })}`,
    )
    expect({
      SETUP_SEED,
      SETUP_SEQUENCES,
      SETUP_MAX_STEPS,
      SETUP_EDITS,
      SETUP_TICK_MS,
    }).toStrictEqual({
      SETUP_SEED: 0x20265005,
      SETUP_SEQUENCES: 300,
      SETUP_MAX_STEPS: 2_000,
      SETUP_EDITS: 40,
      SETUP_TICK_MS: 1_000,
    })
    expect({
      sequences: t.sequences,
      ends: t.ends.twoMatches + t.ends.maxSteps,
      states: t.states,
      machineryMismatches: t.machineryMismatches,
      // A tick event is two actions, every other event one.
      actionsAtLeastEvents: t.actions >= t.events,
      eventsWithinCap: t.events <= SETUP_SEQUENCES * SETUP_MAX_STEPS,
    }).toStrictEqual({
      sequences: 300,
      ends: 300,
      states: 300 + t.actions,
      machineryMismatches: 0,
      actionsAtLeastEvents: true,
      eventsWithinCap: true,
    })
  })

  test('REQ-5.7 (The invariants, over the sample): 0 violations of I1–I10, J1–J8 and K1–K5, and every population Table U requires occurs', () => {
    expect({
      violatingStates: t.violatingStates,
      byInvariant: t.byInvariant,
      first: t.first,
    }).toStrictEqual({ violatingStates: 0, byInvariant: noViolations(), first: [] })

    // Table U: an openRoom that fills; a backToSetup; a match reaching `match`;
    // a resetMatch back to setup followed by a second openRoom; a setup edit
    // attempted, and inert, on ready and on roundEnd. Table U's Correction of
    // 2026-10-03 (the owner's decision) removed "an openRoom refused by the
    // guard" from this list: at this seed an empty selection is ≈ 1/2,048 per
    // attempt, so the refusals are reported above (`openRoom.refused`) as an
    // observed total and required of nothing.
    expect({
      openRoomFills: t.openRoom.fills > 0,
      backToSetup: t.backToSetup > 0,
      matchReached: t.matchesEnded > 0,
      reopenedAfterReset: t.openRoom.afterReset > 0,
      editOnReady: t.edits.ready.attempted > 0,
      editOnRoundEnd: t.edits.roundEnd.attempted > 0,
    }).toStrictEqual({
      openRoomFills: true,
      backToSetup: true,
      matchReached: true,
      reopenedAfterReset: true,
      editOnReady: true,
      editOnRoundEnd: true,
    })
    // Off setup every edit is inert (REQ-5.1); the generator gives none on play
    // or match.
    expect({
      ready: t.edits.ready.inert,
      roundEnd: t.edits.roundEnd.inert,
      play: t.edits.play.attempted,
      match: t.edits.match.attempted,
    }).toStrictEqual({
      ready: t.edits.ready.attempted,
      roundEnd: t.edits.roundEnd.attempted,
      play: 0,
      match: 0,
    })
  })

  test('REQ-5.7 (No path to the fallback): J6 never fails and no nextRound is drawn where the unused list is empty — Phase 4’s fallback reached 0 times', () => {
    expect({
      J6: t.byInvariant.J6,
      J4: t.byInvariant.J4,
      fallback: t.nextRound.fallback,
      choicesNotUnused: t.nextRound.choicesNotUnused,
      drawsMade: t.nextRound.draws > 0,
      drawsAllGiven: t.nextRound.draws === t.byType.nextRound?.given,
    }).toStrictEqual({
      J6: 0,
      J4: 0,
      fallback: 0,
      choicesNotUnused: 0,
      drawsMade: true,
      drawsAllGiven: true,
    })
    console.log(
      `REQ-5.7 fallback: ${t.nextRound.draws} nextRound draws, fallback reached ${t.nextRound.fallback} times; J6 violations ${t.byInvariant.J6}`,
    )
  })
})

// ============================================================================
// The K invariants bite — each one, on a state built to break it
// ============================================================================

describe('K1–K5 each flag a state built to break it, and only it', () => {
  const PLAYERS: readonly Player[] = [
    { id: 'p1', name: 'p1', team: 'a' },
    { id: 'p2', name: 'p2', team: 'b' },
    { id: 'p3', name: 'p3', team: 'a' },
  ]
  const SETUP: RoomState = {
    ...createRoom({ roomCode: 'TEST05', teamA: 'أ', teamB: 'ب' }),
    players: PLAYERS,
    pickedCategories: ['c0', 'c1'],
  }
  const READY = reduce(SETUP, { type: 'openRoom' })
  const PLAY = reduce(READY, {
    type: 'startMatch',
    categoryId: 'c0',
    questions: categoryQuestions('c0'),
  })
  const ROUND_END = reduce(PLAY, { type: 'tick', ms: 45_000 })

  test('the built states break nothing', () => {
    expect([SETUP, READY, PLAY, ROUND_END].map((s) => s.screen)).toStrictEqual([
      'setup',
      'ready',
      'play',
      'roundEnd',
    ])
    expect([
      setupInvariantViolations(SETUP),
      setupInvariantViolations(READY, SETUP),
      setupInvariantViolations(PLAY, READY),
      setupInvariantViolations(ROUND_END, PLAY),
    ]).toStrictEqual([[], [], [], []])
  })

  test('K1 — a match field not at its reset value on setup or ready', () => {
    expect(setupInvariantViolations({ ...SETUP, round: 2 })).toStrictEqual(['K1'])
    expect(setupInvariantViolations({ ...READY, usedCategories: ['c0'] })).toStrictEqual(['K1'])
    expect(setupInvariantViolations({ ...SETUP, categoryId: 'c0' })).toStrictEqual(['K1'])
  })

  test('K2 — a category picked twice', () => {
    expect(setupInvariantViolations({ ...SETUP, pickedCategories: ['c0', 'c0'] })).toStrictEqual([
      'K2',
    ])
  })

  test('K3 — two players with one id', () => {
    const players = [...PLAYERS, { id: 'p1', name: 'again', team: 'b' as const }]
    expect(setupInvariantViolations({ ...SETUP, players })).toStrictEqual(['K3'])
  })

  test('K4 — a ready room with one player, an empty team or nothing picked', () => {
    expect(setupInvariantViolations({ ...READY, players: PLAYERS.slice(0, 1) })).toStrictEqual([
      'K4',
    ])
    expect(
      setupInvariantViolations({ ...READY, players: PLAYERS.filter((p) => p.team === 'a') }),
    ).toStrictEqual(['K4'])
    expect(setupInvariantViolations({ ...READY, pickedCategories: [] })).toStrictEqual(['K4'])
  })

  test('K5 — a setup field changed, or the judge moved, off setup; the rotation on next round allowed', () => {
    expect(setupInvariantViolations({ ...PLAY, teamA: 'x' }, PLAY)).toStrictEqual(['K5'])
    expect(setupInvariantViolations({ ...PLAY, players: [...PLAY.players] }, PLAY)).toStrictEqual([
      'K5',
    ])
    expect(setupInvariantViolations({ ...PLAY, judgeIndex: 1 }, READY)).toStrictEqual(['K5'])
    const rotating = { ...ROUND_END, rotateJudge: true }
    const next = reduce(rotating, {
      type: 'nextRound',
      categoryId: 'c1',
      questions: categoryQuestions('c1'),
    })
    expect(next.judgeIndex).toBe(1)
    expect(setupInvariantViolations(next, rotating)).toStrictEqual([])
    // The same move on a step that is not roundEnd → play is a leak.
    expect(
      setupInvariantViolations(
        { ...PLAY, judgeIndex: 1, rotateJudge: true },
        {
          ...PLAY,
          rotateJudge: true,
        },
      ),
    ).toStrictEqual(['K5'])
    // On setup, anything may change.
    expect(setupInvariantViolations({ ...SETUP, teamA: 'x', judgeIndex: 2 }, READY)).toStrictEqual(
      [],
    )
  })
})
