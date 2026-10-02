# Run halted — 2026-10-02

**Reason:** every box in `verification.md` is ticked (46 / 46). The phase's exit verdict is the
owner's to write; an autonomous run may not write it (`/spec-run` hard rule 1). Phase 5 has no
triad, so the run could not continue past Phase 4 in any case.
**At:** end of Phase 4 — after REQ-4.16, the last box in gate order.
**Measured:** 🚦 REQ-4.14 **PASS** — a full match runs as it does in the prototype: 0 / 16 scripted
matches and 0 / 500 pre-registered sequences diverge from the prototype's own floating-point flow
over 1,172,055 steps, and 600 / 600 matches end with the same round log (`de425e9`), after the
engine was first shown equal to exact arithmetic over 816 sequences and 2,013,542 steps.
🚦 REQ-4.2 **PASS** — the premise of the fair-shuffle decision holds: the prototype's shuffle returns
the original order 22,564 times in 60,000 and the reversed order 18,813, against a fair 10,000 each,
equal to Table H on Node v24.14.0 (`430d7b8`). REQ-4.16 — the four gate commands pass with no escape
hatch on a fresh Windows clone and in the `ci` job on Ubuntu (run 37026483519, success), both at
`07e615e`.

## Completed this run

Branch `phase-4-run`, PR [#31](https://github.com/AhmedQureshi89/nel3ab/pull/31) (open, not merged).
Before the run: the plan (`0697822`), its owner-approved dated correction (`4894269`), and Gate 1
(`f1a38a2`), done with `/spec-next`.

- REQ-4.1, REQ-4.2, REQ-4.3 — the draw: 66 / 66 picks by the prototype's formula; every ordering
  exactly once for n = 1 … 6; Table H's 60,000-shuffle counts reproduced exactly (`2e1ef80`)
- REQ-4.4 – REQ-4.10 — the match lifecycle: 48 / 48 bad draws throw on every screen; rounds scored
  in the step they end; the match over at 2, 3 and 4 wins or on the last category; 8 / 8 judge
  rotations; back-to-setup keeps 12 / 12 fields (`931a0d3`)
- REQ-4.6 — the 1000 ms reveal and the turn pass: inert at 999 ms, effective at exactly 1,000 by
  three routes; a late pass anchored at the pass, not the hold (`2c31a17`)
- NFR-4.4 — the public surface: exactly 17 runtime exports, 9 / 9 helpers internal (`2f2330a`)
- REQ-4.12 — 17 / 17 rules extracted from the prototype at test time, 0 count and 0 value
  mismatches; #15 pins the shuffle line for the 🚦 premise box (`38f7ad3`)
- 🚦 REQ-4.2 — the premise verdict **PASS**, evaluated once (`430d7b8`)
- REQ-4.13 — Table G through the engine: 16 / 16 matches, 34 / 34 rounds at the pre-registered step
  (`9789cfc`)
- NFR-4.2, NFR-4.3 — purity: 1,669,382 frozen pairs, 0 TypeErrors, 0 differences; 0 ambient calls;
  0 dependency keys (`89bb317`)
- REQ-4.14 (ordinary boxes) — Tables E, A, F and G reproduced; engine ≡ exact over 816 sequences;
  0 violations of I1–I10 and J1–J8 over 1,669,698 states (`d7762ec`)
- 🚦 REQ-4.14 — the exit verdict **PASS**, evaluated once (`de425e9`)
- REQ-4.15, NFR-4.1, NFR-4.5, NFR-4.7, REQ-4.11 — 100% coverage; 17 / 17 mutations caught with 0
  deviations; ~10.2–11.3 s on Windows mains power against 20 s; nothing outside `packages/game/src`
  but `verification.md`; Phase 3's files changed only at specs.md §2.9's places (`8834255`)
- REQ-4.16 — one test given the suite's 120 s ceiling after it timed out on Ubuntu CI (`07e615e`);
  then 5 / 5 on a fresh Windows clone and green CI (`cd16379`)

## Still unchecked

None.

## What the user needs to decide

Whether Phase 4 is complete: its exit criterion — a scripted full match runs end to end in tests and
produces a correct round log — now has ticked boxes with measured values behind it, and both verdict
gates returned PASS. Writing that verdict means setting the roadmap's Phase 4 status and its
"Completed Work" entry (with the findings to carry forward), updating `CLAUDE.md`'s status paragraph,
deleting this note, and deciding whether to merge PR #31. Five recorded facts bear on it. First, the
first CI run failed: `match-purity.test.ts`'s ambient-spy pass took 5,375 ms on Ubuntu against
Vitest's default 5,000 ms per-test timeout; `07e615e` gave it the 120 s ceiling every other heavy
pass already carries, and changed no assertion, sample, threshold or configuration. Second, the test
suite's CI time grew from Phase 3's 10.98 s to 28.43 s (Vitest Duration, all six projects in
parallel; `@nel3ab/game`'s heaviest files 11–23 s each on CI), while Windows stays at ~10.4–11 s
against the 20 s budget — every later phase that adds tests inherits that cost. Third,
`draw.test.ts` carries one `// prettier-ignore`, so that the prototype's shuffle line can be held
character for character (`.5`, which Prettier would rewrite as `0.5`); it is not on the escape-hatch
list. Fourth, NFR-4.1 / NFR-4.7's box reads "no other `specs/` file" and, unlike Phase 3's version,
names no exception for the roadmap at close; it was measured over the implementation commits, and a
closing commit that edits `specs/roadmap.md` and `CLAUDE.md` falls outside what it measured. Fifth,
the Windows half of REQ-4.16 had to be measured from a clone at a short path: a clone under the
session scratchpad failed `pnpm test` at start-up because a path inside `node_modules` exceeded
Windows' 260-character limit on this machine (LongPathsEnabled = 0).

Carried forward by the plan itself, binding on later phases and checkable by nothing in Phase 4:
Phase 5's browser and Phase 11's server must send `passTurn` after their ticks, must draw with
`drawableCategories`, `drawCategory` and `shuffleQuestions` and a real random source, and must never
dispatch Phase 3's `startRound` primitive — Phase 11 maps the wire's `startRound` message onto
`startMatch`. On a tie the prototype's winners line names team A's players; `matchWinner` returns
`null`, and Phase 7 decides what the line says.

This note is deleted when the verdict is written.
