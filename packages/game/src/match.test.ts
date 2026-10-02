import { describe, expect, test } from 'vitest'

import { reduce } from './reducer.js'
import { createRoom } from './room.js'
import type { Action, Question, RoomState, Team } from './types.js'

// Phase 4 — the round and match flow: the direct boxes of
// specs/phase-4/verification.md Gates 1 and 3. See specs/phase-4/specs.md §2.6
// (the reducer's table, including the two Phase 3 rows that change) and §2.11.
//
// As in Phase 3's reducer tests, every expected state is written as "the
// previous state with these fields replaced", compared with `toStrictEqual`, so
// "nothing else changed" is part of each assertion rather than a separate claim.
//
// Every question below is synthetic. Nothing is copied from design/.

const ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

const question = (n: number): Question => ({
  q: `سؤال تجريبي ${n}`,
  a: `جواب ${n}`,
  alts: [],
  h: [`تلميح ${n}-1`, `تلميح ${n}-2`],
  f: `معلومة ${n}`,
})

const POOL: readonly [Question, ...Question[]] = [question(0), question(1), question(2)]

const tick = (ms: number): Action => ({ type: 'tick', ms })
const CORRECT: Action = { type: 'correct' }
const startRound = (startingTeam: Team): Action => ({
  type: 'startRound',
  startingTeam,
  questions: POOL,
})

/** `n` steps of `tick(ms)`, one reducer call each. */
const ticks = (state: RoomState, n: number, ms = 100): RoomState => {
  let s = state
  for (let i = 0; i < n; i += 1) s = reduce(s, tick(ms))
  return s
}

// ============================================================================
// verification.md Gate 1 — the one new field
// ============================================================================

describe('REQ-4.11: revealedAt — the engine time the reveal went up', () => {
  test('a created room has no reveal, so no time it went up', () => {
    const room = createRoom(ROOM)
    expect([room.reveal, room.revealedAt]).toStrictEqual([null, null])
  })

  test('correct records clock.now — 3,700 after 37 ticks, and 0 at engine time 0, never null', () => {
    const live = ticks(reduce(createRoom(ROOM), startRound('a')), 37)
    expect(live.clock.now).toBe(3_700)
    expect(reduce(live, CORRECT).revealedAt).toBe(3_700)

    // A reveal raised at engine time 0 records 0: the first round of every room
    // starts there, and 0 must not read as "no reveal" (the trap Phase 3 named
    // for runningSince).
    const atZero = reduce(reduce(createRoom(ROOM), startRound('b')), CORRECT)
    expect([atZero.clock.now, atZero.revealedAt, atZero.reveal === null]).toStrictEqual([
      0,
      0,
      false,
    ])
  })

  test('ticks during the reveal leave it where it went up', () => {
    const revealed = reduce(ticks(reduce(createRoom(ROOM), startRound('a')), 10), CORRECT)
    const later = ticks(revealed, 25)
    expect([later.clock.now, later.revealedAt]).toStrictEqual([3_500, 1_000])
  })

  test('startRound clears it with the reveal', () => {
    // From a round that ended normally — nothing to clear.
    const ended = reduce(reduce(createRoom(ROOM), startRound('a')), tick(45_000))
    expect(reduce(ended, startRound('b')).revealedAt).toBeNull()

    // From a hand-built state no action produces — the round over with a reveal
    // still recorded — so that the clearing is visible rather than vacuous.
    const stale: RoomState = {
      ...ended,
      reveal: { answer: POOL[0].a, fact: POOL[0].f },
      revealedAt: 12_000,
    }
    const restarted = reduce(stale, startRound('b'))
    expect([restarted.screen, restarted.reveal, restarted.revealedAt]).toStrictEqual([
      'play',
      null,
      null,
    ])
  })
})
