# Run halted — 2026-10-03

**Reason:** a pre-registered requirement of the plan cannot be met as written — a gate's text would
have to change, which is the owner's decision, not the run's.
**At:** REQ-5.7 — "The invariants, over the sample" (verification.md Gate 2, second box), and through
it Table U's population list.
**Measured:** the setup sample of specs.md §2.6, built exactly as specified (`SETUP_SEED = 0x20265005`,
300 sequences, `SETUP_MAX_STEPS = 2_000`, `SETUP_EDITS = 40`, `SETUP_TICK_MS = 1_000`): **0** of
**1,134** `openRoom` attempts refused by the guard. Table U requires at least one ("an `openRoom`
refused by the guard"). Every other population Table U requires is present: fills **1,045**,
`backToSetup` **288**, matches ended **600**, second `openRoom` after `resetMatch` **546**, inert setup
edits on `ready` **297** and on `roundEnd` **478**. Over 241,976 events, 404,434 actions and 404,734
states: **0** violations of I1–I10, J1–J8 and K1–K5. On the same sample: 1,861 `nextRound` draws,
Phase 4's fallback reached **0** times, J6 **0** failures. The pass takes ~0.23 s.

**Why it cannot be met, and why it is the plan's error, not the code's.** In the sample each of the 11
categories ends up picked or unpicked roughly 50/50, so the number picked at an `openRoom` attempt is
about Binomial(11, ½) — measured at every attempt as {1: 6, 2: 27, 3: 104, 4: 176, 5: 248, 6: 260,
7: 190, 8: 86, 9: 28, 10: 8, 11: 1}, against ~6.1 attempts with one category predicted. An empty
selection has probability ≈ 1/2,048 per attempt: **≈ 0.55** refusals expected over the sample, and
a **≈ 42%** chance of seeing even one. The planning session of 2026-10-02 pre-registered this
population without measuring it — the "measure before writing" lesson Phases 3 and 4 set, not
applied to Table U.

## Completed this run
- REQ-5.7 (Phases 3–4 green) — 384 / 384 of Phases 3–4's tests, 0 failed, 0 skipped, the `7a60dcc`
  count, all three of their verdict tests passing (commit `e9cac24`)

Completed before this run, by `/spec-next`:
- REQ-5.1 – REQ-5.6, NFR-5.4, REQ-5.7 (sanctioned edits) — the setup rules in the engine (`efb8265`)
- REQ-5.8 — the setup rules read from the prototype, 9 / 9 extractions (`7dc9b67`)

## Work set aside, not committed
The sample's three files — `testing/setup-sequences.ts`, `testing/setup-invariants.ts` and
`setup-flow.test.ts` — are complete except for the one population assertion that fails, and pass
lint, Prettier and typecheck. They are in this session's scratchpad, mirroring their repository
paths, under `…\scratchpad\req-5-7-sample\packages\game\src\`. The scratchpad is session-local: if it
is gone, the files are rebuilt from specs.md §2.6. Three readings the subagent made where §2.6's
wording was open are written into the generator's comments (a player id's `rand() < 0.8` drawn first;
"arrival on setup" = the start, a `backToSetup` or a `resetMatch`, the guard's `pickCategory('c0')`
not counted as an edit; K5 lets the judge move only on a `roundEnd → play` step with rotation on).
None changes the refusal count.

## Still unchecked
- Gate 2: REQ-5.7 (The invariants, over the sample) · REQ-5.7 (No path to the fallback) · NFR-5.3
  (Pure) · NFR-5.3 / NFR-5.2 (No ambient time, randomness or timers)
- Gate 3: all 3 boxes · Gate 4: all 12 · Gate 5: all 8 · Gate 6: all 6 · Gate 7: both

## What the user needs to decide
Table U's requirement that the setup sample show "an `openRoom` refused by the guard" is met by this
sample with probability ≈ 42%, and is not met at the pre-registered seed. It can be resolved by a
dated correction to verification.md written by a planning session, in one of two ways: remove that
one population from Table U, leaving the guard's refusal to the direct tests that already cover it
(Gate 1's REQ-5.6 and REQ-5.1 boxes, and E9); or change the generator of specs.md §2.6 so that empty
selections occur reliably — which changes the pre-registered sample, and whose new numbers would be
measured before the correction is written. Re-running with a different seed until a refusal appears
is not an option: it is the retry-into-green that verification.md §10 forbids.
