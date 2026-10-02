// Test support (Phase 4) — synthetic content and hand-built rooms. REQ-4.13, REQ-4.14.
// See specs/phase-4/specs.md §2.10.
//
// `readyRoom` stands in for Phase 5's setup. No action in this phase builds a
// player list, a selection or a judge choice, or moves a room from setup to
// room-ready (requirements.md §4), so this is the one hand-built `ready` state:
// every Phase 4 test that plays a match starts it from here.
//
// Every question here is synthetic: the prototype's shape — three questions per
// category, two hints each — with text made from the category id. Nothing is
// copied from design/.
//
// Test support: excluded from coverage (REQ-4.15, as REQ-3.12's second
// exclusion), never exported from index.ts, imported only by `*.test.ts` and by
// other files under `testing/`.

import { createRoom } from '../room.js'
import type { CategoryId, Player, Question, RoomState } from '../types.js'

/** Category `id`'s three questions, `<id>-q0 … <id>-q2`, each with two hints. */
export function categoryQuestions(id: CategoryId): readonly [Question, Question, Question] {
  const question = (k: number): Question => ({
    q: `${id}-q${k}`,
    a: `${id}-a${k}`,
    alts: [],
    h: ['h1', 'h2'],
    f: `${id}-f${k}`,
  })
  return [question(0), question(1), question(2)]
}

/** `['c0', …, 'c{k−1}']`. */
export function categoryIds(k: number): readonly CategoryId[] {
  return Array.from({ length: k }, (_, i) => `c${i}`)
}

/** What Phase 5's setup would have chosen. `players` is a count. */
export interface ReadyRoomSetup {
  readonly roundSeconds: number
  readonly winsNeeded: number
  readonly picked: readonly CategoryId[]
  readonly players: number
  readonly rotateJudge: boolean
  readonly judgeIndex: number
}

/**
 * A room on `ready`: a created room with this configuration, `players` players
 * `p0, p1, …` (even on team a, odd on team b), this selection, judge and
 * rotation toggle. Everything else is `createRoom`'s.
 */
export function readyRoom({
  roundSeconds,
  winsNeeded,
  picked,
  players,
  rotateJudge,
  judgeIndex,
}: ReadyRoomSetup): RoomState {
  return {
    ...createRoom({
      roomCode: 'TEST01',
      teamA: 'أ',
      teamB: 'ب',
      config: { roundSeconds, winsNeeded },
    }),
    players: Array.from({ length: players }, (_, n): Player => ({
      id: `p${n}`,
      name: `p${n}`,
      team: n % 2 === 0 ? 'a' : 'b',
    })),
    pickedCategories: picked,
    rotateJudge,
    judgeIndex,
    screen: 'ready',
  }
}
