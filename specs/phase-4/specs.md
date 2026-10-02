# Phase 4 Technical Specification — Rules engine: round & match flow

> **Phase:** Phase 4
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** 1 day

---

## 1. Architecture Overview

Everything this phase builds lives in `packages/game/src`. **Nothing outside that directory
changes** — no manifest, no lockfile, no configuration (NFR-4.7). Phase 3's coverage block already
includes `packages/game/src/**/*.ts` and excludes exactly test files and `src/testing/`, so every new
module is measured the moment it exists.

**Dependency order is part of the design.** A runner walks it top to bottom; each step is buildable
and testable before the next begins. STEP 1 is the only step that touches Phase 3's files, and it ends
with Phase 3's whole suite green — so from STEP 2 on, a red Phase 3 test is a regression this phase
caused, never a pending edit. The exit-criterion verdict sits after every ordinary check it depends on.

```
  STEP 1 ─ The one new field, and Phase 3 kept green
  ┌──────────────────────────────────────────────────────────────────────┐
  │ types.ts         [MOD]  RoomState.revealedAt; Action + 4; Random     │
  │ rules.ts         [MOD]  REVEAL_HOLD_MS                               │
  │ room.ts          [MOD]  createRoom: revealedAt null                  │
  │ reducer.ts       [MOD]  correct records it; startRound clears it     │
  │ room.test.ts · reducer.test.ts   [MOD]  the sanctioned edits (§2.9)  │
  │   ── pnpm vitest run packages/game: Phase 3's suite green            │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 2 ─ The draw (pure, no reducer) ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ draw.ts          [NEW]  drawableCategories, drawCategory,            │
  │                         shuffleQuestions; internal choice lists      │
  │ draw.test.ts     [NEW]                                               │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 3 ─ The flow                ▼   ── needs the draw's choice lists
  ┌──────────────────────────────────────────────────────────────────────┐
  │ clock.ts         [MOD]  internal passClock, otherTeam                │
  │ match.ts         [NEW]  startingTeam, nextJudgeIndex, beginRound,    │
  │                         scoreRound, assertRoundPayload, matchWinner  │
  │ reducer.ts       [MOD]  startMatch, nextRound, passTurn, resetMatch; │
  │                         endRound scores a match round                │
  │ match.test.ts    [NEW]  every row of §2.6; Table G                   │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 4 ─ Public surface          ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ index.ts         [MOD]  17 runtime exports                           │
  │ index.test.ts    [MOD]  the sanctioned edits (§2.9)                  │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 5 ─ Fidelity, test support, purity, equivalence ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ match-rules.test.ts          [NEW]  extractions (REQ-4.12)           │
  │ testing/rooms.ts · match-oracle.ts · match-sequences.ts ·            │
  │   match-harness.ts · match-invariants.ts           [NEW]             │
  │ match-purity.test.ts         [NEW]                                   │
  │ match-equivalence.test.ts    [NEW]  ── 🚦 REQ-4.14 lives here         │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 6 ─ Gates                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 100% coverage + named mutations caught · four gate commands          │
  └──────────────────────────────────────────────────────────────────────┘
```

**Module dependency inside the package** runs one way and has no cycle:

```
  types.ts ◀── rules.ts ◀── clock.ts ◀── room.ts ◀── draw.ts ◀── match.ts ◀── reducer.ts ◀── index.ts
                                                                                   ▲
                    testing/*  ── imports all of the above, is imported by tests only
```

`draw.ts` imports no other engine module except `types.ts`; it sits after `room.ts` only to keep the
chain linear. `match.ts` imports `clock.ts`, `draw.ts` and `rules.ts`, never `reducer.ts`.

---

## 2. Component Specifications

### 2.1 `packages/game/src/types.ts` [MODIFIED]

**Implements:** REQ-4.1, REQ-4.6, REQ-4.11

Types only, every property `readonly`, as Phase 3 wrote it. Three changes, nothing else:

```ts
export interface RoomState {
  // … Phase 3's twenty fields, unchanged …
  /** Engine time at which the current reveal went up; `null` exactly when `reveal` is. REQ-4.6. */
  readonly revealedAt: number | null
}

/** A random source: each call returns a number in [0, 1). `Math.random`'s shape; never called by the reducer. */
export type Random = () => number

export type Action =
  // … Phase 3's five members, unchanged …
  | {
      readonly type: 'startMatch'
      readonly categoryId: CategoryId
      readonly questions: readonly [Question, ...Question[]]
    }
  | {
      readonly type: 'nextRound'
      readonly categoryId: CategoryId
      readonly questions: readonly [Question, ...Question[]]
    }
  | { readonly type: 'passTurn' }
  | { readonly type: 'resetMatch' }
```

**The handoff contract, extended.** Phase 3's specs.md §2.1 table stands row for row (rows 1–22 and its
two `+` rows). This phase adds exactly one row:

| # | `design/README.md` "State Management" | `RoomState` path | Difference and reason |
|---|---|---|---|
| + | — | `revealedAt` | **added** — the reveal's start in engine time, so the engine can refuse `passTurn` before the 1000 ms hold has elapsed (REQ-4.6, DECIDED 2026-10-02). The prototype keeps the same fact implicitly, in a pending `setTimeout` |

It is a **top-level** field, not a property of `Reveal`, deliberately: Phase 3's REQ-3.10 extraction
test (`rules.test.ts`, extraction #10), its invariant I9 and its `correct` test all compare `reveal`
with `{ answer, fact }` exactly. A top-level field leaves the first two untouched and changes one
expected state in the third (§2.9).

Rows 10–14 (`round`, the tallies, `log`, `categoryId`) and rows 5–8 are used for the first time in
this phase and keep Phase 3's types: `RoundLogEntry` stays `{ n, category: CategoryId, winner: Team }`
(requirements.md, reading 3). The clock rows (18–19 and the two Phase 3 additions) are not touched.

### 2.2 `packages/game/src/rules.ts` [MODIFIED]

**Implements:** REQ-4.6, REQ-4.12

One constant, beside Phase 3's six:

```ts
export const REVEAL_HOLD_MS = 1000
```

The prototype's `setTimeout(() => this.passTurn(), 1000)`. REQ-4.12 extracts it from the file at test
time. There is still no tick constant.

### 2.3 `packages/game/src/clock.ts` [MODIFIED]

**Implements:** REQ-4.6

Two internal additions — exported from the module for `match.ts` and `reducer.ts`, **not** from
`index.ts`. Nothing existing changes; the representation is Phase 3's.

| Function | Contract |
|---|---|
| `otherTeam(team: Team): Team` | `'a'` ↔ `'b'` |
| `passClock(clock: ClockState, full: number): ClockState` | the turn passes. `next = otherTeam(clock.active)`; `banks[next]` becomes `{ ms: full, started: true }` if `banks[next].started` is `false`, and is kept **as is** (same object) if it is `true`; `active = next`; `runningSince = clock.now`. The other bank — the team that answered — is not touched: `correct`'s `stopClock` already settled it |

**Silent failure modes — each has a named mutation in verification Gate 6:**

- **Anchoring at the wrong moment.** `runningSince` must be `clock.now` — the engine time of the
  `passTurn` that took effect — not `revealedAt` and not `revealedAt + REVEAL_HOLD_MS`. With a 100 ms
  driver that sends `passTurn` after every tick the three coincide, so **the equivalence harness
  cannot see this bug**; only a unit test that sends `passTurn` late can (Gate 3).
- **Refilling a team that has already played.** `started ? bank : full` — writing `full` always gives
  a team its whole bank back every turn. The scripted matches M2 and M14 return a team to a frozen,
  part-spent bank.
- **Settling the answering team again.** Its bank was settled at `correct` with `runningSince` then
  set to `null`; reading `remainingMs` for it again is harmless only while `active` still names it.
  `passClock` never reads or writes it.

### 2.4 `packages/game/src/draw.ts` [NEW]

**Implements:** REQ-4.1, REQ-4.2, REQ-4.3

Pure functions. None imports a random source; the two that need one take it as a parameter. The word
the ambient grep searches for never appears here, comments included (NFR-4.2).

**Internal** (exported from the module, not from `index.ts`):

| Function | Contract |
|---|---|
| `unusedCategories(state)` | `state.pickedCategories` filtered to those not in `state.usedCategories` — **selection order kept** |
| `nextRoundChoices(state)` | `unusedCategories(state)` if non-empty, else `state.pickedCategories` — the set `nextRound` validates against (REQ-4.3's fallback) |

**Public:**

| Function | Contract |
|---|---|
| `drawableCategories(state): readonly CategoryId[]` | the list the **next round** may be drawn from, given the screen the room is on: on `ready` and `match` — where the next round is a match's first, and the used list will start empty — `state.pickedCategories`; on every other screen, `nextRoundChoices(state)`. A driver always draws with `drawCategory(drawableCategories(state), random)` and never needs to know which action follows |
| `drawCategory(choices, random): CategoryId` | `choices[Math.floor(random() × choices.length)]` — the prototype's formula, one call to `random`. **One guard covers every bad input:** if the indexed element is `undefined` — an empty list, a random value ≥ 1, < 0 or `NaN` — throw `RangeError` naming the value and the length. No separate empty check, and no `!` (Phase 3's R5): every branch is reachable |
| `shuffleQuestions(questions, random): Question[]` | a **new** array; `questions` never mutated. **Random insertion:** for `i = 0 … n − 1`, insert `questions[i]` into the output at position `Math.floor(r × (i + 1))`, `r = random()` — exactly **n** calls, in that order (the first always yields position 0). Throw `RangeError` if any `r` is not in [0, 1) (`!(r >= 0 && r < 1)`, so `NaN` throws). Iterate with `entries()` or `forEach` so the element is typed `Question`, and insert with `splice(position, 0, q)`: no indexed read, so no `undefined` to guard |

**Why random insertion, not the swap form of Fisher–Yates.** Both are uniform. Under the package's
`noUncheckedIndexedAccess`, a swap reads `out[i]` and `out[j]` as `Question | undefined`, and every way
to make that typecheck is either a `!`, an `as`, or a guard whose throw no input reaches — the last of
which fails 100% branch coverage. Inserting into a growing array reads nothing by index. The map from
the draw vector *(j₁, …, jₙ₋₁)*, *jᵢ* ∈ [0, *i*], to orderings is a bijection, so a uniform random
source gives every one of the *n*! orderings probability exactly 1/*n*! — verification Gate 2 checks
the bijection exhaustively for *n* = 1 … 6.

### 2.5 `packages/game/src/match.ts` [NEW]

**Implements:** REQ-4.1, REQ-4.4 – REQ-4.10

**Public:**

| Function | Contract |
|---|---|
| `matchWinner(state): Team \| null` | `'a'` if `tallyA > tallyB`, `'b'` if `tallyB > tallyA`, else `null` — the tie of REQ-4.8. Meaningful on `match`; defined everywhere |

**Internal** (exported from the module for the reducer, not from `index.ts`):

| Function | Contract |
|---|---|
| `startingTeam(round: number): Team` | `round % 2 === 1 ? 'a' : 'b'` — the prototype's line, verbatim |
| `nextJudgeIndex(state): number` | `state.rotateJudge ? (state.judgeIndex + 1) % Math.max(1, state.players.length) : state.judgeIndex` — the prototype's line, verbatim |
| `assertRoundPayload(kind, state, action)` | throws unless the payload is well-formed and allowed — see below |
| `beginRound(state, round, categoryId, questions): RoomState` | the round start every match round shares: `round`; `categoryId`; `usedCategories` with `categoryId` appended **only if absent**; `screen 'play'`; `questionPool = questions`; `questionIndex = hintIndex = 0`; `reveal = revealedAt = null`; `clock = startClock(state.clock.now, startingTeam(round), roundMs(state.config))` — Phase 3's own transition, so the starting bank runs from the current engine time and the other is full and not started |
| `scoreRound(state): RoomState` | applied to a state that `endRound` has just ended (§2.6): if `state.categoryId === null`, return it unchanged (reading 1). Otherwise: `winner = otherTeam(state.clock.active)`; add 1 to that team's tally; append `{ n: state.round, category: state.categoryId, winner }` to `log`; `screen = 'match'` if either tally ≥ `config.winsNeeded` or `unusedCategories(state).length === 0`, else `'roundEnd'` |

**`assertRoundPayload` — validation, which precedes inertness (REQ-3.3, NFR-4.3).** Called first in
both `startMatch` and `nextRound`, in every state:

| Check | Throws |
|---|---|
| `categoryId` is a string in the allowed list — `state.pickedCategories` for `startMatch`; `nextRoundChoices(state)` for `nextRound` | `RangeError` naming the category and the list |
| `questions` is an array with at least one element | `RangeError` |
| no two questions share the same `q` | `RangeError` naming the repeated text |

The repeat check is by question text, the one field a player sees: two entries with the same text would
show the same question twice before the pool wraps (REQ-4.1, `design/user-stories.md` H-06 "بلا تكرار").
Content-level duplicate detection across a whole bank is Phase 8's CI check, not this.

### 2.6 `packages/game/src/reducer.ts` [MODIFIED]

**Implements:** REQ-4.1, REQ-4.4 – REQ-4.11

Phase 3's `switch` gains four cases; three existing paths change by one line each; nothing else moves.
**Validation precedes inertness**; an inert action returns `state` itself.

| Action | Validation (throws) | Inert when (returns `state`) | Effect |
|---|---|---|---|
| `startMatch` | `assertRoundPayload('startMatch', …)` | `screen` is neither `ready` nor `match` | `beginRound({ ...state, tallyA: 0, tallyB: 0, log: [], usedCategories: [] }, 1, categoryId, questions)`. `judgeIndex` unchanged |
| `nextRound` | `assertRoundPayload('nextRound', …)` | `screen !== 'roundEnd'` | `beginRound({ ...state, judgeIndex: nextJudgeIndex(state) }, state.round + 1, categoryId, questions)` |
| `passTurn` | — | `revealedAt === null`, or `clock.now − revealedAt < REVEAL_HOLD_MS` | `clock = passClock(clock, roundMs(config))`; `questionIndex + 1`; `hintIndex = 0`; `reveal = null`; `revealedAt = null` |
| `resetMatch` | — | `screen` is neither `roundEnd` nor `match` | `screen 'setup'`; `round 1`; `tallyA = tallyB = 0`; `log = []`; `usedCategories = []`; `categoryId = null`; `reveal = revealedAt = null`. `clock`, `questionPool`, both indices and every setup field are untouched (requirements.md, reading 5) |
| `correct` *(changed)* | — | as Phase 3 | as Phase 3, **plus** `revealedAt = clock.now` |
| `startRound` *(changed)* | as Phase 3 | as Phase 3 | as Phase 3, **plus** `revealedAt = null` beside `reveal = null` |
| round end *(changed)* | — | — | Phase 3's `endRound(state, clock)` result passed through `scoreRound`. One function still serves all three round-ending paths — tick, hint, skip |

**Why `passTurn` tests only `revealedAt`.** In every state an action can produce, `revealedAt !== null`
holds exactly when the screen is `play`, a reveal is up and the clock is stopped (verification
invariant J1). Testing `screen` or `reveal` as well would add branches that only a hand-built
inconsistent state reaches; testing `revealedAt` alone is the whole rule and leaves nothing to cover by
hand. A hand-built state with a reveal but no `revealedAt` therefore cannot pass the turn — a stuck
state rather than a wrong one, and one no action produces.

**`passTurn` in a round with no category** (Phase 3's `startRound`) behaves exactly as in a match
round: the turn passes. Phase 3's tests never send it, so their reveals stay up as Phase 3 specified.

**The reducer still never** reads the wall clock, draws a random number, starts a timer, logs, or
mutates `state` or `action` (Phase 3's §2.5). Nothing in this phase calls `drawCategory` or
`shuffleQuestions` from the reducer: they are for drivers and tests.

### 2.7 `packages/game/src/room.ts` [MODIFIED]

**Implements:** REQ-4.11

`createRoom` returns `revealedAt: null` beside `reveal: null`. Nothing else changes.

### 2.8 `packages/game/src/index.ts` [MODIFIED]

**Implements:** NFR-4.4

Runtime exports are **exactly** these seventeen — Phase 3's twelve and five more:

```
acceptsJudgeActions   createRoom   currentQuestion   displaySeconds   reduce   remainingMs
HINT_COST_MS   SKIP_COST_MS   ROUND_SECONDS_DEFAULT   ROUND_SECONDS_OPTIONS
WINS_NEEDED_DEFAULT   WINS_NEEDED_OPTIONS
REVEAL_HOLD_MS   drawableCategories   drawCategory   shuffleQuestions   matchWinner
```

plus `export type` of every type in §2.1, `Random` included. The internal names of §2.3–§2.5 —
`otherTeam`, `passClock`, `unusedCategories`, `nextRoundChoices`, `startingTeam`, `nextJudgeIndex`,
`assertRoundPayload`, `beginRound`, `scoreRound` — are not exported. The header comment names Phase 4
beside Phase 3.

### 2.9 Phase 3's test files — the sanctioned edits [MODIFIED]

**Implements:** REQ-4.11

These are the **only** changes to any file Phase 3 wrote under `packages/game/src`. Each is a list or
an expected value Phase 3 wrote to fail when this phase extended the state or the surface. Everything
else in these three files, and every byte of `clock.test.ts`, `purity.test.ts`, `rules.test.ts`,
`prototype-equivalence.test.ts` and `src/testing/*`, is unchanged — verification Gate 1 checks it with
`git diff`.

| File | Edit |
|---|---|
| `room.test.ts` | `ADDED` gains `['revealedAt']`; `TOP_LEVEL_KEYS` gains `'revealedAt'`; `toHaveLength(20)` becomes `21`; the test title's "20 top-level" becomes "21"; the comment above `ADDED` says three `+` rows, the third Phase 4's |
| `index.test.ts` | the sorted export list gains the five names of §2.8 and its title says seventeen; the `kinds` map gains `REVEAL_HOLD_MS: 'number'` and the four `'function'`s; the internal-names test gains the nine names of §2.8, each with its module |
| `reducer.test.ts` | the REQ-3.8 test "the reveal is the current question's answer and fact; the bank is settled; nothing else changes" — its expected state after `correct` gains `revealedAt: 3_700` (the engine time at which that test's reveal goes up). Its title stays: `revealedAt` is the one thing besides the reveal and the settled bank that `correct` now changes, and the edit says so in a one-line comment |

`apps/game/src/index.test.ts` imports only `createRoom` and is untouched.

### 2.10 `packages/game/src/testing/` [NEW] — the test support

**Implements:** REQ-4.13, REQ-4.14. Excluded from coverage, never exported, imported only by
`*.test.ts`. **Phase 3's six modules here are not edited** (REQ-4.11); this phase adds five beside
them and imports `prng.ts`, `deep-freeze.ts` and `invariants.ts` from them unchanged.

**`rooms.ts`** — synthetic content and hand-built rooms:

- `categoryQuestions(id)` — exactly three questions, each with two hints:
  `{ q: \`${id}-q${k}\`, a: \`${id}-a${k}\`, alts: [], h: ['h1', 'h2'], f: \`${id}-f${k}\` }` for
  `k = 0, 1, 2` — the prototype's shape (three questions, two hints each), synthetic text, nothing
  copied from `design/`.
- `categoryIds(k)` — `['c0', …, 'c{k−1}']`.
- `readyRoom({ roundSeconds, winsNeeded, picked, players, rotateJudge, judgeIndex })` —
  `{ ...createRoom({ roomCode: 'TEST01', teamA: 'أ', teamB: 'ب', config: { roundSeconds, winsNeeded } }),
  players, pickedCategories: picked, rotateJudge, judgeIndex, screen: 'ready' }`, where `players` is
  `players` entries `{ id: 'p<n>', name: 'p<n>', team: n even ? 'a' : 'b' }`. **This stands in for
  Phase 5's setup**, and is the only hand-built `ready` state.

**`match-sequences.ts`** — the pre-registered generator and the scripted matches. These constants are
**fixed by this document**; changing any of them changes the verdict's sample and is forbidden
(verification Gate 5):

```ts
export const MATCH_SEED = 0x20261002
export const MATCH_RATES = [0.02, 0.05, 0.1] as const
export const MATCH_MAX_STEPS = 40_000

/** One configuration: five rand() calls, in this order. */
export function drawMatchConfig(rand: () => number, roundSeconds: number) {
  const winsNeeded = [2, 3, 4][Math.floor(rand() * 3)]
  const picked = categoryIds(1 + Math.floor(rand() * 8)) // 1 … 8 categories
  const players = 2 + Math.floor(rand() * 9) // 2 … 10 players
  const rotateJudge = rand() < 0.5
  const judgeIndex = Math.floor(rand() * players)
  return { roundSeconds, winsNeeded, picked, players, rotateJudge, judgeIndex }
}

/** The harness's OWN permutation of [0 … n−1] — Durstenfeld, descending, n − 1 rand() calls.
 *  Deliberately not the engine's shuffleQuestions: the sample must not depend on engine code. */
export function permutation(rand: () => number, n: number): number[] { /* for i = n−1 … 1: j = floor(rand()·(i+1)); swap */ }
```

**A draw** is one `rand()` — the category value `r` — followed by `permutation(rand, 3)`.

**A sequence** is generated one event at a time, from the **exact oracle's** screen (the oracle that
times everything, as Phase 3's exact oracle timed its stop rule):

| Exact oracle's screen | Event |
|---|---|
| `ready` (the start) | `startMatch` + a draw — always the first event |
| `play` | `rand() < rate` ? (`r = rand()`: `r < 0.5` → `correct`; `r < 0.8` → `skip`; else `hint`) : `tick` |
| `roundEnd` | `r = rand()`: `r < 0.25` → `tick`; `r < 0.95` → `nextRound` + a draw; else `resetMatch` — **the sequence ends** |
| `match` | if two matches have ended, **the sequence ends** before any draw. Else `r = rand()`: `r < 0.25` → `tick`; `r < 0.6` → `startMatch` + a draw (a rematch); else `resetMatch` — **the sequence ends** |

A sequence also ends at `MATCH_MAX_STEPS` events. "A match has ended" is counted each time the exact
oracle's screen becomes `match` from another screen. The only flow events are those whose buttons the
prototype shows on that screen.

A **sample** is `(roundSeconds, seed, n)`: one `mulberry32(seed)` shared by the whole sample; sequence
`i` (0-based, in order) draws its configuration with `drawMatchConfig`, then its events, at rate
`MATCH_RATES[i % 3]`.

| Sample | `roundSeconds` | `seed` | `n` |
|---|---|---|---|
| verdict | 45 | `MATCH_SEED` | 500 |
| per-length | each of the 15 in `ROUND_SECONDS_OPTIONS` | `MATCH_SEED + roundSeconds` | 20 each |

**The scripted matches** — verification Table G, as data: per match, a configuration (default:
45 s, `winsNeeded` 3, `picked` c0–c7, 5 players, judge 4, rotation off — the prototype's own initial
state, which has five players, judge index 4 and eight free categories selected) and a script of
`tick ×N`, `hint`, `skip`, `correct`, `resetMatch`, `startMatch(category, perm?)` and
`nextRound(category, perm?)`, `perm` defaulting to `[0, 1, 2]`. A scripted draw names its category.
In the equivalence run (Gate 5) the harness turns it into `r = (i + 0.5) / length`, where `i` is the
named category's position in the **exact oracle's** drawable list, and gives that same `r` to all
three — so the engine draws through `drawCategory(drawableCategories(state), () => r)` like every
other draw, and lands on the named category only if its drawable list agrees with the prototype's. In
`match.test.ts` (Gate 3) the engine plays Table G alone and is given the named category directly.

**`match-oracle.ts`** — a transcription of the prototype's `Component` flow, every branch commented
with the method it comes from (`drawCategory`, `startRound`, `startClock`, `spend`, `markCorrect`,
`passTurn`, `markSkip`, `giveHint`, `endRound`, `nextRound`, `rematch`, `resetAll`, the getters
`remaining`, `startingTeam` and `question`). Phase 3's `prototype-oracle.ts` models one turn and its
pre-registered tables depend on that, so it is **not** extended; this is a second, fuller oracle. One
function, two arithmetics, exactly as Phase 3's §2.8 defines them — `'float'` in seconds (`v − 0.1`,
`v − 2`, `v − 3`, `Math.ceil`) and `'exact'` in integer tenths (`v − 1`, `v − 20`, `v − 30`,
`floor((v + 9) / 10)`) — over **both** banks. Its state is the prototype's: `screen`, `round`, the
tallies, `log`, `usedCats`, `catIdx`, `a`, `b`, `active`, `pool`, `qi`, `hintIdx`, `reveal`,
`judgeIdx`, whether the clock runs, and the pending hold.

| Event | Transcribes |
|---|---|
| `tick` | if a hold is pending: count it down, and on the **tenth** tick (1000 ms) run `passTurn`; else, if the clock runs and no reveal is up: drain the active bank by one tick, and end the round at ≤ 0 |
| `correct` · `skip` · `hint` | `markCorrect` (stop the clock, raise the reveal, start a 10-tick hold) · `markSkip` · `giveHint` — Phase 3's guards and order |
| `startMatch(r, perm)` | on `ready`, `goWheel`; on `match`, `rematch` (reset round, tallies, log, used — then draw); elsewhere nothing |
| `nextRound(r, perm)` | on `roundEnd`, `nextRound` → `drawCategory` with the next round and judge; elsewhere nothing |
| `resetMatch` | on `roundEnd` or `match`, `resetAll`; elsewhere nothing |

`drawCategory` uses `r` where the prototype calls `Math.random()`, and `startRound` uses `perm` where
the prototype calls `shuffle`: `pool = perm.map(k => categoryQuestions(catIdx)[k])`.

An **observation** is the 17-tuple *(screen, round, tallyA, tallyB, active, display a, display b,
started a, started b, reveal up, hintIndex, questionIndex, category, used list, judge index, log length,
last log entry)*, the last as `n:category:winner` or empty.

**`match-harness.ts`** — runs one sequence (generated or scripted) through the engine and both oracles
in lockstep. The engine starts from `readyRoom(config)`. Each event maps to an action:

| Event | Engine action(s) |
|---|---|
| `tick` | `{ type: 'tick', ms: 100 }`, then **`{ type: 'passTurn' }`** — every tick, as a driver would; it is inert until due |
| `correct` · `skip` · `hint` · `resetMatch` | `{ type: event }` |
| `startMatch` / `nextRound` with value `r`, permutation `perm` | `categoryId = drawCategory(drawableCategories(state), () => r)`; `questions = perm.map(k => categoryQuestions(categoryId)[k])`; `{ type, categoryId, questions }` — the engine's public helpers, exactly as a driver uses them. A flow event is dispatched to the engine **only** if the engine is on the screen that event's button exists on; otherwise the step is recorded as the engine's divergence and the engine is fed nothing further |

The engine's observation uses `displaySeconds(remainingMs(clock, team))` and the state's fields. After
every event the harness records the first step at which engine ≠ exact, and — when asked — engine ≠
float and float ≠ exact. The engine ≡ float comparison is **off** unless a caller asks for it, so no
run makes it by accident: on the verdict sample and the scripted matches it is the 🚦 box of
REQ-4.14, evaluated once. Per sequence the harness returns the steps consumed, the matches ended, the
exact oracle's final screen, and the first divergences.

**`match-invariants.ts`** — `assertMatchInvariants(state, prev?)`, called after every step of every
per-length sequence and every scripted match, **together with Phase 3's `assertInvariants`**, which
applies to match states unchanged (its I6 covers `roundEnd`; J5 below covers `match`):

| # | Invariant |
|---|---|
| J1 | `revealedAt !== null` ⇔ `reveal !== null`; and when non-null, `revealedAt` is an integer in `[0, clock.now]`, `screen === 'play'` and `runningSince === null` |
| J2 | `tallyA + tallyB === log.length`; each tally equals the number of log entries naming that team; `log[i].n === i + 1` |
| J3 | both tallies ≤ `winsNeeded`; at most one equals it |
| J4 | on `roundEnd`: both tallies < `winsNeeded` and `unusedCategories(state)` is non-empty |
| J5 | on `match`: `banks[active].ms === 0`, `runningSince === null`, `reveal === null`, and either a tally equals `winsNeeded` or `unusedCategories(state)` is empty |
| J6 | on `play`, `roundEnd` and `match`: `categoryId ∈ pickedCategories` and `categoryId ∈ usedCategories`; `usedCategories` ⊆ `pickedCategories`, without repeats, and `usedCategories.length === round` |
| J7 | on `play`: `banks[startingTeam(round)].started === true` |
| J8 | `0 ≤ judgeIndex < max(1, players.length)` |

J6's `usedCategories.length === round` holds because the flow never reaches the fallback (requirements
§1.1, fact 1); a run that reached it would show here first.

### 2.11 Tests [NEW]

All under `packages/game/src/`. The verification gate each serves is in brackets.

| File | Asserts |
|---|---|
| `draw.test.ts` | `drawableCategories` on every screen and with a used list; `drawCategory`'s formula, its bounds and its one guard; `shuffleQuestions`' bijection for *n* = 1 … 6, its exact outputs for pinned random sequences, its draw count, its non-mutation and its guard; the prototype's shuffle measured against Table H [Gate 2] |
| `match.test.ts` | every row of §2.6's table, each boundary named there, the late-`passTurn` anchor, the fallback by a hand-built state, `matchWinner`, and Table G through the engine alone [Gate 3] |
| `match-rules.test.ts` | the flow's numbers and formulas extracted from `design/designs/Nel3ab - Arcade.dc.html` at run time, each count-asserted and each driving the engine [Gate 4] |
| `match-purity.test.ts` | frozen inputs, determinism, ambient spies and validation-before-inertness over the per-length sample and Table G [Gate 4] |
| `match-equivalence.test.ts` | generator fingerprint; oracle anchors; Table F; engine ≡ exact; invariants; 🚦 engine ≡ float [Gate 5] |

**Reading `design/`** follows Phase 3's pattern: `new URL('../../../design/…', import.meta.url)`,
`fileURLToPath`, `readFileSync`; the file name has spaces.

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `packages/game/src/types.ts` | MODIFIED | REQ-4.1, REQ-4.6 — `revealedAt`, four actions, `Random` |
| `packages/game/src/rules.ts` | MODIFIED | REQ-4.6 — `REVEAL_HOLD_MS` |
| `packages/game/src/clock.ts` | MODIFIED | REQ-4.6 — internal `otherTeam`, `passClock` |
| `packages/game/src/room.ts` | MODIFIED | REQ-4.11 — `revealedAt: null` |
| `packages/game/src/draw.ts` | NEW | REQ-4.1 – REQ-4.3 |
| `packages/game/src/match.ts` | NEW | REQ-4.1, REQ-4.4 – REQ-4.10 |
| `packages/game/src/reducer.ts` | MODIFIED | REQ-4.4 – REQ-4.11 |
| `packages/game/src/index.ts` | MODIFIED | NFR-4.4 — seventeen exports |
| `packages/game/src/{room,index,reducer}.test.ts` | MODIFIED | REQ-4.11 — the sanctioned edits of §2.9, and only those |
| `packages/game/src/{draw,match,match-rules,match-purity,match-equivalence}.test.ts` | NEW | verification Gates 2–5 |
| `packages/game/src/testing/{rooms,match-sequences,match-oracle,match-harness,match-invariants}.ts` | NEW | REQ-4.13, REQ-4.14 |
| `packages/game/src/{clock,purity,rules,prototype-equivalence}.test.ts` | UNTOUCHED — Phase 3's evidence | REQ-4.11 |
| `packages/game/src/testing/{prng,sequences,prototype-oracle,harness,invariants,deep-freeze}.ts` | UNTOUCHED — Phase 3's pre-registered machinery | REQ-4.11 |
| `packages/game/package.json`, `packages/game/tsconfig.json` | UNTOUCHED — no dependency; `src/**/*.ts` already includes every new file | NFR-4.2, NFR-4.7 |
| `vitest.config.ts`, root `package.json`, `pnpm-lock.yaml` | UNTOUCHED — coverage already measures `packages/game/src/**/*.ts` | NFR-4.7 |
| `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`, `eslint.config.mjs`, `stylelint.config.mjs`, `.gitattributes`, `.gitignore`, `.prettierignore` | UNTOUCHED | NFR-4.7 |
| `apps/**`, `packages/{protocol,content,ui}/**` | UNTOUCHED | §4 of requirements.md |
| `design/**`, `specs/**` (except ticking `verification.md`) | UNTOUCHED | NFR-4.1 |

---

## 4. Known Risks in This Phase

**R1 — The new oracle shares a misreading with the engine.** Both are written by reading the same
`Component` class. *Revealed by:* partly — Gate 4 extracts every number and formula the flow uses from
the file; Gate 5 requires the new float oracle to reproduce Phase 3's Table A float row (its known
defects at 80–90 s) and Table F before it is trusted. A shared misreading of control flow that neither
touches would still pass. See verification §9.

**R2 — The `passTurn` anchor bug is invisible to the harness.** A 100 ms driver that sends `passTurn`
after every tick makes `now`, `revealedAt + 1000` and the hold's end coincide (§2.3). *Revealed by:*
Gate 3's late-`passTurn` box and mutation N1 — nothing else.

**R3 — Phase 3's suite goes red for a reason that looks like a sanctioned edit.** The temptation is to
"fix" a Phase 3 test that a Phase 4 change broke. *Revealed by:* Gate 1's `git diff` box, which allows
exactly §2.9's hunks. *Fallback:* none — a Phase 3 test failing outside §2.9 means a Phase 3 rule
changed. Stop.

**R4 — The suite is too slow for `pnpm test` (NFR-4.5).** The two match samples add about 2,000,000
steps, each through the reducer (twice per tick, with `passTurn`) and two oracles, to Phase 3's
2,429,148. *Revealed by:* Gate 6's timing box. *Fallback:* run the expensive checks — invariants,
freezing, double reduction — on a stated subset of the per-length sample, recorded as a finding.
**Never** shrink either sample.

**R5 — `noUncheckedIndexedAccess` pushes toward `!`.** `choices[k]`, `pool[i]`, `log[log.length − 1]`.
*Revealed by:* review and the coverage rule. Use the single-guard pattern of §2.4 or `?? null`, never
`!` or `as`.

**R6 — The fallback is reachable only by hand.** REQ-4.3's fallback and J6's equality depend on a fact
about the flow (requirements §1.1, fact 1). If a later phase adds a path to a draw with every category
used — Phase 5's setup, say — the fallback becomes live and J6's equality stops holding. That is
correct, and is that phase's to record.

**R7 — A driver that forgets `passTurn`, draws non-randomly, or dispatches `startRound`.** The engine
cannot detect any of the three (requirements REQ-4.1, REQ-4.6, reading 1). Carried forward to Phases 5
and 11 in verification §9.

---

*Last updated: 2026-10-02*
