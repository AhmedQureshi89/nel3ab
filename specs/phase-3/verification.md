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

- [ ] **REQ-3.1 (The contract, field for field):** `room.test.ts` enumerates the **22** handoff names
  of [specs.md](specs.md) §2.1's table and asserts each mapped path exists on `createRoom(…)`'s
  result; `Object.keys` of the state is **exactly** the 20 top-level keys, of `clock` exactly its 4,
  of `config` exactly its 2.
  > Measured: handoff names checked ____ / 22 · unmapped ____ · top-level keys ____ / 20 ·
  > clock keys ____ / 4 · config keys ____ / 2 · extra keys ____

- [ ] **REQ-3.2 (Initial state):** a room created with only `roomCode`, `teamA`, `teamB` has every
  value of [specs.md](specs.md) §2.4's table — including `clock` `{ now: 0, active: 'a',
  runningSince: null, banks: { a: { ms: 45000, started: false }, b: { ms: 45000, started: false } } }`
  and `config` `{ roundSeconds: 45, winsNeeded: 3 }`.
  > Measured: fields asserted ____ · mismatches ____

- [ ] **REQ-3.2 (Configuration range):** all **15** of 20, 25 … 90 are accepted as `roundSeconds`,
  and each accepted value yields banks of `roundSeconds × 1000`; `15, 19, 21, 44, 46, 47, 95, 0, −45,
  45.5, NaN` each throw `RangeError`. `2, 3, 4` are accepted as `winsNeeded`; `1, 5, 0, 3.5, NaN` each
  throw `RangeError`. Nothing is clamped.
  > Measured: accepted ____ / 15 and ____ / 3 · rejected ____ / 11 and ____ / 5 · error type ____

- [ ] **REQ-3.10 (Numbers read from the prototype):** `rules.test.ts` extracts each of the following
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
  > Measured: extractions found ____ / 13 (+ ____ / 4) · count mismatches ____ · value mismatches ____

- [ ] **REQ-3.10 (Proven to bite):** changing `HINT_COST_MS` to `2100` fails `rules.test.ts` on
  extraction #1; changing it back is green.
  > Measured: failing test ____ · message ____ · green after revert ____

- [ ] **REQ-3.9 (Display, exhaustively):** for every integer `ms` in 0 … 90,000,
  `displaySeconds(ms) === Math.floor((ms + 999) / 1000)`. At the edges: 0→0, 1→1, 999→1, 1000→1,
  1001→2, 44,001→45, 45,000→45. For −1, −999, −1000 and −10⁹ the result is `+0`, asserted with
  `Object.is(…, 0)`. `NaN`, `Infinity` and `−Infinity` each throw `RangeError`.
  > Measured: values checked ____ / 90,001 · mismatches ____ · edges ____ / 7 · negatives
  > `Object.is` 0 ____ / 4 · non-finite throws ____ / 3

- [ ] **REQ-3.6 (Current question):** `currentQuestion` returns `null` on an empty pool (a fresh
  room), and `pool[i mod n]` otherwise — for a pool of 3, indices 0…6 yield entries 0,1,2,0,1,2,0.
  > Measured: empty pool ____ · wrap sequence ____

---

## 3. Gate 3 — The clock (block 2–5; see Gate ordering)

- [ ] **REQ-3.5 (Starting a round):** from a fresh room at `now = 0`, `startRound('a', pool)` yields
  `screen 'play'`, `clock.active 'a'`, `clock.runningSince` **equal to `0`** (the value zero — not
  `null`, not "falsy-but-fine"), banks `a { 45000, started: true }` and `b { 45000, started: false }`,
  `questionPool` the given pool, both indices 0, `reveal null`; and `round`, `tallyA`, `tallyB`,
  `log`, `categoryId`, `usedCategories` unchanged. The same with `'b'`. After **one** `tick(100)`,
  `remainingMs(clock, 'a')` is **44,900** — the round started at engine time zero really runs.
  > Measured: fields asserted (a) ____ · (b) ____ · `runningSince` ____ · remaining after one tick ____

- [ ] **REQ-3.5 / REQ-3.3 (Start is inert in play, malformed start throws):** `startRound` while
  `screen === 'play'` returns the **same object** (`toBe`), including while a reveal is up.
  `startRound` with `questions: []` and with `startingTeam: 'c'` each throw `RangeError` — in `setup`
  and in `play` alike (validation precedes inertness).
  > Measured: inert in play ____ · inert in reveal ____ · empty pool throws ____ (setup) ____ (play) ·
  > bad team throws ____ (setup) ____ (play)

- [ ] **REQ-3.4 (Only the active bank drains):** after `k` × `tick(100)` for k = 1 … 449 from a
  started round, `remainingMs(active) = 45,000 − 100k` exactly and the inactive bank is deep-equal
  to its value at the start.
  > Measured: k checked ____ / 449 · mismatches ____ · inactive bank changes ____

- [ ] **REQ-3.4 (A tick that does not end the round changes only `now`):** for every tick in the
  per-length sample and the scripted scenarios that does not end a round, the next state equals the
  previous one with `clock.now` replaced by `now + ms` — deep-equal, nothing else different.
  > Measured: ticks checked ____ · violations ____

- [ ] **REQ-3.4 (Additivity):** for every state visited in the 45 s per-length sample, and a pair
  `(a, b)` drawn uniformly from 0 … 3000 each by `mulberry32(SEED + 1)` in visiting order,
  `reduce(reduce(s, tick a), tick b)` deep-equals `reduce(s, tick (a + b))` — including when the
  pair crosses zero.
  > Measured: states checked ____ · of which crossing zero ____ · violations ____

- [ ] **REQ-3.4 / REQ-3.7 (Zero crossing ends the round in the same step):** from a fresh 45 s round,
  `tick(45000)` and `tick(45001)` each yield, in **one** step, `screen 'roundEnd'`, active bank
  `ms 0` (not −1), `runningSince null`, and `clock.now` 45,000 / 45,001 respectively. `tick(44999)`
  yields a live round with 1ms left and `displaySeconds` **1**.
  > Measured: 45000 ____ · 45001 ____ · 44999 ____

- [ ] **REQ-3.3 (Malformed ticks throw; a zero tick is inert):** `tick` with `−1`, `1.5`, `NaN`,
  `Infinity`, `2**53`, and an `ms` for which `now + ms` is not a safe integer each throw `RangeError`,
  in `setup`, `play` and `roundEnd`. `tick(0)` returns the **same object**.
  > Measured: throws ____ / 18 · `tick(0)` same object ____

- [ ] **REQ-3.4 (A stopped clock drains nothing):** ticks in `setup`, after a round end and during a
  reveal leave both banks deep-equal and advance only `clock.now`.
  > Measured: setup ____ · roundEnd ____ · reveal ____

- [ ] **Invariants I1–I10 hold at every step:** `assertInvariants` ([specs.md](specs.md) §2.8) passes
  after every step of every sequence of the per-length sample and every scripted scenario.
  > Measured: states checked ____ · violations ____ (by invariant: ____)

---

## 4. Gate 4 — The judge's actions (block 2–5; see Gate ordering)

- [ ] **REQ-3.6 (Hint):** in a live round, `hint` drains exactly 2,000ms and advances `hintIndex` by
  one. On a two-hint question the third `hint` returns the **same object** and costs nothing. On a
  question whose `h` is empty, the first `hint` returns the same object.
  > Measured: drain ____ · index ____ · third hint same object ____ · hintless same object ____

- [ ] **REQ-3.6 (Skip):** in a live round, `skip` drains exactly 3,000ms, advances `questionIndex` by
  one and resets `hintIndex` to 0. On a pool of three, the third skip makes `currentQuestion` the
  pool's first entry again.
  > Measured: drain ____ · indices ____ · wrap ____

- [ ] **REQ-3.4 / REQ-3.6 (A spend re-anchors the clock):** from a fresh 45 s round: 100 × `tick(100)`,
  `hint`, 100 × `tick(100)` leaves exactly **23,000ms** (45,000 − 10,000 − 2,000 − 10,000); the same
  with `skip` leaves exactly **22,000ms**. *(This is the box a missing re-anchor fails — mutation M2.)*
  > Measured: after hint ____ · after skip ____

- [ ] **REQ-3.7 (Exactly zero, past zero, and one millisecond above):** with the active bank at
  exactly 3,000ms, `skip` ends the round in that step with `questionIndex` unchanged; at exactly
  2,000ms, `hint` ends it with `hintIndex` unchanged; at 1,000ms, `skip` ends it with the bank at
  **0**, not −2,000; at 3,001ms, `skip` leaves a **live** round with 1ms and `displaySeconds` 1.
  > Measured: skip at 3000 ____ · hint at 2000 ____ · skip at 1000 → bank ____ · skip at 3001 ____

- [ ] **REQ-3.7 (No zero bank in play):** across every state visited in Gate 3's invariant box, no
  state has `screen 'play'` with `remainingMs(active) === 0` (invariant I5, reported separately).
  > Measured: states ____ · violations ____

- [ ] **REQ-3.8 (Correct raises the reveal and stops the clock):** in a live round, `correct` yields
  `reveal = { answer: q.a, fact: q.f }` of the current question, `runningSince null`, the active bank
  settled to exactly its remaining time, and nothing else changed. Then 1,000 × `tick(100)` drain
  **nothing** and advance `clock.now` by 100,000.
  > Measured: reveal ____ · bank settled to ____ · drained during reveal ____ · `now` advanced ____

- [ ] **REQ-3.8 (Inert during a reveal and with the clock stopped):** `hint`, `skip` and `correct` each
  return the **same object** (a) during a reveal — so a double-tapped `correct` scores nothing twice —
  (b) in `setup`, (c) after a round end, and (d) in a hand-built state with a running clock **and** a
  reveal (the defence of [specs.md](specs.md) §2.4), and (e) in a hand-built `play` state with an
  empty pool.
  > Measured: 3 actions × 5 states = ____ / 15 same object

- [ ] **REQ-3.8 (The exported predicate and the reducer agree):** for every state visited in the
  per-length sample and the scripted scenarios, `acceptsJudgeActions(s)` is `false` **if and only if**
  `skip` and `correct` both return the same object; and whenever it is `false`, `hint` does too.
  > Measured: states ____ · disagreements ____

---

## 5. Gate 5 — Purity and the public surface (block 2–5; the block blocks Gate 6)

- [ ] **REQ-3.3 (Never mutates its input):** every `(state, action)` pair in the per-length sample and
  the scripted scenarios is deep-frozen before `reduce` is called. **0** `TypeError`s.
  > Measured: calls on frozen input ____ · TypeErrors ____

- [ ] **REQ-3.3 (Deterministic):** every such call is made twice; the two results are deep-equal.
  > Measured: pairs ____ · differences ____

- [ ] **REQ-3.3 (No ambient time, randomness or timers — at run time):** with `Date.now`,
  `Math.random`, `performance.now`, `setTimeout` and `setInterval` each replaced by a spy that
  **throws**, the 45 s per-length sample and all scripted scenarios run through `reduce`,
  `createRoom`, `remainingMs`, `displaySeconds`, `currentQuestion` and `acceptsJudgeActions` with
  **0** spy calls.
  > Measured: calls made ____ · spy invocations ____

- [ ] **REQ-3.3 (… and in the source):** the grep of §7 over non-test, non-`testing/` source under
  `packages/game/src/` for `Date`, `Math.random`, `performance`, `setTimeout`, `setInterval`,
  `setImmediate`, `queueMicrotask`, `crypto`, `process`, `fetch`, `console` finds **0** occurrences
  in code. Any occurrence inside a comment is listed here and classified, not filtered away.
  > Measured: hits in code ____ · hits in comments ____ (listed: ____)

- [ ] **NFR-3.2 (Dependency-free):** `packages/game/package.json` has no `dependencies`,
  `devDependencies` or `peerDependencies` key; every `import … from` in non-test, non-`testing/`
  source under `packages/game/src/` is a relative path.
  > Measured: dependency keys ____ · non-relative imports ____

- [ ] **NFR-3.5 (Exact public surface):** `index.test.ts` asserts the sorted `Object.keys` of the
  package equal the **12** names of [specs.md](specs.md) §2.6 exactly; `PLACEHOLDER` is absent; no
  export comes from `clock.ts`'s internal table or from `testing/`.
  > Measured: runtime exports ____ / 12 · extra ____ · missing ____ · `PLACEHOLDER` present ____

- [ ] **NFR-3.4 (The two broken tests were updated, not deleted):** `packages/game/src/index.test.ts`
  and `apps/game/src/index.test.ts` both exist and pass; the latter imports `createRoom` from
  `@nel3ab/game` and still asserts that `@nel3ab/protocol` and `@nel3ab/content` resolve.
  `apps/game/src/index.ts` is unchanged.
  > Measured: both present ____ · both pass ____ · `apps/game/src/index.ts` diff ____

---

## 6. Gate 6 — Equivalence with the prototype (blocks Gate 7)

The ordinary boxes come first and in this order: they prove that the generator, the two oracles and
the harness reproduce the planning measurement *before* the engine is judged against any of them.

- [ ] **REQ-3.11 (Generator fingerprint):** `mulberry32(SEED)` and the verdict sample's sequence 0
  reproduce Table C exactly.
  > Measured: first three draws ____ · sequence 0 first six non-tick events ____

- [ ] **REQ-3.11 (Oracle anchors):** the float oracle reproduces **every** float row of Table A —
  including the one-tick-late ends at 80, 85 and 90 s and the wrong-second counts at 65–90 s — and the
  exact oracle every exact row. An oracle that does not reproduce the prototype's known defects is not
  transcribing the prototype (R3).
  > Measured: float rows matched ____ / 30 · exact rows matched ____ / 30

- [ ] **REQ-3.11 (Oracle against oracle):** the float and exact oracles, run through the harness,
  reproduce Table B — every diverging-sequence count and every steps-consumed total, for all 16
  rows. If Table C matched and this does not, the harness departs from [specs.md](specs.md) §2.8: fix
  the harness, never the table. If the harness is shown to match §2.8 and the numbers still differ,
  **stop and record** — the planning measurement itself was wrong, and the verdict below would rest
  on it.
  > Measured: rows matched ____ / 16 · diverging counts ____ · steps consumed ____

- [ ] **REQ-3.4 (The engine is exact arithmetic):** across the 13 scripted scenarios, all 3,000
  per-length sequences and all 10,000 verdict sequences, the engine's observation equals the **exact**
  oracle's at every consumed step, and the losing team is the same in every sequence that ends. This
  is the engine's correctness box: a failure here is an engine bug — fix it before anything below.
  > Measured: sequences ____ · steps ____ · diverging sequences **____** · loser mismatches ____

- [ ] **REQ-3.11 (Scripted scenarios):** the engine reproduces Table D exactly — the step at which
  each round ends, the final indices, and team `b` reading 45 throughout.
  > Measured: scenarios matched ____ / 13 (S1–S12 with S9′)

- [ ] **REQ-3.4 (The decision's cost, recorded):** the engine's diverging-sequence count against the
  **float** oracle, per per-length row, equals Table B's float-vs-exact count for that row — the cost
  of the owner's 2026-09-30 decision, measured on the engine itself rather than on a stand-in.
  > Measured: 20 ____ · 25 ____ · 30 ____ · 35 ____ · 40 ____ · 45 ____ · 50 ____ · 55 ____ ·
  > 60 ____ · 65 ____ · 70 ____ · 75 ____ · 80 ____ · 85 ____ · 90 ____ · rows equal to Table B ____ / 15

- [ ] 🚦 **REQ-3.11 (A 45-second round ends as it does in the prototype) (VERDICT GATE — no retry):**
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
  > Measured: scenarios diverging ____ / 13 · sequences diverging ____ / 10,000 · steps compared
  > ____ · loser mismatches ____ · **VERDICT: ____**

---

## 7. Gate 7 — Coverage and the stack verdict (evaluated once, over the finished phase)

- [ ] **REQ-3.12 (100%, over the right files):** `pnpm test` reports **100** for lines, branches,
  functions and statements, and `coverage/coverage-summary.json` lists every non-test source file
  under `packages/game/src/` outside `testing/` that has executable code — `clock.ts`, `index.ts`,
  `reducer.ts`, `room.ts`, `rules.ts` — and nothing under `testing/` or matching `*.test.ts`.
  (`types.ts` has no executable code and may appear with zero statements or not at all; record which.)
  > Measured: lines ____ · branches ____ · functions ____ · statements ____ · files listed ____ ·
  > `types.ts` ____ · test or testing files listed ____

- [ ] **REQ-3.12 (Coverage is not the whole story — named mutations are caught):** each mutation below
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

  > Measured: caught ____ / 10 · per mutation: M1 ____ · M2 ____ · M3 ____ · M4 ____ · M5 ____ ·
  > M6 ____ · M7 ____ · M8 ____ · M9 ____ · M10 ____ · all reverted, suite green ____

- [ ] **NFR-3.6 (Fast enough to stay in `pnpm test`):** the `@nel3ab/game` project's test duration,
  with coverage on, is under **20 s** on the Windows development machine; the CI run's duration is
  recorded. An overrun is a finding recorded here — the samples are not shrunk (R4).
  > Measured: Windows ____ s · Ubuntu CI ____ s

- [ ] **NFR-3.1 (`design/` and `specs/` untouched):** `git diff` from the commit at which
  implementation began to the phase's final commit, over `design/` and `specs/`, shows changes to
  `specs/phase-3/verification.md` (ticks and measured values) and, at close, the status cell and
  "Completed Work" entry of `specs/roadmap.md` — and nothing else.
  > Measured: files changed under `design/` ____ · under `specs/` ____

- [ ] 🚦 **REQ-3.13 (The four gate commands, no escape hatch) (VERDICT GATE — no retry):** on a
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
  > Measured: Windows lint ____ · typecheck ____ · test ____ · build ____ · CI run ____ ·
  > grep lines ____ (new: ____, classified ____) · directives ____ · **VERDICT: ____**

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
