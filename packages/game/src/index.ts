// @nel3ab/game — the rules engine (Phase 3: state & clock; Phase 4: round &
// match flow). See specs/phase-3/specs.md §2.6 and specs/phase-4/specs.md §2.8.
//
// The package's rule is tech-specs.md §2.3's: a pure, dependency-free rules
// engine, fully unit-testable with no server, no sockets and no React. The
// reducer reads no wall clock, draws no random number, starts no timer and
// performs no I/O (REQ-3.3); no source file here imports anything but a
// relative path inside this package, and the manifest declares no
// dependencies (NFR-3.2, NFR-4.2). Phase 4's draw helpers take their random
// source as a parameter and never reach for one of their own (REQ-4.1).
//
// The public surface is exact (NFR-3.5, NFR-4.4): the seventeen runtime
// exports below — Phase 3's twelve and Phase 4's five — and the types of
// types.ts, `Random` included. index.test.ts asserts the runtime names;
// match.test.ts imports every type from here, so a type missing below fails
// `pnpm typecheck`. The clock's internal transitions (`roundMs`, `startClock`,
// `settleActive`, `stopClock`, `zeroActive`, and Phase 4's `otherTeam` and
// `passClock`), room.ts's `liveQuestion`, draw.ts's `unusedCategories` and
// `nextRoundChoices`, match.ts's `startingTeam`, `nextJudgeIndex`,
// `assertRoundPayload`, `beginRound` and `scoreRound`, and everything under
// `testing/` are deliberately NOT exported — an internal helper leaking into
// this file is a change to the contract every later phase consumes.
//
// `RoomState` is the judge and server truth: it holds the current question's
// answer and is never itself a player payload (mission.md §3).

export { displaySeconds, remainingMs } from './clock.js'
export { drawableCategories, drawCategory, shuffleQuestions } from './draw.js'
export { matchWinner } from './match.js'
export { reduce } from './reducer.js'
export { acceptsJudgeActions, createRoom, currentQuestion } from './room.js'
export {
  HINT_COST_MS,
  REVEAL_HOLD_MS,
  ROUND_SECONDS_DEFAULT,
  ROUND_SECONDS_OPTIONS,
  SKIP_COST_MS,
  WINS_NEEDED_DEFAULT,
  WINS_NEEDED_OPTIONS,
} from './rules.js'
export type {
  Action,
  CategoryId,
  ClockState,
  CreateRoomInput,
  Player,
  PlayerId,
  Question,
  Random,
  Reveal,
  RoomConfig,
  RoomState,
  RoundLogEntry,
  Screen,
  Team,
  TeamBank,
} from './types.js'
