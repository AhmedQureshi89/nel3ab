// The setup rules (Phase 5) — REQ-5.1 – REQ-5.6.
// See specs/phase-5/specs.md §2.3, and §2.4 for the reducer cases built on it.
//
// Everything a host changes before a match: who is in the room and on which
// team, what the teams are called, who judges, whether the judge rotates, and
// which categories the match draws from — and the step from the setup screen
// to room-ready and back. Every rule here is the prototype's
// (design/designs/Nel3ab - Arcade.dc.html, the `Component` class's
// `removePlayer`, `swapTeam`, `shuffleName`, `toggleCat`, `startGame`,
// `backToSetup` and `judge` getter), read from that file at test time by
// setup-rules.test.ts. The one departure is the zero-category guard, which
// replaces the prototype's silent default selection (requirements.md, reading 1).
//
// `canOpenRoom`, `currentJudge` and `shuffleTeamName` are public.
// `FILL_NAMES`, `playerIndex`, `judgeAfterRemoval`, `fillPlayers` and
// `assertSetupAction` are internal: exported from this module for the reducer,
// never from index.ts (specs.md §2.5).
//
// Nothing here draws a random number of its own: the shuffle takes its source
// as a parameter (REQ-3.3, NFR-5.2).
//
// Coverage rule (REQ-5.9, inherited from REQ-3.12): every branch here is
// reachable by some input. A branch nothing can reach is deleted, not ignored.

import type { Action, Player, PlayerId, Random, RoomState, Team } from './types.js'

/** The six setup edits — the actions `assertSetupAction` validates. */
type SetupEdit = Extract<
  Action,
  {
    readonly type:
      'removePlayer' | 'swapTeam' | 'renameTeam' | 'setJudge' | 'setRotateJudge' | 'pickCategory'
  }
>

/** The prototype's placeholder players, added when a team would otherwise be empty (REQ-5.6). */
export const FILL_NAMES = { a: 'لاعب ١', b: 'لاعب ٢' } as const

/**
 * The zero-category guard (REQ-5.6): the room opens only from setup, and only
 * with at least one category picked. Public, so that the setup screen disables
 * its "ابدأ اللعبة" by the same rule the reducer's `openRoom` applies — the two
 * cannot disagree, as Phase 3's `acceptsJudgeActions` and its reducer cannot.
 */
export function canOpenRoom(state: RoomState): boolean {
  return state.screen === 'setup' && state.pickedCategories.length > 0
}

/**
 * Who judges (REQ-5.4): the prototype's `judge` getter — the player at
 * `judgeIndex mod players.length`, or the first player, or nobody when the room
 * is empty. Written with `??`, never a `!`: with no players `x % 0` is NaN, both
 * lookups are `undefined`, and the result is `null` — every operand reachable.
 */
export function currentJudge(state: RoomState): Player | null {
  const { players } = state
  return players[state.judgeIndex % players.length] ?? players[0] ?? null
}

/**
 * A team name other than `current`, drawn uniformly from `names` with exactly
 * one call to `random` (REQ-5.3) — the prototype's `shuffleName`, which redraws
 * until the name changes, has the same distribution: uniform over the other
 * names, or over all of them when `current` is not on the list (reading 5).
 *
 * One guard covers every bad input, as `drawCategory`'s does: no other name to
 * choose, or a random value outside [0, 1) or NaN, leaves the pick `undefined`.
 */
export function shuffleTeamName(current: string, names: readonly string[], random: Random): string {
  const others = names.filter((name) => name !== current)
  const r = random()
  const pick = others[Math.floor(r * others.length)]
  if (pick === undefined) {
    throw new RangeError(
      `shuffleTeamName needs a random value in [0, 1) and a name other than "${current}"; got ${r} with ${others.length} other names`,
    )
  }
  return pick
}

/** The player's position in the room, or -1 when no player has that id. */
export function playerIndex(state: RoomState, playerId: PlayerId): number {
  return state.players.findIndex((player) => player.id === playerId)
}

/**
 * The judge index after the player at `removed` leaves (REQ-5.2) — the
 * prototype's `removePlayer` line, verbatim. Removing someone listed before the
 * judge keeps the same person judging; removing the judge makes the person
 * before them judge, or — when the judge was first — the person after.
 */
export function judgeAfterRemoval(judgeIndex: number, removed: number): number {
  return judgeIndex >= removed && judgeIndex > 0 ? judgeIndex - 1 : judgeIndex
}

/** The smallest `fill-<k>`, k ≥ 1, that no player in `players` has as an id. */
function freshFillId(players: readonly Player[]): PlayerId {
  let k = 1
  while (players.some((player) => player.id === `fill-${k}`)) k += 1
  return `fill-${k}`
}

/**
 * The prototype's `startGame` fill (REQ-5.6, reading 2). With fewer than two
 * players the list starts EMPTY — a lone player is dropped, as the prototype
 * drops them — and gains "لاعب ١" on team a and "لاعب ٢" on team b. Then each
 * team with nobody on it gains its placeholder. Each added player's id is the
 * smallest unused `fill-<k>`, so ids stay unique however often the room is
 * reopened. When nothing is added, the input array itself is returned, so an
 * `openRoom` on a full room does not replace `players`.
 */
export function fillPlayers(players: readonly Player[]): readonly Player[] {
  let out: readonly Player[] = players.length < 2 ? [] : players
  const add = (team: Team): void => {
    out = [...out, { id: freshFillId(out), name: FILL_NAMES[team], team }]
  }
  if (players.length < 2) {
    add('a')
    add('b')
  }
  if (!out.some((player) => player.team === 'a')) add('a')
  if (!out.some((player) => player.team === 'b')) add('b')
  return out
}

/**
 * Throws a `RangeError` unless a setup edit is well-formed (REQ-5.1). Called
 * FIRST by each of the six edits, on every screen — validation precedes
 * inertness (REQ-3.3, NFR-5.3), so a malformed edit throws even where a good
 * one would be inert. `openRoom` and `backToSetup` carry nothing to validate.
 */
export function assertSetupAction(action: SetupEdit): void {
  const fail = (field: string, value: unknown, wanted: string): never => {
    throw new RangeError(`${action.type} needs ${field} to be ${wanted}; got ${String(value)}`)
  }
  switch (action.type) {
    case 'removePlayer':
    case 'swapTeam':
    case 'setJudge':
      if (typeof action.playerId !== 'string') fail('playerId', action.playerId, 'a string')
      return
    case 'renameTeam':
      if (action.team !== 'a' && action.team !== 'b') fail('team', action.team, "'a' or 'b'")
      if (typeof action.name !== 'string') fail('name', action.name, 'a string')
      return
    case 'setRotateJudge':
      if (typeof action.rotate !== 'boolean') fail('rotate', action.rotate, 'a boolean')
      return
    case 'pickCategory':
      if (typeof action.categoryId !== 'string') {
        fail('categoryId', action.categoryId, 'a string')
      }
      if (typeof action.picked !== 'boolean') fail('picked', action.picked, 'a boolean')
      return
  }
}
