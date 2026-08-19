# Run halted — 2026-08-18

> ## CLOSED 2026-08-19. This file is a historical record, not current state.
>
> Everything below describes the repo as it stood on 2026-08-18 and is preserved
> unedited. Three of its statements are no longer true, and are listed here rather than
> corrected in place, so the halt and its resolution both stay legible:
>
> | Says below | Now |
> |---|---|
> | "36 of 38 boxes ticked" | **38 of 38**, each with a measured value |
> | "Gate 7 — not evaluated" | Evaluated **once** on 2026-08-19 at `2961449`: **PASS**. Recorded in `verification.md` §7 |
> | "No verdict has been written into `roadmap.md`. Phase 1 still reads 🛠️ In Progress" | The user marked Phase 1 **✅ Completed** on 2026-08-19 |
>
> The three amendments this file asked a `/spec-phase` session to settle were settled on
> 2026-08-18 (`077a2f9`), and REQ-1.6/R3 was re-ticked on 2026-08-19 (`87e2915`) once
> `pnpm build` was widened to all six projects. The two carried-forward findings it names
> — the public repository and the un-enforced review requirement — are **not** closed by
> any of that; they are recorded in `mission.md` A-1/A-2/A-3 and are binding on Phase 8.
>
> **What this file is still worth reading for:** it is the record of a run that stopped at
> 37/38 rather than evaluate an ambiguous verdict gate, and of six probes that were found
> narrower than their wording. That discipline is the reusable part.

**Reason:** The phase's remaining check is a 🚦 verdict gate whose own text is
ambiguous, and a verdict gate cannot be retried. Amending gate text is a planning act.
The user directed that the wording be corrected in a `/spec-phase` session **before**
the gate is evaluated, so that it is evaluated exactly once, against text that means
one thing.

**At:** Gate 7 — 🚦 REQ-1.2 / NFR-2 / NFR-4 (Pinned stack holds). **Not evaluated.**
Left byte-identical.

## State

**36 of 38 boxes ticked. Gates 1–5 complete; Gate 6 complete except REQ-1.6/R3, which
was deliberately un-ticked (below).** `main` is protected, public, CI green.

## Completed this run

One requirement per commit:

| Requirement | Outcome | Landed |
|---|---|---|
| REQ-1.2 | strict declared once; 6/6 projects typecheck; TS pinned 5.9.3 over latest 7.0.2 to avoid a peer escape hatch | `80ba4b9` |
| REQ-1.5 | shells carry no rules-engine logic; 14 dependency entries, none premature | `b403895` |
| REQ-1.6 | `pnpm test` collects 6/6 projects and fails when one drops out | `204180b` |
| REQ-1.1/NFR-4 | lockfile in sync; zero `^`/`~` across all 7 manifests | `462a2a7` |
| NFR-5 | no secrets; grep proven able to fire, 50 tracked files scanned | `a888479` |
| REQ-1.7 | ESLint 17 files across all six projects; Prettier 33; both proven able to fail | `08217fd` |
| REQ-1.8/1.9 | the RTL guardrail watched failing twice — two rules, two packages, output verbatim | `56695b1` |
| REQ-1.4 | `<html lang="ar" dir="rtl">` over HTTP, 200 / 4307 B; risk R6 met and survived | `9b39a1f` |
| REQ-1.13 | `design/` tree hash byte-identical at `ca16ff5` and `HEAD` | `27e2b77` |
| REQ-1.10 | repo created, verified private at the time, single author email | `9bd2812` |
| REQ-1.11 | direct push rejected `GH013` as owner; ruleset `bypass_actors: []` | PR #1 `508887d` |
| REQ-1.12 | four commands proven from run logs on Node v24.19.0; merge refused while pending | PR #2 `7462a0e` |
| NFR-1 | real clone from the remote: **282 s cold, ~60 s warm** | PR #3 `f8c5a2f` |
| NFR-3 | four commands green offline under three independent blocking methods | PR #4 `bd7c8d5` |
| REQ-1.6/R3 | 115 artifacts from a deleted tree — **then un-ticked, see below** | PR #5 `aa4e447` |

## Still unchecked

1. **REQ-1.6 / R3 (Build produces artifacts)** — un-ticked on the user's explicit
   instruction. The measurement is accurate and stands; the tick does not. The box
   requires "compiled output for **each package**", and `@nel3ab/ui` emits none under
   `pnpm build`, because `specs.md` §2.3 scopes the root script to `apps/*`. The
   implementation matches its spec verbatim — the box and §2.3 disagree with each
   other. `@nel3ab/ui` does emit under `pnpm typecheck`, so nothing is broken.
2. **Gate 7 — 🚦 verdict gate** — not evaluated, pending the wording amendment.

## What the /spec-phase session must settle

Three amendments, in descending order of consequence:

1. **REQ-1.10 is now false as recorded.** Its "Private" box is ticked with a measured
   `isPrivate: true`, taken truthfully at the time. The user then chose to make the
   repository **public** — on 2026-08-18, in order to obtain branch protection, which
   GitHub Free grants on public repositories only. REQ-1.10 and REQ-1.11 could not both
   hold on a Free plan. The amendment must record the decision *and* its consequence:
   `mission.md` §4 sells the expanded question bank, and from Phase 8 onward that bank
   will sit in a world-readable repository. Nothing in this phase resolves that.
2. **Gate 7's wording.** It names "ESLint 9"; `specs.md` §2.12 says "ESLint 9+"; and
   **10.8.1** is installed and green on both platforms. Correct the gate to "ESLint 9+"
   so it matches §2.12, then evaluate once. Everything else in the gate is
   unambiguously satisfied — see the evidence below, gathered but deliberately not
   scored.
3. **REQ-1.6/R3 vs `specs.md` §2.3.** Either narrow the box's wording to the `apps/*`
   scope the script actually has, or widen the script to build every package. Phase 2
   owns `packages/ui` and will meet this first.

### Six gate commands narrower than their wording

Found during execution, worked around with corrected commands, real measurements
recorded, gate text left unedited. Four of them would have reported clean regardless of
what the code contained:

| # | Command | Defect |
|---|---|---|
| 1 | `git grep … -- "packages/*/src"` | pathspec wildcard matches **zero files** |
| 2 | `vitest run --dir does-not-exist` | **exits 0, all 6 files pass** — each project's `root` overrides `--dir` |
| 3 | `connection ?string` (NFR-5) | misses the underscore form, e.g. `WEBPUBSUB_CONNECTION_STRING` |
| 4 | `git diff ca16ff5..HEAD -- design/` | compares commits; blind to uncommitted edits |
| 5 | `passWithNoTests: false` | does **not** fail when a single project stops being collected |
| 6 | Gate 7's "ESLint 9" | contradicts §2.12's "ESLint 9+" |

### Two unratified deviations from `specs.md`

- `.prettierignore` covers `specs/`, which §2.13 does not authorise. Without it,
  Prettier reflows 799 lines of the read-only triad and mis-pads the Arabic table cells.
- `pnpm test` is `node scripts/check-collected-tests.mjs`, not §2.3's `vitest run`.
  Forced by defect 5 above; §2.9 explicitly authorises a Node script over the JSON
  output, so it follows the spec's intent while departing from §2.3's sketch.

### One governance gap to close before Phase 8

The ruleset requires a pull request but sets `required_approving_review_count: 0`,
because GitHub forbids self-approval and requiring 1 would deadlock a solo developer
into either disabling the rule or granting himself a bypass. REQ-1.11 is satisfied as
written — a PR *is* required — but `mission.md` §5.4's "every question… human-verified
before it merges — no exceptions" is **not** enforced by the ruleset. Every PR in this
run (#1–#5) was opened and merged by the same automated actor. Harmless for
verification prose; not harmless once Phase 8 puts questions in the repo.

### Gate 7 evidence — gathered, deliberately not scored

Recorded so the eventual evaluation is a reading of facts rather than a fresh
investigation. **This is not a verdict.**

- Four commands green on **Windows** (local, and a fresh clone) and on **Ubuntu** (CI),
  from a frozen lockfile. CI was green on the **first** attempt, both on `main` and on
  every PR.
- Runner-reported `node v24.19.0` on `ubuntu-24.04`; local `node v24.14.0` — the
  `engines: ">=24 <25"` range exercised at two points. pnpm 11.22.0 on both sides, from
  the `packageManager` pin.
- Pinned exactly, no ranges anywhere: `next 15.5.23`, `react`/`react-dom 19.2.8`,
  `typescript 5.9.3`, `vitest 4.1.10`, `eslint 10.8.1`, `stylelint 17.14.1`,
  `prettier 3.9.6`, `@types/node 24.13.3`.
- The escape-hatch grep returns **nothing**: no `pnpm.overrides`, no
  `peerDependencyRules` (`ignoreMissing` / `allowedVersions`), no
  `--no-strict-peer-dependencies`, no `skipLibCheck` beyond the base, no
  `@ts-expect-error`, no strict flag disabled, no floated range. Zero peer warnings on
  install.
- **R7 (cross-platform drift) and R8 (version incompatibility) did not materialise.**
- The one deliberate version choice: TypeScript **5.9.3** rather than the registry
  `latest` **7.0.2**, because `typescript-eslint@8.67.0` peers on `>=4.8.4 <6.1.0` and
  TS 6 has no stable release. `tech-specs.md` §2.1 pins no TypeScript version, so this
  is a pin, not a loosened constraint.
- The one unresolved reading: ESLint **10.8.1** against the gate's "ESLint 9".

**No verdict has been written into `roadmap.md`.** Phase 1 still reads 🛠️ In Progress.
