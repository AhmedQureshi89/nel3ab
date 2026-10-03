// TEMPORARY — Phase 13 replaces the demo players with players who join from their phones.
//
// REQ-5.10 — specs/phase-5/specs.md §2.9, `seed.ts`. The room `/host` opens with: the
// prototype's own initial room, field for field — five players, ريم (A), سعد (B), نورة (A),
// خالد (B), ماجد (A), with ماجد judging; rotation off; team names النمور and الصقور (the first of
// each of the engine's `TEAM_NAMES`); the eight free categories picked, in the prototype's order;
// the 45-second default and three wins to take a match (`createRoom`'s defaults).
//
// DECIDED 2026-10-02 (requirements.md REQ-5.10): the prototype's five demo players, so every
// control on the setup screen can be used and the screen compared with the prototype without any
// staging. `host-prototype.test.ts` reads the prototype's initial `state` at run time and asserts
// it is this room (REQ-5.22, extraction W6).
//
// The players' ids are this file's (`seed-<k>`, in list order): the prototype's players carry
// none, and the engine addresses players by id (requirements.md, reading 4). The room code is the
// caller's — the driver's placeholder (reading 8) — so nothing here is random.
//
// Framework-free: no React import (specs.md §1).

import { createRoom, TEAM_NAMES } from '@nel3ab/game'
import type { CategoryId, Player, RoomState } from '@nel3ab/game'

/** The prototype's five players, in its order, each with this file's id. */
export const SEED_PLAYERS: readonly Player[] = [
  { id: 'seed-1', name: 'ريم', team: 'a' },
  { id: 'seed-2', name: 'سعد', team: 'b' },
  { id: 'seed-3', name: 'نورة', team: 'a' },
  { id: 'seed-4', name: 'خالد', team: 'b' },
  { id: 'seed-5', name: 'ماجد', team: 'a' },
]

/** The prototype's `judgeIdx: 4` — ماجد. */
export const SEED_JUDGE_INDEX = 4

/** The prototype's `picked: [0,1,2,3,5,6,7,10]`, through the catalog's order: the eight free tiles. */
export const SEED_PICKED: readonly CategoryId[] = [
  'industry',
  'animals',
  'nature',
  'society',
  'proverbs',
  'history',
  'religion',
  'science',
]

/** The prototype's initial room, on `setup`, with the given room code. */
export function seedRoom(roomCode: string): RoomState {
  return {
    ...createRoom({ roomCode, teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] }),
    players: SEED_PLAYERS,
    judgeIndex: SEED_JUDGE_INDEX,
    pickedCategories: SEED_PICKED,
  }
}
