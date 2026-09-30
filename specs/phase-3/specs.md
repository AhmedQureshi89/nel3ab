# Phase 3 Technical Specification — Rules engine: state & clock

> **Phase:** Phase 3
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** 1 day

---

## 1. Architecture Overview

Everything this phase builds lives in `packages/game`. Outside it, exactly five files change: the
root `package.json` and `vitest.config.ts` (coverage), `.gitignore` and `.prettierignore` (the
coverage output directory), and `apps/game/src/index.test.ts` (it imports the `PLACEHOLDER` this
phase removes). Nothing else in the workspace moves.

**Dependency order is part of the design.** A runner walks it top to bottom; each step is
buildable and testable before the next begins. The one stack risk — the coverage provider — is
probed first, on the shell, before a line of engine exists. The exit-criterion verdict is placed
after every ordinary check it depends on, so that when it is evaluated the only thing it can
measure is the prototype.

> **Correction 2026-09-30 (ordering only, before implementation).** `verification.md`'s boxes are
> grouped by requirement, not by the steps below, so some Gate 2–5 boxes become checkable only at a
> later step (REQ-3.10's behaviour ties at STEP 4; every per-length-sample box at STEP 6). Build in
> this order regardless, and tick each Gate 2–5 box when the code it exercises exists — see
> `verification.md`, "Gate ordering". Nothing else in this document changed.

```
  STEP 1 ─ Coverage plumbing         (probes the phase's only new dependency, on the shell)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ package.json            [MOD]  @vitest/coverage-v8 4.1.10; test →    │
  │                                 check-collected-tests.mjs --coverage │
  │ vitest.config.ts        [MOD]  test.coverage: v8, 100 × 4, include   │
  │ .gitignore .prettierignore [MOD] coverage/                           │
  │   ── thresholds proven to bite on PLACEHOLDER (Gate 1)               │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 2 ─ Types and the rules' numbers ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ packages/game/src/types.ts       [NEW]  RoomState, Action, …         │
  │ packages/game/src/rules.ts       [NEW]  costs, config range          │
  │ packages/game/src/rules.test.ts  [NEW]  numbers vs design/ (REQ-3.10)│
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 3 ─ The clock              ▼   ── nothing below can start first:
  ┌──────────────────────────────────────────────────────────────────────┐   every action
  │ packages/game/src/clock.ts       [NEW]  remainingMs, displaySeconds, │   settles, drains
  │                                         the internal transitions     │   or stops a bank
  │ packages/game/src/clock.test.ts  [NEW]                               │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 4 ─ Room and reducer       ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ packages/game/src/room.ts        [NEW]  createRoom, currentQuestion, │
  │                                         acceptsJudgeActions          │
  │ packages/game/src/reducer.ts     [NEW]  reduce: tick, startRound,    │
  │                                         hint, skip, correct          │
  │ room.test.ts · reducer.test.ts   [NEW]                               │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 5 ─ Public surface         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ packages/game/src/index.ts       [MOD]  drops PLACEHOLDER            │
  │ packages/game/src/index.test.ts  [MOD] ┐ both import PLACEHOLDER     │
  │ apps/game/src/index.test.ts      [MOD] ┘ today — they WILL break     │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 6 ─ Test support, purity, equivalence ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ packages/game/src/testing/       [NEW]  prng, sequences, oracle,     │
  │                                         harness, invariants, freeze  │
  │ purity.test.ts                   [NEW]                               │
  │ prototype-equivalence.test.ts    [NEW]  ── 🚦 REQ-3.11 lives here    │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 7 ─ Gates                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 100% coverage + named mutations caught                               │
  │ 🚦 four gate commands, no escape hatch (REQ-3.13)                     │
  └──────────────────────────────────────────────────────────────────────┘
```

**Module dependency inside the package** runs one way and has no cycle:

```
  types.ts ◀── rules.ts ◀── clock.ts ◀── room.ts ◀── reducer.ts ◀── index.ts
                                                           ▲
                           testing/*  ── imports all of the above, is imported by tests only
```

---

## 2. Component Specifications

### 2.1 `packages/game/src/types.ts` [NEW]

**Implements:** REQ-3.1

Types only — no runtime code. Every property is `readonly`, and every array is `readonly T[]`, so
that a consumer mutating state is a compile error rather than a purity bug found by freezing.

```ts
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
```

**The handoff contract, field for field.** This table *is* REQ-3.1's contract. `room.test.ts`
enumerates its left column and asserts every right-column path exists on a created room; it also
asserts that `RoomState`'s top-level keys are **exactly** the 20 below, `clock`'s exactly its 4 and
`config`'s exactly its 2, so a field added without a row here fails.

| # | `design/README.md` "State Management" | `RoomState` path | Difference and reason |
|---|---|---|---|
| 1 | `roomCode: string` | `roomCode` | — |
| 2 | `players: {id, name, team}[]` | `players` | — |
| 3 | `teamA: string` | `teamA` | — |
| 4 | `teamB: string` | `teamB` | — |
| 5 | `judgeIndex: number` | `judgeIndex` | — |
| 6 | `rotateJudge: boolean` | `rotateJudge` | — |
| 7 | `pickedCategories: number[]` | `pickedCategories` | elements are `CategoryId`, not positions — requirements §1, reading 1 |
| 8 | `usedCategories: number[]` | `usedCategories` | same |
| 9 | `screen` | `screen` | — |
| 10 | `round: number` | `round` | — |
| 11 | `tallyA: number` | `tallyA` | — |
| 12 | `tallyB: number` | `tallyB` | — |
| 13 | `log: {n, category, winner}[]` | `log` | `category` is a `CategoryId`; `winner` is a `Team`, not a display name. Phase 4 owns what an entry records and may refine this |
| 14 | `categoryIndex: number \| null` | `categoryId` | **renamed** — it holds an id, not an index (reading 1) |
| 15 | `questionPool` | `questionPool` | — |
| 16 | `questionIndex` | `questionIndex` | — |
| 17 | `hintIndex` | `hintIndex` | — |
| 18 | `banks: {a: {time, started}, b: {…}}` | `clock.banks` | `time` (float seconds) becomes `ms` (integer milliseconds) — **DECIDED 2026-09-30**, REQ-3.4; grouped under `clock` — reading 2 |
| 19 | `active: 'a' \| 'b'` | `clock.active` | grouped under `clock` — reading 2 |
| 20 | `reveal: {answer, fact} \| null` | `reveal` | — |
| 21 | `roundSeconds` (configurable) | `config.roundSeconds` | grouped under `config` |
| 22 | `winsNeeded` (configurable) | `config.winsNeeded` | grouped under `config` |
| + | — | `clock.now` | **added** — engine time; `roadmap.md` Phase 3 and `tech-specs.md` §4 (`serverTime` on the wire, reading 3) |
| + | — | `clock.runningSince` | **added** — `roadmap.md` Phase 3 and `tech-specs.md` §4 |

**Phase 4 may extend `RoomState`** — add fields, refine the types of fields whose behaviour it
owns (rows 5–8, 10–14) — but it may **not** change the clock's representation (rows 18–19 and the
two additions) without the owner revisiting REQ-3.4.

### 2.2 `packages/game/src/rules.ts` [NEW]

**Implements:** REQ-3.2, REQ-3.6, REQ-3.10

The rules' numbers, in one place, each exported so a screen's sub-label ("−٢ ثانية") and the
reducer read the same value:

```ts
export const HINT_COST_MS = 2000
export const SKIP_COST_MS = 3000
export const ROUND_SECONDS_DEFAULT = 45
export const ROUND_SECONDS_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90] as const
export const WINS_NEEDED_DEFAULT = 3
export const WINS_NEEDED_OPTIONS = [2, 3, 4] as const
```

There is deliberately **no tick constant**: `tick(ms)` drains exactly `ms`, and how often a
driver ticks is the driver's business (the prototype and `tech-specs.md` §2.2 both use 100ms).
Seconds appear in exactly two places in the whole package — `config.roundSeconds` and the output
of `displaySeconds` — and the conversion `roundSeconds * 1000` is written **once**, in a helper
used by both `createRoom` and `startRound`.

### 2.3 `packages/game/src/clock.ts` [NEW]

**Implements:** REQ-3.4, REQ-3.7, REQ-3.9

**The representation.** A bank's `ms` is its value *as of* `runningSince`. Remaining time is
computed, never stored:

```
remainingMs(clock, team) =
    team === clock.active && clock.runningSince !== null
      ? max(0, banks[team].ms − (clock.now − clock.runningSince))
      : banks[team].ms
```

The inactive team's bank is **never** reduced by elapsed time — only the active one runs.

**Exported:**

| Function | Contract |
|---|---|
| `remainingMs(clock: ClockState, team: Team): number` | as above; an integer ≥ 0 |
| `displaySeconds(ms: number): number` | `Math.max(0, Math.ceil(ms / 1000))`. Throws `RangeError` on a non-finite `ms`. `Math.max(0, -0)` is `+0`, so a negative input never yields `-0` — asserted with `Object.is`, not `toBe` |

**Internal** (exported from the module for the reducer, **not** from `index.ts`):

| Function | Contract |
|---|---|
| `roundMs(config)` | `config.roundSeconds * 1000` — the only place the conversion is written |
| `startClock(now, team, roundMs)` | both banks `{ ms: roundMs }`; the given team `started: true`, the other `false`; `active = team`; `runningSince = now` |
| `settleActive(clock)` | active bank's `ms` ← `remainingMs(clock, active)`; `runningSince` unchanged. The building block of every transition |
| `stopClock(clock)` | settle, then `runningSince = null` |
| `zeroActive(clock)` | active bank `ms = 0`, `runningSince = null` — the round-end clock |

**Silent failure modes — each has a named mutation in verification Gate 7:**

- **`runningSince` is `0` in the first round of every room.** Engine time starts at 0 and
  `startRound` usually runs at `now = 0`. Any truthiness test — `if (clock.runningSince)`,
  `clock.runningSince ? … : …`, `!clock.runningSince` — treats that round as **stopped**: the clock
  never drains and every judge action is inert, while the second round (started at `now > 0`) works.
  Always compare with `!== null`.
- **Forgetting to re-anchor after a spend.** A spend settles the bank to `remaining − cost`; if
  `runningSince` is not then set to `now`, the next reading subtracts the elapsed time a second time.
  The bank silently loses time proportional to how long ago the turn began. This is the one bug the
  lazy representation invites, and no type catches it.
- **Units.** `ms` everywhere except `config.roundSeconds` and `displaySeconds`'s return value. A
  `roundSeconds` passed where milliseconds are expected yields a 45ms round that ends on the first
  tick — which *looks like* a round-end bug, not a unit bug.
- **Swapping `now` and `runningSince`** in the subtraction produces a bank that *grows*. Both are
  `number`; nothing in the type system distinguishes them.

### 2.4 `packages/game/src/room.ts` [NEW]

**Implements:** REQ-3.1, REQ-3.2, REQ-3.6, REQ-3.8

**`createRoom(input: CreateRoomInput): RoomState`**

1. Resolve `roundSeconds = input.config?.roundSeconds ?? ROUND_SECONDS_DEFAULT` and
   `winsNeeded = input.config?.winsNeeded ?? WINS_NEEDED_DEFAULT`.
2. If `roundSeconds` is not one of `ROUND_SECONDS_OPTIONS` or `winsNeeded` not one of
   `WINS_NEEDED_OPTIONS`, throw `RangeError` naming the field and the value. Membership, not a
   range check — `47`, `45.5` and `NaN` are all rejected by the same line.
3. Return:

| Field | Initial value | Why |
|---|---|---|
| `roomCode`, `teamA`, `teamB` | from `input` | no validation here — Phase 11 generates codes, Phase 5 edits names |
| `config` | `{ roundSeconds, winsNeeded }` | |
| `players` · `pickedCategories` · `usedCategories` · `log` | `[]` | |
| `judgeIndex` · `rotateJudge` | `0` · `false` | prototype's `rotateJudge:false` |
| `screen` · `round` · `tallyA` · `tallyB` | `'setup'` · `1` · `0` · `0` | prototype's initial state |
| `categoryId` · `reveal` | `null` · `null` | |
| `questionPool` · `questionIndex` · `hintIndex` | `[]` · `0` · `0` | |
| `clock` | `{ now: 0, active: 'a', runningSince: null, banks: { a: { ms: R, started: false }, b: { ms: R, started: false } } }` with `R = roundMs(config)` | prototype's `a:{time:45,started:false}, b:{…}, active:'a'` |

**`currentQuestion(state): Question | null`** — `state.questionPool[state.questionIndex % n] ?? null`
where `n` is the pool length. With an empty pool `x % 0` is `NaN`, the lookup is `undefined`, and
the result is `null`; with a non-empty pool it wraps. Written this way, **both** sides of `??` are
reachable — see the coverage rule below.

**Internal `liveQuestion(state): Question | null`** — the single definition of "the judge may act":

```
if screen !== 'play'            → null   (no round in play, or round ended)
if clock.runningSince === null  → null   (clock stopped — covers a reveal in every valid state)
if reveal !== null              → null   (defence: a reveal blocks even an inconsistent running clock)
otherwise                       → currentQuestion(state)
```

**`acceptsJudgeActions(state): boolean`** — exported; `liveQuestion(state) !== null`. The reducer
calls `liveQuestion`, and the screen calls `acceptsJudgeActions`; they cannot disagree.

**Coverage rule for this phase (REQ-3.12 with no `v8 ignore`).** Every branch must be reachable by
*some* input — possibly a hand-built `RoomState` that no sequence of actions produces. The third
condition above (running clock **and** a reveal) is such a state; the test that reaches it is a
test of a defence, and that is its purpose. **A branch that nothing can reach is deleted, not
ignored.**

### 2.5 `packages/game/src/reducer.ts` [NEW]

**Implements:** REQ-3.3 – REQ-3.8

**`reduce(state: RoomState, action: Action): RoomState`** — one `switch (action.type)`. **Validation
precedes the inertness check**, so a malformed action throws in every state; an inert action returns
`state` itself (`===`), never a copy.

| Action | Validation (throws) | Inert when (returns `state`) | Effect |
|---|---|---|---|
| `tick` | `RangeError` unless `Number.isSafeInteger(ms) && ms >= 0 && Number.isSafeInteger(now + ms)` | `ms === 0` | `now' = now + ms`. If running and `banks[active].ms − (now' − runningSince) <= 0` → **round end** at `now'`. Otherwise **only** `clock.now` changes |
| `startRound` | `RangeError` unless `startingTeam` is `'a'` or `'b'` and `questions` is an array of length ≥ 1 | `screen === 'play'` | `clock = startClock(now, startingTeam, roundMs)`; `screen 'play'`; `questionPool = questions`; `questionIndex = hintIndex = 0`; `reveal = null`. `round`, tallies, `log`, `categoryId`, `usedCategories` untouched (Phase 4) |
| `hint` | — | `liveQuestion` is `null`, or `hintIndex >= q.h.length` | `left = remainingMs(active) − HINT_COST_MS`. If `left <= 0` → **round end** (`hintIndex` unchanged). Else active bank `ms = left`, `runningSince = now` (**re-anchor**), `hintIndex + 1` |
| `skip` | — | `liveQuestion` is `null` | `left = remainingMs(active) − SKIP_COST_MS`. If `left <= 0` → **round end** (`questionIndex` unchanged). Else `ms = left`, re-anchor, `questionIndex + 1`, `hintIndex = 0` |
| `correct` | — | `liveQuestion` is `null` | `clock = stopClock(clock)`; `reveal = { answer: q.a, fact: q.f }`. Nothing else changes |
| *unknown* | `TypeError` — the `default:` arm assigns `action` to `never` and throws | — | — |

**Round end** (internal, one function, used by all three paths): `clock = zeroActive(clock)` (with
`now` already advanced if it was a tick), `screen = 'roundEnd'`. Nothing else changes — in
particular `reveal` stays `null`, and `active` still names the team whose bank emptied, which is how
REQ-3.7's "identifiable as the loser" is met without a new field. Phase 4 extends this one function
with the tally, the log and the `match` branch.

**Order inside `hint`** follows the prototype line for line (`giveHint`): the inert checks, *then*
the spend, *then* — only if the round survived — the index advance. `skip` likewise (`markSkip`:
spend, return if it ended, then `nextQuestion()`). Gate 2 extracts both orderings from the prototype
file, so a reordering here is caught against the source, not against a remembered reading of it.

**The reducer never** reads `Date`, `performance`, `Math.random`, `crypto` or `process`; never calls
`setTimeout`, `setInterval`, `setImmediate` or `queueMicrotask`; never logs; never mutates `state`
or `action`. Structural sharing of unchanged sub-objects between input and output is permitted and
expected.

### 2.6 `packages/game/src/index.ts` [MODIFIED]

**Implements:** NFR-3.5

Drops `PLACEHOLDER` and its Phase 1 header comment; gains a header naming the phase and the
package's rule (pure, dependency-free, `tech-specs.md` §2.3). Runtime exports are **exactly** these
twelve, in any order:

```
acceptsJudgeActions   createRoom   currentQuestion   displaySeconds   reduce   remainingMs
HINT_COST_MS   SKIP_COST_MS   ROUND_SECONDS_DEFAULT   ROUND_SECONDS_OPTIONS
WINS_NEEDED_DEFAULT   WINS_NEEDED_OPTIONS
```

plus `export type` of every type in §2.1. Nothing from `clock.ts`'s internal table and nothing from
`testing/` is exported.

### 2.7 The two tests that break — `packages/game/src/index.test.ts` and `apps/game/src/index.test.ts` [MODIFIED]

**Implements:** NFR-3.4, NFR-3.5

Both import `PLACEHOLDER` from `@nel3ab/game` today. Both are **updated, not deleted** —
`scripts/check-collected-tests.mjs` needs a collected file in each project.

- `packages/game/src/index.test.ts` follows `packages/ui/src/index.test.ts`'s pattern: the sorted
  runtime export list equals the twelve names in §2.6 exactly; each function export is a
  function; `'PLACEHOLDER' in game` is `false`.
- `apps/game/src/index.test.ts` keeps its purpose — "nel3ab-game resolves its three workspace
  dependencies" — by importing a real export instead:
  `import { createRoom } from '@nel3ab/game'` and asserting `[typeof createRoom, PROTOCOL, CONTENT]`
  equals `['function', true, true]`. `@nel3ab/protocol` and `@nel3ab/content` still export
  `PLACEHOLDER` and are untouched. **This is the only change in `apps/game`.**

### 2.8 `packages/game/src/testing/` [NEW] — the test support

**Implements:** REQ-3.3, REQ-3.11. Excluded from coverage (REQ-3.12's second exclusion), never
exported, imported only by `*.test.ts`.

**`prng.ts`** — mulberry32, exactly:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

**`sequences.ts`** — the pre-registered generator. These constants are **fixed by this document**;
changing any of them changes the verdict's sample and is forbidden (verification Gate 6):

```ts
export const SEED = 0x20260930
export const RATES = [0.01, 0.03, 0.1] as const
export const TAIL = 50
export type Event = 'tick' | 'hint' | 'skip' | 'correct'

/** One sequence. Draw order is part of the contract: one rand() per step, plus one more when acting. */
export function generate(rand: () => number, roundSeconds: number, rate: number): Event[] {
  const events: Event[] = []
  const max = roundSeconds * 10 + 200
  while (events.length < max) {
    if (rand() < rate) {
      const r = rand()
      events.push(r < 0.45 ? 'hint' : r < 0.9 ? 'skip' : 'correct')
    } else events.push('tick')
  }
  return events
}
```

A **sample** is `(roundSeconds, seed, n)`: one `mulberry32(seed)` shared by the whole sample, and
sequence `i` (0-based, generated in order) uses `RATES[i % 3]` and starting team
`i % 2 === 0 ? 'a' : 'b'`. The two samples:

| Sample | `roundSeconds` | `seed` | `n` |
|---|---|---|---|
| verdict | 45 | `SEED` | 10,000 |
| per-length | each of the 15 in `ROUND_SECONDS_OPTIONS` | `SEED + roundSeconds` | 200 each |

The question pool for every generated sequence is three synthetic questions with **two hints each**
— every question in the prototype's dataset has exactly two. Synthetic text, not prototype content:
nothing is copied from `design/`.

**`prototype-oracle.ts`** — a transcription of the prototype's clock and spend code, with each branch
commented with the prototype method it comes from (`startClock`, `spend`, `giveHint`, `markSkip`,
`markCorrect`). One function, two arithmetics:

| | `'float'` — the prototype as it computes | `'exact'` — the prototype's stated rules |
|---|---|---|
| unit | seconds, `number` | tenths of a second, integer |
| tick | `Math.max(0, v − 0.1)` | `Math.max(0, v − 1)` |
| hint · skip | `Math.max(0, v − 2)` · `Math.max(0, v − 3)` | `Math.max(0, v − 20)` · `Math.max(0, v − 30)` |
| ended when | `v <= 0` | `v <= 0` |
| display | `Math.ceil(v)` | `Math.floor((v + 9) / 10)` |

It models one turn — the starting team's bank runs, the other stays full — which is all Phase 3's
reducer covers. Guard order per the prototype: every event is inert once the round has ended or the
reveal is up; a hint is inert when the current question (`pool[qi % length]`) has no hints left,
*before* any spend; a round-ending spend returns before advancing an index. An **observation** is
the 6-tuple *(display a, display b, ended, reveal up, hintIndex, questionIndex)*.

**`harness.ts`** — runs one sequence through the engine and both oracles **in lockstep**. The engine
is `createRoom({ roomCode: 'TEST01', teamA: 'أ', teamB: 'ب', config: { roundSeconds } })` followed by
`startRound(startingTeam, pool)`; each event maps to `{ type: 'tick', ms: 100 }` or
`{ type: event }`. The engine's observation uses `displaySeconds(remainingMs(clock, team))`,
`screen === 'roundEnd'`, `reveal !== null`, and the two indices. After every event it records the
first step at which engine ≠ exact and the first at which engine ≠ float. **Stop rule:** consumption
ends `TAIL` events after the step at which the *exact* oracle first becomes terminal (ended or
reveal up), or at the end of the sequence, whichever is first. The harness returns, per sequence:
steps consumed, first engine/exact divergence, first engine/float divergence, and the loser.

**`invariants.ts`** — `assertInvariants(state, prev?)`, called after every step of every sampled
sequence:

| # | Invariant |
|---|---|
| I1 | `clock.now`, both `banks.*.ms`, `questionIndex`, `hintIndex` are non-negative safe integers |
| I2 | both banks ≤ `roundMs(config)` |
| I3 | `runningSince` is `null` or an integer in `[0, now]` |
| I4 | `runningSince !== null` ⇒ `screen === 'play'` and `reveal === null` |
| I5 | `screen === 'play'` ⇒ `remainingMs(active) > 0` — a live bank is never zero |
| I6 | `screen === 'roundEnd'` ⇒ `banks[active].ms === 0`, `runningSince === null`, `reveal === null` |
| I7 | with `prev` in the same round: the inactive team's bank is deep-equal to `prev`'s |
| I8 | in `play`: `hintIndex ≤ currentQuestion(state).h.length` |
| I9 | `reveal !== null` ⇒ it equals `{ answer: q.a, fact: q.f }` of `currentQuestion(state)` |
| I10 | in `play` with no reveal: `displaySeconds(remainingMs(active)) ≥ 1` — a live clock never reads 0 |

**`deep-freeze.ts`** — recursive `Object.freeze`. ES modules are strict, so a write to a frozen
object throws `TypeError` rather than failing silently.

### 2.9 Tests [NEW]

All under `packages/game/src/`. The verification box each one serves is in brackets.

| File | Asserts |
|---|---|
| `rules.test.ts` | the prototype's numbers, extracted from `design/designs/Nel3ab - Arcade.dc.html` and `design/user-stories.md` at run time, equal the engine's — and drive the engine's behaviour (a hint drains exactly the extracted cost × 1000). Every extraction asserts its own match count [Gate 2] |
| `room.test.ts` | the contract table of §2.1; `createRoom`'s initial values; config acceptance and rejection; `currentQuestion` wrap and empty pool [Gate 2] |
| `clock.test.ts` | `remainingMs`; `displaySeconds` exhaustively over 0–90,000 and at its edges [Gates 2–3] |
| `reducer.test.ts` | every row of §2.5's table; the scripted scenarios' mechanics; the defences reached by hand-built states [Gates 3–4] |
| `purity.test.ts` | frozen inputs across samples; determinism; spies on ambient time and randomness; additivity; "a tick changes only `now`" [Gates 3, 5] |
| `prototype-equivalence.test.ts` | generator fingerprint; oracle anchors; oracle-vs-oracle table; engine ≡ exact; scripted scenarios; 🚦 engine ≡ float at 45 s [Gate 6] |
| `index.test.ts` | the exact public surface [Gate 5] |

**Reading `design/`** follows Phase 2's pattern: resolve the path with
`new URL('../../../design/…', import.meta.url)` and `readFileSync`. The file name contains spaces —
`Nel3ab - Arcade.dc.html` — which `URL` percent-encodes; convert with `fileURLToPath`, not by
string-slicing `.pathname`.

**Extraction of the configurable values:** the prototype declares them in the `data-props`
attribute of its `<script type="text/x-dc">` element as HTML-entity-encoded JSON. Decode `&quot;`
and `JSON.parse` it; do not regex the numbers out of the encoded string.

### 2.10 Root `package.json` · `vitest.config.ts` · `.gitignore` · `.prettierignore` [MODIFIED]

**Implements:** REQ-3.12, NFR-3.3, NFR-3.7

- **`package.json`** — `devDependencies` gains `"@vitest/coverage-v8": "4.1.10"`, character-identical
  to the `vitest` pin. Its only non-optional peer is `vitest@4.1.10`; its `@vitest/browser` peer is
  marked optional upstream (checked 2026-09-30), so strict peers need no rule. `scripts.test`
  becomes `node scripts/check-collected-tests.mjs --coverage` — the wrapper already forwards its
  arguments to Vitest, so **`scripts/check-collected-tests.mjs` itself does not change.**
- **`vitest.config.ts`** — one block under the root `test`, beside `projects`, with a comment
  naming REQ-3.12 and the owner's decision:

  ```ts
  coverage: {
    provider: 'v8',
    include: ['packages/game/src/**/*.ts'],
    exclude: ['packages/game/src/**/*.test.ts', 'packages/game/src/testing/**'],
    reporter: ['text', 'json-summary'],
    thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
  },
  ```

  **`enabled` is not set.** Coverage switches on only through `--coverage` in the `test` script,
  so `pnpm vitest run packages/game/src/clock.test.ts` while iterating is not failed by thresholds
  over files that run did not load. The `projects` array and the `oxc` override are untouched
  (`CLAUDE.md` invariant 9).
- **`.gitignore`** and **`.prettierignore`** — each gains `coverage/`, with a one-line comment. The
  `json-summary` reporter writes `coverage/coverage-summary.json`, which `prettier --check .` would
  otherwise read, and which must never be committed.

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `package.json` | MODIFIED | REQ-3.12, NFR-3.3 — one devDependency, the `test` script |
| `pnpm-lock.yaml` | MODIFIED | NFR-3.3 — by `pnpm install`, never by hand |
| `vitest.config.ts` | MODIFIED | REQ-3.12 — the `coverage` block only |
| `.gitignore` | MODIFIED | NFR-3.7 — `coverage/` |
| `.prettierignore` | MODIFIED | NFR-3.7 — `coverage/` |
| `packages/game/src/types.ts` | NEW | REQ-3.1 |
| `packages/game/src/rules.ts` | NEW | REQ-3.2, REQ-3.6, REQ-3.10 |
| `packages/game/src/clock.ts` | NEW | REQ-3.4, REQ-3.7, REQ-3.9 |
| `packages/game/src/room.ts` | NEW | REQ-3.1, REQ-3.2, REQ-3.6, REQ-3.8 |
| `packages/game/src/reducer.ts` | NEW | REQ-3.3 – REQ-3.8 |
| `packages/game/src/index.ts` | MODIFIED | NFR-3.5 — drops `PLACEHOLDER` |
| `packages/game/src/testing/{prng,sequences,prototype-oracle,harness,invariants,deep-freeze}.ts` | NEW | REQ-3.3, REQ-3.11 |
| `packages/game/src/{rules,room,clock,reducer,purity,prototype-equivalence}.test.ts` | NEW | verification Gates 2–6 |
| `packages/game/src/index.test.ts` | MODIFIED | NFR-3.4, NFR-3.5 |
| `apps/game/src/index.test.ts` | MODIFIED | NFR-3.4 — imports `createRoom` instead of `PLACEHOLDER` |
| `packages/game/package.json` | UNTOUCHED — it looks like it should gain the coverage provider; it must not (NFR-3.2). The provider is a root devDependency | — |
| `packages/game/tsconfig.json` | UNTOUCHED — `src/**/*.ts` already includes `testing/` and the tests, as Phase 2's package does | — |
| `scripts/check-collected-tests.mjs` | UNTOUCHED — already forwards `--coverage` (`process.argv.slice(2)`) | — |
| `.github/workflows/ci.yml` | UNTOUCHED — its `pnpm test` step now enforces coverage with no edit; the `ci` job name is load-bearing (`CLAUDE.md` invariant 1) | — |
| `packages/protocol/**`, `packages/content/**`, `apps/game/src/index.ts` | UNTOUCHED — still `PLACEHOLDER` shells; Phases 11 and 8 | — |
| `apps/web/**` | UNTOUCHED — lists `@nel3ab/game` in `transpilePackages` but imports nothing from it until Phase 5 | — |
| `eslint.config.mjs`, `stylelint.config.mjs`, `.gitattributes` | UNTOUCHED — nothing this phase writes is CSS or needs a new ignore (the coverage reporters emit text and JSON, which ESLint does not lint) | — |
| `design/**`, `specs/**` (except ticking `verification.md`) | UNTOUCHED — NFR-3.1 | — |

---

## 4. Known Risks in This Phase

**R1 — The coverage `include` resolves against the wrong root and matches nothing.** Each Vitest
project sets its own `root`; coverage is a root-level option. If `packages/game/src/**/*.ts` were
resolved against a project root it would match zero files, and thresholds over zero files can pass.
*Revealed by:* Gate 1's file-list box, which reads `coverage-summary.json` and requires named files.
*Fallback:* an absolute glob built from `import.meta.url` in `vitest.config.ts`.

**R2 — A threshold failure does not fail `pnpm test`.** Vitest reports the threshold, but if it only
printed a warning the wrapper would see exit 0. *Revealed by:* Gate 1's bite test on the shell.
*Fallback:* none needed if it bites; if it does not, that is a finding about the provider and REQ-3.13
decides.

**R3 — The oracle shares a misreading with the engine.** Both are written by reading the same
prototype. *Revealed by:* partly — Gate 2 extracts the numbers and the two orderings from the file,
and Gate 6 requires the float oracle to reproduce the prototype's **known defects** (80–90 s silent
rounds end one tick late; 90 wrong-second ticks at 90 s) before it is used. A shared misreading of
control flow that neither the extractions nor the anchors touch would still pass. See verification §9.

**R4 — The suite is too slow for `pnpm test` (NFR-3.6).** The verdict sample alone consumes
2,422,066 steps, each through the reducer and two oracles, with invariants and coverage on.
By design the expensive checks — invariants, deep-freezing, double-reduction for determinism — run on
the per-length sample and the scripted scenarios only; the verdict sample compares observations and
nothing else. *Revealed by:* Gate 7's timing box. *Fallback:* run the expensive checks on a stated
subset of the per-length sample, recorded in `verification.md` as a finding. **Never** shrink either
sample itself: both are pre-registered measurements.

**R5 — `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` push toward `!` assertions.**
`pool[i % n]` is `Question | undefined`; a `!` would compile and hide exactly the empty-pool case.
*Revealed by:* review, and by the coverage rule (§2.4) — a `!` has no branch to cover, so it cannot
be caught by coverage; use `?? null` as specified.

**R6 — The integer contract moves a rounding decision onto every caller.** A driver that measures
elapsed wall time (Phase 11's server, or a Phase 5 browser loop using `performance.now()` deltas)
must round to whole milliseconds, and rounding each delta independently with `Math.round` can drift
by up to 0.5ms per tick — about ±225ms over a 45 s bank in the worst case. The engine cannot detect
this. Carried forward to Phase 5 and Phase 11 in verification §9; not solved here.

**R7 — The reveal defence is only reachable by an inconsistent state.** §2.4's third condition
exists for a state no action produces. If a later refactor makes it unreachable even by hand, the
coverage rule forces its deletion — which is correct, and should be recorded rather than argued with.

---

*Last updated: 2026-09-30*
