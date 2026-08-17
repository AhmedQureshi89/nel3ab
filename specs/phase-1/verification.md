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
- [x] **REQ-1.5 (No rules-engine logic):** `packages/game/src/` contains no reducer, clock, `RoomState`, spend, or round/match code. Grep for `reducer|RoomState|tick|bank|winsNeeded` across `packages/*/src` returns nothing. This is the boundary an autonomous runner is most likely to cross.
  **Measured 2026-08-17:** `git grep -nE "reducer|RoomState|tick|bank|winsNeeded" -- "packages/*/src/*" "apps/game/src/*"` → **no output, exit 1, 5 files scanned** (`packages/{content,game,protocol,ui}/src/index.ts` + `apps/game/src/index.ts`). Widened to `-i` and to `spend|round|match`, and separately to `setInterval|setTimeout|Date.now|performance.now|clock`: all **no output, exit 1**. Each of the five shells is a comment block plus `export const PLACEHOLDER = true` — no types, no functions, no state.
  **The pathspec in this gate as written is vacuous — recorded rather than silently passed.** `git grep … -- "packages/*/src"` scans **0 files** (`git ls-files -- "packages/*/src"` → 0), because a git pathspec containing a wildcard is wildmatched against the whole path, so `packages/*/src` never matches `packages/game/src/index.ts`. It returns "nothing" whatever the code contains — exactly the §10 vacuous-green failure. The trailing-`/*` form above is the non-vacuous equivalent and is what was actually run; the gate text itself was left unedited (read-only during implementation).
  **Two hits were found and fixed before this box was ticked.** Under the corrected scope the first run returned 2 lines, both in *comments*, not code: `packages/game/src/index.ts:2` (`RoomState`, `reducer`, `round/match`) and `packages/content/src/index.ts:2` (`bank`, in "question bank"). No logic was present or removed. The comments were reworded to exactly what `specs.md` §2.7 prescribes — a comment naming the owning phase — so the guardrail grep stays a live check instead of carrying permanent known-good noise that a future runner would have to eyeball: game's line 2 is now "The rules engine is owned by Phases 3–4 and is deliberately absent here."; content's "question bank" → "question data". `pnpm typecheck` still exit 0 after the edit.
- [x] **REQ-1.5 (No premature dependencies):** no `fastify`, `zod`, `drizzle-orm`, `@azure/*`, or font package appears in any manifest. Record the full dependency list of all six projects — it should be short enough to read in one screen.
  **Measured 2026-08-17:** all 7 tracked manifests (root + 6 projects), **14 declared dependency entries total**:
  · `nel3ab` (root) — dev: `@types/node@24.13.3`, `typescript@5.9.3`
  · `nel3ab-web` — deps: `@nel3ab/{game,protocol,ui}@workspace:*`, `next@15.5.23`, `react@19.2.8`, `react-dom@19.2.8`; dev: `@types/react@19.2.18`, `@types/react-dom@19.2.4`
  · `nel3ab-game` — deps: `@nel3ab/{content,game,protocol}@workspace:*`; dev: none
  · `@nel3ab/protocol` — deps: `@nel3ab/game@workspace:*`; dev: none
  · `@nel3ab/game`, `@nel3ab/content`, `@nel3ab/ui` — **no dependencies of any kind**
  No `peerDependencies` or `optionalDependencies` declared anywhere. `git grep -niF` for each of `fastify`, `zod`, `drizzle-orm`, `@azure/`, `font` across `*package.json` + `pnpm-workspace.yaml` → **NO MATCH, all five**. Cross-checked transitively: `pnpm-lock.yaml` contains **0** case-insensitive occurrences of `fastify`, `zod`, `drizzle`, `azure`, or `font`; its full resolved set is only `next`+`@next/swc-*`, `react`/`react-dom`/`scheduler`, `typescript`, `@types/{node,react,react-dom}`, `sharp`+`@img/*`, and next's small transitive tail (`postcss`, `styled-jsx`, `nanoid`, `picocolors`, `caniuse-lite`, `client-only`, `csstype`, `tslib`, `semver`, `detect-libc`, `source-map-js`, `undici-types`, `@swc/helpers`, `@emnapi/runtime`). Lockfile importers = 7, matching the manifest count.
- [x] **REQ-1.6 (Tests collected, counted):** `pnpm test` reports **6 test files and ≥6 passing assertions** — one per project. Record the actual numbers. A run reporting fewer files than projects is a FAIL even if it exits 0.
  **Measured 2026-08-17:** `pnpm test` exit **0** — **6 test files, 7 passing assertions, 0 failed** (Vitest 4.1.10, Node v24.14.0, duration 0.33s). One file per project, named projects visible in the reporter: `|@nel3ab/game| src/index.test.ts` (1) · `|@nel3ab/protocol| src/index.test.ts` (1) · `|@nel3ab/content| src/index.test.ts` (1) · `|@nel3ab/ui| src/index.test.ts` (1) · `|nel3ab-game| src/index.test.ts` (2) · `|nel3ab-web| smoke.test.ts` (1). Seven rather than six because `apps/game` also asserts that its three `workspace:*` edges resolve inside the runner. `pnpm typecheck` still exit 0 with the test files in the graph (six `.tsbuildinfo`, unchanged).
  **Multi-project mechanism:** Vitest **4.1.10**, pinned exactly (`"vitest": "4.1.10"`, lockfile `specifier: 4.1.10`). §2.9's version caveat resolves to **`test.projects` in `vitest.config.ts`** — the separate `vitest.workspace.ts` was deprecated in v3 and **removed in v4**, so it does not exist in this repo. Only one mechanism is present.
  **The count assertion is not decoration — bare `vitest run` does not catch a dropped project.** Measured: with `passWithNoTests: false` set on the root *and* on all six projects, moving `packages/ui/src/index.test.ts` aside still exits **0**, reporting `Test Files 5 passed (5)`. Vitest only fails when the *whole* run collects nothing, so `passWithNoTests` is necessary and not sufficient — precisely the §10 vacuous green. `pnpm test` is therefore wired to `node scripts/check-collected-tests.mjs`, which runs Vitest once (`--reporter=default --reporter=json --outputFile.json=<tmpdir>`) and asserts the collected files against the number of workspace projects **found on disk** (not a hard-coded 6, so a seventh project without a test also fails). Re-running the same drop with the check in place: exit **1**, `[check-collected-tests] FAIL: no tests collected for: packages/ui` with the per-project tally `packages/ui: 0 file(s)` printed above it. File restored; exit 0 again.
  **Deviation recorded:** `specs.md` §2.3 sketches `"test": "vitest run"`; the script is now `"test": "node scripts/check-collected-tests.mjs"`. REQ-1.6 requires that a project failing to collect "fails **the command**", and the measurement above shows bare `vitest run` does not — §2.9 explicitly authorises "a one-line Node script over the JSON output" as the mechanism. `pnpm vitest run …` remains available directly for the ad-hoc runs in §8, and the script forwards its arguments to Vitest.
- [x] **REQ-1.6 (Empty run fails):** with `passWithNoTests: false` configured, a run filtered to a non-existent pattern exits non-zero. This is the check that proves `pnpm test` can ever fail.
  **Measured 2026-08-17:** `pnpm vitest run does-not-exist` → exit **1**, `No test files found, exiting with code 1`, followed by the per-project `filter: does-not-exist / include: **/*.test.ts` dump for all six projects. Through the wrapper, `pnpm test does-not-exist` → exit **1** as well (`[check-collected-tests] vitest exited 1`).
  **Counter-check that the flag is what does the work:** flipping both `passWithNoTests` values to `true` and re-running the identical command gives `No test files found, exiting with code 0` — exit **0**. Reverted to `false` immediately. Without this counter-check the box would only prove that some string did not match.
  **§8's suggested command for this box is vacuous here — recorded rather than silently passed.** `pnpm vitest run --dir does-not-exist` exits **0** and reports `Test Files 6 passed (6)`: with `test.projects`, each project sets its own `root`, which overrides the run-level `--dir`, so the filter reaches nothing and the full suite runs. Anyone ticking this box from §8's command alone would record a passing "empty run" that was not empty. The positional-filter form above is the non-vacuous equivalent and is what was actually run; §8 was left unedited (read-only during implementation).
- [x] **REQ-1.6 (A failing test fails the command):** temporarily invert one assertion; `pnpm test` exits non-zero. Restore it.
  **Measured 2026-08-17:** inverted `packages/protocol/src/index.test.ts` line 6 to `expect(PLACEHOLDER).toBe(false)`. `pnpm test` → exit **1**:
  `FAIL |@nel3ab/protocol| src/index.test.ts > @nel3ab/protocol exposes its shell export` / `AssertionError: expected true to be false // Object.is equality` / `- Expected false + Received true` / `❯ src/index.test.ts:6:23` / `Test Files 1 failed | 5 passed (6)` / `Tests 1 failed | 6 passed (7)`. The wrapper propagated it (`[check-collected-tests] vitest exited 1`) rather than swallowing the code — the failure path was measured, not assumed. Assertion restored to `toBe(true)`; re-run exit **0**, 6 files / 7 passing.
- [x] **REQ-1.1 / NFR-4 (Pinned and locked):** `pnpm-lock.yaml` is committed; root `package.json` has a `packageManager` field pinned to an exact pnpm version; no `^`/`~` on `next`, `vitest`, `eslint`, `stylelint`, `typescript`.
  **Measured 2026-08-17:** `pnpm-lock.yaml` is **tracked and committed**, not merely present — `git ls-files --error-unmatch pnpm-lock.yaml` exits 0, `git ls-tree HEAD -- pnpm-lock.yaml` lists it, last touched in `204180b`. It is **current with the manifests**: `pnpm install --frozen-lockfile --lockfile-only --offline` exits **0** ("Scope: all 7 workspace projects", no rewrite) and `git status --porcelain` is empty afterwards, so the committed lockfile is the one the manifests resolve to. `lockfileVersion: '9.0'`, 7 importers, all 14 specifiers exact or `workspace:*`.
  **`packageManager` — exact string: `"pnpm@11.22.0"`** (`package.json:4`). No range character, no `>=`/`x`; matches the pnpm actually running (`pnpm --version` → `11.22.0`) and Node v24.14.0.
  **Range scan across every tracked manifest** (root + all six projects, 7 files): `git grep -nE '":\s*"[\^~]' -- '*package.json'` returns **no output, exit 1** — zero `^` and zero `~` on *any* dependency anywhere, not just the five named ones.
  **The five named packages — three exist, two do not, recorded honestly:**
  · `next` → **`"15.5.23"`** (`apps/web/package.json:13`) — exact
  · `vitest` → **`"4.1.10"`** (`package.json:20`) — exact
  · `typescript` → **`"5.9.3"`** (`package.json:19`) — exact
  · `eslint` → **ABSENT.** Declared in no manifest; **0** case-insensitive occurrences in `pnpm-lock.yaml` (not even transitively)
  · `stylelint` → **ABSENT.** Declared in no manifest; **0** case-insensitive occurrences in `pnpm-lock.yaml`
  **This box is therefore a partial measurement, and is recorded as partial.** `eslint` and `stylelint` are introduced by REQ-1.7 and REQ-1.8, which live in **Gate 3 — after this gate**. Installing them here to make the check meaningful would be scope creep into a later requirement, so the no-`^`/`~` condition is **vacuously true** for those two right now: it was tested against nothing. **The eslint/stylelint half of this box must be re-confirmed once Gate 3 installs them** — Gate 3 is the first point at which the check has any content. The three packages that existed at measurement time were all genuinely checked and all pass.
- [x] **NFR-5 (No secrets):** no `.env*` file is tracked; `git grep -iE "connection ?string|BEGIN .*PRIVATE KEY|iban|client_secret"` over tracked files returns nothing outside `specs/` prose.
  **Measured 2026-08-17 — `.env*` checked with git, not the filesystem:** `git ls-files | grep -iE '(^|/)\.env'` → **no output, exit 1**; no tracked path contains the substring `env` at all. Widened to the whole history — `git log --all --pretty=format: --name-only --diff-filter=A | sort -u | grep -iE '(^|/)\.env'` → **no output, exit 1**, so no `.env*` was ever added and later removed. `.gitignore:5-6` lists `.env` and `.env.local`, confirmed live by `git check-ignore -v` (both resolve to those two lines).
  **Scan size — the grep is not scanning nothing:** **50 tracked files** are in scope (`git ls-files | wc -l` → 50). Of those, **49 have content and are searched** (`git grep -lIE ".|^$"` → 49, identical to the `-a` count, so nothing is skipped as binary — `git ls-files --eol` reports `i/lf` ×49 and `i/none` ×1). The one file the catch-all does not list is `packages/content/categories/.gitkeep`, which is **0 bytes** (blob `e69de29`, the empty blob) and so has no line to match — not an exclusion.
  **The pattern is proven capable of a positive, three ways.** (1) *It already fires on this repo:* the real run returns **7 matching lines** across 5 files (all in `specs/`, listed below) — so this is not a "no output" from a command that reached nothing. (2) *Every alternation branch fires individually*, against a canary file outside the repo (`git grep --no-index -c -iE <branch>`): `connection ?string` → 2 lines · `BEGIN .*PRIVATE KEY` → 1 · `iban` → 1 · `client_secret` → 1 — **4 of 4 branches live**, none is a dead regex. (3) *The exact command, unmodified, fires on a **tracked** file outside `specs/`:* a canary was written to `packages/ui/src/__nfr5-canary.tmp.txt`, `git add -f`'d (tracked count 50 → 51), and `git grep -iE "connection ?string|BEGIN .*PRIVATE KEY|iban|client_secret" -- ':!specs/'` returned **4 lines, exit 0** — `ConnectionString=Server=x;Password=y`, `-----BEGIN RSA PRIVATE KEY-----`, `BANK_IBAN=SA03…`, `GOOGLE_CLIENT_SECRET=abc`. Canary then `git rm --cached`'d and deleted; tracked count back to **50** and `git status --porcelain` **empty**. The canary was never committed.
  **The real run is genuinely clean:** with the guardrail proven live, `git grep -iE "connection ?string|BEGIN .*PRIVATE KEY|iban|client_secret" -- ':!specs/'` → **no output, exit 1** over all 50 tracked files. Control that the no-pathspec form reaches non-`specs/` code at all: the same invocation with a term known present (`pnpm|react|vitest|stylelint|tsconfig`) matches **21 files outside `specs/`**, spanning `<root>`, `apps/`, `packages/`, `scripts/` and `design/`. Supplementary sweep for credential *shapes* the box does not name — `sk-…`, `ghp_…`, `github_pat_`, `AKIA…`, `xox[baprs]-`, `AccountKey=`, `SharedAccessKey=`, `-----BEGIN … PRIVATE KEY-----`, quoted `password=…`, `Authorization: Bearer …` — → **no output, exit 1**. **No secret found.**
  **The 7 `specs/` matches, confirmed prose and variable *names*, no values:**
  · `specs/mission.md` — "receives an IBAN and a unique reference code" (payment-flow narrative)
  · `specs/roadmap.md` — "displays IBAN, account name and amount" (a Phase-20 checklist item)
  · `specs/tech-specs.md` §5 route table — "IBAN + reference code, receipt upload form"
  · `specs/tech-specs.md:256` and `:258` — the §7 Environment Configuration table, which lists **variable names only** (`GOOGLE_CLIENT_SECRET`, `APPLE_PRIVATE_KEY`, `SESSION_SECRET`, `BANK_IBAN`, …) with no value column; the only literal in that whole table is the public URL `https://nel3ab.game`. This is the table that says secrets live in Key Vault, which is the requirement NFR-5 traces to.
  · `specs/phase-1/requirements.md` — the NFR-5 row itself; `specs/phase-1/verification.md` — this gate's own text (self-match)
  **Limitation of the pattern, recorded not silently passed:** `connection ?string` matches the spaced and concatenated forms but **not** the underscore form. `specs/tech-specs.md:255` declares `WEBPUBSUB_CONNECTION_STRING` and is **not** among the 7 hits; widening to `connection[ _]?string` surfaces it. The check is therefore slightly narrower than its wording suggests — it would miss a leaked `WEBPUBSUB_CONNECTION_STRING=…`. The supplementary shape sweep above (`AccountKey=`, `SharedAccessKey=` — the two tokens an Azure Web PubSub connection string always contains) covers that hole for this run and is also clean. Second, `.gitignore`'s `.env` / `.env.local` entries do not cover `.env.production` or `.env.*` generally (`git check-ignore apps/web/.env.production` → not ignored); nothing of the sort exists or is tracked today, but the ignore rule is narrower than the requirement. Both are noted for a future planning session; neither is edited here, as this file is read-only during implementation.

## 3. Gate 3 — The RTL guardrail fires (blocks Gates 4–7)

The most important gate in the phase, and the only one whose failure would otherwise be invisible. A configured linter that matches nothing passes every other check here.

- [x] **REQ-1.7 (ESLint covers all TS):** `eslint .` runs clean, and its resolved file list includes files from all six projects. Record the file count. `design/` is excluded.
  **Measured 2026-08-17:** `pnpm lint:js` (`eslint .`) exit **0** with **no output at all** — not a suppressed-warning green. The resolved file list, taken from `eslint . --format json` (one entry per file ESLint actually processed): **17 files, 0 errors, 0 warnings.**
  `apps/web/app/layout.tsx` · `apps/web/app/page.tsx` · `apps/web/smoke.test.ts` · `apps/game/src/index.ts` · `apps/game/src/index.test.ts` · `packages/game/src/index.ts` · `packages/game/src/index.test.ts` · `packages/protocol/src/index.ts` · `packages/protocol/src/index.test.ts` · `packages/content/src/index.ts` · `packages/content/src/index.test.ts` · `packages/ui/src/index.ts` · `packages/ui/src/index.test.ts` · `vitest.config.ts` · `eslint.config.mjs` · `prettier.config.mjs` · `scripts/check-collected-tests.mjs`
  **All six projects are present, none at zero:** `apps/web` 3 · `apps/game` 2 · `packages/game` 2 · `packages/protocol` 2 · `packages/content` 2 · `packages/ui` 2 (= 13; the remaining 4 are root-level config and the build script). Named file per project as required: `apps/web/app/layout.tsx`, `apps/game/src/index.ts`, `packages/game/src/index.ts`, `packages/protocol/src/index.ts`, `packages/content/src/index.ts`, `packages/ui/src/index.ts`.
  **`design/` excluded — and the exclusion is load-bearing, not decorative.** `design/` entries in the resolved list: **0**. Counter-test: with `'design/**'` deleted from the `ignores` array and nothing else changed, the same command resolves **19 files** and exits **1** with **148 errors**, the two extra files being `design/designs/image-slot.js` and `design/designs/support.js`. So the handoff is genuinely reachable by the glob and is genuinely being excluded — a clean run is not a run that found nothing. `ignores` restored verbatim.
  **ESLint is proven able to fail.** Appended `export const BAD: any = 1` to `packages/game/src/index.ts`; `eslint .` exited **1**:
  `packages/game/src/index.ts` / `  5:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any` / `✖ 1 problem (1 error, 0 warnings)`. Rule name: **`@typescript-eslint/no-explicit-any`** — from the typescript-eslint layer, so the TS half of the config is what fired, not the base JS half. Violation reverted with `git checkout --`; re-run exit **0**.
  **Layer scoping verified on the resolved config, not by reading the file** (`eslint --print-config <file>`): `apps/web/app/layout.tsx` → 469 rules known, **88 enabled**, of which **20 `@next/next/*`** and 20 `@typescript-eslint/*`; `packages/game/src/index.ts` → 448 known, 68 enabled, **0 `@next/next/*`**, 20 `@typescript-eslint/*`; `scripts/check-collected-tests.mjs` → 421 known, 63 enabled, 0 `@next/next/*`, **0 `@typescript-eslint/*`**. Next's plugin is therefore scoped to `apps/web` and nowhere else, and typescript-eslint applies to `**/*.{ts,tsx}` and not to plain ESM.
  **Versions, all pinned exact (no `^`/`~`), installed with no peer warning:** `eslint 10.8.1` · `@eslint/js 10.0.1` · `typescript-eslint 8.67.0` · `@next/eslint-plugin-next 15.5.23` (matches `next 15.5.23`) · `eslint-config-prettier 10.1.8` · `prettier 3.9.6`, on Node v24.14.0 / pnpm 11.22.0. Lockfile records `typescript-eslint 8.67.0(eslint@10.8.1)(typescript@5.9.3)` — the TS 5.9.3 pin recorded in Gate 2 holds, and **no escape hatch was needed**: `pnpm install` emits zero `WARN`/peer lines, and Gate 7 §8's grep for `overrides|allowedVersions|ignoreMissing|strict-peer|ts-expect-error` still returns **no output, exit 1**.
  **Deviation recorded:** one rule from Next's recommended set is switched off — `@next/next/no-html-link-for-pages`. It is a Pages-Router-only rule; `apps/web` is App Router (§2.10) and has no `pages/`, so the rule cannot ever apply, and when it cannot locate a `pages/` directory it prints `Pages directory cannot be found at …` on every run (observed before the change). Off because it is inapplicable, not because it complained — 20 of Next's 21 rules remain enabled.
- [x] **REQ-1.7 (Prettier is sole formatter):** `prettier --check .` runs clean; no ESLint formatting rules are enabled; `endOfLine` agrees with `.gitattributes`.
  **Measured 2026-08-17:** `pnpm format:check` (`prettier --check .`) exit **0** — `Checking formatting… / All matched files use Prettier code style!`. `prettier --list-different .` → no output, exit 0.
  **It checked 33 files, counted two independent ways** (33 > ESLint's 17 because Prettier also covers the 7 `package.json`s, the 7 `tsconfig*.json`s and `pnpm-workspace.yaml`): (1) `prettier --write .` on the clean tree printed **33** file lines and `git status --porcelain` was **byte-identical before and after** — it processed 33 files and changed none; (2) the `endOfLine` counter-test below reports `Code style issues found in 33 files`. **0** of the 33 are under `design/` or `specs/`.
  **`endOfLine` agrees with `.gitattributes`, and the agreement was tested, not assumed.** `prettier.config.mjs:13` → `endOfLine: 'lf'`; `.gitattributes:1` → `* text=auto eol=lf`. The working tree really is LF despite `core.autocrlf=true` — `eol=lf` wins over autocrlf — confirmed by `git ls-files --eol` reporting **`i/lf w/lf` for all 32** tracked `.ts/.tsx/.mjs/.json/.yaml` files (`w/` is the *working-tree* column, which is what Prettier reads) and by a raw byte count of **0 CR** in `vitest.config.ts`, `package.json`, `scripts/check-collected-tests.mjs`, `eslint.config.mjs`, `prettier.config.mjs`. Counter-test: flipping the config to `endOfLine: 'crlf'` and changing nothing else makes `prettier --check .` exit **1** with `Code style issues found in 33 files` — every file, i.e. the setting is what is doing the work. Reverted to `'lf'`; re-run exit 0.
  **No ESLint formatting rules are enabled — determined two ways, neither of them "we didn't add any".** (1) `eslint-config-prettier`'s own CLI, run over one file from each of the six projects plus `vitest.config.ts` and `scripts/check-collected-tests.mjs`: `No rules that are unnecessary or conflict with Prettier were found.` exit **0**. (2) Direct inspection of the *resolved* config (`eslint --print-config`): of the 469 rules known at `apps/web/app/layout.tsx`, **381 are off**, and every formatting rule probed resolves to severity `0` — `semi`, `quotes`, `indent`, `max-len`, `comma-dangle`, `no-mixed-spaces-and-tabs`, `linebreak-style`, `arrow-parens`, `jsx-quotes`, `no-extra-semi`. A regex sweep of ~40 formatting rule names (bare, `@typescript-eslint/`- and `@stylistic/`-prefixed) against the enabled set returned **NONE** for `apps/web/app/layout.tsx`, `packages/game/src/index.ts` and `scripts/check-collected-tests.mjs`. `eslint-config-prettier/flat` is spread **last** in `eslint.config.mjs`, after the JS, TS and Next layers.
  **Two source edits were needed to reach a clean check, both recorded rather than hidden.** (a) `pnpm-workspace.yaml` was reformatted by Prettier — `"apps/*"` → `'apps/*'` under `singleQuote: true`. Quoting only; the two globs are unchanged, `pnpm install --frozen-lockfile --lockfile-only` still exits 0 over "all 7 workspace projects", and Gate 2's six-project list is unaffected. (b) `.prettierignore` ignores **`specs/` as well as `design/`**. `specs.md` §2.13 names only `design/`, but Prettier reflows every markdown table in the triad — **799 changed lines** across the six files (`mission.md` 60, `roadmap.md` 62, `tech-specs.md` 282, `phase-1/requirements.md` 100, `phase-1/specs.md` 171, `phase-1/verification.md` 124) — and those files are read-only during implementation (this file's own footer; `specs.md` §3 marks `mission.md`/`tech-specs.md` UNTOUCHED). Its column alignment is also computed on code points, so it mis-pads the Arabic and em-dash cells. Formatting them is forbidden by the phase, so they are withheld from the formatter rather than left as a permanent `--check` failure. **Flagged for a planning session:** either `specs.md` §2.13 should name `specs/` too, or a later phase should decide to Prettier-format the triad once.
  **Gate 2's deferred half is now re-confirmed, as that box required.** `eslint` is declared for the first time — root `package.json` devDependency **`"eslint": "10.8.1"`**, exact, lockfile `specifier: 10.8.1`. The repo-wide range scan `git grep -nE '":\s*"[\^~]' -- '*package.json'` still returns **no output, exit 1** across all 7 manifests with the six new devDependencies added. `stylelint` remains **ABSENT** — it is REQ-1.8's, the next box but one, and that half of Gate 2 stays deferred to it. Regression check after the change: `pnpm typecheck` exit 0, `pnpm test` exit 0 (6 test files / 6 projects / 7 assertions), `pnpm install --frozen-lockfile --lockfile-only` exit 0 with a clean `git status`. `pnpm lint` as a whole still fails at `lint:css` because Stylelint is not installed yet — expected, and it is REQ-1.8's box, not this one.
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
