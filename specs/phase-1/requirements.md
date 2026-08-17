# Phase 1 Requirements — Repo, toolchain & CI

> **Phase Status:** Ready for Implementation
> **Parent Roadmap:** [../roadmap.md](../roadmap.md)
> **Constitution:** [../mission.md](../mission.md) · no binding amendment · no proposals in force
> **Duration:** 1 day

---

## 1. Overview & Objectives

Phase 1 builds a monorepo that **builds, lints, typechecks, tests and deploys nothing — correctly.** No product behaviour ships. What ships is the set of guardrails every later phase leans on, and the cost of getting them wrong is paid quietly for months rather than loudly today.

This phase is greenfield. Two commits exist on `main`: the constitution triad and the design handoff. There is no `package.json`, no `apps/`, no `packages/`, no CI, and no GitHub remote.

The sharpest version of the question this phase answers: **does the pinned stack — pnpm workspaces, TypeScript strict with project references, Next.js 15 App Router, Vitest, ESLint, Stylelint, Node 24 — actually hold together on a Windows dev machine *and* a Linux CI runner, from a fresh clone?** Every later phase assumes yes. Nothing has tested it.

Two guardrails carry disproportionate weight and are the reason this phase is worth a full day rather than an hour:

1. **The RTL guardrail.** Mission §3 (Arabic-First RTL) makes mirrored layout a product pillar. Phase 2 ports 4KB of Arcade tokens and every UI primitive on top of it, and Phases 5–7, 13–14 build every screen on that. A physical `left`/`right` that slips through is invisible in an RTL browser test *until* someone views a mirrored layout and the padding is on the wrong side. The guardrail must exist and must be **proven to fire** — a lint config that is present but matches nothing is worse than no config, because it reads as protection.

2. **The vacuous-green trap.** Every command in the exit criterion can pass while proving nothing: `pnpm build` with no build steps, `pnpm test` with no tests collected, `pnpm typecheck` with no source files. A green wall that means nothing is the single most likely way this phase fails, and it fails *silently*, so verification treats it as a first-class risk rather than a footnote.

### Amendment discipline (binding on this phase)

Phase 1 requires **no amendment**. It introduces no threshold, no widened bound, and no formulation not already in `mission.md` or `tech-specs.md`. Every choice below traces to an existing decision:

| Requirement source | Recorded in |
|---|---|
| Node 24, Next.js 15 App Router, TypeScript strict, Zod, CSS Modules | `tech-specs.md` §2.1 |
| Fastify + Node 24 for the game server | `tech-specs.md` §2.2 |
| Six workspace packages, `@nel3ab/*` naming | `tech-specs.md` §2.3 |
| Question JSON at `packages/content/categories/` | `tech-specs.md` §2.5 |
| `dir="rtl"` / `lang="ar"` at the root | `mission.md` §3, `tech-specs.md` §2.1 |
| Managed/boring over clever; one person must debug it at 1am | `mission.md` §5.5 |
| Private repo under the personal account; `main` protected | `roadmap.md` Phase 1 |

> **Noted gap, not blocking:** `mission.md` has no §10 amendment log — it ends at §7. The skill's amendment discipline points at "§10 or that project's equivalent," and this project has no equivalent. The first phase that genuinely needs an amendment will have nowhere to record it. Adding an amendment log is **not** in this phase's scope; it is flagged so the omission is a known one rather than a surprise.

---

## 2. Detailed Functional Requirements

This is a one-day phase, so requirements are grouped by workstream rather than by day. Dependency order is specified in [specs.md](specs.md) §1 and is not the same as the order below.

### 2.1 Workspace foundation

**REQ-1.1 — pnpm workspace with the six declared projects**
The repo resolves as a single pnpm workspace containing `apps/web`, `apps/game`, and `packages/{game,protocol,content,ui}`, with packages named `@nel3ab/{game,protocol,content,ui}`. Question JSON belongs at `packages/content/categories/`, not a root `content/`.
*Why:* `tech-specs.md` §2.3 makes the rules engine shareable between the Next.js app and the game server; that is only possible if both resolve the same workspace package. Freezing the layout now means Phases 3–14 never have to move files. The content path keeps `@nel3ab/content` self-contained so no workspace glob needs a special case.

**REQ-1.2 — TypeScript strict everywhere, from one shared base**
A single `tsconfig.base.json` holds the strict compiler settings; every project extends it and declares project references to its workspace dependencies. `pnpm typecheck` typechecks all six projects.
*Why:* the answer-secrecy pillar (`mission.md` §3) is enforced *by the type system* in Phase 12 — the player payload type has no `answer` field, so a leak is a compile error. That defence is worth exactly as much as `strict` is consistent. One project silently on loose settings is a hole in a product pillar.

**REQ-1.3 — Deterministic line endings**
A `.gitattributes` normalises text files to LF in the index, with binary types (fonts, images) excluded from normalisation. Files already committed are renormalised in this phase.
*Why:* development is on Windows (CRLF checkout) and CI runs on Linux. Without this, the first CI run produces whole-file phantom diffs and Prettier/ESLint disagree with themselves across platforms. Git already warned about exactly this when the spec edits were committed.

### 2.2 Application and package shells

**REQ-1.4 — Next.js 15 App Router shell that is RTL from its first render**
`apps/web` is a Next.js 15 App Router app whose root layout emits `<html lang="ar" dir="rtl">`, serving one placeholder page. Workspace packages are consumed as TypeScript source.
*Why:* `mission.md` §3 — "not an English app with Arabic strings poured in. Every screen is `dir="rtl"` and laid out mirrored from the start." Setting it at the root on day one means no screen is ever authored LTR-first and retrofitted, which is how mirrored layouts acquire permanent bugs.

**REQ-1.5 — Package shells only, with no rules-engine logic**
Each of the four `packages/*` and `apps/game` exists with a valid manifest, tsconfig, and a minimal `src/index.ts`. **`@nel3ab/game` contains no reducer, no clock, and no rules logic.**
*Why:* `tech-specs.md` §2.3 previously claimed the rules engine was "built first, in Phase 1"; that contradiction was corrected (commit `fc940d6`) in favour of the roadmap, which builds it in Phases 3–4. A one-day phase cannot absorb the game's hardest logic, and Phase 3 owns the test coverage that makes that logic trustworthy.

### 2.3 Guardrails

**REQ-1.6 — Test harness that fails loudly when it collects nothing**
Vitest runs across the workspace, with one real assertion per project. `pnpm test` reports a collected-test count matching the number of projects, and a project whose tests fail to collect fails the command rather than passing quietly.
*Why:* the vacuous-green trap. `pnpm test` reporting "0 passed" as success would make every later phase's test gate meaningless while looking identical to a healthy run.

**REQ-1.7 — ESLint + Prettier across all projects**
One flat ESLint config at the root covering every project's TS/TSX, with Prettier as the sole formatter and no rule conflicts between them.
*Why:* `mission.md` §5.5 — one person maintains this. Divergent per-package configs are a 1am debugging tax.

**REQ-1.8 — Stylelint enforcing logical properties (the RTL guardrail)**
Stylelint runs over all CSS and CSS Modules. Physical inline-axis properties — `left`, `right`, `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left*`, `border-right*`, and `text-align: left|right` — fail lint wherever a logical inline-start/end equivalent exists. `pnpm lint` runs ESLint and Stylelint together, so there is no way to satisfy the exit criterion while skipping one.
*Why:* ESLint does not parse `.css`, so the roadmap's original "ESLint with an RTL-safe rule set" could never have enforced anything. Mission §3 makes mirroring a pillar; this is the only automated defence of it. Block-axis physical properties (`top`, `bottom`, `margin-top`, …) are **not** restricted — they are unaffected by direction and banning them is noise that trains people to disable the rule.

**REQ-1.9 — The RTL guardrail is proven to fire**
A deliberate violation, introduced in a real CSS Module in the repo, must make `pnpm lint` exit non-zero. The proof is recorded in `verification.md` and the violation removed.
*Why:* a configured-but-matching-nothing linter is the specific failure this requirement exists to exclude — wrong glob, wrong `ignoreFiles`, CSS Modules not covered by the file pattern. A guardrail nobody has watched fail is an assumption, not a guardrail.

### 2.4 Remote and CI

**REQ-1.10 — Private GitHub repo under the personal account**
A private repo named `nel3ab` exists under the personal account (`a.alshareef.89@gmail.com`), `main` pushed, remote tracking configured.
*Why:* the question bank is the commercial asset — `mission.md` §4 sells the expanded bank and three paid categories. A public repo gives it away. Under the personal account rather than the work account (`ahmed@tadawulcom.sa`) because this is not Tadawulcom's product.

**REQ-1.11 — `main` protected against direct pushes, with CI required to merge**
Direct pushes to `main` are rejected. Merging requires the CI check to pass. If classic branch protection is unavailable on the account's plan, a repository ruleset achieves the same, and protection applies to the repository owner too — not just to other contributors.
*Why:* `mission.md` §5.4 — "every question, accepted variant, hint and trivia fact is human-verified before it merges — no exceptions." That gate is a pull request. A solo developer who can push to `main` will, at 1am, and the review gate that protects factual accuracy evaporates. Owner-bypass is the specific hole that would make this requirement decorative for a one-person project.

**REQ-1.12 — CI runs the full gate on every pull request**
A GitHub Actions workflow runs `lint`, `typecheck`, `test` and `build` on Node 24 for every PR targeting `main`, from a frozen lockfile.
*Why:* the exit criterion. Running the same four commands locally and in CI is what makes "green" mean one thing.

**REQ-1.13 — The design handoff is the committed reference of record**
`design/` remains committed, unmodified, as the reference implementation.
*Why:* `mission.md` §5.3 — "the prototypes are the specification… when implementation and prototype disagree, the prototype is right." Already satisfied by commit `ca16ff5`; recorded so the phase's checklist is complete and so nothing later "tidies" it away.

---

## 3. Non-Functional Requirements

| # | Requirement | Why |
|---|---|---|
| NFR-1 | **Fresh-clone reproducibility.** A clone into an empty directory, `pnpm install --frozen-lockfile`, then the four commands, succeeds with no manual step, no `.env`, and no global install beyond Node 24 + pnpm. | The exit criterion says "from a fresh clone." It is also how CI runs, and how this project is recovered if the machine dies. |
| NFR-2 | **Cross-platform parity.** The four commands behave identically on Windows (dev) and Ubuntu (CI). No script depends on a shell builtin, path separator, or tool absent on either. | The whole team is one person on Windows; every merge is judged by a Linux runner. Divergence here is discovered at the worst moment. |
| NFR-3 | **Offline-testable.** Nothing in the four commands requires network, Azure credentials, a database, or a running service. | Phases 3–8 are meant to be playable and testable with no server (`roadmap.md` Milestone A). The toolchain must not be the thing that breaks that. |
| NFR-4 | **Pinned versions.** A committed lockfile and an explicit `packageManager` field. No floating major ranges on the framework, test runner, or linters. | Reproducibility, and so that a toolchain break is a deliberate upgrade rather than a Tuesday surprise. |
| NFR-5 | **No secrets.** No credential, connection string, or token in the repo, and no `.env` needed to satisfy the gate. | `tech-specs.md` §7 — secrets live in Key Vault. The habit is set now, before there is anything worth leaking. |

---

## 4. Explicit Non-Goals

An implementer that wants to do any of the following must **stop**, not proceed:

| Not in this phase | Where it belongs |
|---|---|
| Any rules-engine logic — reducer, clock, spend, round/match flow | Phases 3–4 |
| Porting `arcade-tokens.css`, any UI primitive, any `Panel`/`Button`/`Pill` | Phase 2 |
| Self-hosting fonts (Baloo Bhaijaan 2, Archivo), `next/font/local` setup | Phase 2 |
| Any real screen — setup, ready, play, join, lobby | Phases 5–7, 13–14 |
| Theme switching, `data-theme`, dark mode | Phase 2 |
| Question content, the content schema, Zod validation of categories | Phase 8 |
| Dockerfiles, Bicep, Azure resources, deployment, `/healthz` | Phase 9 |
| Web PubSub, `/negotiate`, WS protocol, Fastify routes | Phases 10–11 |
| Drizzle schema, Postgres, migrations | Phase 9 |
| Any authentication, subscription, or admin surface | Phases 17–19 |
| A `CLAUDE.md` or `.claude/settings.json` for the repo | **Deferred pending a decision** — useful, not yet agreed, and not in the roadmap checklist |
| An amendment log in `mission.md` | Deferred; flagged in §1 above |
| Resolving the open questions (judge disconnect, team cap, locked-category purchase, the 2-vs-3 locked-category discrepancy) | Phases 16, 23, 20, 8 respectively |

Two further boundaries, stated because they are the tempting kind:

- **Do not add a dependency the phase does not need to pass its own gate.** No Zod, no Fastify, no Drizzle, no React Testing Library. `tech-specs.md` names them; the phase that uses one installs it.
- **Do not "improve" the design handoff** — not formatting, not the debug top bar, not the `<image-slot>` placeholders. It is a reference to reproduce, and its diffs must stay meaningful.

---

*Last updated: 2026-08-17*
*Author: Ahmed Alshehri (a.alshareef.89@gmail.com)*
