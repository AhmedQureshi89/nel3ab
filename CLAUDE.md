# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

نلعب (Nel3ab) — an Arabic-first, RTL party trivia game for people sitting in the same
room. One host runs a "judge" screen; players join from their phones with a 6-character
code, no account and no app install. See `specs/mission.md` for the product constitution
and `specs/tech-specs.md` for the target architecture.

The repo is currently a **greenfield monorepo skeleton**. Phase 1 (repo, toolchain, CI)
is **complete** as of 2026-08-19 — 38/38 verification boxes with measured values, and its
🚦 stack-compatibility verdict gate returned PASS. Phase 2 (Arcade design system) is **in
progress** since 2026-08-20: its triad is written and 1 of 35 boxes is ticked — Gate 0, the
font redistribution licence verdict gate, returned PASS (both families are SIL OFL 1.1, read
from their own upstreams; the two licence texts are committed at `apps/web/app/fonts/` and no
font binary is committed yet). Every workspace package is still a deliberate shell exporting
`PLACEHOLDER`: the rules engine, protocol, content and UI primitives are owned by later
phases and are intentionally absent — do not "fill them in" outside their phase.

## Commands

Node 24 (`>=24 <25`) and pnpm 11.22.0, pinned via `packageManager`. Run everything from
the repo root.

```bash
pnpm install --frozen-lockfile   # never plain `pnpm install` in CI or a fresh clone

pnpm lint        # eslint . && stylelint "**/*.css" && prettier --check .
pnpm typecheck   # tsc --build across all six project references
pnpm test        # see below — NOT bare `vitest run`
pnpm build       # pnpm -r build: tsc --build in packages, next build in apps/web
```

Those four commands are the phase gate and the CI job, in that order. A change is not
done until all four are green.

**Dev server:** `pnpm --filter nel3ab-web dev`

**Running a subset of tests:** call Vitest directly — `pnpm vitest run packages/game/src/index.test.ts`,
or `pnpm vitest run -t "substring"`. Two traps:

- `vitest run --dir <path>` does **not** filter. Each project sets its own `root` in
  `vitest.config.ts`, which overrides `--dir`, so it silently runs the whole suite and exits 0.
- `pnpm test` forwards extra args to the wrapper, but the wrapper asserts that _every_
  workspace project contributed a test file, so it will fail on any filtered run. Use it
  for the gate, use `pnpm vitest` for iteration.

## Layout and dependency direction

Six workspace projects: `apps/{web,game}` and `packages/{game,protocol,content,ui}`.

```
packages/game ──▶ packages/protocol
      │                  │
      │                  ├──▶ apps/game  (Fastify + Web PubSub server; shell)
      │                  │      ▲
      │                  │      └── packages/content
      └──────────────────┴──▶ apps/web   (Next 15 App Router)
                                 ▲
                                 └── packages/ui
```

`apps/web` depends on `ui`, `protocol` and `game`; `apps/game` on `content`, `protocol`
and `game`. Neither app depends on the other, and `content` and `ui` never meet.

- `@nel3ab/game` — pure rules engine: reducer, clock maths, round/match flow. No React,
  no sockets, no timers. Phases 3–4.
- `@nel3ab/protocol` — Zod schemas + types for every WS message, both directions. Phase 11.
- `@nel3ab/content` — the question bank as versioned JSON under
  `packages/content/categories/` plus loader and validation. Not a database table. Phase 8.
- `@nel3ab/ui` — Arcade tokens and primitives, shared by landing, judge and player. Phase 2.

**Packages are consumed as TypeScript source**, not built output: each manifest points
`main`/`types`/`exports` at `./src/index.ts`. Two consequences worth knowing before you
add a dependency — `apps/web/next.config.ts` must list every workspace package it imports
in `transpilePackages`, and the root `tsconfig.json` is a solution file (`files: []`)
whose `references` must list any new project.

## Invariants that are easy to break

Each of these is load-bearing and cost real measurement to establish. The rationale is in
a comment at the top of the file in question — read it before changing the file.

1. **The CI job is named `ci`, and that string is required by branch protection.**
   Renaming the job in `.github/workflows/ci.yml` silently un-protects `main`: the
   required check would never report. If it must change, change the GitHub ruleset in the
   same commit.

2. **`pnpm test` runs `scripts/check-collected-tests.mjs`, not `vitest run`.**
   `passWithNoTests: false` only fails when the _whole_ run collects nothing — a single
   project dropping out of collection still exits 0 (measured). The script runs Vitest
   once with the JSON reporter and asserts that every workspace project on disk
   contributed at least one collected file, with the expected count derived from the
   workspace rather than hard-coded. Replacing it with bare `vitest run` reintroduces
   vacuous green.

3. **`stylelint.config.mjs` is the RTL guardrail and the only automated defence of it.**
   ESLint cannot parse `.css`. The two rules ban physical `left`/`right` properties and
   values on the **inline axis only** — `top`/`bottom`/`*-block-*` are deliberately
   allowed, because false positives train people to write `stylelint-disable`. Do not
   disable, narrow, weaken, or "tighten into the block axis".

4. **Versions are pinned exactly — no `^`, no `~`, anywhere in any of the 7 manifests.**
   No `pnpm.overrides`, no `peerDependencyRules`, no `--no-strict-peer-dependencies`, no
   `skipLibCheck` beyond `tsconfig.base.json`, no `@ts-expect-error` in config or shells.
   Reaching for any of those to make a resolution succeed fails the phase's verdict gate.
   (TypeScript is held at 5.9.3 rather than latest because `typescript-eslint@8.67.0`
   peers on `<6.1.0`.)

5. **`design/` is the committed reference of record and is never linted, formatted, or
   edited.** It is high-fidelity: every colour, radius, border width and animation
   duration is a decision. When implementation and prototype disagree, the prototype wins
   until someone amends the spec. It is HTML to reproduce, never code to copy.

6. **`specs/` is prose of record, read-only during implementation, and Prettier-ignored**
   (formatting it reflows ~800 lines and mis-pads the Arabic table cells).

7. **`eslint-config-prettier` is spread last in `eslint.config.mjs`.** Prettier is the
   sole formatter; nothing below that line may re-enable a formatting rule.

8. **LF everywhere.** `.gitattributes` (`* text=auto eol=lf`), `.editorconfig` and
   `prettier.config.mjs` (`endOfLine: 'lf'`) must agree, or Windows-local and Ubuntu-CI
   fight forever.

9. **Vitest 4 multi-project config lives in `vitest.config.ts` under `test.projects`.**
   `vitest.workspace.ts` was removed in v4 and is deliberately absent. `apps/web` needs
   the `oxc.jsx` override there because its tsconfig sets `jsx: "preserve"` for Next.

10. **The font licences live beside the fonts, and moving them breaks the licence.** Both
    families are SIL OFL 1.1, whose second condition is that the copyright notice and licence
    accompany every copy — so `apps/web/app/fonts/LICENSE-*.txt` must stay in the same
    directory as the binaries, verbatim. `README.md` there records provenance and SHA-256s
    taken _after_ a commit and a fresh checkout, because that is the only hash that says
    anything about what git stored. Any new font family repeats the Gate 0 licence check
    before its bytes are committed; this repository is public.

## Product rules that constrain code

From `specs/mission.md` §3 and §5 — these are not style preferences:

- **Answer secrecy is structural.** The correct answer, its variants and its trivia fact
  reach the judge's client and no other. The player payload is built from scratch with
  only player-safe fields — never by deleting fields from a judge payload, and never by
  hiding them in CSS. Any answer datum reaching a player connection is a P0 defect.
- **RTL is the starting point, not a translation.** `dir="rtl"` and `lang="ar"` on the
  root; layouts mirrored from the start; Latin/numeric runs direction-isolated.
- **The Arcade look is specific:** 2.5–3px ink borders, hard offset shadows with zero
  blur, 14–28px radii, buttons that press down via `translateY` while the shadow shrinks
  by the same amount — never a scale, never an opacity fade. Softening it into flat or
  material styling is a regression even when it looks cleaner.
- **The server owns the clock.** Clients render a reconciled view and never decide that a
  round ended.
- **Players never sign up.** Nothing may add a step to the player join path.

## How work is planned and landed

This is a spec-driven project. `specs/` holds the constitution (`mission.md`,
`tech-specs.md`, `roadmap.md`) and one triad per phase:
`specs/phase-N/{requirements,specs,verification}.md`. The `/spec-phase`, `/spec-next` and
`/spec-run` skills author and execute them.

- `roadmap.md` has the 24-phase table and current status. `specs/phase-1/RUN-HALTED.md`
  is a closed historical record of where the one autonomous run halted and why — read it
  for the halt discipline it demonstrates, not for current state.
- `verification.md` is the checklist of record; a requirement is done when its gate is
  ticked with measured evidence, not when the code looks right. Gates marked 🚦 are
  **verdict gates: evaluated exactly once, no retry.**
- **A requirement that contradicts `mission.md`, `tech-specs.md` or `roadmap.md` may not
  be adopted without a dated amendment in `mission.md` §8.** Amendments are appended,
  never rewritten, and record what the decision costs. Write the amendment _before_ the
  run it governs.
- One requirement per commit. `main` is protected: no direct pushes, PR required, `ci`
  must be green before merge. Branch names follow `req-1-6-build-all-six` /
  `nfr-3-offline`.
- The repository is **public** (see amendment A-1) — a deliberate trade to obtain branch
  protection on GitHub Free.

## Working preferences

- **Summarize in plain language first.** When presenting a plan, a spec, or verification
  steps, lead with short bullets and no jargon. Detail comes on request, not by default.
- **After coding, split open questions into BLOCKING and NON-BLOCKING.** Blocking means
  the work cannot be finished correctly without an answer — act on those now.
  Non-blocking means nice-to-have or future work — list them and stop. Do not implement a
  non-blocking item without an explicit go-ahead.
- **Scope a plan to exactly what was asked.** Do not expand into adjacent features, tech
  stack decisions, or roadmap items unless explicitly asked for that.
