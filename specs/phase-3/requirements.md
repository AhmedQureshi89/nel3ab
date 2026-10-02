# Phase 3 Requirements — Rules engine: state & clock

> **Phase Status:** Ready for Implementation
> **Parent Roadmap:** [../roadmap.md](../roadmap.md)
> **Constitution:** [../mission.md](../mission.md) · A-1, A-2, A-3 in force, none binds this phase · two owner decisions of 2026-09-30 recorded in REQ-3.4 and REQ-3.12 · no proposals in force
> **Duration:** 1 day

---

## 1. Overview & Objectives

Phase 3 builds **the game's core arithmetic as pure functions, with no UI and no network**:
the room's state type, one reducer, the two team clocks, and the costs of a hint and a skip.
No screen ships, no server ships, no socket opens. What ships is the part of the product that
decides who wins a round — and `mission.md` §5.2 calls the clock "the one number that must be
beyond dispute."

The premise this phase rests on is Phases 1 and 2, and both held. Phase 1's 🚦 stack verdict
returned **PASS** at `2961449` (Node 24 · TypeScript 5.9.3 strict with project references ·
Vitest 4.1.10 · pnpm 11.22.0, no override, no ignored peer range, no floated pin). Phase 2's two
🚦 verdicts returned **PASS** at `5cfeec5` and `d97f191`, and the phase closed at `3b7d1d5` with
35 / 35 boxes ticked. Neither phase recorded a FAIL, so nothing constrains what this phase may
assume. None of the five findings Phase 2 carried forward binds Phase 3 (they bind Phases 5 and 9).

`@nel3ab/game` exists today as the Phase 1 shell: `src/index.ts` exports `PLACEHOLDER = true`,
the manifest declares **no dependencies**, `tsconfig.json` is a `NodeNext` project referenced from
the root solution file, and the package has one test. Three workspace projects already point at
it: `packages/protocol` and `apps/game` declare it as a dependency, and `apps/web` lists it in
`transpilePackages`. Exactly one file imports from it — `apps/game/src/index.test.ts`, which
imports `PLACEHOLDER` — and that file will break when this phase removes the shell export.

The sharpest version of the question this phase answers:

> **Can the prototype's clock — which exists only as a `setInterval` in one browser tab,
> subtracting 0.1 from a floating-point number — be re-expressed as a pure
> `(state, action) => state` function over integer milliseconds, so that a 45-second round played
> through it ends at the same moment, for the same team, showing the same seconds on the way, as
> it does in the prototype?**

### 1.1 The prototype's clock is inexact — measured before this plan was written

`design/designs/Nel3ab - Arcade.dc.html` keeps each bank as floating-point **seconds**. Every 100ms
its interval does `Math.max(0, cur.time - 0.1)`; a hint does `Math.max(0, cur.time - 2)`, a skip
`Math.max(0, cur.time - 3)`; a bank at `<= 0` ends the round; the screen shows `Math.ceil(time)`.
Because 0.1 has no exact binary representation, the stored value drifts away from the true one.
Drifting *down* is harmless under `ceil`; drifting *up* is not — a bank that should be exactly
0.0 holds `1.4e-16`, so the round fails to end and the clock shows **1** for one more tick.

This was measured on 2026-09-30 by transcribing that arithmetic into a script and running it three
ways:

| Measurement | 45 s bank (the default) | 90 s bank (the maximum) |
|---|---|---|
| Silent round (ticks only) — ticks until the round ends | **450** (exact) | **901** (exact would be 900) |
| Silent round — ticks where the displayed second is wrong | **0** | **90** |
| 60,000 simulated rounds, judge acting at 1% / 3% / 10% of ticks, hints capped at 2 per question — rounds with a wrong displayed second | **0** | **100%** at every rate |
| Same — rounds that end one tick later than exact arithmetic | **0** | **80.3% / 58.2% / 30.5%** |
| Every ordering of tick / hint / skip from a full bank, searched exhaustively — reachable values where the float sits above an exact zero | **673** | **23,969** |

The pure-tick results for all fifteen legal bank lengths (20–90 s in steps of 5) are pre-registered
as Table A of [verification.md](verification.md), because the test oracle must reproduce them before
it is trusted: 20–75 s end at exactly `seconds × 10` ticks; **80, 85 and 90 s end one tick late**;
the displayed second is wrong on 0 ticks at 20–60 s and on 4, 29, 54, 80, 85 and 90 ticks at
65, 70, 75, 80, 85 and 90 s.

The drift is **not** a long-bank problem only. Played through the exact generator that
[verification.md](verification.md) pre-registers as Table B — 200 generated rounds per bank length,
judge acting at 1% / 3% / 10% of steps — the prototype's arithmetic and exact arithmetic disagree
somewhere in the round in this many of 200:

| Bank | 20 s | 25 s | 30–60 s (seven lengths) | 65 s | 70 s | 75 s | 80 s | 85 s | 90 s |
|---|---|---|---|---|---|---|---|---|---|
| Diverging rounds of 200 | **51** | **1** | **0** each | **165** | **192** | **193** | **192** | **191** | **189** |

and in the pre-registered 45 s sample of **10,000** generated rounds, in **0**.

So at the default length the drift was never observed in play — 0 of 60,000 rounds in the first
simulation, 0 of 10,000 in the second — but it is constructible (the exhaustive search did not
enforce the two-hints-per-question cap, so some of those 673 orderings may be unreachable in a
real round). At both ends of the prototype's own range it is common. REQ-3.4 records the owner's
decision on which of the two the engine reproduces.

### 1.2 Why the clock is `runningSince`, not a counter

`roadmap.md` Phase 3 names the clock's shape: "banks per team, `active`, `runningSince`; time
advanced by an explicit `tick(ms)` action." `tech-specs.md` §4 names the same shape as what room
state carries on the wire: `{ banks, active, runningSince | null, serverTime }`, with clients
rendering `ceil(bank − (now − runningSince))` between broadcasts.

A pure reducer cannot read a wall clock, so `runningSince` has to be measured in **engine time**:
a counter the reducer owns and that only `tick` advances. The bank then holds its value *as of*
`runningSince`, and the remaining time is computed rather than stored. The consequence is the
reason for the design: **a tick that does not end the round changes nothing but the engine time.**
Every transition that a client needs to hear about — a spend, a reveal, a round end — changes a
bank or `runningSince`; a plain tick changes neither. `tech-specs.md` §4's "broadcast transitions,
not ticks" is therefore a property of the state itself, checkable in Phase 3, rather than
something Phase 11's server has to reconstruct.

### 1.3 Where Phase 3 stops and Phase 4 starts

The roadmap splits what is one function in the prototype across two phases. Recorded here so
that the boundary is a decision on the record, not a judgement made at the keyboard:

| Prototype behaviour | Phase 3 | Phase 4 |
|---|---|---|
| A bank reaching zero | the round **ends**: clock stops, bank is 0, screen leaves `play` | who **wins**, tally, log entry, reason line, match end |
| صحيح (correct) | reveal goes up with answer + fact, clock stops | the 1000ms hold, the reveal coming down, the turn passing |
| Starting a round | an explicit starting team and question list start the clock | category draw, question shuffle, odd/even starting team |
| The question pool | the current question is `pool[index mod length]`; skip advances the index | building the pool: shuffled per round, no repeats until it wraps |

A Phase 3 reveal therefore never comes down by itself, and a Phase 3 round never scores. Both are
correct for this phase and incomplete for the product.

### Amendment discipline (binding on this phase)

Phase 3 requires **no amendment to `mission.md` §8**. Every requirement traces to an existing
decision:

| Requirement source | Recorded in |
|---|---|
| `RoomState` matching the handoff's state contract | `roadmap.md` Phase 3 · `design/README.md` "State Management" |
| Pure reducer, no side effects, no timers | `roadmap.md` Phase 3 · `tech-specs.md` §2.3 ("pure, dependency-free … no server, no sockets, no React") |
| Banks per team, `active`, `runningSince`, `tick(ms)` | `roadmap.md` Phase 3 · `tech-specs.md` §4 |
| Hint −2 s, skip −3 s, any spend reaching 0 ends the round | `roadmap.md` Phase 3 · `design/README.md` "Interactions" · `design/user-stories.md` numeric rules |
| Reveal pauses the clock; judge actions inert during a reveal or a stopped clock | `roadmap.md` Phase 3 · `design/user-stories.md` H-06 |
| Display is `ceil(seconds)`, clamped at 0 | `roadmap.md` Phase 3 · `design/README.md` "Clock" |
| The prototype wins on any disagreement, unless explicitly decided otherwise | `mission.md` §5.3 |
| The server owns the clock; clients never decide a round ended | `mission.md` §5.2 |
| Exact pins, no overrides, no `@ts-expect-error`, `pnpm test` is the wrapper | `CLAUDE.md` invariants 2, 4 |

Two decisions were taken by the owner in the planning session on 2026-09-30 and are recorded as
**DECIDED** blocks in the requirement they govern — REQ-3.4 (exact integer milliseconds) and
REQ-3.12 (coverage enforced on every test run). The first departs from the prototype; it is taken
through the route `mission.md` §5.3 itself provides ("the prototype is right until someone
explicitly decides otherwise and updates the spec"), which is why it needs no §8 entry: the
decision is explicit, and this triad is the spec update. Neither contradicts `tech-specs.md` or
`roadmap.md` — the roadmap's own unit is `tick(ms)`.

Three readings are recorded explicitly. **None contradicts a binding document:**

1. **The handoff's `categoryIndex: number` becomes `categoryId`, typed as a content id, not an
   array position.** Positions are an artefact of the prototype's inline `CATS` array; Phase 8
   moves categories into files and Phase 20 validates "category ids" against entitlements
   (`tech-specs.md` §5). Phase 3 writes no behaviour over categories, so this is a type choice only.
2. **The handoff lists `banks` and `active` as top-level fields; this phase groups them with
   `runningSince` and the engine time as one `clock` object.** The field set is unchanged; the
   grouping exists because the four are one invariant (§1.2) and because the clock is the one
   part of room state every client — judge and player — receives.
3. **The engine time is not called `serverTime`.** `tech-specs.md` §4 uses that name for the
   wire. In Phases 5–7 the reducer runs in the judge's browser with no server, so the engine's
   name is `now`; Phase 11 and Phase 16 map it onto `serverTime`.

---

## 2. Detailed Functional Requirements

This is a one-day phase, so requirements are grouped by workstream. **Dependency order is
specified in [specs.md](specs.md) §1 and is not the same as the order below.**

### 2.1 The state

**REQ-3.1 — `RoomState` covers the handoff's state contract, field for field**
Every field of the shared room state in `design/README.md` "State Management" — `roomCode`,
`players`, `teamA`, `teamB`, `judgeIndex`, `rotateJudge`, `pickedCategories`, `usedCategories`,
`screen`, `round`, `tallyA`, `tallyB`, `log`, `categoryIndex`, `questionPool`, `questionIndex`,
`hintIndex`, `banks`, `active`, `reveal` — and both configurable values, `roundSeconds` and
`winsNeeded`, has a counterpart in `RoomState`. Where a counterpart differs in name or
representation, the difference is listed in [specs.md](specs.md) §2.1 with its reason, and no
other difference exists. The type is exported from `@nel3ab/game`.
*Why:* this is the state every later phase reads — five judge screens, the server, the redaction
boundary, the player views. A field left out now is added under pressure later by whichever phase
first needs it, with no one checking it against the contract. `RoomState` is the **judge and
server truth**: it holds the current question's answer. It is never itself a player payload —
Phase 12 builds that from scratch (`mission.md` §3) — and nothing in this phase creates one.

**REQ-3.2 — A room is constructed valid, with its configuration inside the prototype's range**
A constructor produces a complete `RoomState` on the setup screen: no round in play, no reveal,
both banks full and stopped, tallies at zero, an empty log. Its configuration defaults to
`roundSeconds = 45` and `winsNeeded = 3`, and it rejects — by throwing, not by clamping — any
`roundSeconds` outside 20–90 in steps of 5 and any `winsNeeded` other than 2, 3 or 4.
*Why:* those are the prototype's own ranges (its tweak panel declares them) and `design/README.md`
restates them. Clamping would turn a caller's mistake into a silently different game; a room whose
round is 47 seconds has left the space the prototype defines and that this phase's equivalence
tests cover.

### 2.2 The reducer and the clock

**REQ-3.3 — One pure reducer, with no time, randomness, timers or I/O of its own**
All state changes go through one function, `(state, action) => state`. It never mutates its
input. It never reads a clock (`Date`, `performance`), never draws a random number, never starts
or clears a timer, and performs no I/O. Given the same state and action it returns a deep-equal
result every time. An action that is well-formed but not allowed in the current state — a hint
during a reveal, a skip with the clock stopped — is **inert**: the reducer returns the **same
object** it was given. An action that is malformed — an unknown type, a tick that is not a
non-negative safe integer, a round started with no questions — **throws**; it is never silently
ignored.
*Why:* `tech-specs.md` §2.3 requires the engine to be "fully unit-testable with no server, no
sockets, no React," and §4 requires the clock's decision to be made "in exactly one place." A
reducer that read `Date.now()` could not be replayed, and one that drew its own random numbers
could not be tested for "no repeats." Returning the same object when nothing changed is what lets
a React renderer skip a render and a server skip a broadcast. Throwing on malformed input matters
most for `tick`: a malformed tick that was silently ignored would be a clock that stops without
anyone noticing — the exact failure §5.2 exists to prevent.

**REQ-3.4 — The clock: banks per team, `active`, `runningSince`, advanced only by `tick(ms)`**
Each team has a bank in whole milliseconds. Exactly one team is `active`. While the clock runs,
`runningSince` records the engine time at which the active bank last resumed; while it is
stopped, `runningSince` is empty. The engine time advances **only** by `tick(ms)`, and by exactly
`ms`. Only the active team's bank drains, and only while the clock runs. A tick that does not
take the active bank to zero changes the engine time and nothing else. A tick that takes it to
zero or past it ends the round **in the same reducer step** (REQ-3.7). Splitting a tick in two
never changes the outcome: `tick(a)` then `tick(b)` produces the same state as `tick(a + b)`.
*Why:* §1.2. `design/user-stories.md` H-07: "٤٥ ثانية لكل فريق تنزل فقط أثناء دوره" — each
team's 45 seconds run down only during its own turn. Additivity is what makes the engine
independent of how often it is ticked: Phase 5's browser and Phase 11's server will tick at
different, jittering rates, and the round must end at the same moment regardless.

> **DECIDED 2026-09-30 (Ahmed, in the planning session): exact integer milliseconds.** The engine
> follows the prototype's **stated** rules — a tick drains exactly the milliseconds it carries, a
> hint exactly 2000, a skip exactly 3000, and a bank ends at exactly zero — not the prototype's
> floating-point rounding. This is the `mission.md` §5.3 route ("the prototype is right until
> someone explicitly decides otherwise and updates the spec"): this block is the explicit
> decision, and this triad is the spec update. The alternative considered and rejected was
> reproducing the prototype's floating-point seconds bit for bit, rounding error included.
> **What it costs:** wherever the prototype's arithmetic drifts (§1.1), the engine and the
> prototype disagree by one 100ms tick and by one displayed second. At the default 45 s that was
> measured at **0 of 70,000** simulated rounds across two simulations. At 20, 25 and 65–90 s it
> is common: at 80–90 s even a silent round ends one tick earlier than in the prototype, and at
> 65–90 s most generated rounds show a different second at some point — the engine being the one
> that is right. REQ-3.11 re-measures the 45 s claim as a verdict gate; if it fails, this
> decision's premise is false and it returns to the owner.

**REQ-3.5 — A round can be started with an explicit starting team and question list**
Starting a round fills both banks to `roundSeconds × 1000`, marks only the starting team as having
started, makes it active, runs its clock from the current engine time, puts the given questions
in the pool with the question and hint indices at zero, clears any reveal, and moves the screen to
`play`. It is inert while a round is already in play.
*Why:* the exit criterion — "a simulated 45-second round" — needs a round, and a round needs its
clock started. This is the minimum entry point that makes the clock testable end to end. **Which**
team starts, **which** category is drawn and **in what order** the questions come are Phase 4's
(§1.3); this requirement takes them as given, and Phase 4 decides how they are chosen.

### 2.3 The judge's actions

**REQ-3.6 — A hint costs exactly 2 s and reveals the next hint only; a skip costs exactly 3 s and advances to the next question**
A hint drains 2000ms from the active bank and advances the hint index by one; when the current
question has no hints left it is inert and costs nothing. A skip drains 3000ms from the active bank,
advances the question index by one and resets the hint index to zero. The current question is the
pool entry at `questionIndex mod poolLength`, so a skip past the end of the pool wraps to its start.
*Why:* `design/README.md` "Interactions" and `design/user-stories.md` H-06 ("تلميح يخصم ٢ ثانية
ويعرض التلميح التالي فقط" / "تخطي يخصم ٣ ثوانٍ"). An exhausted hint that still cost 2 s would be a
penalty for a button the judge's screen shows as disabled. The wrap is how the prototype never runs
out of questions within a round; making the pool not repeat *before* it wraps is Phase 4's.

**REQ-3.7 — Any spend that reaches zero ends the round immediately, and exactly zero counts**
If a hint or a skip would leave the active bank at zero or below, the bank becomes exactly zero —
never negative — the clock stops, the screen moves to `roundEnd`, and the team whose bank emptied is
identifiable as the round's loser. This happens in the same reducer step as the spend: no state
exists in which a bank is zero while the screen still says `play`. A spend that ends the round does
**not** also advance the hint index or the question index. The same applies to a tick (REQ-3.4).
*Why:* `roadmap.md` Phase 3 singles out "spend exactly to zero" as the case to cover, and it is the
case the prototype's floating-point arithmetic gets right only by luck (§1.1). Leaving the indices
alone on a round-ending spend is what the prototype does — it returns before advancing — and the
round-end screen reads them. Who *wins*, and every consequence of winning, is Phase 4's (§1.3).

**REQ-3.8 — صحيح raises the reveal and stops the clock; while a reveal is up or the clock is stopped, every judge action is inert**
Marking an answer correct stops the active team's clock with its remaining time preserved and puts
up a reveal carrying the current question's answer and trivia fact. While a reveal is up, ticks
advance the engine time and drain nothing. Whenever a reveal is up **or** the clock is stopped for
any reason — no round in play, a round ended, a reveal — hint, skip and correct are all inert. The
predicate that decides this is exported, so that a screen can disable its buttons by the same rule
the reducer applies.
*Why:* `roadmap.md` Phase 3; `design/README.md` — "all no-ops while the reveal overlay is up or the
clock is stopped"; `design/user-stories.md` H-06 — "الأزرار معطّلة أثناء كشف الإجابة أو توقف الساعة".
A judge who double-taps صحيح must not score twice, and a hint pressed during the reveal must not cost
the next team time. One exported predicate means Phase 6's disabled buttons and this reducer cannot
disagree about when an action counts. The reveal coming down and the turn passing are Phase 4's.

**REQ-3.9 — The display helper: whole seconds, rounded up, clamped at zero**
A helper converts a remaining time in milliseconds to the whole seconds a clock shows: rounded up,
never below zero, never negative zero. It throws on a non-finite input.
*Why:* `design/README.md` — "displayed as `Math.ceil(seconds)`." Rounding up means a team with 400ms
left sees **1**, not **0**: a clock that reads 0 while the round is still live would tell a room of
people the round is over when it is not. Because a live bank is always above zero (REQ-3.7), a live
clock therefore never reads 0. Throwing on `NaN` stops "NaN" from ever reaching a timer card.

### 2.4 Fidelity and the exit criterion

**REQ-3.10 — The rules' numbers are read from the prototype at test time, not remembered**
The engine's hint cost, skip cost, tick-to-drain ratio, zero rule, default and range of
`roundSeconds`, and default and options of `winsNeeded` are each asserted equal to the value
extracted from `design/designs/Nel3ab - Arcade.dc.html` when the test runs, and the 45 s / −2 s / −3 s
rules equal to those in `design/user-stories.md`. The number of values extracted is asserted, so an
extraction that finds nothing fails.
*Why:* Phase 2's lesson (its NFR-2.6): a fidelity claim is only worth something if a later change
that breaks it fails CI. `design/` is never edited (`CLAUDE.md` invariant 5), so these tests can only
go red by the engine drifting — never by the reference moving.

**REQ-3.11 — 🚦 A simulated 45-second round produces the same outcome as the prototype**
Played through the engine and through a transcription of the prototype's own floating-point
arithmetic, a pre-registered set of scripted 45-second rounds and a pre-registered seeded sample of
generated ones produce the same outcome step for step: the same displayed seconds for both teams,
the same step at which the round ends, the same losing team, and the same hint and question indices.
*Why:* this is the roadmap's exit criterion, word for word, and it is the measurement REQ-3.4's
decision rests on. It compares the engine to an external reference — the prototype's actual
arithmetic, drift and all — so it is a **verdict gate**: a failure that remains once the engine
agrees with exact arithmetic is a fact about the prototype, not a bug to retry. Its numbers (the
scripts, the seed, the sample size, the generator) are fixed in [verification.md](verification.md)
before any code exists, so the gate cannot be made green by choosing a different sample.

**REQ-3.12 — Full test coverage of the engine, enforced on every test run**
Every line, branch, function and statement of `packages/game/src` — excluding test files and the
test-support directory — is executed by the test suite, and `pnpm test` fails, locally and in CI,
if that ever stops being true.
*Why:* the roadmap's exit criterion — "full test coverage on clock and spend logic" — and
`roadmap.md` Milestone A's warning that "the game rules are fiddly and the prototype is their only
specification." A pure engine with no I/O is the one place in this codebase where 100% branch
coverage is cheap, and a branch nothing executes in a rules engine is a rule nobody has checked.
> **DECIDED 2026-09-30 (Ahmed, in the planning session): enforce on every test run.** Vitest's
> coverage provider is added, pinned exactly to the Vitest version, and `pnpm test` runs with
> 100% thresholds over `@nel3ab/game`. The alternatives considered and rejected were measuring once
> for this phase only, and using no coverage tool at all.
> **What it costs:** one new development dependency; a slower `pnpm test`; and **Phase 4 inherits
> the 100% bar** over the whole package, including every round- and match-flow rule it adds.
> Coverage proves that code ran, not that a test would notice it breaking — which is why
> [verification.md](verification.md) also requires named mutations to be caught.

**REQ-3.13 — 🚦 The four gate commands pass with no escape hatch**
`pnpm lint`, `pnpm typecheck`, `pnpm test` (now with coverage) and `pnpm build` all pass on a fresh
`pnpm install --frozen-lockfile`, on Windows and on Ubuntu CI, with **none** of the following
introduced anywhere: `pnpm.overrides`, `peerDependencyRules`, `--no-strict-peer-dependencies`,
`skipLibCheck` beyond `tsconfig.base.json`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`,
`stylelint-disable`, `/* v8 ignore */` or `/* istanbul ignore */`, a floated (`^`/`~`) version pin,
a coverage threshold below 100 or a coverage exclusion beyond the two in REQ-3.12, or a change to
the `ci` job name.
*Why:* this phase adds the first dependency since Phase 2 — a coverage provider that must agree
with Vitest 4's multi-project configuration and with the `scripts/check-collected-tests.mjs`
wrapper. Ordinary failures are fixed and retried freely; the gate **FAILs** only if passing
*requires* one of the escapes above. A FAIL means coverage cannot be enforced on this stack as
decided in REQ-3.12, and that decision returns to the owner — it is not a licence to add a
`v8 ignore` comment.

---

## 3. Non-Functional Requirements

**NFR-3.1 — `design/` and `specs/` are not edited.** Tests may *read* `design/`; nothing writes to
it (`CLAUDE.md` invariant 5). `specs/` is read-only during implementation (invariant 6);
`verification.md` may only have boxes ticked and measured values recorded.

**NFR-3.2 — `@nel3ab/game` stays dependency-free.** Its manifest gains no `dependencies`,
`devDependencies` or `peerDependencies`, and no non-test source file imports anything but a relative
path within the package. `tech-specs.md` §2.3: "pure, dependency-free rules engine." In particular
it does not import `@nel3ab/content` (Phase 8) or Zod (Phase 11).

**NFR-3.3 — Exact pins, no overrides.** The one dependency this phase adds — the coverage provider,
a root development dependency — is pinned exactly, character-identical to the `vitest` pin, with no
`^` or `~` (`CLAUDE.md` invariant 4). `pnpm install --frozen-lockfile` succeeds from a fresh clone.

**NFR-3.4 — Every workspace project still contributes a collected test file.** The two test files
that assert `@nel3ab/game`'s `PLACEHOLDER` — `packages/game/src/index.test.ts` and
`apps/game/src/index.test.ts` — are **updated, not deleted**, because
`scripts/check-collected-tests.mjs` counts one collected file per project (`CLAUDE.md` invariant 2).
`pnpm test` still reports six projects.

**NFR-3.5 — The package's public surface is exact.** `@nel3ab/game`'s runtime exports are a fixed,
tested list; `PLACEHOLDER` is gone; nothing under the test-support directory is exported. An
internal helper leaking into the public surface is a change to the contract every later phase
consumes (the same rule Phase 2 applied to `@nel3ab/ui`).

**NFR-3.6 — Fidelity claims are re-checkable, and the equivalence suite is fast enough to stay in
`pnpm test`.** REQ-3.10 and REQ-3.11 run inside `pnpm test`, and so in CI on every pull request —
not as a one-off script. The whole `@nel3ab/game` project, including the seeded sample, completes in
under **20 s** on the Windows development machine; if it cannot, the sample is **not** shrunk to fit
(that would change a pre-registered verdict), and the overrun is recorded as a finding.

**NFR-3.7 — LF, Prettier and the RTL guardrail are unaffected.** `prettier --check .` passes, the
coverage output directory is ignored by git and by Prettier, and no CSS is added.

---

## 4. Explicit Non-Goals

An implementer that wants to do any of the following must **stop**, not proceed.

- **No turn passing, no reveal hold, no 1000ms timer.** The reveal coming down and the other team's
  turn beginning are Phase 4's (§1.3). A Phase 3 reveal stays up.
- **No scoring.** No tally, no log entry, no reason line, no match end, no `winsNeeded` logic. Phase 3
  ends a round and identifies whose bank emptied; Phase 4 decides what that is worth.
- **No round or match flow.** No category draw, no question shuffle, no `usedCategories` bookkeeping,
  no odd/even starting team, no judge rotation, no next round, rematch, reset or back-to-setup.
- **No randomness in the engine at all.** Phase 4 must introduce it without breaking REQ-3.3 — for
  example through an action's payload or a seed carried in state. Phase 3 does not choose between
  them and must not pre-empt the choice.
- **No setup or lobby actions.** Adding, removing or swapping a player, renaming or shuffling a team
  name, picking categories, choosing or rotating the judge. The roadmap gives the setup screen to
  Phase 5 and the wire messages to Phase 11.
- **No player view, no redaction, no projection of `RoomState`.** Phase 12 builds the player payload
  from scratch. `RoomState` contains answers by design and is never sent to a player.
- **No schemas, no content, no server.** No Zod and no `@nel3ab/protocol` messages (Phase 11); no
  content loading or validation and no dependency on `@nel3ab/content` (Phase 8); `apps/game` stays
  a shell except for the one test that must stop importing `PLACEHOLDER` (NFR-3.4).
- **No driver.** No `setInterval`, no React hook, no store, no `useReducer` wrapper. Phases 5–7 drive
  the reducer in the browser and Phase 11 on the server.
- **No client reconciliation or interpolation.** Phase 16. The representation is chosen to serve it
  (§1.2); nothing here implements it.
- **No room-code generation or validation.** Phase 11 generates codes; Phase 13 compares them.
- **No presentation helpers beyond the display helper.** No bank-fraction for the time-bank bar, no
  hint-button sub-label, no status text ("دورهم الآن" / "مجمّد"). Phase 6.
- **No change to `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`,
  `stylelint.config.mjs`, `eslint.config.mjs` or `.gitattributes`.** Coverage is switched on by the
  root `test` script and configured in `vitest.config.ts`; the CI job already runs `pnpm test`. If a
  change to any of those five files appears necessary, that is the signal to stop.

---

*Last updated: 2026-09-30*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
