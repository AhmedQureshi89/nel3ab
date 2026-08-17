# Phase 1 Technical Specification — Repo, toolchain & CI

> **Phase:** Phase 1
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** 1 day

---

## 1. Architecture Overview

Dependency order matters here more than in most phases, because almost everything is a config file that another config file reads. A runner walks this top to bottom; steps within a band are independent.

```
  BAND A ─ repo hygiene (must precede the first commit of any source)
  ┌──────────────────────────────────────────────────────────────────┐
  │ .gitattributes                [NEW]  ── LF in the index          │
  │ .editorconfig                 [NEW]  ── editor-side agreement    │
  └──────────────────────────────────────────────────────────────────┘
                                │  renormalise, then commit
                                ▼
  BAND B ─ workspace skeleton (everything below resolves through this)
  ┌──────────────────────────────────────────────────────────────────┐
  │ package.json                  [NEW]  ── root scripts, pnpm pin   │
  │ pnpm-workspace.yaml           [NEW]  ── apps/*, packages/*       │
  │ tsconfig.base.json            [NEW]  ── strict, once             │
  │ tsconfig.json                 [NEW]  ── solution refs, files:[]  │
  └──────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
  BAND C ─ leaf packages              BAND D ─ apps (depend on C)
  ┌────────────────────────────┐     ┌────────────────────────────────┐
  │ packages/game      [NEW]   │     │ apps/web   [NEW] Next 15       │
  │ packages/protocol  [NEW]   │     │   app/layout.tsx  lang=ar rtl  │
  │ packages/content   [NEW]   │────▶│   app/page.tsx    placeholder  │
  │ packages/ui        [NEW]   │     │ apps/game  [NEW] shell only    │
  │   each: manifest, tsconfig,│     └────────────────────────────────┘
  │   src/index.ts, one test   │
  └────────────────────────────┘
                                │
                                ▼
  BAND E ─ guardrails (need real files to lint; must precede CI)
  ┌──────────────────────────────────────────────────────────────────┐
  │ eslint.config.mjs             [NEW]  ── flat config, all TS      │
  │ prettier.config.mjs           [NEW]  ── sole formatter           │
  │ stylelint.config.mjs          [NEW]  ── THE RTL GUARDRAIL        │
  │ vitest.config.ts              [NEW]  ── projects, non-vacuous    │
  └──────────────────────────────────────────────────────────────────┘
                                │  prove the guardrail fires (REQ-1.9)
                                ▼
  BAND F ─ remote & CI (last: CI must have something real to run)
  ┌──────────────────────────────────────────────────────────────────┐
  │ .github/workflows/ci.yml      [NEW]  ── lint,typecheck,test,build│
  │ gh repo create (private) + push + protect main                   │
  └──────────────────────────────────────────────────────────────────┘
```

**Why this order:** Band A before any source, or the first source commit bakes CRLF into the index and REQ-1.3 becomes a renormalisation cleanup instead of a setting. Band E after Band C/D, because a linter written against no files cannot be proven to match any. Band F last, because a CI workflow that runs before the four commands exist can only be green vacuously — the exact failure REQ-1.6 exists to prevent.

---

## 2. Component Specifications

### 2.1 `.gitattributes` [NEW]

**Implements:** REQ-1.3

```
* text=auto eol=lf

*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
*.woff binary
*.woff2 binary
*.ttf  binary
*.otf  binary
*.ico  binary
```

After creating it, renormalise the two already-committed spec files and the design handoff:

```
git add --renormalize .
git commit -m "Normalise line endings to LF"
```

**Silent failure mode:** `core.autocrlf` on this machine still controls the *working copy*, which is fine and expected — the requirement is about what is stored in the index. Verify with `git ls-files --eol`, not by looking at a file in an editor.

### 2.2 `.editorconfig` [NEW]

**Implements:** REQ-1.3 (editor side)

`root = true`; UTF-8, LF, final newline, 2-space indent for `ts,tsx,js,mjs,json,yml,css,md`. No `trim_trailing_whitespace` on `*.md` (it eats intentional line breaks).

### 2.3 `package.json` (root) [NEW]

**Implements:** REQ-1.1, REQ-1.2, REQ-1.6, REQ-1.7, REQ-1.8

```jsonc
{
  "name": "nel3ab",
  "private": true,                      // never publishable
  "packageManager": "pnpm@<pinned>",    // NFR-4; corepack reads this
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "build":     "pnpm -r --filter=./apps/* build",
    "typecheck": "tsc --build --pretty",
    "test":      "vitest run",
    "lint":      "pnpm lint:js && pnpm lint:css && pnpm format:check",
    "lint:js":   "eslint .",
    "lint:css":  "stylelint \"**/*.css\"",
    "format:check": "prettier --check ."
  }
}
```

Notes that matter:

- `typecheck` uses `tsc --build` on the solution tsconfig, so project references are actually exercised. `tsc -p .` on each package separately would pass even if the reference graph is wrong.
- `lint` chains all three with `&&` so **there is no way to satisfy the exit criterion while skipping Stylelint** (REQ-1.8). Do not parallelise these into a single tool-agnostic runner in this phase.
- `pnpm -r` for `build` (per-project builds), plain `vitest run` for `test` (one runner, all projects — see §2.9).
- **Windows/Linux parity (NFR-2):** no `&&` inside a single npm script beyond what pnpm itself normalises, no `rm -rf`, no `cp`. If a clean step is ever needed, use a Node-based tool, not a shell builtin.

### 2.4 `pnpm-workspace.yaml` [NEW]

**Implements:** REQ-1.1

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`packages/content/categories/` holds question JSON (`tech-specs.md` §2.5) and is **not** a workspace member — it is data inside the `@nel3ab/content` package. The glob above already gets this right; a root `content/` would have needed an exception, which is why the path was changed.

### 2.5 `tsconfig.base.json` [NEW]

**Implements:** REQ-1.2

Strict settings live here **once**:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are deliberate and load-bearing later: the Phase 12 redaction boundary depends on the player payload type being *exactly* what it says, and optional-property looseness is how an `answer?: string` sneaks through. They are cheap to adopt now on an empty repo and expensive to adopt in Phase 12.

**Module resolution is not set here** — it differs per consumer and setting it globally causes the classic "works in the package, fails in Next" break:

| Project | `module` / `moduleResolution` |
|---|---|
| `apps/web` | as Next.js 15 requires (`bundler`); Next rewrites/validates its own tsconfig |
| `apps/game`, `packages/*` | `NodeNext` / `nodenext` — a long-lived Node process and libraries consumed by it |

### 2.6 `tsconfig.json` (root solution) [NEW]

**Implements:** REQ-1.2

`{ "files": [], "references": [ … all six projects … ] }`. This is what makes `pnpm typecheck` a single command that respects dependency order.

### 2.7 `packages/{game,protocol,content,ui}` [NEW]

**Implements:** REQ-1.1, REQ-1.2, REQ-1.5, REQ-1.6

Each package is identical in shape:

```
packages/<name>/
  package.json      name: "@nel3ab/<name>", private: true, type: "module",
                    main/types → src/index.ts (source-consumed; see below),
                    scripts: { build: "tsc --build" }
  tsconfig.json     extends ../../tsconfig.base.json, references its deps
  src/index.ts      minimal, real, and honest about being a shell
  src/index.test.ts one real assertion
```

**Source-consumed, not pre-built.** Workspace packages are consumed as TypeScript source (`main`/`exports` → `src/index.ts`), with `apps/web` listing them in `transpilePackages` (§2.10). This avoids a build-order dance in every later phase at the cost of Next transpiling them — the right trade for one developer (`mission.md` §5.5).

Per-package `src/index.ts` content:

| Package | Phase 1 content | Owned by |
|---|---|---|
| `@nel3ab/game` | `export const PLACEHOLDER = true` + a comment naming Phases 3–4 as owner. **No reducer, no clock, no state types.** | Phases 3–4 |
| `@nel3ab/protocol` | placeholder export + comment naming Phase 11 | Phase 11 |
| `@nel3ab/content` | placeholder export + comment naming Phase 8; create `categories/.gitkeep` | Phase 8 |
| `@nel3ab/ui` | placeholder export + one **real CSS Module** (§2.8) | Phase 2 |

The `@nel3ab/game` boundary is the one an autonomous runner is most likely to cross, because the tech-specs used to say Phase 1 built it. It does not. See `requirements.md` §4.

**Dependency edges to declare now** (they are known and cost nothing): `@nel3ab/protocol` → `@nel3ab/game`; `@nel3ab/content` → none; `@nel3ab/ui` → none; `apps/web` → `ui`, `protocol`, `game`; `apps/game` → `game`, `protocol`, `content`. Declaring them here is what makes `tsc --build` order meaningful.

### 2.8 `packages/ui/src/tokens.module.css` [NEW]

**Implements:** REQ-1.8, REQ-1.9

Stylelint needs at least one real CSS Module in the repo, or the RTL guardrail cannot be proven to match anything (REQ-1.9) and `lint:css` succeeds vacuously.

Keep it to a handful of declarations using **logical** properties only — e.g. a `.panel` class with `padding-inline`, `border-inline-start-width`, `margin-block`. **This is not the Phase 2 token port.** Do not add colours, radii, shadows, or the press behaviour; Phase 2 owns `arcade-tokens.css`, and duplicating a subset here creates two sources of truth for a product pillar (`mission.md` §3, The Arcade Look).

### 2.9 `vitest.config.ts` (root) [NEW]

**Implements:** REQ-1.6

One root config defining a project per workspace member, so `vitest run` covers everything in one pass.

**Version caveat — resolve at implementation time:** recent Vitest exposes multi-project runs as `test.projects` in the root config, while older versions use a separate `vitest.workspace.ts`, now deprecated. Check the installed version's docs and use whichever that version supports. Do not use both.

**The non-vacuous requirement (REQ-1.6) is the real work here.** Vitest exits 0 when it collects nothing, which is precisely the vacuous green the phase is guarding against. Set `passWithNoTests: false` so an empty run fails, and additionally assert the collected count: `vitest run --reporter=json` and check the totals, or a one-line Node script over the JSON output. The check must fail if a project stops being collected — not merely if a test fails.

### 2.10 `apps/web` [NEW]

**Implements:** REQ-1.4, REQ-1.2

```
apps/web/
  package.json     name: "nel3ab-web", deps: next 15, react, react-dom,
                   @nel3ab/{ui,protocol,game} via workspace:*
                   scripts: { build: "next build", dev: "next dev" }
  next.config.ts   transpilePackages: ["@nel3ab/ui","@nel3ab/protocol","@nel3ab/game"]
  tsconfig.json    extends base; module resolution per Next 15
  app/layout.tsx   THE RTL ROOT
  app/page.tsx     placeholder — a heading, in Arabic, nothing else
  app/globals.css  minimal reset; logical properties only
```

`app/layout.tsx` — the one file in this phase with product meaning:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
```

Both attributes are required (REQ-1.4, `mission.md` §3). `dir="rtl"` without `lang="ar"` breaks font fallback and hyphenation; `lang="ar"` without `dir="rtl"` leaves the layout LTR. Verification checks the **rendered HTML**, not the source, because a nested layout or a `<head>` framework quirk can drop an attribute silently.

Do **not** add fonts, tokens, theme switching, or `.ltr-num` — all Phase 2.

### 2.11 `apps/game` [NEW]

**Implements:** REQ-1.5, REQ-1.2

Shell only: manifest (`nel3ab-game`, deps on `@nel3ab/{game,protocol,content}` via `workspace:*`), tsconfig, `src/index.ts` with a placeholder export and a comment naming Phase 9 (deploy) and Phase 11 (rooms/protocol) as owners, plus one test. **No Fastify dependency, no `/healthz`, no server, no `setInterval`.** Adding Fastify now means carrying an unused dependency through eight phases and inviting someone to "just wire up health" outside a reviewed phase.

### 2.12 `eslint.config.mjs` [NEW]

**Implements:** REQ-1.7

Flat config (ESLint 9+). Recommended JS + TypeScript-ESLint recommended over `**/*.{ts,tsx}`; Next's plugin scoped to `apps/web`; ignores for `node_modules`, `.next`, `dist`, `**/*.tsbuildinfo`, and **`design/`** — the handoff is a reference, not linted source (`requirements.md` §4).

Prettier is the sole formatter: include the Prettier compatibility config **last** so no ESLint rule fights it, and do not enable ESLint formatting rules.

### 2.13 `prettier.config.mjs` [NEW]

**Implements:** REQ-1.7

Minimal and boring: no semicolons or semicolons — pick one and never discuss it again; single quotes; 100-column print width; `endOfLine: "lf"` (NFR-2, and it must agree with `.gitattributes` or the two tools will fight forever). Ignore `design/` via `.prettierignore`.

### 2.14 `stylelint.config.mjs` [NEW] — the RTL guardrail

**Implements:** REQ-1.8, REQ-1.9

The load-bearing config of this phase. Two decisions:

**(a) Implement the rule with stylelint's core rules, not a plugin.** A plugin dedicated to logical properties would be more expressive, but this phase must not depend on a package whose exact name, rule names, and maintenance status cannot be verified offline. Core `property-disallowed-list` and `declaration-property-value-disallowed-list` ship with Stylelint and cannot go stale. If a plugin later proves better, swapping it in is a small, reviewed change — and by then the guardrail's negative test (REQ-1.9) already exists to prove the replacement still fires.

```js
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/node_modules/**', 'design/**', '.next/**', 'dist/**'],
  rules: {
    'property-disallowed-list': [
      ['left', 'right',
       'margin-left', 'margin-right',
       'padding-left', 'padding-right',
       'border-left', 'border-right',
       'border-left-width', 'border-right-width',
       'border-left-color', 'border-right-color',
       'border-left-style', 'border-right-style',
       'border-top-left-radius', 'border-top-right-radius',
       'border-bottom-left-radius', 'border-bottom-right-radius'],
      { message: 'Use the logical equivalent (inset-inline-*, margin-inline-*, padding-inline-*, border-inline-*, border-start-start-radius…). Nel3ab is RTL-first — see mission.md §3.' }
    ],
    'declaration-property-value-disallowed-list': [
      { 'text-align': ['/^left$/', '/^right$/'], float: ['/^left$/', '/^right$/'], clear: ['/^left$/', '/^right$/'] },
      { message: 'Use start / end instead of left / right. Nel3ab is RTL-first — see mission.md §3.' }
    ]
  }
}
```

**(b) Restrict the inline axis only.** `top`, `bottom`, `margin-block-*`, `padding-block-*` are unaffected by direction. Banning them produces false positives that train people to add `stylelint-disable`, which is how a guardrail dies.

**Silent failure modes to check explicitly:** the `**/*.css` glob must actually reach `*.module.css` (it does — they are `.css` files, but confirm rather than assume); `ignoreFiles` must not accidentally swallow `packages/ui`; and `stylelint-config-standard` must not be so noisy on a fresh repo that the exit criterion is unreachable — if it is, narrow the extends rather than disabling the two rules above, which are the point.

### 2.15 `.github/workflows/ci.yml` [NEW]

**Implements:** REQ-1.12, NFR-1, NFR-2

Trigger: `pull_request` targeting `main`, plus `push` on `main` (so the protected branch's own history stays green). `runs-on: ubuntu-latest`.

Steps, in order: checkout → install pnpm → `actions/setup-node` with Node 24 and pnpm caching → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`.

- `--frozen-lockfile` is what makes NFR-1/NFR-4 real; without it CI silently resolves a different tree than the one committed.
- **Lint before build.** Lint is seconds and catches the RTL guardrail; build is the slowest step. Fail fast.
- One job, one workflow, no matrix. Node 24 only (`tech-specs.md` §2.1) — a matrix here would be theatre.
- The job name must be stable, because REQ-1.11's required-check configuration references it by name. Renaming the job silently un-protects `main`.

### 2.16 Remote creation and branch protection

**Implements:** REQ-1.10, REQ-1.11

```
gh auth status                      # confirm the account FIRST — see risks
gh repo create nel3ab --private --source=. --remote=origin --push
```

**Blocking pre-check:** `gh` on this machine is authenticated as `AhmedQureshi89`, and the token's scopes (`gist`, `read:org`, `repo`, `workflow`) do not include `user:email`, so the account's email could not be verified offline. REQ-1.10 requires the repo under `a.alshareef.89@gmail.com`. **Confirm the account identity before creating the repo.** A repo created under the wrong account must be deleted and recreated, and if it were the work account the commercial asset would sit in the wrong place.

Then protect `main` (REQ-1.11): require a pull request before merging, require the CI check by its job name, and **ensure the rule applies to the repository owner** — classic branch protection exempts admins unless "do not allow bypassing" is set, and rulesets have an explicit bypass list that must be left empty. Prefer whichever mechanism the account's plan supports for private repos; verify by attempting a direct push and observing rejection, not by reading the settings page.

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `.gitattributes` | NEW | REQ-1.3 |
| `.editorconfig` | NEW | REQ-1.3 |
| `package.json` | NEW | REQ-1.1, 1.2, 1.6, 1.7, 1.8 |
| `pnpm-workspace.yaml` | NEW | REQ-1.1 |
| `pnpm-lock.yaml` | NEW (generated, committed) | NFR-1, NFR-4 |
| `tsconfig.base.json` | NEW | REQ-1.2 |
| `tsconfig.json` | NEW | REQ-1.2 |
| `eslint.config.mjs` | NEW | REQ-1.7 |
| `prettier.config.mjs`, `.prettierignore` | NEW | REQ-1.7 |
| `stylelint.config.mjs` | NEW | REQ-1.8, REQ-1.9 |
| `vitest.config.ts` | NEW | REQ-1.6 |
| `packages/game/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}` | NEW | REQ-1.1, 1.2, 1.5, 1.6 |
| `packages/protocol/{…same four…}` | NEW | REQ-1.1, 1.2, 1.5, 1.6 |
| `packages/content/{…same four…}` + `categories/.gitkeep` | NEW | REQ-1.1, 1.2, 1.5, 1.6 |
| `packages/ui/{…same four…}` + `src/tokens.module.css` | NEW | REQ-1.1, 1.2, 1.5, 1.6, 1.8, 1.9 |
| `apps/web/{package.json,next.config.ts,tsconfig.json,app/layout.tsx,app/page.tsx,app/globals.css}` | NEW | REQ-1.4, 1.2 |
| `apps/web/app/layout.test.tsx` (or equivalent rendered-HTML check) | NEW | verification Gate 4 |
| `apps/game/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}` | NEW | REQ-1.5, 1.2, 1.6 |
| `.github/workflows/ci.yml` | NEW | REQ-1.12 |
| `.gitignore` | MODIFIED — add `*.tsbuildinfo`, `coverage/`, `out/`, `.turbo/` | NFR-1 |
| `specs/roadmap.md` | MODIFIED — tick Phase 1 boxes, set status ✅ at phase end | — |
| `design/**` | UNTOUCHED — it is the reference of record (`mission.md` §5.3); looks lint-dirty on purpose and is excluded from every linter | REQ-1.13 |
| `specs/mission.md`, `specs/tech-specs.md` | UNTOUCHED — corrections already landed in `fc940d6`; no further edits in this phase | — |

---

## 4. Known Risks in This Phase

| # | Risk | What reveals it | Fallback |
|---|---|---|---|
| R1 | **`stylelint-config-standard` is too noisy on a fresh repo**, making `pnpm lint` unreachable and tempting a wholesale disable that takes the RTL rules with it. | First `pnpm lint:css` run. | Narrow `extends` (or drop it and keep only the two RTL rules). Never disable `property-disallowed-list` — it is the phase's reason for existing. Verification Gate 3 catches the regression. |
| R2 | **The guardrail matches nothing** — wrong glob, CSS Modules missed, `ignoreFiles` too broad. | REQ-1.9's negative test — and *only* that test. Nothing else in the phase would notice. | Fix the glob; re-run the negative test. If CSS Modules cannot be reached, that is a finding worth stopping on, not a rule to loosen. |
| R3 | **Vacuous green** — `test` collects nothing, `build` builds nothing, `typecheck` sees no files, and all three exit 0. | Gate 2's count assertions. | `passWithNoTests: false`, an explicit collected-count check, and a per-project build that produces an artifact. |
| R4 | **`gh` is authenticated as the wrong account** (`AhmedQureshi89`, email unverifiable with current scopes). | `gh auth status` / `gh api user` before creation. | Re-auth with the correct account. If a repo was already created wrongly, delete and recreate — do not transfer. |
| R5 | **Branch protection exempts the owner**, so REQ-1.11 is decorative for a solo developer. | Gate 5's direct-push attempt. | Enable "do not allow bypassing"; empty the ruleset bypass list. |
| R6 | **TS project references + source-consumed workspace packages fight Next 15's tsconfig rewriting** (Next edits `apps/web/tsconfig.json` on first build). | First `pnpm build` and `pnpm typecheck` after `apps/web` exists. | Let Next own `apps/web/tsconfig.json`'s module fields and keep strictness inherited from the base; if references prove unworkable for `apps/web` specifically, exclude only that project from the solution graph and typecheck it via `next build`. Record the deviation in `tech-specs.md`. |
| R7 | **Cross-platform script drift** — something passes on Windows and fails on Ubuntu (path separators, case-sensitive imports). Case sensitivity is the likely one: Windows will not notice `@nel3ab/UI`. | Gate 6, the verdict gate — CI on Ubuntu from a frozen lockfile. | Fix the offending import/script. This gate is a measurement of the toolchain, not of our logic: a FAIL is a finding about the stack, recorded before any retry. |
| R8 | **Node 24 / Next 15 / React 19 / Vitest / ESLint 9 version incompatibility** at the pinned set. | Install and first build. | A FAIL here is a stack decision, not a bug — record it, and change `tech-specs.md` §2.1 deliberately rather than floating a version range to make it pass. |

---

*Last updated: 2026-08-17*
