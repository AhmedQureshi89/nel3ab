# Phase 4 Verification & Test Plan — Rules engine: round & match flow

> **Phase:** Phase 4
> **Parent Requirements:** [requirements.md](requirements.md)
> **Parent Specification:** [specs.md](specs.md)

---

## Notation

| Marker | Meaning | On failure |
|---|---|---|
| `- [ ]` | ordinary check — tests *our code* | fix and retry freely |
| `- [ ] 🚦 **(VERDICT GATE — no retry)**` | measures *reality* | **halt.** Record the result. Never retry into green |

A verdict gate's failure is a finding, not a bug. `/spec-next` and `/spec-run` are required to
stop at one. If a check's kind is unclear, it is a verdict gate.

This phase has **no** check that needs a human to look at a screen: it renders nothing. Every box
below is either an automated test that runs inside `pnpm test` — and so in CI on every pull request,
long after this phase closes — or a command whose output is recorded here.

**Gate ordering.** **Gate 1 blocks everything**: it adds the one new state field, makes the sanctioned
edits to Phase 3's tests, and ends with Phase 3's whole suite green — so that from then on, any red
Phase 3 test is a regression this phase caused. **Gates 2–4 are one block**: code is built in the step
order of [specs.md](specs.md) §1, and each box in the block is ticked as soon as the code it exercises
exists (several Gate 2 and Gate 4 boxes need STEP 3's reducer, and the purity boxes need STEP 5's
sample machinery — the reading Phase 3's dated correction of 2026-09-30 established, adopted here from
the start). The whole block must be complete before Gate 5's first box. Gate 2's 🚦 box — the premise of
REQ-4.2's decision — is evaluated once, after Gate 4's extraction #15 has pinned the code it runs. Gate 5 holds the exit-criterion
verdict; its ordinary boxes are evaluated first, so that when the 🚦 box is evaluated the engine has
already been shown to agree with exact arithmetic and the only thing left for it to measure is the
prototype. Gate 6 is evaluated last, once, over the finished phase.

**A tick with an empty `Measured:` line is not a tick.**

---

## Pre-registered values

Measured on 2026-10-02, before any code existed, by the planning session's own scripts: a
transcription of the prototype's `Component` flow in both arithmetics, standing in for the engine,
driven by the generator of [specs.md](specs.md) §2.10. Every number below is **fixed**: an
implementation that disagrees fixes itself to match the definitions in specs.md §2.10, or — if it
matches every fingerprint and still disagrees — stops and records the disagreement. **No table in this
section may be edited to match a result.**

**Phase 3's Table A, reused as an anchor.** [Phase 3's verification.md](../phase-3/verification.md),
Table A, rows "float — ticks to end" and "exact — ticks to end": a full bank drained by ticks alone
ends after **200 · 250 · 300 · 350 · 400 · 450 · 500 · 550 · 600 · 650 · 700 · 750 · 801 · 851 · 901**
ticks in float and after `10 × S` ticks in exact, for S = 20 … 90. The new match oracle's silent first
round reproduces both rows (measured).

**Table E — generator fingerprint.** `mulberry32(0x20261002)`'s first three draws, to 10 decimal places:
**0.1825684069 · 0.6584435350 · 0.6478405960**. The verdict sample's first three sequences:

| Seq | Configuration | Events | Matches ended | Exact oracle at the end | Event counts |
|---|---|---|---|---|---|
| 0 | `winsNeeded` 2 · 6 picked (c0–c5) · 7 players · rotation on · judge 5 · rate 0.02 | **368** | 0 | `setup`, round 1, 0–0, judge 5 | startMatch 1 · tick 362 · skip 2 · hint 2 · resetMatch 1 — non-tick events at steps 1, 25, 114, 119, 367 (the hint that ends round 1), 368 |
| 1 | `winsNeeded` 4 · 8 picked · 2 players · rotation on · judge 1 · rate 0.05 | **5,163** | 2 | `match`, round 4, 4–0, judge 0, log `1·c2·a 2·c5·a 3·c3·a 4·c0·a` | startMatch 2 · nextRound 7 · tick 4,903 · correct 125 · skip 74 · hint 52 |
| 2 | `winsNeeded` 3 · 8 picked · 8 players · rotation off · judge 6 · rate 0.1 | **1,066** | 0 | `setup`, round 1, 0–0, judge 6 | startMatch 1 · nextRound 1 · tick 953 · correct 50 · skip 42 · hint 18 · resetMatch 1 |

**Table F — the prototype's arithmetic against exact arithmetic, in generated matches.** Sequences in
which the float and exact oracles' observations differ at any step; the total events consumed; the
number of times a match ended; the sequences ended by `resetMatch`. No sequence reached
`MATCH_MAX_STEPS` in any row.

| Sample | seed | n | diverging sequences | steps consumed | matches ended | ended by `resetMatch` |
|---|---|---|---|---|---|---|
| verdict, 45 s | `0x20261002` | 500 | **0** | 1,156,355 | 593 | 332 |
| per-length, 20 s | `MATCH_SEED + 20` | 20 | **11** | 16,248 | 23 | 13 |
| per-length, 25 s | `MATCH_SEED + 25` | 20 | **1** | 21,743 | 22 | 16 |
| per-length, 30 s | `MATCH_SEED + 30` | 20 | 0 | 30,327 | 24 | 13 |
| per-length, 35 s | `MATCH_SEED + 35` | 20 | 0 | 34,123 | 24 | 14 |
| per-length, 40 s | `MATCH_SEED + 40` | 20 | 0 | 37,965 | 20 | 14 |
| per-length, 45 s | `MATCH_SEED + 45` | 20 | 0 | 43,472 | 19 | 15 |
| per-length, 50 s | `MATCH_SEED + 50` | 20 | 0 | 51,514 | 23 | 14 |
| per-length, 55 s | `MATCH_SEED + 55` | 20 | 0 | 57,800 | 23 | 13 |
| per-length, 60 s | `MATCH_SEED + 60` | 20 | 0 | 60,472 | 21 | 14 |
| per-length, 65 s | `MATCH_SEED + 65` | 20 | **20** | 73,159 | 29 | 11 |
| per-length, 70 s | `MATCH_SEED + 70` | 20 | **20** | 85,873 | 27 | 10 |
| per-length, 75 s | `MATCH_SEED + 75` | 20 | **20** | 66,851 | 24 | 14 |
| per-length, 80 s | `MATCH_SEED + 80` | 20 | **20** | 96,182 | 27 | 11 |
| per-length, 85 s | `MATCH_SEED + 85` | 20 | **20** | 88,203 | 21 | 16 |
| per-length, 90 s | `MATCH_SEED + 90` | 20 | **20** | 77,555 | 20 | 16 |

The per-length rows total 841,487 steps; with the verdict row, 1,997,842.

**Table G — scripted matches.** Default configuration: 45 s · `winsNeeded` 3 · picked c0–c7 · 5
players · judge 4 · rotation off — the prototype's initial state. Every draw names its category;
`perm` is `[0, 1, 2]` unless stated. *Rounds end at* is the 1-based index of each event after which a
round has ended. The final state is after the last event: screen · round · tallies (A–B) · judge ·
active team; then the used list; the log as `n·category·winner`; then display A/B · started A/B ·
`questionIndex` · `hintIndex`. No reveal is up at the end of any of them. **Both oracles produce
exactly these outcomes and agree with each other at every one of the 15,700 events (measured).**

| # | Config | Events | Rounds end at | Final state | Used · log | Clocks · indices | What it pins down |
|---|---|---|---|---|---|---|---|
| M1 | — | startMatch(c0), 450 tick, nextRound(c1), 450 tick, nextRound(c2), 450 tick, nextRound(c3), 450 tick, nextRound(c4), 450 tick | 451 · 902 · 1353 · 1804 · 2255 | `match` · 5 · 2–3 · 4 · a | c0,c1,c2,c3,c4 · `1·c0·b 2·c1·a 3·c2·b 4·c3·a 5·c4·b` | 0/45 · T/F · 0 · 0 | a silent match: starts alternate a, b, a, b, a; the starting team loses; the match ends at 3 |
| M2 | — | startMatch(c0), 100 tick, correct, 9 tick, hint, skip, correct, 1 tick, 200 tick, correct, 10 tick, 350 tick | 676 | `roundEnd` · 1 · 0–1 · 4 · a | c0 · `1·c0·b` | 0/25 · T/T · 2 · 0 | the hold is exactly 10 ticks and every judge action inside it is inert; b's first turn starts full; a resumes its frozen 35 s |
| M3 | picked c0, c1 | startMatch(c1), 450 tick, nextRound(c0), 450 tick | 451 · 902 | `match` · 2 · 1–1 · 4 · b | c1,c0 · `1·c1·b 2·c0·a` | 45/0 · F/T · 0 · 0 | categories run out: a **tie** — `matchWinner` is `null` |
| M4 | picked c0 | startMatch(c0), 450 tick | 451 | `match` · 1 · 0–1 · 4 · a | c0 · `1·c0·b` | 0/45 · T/F · 0 · 0 | one category: a one-round match |
| M5 | rotation on | startMatch(c0), 450 tick, nextRound(c1), 450 tick, nextRound(c2), 450 tick, nextRound(c3), 450 tick | 451 · 902 · 1353 · 1804 | `roundEnd` · 4 · 2–2 · **2** · b | c0,c1,c2,c3 · `1·c0·b 2·c1·a 3·c2·b 4·c3·a` | 45/0 · F/T · 0 · 0 | judge 4 → 0 → 1 → 2: rotates on next round only, modulo 5 |
| M6 | rotation on | M1's events, then startMatch(c7) | 451 · 902 · 1353 · 1804 · 2255 | `play` · 1 · 0–0 · **3** · a | c7 · — | 45/45 · T/F · 0 · 0 | a rematch: round 1, tallies and log cleared, used list restarted, a starts, judge kept |
| M7 | `winsNeeded` 2 | startMatch(c3), 50 tick, correct, 10 tick, 450 tick, nextRound(c5), 450 tick | 512 · 963 | `match` · 2 · 2–0 · 4 · b | c3,c5 · `1·c3·a 2·c5·a` | 45/0 · F/T · 0 · 0 | a team wins a round it started; two wins take a two-win match |
| M8 | — | startMatch(c0), 10 tick, correct, 10 tick, 420 tick, skip | 443 | `roundEnd` · 1 · 1–0 · 4 · b | c0 · `1·c0·a` | 44/0 · T/T · 1 · 0 | the second team's skip spends exactly to zero; it does not advance `questionIndex` |
| M9 | — | startMatch(c0), 450 tick, resetMatch | 451 | `setup` · 1 · 0–0 · 4 · a | (empty) · — | 0/45 · T/F · 0 · 0 | back to setup from round end; the banks are left as they were |
| M10 | `winsNeeded` 4 | startMatch(c0), 450 tick, then nextRound(c1) … nextRound(c6), each followed by 450 tick | 451 · 902 · 1353 · 1804 · 2255 · 2706 · 3157 | `match` · 7 · 3–4 · 4 · a | c0–c6 · `1·c0·b 2·c1·a 3·c2·b 4·c3·a 5·c4·b 6·c5·a 7·c6·b` | 0/45 · T/F · 0 · 0 | a seven-round match |
| M11 | — | startMatch(c2, perm [2,0,1]), skip, skip, 5 tick, correct, 10 tick, skip, 3 tick | — | `play` · 1 · 0–0 · 4 · b | c2 · — | 39/42 · T/T · 4 · 0 | the pool wraps across a pass: question 3 is `pool[0]` again |
| M12 | 0 players · judge 0 · rotation on | startMatch(c0), 450 tick, nextRound(c1), 450 tick | 451 · 902 | `roundEnd` · 2 · 1–1 · **0** · b | c0,c1 · `1·c0·b 2·c1·a` | 45/0 · F/T · 0 · 0 | rotation with no players stays at 0 |
| M13 | — | startMatch(c0), hint, 20 tick, correct, 10 tick, 5 tick | — | `play` · 1 · 0–0 · 4 · b | c0 · — | 41/45 · T/T · 1 · 0 | the pass returns `hintIndex` to 0; a's hint stays paid |
| M14 | — | startMatch(c0), 449 tick, correct, 10 tick, 10 tick, correct, 10 tick, 1 tick | 483 | `roundEnd` · 1 · 0–1 · 4 · a | c0 · `1·c0·b` | 0/44 · T/T · 2 · 0 | a team frozen with 100 ms keeps it across the other's turn, and its next tick ends the round |
| M15 | picked c0 | startMatch(c0), 450 tick, resetMatch | 451 | `setup` · 1 · 0–0 · 4 · a | (empty) · — | 0/45 · T/F · 0 · 0 | back to setup from match end |
| M16 | — | startMatch(c0), correct, 10 tick, 430 tick, hint | 443 | `roundEnd` · 1 · 1–0 · 4 · b | c0 · `1·c0·a` | 45/0 · T/T · 1 · 0 | the second team's hint spends exactly to zero; it does not advance `hintIndex` |

Event totals: M1 2,255 · M2 676 · M3 902 · M4 451 · M5 1,804 · M6 2,256 · M7 963 · M8 443 · M9 452 ·
M10 3,157 · M11 23 · M12 902 · M13 38 · M14 483 · M15 452 · M16 443 — **15,700**.

**Table H — the shuffle.** Three measurements, the first the evidence for REQ-4.2's decision.

| Measurement | Result |
|---|---|
| The prototype's `arr.slice().sort(() => Math.random() - .5)`, `Math.random` replaced by `mulberry32(0x20261002)`, 60,000 shuffles of `[0, 1, 2]`, Node 24.14.0 (V8) | 012 **22,564** · 021 3,795 · 102 7,344 · 120 3,732 · 201 3,752 · 210 **18,813** (fair: 10,000 each) |
| The engine's random insertion (specs.md §2.4), driven by `mulberry32(0x20261002)`, 60,000 shuffles of `[0, 1, 2]` | 012 **10,142** · 021 **10,001** · 102 **9,823** · 120 **10,115** · 201 **9,925** · 210 **9,994** |
| The engine's random insertion with scripted draws | `[0.9, 0.1, 0.6]` → Q1,Q2,Q0 · `[0, 0.99, 0.99]` → Q0,Q1,Q2 · `[0.5, 0, 0]` → Q2,Q1,Q0 · five items with `mulberry32(0x20261002)` → Q3,Q0,Q2,Q4,Q1 in exactly **5** draws |
| Every draw vector *jᵢ* ∈ [0, *i*], fed as `rᵢ = (jᵢ + 0.5) / (i + 1)`, *n* = 1 … 6 | 1 · 2 · 6 · 24 · 120 · 720 vectors → that many **distinct** orderings, each exactly once |
| The mutation "insert at `floor(r × i)`", draws 0.1 / 0.9 at each position | reaches **2** of the 6 orderings |

---

## 1. Gate 1 — Phase 3 kept green (blocks every other gate)

- [ ] **REQ-4.11 (The one new field):** `createRoom(…)` has `revealedAt: null`; `correct` sets it to
  `clock.now` at that moment; `startRound` (Phase 3's) sets it to `null` with `reveal`. `Object.keys` of
  a created room is **exactly** Phase 3's 20 top-level keys plus `revealedAt`; `clock` still exactly
  its 4; `config` its 2. `room.test.ts` checks Phase 3's 22 handoff names and the now three `+` rows.
  > Measured: top-level keys ____ / 21 · clock ____ / 4 · config ____ / 2 · handoff names ____ / 22 ·
  > added rows ____ / 3 · `revealedAt` after createRoom ____ · after correct at now 3,700 ____ ·
  > after startRound ____

- [ ] **REQ-4.11 (The sanctioned edits, and no others):** relative to `841981a` (Phase 3 complete),
  `git diff` of `room.test.ts`, `index.test.ts` and `reducer.test.ts` contains exactly the edits of
  [specs.md](specs.md) §2.9 — listed here hunk by hunk — and `git diff 841981a -- ` over
  `clock.test.ts`, `purity.test.ts`, `rules.test.ts`, `prototype-equivalence.test.ts` and
  `src/testing/{prng,sequences,prototype-oracle,harness,invariants,deep-freeze}.ts` is **empty**.
  > Measured: hunks in the three edited files ____ (each named) · lines outside §2.9 ____ ·
  > diff over the ten untouched files: ____ lines

- [ ] **REQ-4.11 (Phase 3's suite, green):** `pnpm vitest run packages/game` passes every test in
  Phase 3's seven test files — including the assertions of Phase 3's Tables A–D and its REQ-3.11
  verdict test, which runs unchanged inside `pnpm test` as a regression check. Reported per file.
  > Measured: Phase 3 tests passed ____ / ____ · per file ____ · failures ____

- [ ] **NFR-4.6 (Six projects):** `pnpm test`'s `[check-collected-tests]` line reports **six**
  workspace projects, each with ≥ 1 collected file.
  > Measured: ____ file(s) across ____ project(s)

---

## 2. Gate 2 — The draw (block 2–4; see Gate ordering)

- [ ] **REQ-4.3 (Which categories may be drawn):** `drawableCategories` returns `pickedCategories`
  (same order) on `ready` and on `match` — even with a non-empty used list; on `roundEnd`, `play` and
  `setup` the selected-but-unused categories **in selection order** (picked `[c3, c0, c5, c1]`, used
  `[c5, c3]` → `[c0, c1]`); and the whole selection when every one is used (the fallback — a hand-built
  state, requirements §1.1 fact 1).
  > Measured: cases ____ · mismatches ____ · order kept ____ · fallback returns ____

- [ ] **REQ-4.3 (The pick):** for every list length L = 1 … 11 and every position k, `drawCategory`
  with `random` returning `(k + 0.5) / L` returns element k; `random` returning `0` returns the first
  and `1 − 2⁻⁵³` the last; `random` is called exactly **once** per pick.
  > Measured: (L, k) pairs ____ / 66 · mismatches ____ · first / last ____ · calls per pick ____

- [ ] **REQ-4.1 (The pick's one guard):** `drawCategory` throws `RangeError` for an empty list, and for
  a random value of `1`, `-1e-9`, `NaN` and `Infinity` over a non-empty list; each message names the
  value and the length.
  > Measured: inputs ____ / 5 thrown · messages naming both ____ / 5

- [ ] **REQ-4.2 (Fair — every ordering exactly once):** for *n* = 1 … 6, `shuffleQuestions` fed every
  draw vector of Table H's fourth row produces **n!** distinct orderings, each exactly once.
  > Measured: n = 1 ____ · 2 ____ · 3 ____ · 4 ____ · 5 ____ · 6 ____ (distinct / each-once)

- [ ] **REQ-4.2 (Pinned, pure, and counted):** `shuffleQuestions` reproduces every scripted output of
  Table H's third row and its exact 60,000-shuffle counts in the second; it calls `random` exactly *n*
  times; it returns a new array (not `===` its input) holding the same elements; and its input, deep-
  frozen, is unchanged.
  > Measured: scripted outputs ____ / 4 · 60,000-shuffle counts equal Table H ____ · draws for n = 0 … 6
  > ____ · new array ____ · same elements ____ · frozen-input TypeErrors ____

- [ ] **REQ-4.2 (The shuffle's guard):** a random value of `1`, `-0.5` or `NaN` at the first, a middle
  or the last draw throws `RangeError`.
  > Measured: cases ____ / 9 thrown

- [ ] 🚦 **REQ-4.2 (The decision's premise: the prototype's shuffle is not fair) (VERDICT GATE — no
  retry):** the prototype's shuffle, transcribed character for character from Gate 4 extraction #15 and
  run with `Math.random` replaced by `mulberry32(0x20261002)` for 60,000 shuffles of `[0, 1, 2]`, returns
  the original order **more than 20,000** times and the reversed order **more than 15,000** times — each
  more than 1.5 × a fair 10,000. The exact counts are recorded; Table H's first row is their value on
  Node 24.14.0. **This box measures the runtime's sort, not our code.** If it fails, the premise of
  REQ-4.2's DECIDED block has changed: halt, record the counts, and return the decision to the owner.
  It is not retried with another seed.
  > Measured: 012 ____ · 021 ____ · 102 ____ · 120 ____ · 201 ____ · 210 ____ · Node ____ ·
  > equal to Table H ____ · **verdict: PASS / FAIL** ____

- [ ] **REQ-4.1 (A bad draw throws, in every state — validation precedes inertness):** `startMatch` and
  `nextRound` each throw `RangeError` — on `ready`, `play`, a reveal, `roundEnd`, `match` and `setup`
  alike — for: a category not in its allowed list (`pickedCategories` for `startMatch`;
  selected-but-unused, or all when none is unused, for `nextRound`), `questions: []`, a non-array
  `questions`, and two questions sharing a `q`. A well-formed draw on a screen where the action is
  inert returns the **same object**.
  > Measured: throwing cases ____ / 48 (2 actions × 4 inputs × 6 states) · inert-and-identical ____ /
  > ____ · messages naming the category or the repeated text ____

---

## 3. Gate 3 — The flow (block 2–4; see Gate ordering)

- [ ] **REQ-4.4 (`startMatch` from `ready`):** from `readyRoom(…)` at engine time `t`, the result is,
  by `toStrictEqual`: round 1, tallies 0, log `[]`, `usedCategories` `[c]`, `categoryId` c, screen
  `play`, `questionPool` the given questions, both indices 0, `reveal` and `revealedAt` `null`,
  `clock` `{ now: t, active: 'a', runningSince: t, banks: { a: { ms: R, started: true }, b: { ms: R,
  started: false } } }` with R = `roundSeconds × 1000`; every other field — players, names, judge,
  rotation, selection, config, room code — identical to the input's.
  > Measured: fields asserted ____ · mismatches ____ · at t = 0 and t = 123,400 ____

- [ ] **REQ-4.4 (`startMatch` from `match` — a rematch):** from a finished match (round 4, tallies
  1–3, a four-entry log, four categories used, judge 2, rotation on), the result equals the `ready`
  case's — round 1, tallies 0, log `[]`, used `[c]` — with the judge **still 2**. On `setup`, `play`
  and `roundEnd` it returns the same object.
  > Measured: mismatches ____ · judge after rematch ____ · inert screens ____ / 3

- [ ] **REQ-4.5 (Who starts):** a match driven through rounds 1 … 7 by `nextRound` starts them with
  a, b, a, b, a, b, a; a rematch's round 1 starts with a.
  > Measured: starting teams ____ · rematch ____

- [ ] **REQ-4.6 (The hold, to the millisecond):** after `correct` at engine time T, `revealedAt` is T;
  after 9 × `tick(100)`, and again after `tick(999)`, `passTurn` returns the same object; after the
  10th `tick(100)`, and after `tick(999)` then `tick(1)`, and after a single `tick(1000)`, it takes
  effect. Throughout the hold `hint`, `skip` and `correct` return the same object and no bank drains.
  > Measured: inert at 900 / 999 ms ____ · effective at 1,000 ms by three routes ____ / 3 ·
  > judge actions inert during the hold ____ / 3 · drain during the hold ____ ms

- [ ] **REQ-4.6 (The pass, exactly):** the state after an effective `passTurn` equals, by
  `toStrictEqual`, the state before with: `active` the other team; that team's bank `{ ms: R,
  started: true }` on its first turn of the round, and the **same object** as before on a later turn;
  the answering team's bank the **same object** as before; `runningSince` = `clock.now`;
  `questionIndex + 1`; `hintIndex` 0; `reveal` and `revealedAt` `null`. Checked for a → b (b's first
  turn), b → a (a's second turn, a part-spent bank) and a → b again.
  > Measured: passes checked ____ / 3 · mismatches ____ · bank objects kept (`toBe`) ____

- [ ] **REQ-4.6 (A late `passTurn` charges nobody — R2):** `correct` at T, then `tick(1500)`, then
  `passTurn`: `runningSince` is **T + 1500**, not T + 1000; one further `tick(100)` leaves the new
  team R − 100. *(This is the only box that can see mutation N1 — specs.md §2.3.)*
  > Measured: `runningSince` ____ (expected T + 1500) · new team after one tick ____

- [ ] **REQ-4.6 (`passTurn` inert without a due reveal):** on `ready`, `setup`, `roundEnd`, `match`,
  and on `play` with no reveal, `passTurn` returns the same object.
  > Measured: states ____ / 5 identical

- [ ] **REQ-4.7 (A match round is scored in the step it ends):** for each round-ending path — a
  `tick`, a `hint` and a `skip` taking the active bank to zero — with team a losing and with team b
  losing (six cases), the resulting state equals, by `toStrictEqual`, Phase 3's round end plus: the
  winner's tally + 1, one log entry `{ n: round, category: categoryId, winner }`, and screen `roundEnd`.
  > Measured: cases ____ / 6 · mismatches ____

- [ ] **REQ-4.7 (A round with no category is not scored):** on a fresh room, Phase 3's `startRound`
  then `tick(45_000)` gives screen `roundEnd`, tallies 0–0 and log `[]` — the state Phase 3's own test
  expects, unchanged.
  > Measured: screen ____ · tallies ____ · log ____

- [ ] **REQ-4.8 (When a match is over):** a round won takes the screen to `match` exactly when a tally
  reaches `winsNeeded` — checked at 2, 3 and 4 — or when the round used the last unused category, and
  to `roundEnd` otherwise; with categories exhausted at 1–1 `matchWinner` is `null`, at 2–1 `'a'`, at
  1–2 `'b'`.
  > Measured: cases ____ · mismatches ____ · `matchWinner` ____ / 3

- [ ] **REQ-4.9 (`nextRound`):** from `roundEnd`, the result is round + 1, the drawn category set and
  appended to the used list, the starting team of REQ-4.5, and the clock of REQ-4.4. With rotation on,
  judge `j` becomes `(j + 1) mod max(1, players)` — checked for players 0, 1, 2 and 5 with the judge at
  the last index; with rotation off it is unchanged. On `ready`, `setup`, `play` and `match` it returns
  the same object.
  > Measured: mismatches ____ · rotation cases ____ / 8 · inert screens ____ / 4

- [ ] **REQ-4.3 / REQ-4.9 (The fallback, by a hand-built state):** on a hand-built `roundEnd` with every
  selected category used, `nextRound` with any selected category is accepted; the used list is
  **unchanged** (the category is not appended a second time); a category outside the selection throws.
  > Measured: accepted ____ · used list before / after ____ · outside the selection throws ____

- [ ] **REQ-4.10 (`resetMatch`):** from `roundEnd` and from `match`, the result is the input with screen
  `setup`, round 1, tallies 0, log `[]`, used `[]`, `categoryId` `null`, `reveal` and `revealedAt`
  `null` — and **nothing else changed**: `clock`, `questionPool`, both indices and every setup field are
  the same values. On `ready`, `setup` and `play` it returns the same object.
  > Measured: mismatches ____ / 2 · fields that must not change ____ / ____ · inert screens ____ / 3

- [ ] **REQ-4.13 (Table G through the engine):** each of the sixteen scripted matches, played through
  the engine alone with its draws named directly, ends each round at Table G's step and finishes on
  Table G's final state, used list, log, clocks and indices — and for M3 `matchWinner` is `null`.
  > Measured: matches ____ / 16 · rounds ending at the pre-registered step ____ / 34 · final-state
  > mismatches ____ · M3 `matchWinner` ____

---

## 4. Gate 4 — Fidelity, purity and the public surface (block 2–4; the block blocks Gate 5)

- [ ] **REQ-4.12 (The flow, read from the prototype):** each extraction below is read from
  `design/designs/Nel3ab - Arcade.dc.html` at test time, its match count asserted, its value asserted
  equal to the engine's — and each drives the engine (the test uses the extracted value, not a literal).

  | # | Extracted from the prototype | Count | Value | Drives |
  |---|---|---|---|---|
  | 1 | `setTimeout(() => this.passTurn(), N)` | 1 | 1000 | `REVEAL_HOLD_MS`; `passTurn` inert at N − 1 ms, effective at N |
  | 2 | `this.state.round % 2 === 1 ? 'a' : 'b'` in `startingTeam` | 1 | odd → a | the starting team of rounds 1 … 4 |
  | 3 | `(s.judgeIdx + 1) % Math.max(1, s.players.length)` behind `s.rotateJudge ?` | 1 | — | `nextRound`'s judge for players 0 and 5 |
  | 4 | the rotation appears only in `nextRound`; `rematch`'s body names no `judgeIdx` | 1 · 0 | — | a rematch keeps the judge |
  | 5 | `this.remaining.length ? this.remaining : this.state.picked` | 1 | — | the fallback of `drawableCategories` |
  | 6 | `pool[Math.floor(Math.random() * pool.length)]` | 1 | — | `drawCategory` against the same `r` |
  | 7 | `this.state.picked.filter(i => !this.state.usedCats.includes(i))` | 1 | selection order | the order of `drawableCategories` |
  | 8 | `tallyA >= this.winsNeeded \|\| tallyB >= this.winsNeeded \|\| this.remaining.length === 0` | 1 | ≥, exhaustion | `match` vs `roundEnd` |
  | 9 | `loserKey === 'a' ? 'b' : 'a'` | 1 | the other team | the log's winner |
  | 10 | the log entry `{n: s.round, cat: …, winner: …}` | 1 | 3 fields | `RoundLogEntry`'s 3 keys (`cat` → `category`, reading 3) |
  | 11 | `nx.started ? nx : {time:this.roundTime, started:true}` | 1 | — | the first-turn and later-turn banks |
  | 12 | `qi: this.state.qi + 1, hintIdx:0, reveal:null` in `passTurn` | 1 | — | the indices after a pass |
  | 13 | `rematch`'s reset `{round:1, tallyA:0, tallyB:0, log:[], usedCats:[]}` | 1 | 5 fields | the fields `startMatch` resets on `match` |
  | 14 | `resetAll`'s `{screen:'setup', round:1, tallyA:0, tallyB:0, log:[], usedCats:[], catIdx:null, reveal:null}` | 1 | 8 fields | the fields `resetMatch` changes |
  | 15 | `const shuffle = (arr) => arr.slice().sort(() => Math.random() - .5);` | 1 | — | Gate 2's 🚦 premise box |
  | 16 | `onClick="{{ goWheel }}"` · `{{ nextRound }}` · `{{ rematch }}` · `{{ resetAll }}` | 1 · 1 · 1 · 2 | — | which screen offers which action |
  | 17 | `usedCats: s.usedCats.includes(s.catIdx) ? s.usedCats : [...s.usedCats, s.catIdx]` in `startRound` | 1 | appended once | the used list after the fallback |

  > Measured: extractions found ____ / 17 · count mismatches ____ · value mismatches ____ · each
  > driving the engine ____ / 17

- [ ] **NFR-4.3 (Frozen inputs):** with every state and action deep-frozen before each reduction,
  every step of the per-length sample and of Table G reduces with **0** `TypeError`s, and each result
  equals the unfrozen run's.
  > Measured: pairs reduced ____ · TypeErrors ____ · differences ____

- [ ] **NFR-4.3 (Deterministic, and identical when inert):** reducing each step twice gives deep-equal
  results; every action that changes nothing returns its input (`===`) — counted per action type
  over the per-length sample.
  > Measured: double reductions ____ · differing ____ · inert returns per type ____ · inert copies ____

- [ ] **NFR-4.3 / REQ-4.1 (No ambient time, randomness or timers — at run time):** with `Date.now`,
  `Math.random`, `performance.now`, `setTimeout` and `setInterval` each replaced by a function that
  throws, the per-length sample and all of Table G run through the engine and the helpers with **0**
  calls. The spies are first shown to fire.
  > Measured: steps run ____ · calls ____ · spies proven live ____ / 5

- [ ] **NFR-4.2 (Dependency-free, ambient-free in source):** `packages/game/package.json` has no
  dependency keys; §7's ambient grep and non-relative-import grep each return **0** lines over non-test
  source.
  > Measured: dependency keys ____ · ambient hits ____ · non-relative imports ____

- [ ] **NFR-4.4 (The surface, exactly):** `@nel3ab/game`'s runtime exports are exactly the seventeen of
  [specs.md](specs.md) §2.8; the nine internal names of §2.8 each exist in their module and are absent
  from the package; `Random` and every Phase 3 type are importable as types.
  > Measured: exports ____ / 17 · extra ____ · missing ____ · internal names present-in-module and
  > absent-from-package ____ / 9

---

## 5. Gate 5 — Equivalence with the prototype (blocks Gate 6)

- [ ] **REQ-4.14 (Generator fingerprint):** `mulberry32(MATCH_SEED)`'s first three draws and the
  verdict sample's sequences 0–2 reproduce Table E exactly — configurations, event counts, steps,
  matches ended and the exact oracle's final state.
  > Measured: draws ____ · sequences ____ / 3 · mismatches ____

- [ ] **REQ-4.14 (Oracle anchor — Phase 3's Table A):** the new match oracle's silent first round, at
  each of the 15 lengths, ends after Phase 3's Table A float row in `'float'` and its exact row in
  `'exact'` — including **801, 851, 901** at 80, 85, 90 s.
  > Measured: float row ____ / 15 · exact row ____ / 15

- [ ] **REQ-4.14 (Oracle against oracle):** float vs exact over every sample reproduces Table F — every
  diverging count, steps-consumed total, matches-ended count and reset count, for all 16 rows. If
  Table E matched and this does not, the harness or the oracle departs from specs.md §2.10: fix it to
  the definition; never edit Table F.
  > Measured: rows equal to Table F ____ / 16 · per row ____

- [ ] **REQ-4.14 (Scripted matches through both oracles):** both oracles produce Table G's outcome for
  all sixteen matches and agree with each other at all 15,700 events.
  > Measured: matches ____ / 16 · disagreeing events ____

- [ ] **REQ-4.14 (The engine is exact arithmetic):** engine ≡ exact oracle at every step of all sixteen
  scripted matches, all 500 verdict sequences and all 300 per-length sequences.
  > Measured: sequences ____ / 816 · steps ____ · first divergence ____

- [ ] **REQ-4.14 (The decision of 2026-09-30, measured in full matches):** engine vs **float**, per
  per-length row, diverges in exactly Table F's float-vs-exact count for that row — 11 · 1 · 0 × 7 ·
  20 × 6. The cost of exact milliseconds, restated for whole matches; informational, not a verdict.
  > Measured: per row ____ · rows equal to Table F ____ / 15

- [ ] **REQ-4.14 (Invariants):** Phase 3's I1–I10 and this phase's J1–J8 hold after every step of the
  per-length sample and of Table G.
  > Measured: states checked ____ · violations per invariant ____

- [ ] 🚦 **REQ-4.14 (A full match runs as it does in the prototype) (VERDICT GATE — no retry):** with
  the harness's engine ≡ **float** comparison on, the engine and the prototype's own floating-point
  flow produce the same observation — screen, round, both tallies, active team, both displayed clocks,
  both started flags, reveal, both indices, category, used list, judge and round log — at **every** step
  of **all 16 scripted matches of Table G** and **all 500 sequences** of the 45-second verdict sample
  (seed `0x20261002`, rates 0.02 / 0.05 / 0.1, `MATCH_MAX_STEPS` 40,000, the stop rule of specs.md
  §2.10), and every match that ends ends with the same round log. **PASS** = 0 diverging matches and
  0 diverging sequences. Evaluated once, by the test written for this box, after every box above it is
  ticked. A different seed, a smaller `n`, another rate list, another stop rule or another observation
  is a different measurement and may not replace this one.
  > Measured: scripted ____ / 16 diverging · sequences ____ / 500 diverging · steps ____ ·
  > matches ended ____ · round logs compared ____ · **verdict: PASS / FAIL** ____ · measured at ____

---

## 6. Gate 6 — Coverage, mutations and the gate commands (evaluated once, over the finished phase)

- [ ] **REQ-4.15 (Full coverage, measured on the right files):** `pnpm test` reports **100%** lines,
  branches, functions and statements over `packages/game/src`; `coverage/coverage-summary.json` lists
  `draw.ts`, `match.ts` and every Phase 3 source file by path, and nothing outside `packages/game/src`
  or inside `src/testing/`.
  > Measured: lines ____ · branches ____ · functions ____ · statements ____ · files listed ____ ·
  > outside / testing ____

- [ ] **REQ-4.15 (Assertions that bite):** each mutation below, applied alone and reverted, fails at
  least one assertion in the named place. Coverage says a line ran; this says a test would notice.

  | # | Mutation | Must be caught by |
  |---|---|---|
  | N1 | `passClock` anchors `runningSince` at `revealedAt + REVEAL_HOLD_MS` instead of `now` | Gate 3 "A late `passTurn` charges nobody" (the harness cannot see it) |
  | N2 | `passClock` gives the next team a full bank even when it has started | Gate 3 "The pass, exactly"; Table G M2, M14 |
  | N3 | `passTurn` leaves `questionIndex` unchanged | Gate 3 "The pass, exactly"; Table G M2, M11 |
  | N4 | the hold test is `>` instead of `>=` | Gate 3 "The hold"; extraction #1; Table G M2 |
  | N5 | `startingTeam` returns b for odd rounds | Gate 3 "Who starts"; extraction #2; Table G M1 |
  | N6 | `startMatch` also rotates the judge | Gate 3 rematch; extraction #4; Table G M6 |
  | N7 | `scoreRound` ignores exhaustion | Gate 3 "When a match is over"; Table G M3, M4 |
  | N8 | `scoreRound` ends the match at `>` instead of `>=` `winsNeeded` | Gate 3 "When a match is over"; Table G M1, M7 |
  | N9 | the winner is the active team — the loser | Gate 3 scoring; extraction #9; Table G M1 |
  | N10 | `nextRoundChoices` has no fallback | Gate 2 "Which categories"; Gate 3 fallback |
  | N11 | `beginRound` appends the category even when already used | Gate 3 fallback; extraction #17 |
  | N12 | `resetMatch` keeps the log | Gate 3 `resetMatch`; extraction #14; Table G M9, M15 |
  | N13 | `shuffleQuestions` inserts at `floor(r × i)` | Gate 2 "every ordering exactly once"; Table H |
  | N14 | `scoreRound` scores a round with no category | Gate 1 (Phase 3's suite); Gate 3 "not scored" |
  | N15 | `correct` does not record `revealedAt` | Gate 1 "The one new field"; Gate 3 "The hold" |
  | N16 | `drawCategory` uses `Math.round` | Gate 2 "The pick" |
  | N17 | `assertRoundPayload` runs after the inertness check | Gate 2 "A bad draw throws, in every state" |

  > Measured: N1 ____ · N2 ____ · N3 ____ · N4 ____ · N5 ____ · N6 ____ · N7 ____ · N8 ____ · N9 ____ ·
  > N10 ____ · N11 ____ · N12 ____ · N13 ____ · N14 ____ · N15 ____ · N16 ____ · N17 ____ ·
  > caught ____ / 17 · deviations from the "Must be caught by" column ____

- [ ] **REQ-4.16 (The four gate commands, no escape hatch):** on a fresh clone, `pnpm install
  --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0 on Windows
  and on this phase's pull request's Ubuntu CI (`ci` job), and §7's escape-hatch greps return the baseline
  measured at `841981a` — **5** prose lines (`CLAUDE.md` × 3, `press.module.css`, `stylelint.config.mjs`), **0**
  directives, and `skipLibCheck` in `tsconfig.base.json` only — unchanged.
  > Measured: Windows ____ / 5 · CI run ____ (`ci` ____) · escape-hatch lines ____ · directives ____

- [ ] **NFR-4.5 (Fast enough to stay in `pnpm test`):** the `@nel3ab/game` project's test duration in
  `pnpm test`, on the Windows development machine **on mains power**, is under **20 s**; the same on CI
  is recorded. If over, the overrun is recorded as a finding — no sample is shrunk.
  > Measured: Windows ____ s (power ____) · CI ____ s

- [ ] **NFR-4.1 / NFR-4.7 (Nothing outside `packages/game/src` changed):** `git diff --stat` from the
  phase's first implementation commit's parent to its final commit lists files under
  `packages/game/src/` and `specs/phase-4/verification.md` only — no `design/`, no other `specs/`
  file, no manifest, lockfile or configuration.
  > Measured: files changed ____ · outside `packages/game/src/` ____ (each named)

- [ ] **REQ-4.11 (Re-checked over the finished phase):** Gate 1's sanctioned-edits box, repeated at
  the phase's final commit.
  > Measured: lines outside §2.9 ____ · diff over the ten untouched files ____

---

## 7. Automated Commands

Written for Git Bash or the Ubuntu CI runner, as Phases 2 and 3's were.

```bash
# Gate 1 / Gate 6 — the four gate commands, in this order, from a fresh clone
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test                 # = check-collected-tests.mjs --coverage
pnpm build

# Gate 1 / Gate 6 — Phase 3's files: three edited as specs.md §2.9 says, ten untouched
git diff 841981a -- packages/game/src/room.test.ts packages/game/src/index.test.ts packages/game/src/reducer.test.ts
git diff --stat 841981a -- packages/game/src/clock.test.ts packages/game/src/purity.test.ts \
  packages/game/src/rules.test.ts packages/game/src/prototype-equivalence.test.ts packages/game/src/testing/prng.ts \
  packages/game/src/testing/sequences.ts packages/game/src/testing/prototype-oracle.ts \
  packages/game/src/testing/harness.ts packages/game/src/testing/invariants.ts packages/game/src/testing/deep-freeze.ts

# Gates 2–5 — iterate on one project (no coverage, no collected-count check)
pnpm vitest run packages/game
pnpm vitest run packages/game/src/match-equivalence.test.ts
pnpm vitest run -t "extraction"

# Gate 4 — ambient time, randomness, timers and I/O in non-test source (expect 0 lines)
grep -rnwE "Date|Math\.random|performance|setTimeout|setInterval|setImmediate|queueMicrotask|crypto|process|fetch|console" \
  packages/game/src --include=*.ts | grep -v "\.test\.ts:" | grep -v "/testing/"

# Gate 4 — non-relative imports in non-test source (expect 0 lines)
grep -rnE "from '[^.]" packages/game/src --include=*.ts | grep -v "\.test\.ts:" | grep -v "/testing/"

# Gate 6 — escape hatches (baseline at 841981a: 5 prose lines, 0 directives; skipLibCheck in tsconfig.base.json only)
git grep -nE "@ts-expect-error|@ts-ignore|eslint-disable|stylelint-disable|v8 ignore|istanbul ignore|c8 ignore" \
  -- ':!design' ':!specs' ':!pnpm-lock.yaml'
git grep -nE "skipLibCheck|pnpm\.overrides|peerDependencyRules|strict-peer" -- ':!design' ':!specs' ':!pnpm-lock.yaml' ':!*.md'

# Gate 6 — nothing outside packages/game/src changed since implementation began
git diff --stat <first-implementation-commit>^ HEAD
```

> `pnpm test` forwards extra arguments to `scripts/check-collected-tests.mjs`, which asserts that
> *every* workspace project contributed a file — so it fails on any filtered run. Iterate with
> `pnpm vitest`, gate with `pnpm test` (`CLAUDE.md`). `vitest run --dir <path>` does **not** filter.
> `pnpm test` enforces 100% coverage over `packages/game/src`; `pnpm vitest` does not.

---

## 8. Acceptance Criteria

Phase 4 is complete when **all** of the following hold:

1. **Gate 1** is green — the one new field is in place, Phase 3's tests changed only where specs.md
   §2.9 says, and Phase 3's whole suite, verdict test included, passes.
2. **Gates 2–4** are green — the draw is checked and fair, every flow action behaves as specified and
   the sixteen scripted matches reproduce Table G, the flow's numbers and formulas are read from the
   prototype at test time, the reducer is still pure and dependency-free, and the surface is exact —
   and Gate 2's 🚦 premise box returned **PASS**.
3. **Gate 5's 🚦 verdict** returned **PASS** — a full match runs as it does in the prototype — with the
   engine shown to be exact arithmetic first.
4. **Gate 6** is green — 100% coverage over the named files, all seventeen mutations caught, the four
   gate commands passing on Windows and Ubuntu CI with no escape hatch, inside the time budget.
5. Every box above is ticked **with its measured value filled in**.
6. `roadmap.md`'s Phase 4 status is updated and its "Completed Work" section records both verdicts
   with the commit they were measured at, the form Phases 1–3 set.

That is the roadmap's exit criterion — "A scripted full match runs end to end in tests and produces a
correct round log" — as criterion 3, and its last task — "Tests for a full simulated match, and for the
categories-exhausted edge case" — as Table G (M1, M3, M4, M10) inside criterion 2. No criterion appears
here for the first time.

---

## 9. What Would Make This Phase Untrustworthy

- **The oracle is a transcription of the prototype, not the prototype.** Every equivalence claim in
  Gate 5 compares the engine with code written by reading `Nel3ab - Arcade.dc.html`, by the same kind of
  reader who wrote the engine. A misreading they share — of what `endRound` reads from `this.remaining`
  inside a `setState` updater, of the order `nextRound`'s `drawCategory` applies `round` before
  `startRound` reads `startingTeam`, of whether the `setTimeout` and the `setInterval` could interleave —
  makes them agree with each other and not with the prototype. Gate 4 anchors every number and formula
  to the file itself, and Gate 5 requires the new oracle to reproduce Phase 3's Table A defects and
  Table F before it is trusted. What neither covers: the prototype was never *executed* for this phase.

- **Both sides are given the same draws.** The verdict compares everything that follows from a draw,
  not the draw's randomness: the harness hands the engine and the prototype the same category value and
  the same permutation. That a draw is uniform is shown only by Gate 2, over the helpers — and nothing
  in this phase shows that a driver *uses* them.

- **A verdict retried into green.** The ways to do it are specific and every one is forbidden in the
  gate's text: a different seed, a smaller `n` "to meet NFR-4.5", a rate list without 0.02, a stop rule
  that ends sequences earlier, a generator that never rematches, an observation with fewer fields.
  Table E's fingerprint and Table F's totals exist so that any of these shows up as a number that no
  longer matches.

- **The anchor bug the harness cannot see.** A 100 ms driver that sends `passTurn` after every tick
  makes `now`, `revealedAt + 1000` and the end of the hold the same number, so a `passClock` that
  anchors at the wrong one of them passes all of Gate 5. Only Gate 3's late-`passTurn` box catches it
  (N1).

- **100% coverage with assertions too weak to notice a break.** The seventeen named mutations exist
  because each is a plausible bug that leaves coverage at 100%. N14 in particular — scoring a round with
  no category — breaks nothing in this phase's own tests that a careless reader would expect: it is
  caught by **Phase 3's** verdict harness, whose rooms have no categories.

- **A Phase 3 test "fixed" to make Phase 4 pass.** Gate 1 and Gate 6 diff Phase 3's files against
  `841981a`. A hunk outside specs.md §2.9 is a Phase 3 rule changing silently.

- **The fallback that cannot happen.** REQ-4.3's fallback and J6's `usedCategories.length === round`
  both rest on there being no path to a draw with every category used. The fallback is tested by a
  hand-built state only. If a later phase adds such a path, the fallback becomes live and J6 stops
  holding — correctly; that phase records it.

- **Carried forward — obligations on every driver, which no test here can check.** Binding on
  **Phase 5** (the browser) and **Phase 11** (the server):
  - **Send `passTurn`.** A driver that never sends it leaves the reveal up and the game stalled. A
    driver that ticks in steps not dividing 1000 — Phase 11's wall-clock ticks — passes the turn on the
    first tick at or after 1000 ms, so the reveal can show for up to one tick longer; the next team is
    never charged for it (REQ-4.6).
  - **Draw with `drawableCategories`, `drawCategory` and `shuffleQuestions` and a real random source.**
    The engine checks that a draw is *allowed*, not that it was *random* (REQ-4.1).
  - **Never dispatch `startRound`.** It is Phase 3's primitive, kept for Phase 3's tests; its rounds are
    unscored. **Phase 11** maps the wire's `startRound` message onto `startMatch`.

- **The engine visibly disagreeing with the prototype — twice, both decided.** At 20, 25 and 65–90 s
  the clock disagrees (2026-09-30), and now in whole matches too (Table F). And for any given random
  source the question order differs, because the engine's shuffle is fair (2026-10-02). A side-by-side
  against the prototype will show both. Neither is a regression, and neither should be "fixed" by
  anyone reading only the prototype.

- **Presentation the engine leaves to Phase 7.** On a tie the prototype's winners line names team A's
  players (`s.tallyA >= s.tallyB ? 'a' : 'b'`); `matchWinner` returns `null`, and Phase 7 decides what
  the line says. The reason line, the progress line and the round log's rows are formatted there too.

- **Repeats across matches.** A rematch can draw a category the previous match played and reshuffle
  its questions, so a gathering can see a question twice. That is a content-depth problem (`mission.md`
  §7, Phase 22), not a flow rule, and this phase does not address it.

---

*Written: 2026-10-02 — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured values may be
added; gates may not be changed except by a dated planning session.*
