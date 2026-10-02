# Phase 4 Requirements — Rules engine: round & match flow

> **Phase Status:** Ready for Implementation
> **Parent Roadmap:** [../roadmap.md](../roadmap.md)
> **Constitution:** [../mission.md](../mission.md) · A-1, A-2, A-3 in force, none binds this phase · four owner decisions of 2026-10-02 recorded in REQ-4.1, REQ-4.2, REQ-4.6 and §1.4 · no proposals in force
> **Duration:** 1 day

---

## 1. Overview & Objectives

Phase 4 finishes the rules engine. Phase 3 built a single round's arithmetic — two clocks, a hint,
a skip, a reveal that goes up and never comes down. Phase 4 builds **everything between one round
and the next**: the reveal coming down and the turn passing to the other team, who wins a round and
what that is worth, which category the next round draws and in what order its questions come, which
team starts it, who judges it, when the match is over, and the two ways out of a finished match —
a rematch with the same teams, or back to setup. No screen ships, no server ships. What ships is
the last of `tech-specs.md` §2.3's rules engine: "reducer over room state, clock maths, round/match
flow, category draw."

The premise this phase rests on is Phase 3, and it held. All 49 of Phase 3's verification boxes are
ticked with measured values. Its two 🚦 verdicts returned **PASS**: REQ-3.11 at `83b5f9a` — a
simulated 45-second round produces the same outcome as the prototype's own floating-point arithmetic
in 0 of 13 scripted scenarios and 0 of 10,000 pre-registered sequences (2,429,148 steps), after the
engine was first shown equal to exact arithmetic over 3,231,120 steps — and REQ-3.13, the stack
verdict, measured at `54e716c`. The owner's exit verdict is recorded at `841981a` (PR #30). Phase 3
recorded no FAIL, so nothing constrains what this phase may assume. Of the eight findings it carried
forward, two bind this phase and are met here: **Phase 4 inherits the 100% coverage bar** over all
of `@nel3ab/game`, together with the clock's untested transition — re-anchoring `runningSince` for
the *other* team when the turn passes (REQ-4.6, REQ-4.15); and **Phase 4 must bring in randomness
without breaking purity** (REQ-4.1). The other six bind Phases 5, 11 and 16 and are untouched.

`@nel3ab/game` today is Phase 3's engine: `RoomState` (20 top-level fields, the clock grouped under
`clock`), one reducer handling `tick`, `startRound`, `hint`, `skip` and `correct`, twelve runtime
exports, and seven test files plus six test-support modules under `src/testing/`, running inside
`pnpm test` with 100% coverage enforced. `packages/protocol`, `packages/content` and `apps/game`
remain `PLACEHOLDER` shells; `apps/web` lists `@nel3ab/game` in `transpilePackages` and imports
nothing from it.

The sharpest version of the question this phase answers:

> **Can the prototype's round and match flow — which lives in one browser tab as `setState`
> callbacks, a `setTimeout`, and two calls to `Math.random` — be re-expressed as pure reducer
> actions over `RoomState`, so that a full match played through it produces the same rounds, the
> same turns, the same scores, the same judges and the same round log as the prototype does, step for
> step?**

### 1.1 The prototype's flow, measured before this plan was written

`design/designs/Nel3ab - Arcade.dc.html`'s `Component` class holds the whole flow in eleven methods:
`drawCategory`, `startRound`, `markCorrect`, `passTurn`, `endRound`, `nextRound`, `rematch`,
`resetAll`, `goWheel`, and the getters `remaining` and `startingTeam`. On 2026-10-02 the planning
session transcribed them — in the prototype's floating-point seconds and in exact integer tenths,
exactly as Phase 3's oracle did for the clock — and played both through a pre-registered generator of
full matches. The generator, the seeds and every number below are fixed in
[verification.md](verification.md) before any code exists.

| Measurement (exact arithmetic standing in for the engine) | Result |
|---|---|
| 500 generated sequences at the default 45 s — full matches with turn passes, rematches and resets, 1,156,355 steps, 593 matches played to the end — sequences in which the prototype's arithmetic and exact arithmetic disagree at any step | **0** |
| The same generator, 20 sequences at each of the other fourteen bank lengths — disagreeing sequences | **11** at 20 s · **1** at 25 s · **0** at 30–60 s · **20 of 20** at each of 65–90 s |
| 16 scripted matches (silent matches, turn passes, ties, one-category matches, judge rotation, rematch, reset) — steps at which the two arithmetics disagree | **0** |

So Phase 3's finding carries over unchanged and is not re-litigated: at the default length the
prototype's floating-point drift is not observed in full-match play either, and at both ends of the
range it is as common as Phase 3 measured. The match flow itself is discrete — rounds, tallies,
indices, categories — and adds no arithmetic of its own.

Three facts about the prototype's flow were found by reading it, and are recorded here so that they
are decisions on the record rather than discoveries at the keyboard:

1. **The "falls back to the full selection when exhausted" branch of the category draw is
   unreachable in the prototype's own flow.** A round that uses the last unused category ends the
   match (`endRound`'s `this.remaining.length === 0`), and both ways back to a draw — `rematch` and
   `resetAll` — clear the used list first. The roadmap names the fallback explicitly, so REQ-4.3 keeps
   it; it is reached in tests by a hand-built state (the coverage rule Phase 3 set: *a branch that no
   sequence of actions reaches is tested by a hand-built state, or deleted — never ignored*).
2. **A match can end in a tie.** When the categories run out before either team reaches
   `winsNeeded`, the tallies can be equal; the prototype then shows "تعادل بالمباراة". REQ-4.8 makes
   the tie a first-class result. (The prototype's winners line on a tie lists team A's players —
   `s.tallyA >= s.tallyB ? 'a' : 'b'` — which is presentation, and Phase 7's to decide.)
3. **The prototype's question shuffle is not uniform.** `shuffle = arr => arr.slice().sort(() =>
   Math.random() - .5)` is a comparison sort with a coin-flip comparator, and no comparison sort
   driven by fair coin flips can make 3! = 6 orderings equally likely — every probability it produces
   is a multiple of 1/2ᵏ. Measured in Node 24 (V8, Chrome's engine) with a seeded random source,
   60,000 shuffles of three questions: the original order comes back **22,564 times (37.6%)** and the
   reversed order **18,813 (31.4%)** against a fair **10,000 (16.7%)** each; the four other orderings
   come out 3,732–7,344 times. With three questions per category, the question listed first in the
   content file opens the round **44%** of the time instead of 33%. REQ-4.2 records the owner's
   decision.

### 1.2 Why the turn passes by an action, not by a tick

`design/README.md`: "صحيح → stop clock, show reveal overlay for 1000ms, then pass the turn to the
other team." In the prototype the 1000 ms is **not** part of the clock: `markCorrect` clears the
clock's `setInterval` and starts a separate `setTimeout(() => this.passTurn(), 1000)`. Two ways to
re-express that were considered, and the owner chose the first (REQ-4.6, DECIDED 2026-10-02):

| | A `passTurn` action, refused until the reveal has been up 1000 ms of engine time | The `tick` that reaches 1000 ms passes the turn itself |
|---|---|---|
| Mirrors | the prototype's separate timer | the clock |
| Who sends it | the driver, after its ticks — Phase 5's browser loop, Phase 11's server loop | nobody; it happens inside `tick` |
| If a driver forgets | the reveal stays up and the game sits there — **a driver obligation, carried forward** | cannot happen |
| Phase 3's record | **unchanged.** Phase 3's Table D scenario S8 ("100 tick, correct, 1000 tick, hint, skip, correct → never ends; reveal up at the end") and the 50-event tail its harness compares after every reveal both stay true | **changed.** S8 would pass the turn after 10 ticks, and every post-reveal tail in Phase 3's 10,000-sequence verdict sample and its per-length sample would diverge from Phase 3's single-turn oracle. Phase 3's pre-registered Tables B and D would have to be re-measured and amended — its verdict test re-run under new semantics |

The engine still **owns the rule**: `passTurn` before the reveal has been up `REVEAL_HOLD_MS` of
engine time is inert, so no driver can pass the turn early. What it does not own is the cadence — the
same line Phase 3 drew for `tick` ("how often a driver ticks is the driver's business"). A driver that
dispatches `passTurn` after every `tick` (it is inert until due, and costs nothing) passes the turn at
exactly 1000 ms on a 100 ms tick.

### 1.3 Where Phase 4 stops and Phases 5, 7, 11 and 12 start

| Behaviour | Phase 4 | Later |
|---|---|---|
| The first round of a match | `startMatch` from `ready` (the prototype's "ابدأ الجولة الأولى" → `goWheel`) | **Phase 5** builds setup and room-ready and the transition from one to the other; Phase 4's tests start from a hand-built `ready` room |
| Players, team names, judge choice, the rotation toggle, the category selection | read by the flow; never changed by it, except the judge index on rotation | **Phase 5** — every setup action and its rules (balancing teams, removing a player shifts the judge, the zero-category guard) |
| The round-end and match-end screens | the state they read: tallies, the log, the round's category, the match result | **Phase 7** — the reason line's text, the winners line, "N فئة متبقية", the buttons |
| The random source | none; the engine's helpers take one as a parameter | **Phase 5** (browser) and **Phase 11** (server) choose it |
| The reveal hold's timer | the rule (`passTurn` inert until due) | **Phase 5** and **Phase 11** dispatch `passTurn` |
| The wire | none | **Phase 11** maps `startRound` / `nextRound` messages onto these actions; **Phase 12** builds the player payload from scratch |

### 1.4 Scope — DECIDED 2026-10-02

> **DECIDED 2026-10-02 (Ahmed, in the planning session): rematch and back-to-setup are Phase 4's.**
> "نفس الفرق — مباراة جديدة" (the prototype's `rematch`) and "رجوع للإعداد" / "غيّر اللاعبين
> والفئات" (both the prototype's `resetAll`) are engine actions in this phase — REQ-4.4 and
> REQ-4.10 — so every rule about rounds and matches lives in one place and is exercised by one
> full-match test. Phase 7 wires the buttons and owns the screens. The alternative considered and
> rejected was stopping at match end and leaving both resets to Phase 7. **What it costs:** two more
> actions under the 100% coverage bar in this phase; Phase 7's roadmap lines "resets scores without
> clearing players" and "returns to setup with state intact" become screen work over an existing rule.
> Phase 3's plan had already listed "next round, rematch, reset or back-to-setup" together as round
> and match flow (its §4), so this follows the existing line rather than moving it.

### Amendment discipline (binding on this phase)

Phase 4 requires **no amendment to `mission.md` §8**. Every requirement traces to an existing
decision:

| Requirement source | Recorded in |
|---|---|
| Category draw from selected-but-unused, falling back to the full selection | `roadmap.md` Phase 4 · `design/README.md` "Round / match flow" · `design/user-stories.md` H-08 |
| Questions shuffled per round, no repeats until the pool wraps | `roadmap.md` Phase 4 · `design/README.md` "Interactions" · `design/user-stories.md` H-06 ("بلا تكرار") |
| Turn passing on صحيح after a 1000 ms reveal; the other team's bank full on its first turn | `roadmap.md` Phase 4 · `design/README.md` "Interactions" and "Motion" · `design/user-stories.md` H-06 |
| Round win = the opponent's clock hit zero; tally, log, reason | `roadmap.md` Phase 4 · `design/README.md` "Round / match flow" and "Round end" · H-08 |
| Odd rounds start with team A, even with team B | `roadmap.md` Phase 4 · `design/README.md` "Round / match flow" |
| Match ends at `winsNeeded` or when categories run out | `roadmap.md` Phase 4 · `design/README.md` · H-09 |
| Judge rotation on next round when the toggle is on | `roadmap.md` Phase 4 · `design/README.md` · H-02, H-08 |
| The engine is pure and dependency-free; the round/match flow and the category draw live in it | `tech-specs.md` §2.3 · REQ-3.3 |
| The prototype wins on any disagreement unless explicitly decided otherwise | `mission.md` §5.3 |
| The server owns the clock; clients never decide a round ended | `mission.md` §5.2 · `tech-specs.md` §4 |
| 100% coverage enforced on every test run | Phase 3 REQ-3.12 (DECIDED 2026-09-30) |
| Exact pins, no overrides, no `@ts-expect-error`, `pnpm test` is the wrapper | `CLAUDE.md` invariants 2, 4 |

Four decisions were taken by the owner in the planning session on 2026-10-02 and are recorded as
**DECIDED** blocks in the requirement they govern: REQ-4.1 (the driver draws, the engine checks),
REQ-4.2 (a fair shuffle), REQ-4.6 (the turn passes by an action) and §1.4 (rematch and back-to-setup
in scope). Only REQ-4.2 departs from the prototype, and it does so by the route `mission.md` §5.3
itself provides — the same route the owner took for the clock on 2026-09-30 — so it needs no §8
entry: the decision is explicit, and this triad is the spec update. None contradicts `tech-specs.md`
or `roadmap.md`: §2.3's "category draw" lives in the package as the draw rule, the helpers that
apply it and the validation that enforces it; only the source of randomness is the driver's.

Seven readings are recorded explicitly. **None contradicts a binding document:**

1. **A round with no category is not scored.** Phase 3's `startRound` — an explicit starting team
   and question list (REQ-3.5) — stays exactly as Phase 3 specified it, because Phase 3's tests and
   its verdict harness start every round with it. Such a round sets no category, and every round a
   match plays does. So "the round is part of a match" is read as `categoryId !== null`: a round
   that ends without one ends exactly as it did in Phase 3 (`roundEnd`, no tally, no log). No driver
   dispatches `startRound`; REQ-4.11 and §4 say so.
2. **`startMatch` is both "ابدأ الجولة الأولى" and "نفس الفرق — مباراة جديدة".** The prototype's
   `goWheel` (on `ready`) and `rematch` (on `match`) differ only in that `rematch` first resets the
   round, the tallies, the log and the used list — which on `ready` are already at those values. One
   action, allowed on both screens, is the same behaviour.
3. **A log entry records the winning `Team`, not its display name.** The prototype logs the name;
   Phase 3 typed `RoundLogEntry.winner` as a `Team` and left its refinement to this phase. Names are
   editable only on setup, and both ways back to setup clear the log, so the name a screen shows for
   an entry is the name it had when the round was won.
4. **"The reason line" is the log entry's data.** A round ends one way only — a bank reaching zero —
   so the reason is always "the loser's time ran out", and the round-end screen's line ("انتهى وقت
   <team> — الفئة: <cat>") needs the loser and the category. The loser is the team other than the
   entry's winner, and the category is the entry's. Formatting the Arabic sentence is Phase 7's.
5. **Back-to-setup changes exactly what the prototype's `resetAll` changes.** It leaves the banks,
   the active team, the question pool and its indices as they were — none is visible on setup, and
   the next round overwrites them all.
6. **The judge index rotates modulo `max(1, players.length)`, as the prototype writes it**, so a room
   with no players keeps index 0. Whether a judge index is valid when set is Phase 5's (setup).
7. **The engine does not validate who the players are.** The prototype's `startGame` fills in
   placeholder players and a default selection; Phase 5 has replaced the second with a guard. Both are
   setup rules and both are Phase 5's.

---

## 2. Detailed Functional Requirements

This is a one-day phase, so requirements are grouped by workstream. **Dependency order is
specified in [specs.md](specs.md) §1 and is not the same as the order below.**

### 2.1 Randomness and the draw

**REQ-4.1 — The round's draws are made by the driver and checked by the engine**
The actions that start a round of a match — `startMatch` and `nextRound` — each carry the drawn
category and the round's question list in their payload. The reducer draws nothing. It **throws** on
a category the rules do not allow at that moment (REQ-4.3), and on a question list that is empty or in
which two questions share the same text. The engine exports, as pure functions that take the random
source as a parameter, the three pieces a driver needs to draw correctly: the categories the next
round may be drawn from, a pick from a list, and a shuffle.
*Why:* REQ-3.3 forbids the reducer to draw a random number, and Phase 3 carried forward that Phase 4
must bring randomness in without breaking that. A payload keeps the reducer a pure function of its
inputs, keeps the content out of the engine (`@nel3ab/content` is Phase 8's and NFR-4.2 forbids the
dependency), and leaves nothing in `RoomState` that predicts the next category or question order.
Throwing on a bad draw — rather than ignoring it — follows REQ-3.3's rule for malformed actions: a
draw silently refused would be a round that never starts.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): the driver draws, the engine checks.** The
> random choices arrive in the action's payload, made with the engine's exported helpers; the engine
> rejects a category the rules do not allow and a question list with a repeat. The alternative
> considered and rejected was a seed carried in `RoomState`, from which the engine would draw itself.
> **What it costs:** the engine cannot prove a driver's draw was random — a driver that always picked
> the first category would pass every check here. Phase 5's browser and Phase 11's server must each
> draw with these helpers and a real random source, and verify that they do; that obligation is
> **carried forward** in [verification.md](verification.md) §9. A seed was rejected because it would
> put into room state a value that predicts every future draw, and because the engine would then need
> every picked category's questions loaded at match start.

**REQ-4.2 — The shuffle is fair**
The exported shuffle returns a new list holding exactly the input's elements, never mutates its input,
and — given a random source uniform on [0, 1) — produces every ordering of *n* distinct elements with
probability exactly 1/*n*!.
*Why:* §1.1, fact 3. A host who plays the same category twice should not be able to predict that the
first question in the file comes first.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): a fair shuffle.** The engine follows the
> prototype's **stated** rule — "shuffled per round" — not its implementation, a coin-flip comparator
> sort. This is the `mission.md` §5.3 route, as on 2026-09-30: this block is the explicit decision,
> and this triad is the spec update. The alternative considered and rejected was reproducing the
> prototype's sort, bias included. **What it costs:** for any given random source, the engine's
> question order differs from the order the prototype would have produced; a side-by-side against
> the prototype will show different questions in a different order every round. Nothing else
> changes — the equivalence tests of REQ-4.14 give the engine and the prototype the *same* order, and
> compare everything that follows from it. [verification.md](verification.md) Gate 2 re-measures the
> premise — that the prototype's shuffle is lopsided — as a verdict gate; if it fails, this decision's
> premise is false and it returns to the owner.

**REQ-4.3 — The category draw: random from selected-but-unused, falling back to the whole selection**
The categories a round may be drawn from are the selected categories not yet used this match, in the
order they were selected; when every selected category has been used, they are the whole selection.
A match's first round — and a rematch's — may be drawn from the whole selection, because the used list
starts empty. The pick from that list is the prototype's own formula,
`list[floor(random() × length)]`. A category drawn for a round is recorded as used, once.
*Why:* `roadmap.md` Phase 4 and `design/user-stories.md` H-08 ("«الجولة التالية» يسحب فئة جديدة غير
مستخدمة"). The fallback is unreachable in the prototype's flow (§1.1, fact 1) and is kept because the
roadmap names it. The list keeps selection order so that a given random value picks the same category
in the engine as in the prototype — which is what lets REQ-4.14 compare them.

### 2.2 Starting rounds and passing turns

**REQ-4.4 — `startMatch` starts round 1 of a match, on `ready` and on `match`**
On the room-ready screen and on the match-end screen, `startMatch` sets the round to 1, both tallies to
0, the log and the used list to empty, records the drawn category as the round's category and as used,
and starts the round: team A starts (REQ-4.5), its bank full and running from the current engine time,
team B's bank full and not yet started, the question list as the pool, both indices at 0, no reveal.
The judge does not rotate. On every other screen it is inert.
*Why:* the prototype's `goWheel` and `rematch` (reading 2). A rematch keeps the players, the team names,
the judge, the rotation toggle, the selection and the configuration — "نفس الفرق" — and starts again
from round 1.

**REQ-4.5 — Odd rounds start with team A, even rounds with team B**
The team that starts a round is A when the round number is odd and B when it is even, for every round
a match starts — the first, every next round, and a rematch's first.
*Why:* `roadmap.md` Phase 4; the prototype's `startingTeam` getter (`round % 2 === 1 ? 'a' : 'b'`).
Alternating the start is what makes a silent match fair: the team that starts a round is the team
whose clock runs first.

**REQ-4.6 — صحيح → a 1000 ms reveal → the other team's turn**
Marking an answer correct, in addition to everything REQ-3.8 requires, records the engine time at which
the reveal went up. A `passTurn` action is inert unless the round is in play, a reveal is up, and at
least `REVEAL_HOLD_MS` (1000) milliseconds of engine time have passed since it went up. When it takes
effect it brings the reveal down and passes the turn: the other team becomes active; its bank, if it
has not yet had a turn this round, is full and marked started — otherwise it keeps exactly the
milliseconds it had when its last turn ended; its clock runs from the current engine time; the question
index advances by one and the hint index returns to 0. The team that answered keeps exactly the
milliseconds it had when صحيح was pressed. Ticks during the reveal drain nothing (REQ-3.8, unchanged),
and every judge action during it is inert (REQ-3.8, unchanged).
*Why:* `roadmap.md` Phase 4 ("reveal → 1000ms hold → other team, whose bank starts full on their first
turn"), `design/README.md` "Interactions", and the prototype's `passTurn`
(`[next]: nx.started ? nx : {time:this.roundTime, started:true}`, `qi: this.state.qi + 1, hintIdx:0,
reveal:null`, then `startClock()`). This is the clock's hardest transition — the lazy representation's
`runningSince` re-anchored for a *different* team — which Phase 3 carried forward because nothing in
Phase 3 exercises it. The clock starts at the moment of the pass, not at the end of the hold, so a
driver that sends `passTurn` late never charges the next team for time the reveal hid their question.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): the turn passes by an explicit action.**
> `passTurn` mirrors the prototype's own separate 1000 ms timer; the engine refuses it until the reveal
> has been up `REVEAL_HOLD_MS` of engine time; the driver sends it. The alternative considered and
> rejected was passing the turn inside the `tick` that reaches 1000 ms. **What it costs:** a driver
> obligation — a driver that never sends `passTurn` leaves the reveal up and the game stalled. That is
> **carried forward** to Phase 5 and Phase 11 in [verification.md](verification.md) §9. The pass lands
> on the first `passTurn` at or after 1000 ms, so its timing is exact only for a driver that ticks in
> steps dividing 1000 and sends `passTurn` after each. It was chosen because the alternative changes
> Phase 3's pre-registered Table D scenario S8 and the tail of every sequence in Phase 3's verdict
> samples (§1.2), which would mean re-measuring a verdict that was evaluated exactly once.

### 2.3 Ending rounds and matches

**REQ-4.7 — A round of a match is won by the team whose clock did not run out**
When a round that has a category ends — a tick, a hint or a skip taking the active bank to zero
(REQ-3.4, REQ-3.7, unchanged) — the other team wins it: its tally rises by one, and one entry is added
to the log recording the round number, the round's category and the winning team. In the same reducer
step the screen moves to `match` if the match is over (REQ-4.8) and to `roundEnd` otherwise. A round
with no category ends exactly as Phase 3 specified: `roundEnd`, no tally, no log (reading 1).
*Why:* `roadmap.md` Phase 4 ("Round win = the opponent's clock hit zero; tally, log entry, reason
line"); the prototype's `endRound`. The log entry carries everything the round-end screen's reason line
and the match-end screen's log rows state (readings 3 and 4). No state may exist in which a round has
ended and its result is not yet recorded — the same rule REQ-3.7 set for the bank.

**REQ-4.8 — The match ends at `winsNeeded`, or when the categories run out — and a tie is a result**
A match is over, in the step its last round ends, when either tally has reached `winsNeeded` or when
every selected category has been used. Its result is the team with more round wins, or **no winner**
when the tallies are equal. The engine exports the rule that states the result.
*Why:* `roadmap.md` Phase 4; `design/user-stories.md` H-09 ("المباراة تُحسم عند ٣ جولات لفريق واحد");
the prototype's `done = tallyA >= this.winsNeeded || tallyB >= this.winsNeeded || this.remaining.length
=== 0` and its "تعادل بالمباراة". A tie is reachable only through exhaustion (§1.1, fact 2) — two
categories selected with `winsNeeded` 3 is enough — and a screen that assumed a winner would name the
wrong team.

**REQ-4.9 — `nextRound`: the next round, its category, its starting team and its judge**
On the round-end screen, `nextRound` advances the round number by one; rotates the judge index to
`(judgeIndex + 1) mod max(1, players.length)` when the rotation toggle is on and leaves it otherwise;
records the drawn category as the round's category and, if it is not already, as used; and starts the
round with the starting team of REQ-4.5, its bank full and running, the other bank full and not
started, the question list as the pool, both indices at 0, no reveal. On every other screen it is
inert.
*Why:* `roadmap.md` Phase 4 ("Judge rotation on `nextRound` when 'بدّل الحكم كل جولة' is on");
`design/user-stories.md` H-02, H-08; the prototype's `nextRound` → `drawCategory` → `startRound`. The
judge rotates **only** here — not on a match's first round and not on a rematch — because that is the
only place the prototype rotates it.

**REQ-4.10 — `resetMatch`: back to setup with the room intact**
On the round-end and match-end screens, `resetMatch` moves the screen to `setup` and sets the round to
1, both tallies to 0, the log and the used list to empty, the round's category to none, and clears any
reveal. Players, team names, the judge, the rotation toggle, the selection, the configuration and the
room code are unchanged; so are the banks, the active team, the question pool and its indices
(reading 5). On every other screen it is inert.
*Why:* §1.4; the prototype's `resetAll`, behind "رجوع للإعداد" on round end and "غيّر اللاعبين
والفئات" on match end. "Returns to setup with state intact" (roadmap Phase 7) means the people and the
choices survive; the match does not.

### 2.4 Continuity, fidelity and the exit criterion

**REQ-4.11 — Phase 3's rules and Phase 3's record are unchanged**
Every Phase 3 action keeps its Phase 3 contract: `tick`, `hint` and `skip` unchanged; `correct`
unchanged except that it records the reveal time (REQ-4.6); `startRound` unchanged except that it
clears the reveal time with the reveal. The clock's representation is unchanged. Every Phase 3 test
passes, and Phase 3's test files change in exactly the places [specs.md](specs.md) §2.9 lists — the
contract table's key lists, the exported-name lists, and the one expected state after `correct` —
and nowhere else. Phase 3's oracle, harness, generator, invariants and every pre-registered table are
not edited.
*Why:* Phase 3's verdicts were each evaluated exactly once, and its tests are the regression check
that those verdicts still describe the engine. Phase 3 anticipated exactly these edits — "a field
added without a row here fails" (its specs.md §2.1), "an export added to index.ts fails this test until
the list … say[s] so too" (its `index.test.ts`) — and nothing else. A Phase 4 change that needed any
other Phase 3 test to change would be a change to a Phase 3 rule, and is a stop.

**REQ-4.12 — The flow's numbers and formulas are read from the prototype at test time**
The reveal hold, the starting-team parity, the judge-rotation formula and when it applies, the draw's
fallback, its pick formula and its selection order, the used list's append-once rule, the match-end
condition, `passTurn`'s bank rule and index advance, the winner being the other team, the log entry's
fields, the fields `rematch` and `resetAll` reset, the shuffle REQ-4.2 departs from, and which screen's
button calls which method are each extracted from `design/designs/Nel3ab - Arcade.dc.html` when the
test runs — seventeen extractions, listed in [verification.md](verification.md) Gate 4 — asserted
equal to the engine's, and each drives the engine. The number of matches of every extraction is asserted, so an
extraction that finds nothing fails.
*Why:* Phase 3's REQ-3.10 and Phase 2's NFR-2.6: a fidelity claim is worth something only if a change
that breaks it fails CI. `design/` is never edited (`CLAUDE.md` invariant 5), so these tests can go red
only by the engine drifting.

**REQ-4.13 — Sixteen scripted matches produce their pre-registered outcomes**
Each of the sixteen scripted matches of [verification.md](verification.md) Table G — written out event
by event, with every draw named — played through the engine, ends each round at the pre-registered
step and finishes on the pre-registered screen, round, tallies, judge, used list, round log, displayed
seconds, started flags and indices.
*Why:* the roadmap's "Tests for a full simulated match, and for the categories-exhausted edge case."
Each scripted match pins one behaviour by name — a silent match, a turn pass with its hold, a tie, a
one-category match, judge rotation, a rematch, a spend to exactly zero by the second team, a reset —
so a failure names the rule that broke.

**REQ-4.14 — 🚦 A full match runs as it does in the prototype**
Played through the engine and through a transcription of the prototype's own flow in its own
floating-point arithmetic, with every draw given identically to both, all sixteen scripted matches of
Table G and every sequence of the pre-registered 500-sequence 45-second sample produce the same
observation at every step: the screen, the round, both tallies, the active team, both displayed clocks,
both started flags, whether a reveal is up, both indices, the round's category, the used list, the
judge, and the round log.
*Why:* this is the roadmap's exit criterion — "A scripted full match runs end to end in tests and
produces a correct round log" — measured against the only specification of the flow there is. It
compares the engine with an external reference, so it is a **verdict gate**: a disagreement that
remains once the engine agrees with exact arithmetic is a fact about the prototype or about this
phase's reading of it, not a bug to retry. Its scripts, its seed, its sample size and its generator are
fixed in [verification.md](verification.md) before any code exists.

**REQ-4.15 — Full test coverage of the whole engine, still enforced on every run**
Every line, branch, function and statement of `packages/game/src` — with the same two exclusions,
test files and `src/testing/` — is executed by the test suite, and `pnpm test` fails if that stops
being true. Named plausible mutations of the new flow are each caught by an assertion.
*Why:* inherited from Phase 3 (REQ-3.12, DECIDED 2026-09-30: "Phase 4 inherits the 100% bar"). The
coverage configuration already includes every `.ts` file under `packages/game/src`, so the new modules
are measured with no configuration change.

**REQ-4.16 — The four gate commands pass with no escape hatch**
`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass on a fresh
`pnpm install --frozen-lockfile`, on Windows and on Ubuntu CI, with none of Phase 3's REQ-3.13 escape
hatches introduced anywhere.
*Why:* the phase gate (`CLAUDE.md`). Phase 4 adds **no** dependency, so nothing about the stack is
being measured and this is an ordinary gate, not a verdict: a failure is a defect in this phase's code
and is fixed. Passing by an escape hatch is forbidden outright.

---

## 3. Non-Functional Requirements

**NFR-4.1 — `design/` and `specs/` are not edited.** Tests may read `design/`; nothing writes to it
(`CLAUDE.md` invariant 5). `specs/` is read-only during implementation (invariant 6);
`verification.md` may only have boxes ticked and measured values recorded.

**NFR-4.2 — `@nel3ab/game` stays dependency-free and ambient-free.** Its manifest gains no
dependency of any kind, and no non-test source file imports anything but a relative path inside the
package (`tech-specs.md` §2.3). No non-test source file — comments included — contains any word Phase 3's
ambient-time grep searches for (`Date`, `Math.random`, `performance`, `setTimeout`, `setInterval`,
`setImmediate`, `queueMicrotask`, `crypto`, `process`, `fetch`, `console`). The prototype's
`setTimeout` and `Math.random` are named in specs and tests, never in engine source.

**NFR-4.3 — Every new action is pure.** For `startMatch`, `nextRound`, `passTurn` and `resetMatch`,
as for Phase 3's five: the reducer never mutates its inputs; the same state and action give a
deep-equal result every time; an inert action returns the same object it was given; validation
precedes inertness, so a malformed action throws in every state; and no ambient time, randomness or
timer is touched while a full match is played.

**NFR-4.4 — The public surface is exact.** `@nel3ab/game`'s runtime exports are Phase 3's twelve
plus exactly five — `REVEAL_HOLD_MS`, `drawableCategories`, `drawCategory`, `shuffleQuestions`,
`matchWinner` — and the new internal helpers stay internal, as Phase 3's did (its NFR-3.5).

**NFR-4.5 — Fidelity claims are re-checkable, and the suite stays fast enough for `pnpm test`.**
REQ-4.12 – REQ-4.14 run inside `pnpm test`, and so in CI on every pull request. The whole
`@nel3ab/game` project — Phase 3's suites and this phase's together — completes in under **20 s** on
the Windows development machine **on mains power** (Phase 3 measured 6.47 s there, and recorded
21–31 s on unchanged code while the laptop recharged from 2.7%). If it cannot, no sample is shrunk —
both are pre-registered — and the overrun is recorded as a finding.

**NFR-4.6 — Every workspace project still contributes a collected test file.** `pnpm test` still
reports six projects (`CLAUDE.md` invariant 2). No project is added or removed.

**NFR-4.7 — Configuration is untouched.** No change to `vitest.config.ts`, any `package.json`,
`pnpm-lock.yaml`, `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`,
`eslint.config.mjs`, `stylelint.config.mjs`, `.gitattributes`, `.gitignore` or `.prettierignore`.
Phase 3's coverage block already measures every new file. If a change to any of them appears
necessary, that is the signal to stop.

---

## 4. Explicit Non-Goals

An implementer that wants to do any of the following must **stop**, not proceed.

- **No setup actions and no setup → ready.** Adding, removing or swapping a player, renaming or
  shuffling a team name, choosing the judge, toggling rotation, picking categories, the zero-category
  guard, the prototype's `startGame` defaults, and moving between setup and room-ready are all
  **Phase 5's**. Phase 4's tests build their `ready` rooms by hand, in test support.
- **No randomness in the reducer, and no random source anywhere in non-test code.** The helpers take
  one as a parameter; choosing it is Phase 5's (browser) and Phase 11's (server). No seed in
  `RoomState`.
- **No timers and no driver.** No loop that ticks, no loop that sends `passTurn`, no React hook, no
  store. Phases 5–7 and 11.
- **No change to Phase 3's rules, to the clock's representation, or to Phase 3's test support and
  pre-registered tables** (REQ-4.11). Phase 3's `startRound` is not removed, renamed or narrowed —
  and no driver may dispatch it: Phase 11 must map the wire's `startRound` message onto `startMatch`,
  never onto it.
- **No content.** No dependency on `@nel3ab/content`, no question bank, no loader; questions arrive in
  the action. No change to `packages/content` or `packages/protocol`.
- **No presentation.** No reason-line text, no winners line, no "N فئة متبقية", no status text, no
  bank fraction, no "who starts" helper. Phases 6 and 7.
- **No player view, no redaction, no wire protocol.** Phases 11 and 12. `RoomState` holds the
  round's whole question pool, answers included, and is never a player payload.
- **No question-repeat avoidance beyond the prototype's.** A category played in a rematch reshuffles
  its pool and can repeat questions a previous match asked; avoiding that is a content-depth problem
  (`mission.md` §7, Phase 22), not a flow rule.
- **No judge-disconnect handling, no reconnection, no reconciliation.** Phases 15 and 16.
- **No change to any file NFR-4.7 lists.**

---

*Last updated: 2026-10-02*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
