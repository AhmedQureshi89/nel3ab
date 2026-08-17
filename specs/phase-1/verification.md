# Phase 1 Verification & Test Plan — Repo, toolchain & CI

> **Phase:** Phase 1
> **Parent Requirements:** [requirements.md](requirements.md)
> **Parent Specification:** [specs.md](specs.md)

---

## Notation

| Marker | Meaning | On failure |
|---|---|---|
| `- [ ]` | ordinary check — tests *our code/config* | fix and retry freely |
| `- [ ] 🚦 **(VERDICT GATE — no retry)**` | measures *reality* | **halt.** Record the result. Never retry into green |

A verdict gate's failure is a finding, not a bug. `/spec-next` and `/spec-run` are required to stop at one. If a check's kind is unclear, it is a verdict gate.

**Gate ordering.** Gates 1 → 6 are sequential; each blocks the next. Gate 7 is the verdict gate and is evaluated **only after** Gate 6 has been reached, because a stack-compatibility finding is only trustworthy once our own config is known-good. A gate is passed when every box under it is ticked with the observed value written in.

---

## 1. Gate 1 — Repo hygiene (blocks every source commit)

Must pass **before** any `package.json` or source file is committed. Failing this later means renormalising history instead of setting a flag.

- [x] **REQ-1.3 (LF in the index):** `git ls-files --eol` reports `i/lf` for every text file in the repo — including the two `specs/*.md` files Git warned about, and the `design/**` files. Record the count of files checked and the count of non-`i/lf` text files (must be 0).
  **Measured 2026-08-17: 17 tracked text files, all `i/lf w/lf attr/text=auto eol=lf`; non-LF text files = 0.** `git add --renormalize .` produced **no content changes** — `core.autocrlf=true` had already stored LF for all 15 pre-existing files, so `.gitattributes` makes the guarantee explicit rather than repairing it. Consequence worth noting: `design/**` was not rewritten, so Gate 4's `git diff ca16ff5..HEAD -- design/` remains empty.
- [x] **REQ-1.3 (Binaries excluded):** no `*.woff2`/`*.png`/`*.ttf` path appears with a text eol attribute. (None exist yet; the check is that the attribute pattern is right, verified with `git check-attr text -- some/path.woff2`.)
  **Measured 2026-08-17:** `text: unset` for all four future paths tested — `packages/ui/fonts/example.woff2`, `.../example.ttf`, `public/example.png`, `apps/web/app/favicon.ico`. Contrast case `specs/mission.md` → `text: auto`, `eol: lf`.
- [x] **REQ-1.3 (Editor agreement):** `.editorconfig` exists with `end_of_line = lf`, and does not set `trim_trailing_whitespace` on `*.md`.
  **Measured 2026-08-17:** `end_of_line = lf` at `.editorconfig:5`; `[*.md]` section sets `trim_trailing_whitespace = false`.

## 2. Gate 2 — Workspace integrity & a non-vacuous harness (blocks Gates 3–7)

This gate is where the vacuous-green trap is defused. Every check below is a *count* or an *artifact*, never an exit code alone.

- [x] **REQ-1.1 (Six projects resolve):** `pnpm ls -r --depth -1` lists exactly six workspace projects: `nel3ab-web`, `nel3ab-game`, `@nel3ab/game`, `@nel3ab/protocol`, `@nel3ab/content`, `@nel3ab/ui`. Record the list.
  **Measured 2026-08-17** (pnpm 11.22.0, Node v24.14.0) — all six present, none missing, none extra:
  `nel3ab-game@0.0.0 → apps/game` · `nel3ab-web@0.0.0 → apps/web` · `@nel3ab/content@0.0.0 → packages/content` · `@nel3ab/game@0.0.0 → packages/game` · `@nel3ab/protocol@0.0.0 → packages/protocol` · `@nel3ab/ui@0.0.0 → packages/ui`. A seventh line, `nel3ab C:\Users\aalsh\Projects\nel3ab (PRIVATE)`, is the **root manifest**, not a workspace member (`pnpm-workspace.yaml` globs only `apps/*` and `packages/*`); pnpm's own banner correspondingly reads "Scope: all 7 workspace projects". Workspace edges resolved to symlinks, not registry fetches: `apps/web → {game,protocol,ui}`, `apps/game → {content,game,protocol}`, `packages/protocol → game`.
- [x] **REQ-1.1 (Content path):** `packages/content/categories/` exists and is tracked; no root-level `content/` directory exists.
  **Measured 2026-08-17:** `packages/content/categories/.gitkeep` tracked (27 tracked files total, up from 17). `ls -d content` → `No such file or directory`. `categories/` is data inside `@nel3ab/content`, matched by no workspace glob.
- [x] **REQ-1.2 (Strict, once):** `strict: true` appears in `tsconfig.base.json` and in **no** other tsconfig. Every project tsconfig extends the base. Record the six extends lines.
  **Measured 2026-08-17:** `grep -rn '"strict"' --include=tsconfig*.json` over the repo returns exactly **1 hit** — `tsconfig.base.json:5`. The six extends lines, all identical:
  `apps/game/tsconfig.json:2` · `apps/web/tsconfig.json:2` · `packages/content/tsconfig.json:2` · `packages/game/tsconfig.json:2` · `packages/protocol/tsconfig.json:2` · `packages/ui/tsconfig.json:2` — each `"extends": "../../tsconfig.base.json"`. No project overrides a strictness flag; `apps/web` overrides only `lib`, `module`, `moduleResolution`, `jsx`, `noEmit`, `resolveJsonModule`, `plugins`, and the `packages/*`/`apps/game` projects override only `module`/`moduleResolution`/`rootDir`/`outDir`.
- [x] **REQ-1.2 (References are real):** `pnpm typecheck` (`tsc --build`) succeeds **and** emits a `.tsbuildinfo` for each of the six projects. Six files, not five — a missing one means a project is outside the solution graph and is not being typechecked at all.
  **Measured 2026-08-17:** `pnpm typecheck` exit 0. `find . -name "*.tsbuildinfo" -not -path "*/node_modules/*"` → **6 files**: `apps/game/` · `apps/web/` · `packages/content/` · `packages/game/` · `packages/protocol/` · `packages/ui/` (each `tsconfig.tsbuildinfo`). `apps/web` is genuinely in the graph rather than empty: its build info's non-`node_modules` `fileNames` are `['./app/layout.tsx', './app/page.tsx']`. Reference edges declared and exercised: `protocol → game`; `apps/game → game, protocol, content`; `apps/web → game, protocol, ui`.
- [x] **REQ-1.2 (Strictness actually bites):** temporarily add `const x: number = 'nope'` to `packages/game/src/index.ts`; `pnpm typecheck` fails. Remove it. Without this, a passing typecheck proves only that no files were read.
  **Measured 2026-08-17:** with the line added, `pnpm typecheck` exited **2** with `packages/game/src/index.ts:6:7 - error TS2322: Type 'string' is not assignable to type 'number'. / Found 1 error.` Line removed; re-run exited 0.
  **Toolchain decision recorded here because a later session will need it:** TypeScript is pinned to **5.9.3**, not the registry `latest` of **7.0.2**. `typescript-eslint@8.67.0` — required by REQ-1.7 — declares peer `typescript: ">=4.8.4 <6.1.0"`, and TS 6.x has no stable release (`beta` is `6.0.0-beta`). Taking TS 7 would have required a peer escape hatch, which Gate 7 forbids. `tech-specs.md` §2.1 pins no TypeScript version, so 5.9.3 is a pin rather than a loosened constraint. Also pinned exactly, no `^`/`~`: `@types/node 24.13.3`, `next 15.5.23`, `react`/`react-dom 19.2.8`, `@types/react 19.2.18`, `@types/react-dom 19.2.4`. `pnpm-workspace.yaml` gained `allowBuilds: { sharp: true }` — sharp is Next's prebuilt image-optimisation binary and pnpm 11 blocks its install script until answered; this is not one of Gate 7's listed escape hatches.
- [ ] **REQ-1.5 (No rules-engine logic):** `packages/game/src/` contains no reducer, clock, `RoomState`, spend, or round/match code. Grep for `reducer|RoomState|tick|bank|winsNeeded` across `packages/*/src` returns nothing. This is the boundary an autonomous runner is most likely to cross.
- [ ] **REQ-1.5 (No premature dependencies):** no `fastify`, `zod`, `drizzle-orm`, `@azure/*`, or font package appears in any manifest. Record the full dependency list of all six projects — it should be short enough to read in one screen.
- [ ] **REQ-1.6 (Tests collected, counted):** `pnpm test` reports **6 test files and ≥6 passing assertions** — one per project. Record the actual numbers. A run reporting fewer files than projects is a FAIL even if it exits 0.
- [ ] **REQ-1.6 (Empty run fails):** with `passWithNoTests: false` configured, a run filtered to a non-existent pattern exits non-zero. This is the check that proves `pnpm test` can ever fail.
- [ ] **REQ-1.6 (A failing test fails the command):** temporarily invert one assertion; `pnpm test` exits non-zero. Restore it.
- [ ] **REQ-1.1 / NFR-4 (Pinned and locked):** `pnpm-lock.yaml` is committed; root `package.json` has a `packageManager` field pinned to an exact pnpm version; no `^`/`~` on `next`, `vitest`, `eslint`, `stylelint`, `typescript`.
- [ ] **NFR-5 (No secrets):** no `.env*` file is tracked; `git grep -iE "connection ?string|BEGIN .*PRIVATE KEY|iban|client_secret"` over tracked files returns nothing outside `specs/` prose.

## 3. Gate 3 — The RTL guardrail fires (blocks Gates 4–7)

The most important gate in the phase, and the only one whose failure would otherwise be invisible. A configured linter that matches nothing passes every other check here.

- [ ] **REQ-1.7 (ESLint covers all TS):** `eslint .` runs clean, and its resolved file list includes files from all six projects. Record the file count. `design/` is excluded.
- [ ] **REQ-1.7 (Prettier is sole formatter):** `prettier --check .` runs clean; no ESLint formatting rules are enabled; `endOfLine` agrees with `.gitattributes`.
- [ ] **REQ-1.8 (Stylelint reaches CSS Modules):** `stylelint "**/*.css"` runs clean and its resolved file list includes `packages/ui/src/tokens.module.css` and `apps/web/app/globals.css`. Record the file list — an empty or one-file list is a FAIL.
- [ ] **REQ-1.9 (NEGATIVE TEST — physical margin):** add `margin-left: 4px` to a rule in `packages/ui/src/tokens.module.css`; `pnpm lint` exits non-zero **and** the message names the logical alternative. Record the exact error output, then remove the violation.
- [ ] **REQ-1.9 (NEGATIVE TEST — `text-align: left`):** same procedure with `text-align: left` in `apps/web/app/globals.css`; `pnpm lint` exits non-zero. Record and remove. Two different rules and two different files, because one passing negative test can be an accident of the glob.
- [ ] **REQ-1.8 (Block axis is NOT restricted):** `margin-block-start` and `top` in a CSS Module lint **clean**. A guardrail that flags direction-neutral properties will be disabled by whoever hits it next, which is how it dies.
- [ ] **REQ-1.8 (Lint is a conjunction):** `pnpm lint` fails if *any* of ESLint, Stylelint, or Prettier fails — verified by making each one fail in turn. There must be no path to a green `pnpm lint` that skipped Stylelint.

## 4. Gate 4 — RTL root, verified on rendered output

- [ ] **REQ-1.4 (Rendered attributes):** the built/served page's HTML contains `<html lang="ar" dir="rtl">`. Checked against **rendered output** (a test rendering the layout, or `curl` against `next start`), not against `layout.tsx` source — a nested layout or framework `<head>` handling can drop an attribute without touching the file.
- [ ] **REQ-1.4 (Both attributes, not one):** the assertion fails if either attribute is removed. Verified by removing each in turn.
- [ ] **REQ-1.4 (No Phase 2 content leaked in):** `apps/web` contains no font file, no `next/font` import, no `data-theme` handling, and no port of `arcade-tokens.css`. Grep for `Baloo|Archivo|data-theme|next/font` returns nothing.
- [ ] **REQ-1.13 (Handoff untouched):** `git diff ca16ff5..HEAD -- design/` is empty.

## 5. Gate 5 — Remote and branch protection

- [ ] **REQ-1.10 (Account confirmed before creation):** `gh auth status` / `gh api user` output recorded, and the active account confirmed to be the personal one (`a.alshareef.89@gmail.com`) **before** `gh repo create` runs. The current login is `AhmedQureshi89` and its email could not be verified offline — this check is a stop, not a formality.
- [ ] **REQ-1.10 (Private):** `gh repo view --json visibility,owner,isPrivate` shows `private` under the personal account. Record it.
- [ ] **REQ-1.10 (Authorship):** `git log --format='%an <%ae>' | sort -u` shows only `a.alshareef.89@gmail.com` — no `ahmed@tadawulcom.sa` commits reached the remote.
- [ ] **REQ-1.11 (Direct push rejected):** an actual `git push origin main` of a trivial commit is **rejected**. Record the rejection message. Reading the settings page is not evidence.
- [ ] **REQ-1.11 (Owner cannot bypass):** the rejection above happens while authenticated as the repo owner/admin. This is the check that distinguishes real protection from a rule that exempts the only person who will ever push.
- [ ] **REQ-1.11 (CI required by name):** the required status check matches the CI job's exact name, and the job name in `ci.yml` is recorded here so a future rename is caught.

## 6. Gate 6 — The full gate, green, from a fresh clone in CI

- [ ] **REQ-1.12 (Four commands in CI):** the workflow runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — the same four as locally, lint first — on `ubuntu-latest`, Node 24, `--frozen-lockfile`.
- [ ] **REQ-1.12 (Green on a PR):** a real PR against `main` shows the check green, and the merge button is blocked until it is. Record the PR number and run URL.
- [ ] **NFR-1 (Fresh clone, locally):** clone into an empty directory, `pnpm install --frozen-lockfile`, run the four commands. All pass with no manual step, no `.env`, no global install beyond Node 24 + pnpm. Record wall-clock time for the whole sequence — it is the number every later phase's inner loop pays.
- [ ] **NFR-3 (Offline):** the four commands pass with networking disabled after install. Nothing reaches Azure, Postgres, or a running service.
- [ ] **REQ-1.6 / R3 (Build produces artifacts):** `pnpm build` leaves a real `.next` output for `apps/web` and compiled output for each package. Record the artifact paths. A build script that echoes and exits 0 satisfies the exit criterion while proving nothing.

## 7. Gate 7 — 🚦 Stack compatibility (verdict gate)

Evaluated once Gate 6 has been reached. Gates 1–6 test *our* config, and failures there are bugs to fix. This gate asks a different question — **does the stack `tech-specs.md` §2.1–2.2 commits to actually work at the pinned versions, on both platforms, without escape hatches?** — and its answer is a fact about the ecosystem, not about our skill.

- [ ] 🚦 **REQ-1.2 / NFR-2 / NFR-4 (Pinned stack holds — VERDICT GATE — no retry):** Node 24 + Next.js 15 + React 19 + TypeScript strict with project references + Vitest + ESLint 9 + Stylelint install and pass all four commands on **both** Windows (local) and Ubuntu (CI) **with no escape hatch** — specifically: no `pnpm.overrides`, no `peerDependencyRules.ignoreMissing`/`allowedVersions`, no `--no-strict-peer-dependencies`, no `skipLibCheck` added beyond the base, no `@ts-expect-error` in project config or shells, no strict flag disabled anywhere, and no floated version range introduced to make a resolution succeed.
  **A FAIL here halts the phase.** It is a finding about the stack, and the response is a deliberate, recorded change to `tech-specs.md` §2.1–2.2 in a planning session — not a loosened pin. Record which package conflicted, its resolution error verbatim, and the minimum change that would have made it pass.

**Why this is a verdict gate and Gate 6 is not:** if CI fails because of a typo in `ci.yml`, retrying after fixing the typo is correct — that is our code. If it fails because Next 15 will not run under Node 24 with project references, retrying with a loosened constraint manufactures a green wall that hides an architectural decision made by accident. The distinction is the whole point of the notation.

---

## 8. Automated Commands

```bash
# Gate 1 — line endings (expect: no output = no non-LF text files)
git ls-files --eol | grep -v "i/lf" | grep -v "^i/-text"
git check-attr text -- packages/ui/fonts/example.woff2

# Gate 2 — workspace, types, tests
pnpm ls -r --depth -1
pnpm typecheck
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" | wc -l   # expect 6
pnpm test --reporter=json > .test-report.json                        # assert 6 files
pnpm vitest run --dir does-not-exist                                 # expect non-zero
git grep -nE "reducer|RoomState|winsNeeded" -- "packages/*/src"       # expect empty

# Gate 3 — guardrails (the negative tests are the point)
pnpm lint
pnpm stylelint "**/*.css" --formatter verbose                        # inspect the file list
#   then, one at a time: insert `margin-left: 4px`, run `pnpm lint`, expect non-zero, revert
#   then: insert `text-align: left`, run `pnpm lint`, expect non-zero, revert
#   then: insert `margin-block-start: 4px`, run `pnpm lint`, expect ZERO, revert

# Gate 4 — rendered RTL root
pnpm --filter nel3ab-web build && pnpm --filter nel3ab-web start &
curl -s http://localhost:3000 | grep -o '<html[^>]*>'               # expect lang="ar" dir="rtl"
git diff ca16ff5..HEAD -- design/                                    # expect empty

# Gate 5 — remote and protection
gh auth status && gh api user --jq '.login'
gh repo view --json visibility,owner,isPrivate
git log --format='%ae' | sort -u                                     # expect one address
git commit --allow-empty -m "protection probe" && git push origin main   # EXPECT REJECTION
git reset --hard HEAD~1

# Gate 6 — fresh clone
git clone <remote> /tmp/nel3ab-fresh && cd /tmp/nel3ab-fresh
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Gate 7 — verdict gate: inspect, do not "fix"
git grep -nE "overrides|allowedVersions|ignoreMissing|strict-peer|ts-expect-error" -- \
  package.json pnpm-workspace.yaml "*/tsconfig.json" tsconfig.base.json   # expect empty
```

---

## 9. Acceptance Criteria

Phase 1 is complete when **all** of the following hold:

1. Gate 1 passed before the first source commit — LF in the index, verified by `git ls-files --eol`.
2. Gate 2 passed — six projects resolve, six `.tsbuildinfo` files, strictness proven to bite, `pnpm test` collects 6 files and can fail, lockfile committed, no premature dependencies, no rules-engine logic in `@nel3ab/game`.
3. Gate 3 passed — **both** negative tests made `pnpm lint` fail, the block axis lints clean, and each of the three linters can independently fail `pnpm lint`.
4. Gate 4 passed — `<html lang="ar" dir="rtl">` in rendered output, no Phase 2 content present, `design/` byte-identical.
5. Gate 5 passed — private repo under the confirmed personal account, single commit-author email, and a real direct push to `main` rejected while authenticated as the owner.
6. Gate 6 passed — `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green from a fresh clone locally **and** on a PR in CI, with recorded artifacts and wall-clock time.
7. Gate 7 returned **PASS** — the pinned stack holds on both platforms with no escape hatch. A FAIL is recorded as a finding and the phase halts for a planning session.

The roadmap's stated exit criterion is a subset of the above and is satisfied by (6).

---

## 10. What Would Make This Phase Untrustworthy

- **Every command green because nothing was measured.** The single most likely failure. `pnpm build` with no build steps, `pnpm test` collecting zero files, `pnpm typecheck` reading no sources — all exit 0 and look exactly like health. Gate 2's counts and Gate 6's artifact check exist only for this, and if either is ticked without a recorded number, the phase is not verified.
- **The RTL guardrail was never watched failing.** A Stylelint config whose glob misses `*.module.css`, or whose `ignoreFiles` swallows `packages/ui`, passes every check in Gates 2, 4, 5, 6 and reports clean forever. Phase 2 then ports 4KB of tokens and Phases 5–14 build every screen behind a rule that matched nothing. If Gate 3's two negative tests are ticked without the error output pasted in, treat the guardrail as absent.
- **The guardrail was made green by narrowing it.** Hitting R1's noise and disabling `property-disallowed-list`, or narrowing the glob until nothing matches, produces a passing gate and no protection. The rule may lose `stylelint-config-standard`; it may not lose the two RTL rules.
- **Branch protection that exempts the owner.** The only person who will ever push to this repo is the owner. A rule with admin bypass left on is indistinguishable, in every log and settings page, from real protection — and `mission.md` §5.4's human-verification gate for question accuracy rests entirely on the PR it enforces. Gate 5's push probe must be run as the owner, or the protection is unverified.
- **The repo created under the wrong account.** `gh` is logged in as `AhmedQureshi89` and the token cannot read its email. Creating the repo before confirming means the commercial asset — the question bank this product sells — may sit under the work account. Recoverable now, awkward in three months, and nothing else in the phase would surface it.
- **CI green from cache rather than from the lockfile.** A workflow that restores a store cache and skips `--frozen-lockfile`, or that was run once before the lockfile was committed, proves the machine had the packages, not that a fresh clone resolves. NFR-1 must be checked by an actual clone into an empty directory, not by a re-run of CI.
- **Windows-only correctness.** Case-insensitive paths mean `import '@nel3ab/UI'` works locally and fails on Ubuntu; a script using a shell builtin works in one place only. Gate 7 is the only check that would catch it, and only if CI actually ran the same four commands rather than a subset.
- **A verdict gate retried into green.** If Gate 7 fails and the response is `pnpm.overrides`, an ignored peer range, or a floated version, the phase reports success while a stack decision was made silently by whoever was tired at the time. Every later phase then rests on a version set nobody chose. This is the failure the notation exists to prevent, and it leaves no trace unless the escape hatch grep in §8 is actually run.
- **Scope leakage from Phase 2 or 3.** A `Button` primitive "while we're here", a token port, a `RoomState` type "just the interface". Each looks harmless and each moves work out of the phase that has the verification to justify it — Phase 3's clock coverage, Phase 2's fidelity review. Gate 2's grep and Gate 4's grep are narrow; a determined implementer can leak past them.
- **The specs were edited to match what was built.** `verification.md` is read-only during implementation. If a gate here is reworded mid-phase, the bar was set after seeing the result, and the phase's green means nothing at all.

---

*Written: 2026-08-17 — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured values may be added; gates may not be changed except by a dated planning session.*
