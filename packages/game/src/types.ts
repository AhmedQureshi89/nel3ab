// The room's state and the reducer's actions (Phase 3) — REQ-3.1.
// See specs/phase-3/specs.md §2.1, whose table maps every field of the design
// handoff's "State Management" contract (design/README.md) onto a path here,
// with the reason for every difference in name or representation.
//
// Types only — no runtime code. Every property is `readonly` and every array
// `readonly T[]`, so that a consumer mutating state is a compile error rather
// than a purity bug found later by freezing.
//
// `RoomState` is the judge and server truth: it holds the current question's
// answer. It is never itself a player payload — Phase 12 builds that from
// scratch (mission.md §3), never by deleting fields from this one.

export type Team = 'a' | 'b'
export type Screen = 'setup' | 'ready' | 'play' | 'roundEnd' | 'match'
export type PlayerId = string
export type CategoryId = string

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly team: Team
}

/** One question as the content bank carries it — the handoff's `{q, a, alts[], h[], f}`. */
export interface Question {
  readonly q: string // question text
  readonly a: string // answer
  readonly alts: readonly string[] // accepted variants; may be empty
  readonly h: readonly string[] // hints, in reveal order; may be empty
  readonly f: string // trivia fact shown on the reveal
}

export interface TeamBank {
  /** Whole milliseconds remaining as of `ClockState.runningSince` — or as of the stop, when stopped. */
  readonly ms: number
  /** Whether this team has had its first turn this round. The handoff's `started`. */
  readonly started: boolean
}

export interface ClockState {
  /** Engine time in whole ms. Starts at 0 per room. Advanced only by `tick`. Not a wall-clock timestamp. */
  readonly now: number
  readonly active: Team
  /** Engine time at which the active bank last resumed; `null` while the clock is stopped. */
  readonly runningSince: number | null
  readonly banks: { readonly a: TeamBank; readonly b: TeamBank }
}

export interface Reveal {
  readonly answer: string
  readonly fact: string
}

export interface RoomConfig {
  readonly roundSeconds: number
  readonly winsNeeded: number
}

export interface RoundLogEntry {
  readonly n: number
  readonly category: CategoryId
  readonly winner: Team
}

export interface RoomState {
  readonly roomCode: string
  readonly config: RoomConfig
  readonly players: readonly Player[]
  readonly teamA: string
  readonly teamB: string
  readonly judgeIndex: number
  readonly rotateJudge: boolean
  readonly pickedCategories: readonly CategoryId[]
  readonly usedCategories: readonly CategoryId[]
  readonly screen: Screen
  readonly round: number
  readonly tallyA: number
  readonly tallyB: number
  readonly log: readonly RoundLogEntry[]
  readonly categoryId: CategoryId | null
  readonly questionPool: readonly Question[]
  readonly questionIndex: number
  readonly hintIndex: number
  readonly clock: ClockState
  readonly reveal: Reveal | null
}

export type Action =
  | { readonly type: 'tick'; readonly ms: number }
  | {
      readonly type: 'startRound'
      readonly startingTeam: Team
      readonly questions: readonly [Question, ...Question[]]
    }
  | { readonly type: 'hint' }
  | { readonly type: 'skip' }
  | { readonly type: 'correct' }

export interface CreateRoomInput {
  readonly roomCode: string
  readonly teamA: string
  readonly teamB: string
  readonly config?: Partial<RoomConfig>
}
