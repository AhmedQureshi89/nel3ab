# Phase 2 Technical Specification — Arcade design system

> **Phase:** Phase 2
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** 1 day

---

## 1. Architecture Overview

Everything this phase builds lives in two places: `packages/ui` (the design system) and
`apps/web` (the fonts, the wiring and the proof surface). Nothing else in the workspace moves.

**Dependency order is part of the design.** A runner walks it top to bottom; each step is
buildable and testable before the next begins, and the two verdict gates are placed so that a
halt is as cheap as possible.

```
  STEP 0 ─ Licence  (🚦 VERDICT GATE — evaluated BEFORE any binary is committed)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ apps/web/app/fonts/LICENSE-*.txt  [NEW]                              │
  │ apps/web/app/fonts/README.md      [NEW]  provenance + SHA-256        │
  │   ── upstream terms permit redistribution?  FAIL ⇒ HALT (REQ-2.2)    │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 1 ─ Package plumbing                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ packages/ui/package.json   [MOD]  react, react-dom, exports map      │
  │ packages/ui/tsconfig.json  [MOD]  jsx, DOM lib, **/*.tsx             │
  │ packages/ui/src/css.d.ts   [NEW]  ambient '*.module.css'             │
  │ vitest.config.ts           [MOD]  include *.test.tsx everywhere      │
  │   ── first .tsx renders under all four gate commands (REQ-2.1)       │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 2 ─ The token layer        ▼          ── nothing below can start first:
  ┌──────────────────────────────────────────────────────────────────────┐    every
  │ packages/ui/src/styles/tokens.css  [NEW]  3 palette blocks           │    primitive
  │ packages/ui/src/styles/base.css    [NEW]  globals, keyframes,        │    reads
  │                                           .ltr-num                   │    var(--…)
  │ packages/ui/src/styles/tokens.test.ts [NEW]  contract vs design/     │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 3 ─ The press mechanism    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ packages/ui/src/styles/press.module.css [NEW]  .press + calc()       │
  │ packages/ui/src/styles/press.test.ts    [NEW]  invariant vs designs/ │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 4 ─ Primitives             ▼  (Button LAST — it is the only one that composes press)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Panel.tsx/.module.css → Card → Pill → Dot → Button                   │
  │ packages/ui/src/index.ts [MOD]  drops PLACEHOLDER                    │
  │ packages/ui/src/index.test.ts [MOD] ┐ both currently assert          │
  │ apps/web/smoke.test.ts        [MOD] ┘ PLACEHOLDER — they WILL break  │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 5 ─ Wiring                 ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ apps/web/app/fonts/*.woff2 [NEW]  the binaries themselves            │
  │ apps/web/app/fonts.ts      [NEW]  next/font/local declarations       │
  │ apps/web/app/layout.tsx    [MOD]  css imports + font variables       │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 6 ─ Proof surface          ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ apps/web/app/styleguide/page.tsx + .module.css [NEW]                 │
  │ apps/web/styleguide.test.ts                    [NEW]                 │
  └──────────────────────────────────────────────────────────────────────┘
                                  │
  STEP 7 ─ Gates                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 🚦 four gate commands, no escape hatch (REQ-2.12)                    │
  │    human visual comparison against the prototypes                    │
  └──────────────────────────────────────────────────────────────────────┘
```

**Why the token layer is a plain global stylesheet and the primitives are CSS Modules.**
Custom properties must land on real `:root` / `[data-theme]` selectors; a CSS Module would still
emit those correctly (no class to hash) but would advertise, wrongly, that the file is scoped.
Component rules must be scoped, because `apps/web` and every later screen will define its own
`.card`. So: two plain `.css` files imported once from the root layout, and one `.module.css`
per primitive. `press.module.css` is a module because CSS Modules' `composes` is the only
"mixin" the toolchain has.

---

## 2. Component Specifications

### 2.1 `apps/web/app/fonts/` [NEW] — the binaries and their provenance

**Implements:** REQ-2.2, REQ-2.3

Contents:

| File | Purpose |
|---|---|
| `BalooBhaijaan2-*.woff2` | Baloo Bhaijaan 2, covering weights 500, 600, 700, 800 |
| `Archivo-*.woff2` | Archivo, covering weights 600, 800 |
| `LICENSE-BalooBhaijaan2.txt` | the upstream licence text, verbatim |
| `LICENSE-Archivo.txt` | the upstream licence text, verbatim |
| `README.md` | provenance: source URL, upstream version/commit, retrieval date, SHA-256 of every `.woff2`, and the licence's redistribution clause quoted |

Both families may be shipped either as one variable `woff2` per family spanning the required
weight range, or as one static instance per weight. **Prefer the variable file** if it covers the
range: fewer files, one hash to record, and `next/font/local` supports a weight range on a single
`src` entry. If it does not cover the Arabic range at the needed weights, ship static instances
and say so in `README.md`.

Do **not** fetch from `https://fonts.googleapis.com/css2?...`: that endpoint returns
unicode-range-sliced subsets tied to a requesting user agent, which is neither reproducible nor
provenance-recordable. Take the font from its project's own release/source of record.

> **Silent failure mode.** `.gitattributes` already lists `*.woff2 binary`, so EOL normalisation
> is off — but only for paths that match. If a font is ever committed with a different
> extension, git will corrupt it silently on a Windows checkout and it will fail only in a
> browser. The SHA-256 recorded in `README.md` is what makes that detectable; record it from the
> file **after** committing and re-checking out, not before.

### 2.2 `apps/web/app/fonts.ts` [NEW]

**Implements:** REQ-2.3

Declares both families with `next/font/local` and exposes them as CSS variables so the token
layer can consume them rather than hard-coding a family name in a component.

```ts
import localFont from 'next/font/local'

export const baloo = localFont({
  src: [ /* one entry per file, with weight (or a range) and style */ ],
  variable: '--font-baloo',
  display: 'swap',
  preload: true,
})

export const archivo = localFont({
  src: [ /* … */ ],
  variable: '--font-archivo',
  display: 'swap',
  preload: true,
})
```

Invariants:

- `display: 'swap'` matches the prototypes' `&display=swap`.
- The variable names are `--font-baloo` / `--font-archivo` and are **not** `--font` / `--font-en`.
  `--font` and `--font-en` are reference tokens owned by `tokens.css` (REQ-2.4) and are defined
  there in terms of these two, so that the token layer stays a faithful port and the app supplies
  only the resolved family names.
- `next/font/local` is called at module scope, once. It may not be called from `packages/ui` —
  it is a Next-only loader and `packages/ui` is also consumed by `tsc --build` and Vitest, neither
  of which can resolve it.

### 2.3 `packages/ui/src/styles/tokens.css` [NEW]

**Implements:** REQ-2.4, REQ-2.5

A verbatim port of `design/arcade-tokens.css`'s two `:root` / `[data-theme="dark"]` declaration
blocks, restructured into **three** selector blocks so that themes nest:

```css
:root,
[data-theme='light'] {
  /* every declaration from design/arcade-tokens.css :root, values unchanged */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    /* the 7 declarations from design/arcade-tokens.css [data-theme="dark"] */
  }
}

[data-theme='dark'] {
  /* the same 7 declarations, again */
}
```

- The `--font` / `--font-en` declarations are ported with their fallback stacks intact but with
  the first family taken from `var(--font-baloo, "Baloo Bhaijaan 2")` /
  `var(--font-archivo, "Archivo")`, so the file works standalone (styleguide, tests) and picks up
  the hashed `next/font` family when `apps/web` provides it.
- Nothing else is edited. Not a hex, not a unit, not a comment's meaning.
- The dark block is duplicated on purpose (media query + attribute). REQ-2.4's test asserts all
  three blocks against the reference, so the duplication cannot drift.
- **The `:root:not([data-theme='light'])` guard is load-bearing.** Without it, a
  `[data-theme="light"]` container on a device preferring dark would inherit `:root`'s dark values
  for any token it does not itself redeclare — and the light block redeclares all of them only
  because it is the full palette. Keep the guard so the reasoning does not depend on that.

> **DECIDED 2026-08-20 — follow the device** (requirements.md REQ-2.5). Write the three blocks
> exactly as shown above, including the `@media` block, and leave `<html>` with **no**
> `data-theme` attribute (specs.md §2.13). The rejected alternative — omit the `@media` block and
> set `data-theme="light"` on `<html>` — is not to be reintroduced during implementation.

### 2.4 `packages/ui/src/styles/base.css` [NEW]

**Implements:** REQ-2.6, REQ-2.7

The globals and keyframes from `design/arcade-tokens.css`, verbatim: `:focus`,
`:focus-visible`, `::selection`, `[aria-disabled="true"], :disabled`, and `@keyframes pop / bob /
ring / slidein`.

Then the one thing the reference does not have:

```css
.ltr-num {
  font-family: var(--font-en);
  direction: ltr;
  unicode-bidi: isolate;
}
```

- `unicode-bidi: isolate` is what stops the run from reordering its Arabic neighbours; `direction:
  ltr` alone does not — an embedded LTR run without isolation still participates in the
  surrounding bidi paragraph and can drag adjacent punctuation with it. Both, or it is broken in
  the case it exists for.
- `font-variant-numeric` is deliberately **not** set (requirements §4). A future decision to add
  `tabular-nums` is a design amendment, not a bug fix.
- `base.css` is a plain stylesheet, so `.ltr-num` is a real, unhashed global class name that any
  app or package can use. That is intentional; it is a utility, not a component.
- The `.press` rule from `design/arcade-tokens.css` is **not** ported here — see §2.5 for why.

### 2.5 `packages/ui/src/styles/press.module.css` [NEW]

**Implements:** REQ-2.8

`design/arcade-tokens.css` ends with:

```css
.press:active { transform: translateY(4px); box-shadow: 0 2px 0 var(--stroke); }
```

That is correct only for a control whose rest shadow is `0 6px 0`, and it is not the invariant —
it is one of its three instances (requirements §1.1). Port the invariant, not the instance:

```css
.press {
  box-shadow: 0 var(--press-rest) 0 var(--stroke);
}

.press:active:not(:disabled):not([aria-disabled='true']) {
  transform: translateY(var(--press-travel));
  box-shadow: 0 calc(var(--press-rest) - var(--press-travel)) 0 var(--stroke);
}
```

Consumers set `--press-rest` and `--press-travel`; the pressed offset is computed. The three
measured pairs become variant values, not literals in this file:

| Variant | `--press-rest` | `--press-travel` | resulting pressed offset |
|---|---|---|---|
| Button `primary` | `6px` | `4px` | `2px` |
| Button `action` | `5px` | `3px` | `2px` |
| Pill `selected`, Card `raised` (Panel `0 4px 0`) | `4px` | `3px` | `1px` |

Invariants:

- **No `scale`, no `opacity`, no `filter` in this file.** `mission.md` §3 names all three as the
  ways the press gets lost. The test in §2.11 greps for them.
- The `:not(:disabled):not([aria-disabled='true'])` guard is why disabled controls do not press,
  and it lives here rather than in each variant.
- A control with no rest shadow (Button `secondary`, §2.9) does **not** compose `.press`. It is
  not a suppressed press; it is a control that was never raised.

### 2.6 `packages/ui/src/primitives/` [NEW] — Panel, Card, Pill, Dot

**Implements:** REQ-2.9

Each primitive is `X.tsx` + `X.module.css`. Shared contract:

- Function components, no `"use client"` — none of them holds state or handlers of its own.
  Screens that need interactivity mark themselves.
- Props extend the matching intrinsic element's props (`React.ComponentPropsWithoutRef<'div'>`
  etc.), forward `className` by appending, and spread `...rest` last so a caller can always
  override.
- **Every variant is also emitted as a stable `data-*` attribute** (`data-variant`, `data-tone`,
  `data-size`, `data-selected`, `data-won`). Tests assert on those, never on a CSS-Module class
  name — module class names are hashed and their exact form is a build detail, not a contract.
- No inline `style` and no colour literal in `.tsx`. Colours come from tokens, in CSS.

| Primitive | Element | Props | Measured values (from the prototypes) |
|---|---|---|---|
| `Panel` | `div` | `raised?: boolean` (default `true`), `padded?: boolean` (default `true`) | `background: var(--panel)`; `border: var(--bd-thick) solid var(--stroke)`; `border-radius: var(--r)`; raised ⇒ `box-shadow: var(--sh-card)` (`0 4px 0`); padded ⇒ `padding: var(--pad-card)` (14px) |
| `Card` | `div` | `size?: 'md' \| 'lg'` (default `'md'`), `raised?`, `padded?` | `md` = Panel. `lg` = the question-card shell: `border-radius: var(--r-lg)` (24px), `box-shadow: var(--sh-cta)` (`0 6px 0`), `overflow: hidden`, **no padding** — its header strip and hint footer must reach the border. `lg` is the shell only; its contents are Phase 6 |
| `Pill` | `span` | `tone?: 'panel' \| 'red' \| 'sky' \| 'yellow'` (default `'panel'`), `selected?: boolean` | `border-radius: var(--r-pill)`; `border: var(--bd) solid var(--stroke)` (2.5px); `font-size: 13.5px; font-weight: 700`; `padding-block: 4px; padding-inline: 8px 12px`; `selected` ⇒ `box-shadow: var(--sh-sel)` (`0 3px 0`) |
| `Dot` | `span` | `size?: 'sm' \| 'md'` (default `'sm'`), `won?: boolean` | `sm` = 9px (play screen), `md` = 11px (round/match end); `border-radius: 50%`; `border: var(--bd-thin) solid var(--stroke)` (2px); `won` ⇒ `background: var(--yellow)`, otherwise `transparent`; `display: inline-block`. Renders `aria-hidden="true"` — a win count is conveyed by the tally text beside it, and six unlabelled circles are noise to a screen reader |

> **Silent failure mode — the Pill's inline padding.** The prototype writes
> `padding: 4px 8px 4px 12px`, i.e. physical `right: 8px`, `left: 12px`. The document is
> `dir="rtl"`, so physical right **is** inline-start. The logical form is therefore
> `padding-inline: 8px 12px` — *start 8, end 12*, the narrow side against the text and the wide
> side against the `↔` / `✕` buttons. Writing `padding-inline: 12px 8px` is type-correct, lints
> clean, looks plausible, and is mirrored. Stylelint cannot catch it because both forms are
> logical. This is the single most likely fidelity error in the phase.

### 2.7 `packages/ui/src/primitives/Button.tsx` + `Button.module.css` [NEW]

**Implements:** REQ-2.10, REQ-2.8

```tsx
type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'action'   // default 'primary'
  subLabel?: React.ReactNode                     // 'action' only
}
```

- Renders `<button type="button" data-variant={variant}>` — an explicit `type` so a Button inside
  a future `<form>` (the join screen, Phase 13) does not submit it by accident. `type` remains
  overridable through `...rest`.
- `disabled` ⇒ the native attribute **and** `aria-disabled="true"`, so `base.css`'s
  `[aria-disabled="true"], :disabled` rule and `press.module.css`'s `:not()` guard both apply
  regardless of which selector a consumer relies on.
- `subLabel`, when present, renders as a block element after the label. Ignored for
  non-`action` variants (typed loosely, documented here; not worth a discriminated union for
  three variants).

| Variant | Border | Radius | Padding | Type | Fill | Rest shadow | Travel |
|---|---|---|---|---|---|---|---|
| `primary` | 3px | 18px | `17px 20px` | 20px / 800 | `var(--yellow)`, text `var(--on-yellow)` | `0 6px 0` | 4px |
| `action` | 3px | 18px | `15px 8px` | 15.5px / 800 | caller's, via `data-tone` or `className` — the prototype's three action buttons are panel / yellow / leaf | `0 5px 0` | 3px |
| `secondary` | 2.5px | 16px | `13px` | 15px / 700 | `var(--panel)`, text `var(--ink)` | **none** | **none** |

- `primary` lays out as `display: flex; align-items: center; justify-content: space-between` —
  the prototype puts the label at one end and the `▶` glyph at the other, on every primary CTA.
  Do not centre it.
- `primary` also carries `filter: brightness(1.04)` on `:hover`, from the prototype. It is a
  hover, not a press; it does not conflict with §2.5's "no filter" rule, which is about `:active`.
- `action`'s sub-label is `11px / 700` at `opacity: .6`.
- `secondary` composes nothing from `press.module.css`. See §2.5.
- `primary` and `action` `composes: press from '../styles/press.module.css'` and set
  `--press-rest` / `--press-travel` per the table in §2.5.

### 2.8 `packages/ui/src/index.ts` [MODIFIED] — and the two tests that break

**Implements:** REQ-2.1

Exports the five primitives and their prop types. **Deletes `PLACEHOLDER`.**

Two existing tests assert `PLACEHOLDER === true` and will fail the moment it goes:

- `packages/ui/src/index.test.ts` — replace with a test that the package's public exports are
  present and are functions.
- `apps/web/smoke.test.ts` — its comment says it exists so that `nel3ab-web` is one of the six
  projects Vitest collects. Keep that purpose; change the import to a real primitive.

Neither may be deleted: `scripts/check-collected-tests.mjs` requires at least one collected file
per workspace project (`CLAUDE.md` invariant 2, NFR-2.5).

### 2.9 `packages/ui/package.json` [MODIFIED]

**Implements:** REQ-2.1, NFR-2.3

```jsonc
{
  "dependencies":    { "react": "19.2.8" },
  "devDependencies": { "react-dom": "19.2.8", "@types/react": "19.2.18", "@types/react-dom": "19.2.4" },
  "exports": {
    ".":            "./src/index.ts",
    "./tokens.css": "./src/styles/tokens.css",
    "./base.css":   "./src/styles/base.css"
  }
}
```

- Versions are the ones `apps/web` already pins, character for character. A different pin here
  would resolve a second React and break hooks the first time a screen uses one.
- `react` is a plain dependency rather than a peer: pnpm gives both workspace members the same
  physical package at an identical pin, and `peerDependencyRules` is forbidden by
  `CLAUDE.md` invariant 4, so a peer that ever went unmet would have no permitted escape.
- `react-dom` is a devDependency: only the tests need it (`renderToStaticMarkup`).
- The `./tokens.module.css` export is **removed** along with the file it points at.

### 2.10 `packages/ui/tsconfig.json` [MODIFIED] · `packages/ui/src/css.d.ts` [NEW]

**Implements:** REQ-2.1

```jsonc
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],   // React's types need DOM
    "jsx": "react-jsx"                          // NOT "preserve"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"]
}
```

- `jsx: "react-jsx"` (not `apps/web`'s `"preserve"`) is what lets Vite/oxc transform this
  package's JSX under Vitest without a per-project `oxc` override in `vitest.config.ts`. It is
  also why `apps/web` needed that override and this package should not. If it turns out to need
  one anyway, that is risk R2 below — add it the same way `apps/web` did, not by changing `jsx`.
- `module`/`moduleResolution` stay `NodeNext`, `composite`/`declaration` stay on: the root
  solution `tsconfig.json` references this project and `apps/web` references it back.
- `src/css.d.ts` declares CSS Modules for `tsc`, which does not understand them:

  ```ts
  declare module '*.module.css' {
    const classes: Readonly<Record<string, string>>
    export default classes
  }
  ```

  A `Record<string, string>` rather than a generated per-file type: generating types is a
  toolchain decision, and `noUncheckedIndexedAccess` in `tsconfig.base.json` would make a
  generated map's misses `string | undefined` — a papercut in every component for no benefit
  here. `Readonly<Record<…>>` is honest about what the bundler produces.

### 2.11 Tests

**Implements:** verification §1–§2, NFR-2.6

| File | What it asserts |
|---|---|
| `packages/ui/src/styles/tokens.test.ts` [NEW] | Reads `design/arcade-tokens.css` and `src/styles/tokens.css` from disk, parses `--name: value` pairs per selector block, and asserts: (a) every reference `:root` token appears in the shipped light block with an identical value; (b) every reference `[data-theme="dark"]` token appears in **both** shipped dark blocks with an identical value; (c) the shipped light block declares no colour/radius/border/shadow/motion token absent from the reference; (d) the two shipped dark blocks are identical to each other. `--font` / `--font-en` are compared modulo the `var(--font-baloo, …)` indirection §2.3 introduces, and that exemption is named in the test, not implicit |
| `packages/ui/src/styles/press.test.ts` [NEW] | Reads the three `design/designs/*.dc.html` files, extracts every `(rest offset, travel, pressed offset)` triple from the `box-shadow` / `style-active` pairs, and asserts `pressed === rest − travel` for all of them — i.e. that the invariant this phase encodes is the invariant the prototypes actually have. Then reads `press.module.css` and asserts it contains `calc(var(--press-rest) - var(--press-travel))` and contains none of `scale(`, `opacity`, `filter` |
| `packages/ui/src/primitives/primitives.test.tsx` [NEW] | `renderToStaticMarkup` on each primitive and each variant; asserts the rendered element, its `data-*` variant attributes, `type="button"`, `disabled` ⇒ `aria-disabled="true"`, `Dot` ⇒ `aria-hidden`, and that `className` passed by a caller survives |
| `packages/ui/src/styles/ltr-num.test.ts` [NEW] | Asserts `base.css`'s `.ltr-num` sets `direction: ltr`, `unicode-bidi: isolate` and `var(--font-en)` — the isolation half is the half that gets dropped |
| `packages/ui/src/index.test.ts` [MODIFIED] | Public exports present and callable; `PLACEHOLDER` gone |
| `apps/web/smoke.test.ts` [MODIFIED] | Same purpose, real import |
| `apps/web/styleguide.test.ts` [NEW] | `renderToStaticMarkup` the styleguide page; asserts it contains a `data-theme="light"` subtree and a `data-theme="dark"` subtree, and that each of the five primitives appears in both. Asserts the production guard is present |

Path resolution: tests resolve `design/` from `import.meta.url`, not from `process.cwd()` —
each Vitest project sets its own `root` (`vitest.config.ts`), so `cwd` is not the repo root.

`renderToStaticMarkup` is the precedent already set by `apps/web/rtl-root.test.ts`. **No jsdom,
no `@testing-library/*`, no `happy-dom`** — three dependencies to assert things about static
output that server rendering already gives us. `:active` cannot be tested in jsdom either, so
the DOM would buy nothing the CSS-text assertions above do not.

### 2.12 `vitest.config.ts` [MODIFIED]

**Implements:** REQ-2.1, NFR-2.5

One line: the shared `project()` helper's `include` becomes `['**/*.test.ts', '**/*.test.tsx']`.

Applied to all six projects, not just `packages/ui` — a per-project include is one more thing to
remember in Phase 5. **Widening must not narrow:** `.test.ts` stays first and stays matched, or
five projects drop out of collection and `pnpm test` fails on the collected count. Nothing else
in this file changes; in particular `apps/web`'s `oxc.jsx` override and its comment stay exactly
as they are.

### 2.13 `apps/web/app/layout.tsx` [MODIFIED]

**Implements:** REQ-2.3, REQ-2.5

```tsx
import '@nel3ab/ui/tokens.css'
import '@nel3ab/ui/base.css'
import './globals.css'

import { archivo, baloo } from './fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${baloo.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- **Import order is load-bearing.** Tokens, then base (which uses them), then `globals.css` (the
  app's reset, which may override). Reordering changes the cascade.
- `apps/web/rtl-root.test.ts` asserts the **whole** opening tag is exactly
  `<html lang="ar" dir="rtl">`. Adding `className` breaks it. That test's comment explains why it
  is written as a whole-tag match, and that reasoning still holds — so update the expected string
  to the new whole tag, keeping the whole-tag form. Do not relax it to a substring check.
- Per the 2026-08-20 decision (REQ-2.5), `<html>` carries **no** `data-theme` attribute. The
  expected tag becomes `<html lang="ar" dir="rtl" class="…">` with whatever class string
  `next/font` produces — assert the whole tag, with the two font variables named.

### 2.14 `apps/web/app/styleguide/page.tsx` + `styleguide.module.css` [NEW]

**Implements:** REQ-2.11

```tsx
import { notFound } from 'next/navigation'

export default function StyleguidePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return ( /* two side-by-side <section data-theme="light"> / <section data-theme="dark"> */ )
}
```

- Each section renders **every** primitive and **every** variant: Panel raised/flat,
  Card md/lg, Pill in all four tones plus selected, Dot sm/md × won/not, Button
  primary/secondary/action × enabled/disabled, an `.ltr-num` sample inside an Arabic sentence, and
  a `:focus-visible` target.
- Each section sets its own `background: var(--bg); color: var(--ink)` so the theme is visible,
  not just applied.
- Two columns side by side, collapsing to one below ~760px, laid out on the inline axis
  (`grid-template-columns`, `gap`) — the styleguide is subject to NFR-2.2 like everything else.
- `notFound()` rather than a build-time exclusion: the route stays in the project so
  `pnpm typecheck` and `next build` keep covering it, and it is unreachable in production.
- `process.env.NODE_ENV` is inlined at build time by Next, so this is a static branch, not a
  runtime check that could be flipped.

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `apps/web/app/fonts/*.woff2` | NEW (binary) | REQ-2.3 |
| `apps/web/app/fonts/LICENSE-*.txt` | NEW | REQ-2.2 |
| `apps/web/app/fonts/README.md` | NEW | REQ-2.2 |
| `apps/web/app/fonts.ts` | NEW | REQ-2.3 |
| `packages/ui/src/styles/tokens.css` | NEW | REQ-2.4, REQ-2.5 |
| `packages/ui/src/styles/base.css` | NEW | REQ-2.6, REQ-2.7 |
| `packages/ui/src/styles/press.module.css` | NEW | REQ-2.8 |
| `packages/ui/src/primitives/{Panel,Card,Pill,Dot}.tsx` + `.module.css` | NEW | REQ-2.9 |
| `packages/ui/src/primitives/Button.tsx` + `.module.css` | NEW | REQ-2.10 |
| `packages/ui/src/css.d.ts` | NEW | REQ-2.1 |
| `packages/ui/src/styles/{tokens,press,ltr-num}.test.ts` | NEW | verification §1, §2 |
| `packages/ui/src/primitives/primitives.test.tsx` | NEW | verification §2 |
| `apps/web/app/styleguide/page.tsx` + `styleguide.module.css` | NEW | REQ-2.11 |
| `apps/web/styleguide.test.ts` | NEW | verification §3 |
| `packages/ui/src/index.ts` | MODIFIED | REQ-2.1 |
| `packages/ui/src/index.test.ts` | MODIFIED | §2.8 — currently asserts `PLACEHOLDER` |
| `packages/ui/package.json` | MODIFIED | REQ-2.1 |
| `packages/ui/tsconfig.json` | MODIFIED | REQ-2.1 |
| `apps/web/app/layout.tsx` | MODIFIED | REQ-2.3, REQ-2.5 |
| `apps/web/rtl-root.test.ts` | MODIFIED | §2.13 — the whole-tag assertion changes |
| `apps/web/smoke.test.ts` | MODIFIED | §2.8 — currently asserts `PLACEHOLDER` |
| `vitest.config.ts` | MODIFIED | §2.12 — `include` only |
| `pnpm-lock.yaml` | MODIFIED | REQ-2.1 (react into `packages/ui`) |
| `packages/ui/src/tokens.module.css` | **DELETED** | superseded by `styles/tokens.css`. It exists only as REQ-1.9's lint target; after this phase Stylelint has ~10 real files, so invariant 3 is better served, not worse |
| `apps/web/next.config.ts` | UNTOUCHED — looks like it needs `@nel3ab/ui` added, but `transpilePackages` already lists it | — |
| `apps/web/tsconfig.json` | UNTOUCHED — already references `packages/ui`; it sets `jsx: "preserve"` and must keep it (Next compiles its own JSX) | — |
| `apps/web/app/globals.css` | UNTOUCHED — the reset stays; tokens do not belong in the app | — |
| `stylelint.config.mjs` | UNTOUCHED — invariant 3. New CSS conforms to it, not the reverse | — |
| `eslint.config.mjs` | UNTOUCHED — `**/*.{ts,tsx}` already covers `packages/ui`; `design/` stays ignored | — |
| `.github/workflows/ci.yml` | UNTOUCHED — invariant 1, the `ci` job name is required by branch protection | — |
| `.gitattributes` | UNTOUCHED — already marks `*.woff2 binary` | — |
| `.prettierignore` | UNTOUCHED — Prettier does not format `.woff2`; `design/` and `specs/` stay ignored | — |
| `scripts/check-collected-tests.mjs` | UNTOUCHED — derives its count from the workspace; needs no edit for new test files | — |
| `design/**` | UNTOUCHED — read by tests, never written (NFR-2.1) | — |
| `specs/mission.md`, `tech-specs.md`, `roadmap.md` | UNTOUCHED except `roadmap.md`'s Phase 2 status row and Completed Work section at phase close | — |

---

## 4. Known Risks in This Phase

**R1 — CSS Modules in a source-consumed workspace package may not survive all four tools.**
`packages/ui` is read simultaneously by `tsc --build` (project references), Vite/oxc (Vitest),
Next's `transpilePackages`, and Stylelint. `.module.css` inside such a package is the least
well-trodden of these. *Revealed by:* REQ-2.12's gate. *Fallback:* the primitives move into
`apps/web/components/` and `packages/ui` keeps only the token and base stylesheets — a change to
`tech-specs.md` §2.3 that must be recorded as a finding, not made quietly.

**R2 — Vitest may not transform `packages/ui`'s JSX without an `oxc` override.** `apps/web`
needed one because its tsconfig sets `jsx: "preserve"`; `packages/ui` sets `jsx: "react-jsx"`, so
it should not. *Revealed by:* the first `.test.tsx` failing to parse. *Fallback:* add the same
`oxc: { jsx: { runtime: 'automatic' } }` override for the `@nel3ab/ui` project in
`vitest.config.ts`, with a comment saying why — **not** by changing the package's `jsx` setting,
which would then disagree with what `tsc --build` emits.

**R3 — Vitest's handling of `.module.css` imports.** With `css: false` (the default), a CSS
Module import resolves to a proxy whose exact behaviour is a Vitest implementation detail.
*Mitigated by design:* §2.6 requires every variant to be asserted through `data-*` attributes,
so no test depends on a class name's value. If a `.module.css` import throws outright rather than
resolving to a proxy, set `test.css: true` for the `@nel3ab/ui` project — a config change, not an
escape hatch, so it does not trip REQ-2.12.

**R4 — The font files may not exist in a form that is both licensed and complete.** A variable
file may not span 500–800 for Baloo Bhaijaan 2's Arabic, or the only convenient source may be the
CDN's sliced subsets. *Revealed by:* REQ-2.2, before anything is committed. *Fallback:* static
instances per weight, recorded in `fonts/README.md`. If the licence itself fails, the phase halts
(REQ-2.2 is a verdict gate) and `tech-specs.md` §2.1 needs an amendment.

**R5 — The port is faithful to `arcade-tokens.css` but `arcade-tokens.css` is not faithful to the
prototypes.** The reference is described as "extracted verbatim from the HTML prototypes," but the
prototypes contain values it does not carry — `--on-yellow` and the `--sh-*` family appear only in
the reference, while `#ffe2db`, `0 9px 0` and the multi-second `bob` loops appear only in the
prototypes. REQ-2.4 measures the port against the reference, so a gap between reference and
prototype passes every automated check. *Revealed by:* the human comparison in verification §3,
and only there. *Response:* record the discrepancy; `mission.md` §5.3 says the prototype wins, so
resolving it is a spec amendment, not a silent token addition.

**R6 — `renderToStaticMarkup` proves less than it appears to.** It exercises no CSS, no `:active`,
no `:focus-visible`, no `@media`, no bidi. Every visual claim in this phase rests on either a
CSS-text assertion or a human looking at the styleguide. Verification §6 states this plainly
rather than letting a green `pnpm test` imply more than it means.

---

*Last updated: 2026-08-20*
