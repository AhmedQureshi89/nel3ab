# Run halted — 2026-10-11

**Reason:** a subagent reports that a gate's wording must change before its box can be ticked
truthfully — the plan is being questioned, which is the owner's call (`/spec-run`, Step 3).
**At:** Gate 2, box "REQ-6.6 – REQ-6.11 (The markup)" — the first box of build step 3 (specs.md
§1, STEP 2, first half: `PlayScreen.tsx`, `play.module.css`, `play-markup.test.tsx`).
**Measured:** the three files are written and pass every gate command — `pnpm lint` exit 0,
`pnpm typecheck` exit 0, `pnpm test` 44 files across 6 projects, **728 / 728**,
`[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 ·
statements 244), `pnpm build` exit 0. They are **untracked and uncommitted** at
`apps/web/app/host/{PlayScreen.tsx,play.module.css,play-markup.test.tsx}`; HEAD is `35e3ae8`;
no box of build step 3 is ticked.

## The conflict

`verification.md` line 433, in the box "REQ-6.6 – REQ-6.11 (The markup)", says **"`data-spent`
true on S2–S3 only"**. Every other source of the plan makes it true on S2–**S4**:

- specs.md §2.2 and §2.3 key `data-spent` on the view's `hintSpent`, which is `hintIndex > 0` —
  the prototype's `hintColor` and `hintAnim` (`s.hintIdx > 0`).
- Table X4 (S4) is "every other field as X3", so `hintSpent` is true on S4; Gate 1 already pins it
  (`play-view.test.ts`, commit `21ca043`).
- In the prototype `markCorrect` does not reset `hintIdx`; under the reveal the hint text stays ink
  with `slidein` (measured in planning: S4 changed only the reveal's roles from S3).

A screen that made S4 false would break S4's comparison with the prototype under REQ-6.17. The
subagent's test asserts false · true · true · true · false on S1–S5.

A second wording slip of the same kind was found beside it: Table B's preamble (line 229) says
"Every role not named here is as in Table A", but the table is cumulative — read literally, clock A
on S4 would be Table A's 45 rather than S3's 41, and S5's row re-lists the hint text as placeholder,
which only makes sense if S4's was the spent hint. Gates 4 and 6 read Table B.

Both slips were made in the planning session (commit `4ad02c2`). Neither changes a measured value;
both change what a box says.

## Completed this run

- Gate 1, REQ-6.1 – REQ-6.5 — the play view gives every value of Table X (commit `21ca043`)
- Gate 1, REQ-6.15 and REQ-6.13 — Table V replays through the driver in CI; the three judge actions
  reach the engine as exactly hint 3, skip 2, correct 2, 0 `startRound` (commit `35e3ae8`)

## Still unchecked

- Gate 2: REQ-6.6 – REQ-6.11 (markup), REQ-6.12 (glyphs), REQ-6.11 / REQ-6.13 (buttons), REQ-6.13
  (route), NFR-6.4, NFR-6.5, NFR-6.6
- Gate 3: REQ-6.14
- Gates 4, 5 and 6 — Gate 4 needs the browser and returns to the session that owns it

## What the owner needs to decide

Whether `verification.md` receives a dated correction, made before the boxes it governs are
evaluated (as Phase 5's two corrections of 2026-10-03 were), that (1) changes the markup box's
"`data-spent` true on S2–S3 only" to S2–S4, and (2) states that each state in Table B inherits every
role it does not name from the state before it (S2 from S1, S3 from S2, S4 from S3, S5 from S4)
rather than from Table A. The alternatives are to rule otherwise (for example, that the screen should
show the hint muted under the reveal — a departure from the prototype that would need its own
decision) or to send the plan back to a planning session. Until it is decided, the three untracked
files above should not be committed, and no box of Gate 2 is ticked.
