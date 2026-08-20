# Phase 2 Verification & Test Plan — Arcade design system

> **Phase:** Phase 2
> **Parent Requirements:** [requirements.md](requirements.md)
> **Parent Specification:** [specs.md](specs.md)

---

## Notation

| Marker | Meaning | On failure |
|---|---|---|
| `- [ ]` | ordinary check — tests *our code* | fix and retry freely |
| `- [ ] 🚦 **(VERDICT GATE — no retry)**` | measures *reality* | **halt.** Record the result. Never retry into green |
| `- [ ] 👁` | requires a human to look at a screen | no test can substitute; record what was observed |

A verdict gate's failure is a finding, not a bug. `/spec-next` and `/spec-run` are required to
stop at one. If a check's kind is unclear, it is a verdict gate.

**Gate ordering.** Gate 0 blocks everything — it is evaluated before a single font byte is
committed. Gates 1–4 are the build order from [specs.md](specs.md) §1 and each blocks the next.
Gate 5 is evaluated last, once, over the finished phase. Gate 6 is the human pass and is the
phase's exit criterion.

---

## 0. Gate 0 — Licence (blocks every other gate)

Evaluated **before** any binary lands in the repository. Nothing else in this phase may start
until this box is ticked, because A-1 made the repository world-readable and a commit is not
retractable by making it private later (the same irreversibility `mission.md` A-2 records).

- [x] 🚦 **REQ-2.2 (Font redistribution licence) (VERDICT GATE — no retry):** for **each** of
  Baloo Bhaijaan 2 and Archivo, the upstream licence has been read from the family's own source
  of record (not a summary, not a blog, not a memory of what Google Fonts usually ships), and it
  **explicitly permits redistribution of the font files, including in a public source
  repository**. The licence identifier, the clause that grants redistribution, and the URL it was
  read from are recorded below.
  **A FAIL here halts the phase.** It means `tech-specs.md` §2.1's "self-host, Google Fonts CDN is
  not used in production" cannot be satisfied for that family, which is an amendment to make in
  `mission.md` §8 — not a licence to reinterpret.
  **VERDICT 2026-08-20: PASS — both families permit redistribution, including in a public source
  repository.** Evaluated once. Both licences were read as **files in the family's own upstream
  repository**, fetched through the GitHub contents API (raw blob bytes, not a rendered page), not
  from a summary and not from Google Fonts' copy.
  > Measured: **Baloo Bhaijaan 2** — licence **SIL Open Font License, Version 1.1** (`OFL-1.1`,
  > 26 February 2007), copyright line `Copyright 2019 The Baloo 2 Project Authors
  > (https://github.com/EkType/Baloo2)`; clause — `PERMISSION & CONDITIONS`: *"Permission is hereby
  > granted, free of charge, to any person obtaining a copy of the Font Software, to use, study,
  > copy, merge, embed, modify, **redistribute**, and sell modified and unmodified copies of the
  > Font Software, subject to the following conditions"*; source
  > `https://github.com/EkType/Baloo2-Variable/blob/da4090c1dd5798a3e72d7138e379ee1f94d6349c/OFL.txt`
  > (93 lines, 4384 bytes, sha256 `ad09b05dc8bc678c9daf7c4c5f7ef1f55e5726127f4330b2e98e40b9dffcb860`).
  > Measured: **Archivo** — licence **SIL Open Font License, Version 1.1** (`OFL-1.1`), copyright
  > line `Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)`;
  > the same `PERMISSION & CONDITIONS` clause, **word-for-word** (`diff` of the two files reports a
  > single differing line — line 1, the copyright — and nothing else); source
  > `https://github.com/Omnibus-Type/Archivo/blob/b5d63988ce19d044d3e10362de730af00526b672/OFL.txt`
  > (93 lines, 4388 bytes, sha256 `108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b`).

  **The upstream for Baloo Bhaijaan 2 was identified, not assumed.** The obvious candidates were
  wrong: `googlefonts/baloo` does not exist (HTTP 404), and `EkType/Baloo2` — the repository named
  in the copyright line — carries only the ten Indic/Latin members and **no Arabic family**
  (`Baloo2-Devanagari`, `BalooBhai2-Gujarati`, … no `BalooBhaijaan2`). Google Fonts'
  `ofl/baloobhaijaan2/METADATA.pb` names `repository_url: https://github.com/EkType/Baloo2-Variable`
  with `commit: da4090c…`, and that commit is the one read above. Reading `EkType/Baloo2`'s OFL and
  calling it Bhaijaan's would have been the plausible-looking error here; both files happen to be
  identical OFL 1.1, so it would never have been caught downstream.

  **Redistribution in a public repo specifically:** neither licence conditions on the medium — the
  OFL's five conditions concern selling the font by itself (1), carrying the notice (2), Reserved
  Font Names (3), endorsement (4) and staying under the OFL (5). Condition 2 is why
  `LICENSE-BalooBhaijaan2.txt` and `LICENSE-Archivo.txt` are committed **in the same directory as
  the binaries will be**, verbatim: `git cat-file blob` of each staged file hashes to the two
  sha256 values above, byte-identical to upstream, BOM and all — `.gitattributes`'
  `* text=auto eol=lf` altered nothing, because both upstream files are already LF-only (0 CR
  bytes). **Neither family declares a Reserved Font Name** ("with Reserved Font Name" is absent
  from both copyright lines), so the `.ttf → .woff2` conversion at STEP 5 may keep the family name.
  That is a fact about today's upstream and must be re-checked before any font upgrade.

  *(Boxes 2 and 3 below stay unticked: no binary is committed yet — they are STEP 5's, and their
  SHA-256s are only meaningful after a commit and a fresh checkout.)*

- [ ] **REQ-2.2 (Provenance recorded):** `apps/web/app/fonts/README.md` records, for every
  committed font file: source URL, upstream version or commit, retrieval date, and SHA-256. The
  licence text of each family is committed verbatim beside the binaries.

- [ ] **NFR-2.4 (Binaries survived git):** every SHA-256 in `fonts/README.md` was computed
  **after** a commit and a fresh checkout, not before, and matches the upstream file. A mismatch
  means EOL normalisation touched a binary and `.gitattributes` did not cover the path.
  > Measured: ____ file(s), all hashes match after round-trip · yes / no

---

## 1. Gate 1 — Package plumbing (blocks Gates 2–4)

The first `.tsx` in `packages/ui` is the cheapest possible probe of risk R1/R2. Run it before
writing a token.

- [x] **REQ-2.1 (Four tools see the package):** with `packages/ui` containing at least one
  `.tsx` component, one `.module.css` and one `.test.tsx`, all four of `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  > Measured 2026-08-20, Windows, after `pnpm install`: **all four pass.** The probe is
  > `src/plumbing-probe.{tsx,module.css,test.tsx}` — Gate 1's "at least one" of each, written to
  > be the cheapest possible probe of R1/R2 and deliberately not exported from `index.ts`.
  > `pnpm typecheck` — clean; `tsc --build` emitted `dist/plumbing-probe.{js,d.ts}`, so the
  > project-reference graph transformed the JSX and resolved `./plumbing-probe.module.css`
  > through the new `src/css.d.ts`. `pnpm test` — 8 files / 9 assertions, 0 failed.
  > `pnpm lint` — eslint, stylelint and `prettier --check` all clean, 0 disables added.
  > `pnpm build` — 6 projects, `next build` ✓ compiled in 1396ms, 4/4 static pages.
  > **R2 did not materialise:** Vitest transformed this package's `.test.tsx` with **no** `oxc`
  > override — `jsx: "react-jsx"` was sufficient, as specs.md §2.10 predicted.
  > **R3 did not materialise:** the `.module.css` import resolved to a proxy under the default
  > `css: false`; **no** `test.css: true` was needed.
  > **Honest limit on "four tools":** `next build` compiled `apps/web`, but nothing in `apps/web`
  > imports the probe, so Next has not yet compiled a `.module.css` from `packages/ui`. That is
  > the exact hole verification §9 names ("`next build` may never touch them"), and it is closed
  > by Gate 4, where `/styleguide` imports the primitives. R1 is therefore probed by three tools
  > here and by the fourth at Gate 4.

- [x] **REQ-2.1 (Still consumed as source):** `packages/ui/package.json`'s `main`, `types` and
  every `exports` entry still point under `./src/`, never `./dist/`.
  > Measured: `main` `./src/index.ts` · `types` `./src/index.ts` · `exports["."]`
  > `./src/index.ts` · `exports["./tokens.module.css"]` `./src/tokens.module.css` — 4/4 under
  > `./src/`, 0 under `./dist/`. The `./tokens.css` / `./base.css` entries of specs.md §2.9 are
  > **not** added yet and `./tokens.module.css` is **not** yet removed: both changes land at
  > STEP 2 with the files they point at, rather than committing a manifest whose `exports`
  > resolve to nothing.

- [x] **NFR-2.5 (No project dropped out):** `pnpm test`'s
  `[check-collected-tests]` line reports **six** workspace projects, each with ≥ 1 collected file.
  Widening `include` to `*.test.tsx` did not stop `*.test.ts` matching.
  > Measured: **8** test file(s) across **6** project(s), 9 assertions passed / 0 failed;
  > per-project counts — `apps/game` 1 · `apps/web` 2 · `packages/content` 1 · `packages/game` 1
  > · `packages/protocol` 1 · `packages/ui` 2. Six of the eight are `.test.ts` and still matched
  > after the widening (`rtl-root.test.ts`, `smoke.test.ts`, and the four `src/index.test.ts`),
  > so the widening did not narrow. `[check-collected-tests] OK`.

- [x] **NFR-2.3 (Pins exact):** `react`, `react-dom`, `@types/react`, `@types/react-dom` in
  `packages/ui/package.json` are pinned exactly, with no `^`/`~`, and are character-identical to
  the pins already in `apps/web/package.json`.
  > Measured: react `19.2.8` · react-dom `19.2.8` · @types/react `19.2.18` · @types/react-dom
  > `19.2.4` — 4/4 character-identical to `apps/web/package.json`, 0 floated (`^`/`~`) ranges.
  > `react` is a dependency, the other three devDependencies, per specs.md §2.9. `pnpm install`
  > added 15 lockfile lines and no `pnpm.overrides` or `peerDependencyRules`; 0 peer warnings.

---

## 2. Gate 2 — The token layer and the press invariant (blocks Gate 3)

This is where fidelity is made mechanical. Every box here is an automated test that reads
`design/` at run time, so it keeps holding after this phase ends.

- [ ] **REQ-2.4 (Every reference token is ported, light):** `tokens.test.ts` asserts that every
  custom property in `design/arcade-tokens.css`'s `:root` block appears in the shipped light block
  with an **identical value**. The count is asserted, not just the presence.
  > Measured: ____ / ____ tokens matched

- [ ] **REQ-2.4 (Every reference token is ported, dark, twice):** every custom property in the
  reference's `[data-theme="dark"]` block appears with an identical value in **both** the
  `@media (prefers-color-scheme: dark)` block and the `[data-theme="dark"]` block, and those two
  blocks are identical to each other.
  > Measured: ____ / ____ tokens matched in each of 2 dark blocks

- [ ] **REQ-2.4 (The port adds nothing):** the shipped token layer declares **no** colour, radius,
  border-width, shadow or motion custom property that the reference does not declare. The only
  permitted difference is the `--font` / `--font-en` indirection through `var(--font-baloo, …)` /
  `var(--font-archivo, …)`, which the test names as an explicit exemption rather than skipping
  silently.
  > Measured: ____ extra token(s) found (must be 0), exemptions: ____

- [ ] **REQ-2.5 (Themes nest):** `[data-theme]` on a non-root element re-themes that subtree —
  demonstrated by the styleguide (Gate 4) and asserted structurally here: the light palette's
  selector list includes `[data-theme='light']`, and the dark palette is declared under both a
  `prefers-color-scheme` media query and a `[data-theme='dark']` selector.

- [ ] **REQ-2.5 (No script resolves the theme):** no `<script>`, no `localStorage`, no
  `useEffect` and no cookie participates in theme selection anywhere in `apps/web` or
  `packages/ui`. A flash of the wrong theme is therefore impossible by construction, not by
  correct scripting. *(Grep evidence, not observation: name the searched terms and the hit
  count.)*
  > Measured: searched `____`, hits: ____ (must be 0)

- [ ] **REQ-2.8 (The prototypes really do hold the invariant):** `press.test.ts` extracts every
  `(rest, travel, pressed)` triple from all three `design/designs/*.dc.html` files and asserts
  `pressed === rest − travel` for each. **At least the three distinct triples recorded in
  requirements.md §1.1 — (6,4,2), (5,3,2), (4,3,1) — must be among them**, so that the test is
  proven to be reading the prototypes rather than finding nothing and passing vacuously.
  > Measured: ____ triple(s) extracted, ____ distinct, all satisfy the invariant · yes / no

- [ ] **REQ-2.8 (The implementation computes rather than restates):** `press.module.css`
  contains `calc(var(--press-rest) - var(--press-travel))`, and contains none of `scale(`,
  `opacity`, `filter`. No variant anywhere writes a pressed offset as a literal.

- [ ] **REQ-2.6 (Global states and keyframes complete):** `base.css` carries `:focus`,
  `:focus-visible` (3px `var(--red)`, offset 3px), `::selection` (`rgba(255,201,60,.55)`), the
  disabled rule (`opacity .45`, `cursor: not-allowed`), and all four keyframes `pop`, `bob`,
  `ring`, `slidein` with the reference's exact values — including `ring`, which nothing uses yet.

- [ ] **REQ-2.7 (`.ltr-num` isolates, not merely reverses):** `.ltr-num` sets `direction: ltr`
  **and** `unicode-bidi: isolate` **and** `var(--font-en)`. All three; the isolation is the one
  that gets dropped and the one the requirement exists for.

- [ ] **NFR-2.2 (RTL guardrail green, zero disables):** `pnpm lint:css` passes over every new CSS
  file, and `grep -rn "stylelint-disable" ` across the repo returns nothing outside `design/`.
  `stylelint.config.mjs` is byte-identical to its Phase 1 state.
  > Measured: ____ CSS file(s) linted, ____ disable comment(s) (must be 0)

---

## 3. Gate 3 — The primitives (blocks Gate 4)

- [ ] **REQ-2.9 / REQ-2.10 (All five exist and export):** `Panel`, `Card`, `Pill`, `Dot`,
  `Button` are exported from `@nel3ab/ui`, `PLACEHOLDER` is gone, and both tests that asserted it
  (`packages/ui/src/index.test.ts`, `apps/web/smoke.test.ts`) were updated rather than deleted.

- [ ] **REQ-2.9 / REQ-2.10 (Variants are observable):** `primitives.test.tsx` renders each
  primitive and each variant and asserts the `data-*` attribute, not a CSS-Module class name.
  Covered: Panel raised/flat, Card md/lg, Pill × 4 tones × selected, Dot sm/md × won, Button ×
  3 variants × disabled.
  > Measured: ____ render assertions

- [ ] **REQ-2.10 (Button's non-colour differences are real):** `secondary` has no rest shadow and
  does **not** compose `press`; `primary` is `justify-content: space-between`; `action` carries an
  11px/700 sub-label at `opacity .6`. Each checked against `specs.md` §2.7's table, value by
  value.

- [ ] **REQ-2.10 (Disabled is disabled two ways):** a disabled Button renders both the native
  `disabled` attribute and `aria-disabled="true"`, and `press.module.css`'s `:not()` guard
  excludes both selectors.

- [ ] **REQ-2.9 (The Pill's inline padding is start-8 / end-12):** `Pill.module.css` reads
  `padding-inline: 8px 12px`, matching the prototype's physical `right: 8px; left: 12px` under
  `dir="rtl"`. *(specs.md §2.6 — the phase's most likely fidelity error, and the one Stylelint
  cannot catch because both orderings are logical.)*

- [ ] **NFR-2.1 (`design/` untouched):** `git status design/` is clean and `git log` shows no
  commit in this phase touching a path under `design/`. Tests read it; nothing writes it.

---

## 4. Gate 4 — The proof surface (blocks Gate 5)

- [ ] **REQ-2.11 (Both themes, side by side, every primitive):** `styleguide.test.ts` asserts the
  rendered page contains a `data-theme="light"` subtree and a `data-theme="dark"` subtree, and
  that each of the five primitives appears inside **both**.

- [ ] **REQ-2.11 (Does not ship):** the route returns `notFound()` when
  `process.env.NODE_ENV === 'production'`, and the guard is a static branch Next inlines at build
  time. Confirmed against a production build: `next build && next start`, then a request to
  `/styleguide` returns 404.
  > Measured: HTTP ____ from `/styleguide` on a production server

- [ ] **REQ-2.3 (No third-party origin):** the production build's served HTML **and** the CSS it
  links contain no occurrence of `fonts.googleapis.com` or `fonts.gstatic.com`, and no
  `<link rel="preconnect">` to either. Checked against the served bytes, not the source.
  > Measured: ____ occurrence(s) across ____ served asset(s) (must be 0)

- [ ] **REQ-2.3 (Both families actually load, at the required weights):** the served page
  requests font files from this origin only, and the set covers Baloo Bhaijaan 2 at 500/600/700/800
  and Archivo at 600/800.
  > Measured: ____ font request(s), all same-origin · weights covered: ____

- [ ] **REQ-2.5 / rtl-root (The root tag is still asserted whole):** `apps/web/rtl-root.test.ts`
  still matches the **entire** `<html …>` opening tag against an exact string, updated for the
  font `className`. Per the 2026-08-20 decision the tag carries **no** `data-theme` attribute.
  It was **not** relaxed into a substring or attribute-by-attribute check — the reason it is a
  whole-tag match is written in its own comment and still holds.
  > Measured: expected tag `____`

---

## 5. Gate 5 — The stack verdict (evaluated once, over the finished phase)

Evaluated **after** Gates 0–4 are green, on a clean tree, from a fresh
`pnpm install --frozen-lockfile`. Not before: an early evaluation would be measuring an
unfinished package.

- [ ] 🚦 **REQ-2.12 (Component library on the pinned stack) (VERDICT GATE — no retry):**
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass, with **none** of the
  following present anywhere in the repository as a consequence of this phase:
  `pnpm.overrides` · `peerDependencyRules` · `--no-strict-peer-dependencies` · `skipLibCheck`
  outside `tsconfig.base.json` · `@ts-expect-error` · `eslint-disable` · `stylelint-disable` ·
  any `^` or `~` version range in any of the 7 manifests · any weakening of the two rules in
  `stylelint.config.mjs` · any change to the `ci` job name in `.github/workflows/ci.yml`.

  Ordinary compile, lint and test failures are fixed and re-run freely — **the gate is about
  whether an escape was *needed*, not about passing first try.** It FAILs the moment a fix
  requires one of the items above.

  **A FAIL here halts the phase.** It means `@nel3ab/ui` cannot be a React + CSS Modules package
  consumed as TypeScript source on this stack. Record which tool demanded which escape, and take
  the documented fallback (specs.md §4, R1) as an architecture finding against `tech-specs.md`
  §2.3 — do not add the escape and continue.
  > Measured: lint ____ · typecheck ____ · test ____ · build ____ · escapes required: ____

- [ ] **REQ-2.12 (CI agrees):** the same four commands are green on Ubuntu in the `ci` job on the
  pull request, not only on Windows locally.
  > Measured: run ____ , commit ____

---

## 6. Gate 6 — The human pass (the phase's exit criterion)

`roadmap.md` Phase 2's exit criterion is *"The styleguide renders every primitive in light and
dark, and a button press visually matches the prototype exactly."* Nothing above proves that. Two
of the three product pillars are visual, and `renderToStaticMarkup` exercises no CSS, no
`:active`, no `:focus-visible`, no `@media` and no bidi (specs.md §4, R6).

- [ ] 👁 **REQ-2.11 (Side-by-side comparison):** with the prototype open in one window and
  `/styleguide` in another, each primitive is compared against its prototype counterpart on
  **colour, radius, border width, shadow offset, padding and type size**, in both themes. Every
  deviation found is written down here — including the ones that were fixed.
  > Observed: ____

- [ ] 👁 **REQ-2.8 (The press):** a primary Button and an action Button are pressed and held next
  to the prototype's. The control moves down and the shadow shrinks by the same amount; it does
  not scale, fade or blur. A disabled Button does not move.
  > Observed: ____

- [ ] 👁 **REQ-2.7 (Bidi, in a browser):** an Arabic sentence containing an `.ltr-num` run
  (a room code and a two-digit clock) renders with the Latin run in Archivo, in Latin order,
  without dragging its neighbouring Arabic or punctuation out of place. Checked in both themes.
  > Observed: ____

- [ ] 👁 **REQ-2.6 (Focus ring):** tabbing through the styleguide shows the 3px red
  `:focus-visible` ring with 3px offset on every focusable control, and **no default browser ring
  anywhere**. Clicking a control with a mouse does not show it.
  > Observed: ____

- [ ] 👁 **R5 (Reference vs prototype discrepancies):** any value the prototypes use that
  `design/arcade-tokens.css` does not carry, noticed during the comparison, is recorded here.
  `mission.md` §5.3 says the prototype wins, so each one is a spec amendment to raise — **not** a
  token to add during this phase (requirements §4).
  > Observed: ____

---

## 7. Automated Commands

```bash
# Gate 0 — before any binary is committed
sha256sum apps/web/app/fonts/*.woff2          # after commit + fresh checkout, not before

# Gate 1 / Gate 5 — the four gate commands, in this order
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Gates 2–4 — iterate on one project without tripping the collected-count wrapper
pnpm vitest run packages/ui
pnpm vitest run apps/web
pnpm vitest run -t "token"

# Gate 2 — the guardrail, and that nothing opted out of it
pnpm lint:css
grep -rn "stylelint-disable\|eslint-disable\|@ts-expect-error" --include="*.css" --include="*.ts" --include="*.tsx" --include="*.mjs" . | grep -v node_modules | grep -v "^./design/"

# Gate 4 — the production build, served
pnpm --filter nel3ab-web build
pnpm --filter nel3ab-web start &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/styleguide     # expect 404
curl -s http://localhost:3000/ | grep -c "fonts.g\(oogleapis\|static\).com"   # expect 0

# Gate 6 — the human pass
pnpm --filter nel3ab-web dev                  # then open /styleguide
# and open design/designs/"Nel3ab - Arcade.dc.html" beside it
```

> `pnpm test` forwards extra args to `scripts/check-collected-tests.mjs`, which asserts that
> *every* workspace project contributed a file — so it fails on any filtered run. Use
> `pnpm vitest` while iterating and `pnpm test` for the gate (`CLAUDE.md`). And
> `vitest run --dir <path>` does **not** filter: each project sets its own `root`, which
> overrides `--dir`, so it silently runs everything and exits 0.

---

## 8. Acceptance Criteria

Phase 2 is complete when **all** of the following hold:

1. **Gate 0** is green — both families' licences permit redistribution, and provenance with
   post-checkout hashes is committed.
2. **Gates 1–4** are green — the package builds under all four tools, the token port is
   byte-identical to `design/arcade-tokens.css` in both themes and adds nothing, the press
   invariant is arithmetic and matches the prototypes' measured triples, the five primitives
   exist with variants observable as `data-*`, and `/styleguide` renders every one of them in both
   themes while 404-ing in production.
3. **Gate 5** — the 🚦 stack verdict — returned **PASS**, with no escape hatch, on Windows and on
   Ubuntu CI.
4. **Gate 6** — the human pass is complete, with every observation written into this file, and
   any deviation either fixed or recorded as a finding.
5. Every box above is ticked **with its measured value filled in**. A tick with an empty
   `Measured:` line is not a tick.
6. `roadmap.md`'s Phase 2 status is updated and its "Completed Work" section records the verdict
   with the commit it was measured at — the form Phase 1 set.

No criterion appears here for the first time.

---

## 9. What Would Make This Phase Untrustworthy

- **The token test passes because it found nothing.** A regex that fails to match
  `design/arcade-tokens.css` yields zero pairs, and "every one of zero tokens matched" is green.
  Gate 2 asserts the **count**, and the reference's counts are knowable in advance — if the
  measured denominator is not the number of properties actually in that file, the test is lying.
  The same trap sits under the press test, which is why Gate 2 requires the three known triples to
  be *among* those extracted.

- **A green `pnpm test` implying visual correctness.** It does not. Every assertion in this phase
  is either a string comparison over CSS text or a static-markup render. Not one pixel is
  rendered, not one `:active` is entered, not one theme is composited. The visual claims live
  entirely in Gate 6, performed by a person, and if Gate 6 is skipped the phase has verified its
  bookkeeping and nothing else.

- **Fidelity to the wrong reference.** REQ-2.4 measures the port against
  `design/arcade-tokens.css`. `mission.md` §5.3 says the **prototype** is the specification, and
  the reference file is a human extraction from it that is already known to be incomplete (R5).
  Every automated check in this phase can be green while the port faithfully reproduces a lossy
  intermediate.

- **The Pill padding, and everything shaped like it.** `padding-inline: 12px 8px` is logical,
  mirrored, lint-clean, type-correct and wrong. Stylelint's guardrail catches physical properties,
  not inverted logical ones — so the entire class of "correct axis, swapped ends" errors is
  invisible to every automated check in this repository. There are more of these coming in
  Phases 5–7 than in this one.

- **A verdict gate retried into green.** Gate 5's FAIL condition is subtle: it is not "the
  commands failed" but "making them pass required an escape." An implementer who adds
  `skipLibCheck` at 1am, sees green, and ticks the box has manufactured exactly the result the
  gate exists to detect. The escape list is grep-able (§7) precisely so the tick is checkable by
  someone else.

- **Font provenance recorded from the wrong bytes.** Hashing the downloaded file rather than the
  checked-out one proves nothing about what git stored. If `.gitattributes` ever misses a path,
  the corruption is invisible in every test and appears only as a browser falling back to
  system-ui — which looks like a font that did not load, not like a corrupt file.

- **`prefers-color-scheme` making dark the untested default.** REQ-2.5 was decided on
  2026-08-20 as "follow the device," so a large share of devices will show the dark palette
  first — and dark is the theme nobody has played a match in. Gate 6 checks both themes on a
  styleguide; it does not check a match. **This is a known, accepted, open risk carried into
  Phase 5**, not something this phase closes.

- **The styleguide drifting into the product.** It is the only surface in this phase, so it
  attracts work — a mock setup card here, a fake timer there. Every hour spent on it is an hour
  spent on a page that 404s in production, and every composite built on it is a Phase 5–7
  component built before the state that defines it exists (requirements §4).

- **`renderToStaticMarkup` as a substitute for `packages/ui` actually working inside Next.**
  Vitest and Next compile the package by different paths. A `.module.css` import that resolves to
  a proxy under Vitest and throws under `next build` would be caught by Gate 1's `pnpm build` —
  but only because `/styleguide` imports the primitives. If the styleguide is stubbed out or built
  last, `next build` may never touch them, and Gate 5 would pass on a package Next has never
  compiled.

---

*Written: 2026-08-20 — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured values may be
added; gates may not be changed except by a dated planning session.*
