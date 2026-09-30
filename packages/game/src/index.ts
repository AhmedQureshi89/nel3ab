// @nel3ab/game — the rules engine (Phase 3: state & clock).
// See specs/phase-3/specs.md §2.6.
//
// The package's rule is tech-specs.md §2.3's: a pure, dependency-free rules
// engine, fully unit-testable with no server, no sockets and no React. The
// reducer reads no wall clock, draws no random number, starts no timer and
// performs no I/O (REQ-3.3); no source file here imports anything but a
// relative path inside this package, and the manifest declares no
// dependencies (NFR-3.2).
//
// The public surface is exact (NFR-3.5): the twelve runtime exports below and
// the types of types.ts, asserted by index.test.ts. The clock's internal
// transitions (`roundMs`, `startClock`, `settleActive`, `stopClock`,
// `zeroActive`), room.ts's `liveQuestion` and everything under `testing/` are
// deliberately NOT exported — an internal helper leaking into this file is a
// change to the contract every later phase consumes.
//
// `RoomState` is the judge and server truth: it holds the current question's
// answer and is never itself a player payload (mission.md §3).

export { displaySeconds, remainingMs } from './clock.js'
export { reduce } from './reducer.js'
export { acceptsJudgeActions, createRoom, currentQuestion } from './room.js'
export {
  HINT_COST_MS,
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
  Reveal,
  RoomConfig,
  RoomState,
  RoundLogEntry,
  Screen,
  Team,
  TeamBank,
} from './types.js'
