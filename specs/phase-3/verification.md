# Phase 3 Verification & Test Plan — Rules engine: state & clock

> **Phase:** Phase 3
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

**Gate ordering.** Gate 1 blocks everything: it probes the phase's only new dependency on the
Phase 1 shell, before any engine code exists. **Gates 2–5 are one block**: code is built in the
step order of [specs.md](specs.md) §1, and each box in the block is ticked as soon as the code it
exercises exists; the whole block must be complete before Gate 6's first box. Gate 6 holds the
exit-criterion verdict; its ordinary boxes are evaluated first, so that when the 🚦 box is evaluated
the engine has already been shown to agree with exact arithmetic and the only thing left for it to
measure is the prototype. Gate 7 is evaluated last, once, over the finished phase.

> **Correction 2026-09-30 — ordering only, made before implementation began, approved by the owner
> at the start of the first `/spec-run`.** As first written, this paragraph said Gates 2–5 "follow
> the build order of specs.md §1 and each blocks the next." They do not: the boxes are grouped by
> requirement, not by build step, so several of them exercise code that a *later* step builds —
> Gate 2's REQ-3.10 box asserts that the extracted numbers drive the reducer (specs.md STEP 4);
> Gate 3's "stopped clock" box needs `correct` (Gate 4); and every box that runs over the
> per-length sample (Gate 3's "changes only `now`", additivity and invariants; Gate 4's "no zero bank"
> and predicate agreement; Gate 5's frozen-input, determinism and spy boxes) needs specs.md STEP 6's
> sample machinery and every action. Read strictly, the original rule deadlocks a one-requirement-
> at-a-time run. **No box's content, threshold or pre-registered number was changed**; only the rule
> for when a box in Gates 2–5 may be ticked. Gates 1, 6 and 7 are unaffected.

**A tick with an empty `Measured:` line is not a tick.**

---

## Pre-registered values

Measured on 2026-09-30, before any code existed, by the planning session's own scripts. Every
number below is **fixed**: an implementation that disagrees fixes itself to match the definitions
in [specs.md](specs.md) §2.8, or — if it matches every fingerprint and still disagrees — stops and
records the disagreement. **No table in this section may be edited to match a result.**

**Table A — the prototype's silent round.** A full bank drained by ticks alone, no judge action.
"Wrong-second ticks" counts the ticks *k* = 1, 2, … after which the floating-point bank is still
above zero and `Math.ceil(bank)` ≠ ⌈(10·S − *k*) / 10⌉.

| Bank S (s) | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| float — ticks to end | 200 | 250 | 300 | 350 | 400 | 450 | 500 | 550 | 600 | 650 | 700 | 750 | **801** | **851** | **901** |
| float — wrong-second ticks | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | **29** | **54** | **80** | **85** | **90** |
| exact — ticks to end | 200 | 250 | 300 | 350 | 400 | 450 | 500 | 550 | 600 | 650 | 700 | 750 | 800 | 850 | 900 |
| exact — wrong-second ticks | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Table B — the prototype's arithmetic against exact arithmetic, in generated play.** Sequences in
which the float and exact oracles' observations differ at any consumed step, and the total steps
the harness consumed under the stop rule of [specs.md](specs.md) §2.8.

| Sample | seed | n | diverging sequences | steps consumed |
|---|---|---|---|---|
| verdict, 45 s | `0x20260930` | 10,000 | **0** | 2,422,066 |
| per-length, 20 s | `SEED + 20` | 200 | **51** | 30,373 |
| per-length, 25 s | `SEED + 25` | 200 | **1** | 34,012 |
| per-length, 30 s | `SEED + 30` | 200 | 0 | 38,528 |
| per-length, 35 s | `SEED + 35` | 200 | 0 | 42,157 |
| per-length, 40 s | `SEED + 40` | 200 | 0 | 45,306 |
| per-length, 45 s | `SEED + 45` | 200 | 0 | 51,299 |
| per-length, 50 s | `SEED + 50` | 200 | 0 | 52,582 |
| per-length, 55 s | `SEED + 55` | 200 | 0 | 54,604 |
| per-length, 60 s | `SEED + 60` | 200 | 0 | 57,798 |
| per-length, 65 s | `SEED + 65` | 200 | **165** | 59,370 |
| per-length, 70 s | `SEED + 70` | 200 | **192** | 63,901 |
| per-length, 75 s | `SEED + 75` | 200 | **193** | 62,545 |
| per-length, 80 s | `SEED + 80` | 200 | **192** | 65,081 |
| per-length, 85 s | `SEED + 85` | 200 | **191** | 72,902 |
| per-length, 90 s | `SEED + 90` | 200 | **189** | 71,514 |

**Table C — generator fingerprint.** `mulberry32(0x20260930)`'s first three draws, to 10 decimal
places: **0.6190389520 · 0.3909395928 · 0.0691457547**. The verdict sample's sequence 0 (rate 0.01,
starting team `a`) has its first six non-tick events at 0-based indices
**100 correct · 159 hint · 174 skip · 199 skip · 272 skip · 303 correct**.

**Table D — scripted 45 s scenarios.** Starting team `a`; question pool of three questions with two
hints each unless stated. *Ends at* is the 1-based index of the event after which the round has
ended. Team `b`'s display reads 45 at every step of every scenario. Both oracles produce exactly
these outcomes, and agree with each other at every step of every scenario (measured).

| # | Events | Ends at | Final `hintIndex` · `questionIndex` | What it pins down |
|---|---|---|---|---|
| S1 | 450 tick | 450 | 0 · 0 | a silent round |
| S2 | hint, 430 tick | 431 | 1 · 0 | a hint's cost |
| S3 | skip, skip, 390 tick | 392 | 0 · 2 | a skip's cost |
| S4 | 420 tick, skip | **421 — the skip** | 0 · **0** | skip spends exactly to zero; index not advanced |
| S5 | 430 tick, hint | **431 — the hint** | **0** · 0 | hint spends exactly to zero; index not advanced |
| S6 | 440 tick, skip | 441 — the skip | 0 · 0 | spend past zero; bank 0, not −2000 |
| S7 | hint, hint, hint, 410 tick | 413 | 2 · 0 | the third hint is inert and free |
| S8 | 100 tick, correct, 1000 tick, hint, skip, correct | **never** | 0 · 0 | reveal up at the end; team `a` reads 35 from the reveal onward |
| S9 | 449 tick | never | 0 · 0 | one tick from zero: live, team `a` reads **1** |
| S9′ | 450 tick | 450 | 0 · 0 | …and the next tick ends it |
| S10 | pool hints `[0, 2, 2]`: hint, skip, hint, 430 tick | 403 | 1 · 1 | a hint on a hintless question is inert |
| S11 | skip, skip, skip, 360 tick | 363 | 0 · 3 | the pool wraps: the current question is `pool[0]` again |
| S12 | 50 tick, hint, 70 tick, skip, 80 tick, hint ×3, 98 tick, skip, 1000 tick | 336 | 0 · 2 | a mixed round |

---

## 1. Gate 1 — Coverage plumbing (blocks every other gate)

The coverage provider is the only new dependency in this phase, and the only part that has to agree
with Vitest 4's multi-project configuration and the collected-tests wrapper. Probe it on the
Phase 1 shell — where 100% is trivial — before there is anything to cover.

- [x] **NFR-3.3 (Pinned exactly):** root `package.json` `devDependencies` has
  `"@vitest/coverage-v8": "4.1.10"`, character-identical to the `vitest` pin. No `^`/`~` anywhere
  in the 7 manifests; no `pnpm.overrides` or `peerDependencyRules` added; `pnpm install` reports
  **0** peer warnings; `pnpm install --frozen-lockfile` succeeds from a fresh clone.
  > Measured: provider pin `"4.1.10"` · vitest pin `"4.1.10"` · identical: **yes** (`===` on the two
  > manifest strings) · floated ranges: **0** across **7** manifests, and **0** `pnpm.overrides` /
  > `peerDependencyRules` in any manifest or in `pnpm-workspace.yaml` · peer warnings: **0** (0 lines
  > matching `peer|WARN` in the output of `pnpm add -D -w -E`, of the settling `pnpm install`, and of
  > the fresh-clone install) · frozen install from fresh clone: **succeeds** — exit 0, "Lockfile is up
  > to date", 275 packages
  > Method, 2026-09-30, Windows: `pnpm add -D -w -E @vitest/coverage-v8@4.1.10` wrote the exact string
  > itself (no hand fix needed); the follow-up `pnpm install` left the lockfile unchanged. Lockfile
  > +148 / −2 lines: **17** new package resolutions (the provider and its istanbul / `@babel/parser` /
  > `@bcoe/v8-coverage` chain), and the `vitest` snapshot re-keyed with the provider as its optional
  > peer. The provider's lockfile entry records peers `vitest: 4.1.10` and `@vitest/browser: 4.1.10`
  > with the latter under `peerDependenciesMeta` `optional: true`, as specs.md §2.10 states. Fresh
  > clone: `git clone --no-local --branch phase-3-run` of the implementation commit before these
  > ticks were amended in (pre-amend `1c7d959`; the amend adds only this file's ticks, so every
  > manifest and the lockfile are byte-identical in the final commit).

- [x] **REQ-3.12 (Wired as specified):** `scripts.test` is
  `node scripts/check-collected-tests.mjs --coverage`; `vitest.config.ts` has the `coverage` block
  of [specs.md](specs.md) §2.10 — provider `v8`, the one `include`, **exactly two** `exclude`
  entries, thresholds 100 × 4, `enabled` **not** set. `scripts/check-collected-tests.mjs` is
  unchanged (`git diff` empty). `pnpm vitest run packages/game` does **not** run coverage.
  > Measured: script `node scripts/check-collected-tests.mjs --coverage` · include
  > `['packages/game/src/**/*.ts']` (provider `v8`, reporters `text`, `json-summary`) · excludes
  > (count, list) **2** — `packages/game/src/**/*.test.ts`, `packages/game/src/testing/**` ·
  > thresholds lines 100 · branches 100 · functions 100 · statements 100 · `enabled` present: **no** ·
  > wrapper diff: **empty** (`git diff --exit-code -- scripts/check-collected-tests.mjs` exit 0) ·
  > coverage on an iteration run: **none** — with `coverage/` deleted first, `pnpm vitest run
  > packages/game` exited 0 (1 file, 1 test), printed 0 lines mentioning coverage, and created no
  > `coverage/` directory
  > The block sits under the root `test`, beside `projects`; `projects` and the `oxc` override are
  > byte-identical to before (the diff of `vitest.config.ts` is 18 added lines, 0 removed).

- [x] **REQ-3.12 (Proven to bite, on the shell):** with a temporary exported function added to
  `packages/game/src/index.ts` that no test calls, `pnpm test` **exits non-zero** and names the
  threshold; with it removed, `pnpm test` is green. *(R2 — if the threshold prints but the exit code
  is 0, this box is red and REQ-3.13 decides.)*
  > Measured: exit code with the uncovered function **1** · message `ERROR: Coverage for lines (50%)
  > does not meet global threshold (100%)`, and the same line for functions (0%) and statements
  > (50%), followed by the wrapper's `[check-collected-tests] vitest exited 1` · exit code after
  > revert **0**
  > Probe: `export function uncoveredProbe(n: number): number { return n + 1 }` appended to the shell;
  > the text reporter showed `index.ts | 50 | 100 | 0 | 50 | 7`. Branches stayed 100% (0 / 0 — the
  > probe has no branch), so three of the four thresholds fired. All 108 assertions still passed:
  > the non-zero exit came from the thresholds alone. The file was restored from a copy,
  > `git diff -- packages/game/` was empty before the green re-run, and the probe was never
  > committed. **R2 does not occur** — the threshold fails the run, it does not merely print.

- [x] **REQ-3.12 (Not vacuous):** after `pnpm test`, `coverage/coverage-summary.json` lists
  `packages/game/src/index.ts` by path, and lists **no** file outside `packages/game/src/`. A list
  of zero files means `include` resolved against the wrong root (R1): this box is red.
  > Measured: files listed **1** — `C:\Users\aalsh\Projects\nel3ab\packages\game\src\index.ts`
  > (statements 1 / 1, lines 1 / 1, functions 0 / 0, branches 0 / 0), beside the `total` key ·
  > outside `packages/game/src/`: **0**
  > **R1 does not occur:** `include` resolves against the root config's directory, not a project
  > root. Corroborated in the fresh clone of NFR-3.3's box, where `pnpm test` exited 0 and the one
  > file key was that clone's own `…\fresh\packages\game\src\index.ts`.

- [x] **NFR-3.7 (Output ignored):** `.gitignore` and `.prettierignore` each contain `coverage/`.
  After `pnpm test`, `git status --porcelain` shows nothing under `coverage/`, and
  `prettier --check .` passes.
  > Measured: `.gitignore` `coverage/` (line 14, under a one-line comment) · `.prettierignore`
  > `coverage/` (line 20, under a one-line comment) · untracked coverage files **0** —
  > `git status --porcelain -- coverage/` empty with `coverage/coverage-summary.json` on disk;
  > `git check-ignore -v` names `.gitignore:14:coverage/`; the fresh clone's status was also clean
  > after its `pnpm test` · prettier **passes** — `pnpm lint`, whose last step is
  > `prettier --check .`, ran with `coverage/coverage-summary.json` present: "All matched files use
  > Prettier code style!"

- [x] **NFR-3.4 (Six projects, with coverage on):** `pnpm test`'s `[check-collected-tests]` line
  reports **six** workspace projects, each with ≥ 1 collected file.
  > Measured: **14** file(s) across **6** project(s); per project `apps/game` 1 · `apps/web` 3 ·
  > `packages/content` 1 · `packages/game` 1 · `packages/protocol` 1 · `packages/ui` 7 — 108
  > assertions passed, 0 failed, `[check-collected-tests] OK`, with `--coverage` on. Identical to
  > the pre-change baseline run without coverage, and to the fresh clone's run.

---

## 2. Gate 2 — The state, the constructor and the prototype's numbers (block 2–5; see Gate ordering)

- [x] **REQ-3.1 (The contract, field for field):** `room.test.ts` enumerates the **22** handoff names
  of [specs.md](specs.md) §2.1's table and asserts each mapped path exists on `createRoom(…)`'s
  result; `Object.keys` of the state is **exactly** the 20 top-level keys, of `clock` exactly its 4,
  of `config` exactly its 2.
  > Measured: handoff names checked 22 / 22 · unmapped 0 · top-level keys 20 / 20 ·
  > clock keys 4 / 4 · config keys 2 / 2 · extra keys 0
  > Paths are walked by own property (`Object.hasOwn`), so an inherited name never counts as present;
  > the table's two `+` rows (`clock.now`, `clock.runningSince`) are asserted present too. The three
  > expected key sets are derived from the table's paths **and** equal the written-out lists, so a key
  > added without a table row fails. Bite check (2026-09-30, reverted): an extra top-level key in
  > `createRoom` failed this test and the initial-state test.

- [x] **REQ-3.2 (Initial state):** a room created with only `roomCode`, `teamA`, `teamB` has every
  value of [specs.md](specs.md) §2.4's table — including `clock` `{ now: 0, active: 'a',
  runningSince: null, banks: { a: { ms: 45000, started: false }, b: { ms: 45000, started: false } } }`
  and `config` `{ roundSeconds: 45, winsNeeded: 3 }`.
  > Measured: fields asserted 20 top-level (27 leaf values: 18 plain fields, `config`'s 2, `clock`'s
  > `now` / `active` / `runningSince` and both banks' `ms` / `started`) in one `toStrictEqual`, which
  > distinguishes `null` from `undefined` and rejects an added or missing key · mismatches 0
  > A second test confirms `roomCode`, `teamA` and `teamB` are passed through from the input as given.

- [x] **REQ-3.2 (Configuration range):** all **15** of 20, 25 … 90 are accepted as `roundSeconds`,
  and each accepted value yields banks of `roundSeconds × 1000`; `15, 19, 21, 44, 46, 47, 95, 0, −45,
  45.5, NaN` each throw `RangeError`. `2, 3, 4` are accepted as `winsNeeded`; `1, 5, 0, 3.5, NaN` each
  throw `RangeError`. Nothing is clamped.
  > Measured: accepted 15 / 15 and 3 / 3 · rejected 11 / 11 and 5 / 5 · error type `RangeError`
  > One `test.for` case per value (34 cases). Each accepted `roundSeconds` yields both banks
  > `{ ms: roundSeconds × 1000, started: false }`; each rejection's message names the field
  > (`roundSeconds must be one of` / `winsNeeded must be one of`) and the value (`got NaN`, `got -45`,
  > `got 45.5`, …). The case lists are written out in the test, not imported from `rules.ts`. Bite
  > check (2026-09-30, reverted): replacing the membership test with a 20–90 range check failed the
  > 21, 44, 46, 47 and 45.5 cases.

- [x] **REQ-3.10 (Numbers read from the prototype):** `rules.test.ts` extracts each of the following
  from `design/designs/Nel3ab - Arcade.dc.html` at run time, asserts its **match count**, and asserts
  it against the engine. Counts verified against the file on 2026-09-30:

  | # | Extraction | Count | Value | Asserted against |
  |---|---|---|---|---|
  | 1 | `this.spend(N)` inside `giveHint` | 1 | 2 | `HINT_COST_MS / 1000`, **and** a hint drains exactly 2000ms from a started round |
  | 2 | `this.spend(N)` inside `markSkip` | 1 | 3 | `SKIP_COST_MS / 1000`, **and** a skip drains exactly 3000ms |
  | 3 | `cur.time - D` inside `startClock` | 1 | 0.1 | with #4: the prototype drains in real time (D × 1000 = interval), **and** `tick(interval)` drains exactly `interval` ms |
  | 4 | the `setInterval` period in `startClock` | 1 | 100 | see #3 |
  | 5 | `time <= 0` | **2** | `<=` | a bank at **exactly** 0 ends the round, by tick and by spend |
  | 6 | `if(!this.clockId \|\| this.state.reveal) return;` | **3** | in `markCorrect`, `markSkip`, `giveHint` — and no other method | correct, skip and hint are each inert during a reveal and with the clock stopped |
  | 7 | in `giveHint`: the exhaustion check precedes `this.spend(2)` | 1 | order | an exhausted hint costs nothing |
  | 8 | in `giveHint`: `this.spend(2)`'s early return precedes `hintIdx: s.hintIdx + 1` | 1 | order | a round-ending hint does not advance `hintIndex` |
  | 9 | in `markSkip`: `this.spend(3)`'s early return precedes `this.nextQuestion()` | 1 | order | a round-ending skip does not advance `questionIndex` |
  | 10 | `reveal:{answer:q.a, fact:q.f` | 1 | `a`, `f` | the reveal carries the question's `a` and `f` |
  | 11 | `Math.ceil(s.a.time)`, `Math.ceil(s.b.time)` | **2** | ceil | `displaySeconds` rounds up |
  | 12 | `data-props` → `roundSeconds` | 1 | default 45, min 20, max 90, step 5 | `ROUND_SECONDS_DEFAULT`; `ROUND_SECONDS_OPTIONS` equals the list min…max by step |
  | 13 | `data-props` → `winsNeeded` | 1 | default `"3"`, options `["2","3","4"]` | `WINS_NEEDED_DEFAULT`; `WINS_NEEDED_OPTIONS` |

  And from `design/user-stories.md`'s numeric rules (lines beginning `- **`): **4** values —
  `45s`, `−2s`, `−3s`, `3` — against `ROUND_SECONDS_DEFAULT`, `HINT_COST_MS`, `SKIP_COST_MS`,
  `WINS_NEEDED_DEFAULT`. (The minus sign in that file is U+2212, not a hyphen.)
  > Measured: extractions found **13** / 13 (+ **4** / 4) · count mismatches **0** · value mismatches **0**
  > As found (count × value): #1 1 × `2` · #2 1 × `3` · #3 1 × `0.1` · #4 1 × `100` · #5 2 × `<=`, one
  > in `startClock` (the tick) and one in `spend` · #6 3, one each in `markCorrect`, `markSkip`,
  > `giveHint`; all 3 file-wide occurrences lie inside a class member and the other 32 of its 35 members
  > hold none · #7, #8, #9 each landmark 1, in the table's order · #10 1 × `q.a`, `q.f` · #11 2 × `ceil`
  > (teams `a`, `b`) · #12 1 × default 45, min 20, max 90, step 5 · #13 1 × default `"3"`, options
  > `["2","3","4"]` · user stories: 4 `- **` lines, `45s`, `−2s`, `−3s` (U+2212), `3`, each matched to
  > its rule by the line's own words, not its position.
  > Against the engine, each driven by the extracted value: a hint drains 2,000 ms and a skip 3,000 ms;
  > 0.1 × 1000 = 100, `tick(100)` drains 100 ms and the 450th ends a 45 s round; exactly 0 ends the round
  > by tick and by spend (hint at 2,000 ms, skip at 3,000 ms left; 1 ms more stays live); correct, skip,
  > hint inert 9 / 9 (reveal, setup, round end) against a live-round control; an exhausted hint is inert
  > even at exactly its cost; a round-ending hint / skip leaves `hintIndex` / `questionIndex` at 1; the
  > reveal is `{ answer: q.a, fact: q.f }`; `displaySeconds` equals `Math.ceil(ms / 1000)` at 1,810 / 1,810
  > points; `createRoom` defaults to 45 / 3, accepts 15 / 15 and 3 / 3, rejects 15, 95, 44, 46 and 1, 5.
  > `data-props` is decoded (`&quot;`, its only entity) and `JSON.parse`d; only the key counts are read
  > off the decoded text. The tally is one `toStrictEqual`. `rules.test.ts`: 40 tests, readers checked
  > first (1 script element, 1 class, 1 `data-props`, 35 members partitioning the class body).

- [x] **REQ-3.10 (Proven to bite):** changing `HINT_COST_MS` to `2100` fails `rules.test.ts` on
  extraction #1; changing it back is green.
  > Measured: failing test **`extraction #1: HINT_COST_MS / 1000 is giveHint’s spend, and a hint drains
  > exactly spend × 1000 ms`** (3 of 40 failed; the other two: the user story's `−2s`, and extraction #5's
  > "1 ms above the cost stays live") · message `AssertionError: expected 2.1 to be 2 // Object.is
  > equality` · green after revert **yes** — `rules.ts` restored from a copy, byte-identical (SHA-256
  > `a37fcb91…3a970a3e` before and after, `git diff` empty), `pnpm vitest run packages/game` 5 files,
  > 192 tests passed

- [x] **REQ-3.9 (Display, exhaustively):** for every integer `ms` in 0 … 90,000,
  `displaySeconds(ms) === Math.floor((ms + 999) / 1000)`. At the edges: 0→0, 1→1, 999→1, 1000→1,
  1001→2, 44,001→45, 45,000→45. For −1, −999, −1000 and −10⁹ the result is `+0`, asserted with
  `Object.is(…, 0)`. `NaN`, `Infinity` and `−Infinity` each throw `RangeError`.
  > Measured: values checked 90,001 / 90,001 · mismatches 0 · edges 7 / 7 · negatives
  > `Object.is` 0 4 / 4 · non-finite throws 3 / 3
  > `clock.test.ts`, 17 tests: the exhaustive loop counts every value and compares with `Object.is`,
  > then asserts `{ checked: 90001, mismatches: 0, first: [] }` in one `toStrictEqual`; one `test.for`
  > case per edge, negative and non-finite value, each non-finite throw also naming the value
  > (`got NaN`). The test also shows the clamp is not vacuous: `Math.ceil(-1 / 1000)` is `-0`.
  > Bite checks (2026-09-30, each reverted, `clock.ts` restored byte-identical and the suite green):
  > `Math.ceil` → `Math.round` (mutation M8) failed the exhaustive test with **44,910** mismatches
  > (first `[1, 0, 1]`) and the 1→1, 1001→2, 44,001→45 edges; dropping `Math.max(0, …)` failed all
  > 4 negatives; dropping the finite guard failed all 3 non-finite cases.

- [x] **REQ-3.6 (Current question):** `currentQuestion` returns `null` on an empty pool (a fresh
  room), and `pool[i mod n]` otherwise — for a pool of 3, indices 0…6 yield entries 0,1,2,0,1,2,0.
  > Measured: empty pool `null` (a fresh room at index 0, and the same room at index 4) · wrap
  > sequence 0, 1, 2, 0, 1, 2, 0 — by identity (`pool.indexOf` of the returned object), over states
  > built by spreading a created room with a synthetic three-question pool
  > `room.ts` alone under `pnpm test`: statements 12 / 12, branches 10 / 10, functions 3 / 3,
  > lines 11 / 11 — both sides of `?? null` reached, with no `!`.

---

## 3. Gate 3 — The clock (block 2–5; see Gate ordering)

- [x] **REQ-3.5 (Starting a round):** from a fresh room at `now = 0`, `startRound('a', pool)` yields
  `screen 'play'`, `clock.active 'a'`, `clock.runningSince` **equal to `0`** (the value zero — not
  `null`, not "falsy-but-fine"), banks `a { 45000, started: true }` and `b { 45000, started: false }`,
  `questionPool` the given pool, both indices 0, `reveal null`; and `round`, `tallyA`, `tallyB`,
  `log`, `categoryId`, `usedCategories` unchanged. The same with `'b'`. After **one** `tick(100)`,
  `remainingMs(clock, 'a')` is **44,900** — the round started at engine time zero really runs.
  > Measured: fields asserted (a) 20 / 20 top-level in one `toStrictEqual` against the fresh room with
  > the six started-round fields replaced (so the other 14, the six Phase 4 fields among them, are
  > asserted unchanged), mismatches 0 · (b) 20 / 20, the same, with bank `b` started and `a` not ·
  > `runningSince` **0** (`toBe`, i.e. `Object.is` — not `null`); `questionPool` is the given array
  > by identity · remaining after one tick **44,900** for the starting team, **45,000** for the
  > other, both teams; `acceptsJudgeActions` `true`
  > `reducer.test.ts`. A second test starts a round from a hand-built `roundEnd` state at
  > `now = 60,000` with `roundSeconds 20`, round 2, a tally, a log entry, a category and non-zero
  > indices: `runningSince` 60,000, both banks **20,000** (milliseconds, not seconds), indices 0,
  > round / tallies / log / `categoryId` / `usedCategories` unchanged, and 19,900 after one tick.

- [x] **REQ-3.5 / REQ-3.3 (Start is inert in play, malformed start throws):** `startRound` while
  `screen === 'play'` returns the **same object** (`toBe`), including while a reveal is up.
  `startRound` with `questions: []` and with `startingTeam: 'c'` each throw `RangeError` — in `setup`
  and in `play` alike (validation precedes inertness).
  > Measured: inert in play **same object** (for `startRound('b')` and for `startRound('a', [another
  > question])`) · inert in reveal **same object** (reveal raised by `correct`, screen still `play`) ·
  > empty pool throws **RangeError** (setup) **RangeError** (play) · bad team throws **RangeError**
  > (setup) **RangeError** (play)
  > Each throw also asserts its message (`got an empty array`, `startingTeam 'a' or 'b'; got c`). A
  > third malformed start, `questions` missing (not an array), throws `RangeError` (`got undefined`)
  > in both screens too: 6 / 6 cases.

- [x] **REQ-3.4 (Only the active bank drains):** after `k` × `tick(100)` for k = 1 … 449 from a
  started round, `remainingMs(active) = 45,000 − 100k` exactly and the inactive bank is deep-equal
  to its value at the start.
  > Measured: k checked **449 / 449** · mismatches **0** · inactive bank changes **0** — for each
  > starting team (`a` and `b`, 898 steps in all), counted in the loop and asserted in one
  > `toStrictEqual`; the round is still `play` after step 449
  > "Inactive bank changes" counts a step at which the inactive bank's stored `ms` or `started`
  > differs from the start **or** `remainingMs(clock, inactive)` is not 45,000 — so elapsed time
  > applied to the inactive team (mutation M6) is caught here, not only a write to its bank.

- [x] **REQ-3.4 (A tick that does not end the round changes only `now`):** for every tick in the
  per-length sample and the scripted scenarios that does not end a round, the next state equals the
  previous one with `clock.now` replaced by `now + ms` — deep-equal, nothing else different.
  > Measured: ticks checked **782,962** · violations **0**
  > `purity.test.ts`. Of 783,825 ticks consumed — 3,000 per-length sequences (801,972 events under
  > §2.8's stop rule) and the 13 Table D scenarios (7,082 events, each consumed in full) — the 863
  > that end a round are excluded, classified from the state *before* the tick by the bank arithmetic
  > written out in the test, not by what the reducer returned. Each checked tick's result deep-equals
  > the previous state with only `clock.now` + 100. Bite check (2026-09-30, reverted): a non-ending
  > tick that also advanced `questionIndex` flagged 782,962 / 782,962.

- [x] **REQ-3.4 (Additivity):** for every state visited in the 45 s per-length sample, and a pair
  `(a, b)` drawn uniformly from 0 … 3000 each by `mulberry32(SEED + 1)` in visiting order,
  `reduce(reduce(s, tick a), tick b)` deep-equals `reduce(s, tick (a + b))` — including when the
  pair crosses zero.
  > Measured: states checked **51,699** · of which crossing zero **1,962** (1,016 of them with the
  > zero falling between the two ticks) · violations **0**
  > States: every state the 200 runs visit — the fresh room, the started round, and the state after
  > each of the 51,299 consumed events. `a` then `b` = `Math.floor(rand() × 3001)` per state.
  > "Crossing zero": a running clock whose remaining time is ≤ `a + b`. Bite check (2026-09-30,
  > reverted): testing zero against the pre-tick `now` gave 925 violations.

- [x] **REQ-3.4 / REQ-3.7 (Zero crossing ends the round in the same step):** from a fresh 45 s round,
  `tick(45000)` and `tick(45001)` each yield, in **one** step, `screen 'roundEnd'`, active bank
  `ms 0` (not −1), `runningSince null`, and `clock.now` 45,000 / 45,001 respectively. `tick(44999)`
  yields a live round with 1ms left and `displaySeconds` **1**.
  > Measured: 45000 **one step → `roundEnd`, active bank 0, `runningSince` null, `now` 45,000** ·
  > 45001 **one step → `roundEnd`, active bank 0 (not −1), `runningSince` null, `now` 45,001** ·
  > 44999 **live (`play`), 1 ms left, `displaySeconds` 1**, the state otherwise the started one with
  > only `now` replaced
  > Each round-end result is one `toStrictEqual` against the started state with `screen` and `clock`
  > replaced, so `reveal` null, indices, `active` (the team whose bank emptied) and the other bank are
  > asserted unchanged. The two round-ending ticks are run for each starting team (4 / 4).

- [x] **REQ-3.3 (Malformed ticks throw; a zero tick is inert):** `tick` with `−1`, `1.5`, `NaN`,
  `Infinity`, `2**53`, and an `ms` for which `now + ms` is not a safe integer each throw `RangeError`,
  in `setup`, `play` and `roundEnd`. `tick(0)` returns the **same object**.
  > Measured: throws **18 / 18** `RangeError`, each message naming the value (`got …`) · `tick(0)`
  > same object **yes** — in `setup`, `play`, `roundEnd`, and with a reveal up (4 / 4)
  > Every state has `now > 0` (setup after one tick, play after one tick, roundEnd at 45,000), so the
  > sixth value, `Number.MAX_SAFE_INTEGER − now + 1`, is itself a non-negative safe integer (asserted)
  > whose sum with `now` is not — it isolates the engine-time check.

- [x] **REQ-3.4 (A stopped clock drains nothing):** ticks in `setup`, after a round end and during a
  reveal leave both banks deep-equal and advance only `clock.now`.
  > Measured: setup **banks deep-equal, only `now` advanced** · roundEnd **the same** · reveal (raised
  > by `correct`) **the same** — each after 50 × `tick(100)` and one `tick(1,000,000)`: the result
  > `toStrictEqual`s the input with `clock.now` + 1,005,000, and both teams' `remainingMs` are
  > unchanged

- [x] **Invariants I1–I10 hold at every step:** `assertInvariants` ([specs.md](specs.md) §2.8) passes
  after every step of every sequence of the per-length sample and every scripted scenario.
  > Measured: states checked **815,080** · violations **0** (by invariant: I1 0 · I2 0 · I3 0 · I4 0 ·
  > I5 0 · I6 0 · I7 0 · I8 0 · I9 0 · I10 0)
  > States: for each of the 3,013 runs, the fresh room, the started round and the state after every
  > consumed event (809,054 events). `assertInvariants(state, prev)` gets `prev` at every step; I7
  > is skipped only on the `startRound` step (the one transition into `play`). The stop rule is
  > timed by the engine's own terminality until the exact oracle exists (`testing/harness.ts`); per
  > per-length row the steps consumed equal Table B's column (informational — Gate 6 measures it).
  > Bite check (2026-09-30, reverted): testing zero against the pre-tick `now` gave I5 967, I10 865.

---

## 4. Gate 4 — The judge's actions (block 2–5; see Gate ordering)

- [x] **REQ-3.6 (Hint):** in a live round, `hint` drains exactly 2,000ms and advances `hintIndex` by
  one. On a two-hint question the third `hint` returns the **same object** and costs nothing. On a
  question whose `h` is empty, the first `hint` returns the same object.
  > Measured: drain **2,000** ms (41,300 → 39,300 at `now` 3,700, re-anchored there) · index **0 → 1**
  > · third hint same object **yes** (bank stays 41,000, `hintIndex` 2) · hintless same object **yes**
  > The drain is one `toStrictEqual` of the whole next state (bank, `runningSince`, `hintIndex`
  > replaced; nothing else different).

- [x] **REQ-3.6 (Skip):** in a live round, `skip` drains exactly 3,000ms, advances `questionIndex` by
  one and resets `hintIndex` to 0. On a pool of three, the third skip makes `currentQuestion` the
  pool's first entry again.
  > Measured: drain **3,000** ms (38,000 → 35,000 at `now` 5,000, re-anchored from 3,700 to 5,000) ·
  > indices `questionIndex` **0 → 1**, `hintIndex` **1 → 0** · wrap **yes** — current question after
  > 0, 1, 2, 3 skips is pool entry 0, 1, 2, **0** (by identity), `questionIndex` 3

- [x] **REQ-3.4 / REQ-3.6 (A spend re-anchors the clock):** from a fresh 45 s round: 100 × `tick(100)`,
  `hint`, 100 × `tick(100)` leaves exactly **23,000ms** (45,000 − 10,000 − 2,000 − 10,000); the same
  with `skip` leaves exactly **22,000ms**. *(This is the box a missing re-anchor fails — mutation M2.)*
  > Measured: after hint **23,000** ms · after skip **22,000** ms — both at `now` 20,000, still `play`
  > Bite check (2026-09-30, reverted): dropping `runningSince: clock.now` from the spend (M2) failed
  > both cases.

- [x] **REQ-3.7 (Exactly zero, past zero, and one millisecond above):** with the active bank at
  exactly 3,000ms, `skip` ends the round in that step with `questionIndex` unchanged; at exactly
  2,000ms, `hint` ends it with `hintIndex` unchanged; at 1,000ms, `skip` ends it with the bank at
  **0**, not −2,000; at 3,001ms, `skip` leaves a **live** round with 1ms and `displaySeconds` 1.
  > Measured: skip at 3000 **ends the round in that step, `questionIndex` stays 1** · hint at 2000
  > **ends it, `hintIndex` stays 1** · skip at 1000 → bank **0** · skip at 3001 **live, 1 ms,
  > `displaySeconds` 1, `questionIndex` 1**
  > Each index was made 1 by an earlier spend, so "unchanged" is not "still 0". Every round end is
  > one `toStrictEqual` against the pre-spend state with only `screen` → `roundEnd`, the active bank
  > → 0 and `runningSince` → null. Also: a hint at 1,000 ms leaves the bank at 0, and with team `b`
  > active a skip at 3,000 ends the round on `b`'s bank with `a`'s untouched.

- [x] **REQ-3.7 (No zero bank in play):** across every state visited in Gate 3's invariant box, no
  state has `screen 'play'` with `remainingMs(active) === 0` (invariant I5, reported separately).
  > Measured: states **815,080** · violations **0**
  > Its own test in `purity.test.ts`, over the same states as Gate 3's invariant box. Bite check
  > (2026-09-30, reverted): testing zero against the pre-tick `now` gave 967.

- [x] **REQ-3.8 (Correct raises the reveal and stops the clock):** in a live round, `correct` yields
  `reveal = { answer: q.a, fact: q.f }` of the current question, `runningSince null`, the active bank
  settled to exactly its remaining time, and nothing else changed. Then 1,000 × `tick(100)` drain
  **nothing** and advance `clock.now` by 100,000.
  > Measured: reveal **`{ answer, fact }` of the current question** (question 1 of the pool, after a
  > skip — `a` and `f` by value) · bank settled to **38,300** ms (its remaining time at `now` 3,700),
  > `runningSince` null, nothing else changed (one `toStrictEqual`) · drained during reveal **0** ms
  > (team `a` 38,300, team `b` 45,000) · `now` advanced **100,000** (the state after 1,000 ticks
  > equals the reveal state with only `clock.now` replaced)

- [x] **REQ-3.8 (Inert during a reveal and with the clock stopped):** `hint`, `skip` and `correct` each
  return the **same object** (a) during a reveal — so a double-tapped `correct` scores nothing twice —
  (b) in `setup`, (c) after a round end, and (d) in a hand-built state with a running clock **and** a
  reveal (the defence of [specs.md](specs.md) §2.4), and (e) in a hand-built `play` state with an
  empty pool.
  > Measured: 3 actions × 5 states = **15 / 15** same object
  > States: (a) a reveal raised by `correct`; (b) a fresh room; (c) after `tick(45000)`; (d) a live
  > round after a hint (`runningSince` 1,000, a hint still available) with a reveal added by hand;
  > (e) a live round with `questionPool` replaced by `[]`. `acceptsJudgeActions` is `false` in all
  > 5; control: in a live round it is `true` and hint, skip and correct each return a new object.

- [x] **REQ-3.8 (The exported predicate and the reducer agree):** for every state visited in the
  per-length sample and the scripted scenarios, `acceptsJudgeActions(s)` is `false` **if and only if**
  `skip` and `correct` both return the same object; and whenever it is `false`, `hint` does too.
  > Measured: states **815,080** · disagreements **0**
  > The same states as Gate 3's invariant box; `skip`, `correct` and `hint` each reduced from every
  > one. Bite check (2026-09-30, reverted): `acceptsJudgeActions` as `screen === 'play'` gave 89,438.

---

## 5. Gate 5 — Purity and the public surface (block 2–5; the block blocks Gate 6)

- [x] **REQ-3.3 (Never mutates its input):** every `(state, action)` pair in the per-length sample and
  the scripted scenarios is deep-frozen before `reduce` is called. **0** `TypeError`s.
  > Measured: calls on frozen input **812,067** `(state, action)` pairs, each deep-frozen (state and
  > action) and then reduced twice — 1,624,134 `reduce` calls · TypeErrors **0**
  > Pairs = the `startRound` and every consumed event of the 3,013 runs (815,080 states − 3,013 fresh
  > rooms). The checks' own further `reduce` calls on those frozen states (three per state for the
  > predicate box, the additivity ticks) pass the same TypeError guard: 0 there too. Bite check
  > (2026-09-30, reverted): a tick writing `clock.now` in place gave 3,013 TypeErrors ("Cannot
  > assign to read only property 'now'"), one per run.

- [x] **REQ-3.3 (Deterministic):** every such call is made twice; the two results are deep-equal.
  > Measured: pairs **812,067** · differences **0**
  > Compared by a structural deep-equal with `toStrictEqual`'s strictness (`Object.is` on
  > primitives, prototypes and own keys) in `testing/invariants.ts`.

- [x] **REQ-3.3 (No ambient time, randomness or timers — at run time):** with `Date.now`,
  `Math.random`, `performance.now`, `setTimeout` and `setInterval` each replaced by a spy that
  **throws**, the 45 s per-length sample and all scripted scenarios run through `reduce`,
  `createRoom`, `remainingMs`, `displaySeconds`, `currentQuestion` and `acceptsJudgeActions` with
  **0** spy calls.
  > Measured: calls made **411,649** — `reduce` 58,594 · `createRoom` 213 · `remainingMs` 117,614 ·
  > `displaySeconds` 117,614 · `currentQuestion` 58,807 · `acceptsJudgeActions` 58,807, over 213
  > runs (200 sequences, 13 scenarios; 58,381 events, 58,807 states) · spy invocations **0**
  > (`Date.now` 0 · `Math.random` 0 · `performance.now` 0 · `setTimeout` 0 · `setInterval` 0)
  > Each count is asserted equal to what the runs imply, so the whole workload ran under the spies.
  > Control: after the runs, each of the 5 spies throws when called (5 / 5 live); all 5 restored in a
  > `finally`. Bite check (2026-09-30, reverted): `Date.now()` in `reduce`'s tick case failed the
  > test with "Date.now was called during a run of the engine".

- [x] **REQ-3.3 (… and in the source):** the grep of §7 over non-test, non-`testing/` source under
  `packages/game/src/` for `Date`, `Math.random`, `performance`, `setTimeout`, `setInterval`,
  `setImmediate`, `queueMicrotask`, `crypto`, `process`, `fetch`, `console` finds **0** occurrences
  in code. Any occurrence inside a comment is listed here and classified, not filtered away.
  > Measured: hits in code **0** · hits in comments **0** (listed: none — the grep printed no line)
  > The word-boundary grep as written in §8 (the box's "§7"), over the 6 files it covers — `clock.ts`,
  > `index.ts`, `reducer.ts`, `room.ts`, `rules.ts`, `types.ts`; no `testing/` exists yet. A broader
  > case-insensitive substring sweep of the same files, with no word boundaries, finds 3 comment
  > lines and 0 code lines, none a hit of the gate's pattern, all prose: `index.ts:6` and
  > `reducer.ts:5` ("random number", stating the purity rule) and `room.ts:45` ("unvalidated").

- [x] **NFR-3.2 (Dependency-free):** `packages/game/package.json` has no `dependencies`,
  `devDependencies` or `peerDependencies` key; every `import … from` in non-test, non-`testing/`
  source under `packages/game/src/` is a relative path.
  > Measured: dependency keys **0** · non-relative imports **0**
  > The manifest's keys are `name`, `version`, `private`, `type`, `main`, `types`, `exports`,
  > `scripts` (no `optionalDependencies` either), unchanged since the phase plan (`git diff b7c46e0`
  > empty). §8's import grep printed nothing; all 13 `import`/`export … from` statements in the 6
  > files are `./`-relative (`clock.ts` 1, `index.ts` 5, `reducer.ts` 4, `room.ts` 3), and there is no
  > `import(` or `require(`.

- [x] **NFR-3.5 (Exact public surface):** `index.test.ts` asserts the sorted `Object.keys` of the
  package equal the **12** names of [specs.md](specs.md) §2.6 exactly; `PLACEHOLDER` is absent; no
  export comes from `clock.ts`'s internal table or from `testing/`.
  > Measured: runtime exports **12** / 12 · extra **0** · missing **0** · `PLACEHOLDER` present **no**
  > `index.test.ts`, 4 tests: the sorted keys `toStrictEqual` the 12 names written out; the `typeof`
  > of every export in one `toStrictEqual` (6 `function`, 4 `number`, 2 `object` — the option lists);
  > `'PLACEHOLDER' in game` is `false`; `roundMs`, `startClock`, `settleActive`, `stopClock`,
  > `zeroActive` and room.ts's `liveQuestion` are each present in their own module and absent from the
  > package (6 / 6). No `testing/` exists; the exact list admits nothing from it. Types: all 14 of
  > §2.1 are `export type`d — a scratch file outside the repo importing all 14 through
  > `packages/game/src/index.js` typechecks (exit 0), and a control importing `roundMs` fails TS2305.
  > Bite checks (2026-09-30, each reverted, `index.ts` SHA-256 identical after): leaking `roundMs`
  > failed 3 of 4 tests; restoring `PLACEHOLDER` failed 3 of 4; dropping `remainingMs` failed 2 of 4.

- [x] **NFR-3.4 (The two broken tests were updated, not deleted):** `packages/game/src/index.test.ts`
  and `apps/game/src/index.test.ts` both exist and pass; the latter imports `createRoom` from
  `@nel3ab/game` and still asserts that `@nel3ab/protocol` and `@nel3ab/content` resolve.
  `apps/game/src/index.ts` is unchanged.
  > Measured: both present **yes** · both pass **yes** — 4 tests and 2 tests, inside `pnpm test`'s 18
  > files across 6 projects (`packages/game` 5 files, `apps/game` 1) · `apps/game/src/index.ts` diff
  > **empty** (`git diff --exit-code` exit 0)
  > The apps/game test now asserts `[typeof createRoom, PROTOCOL, CONTENT]` equals
  > `['function', true, true]`; its name and its shell-export test are unchanged, and
  > `packages/protocol`, `packages/content` and both app/package manifests have empty diffs.

---

## 6. Gate 6 — Equivalence with the prototype (blocks Gate 7)

The ordinary boxes come first and in this order: they prove that the generator, the two oracles and
the harness reproduce the planning measurement *before* the engine is judged against any of them.

- [x] **REQ-3.11 (Generator fingerprint):** `mulberry32(SEED)` and the verdict sample's sequence 0
  reproduce Table C exactly.
  > Measured: first three draws **0.6190389520 · 0.3909395928 · 0.0691457547** (`toFixed(10)` of
  > 0.6190389520488679, 0.3909395928494632, 0.06914575467817485) · sequence 0 first six non-tick
  > events **100 correct · 159 hint · 174 skip · 199 skip · 272 skip · 303 correct** (rate 0.01,
  > starting team `a`)
  > `prototype-equivalence.test.ts`: one `toStrictEqual` against Table C written out, with `SEED`
  > asserted to be `0x20260930`; sequence 0 is the first yielded by `sequences(VERDICT_SAMPLE)`, the
  > sample's shared generator.

- [x] **REQ-3.11 (Oracle anchors):** the float oracle reproduces **every** float row of Table A —
  including the one-tick-late ends at 80, 85 and 90 s and the wrong-second counts at 65–90 s — and the
  exact oracle every exact row. An oracle that does not reproduce the prototype's known defects is not
  transcribing the prototype (R3).
  > Measured: float rows matched **30** / 30 · exact rows matched **30** / 30
  > Float: ticks to end 200 … 750 at 20–75 s and **801 · 851 · 901** at 80 · 85 · 90 s; wrong-second
  > ticks 0 at 20–60 s and **4 · 29 · 54 · 80 · 85 · 90** at 65–90 s. Exact: ticks to end 10·S at every
  > length; wrong-second ticks 0 everywhere. `testing/prototype-oracle.ts`, one function with the two
  > arithmetics of specs.md §2.8, driven by 'tick' alone from a full bank; a wrong-second tick is one
  > after which the oracle's own bank is still above zero and its displayed second is not
  > `Math.ceil((10·S − k) / 10)` — the definition above Table A. Bite check (2026-09-30, reverted): a
  > float display that rounds its drift away (`Math.ceil(Math.round(v * 10) / 10)`) matched 24 / 30,
  > the six non-zero wrong-second counts going to 0.

- [x] **REQ-3.11 (Oracle against oracle):** the float and exact oracles, run through the harness,
  reproduce Table B — every diverging-sequence count and every steps-consumed total, for all 16
  rows. If Table C matched and this does not, the harness departs from [specs.md](specs.md) §2.8: fix
  the harness, never the table. If the harness is shown to match §2.8 and the numbers still differ,
  **stop and record** — the planning measurement itself was wrong, and the verdict below would rest
  on it.
  > Measured: rows matched **16** / 16 · diverging counts **0** (verdict) · 51 · 1 · 0 · 0 · 0 · 0 · 0 ·
  > 0 · 0 · 165 · 192 · 193 · 192 · 191 · 189 (per-length, 20 … 90 s) · steps consumed **2,422,066**
  > (verdict) · 30,373 · 34,012 · 38,528 · 42,157 · 45,306 · 51,299 · 52,582 · 54,604 · 57,798 · 59,370 ·
  > 63,901 · 62,545 · 65,081 · 72,902 · 71,514 — every value equal to Table B's.
  > 13,000 sequences (10,000 + 15 × 200), each run once through `testing/harness.ts`, the two oracles
  > in lockstep, with the stop rule timed by the **exact oracle's** first terminal step as §2.8
  > specifies (this commit switches the trigger from the engine stand-in used until the oracle
  > existed). Bite checks (2026-09-30, each reverted): timing the stop rule by the float oracle instead
  > matched 11 / 16 rows; consuming `TAIL` + 1 events after the trigger matched 0 / 16.

- [x] **REQ-3.4 (The engine is exact arithmetic):** across the 13 scripted scenarios, all 3,000
  per-length sequences and all 10,000 verdict sequences, the engine's observation equals the **exact**
  oracle's at every consumed step, and the losing team is the same in every sequence that ends. This
  is the engine's correctness box: a failure here is an engine bug — fix it before anything below.
  > Measured: sequences **13,013** (13 scenarios + 3,000 per-length + 10,000 verdict) · steps
  > **3,231,120** (7,082 + 801,972 + 2,422,066, each one compared) · diverging sequences **0**
  > (scenarios 0, per-length 0, verdict 0) · loser mismatches **0**, over 5,694 sequences whose round
  > ends (11 scenarios, 1,266 per-length, 4,417 verdict)
  > After every consumed event the engine's observation — `displaySeconds(remainingMs(…))` for each
  > team, `screen === 'roundEnd'`, `reveal !== null` and the two indices — is compared entry by entry
  > (`Object.is`) with the exact oracle's. No engine change was needed: `reducer.ts`, `clock.ts`,
  > `room.ts`, `rules.ts`, `types.ts` and `index.ts` have empty diffs. Bite check (2026-09-30,
  > reverted): a `skip` that kept `hintIndex` instead of resetting it failed this box and Table D's.

- [x] **REQ-3.11 (Scripted scenarios):** the engine reproduces Table D exactly — the step at which
  each round ends, the final indices, and team `b` reading 45 throughout.
  > Measured: scenarios matched **13** / 13 (S1–S12 with S9′)
  > Ends at 450 · 431 · 392 · 421 · 431 · 441 · 413 · never · never · 450 · 403 · 363 · 336; final
  > indices as the table; team `b` reads 45 at every state from the started round on, in all 13. From
  > the table's last column as well: S8 ends with the reveal up and team `a` reading 35 at every state
  > from the reveal on; S9 is live with team `a` reading 1; each of the 11 rounds that end leaves its
  > bank at exactly 0. Every scenario is consumed in full (7,082 events — S8's final hint, skip and
  > correct come 1,000 ticks after its reveal). The exact oracle, run alone through each scenario,
  > reproduces the same 13 rows. The float oracle is not stepped on any scenario.

- [x] **REQ-3.4 (The decision's cost, recorded):** the engine's diverging-sequence count against the
  **float** oracle, per per-length row, equals Table B's float-vs-exact count for that row — the cost
  of the owner's 2026-09-30 decision, measured on the engine itself rather than on a stand-in.
  > Measured: 20 **51** · 25 **1** · 30 **0** · 35 **0** · 40 **0** · 45 **0** · 50 **0** · 55 **0** ·
  > 60 **0** · 65 **165** · 70 **192** · 75 **193** · 80 **192** · 85 **191** · 90 **189** · rows equal to Table B **15** / 15
  > Per-length sample only (`SEED + roundSeconds`, 200 each). In every row the diverging sequences are
  > the same ones, by index, as the float-vs-exact ones of the "Oracle against oracle" box: the engine
  > departs from the prototype's arithmetic exactly where exact arithmetic does. The verdict sample and
  > the scripted scenarios were not compared with the float oracle.

- [x] 🚦 **REQ-3.11 (A 45-second round ends as it does in the prototype) (VERDICT GATE — no retry):**
  with every box above in this gate ticked, the engine and the **float** oracle — the prototype's
  arithmetic as it actually computes, rounding error included — produce identical observations at
  every consumed step, and the same losing team, in **all 13 scripted scenarios of Table D** and
  **all 10,000 sequences** of the verdict sample.
  **PASS:** 0 diverging sequences, 0 diverging scenarios. Expected, from the pre-measurement: 0.
  **FAIL:** 1 or more. A FAIL means the prototype's floating-point drift is reachable in realistic
  play at the default length, so REQ-3.4's recorded cost ("0 of 70,000 at 45 s") is wrong and the
  decision was taken on a false premise. **The phase halts.** Record the index of every diverging
  sequence, its first diverging step and both observations there; REQ-3.4 returns to the owner.
  The gate is **not** re-run with a different seed, sample size, rate list, event mix, question pool,
  tail length or stop rule, and the engine is **not** changed to reproduce the drift.
  > Measured: scenarios diverging **0** / 13 · sequences diverging **0** / 10,000 · steps compared
  > **2,429,148** · loser mismatches **0** · **VERDICT: PASS**
  > Steps: 7,082 (the 13 scenarios, each consumed in full) + 2,422,066 (the 10,000 verdict sequences
  > under §2.8's stop rule, timed by the exact oracle — equal to Table B's row 1), the engine's
  > observation compared entry by entry (`Object.is`) with the float oracle's after every one. Losers
  > compared over the rounds that end — 11 scenarios, 4,417 verdict sequences — the same team in every
  > one. Evaluated **once**, 2026-09-30, by the last describe block of `prototype-equivalence.test.ts`
  > ("🚦 Gate 6 — REQ-3.11 verdict …", harness `engineVsFloat` on), in the first and only run that
  > produced its counts: `pnpm vitest run packages/game/src/prototype-equivalence.test.ts`, 7 / 7 tests
  > passed; the counts were read from a temporary JSON readout written by that run, removed before
  > commit. Seed, sample size, rates, event mix, pool, `TAIL`, stop rule, harness and engine are as the
  > boxes above ran them — only the test file changed. Its later runs inside `pnpm test` are the
  > permanent regression check of this verdict, not a re-evaluation.

---

## 7. Gate 7 — Coverage and the stack verdict (evaluated once, over the finished phase)

- [x] **REQ-3.12 (100%, over the right files):** `pnpm test` reports **100** for lines, branches,
  functions and statements, and `coverage/coverage-summary.json` lists every non-test source file
  under `packages/game/src/` outside `testing/` that has executable code — `clock.ts`, `index.ts`,
  `reducer.ts`, `room.ts`, `rules.ts` — and nothing under `testing/` or matching `*.test.ts`.
  (`types.ts` has no executable code and may appear with zero statements or not at all; record which.)
  > Measured: lines **100** (72 / 72) · branches **100** (65 / 65) · functions **100** (16 / 16) ·
  > statements **100** (86 / 86) · files listed **6**, beside the `total` key, every one under
  > `packages\game\src\` and every one at 100 on all four metrics — `clock.ts` (statements 16 ·
  > branches 6 · functions 8 · lines 14), `index.ts` (**0 / 0** on all four), `reducer.ts`
  > (44 · 43 · 3 · 36), `room.ts` (20 · 16 · 5 · 16), `rules.ts` (6 · 0 / 0 · 0 / 0 · 6), `types.ts` ·
  > `types.ts` **appears, with 0 statements** (0 / 0 statements, branches, functions and lines) ·
  > test or testing files listed **0** — 0 keys under `testing/`, 0 matching `*.test.ts`, 0 outside
  > `packages/game/src/`
  > `pnpm test`, 2026-09-30, Windows, at `83b5f9a` with the engine byte-identical to it: exit 0,
  > 20 test files across 6 projects, 318 assertions passed, 0 failed, `[check-collected-tests] OK`.
  > The text table's per-file rows print empty when every file is at 100 %; its summary block read
  > Statements 100 % (86/86) · Branches 100 % (65/65) · Functions 100 % (16/16) · Lines 100 % (72/72),
  > and the per-file values above are read from the JSON. `index.ts` now holds only `export … from`
  > re-exports, in which v8 counts no statement — so, like `types.ts`, it is listed with 0 / 0 (it
  > was 1 / 1 in Gate 1, when it still declared `PLACEHOLDER`). `git status --porcelain -- coverage/`
  > was empty afterwards.

- [x] **REQ-3.12 (Coverage is not the whole story — named mutations are caught):** each mutation below
  is applied alone, `pnpm vitest run packages/game` is run, the failing test is recorded, and the
  mutation is reverted and the suite re-run green. A mutation that fails **only** a coverage threshold
  and no assertion does not count as caught.

  | # | Mutation | Must be caught by |
  |---|---|---|
  | M1 | `runningSince !== null` → a truthiness test, wherever it appears | Gate 3 "Starting a round" (remaining after one tick) |
  | M2 | drop `runningSince = now` after a non-terminal spend | Gate 4 "A spend re-anchors the clock" |
  | M3 | `left <= 0` → `left < 0` in the spend path | Gate 4 "Exactly zero …"; Table D S4, S5 |
  | M4 | `HINT_COST_MS = 2001` | Gate 2 extraction #1; Table D S2 |
  | M5 | `skip` spends without consulting `liveQuestion` | Gate 4 "Inert during a reveal …" |
  | M6 | `remainingMs` applies elapsed time to the inactive team too | Gate 3 "Only the active bank drains" |
  | M7 | `hint` advances `hintIndex` before the round-ending check | Table D S5; Gate 2 extraction #8 |
  | M8 | `displaySeconds` uses `Math.round` | Gate 2 "Display, exhaustively" |
  | M9 | `tick` tests for zero against the pre-tick `now` | Gate 3 "Zero crossing …" |
  | M10 | `startRound` not inert while `screen === 'play'` | Gate 3 "Start is inert in play …" |

  > Measured: caught **10 / 10**, every one by a failing assertion (no coverage ran: each run was
  > `pnpm vitest run packages/game`, 211 tests) · per mutation (failing tests of 211, then the
  > named catcher and what it saw):
  > M1 **caught, 51** — applied at all three engine sites at once (`remainingMs` in `clock.ts`, the
  > `tick` zero test in `reducer.ts`, `liveQuestion` in `room.ts`; `testing/invariants.ts`, the
  > checker, left alone); "Starting a round" fails for both
  > teams on the remaining-after-one-tick line (45,000, expected 44,900), with Zero crossing ×5, Only
  > the active bank drains ×2, Table D and the 🚦 verdict among the rest ·
  > M2 **caught, 15** — "A spend re-anchors the clock" fails for both spends (hint 13,000, expected
  > 23,000; skip 12,000, expected 22,000) ·
  > M3 **caught, 12** — "Exactly zero …" fails ×3 (skip at exactly 3,000; hint at exactly 2,000; team
  > `b`), and Table D differs in exactly S4 (ends never, expected 421; `questionIndex` 1) and S5 (ends
  > never, expected 431; `hintIndex` 1) ·
  > M4 **caught, 8** — extraction #1 fails (`HINT_COST_MS / 1000` 2.001, expected 2), with the
  > user-story "−2s" value, Hint ×2, Skip, re-anchor (hint), Exactly zero (hint) and extraction #5;
  > **Table D S2 does not fail** — see below ·
  > M5 **caught, 12** — "Inert during a reveal …" fails for `skip` in all 5 of its states, with
  > extraction #6, the predicate-agreement box, the invariants, Table D and the 🚦 verdict ·
  > M6 **caught, 9** — "Only the active bank drains" fails for both teams (`inactiveChanges` ≠ 0),
  > with `clock.test.ts`'s inactive-team case, Starting a round ×2, Table D and the 🚦 verdict ·
  > M7 **caught, 8** — Table D differs in exactly S5 (`hintIndex` 1, expected 0) and extraction #8
  > fails, with Exactly zero (hint) ×2 and extraction #5 ·
  > M8 **caught, 12** — "Display, exhaustively" fails (the 0 … 90,000 sweep, and the 1 ms, 1,001 ms
  > and 44,001 ms edges), with extraction #11 and both "shows as 1" cases ·
  > M9 **caught, 26** — "Zero crossing …" fails ×4 (both teams, 45,000 and 45,001), with additivity
  > (946 violations), I5 (965 states), Table D and the 🚦 verdict ·
  > M10 **caught, 1** — "Start is inert in play …" (`startRound` while in play did not return the
  > same object), the only failing test ·
  > all reverted, suite green **yes** — after each run the six engine files were restored from a copy,
  > each file's SHA-256 equalled its pre-mutation value and `git diff --exit-code packages/game/src`
  > was empty; after all ten, `pnpm vitest run packages/game` passed 7 files, 211 / 211 tests
  > **One deviation from the "Must be caught by" column — M4 / Table D S2.** S2 (hint, then 430 ticks)
  > ends at step 431 for any hint cost from 2,000 to 2,099 ms: with 2,001 the bank is −1 rather than
  > 0 after the 430th tick, and both end the round there. No displayed second changes either — every
  > live bank reads 43,000 − 100j or 42,999 − 100j, which round up to the same second — so Table D,
  > the exact-oracle comparison and the 🚦 verdict all pass under M4. Extraction #1, the column's first
  > catcher, fails, so M4 is caught; at 100 ms granularity S2 pins a hint's cost only to that 2,000 –
  > 2,099 ms window. Every other row's named catcher failed as the column says.
  > Method, 2026-09-30, Windows: each mutation applied by exact string replacement (one match
  > required per site), never committed.

- [x] **NFR-3.6 (Fast enough to stay in `pnpm test`):** the `@nel3ab/game` project's test duration,
  with coverage on, is under **20 s** on the Windows development machine; the CI run's duration is
  recorded. An overrun is a finding recorded here — the samples are not shrunk (R4).
  > Measured: Windows **6.42 · 6.46 · 6.47** s · Ubuntu CI **10.98** s
  > **Windows — under 20 s at the slowest of three.** `pnpm vitest run packages/game --coverage`, run
  > three times in a fresh `git clone --no-local` of `phase-3-run` at `54e716c`, 2026-09-30, Windows 11:
  > Vitest Duration 6.42 s, 6.46 s, 6.47 s, each 211 / 211 tests passed and coverage 100 on all four
  > metrics. Conditions: on mains power (battery 100 %, AC connected), CPU load 3–20 %. Inside the same
  > clone's single full `pnpm test` (REQ-3.13 below) the game project's longest file was
  > `purity.test.ts` at 6.05 s, and the whole six-project run's Vitest Duration was 6.78 s.
  > **Recorded as a finding, per this box's rule — the limit was exceeded under other conditions.**
  > Earlier the same day, with the laptop recharging from 2.7 % battery, runs of **21–31 s** were
  > observed on unchanged code. They did not reproduce on mains power; the figures above are the
  > mains-power ones. The cause was not isolated. The samples were not shrunk.
  > **Ubuntu CI — recorded; no limit applies.** Run `36727180451` (REQ-3.13 below), `ci` job, Test step
  > (`pnpm test`, coverage on): Vitest Duration **10.98 s** for the whole six-project run (transform
  > 577 ms, import 1.18 s, tests 17.75 s summed across workers), which bounds the game project. Its
  > files there: `purity.test.ts` 10,360 ms, `prototype-equivalence.test.ts` 7,155 ms, the other five
  > 4–35 ms each. Test step wall time 12 s (14:11:34 → 14:11:46 UTC). CI runs the game project only
  > inside the full run, so no isolated figure exists there. The same six-project run took 10.98 s on
  > the runner against 6.78 s on the Windows machine on mains power.

- [x] **NFR-3.1 (`design/` and `specs/` untouched):** `git diff` from the commit at which
  implementation began to the phase's final commit, over `design/` and `specs/`, shows changes to
  `specs/phase-3/verification.md` (ticks and measured values) and, at close, the status cell and
  "Completed Work" entry of `specs/roadmap.md` — and nothing else.
  > Measured: files changed under `design/` **0** · under `specs/` **1** — `specs/phase-3/verification.md`
  > `git diff --stat 2c2b7ac^ HEAD -- design/ specs/` at `54e716c`, 2026-09-30. `2c2b7ac` (Gate 1's
  > coverage probe) is the phase's first implementation commit, so the range holds all ten
  > implementation commits, `2c2b7ac` … `54e716c`. One file changed: `specs/phase-3/verification.md`,
  > and every line the diff removes from it is an unticked box line, a `____` placeholder or a blank
  > line — ticks and measured values only. `design/`: **0** files, and `git diff main...HEAD -- design/`
  > is empty. `specs/roadmap.md` is unchanged in the range; its status cell and "Completed Work" entry
  > are the owner's to write at close.
  > The range's base, `2c2b7ac^` = `b7c46e0`, is the plan commit: it added `specs/phase-3/*` and set the
  > roadmap status to 🛠️, before any implementation. Recorded at `54e716c`; the only later change under
  > `design/` or `specs/` is the commit that records this box, which ticks this file's last three boxes.

- [x] 🚦 **REQ-3.13 (The four gate commands, no escape hatch) (VERDICT GATE — no retry):** on a
  fresh clone with `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (with
  coverage) and `pnpm build` all pass — on Windows **and** in the `ci` job on Ubuntu — and the §7
  escape grep finds no escape **directive** anywhere outside `design/` and `specs/`. The baseline
  before this phase, measured 2026-09-30, is **4** matching lines, all prose that *names* a forbidden
  word (`CLAUDE.md` ×2, `packages/ui/src/styles/press.module.css`, `stylelint.config.mjs`) and **0**
  directives; `skipLibCheck` appears only in `tsconfig.base.json`. Every new matching line is listed
  and classified as prose or directive. No coverage threshold below 100, no third `exclude`, no floated
  pin, no change to the `ci` job name.
  **PASS:** all four green on both platforms, 0 directives, 0 other escapes. **FAIL:** passing
  *required* an escape. Then coverage cannot be enforced on this stack as REQ-3.12 decided; **the
  phase halts** and REQ-3.12 returns to the owner. It is not made green by adding the escape.
  > Measured: Windows lint **0** · typecheck **0** · test **0** · build **0** · CI run **36727180451**
  > (job `ci`, `success`) · grep lines **4** (new: **0**, classified **4 / 4 prose, all baseline**) ·
  > directives **0** · **VERDICT: PASS**
  > **VERDICT 2026-09-30: PASS.** Evaluated once, not retried: each half ran once and its numbers were
  > read once. The four gate commands pass on a fresh frozen install, on Windows and in the `ci` job on
  > Ubuntu, with no escape hatch — coverage is enforced on this stack as REQ-3.12 decided.
  > **Windows.** A fresh `git clone --no-local` of `phase-3-run` at `54e716c` (the phase's last code
  > change) into an empty directory, Windows 11, each command exactly once:
  > `pnpm install --frozen-lockfile` exit **0**, "Lockfile is up to date", 275 packages, **0** peer
  > warnings (served from the local store, 0 downloaded) · `pnpm lint` **0** · `pnpm typecheck` **0** ·
  > `pnpm test` **0** — **20** files, **318** assertions, **6** projects (`apps/game` 1 · `apps/web` 3 ·
  > `packages/content` 1 · `packages/game` 7 · `packages/protocol` 1 · `packages/ui` 7),
  > `[check-collected-tests] OK`, coverage 100 / 100 / 100 / 100 (statements 86 / 86 · branches
  > 65 / 65 · functions 16 / 16 · lines 72 / 72), Vitest Duration 6.78 s · `pnpm build` **0** —
  > Next 15.5.23, 5 / 5 static pages.
  > **Ubuntu CI.** Run **36727180451**, https://github.com/AhmedQureshi89/nel3ab/actions/runs/36727180451 —
  > workflow `CI`, event `pull_request` on PR #30, head `54e716c1b3ed07d32444db1b558790040ea6ef98`;
  > job **`ci`**, conclusion **`success`**, runner image `ubuntu-24.04` `20260920.314.1`, Node
  > `v24.21.0`, pnpm `11.22.0`. The job checked out GitHub's merge ref `f48c3ca` (`54e716c` merged into
  > `main`'s `1dc0a9b`), whose tree `a36ead7de31c11b82952152e72d455463e17b058` is **identical** to
  > `54e716c`'s — `1dc0a9b` is an ancestor of `54e716c` — so CI tested exactly the code evaluated on
  > Windows. Steps, every one `success`:
  > Install dependencies (5 s) — `pnpm install --frozen-lockfile`, "Lockfile is up to date, resolution
  > step is skipped", +276 packages, **0** `WARN` / peer lines, "Done in 4.8s using pnpm v11.22.0" ·
  > Lint (5 s) — eslint, stylelint, "All matched files use Prettier code style!" ·
  > Typecheck (2 s) — `tsc --build --pretty` ·
  > Test (12 s) — `node scripts/check-collected-tests.mjs --coverage`: 20 / 20 files, 318 / 318 tests,
  > "`[check-collected-tests] 20 test file(s) across 6 workspace project(s); 318 assertion(s) passed,
  > 0 failed.`", per project `apps/game` 1 · `apps/web` 3 · `packages/content` 1 · `packages/game` 7 ·
  > `packages/protocol` 1 · `packages/ui` 7 — the Windows counts — then `[check-collected-tests] OK`;
  > coverage "All files" 100 / 100 / 100 / 100 (the text reporter prints percentages only), with
  > `clock.ts`, `reducer.ts`, `room.ts`, `rules.ts` at 100 on all four and `index.ts`, `types.ts`
  > printed 0 on all four — the two files REQ-3.12 found at 0 / 0, with no executable code; Vitest
  > Duration 10.98 s (NFR-3.6 above) ·
  > Build (12 s) — `pnpm -r build`, 6 of 7 projects, Next 15.5.23, 5 / 5 static pages, routes `/`,
  > `/_not-found`, `/styleguide`.
  > Job 52 s (14:11:12 → 14:12:04 UTC); run 58 s (created 14:11:07, last updated 14:12:05).
  > The one-package difference, 276 on Ubuntu against 275 on Windows, is consistent with `sharp`'s
  > platform-specific optional binaries in the lockfile (Linux x64 installs `@img/sharp-linux-x64` and
  > `@img/sharp-libvips-linux-x64`; Windows x64 a single `@img/sharp-win32-x64`); both installs report
  > the lockfile up to date. Notices elsewhere in the CI log, none from the install step and none an
  > escape: `pnpm/action-setup`'s "`[WARN] Detected a pnpm v10 installation layout at PNPM_HOME`"
  > (Install pnpm step, the runner's own tooling); Vite's `configLoader: 'native'` notice about
  > `vitest.config.ts` (Test step); Next's "No build cache found", "TypeScript project references are
  > not fully supported" and "The Next.js plugin was not detected in your ESLint configuration"
  > (Build step).
  > **The escape list, item by item**, over the Windows clone at `54e716c`, with §8's two Gate 7 greps:
  > first grep — **4** lines, the pre-phase baseline exactly: `CLAUDE.md:104`, `CLAUDE.md:109`,
  > `packages/ui/src/styles/press.module.css:48`, `stylelint.config.mjs:19`, every one prose that names a
  > forbidden word; **0** new lines; **0** directives (`@ts-expect-error`, `@ts-ignore`, `eslint-disable`,
  > `stylelint-disable`, `v8` / `istanbul` / `c8 ignore`) ·
  > second grep — only `tsconfig.base.json:12` `skipLibCheck`, the baseline and the one permitted place;
  > **0** `pnpm.overrides`, `peerDependencyRules` or `strict-peer` ·
  > coverage — `vitest.config.ts` thresholds **100** on all four metrics, exactly **2** `exclude` entries
  > (REQ-3.12's `*.test.ts` and `testing/**`) ·
  > pins — **0** `^` / `~` across all **7** manifests ·
  > the `ci` job — the `.github/` diff against `main` is empty, the job is still `ci`, and CI reported
  > it under that name · `scripts/check-collected-tests.mjs` — unchanged against `main`.

---

## 8. Automated Commands

Written for Git Bash or the Ubuntu CI runner, as Phase 2's were.

```bash
# Gate 1 / Gate 7 — the four gate commands, in this order, from a fresh clone
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test                 # = check-collected-tests.mjs --coverage
pnpm build

# Gate 1 — what coverage measured, and that nothing leaked
node -e "console.log(Object.keys(require('./coverage/coverage-summary.json')).join('\n'))"
git status --porcelain -- coverage/          # expect nothing

# Gates 2–6 — iterate on one project (no coverage, no collected-count check)
pnpm vitest run packages/game
pnpm vitest run packages/game/src/prototype-equivalence.test.ts
pnpm vitest run -t "extraction"

# Gate 5 — ambient time, randomness, timers and I/O in non-test source
grep -rnwE "Date|Math\.random|performance|setTimeout|setInterval|setImmediate|queueMicrotask|crypto|process|fetch|console" \
  packages/game/src --include=*.ts | grep -v "\.test\.ts:" | grep -v "/testing/"

# Gate 5 — non-relative imports in non-test source
grep -rnE "from '[^.]" packages/game/src --include=*.ts | grep -v "\.test\.ts:" | grep -v "/testing/"

# Gate 7 — escape hatches (baseline: 4 prose lines, 0 directives)
git grep -nE "@ts-expect-error|@ts-ignore|eslint-disable|stylelint-disable|v8 ignore|istanbul ignore|c8 ignore" \
  -- ':!design' ':!specs' ':!pnpm-lock.yaml'
git grep -nE "skipLibCheck|pnpm\.overrides|peerDependencyRules|strict-peer" -- ':!design' ':!specs' ':!pnpm-lock.yaml' ':!*.md'

# Gate 7 — design/ and specs/ untouched since implementation began
git diff --stat <first-implementation-commit>^ HEAD -- design/ specs/
```

> `pnpm test` forwards extra arguments to `scripts/check-collected-tests.mjs`, which asserts that
> *every* workspace project contributed a file — so it fails on any filtered run. Iterate with
> `pnpm vitest`, gate with `pnpm test` (`CLAUDE.md`). `vitest run --dir <path>` does **not** filter.

---

## 9. Acceptance Criteria

Phase 3 is complete when **all** of the following hold:

1. **Gate 1** is green — the coverage provider is pinned exactly, wired through the `test` script,
   proven to fail the run, and measuring the right files.
2. **Gates 2–5** are green — `RoomState` covers the handoff contract field for field; the rules'
   numbers are read from the prototype at test time; the clock, the spends, the reveal and the
   inertness rules behave as specified; the reducer is pure, deterministic and dependency-free; the
   public surface is exact.
3. **Gate 6's 🚦 verdict** returned **PASS** — a simulated 45-second round produces the same outcome
   as the prototype — with the engine shown to be exact arithmetic first.
4. **Gate 7** is green — 100% coverage over the named files, all ten mutations caught — and its
   🚦 stack verdict returned **PASS** on Windows and on Ubuntu CI.
5. Every box above is ticked **with its measured value filled in**.
6. `roadmap.md`'s Phase 3 status is updated and its "Completed Work" section records both verdicts
   with the commit they were measured at, the form Phases 1 and 2 set.

That is the roadmap's exit criterion — "full test coverage on clock and spend logic; a simulated
45-second round produces the same outcome as the prototype" — as criteria 3 and 4. No criterion
appears here for the first time.

---

## 10. What Would Make This Phase Untrustworthy

- **The oracle is a transcription of the prototype, not the prototype.** Every equivalence claim in
  Gate 6 compares the engine to code written by reading `Nel3ab - Arcade.dc.html`, by the same kind
  of reader who wrote the engine. A misreading they share — of guard order, of what `endRound` leaves
  behind, of whether the prototype's `setState` batching could interleave a tick and a spend — makes
  them agree with each other and not with the prototype. Gate 2 anchors the numbers and three
  orderings to the file itself, and Gate 6 requires the float oracle to reproduce the prototype's
  **defects**, which a careless transcription would not. What neither covers: the prototype was never
  *executed* for this phase. Its behaviour in a browser — a real `setInterval` that jitters, a React
  state that updates asynchronously — is inferred, not observed.

- **The verdict was pre-measured with a stand-in.** Table B's "0 of 10,000 at 45 s" was measured with
  exact arithmetic standing in for the engine. The gate is therefore close to certain to pass if the
  engine is exact — which is the honest expectation, not a weakness — but it means the gate's real
  power is in its **no-retry** clause: a divergence, if one appears, cannot be sampled away.

- **A verdict retried into green.** The ways to do it are specific and every one is forbidden in the
  gate's text: a different seed, a smaller `n` "to meet NFR-3.6", a rate list without 0.01, a stop
  rule that ends sequences earlier, a question pool with fewer hints, or an engine that reproduces
  float drift "for fidelity". Table C's fingerprint and Table B's steps-consumed totals exist so that
  any of these shows up as a number that no longer matches.

- **100% coverage with assertions too weak to notice a break.** Coverage says a line ran, not that a
  test would fail if it were wrong. The ten named mutations exist because each one is a *plausible*
  bug that leaves coverage at 100% — M1 in particular: a truthiness test on `runningSince` breaks only
  rounds started at engine time zero, which is exactly the first round of every room and exactly the
  round most unit tests start.

- **Coverage measuring nothing.** If `include` resolves against a project root, zero files match and
  thresholds pass vacuously. Gate 1 and Gate 7 both require named files in the report.

- **The comparison happens at 100ms granularity only.** The prototype spends at arbitrary moments
  inside a 100ms interval; the harness applies every event on a tick boundary. The engine's behaviour
  between boundaries — with the jittery, non-100ms ticks Phase 5's browser and Phase 11's server will
  actually send — is covered by the additivity property, not by the prototype.

- **Phase 3 only ever runs one team's bank.** With no turn passing, the second team's clock never
  starts, and the lazy representation's hardest transition — re-anchoring `runningSince` for a
  *different* team after a reveal — does not exist yet. A bug there belongs to Phase 4 and will not
  be found by anything in this file.

- **The integer contract moves rounding onto the callers.** A driver that measures elapsed wall time
  and rounds each delta with `Math.round` can drift by up to 0.5ms per tick — about ±225ms over a 45 s
  bank in the worst case — and the engine cannot see it. **Carried forward to Phase 5** (if its browser
  loop measures time rather than dispatching `tick(100)`) **and Phase 11** (whose server tick measures
  wall time by necessity).

- **`clock.now` mistaken for a timestamp.** It starts at 0 per room and counts only what `tick` was
  told. Anything that displays it, persists it as a time, or compares it with `Date.now()` is wrong.
  Phase 16 must map it onto `serverTime` explicitly.

- **Fields that exist but are never exercised.** `players`, `judgeIndex`, `log`, `usedCategories`,
  `categoryId`, `round` and the tallies are typed and initialised, and the contract box proves they are
  present — not that their shapes are right. Phases 4 and 5 are the first to use them and may refine
  them (specs.md §2.1). The clock's shape is the one they may not change.

- **The engine visibly disagreeing with the prototype at 20, 25 and 65–90 s.** If Phase 5 lets a host
  choose the bank length, a side-by-side against the prototype will show a different second, or a round
  ending a tick sooner, in most rounds at those lengths. That is the owner's 2026-09-30 decision working
  as recorded, not a regression — and it should not be "fixed" by anyone reading only the prototype.

---

*Written: 2026-09-30 — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured values may be
added; gates may not be changed except by a dated planning session.*
