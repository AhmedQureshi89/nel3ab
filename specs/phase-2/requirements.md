# Phase 2 Requirements — Arcade design system

> **Phase Status:** Ready for Implementation
> **Parent Roadmap:** [../roadmap.md](../roadmap.md)
> **Constitution:** [../mission.md](../mission.md) · A-1 in force (public repo — see §1.2) · no proposals in force
> **Duration:** 1 day

---

## 1. Overview & Objectives

Phase 2 builds **the visual identity as reusable primitives, before any screen is built on
top of it.** No product screen ships. What ships is the layer that Phases 5–7 (judge app),
13–14 (player app) and 21 (landing) all render through — and the cost of getting it wrong is
paid by every one of them.

The premise this phase rests on is Phase 1's, and it held: the pinned stack —
Node 24 · Next 15.5.23 · React 19.2.8 · TypeScript 5.9.3 strict with project references ·
Vitest 4.1.10 · ESLint 10.8.1 · Stylelint 17.14.1 · pnpm 11.22.0 — passed its 🚦
stack-compatibility verdict gate at `2961449` on both Windows and Ubuntu CI, with no
override, no ignored peer range and no floated pin. All 38 of Phase 1's verification boxes
are ticked with measured values. `@nel3ab/ui` exists today as a shell exporting
`PLACEHOLDER` plus a 20-line placeholder `tokens.module.css` that this phase replaces.

The sharpest version of the question this phase answers:

> **Can the Arcade look — which exists today only as ~4KB of tokens and three prototypes
> that style every element inline — be expressed as a token layer plus five primitives,
> without losing a value and without needing an escape hatch out of the Phase 1 toolchain?**

Two things carry disproportionate weight and are the reason this is a full day.

### 1.1 Fidelity is a pillar, and it decays silently

`mission.md` §3 makes the Arcade look one of three non-negotiable pillars, and §5.3 makes the
prototypes the specification: *"When implementation and prototype disagree, the prototype is
right."* A mistyped hex, a radius rounded from 2.5px to 2px, a shadow given 1px of blur — none
of these fail a test, none appear in a diff review, and all of them are regressions by the
constitution's own definition. Once six screens are built on a drifted token layer, nobody
goes back.

So this phase does not merely *port* `design/arcade-tokens.css`; it makes the port
**mechanically accountable to the reference of record**. The token contract is asserted in a
test that reads `design/arcade-tokens.css` at run time and compares it to the shipped CSS.
`design/` is never edited (`CLAUDE.md` invariant 5), so that test can only be made green by
correcting the port.

The same reasoning applies to the press behaviour. Measured across all eight pressable
controls in the three prototypes, one arithmetic invariant holds without exception:

| Rest shadow | Press travel | Pressed shadow | Controls |
|---|---|---|---|
| `0 6px 0` | `translateY(4px)` | `0 2px 0` | primary CTA (setup, ready, roundEnd, match, landing nav + pricing) |
| `0 5px 0` | `translateY(3px)` | `0 2px 0` | action buttons (تخطي / تلميح / صحيح) |
| `0 4px 0` | `translateY(3px)` | `0 1px 0` | share button, landing game-card CTA |

**pressed offset = rest offset − travel.** `mission.md` §3 states this as prose ("the shadow
shrinks by the same amount"); this phase requires it to be *expressed in code as arithmetic*,
so that a future variant cannot break it by writing two independent numbers.

### 1.2 This is the first phase that commits binary third-party assets to a public repo

Amendment **A-1** made `AhmedQureshi89/nel3ab` public. Phase 1 committed only text it had
authored. Phase 2 commits font binaries it did not author, into a world-readable repository,
because `tech-specs.md` §2.1 and `roadmap.md` Phase 2 both require self-hosting via
`next/font/local` rather than the Google Fonts CDN.

Whether that is permitted is a question about **upstream licence terms**, not about this
codebase. It is answered once, before the files are committed, and it is a verdict gate: if
the licence does not permit redistribution, the answer is not "fix the code" — it is a
finding that sends `tech-specs.md` §2.1 back for an amendment.

### Amendment discipline (binding on this phase)

Phase 2 requires **no new amendment**. Every requirement below traces to an existing decision:

| Requirement source | Recorded in |
|---|---|
| Port `arcade-tokens.css`; theme via `data-theme`; self-host both families via `next/font/local`; the five primitives; press as a shared mixin; global states; `.ltr-num`; a `/styleguide` dev route | `roadmap.md` Phase 2 |
| CSS Modules + CSS custom properties; self-hosted fonts, Google Fonts CDN not used in production | `tech-specs.md` §2.1 |
| `@nel3ab/ui` = Arcade primitives shared by landing, judge and player | `tech-specs.md` §2.3 |
| 2.5–3px ink borders, zero-blur offset shadows, 14–28px radii, press by `translateY` never scale/opacity | `mission.md` §3 |
| The prototype wins on any disagreement | `mission.md` §5.3 |
| Latin/numeric runs in Archivo, direction-isolated | `mission.md` §3 |
| Exact pins, no overrides, no `@ts-expect-error`, the RTL guardrail untouched | `CLAUDE.md` invariants 3, 4, 7 |

Three readings are recorded here explicitly, so that adopting them is a decision on the record
rather than an assumption made at the keyboard. **None of them contradicts a binding document**,
which is why none needs an amendment:

1. **`roadmap.md` Phase 2 says "Theme switching via `data-theme` on the root; no flash of
   wrong theme on load."** This phase satisfies both halves *without* a blocking inline script,
   by defining the dark palette under both `@media (prefers-color-scheme: dark)` and
   `[data-theme="dark"]`. `data-theme` remains the switch and still wins; the media query is
   only what applies when no attribute is present. A flash then becomes impossible by
   construction rather than by correct scripting — see REQ-2.5. **The default when no attribute
   is set is a product decision recorded in REQ-2.5 and must be confirmed before implementation.**

2. **`tech-specs.md` §2.3 names `TimerCard` as a member of `@nel3ab/ui`.** `roadmap.md`
   Phase 2's primitive list does not include it. Both are true: §2.3 describes the package's
   eventual contents, the roadmap describes this phase's. TimerCard is a screen composite whose
   states (active fill, win dots, frozen/waiting status) are defined by rules the engine does not
   have until Phase 3, so it is an explicit non-goal here and belongs to Phase 6. See §4.

3. **`design/README.md` records values used only by the landing page** (`#ffe2db`, `#d8ecfb`,
   a `0 9px 0` shadow, a `rotate(-1.4deg)`, multi-second `bob` loops) that do **not** appear in
   `design/arcade-tokens.css`. They are out of scope here and belong to Phase 21. This phase
   ports the reference token file, not the union of every literal in every prototype — and
   REQ-2.4 forbids inventing tokens the reference does not have.

---

## 2. Detailed Functional Requirements

This is a one-day phase, so requirements are grouped by workstream. **Dependency order is
specified in [specs.md](specs.md) §1 and is not the same as the order below.**

### 2.1 Package foundation

**REQ-2.1 — `@nel3ab/ui` becomes a React component package, still consumed as TypeScript source**
`packages/ui` gains React, `.tsx` sources, CSS Modules and an ambient declaration for them,
while keeping `main`/`types`/`exports` pointed at `./src/…` rather than `./dist`. `pnpm lint`,
`pnpm typecheck`, `pnpm test` and `pnpm build` all continue to see it.
*Why:* `CLAUDE.md` records "packages are consumed as TypeScript source" as a load-bearing
property — `apps/web/next.config.ts` transpiles them and the root solution `tsconfig.json`
references them. Adding React and CSS Modules is the first real test of whether that
arrangement survives contact with a component library. If it does not, every later UI phase
is affected, so it is measured here (REQ-2.12) rather than discovered in Phase 5.

**REQ-2.2 — 🚦 Both font families are licensed for redistribution in a public repository**
Before any binary is committed, the upstream licence for Baloo Bhaijaan 2 and for Archivo is
read from its source of record, confirmed to permit redistribution of the font files, and the
licence text is committed alongside them with its provenance (source, version, retrieval date,
SHA-256 per file).
*Why:* A-1 made this repository world-readable, and `tech-specs.md` §2.1 requires the fonts to
be self-hosted rather than fetched from Google's CDN. Committing a font whose licence forbids
redistribution would be a licensing exposure that no test catches and that going private later
would not undo (the same irreversibility A-2 records for the question bank). This is a
measurement of somebody else's terms, so it is evaluated once and never retried.

**REQ-2.3 — Both families are self-hosted and no page requests a third-party origin**
Baloo Bhaijaan 2 at weights 500/600/700/800 and Archivo at 600/800 are served from this
application's own origin via `next/font/local`. A production build's served HTML and CSS
contain no reference to `fonts.googleapis.com` or `fonts.gstatic.com`, and no `<link
rel="preconnect">` to either.
*Why:* `tech-specs.md` §2.1 — "Google Fonts CDN is not used in production." The prototypes
`<link>` the CDN; that is a prototype affordance, like the debug top bar. Beyond privacy, the
product's audience is on Saudi mobile data and the fonts carry the Arabic UI: a blocked or slow
third-party origin turns every screen into a fallback-font screen.

### 2.2 The token layer

**REQ-2.4 — The token port is byte-identical to the reference of record, in both themes, and adds nothing**
Every custom property declared in `design/arcade-tokens.css` — every colour, radius, border
width, shadow, spacing, motion duration and line-height, in the `:root` block and in the
`[data-theme="dark"]` block — appears in the shipped token layer with an identical value.
The shipped layer declares **no** colour, radius, border-width, shadow or motion token that
the reference does not declare.
*Why:* `mission.md` §5.3 — the prototype is the specification. "Adds nothing" is the half that
is easy to skip and matters most: a token invented during implementation is a design decision
made by an implementer at 1am, and by the time a screen uses it, it is load-bearing. If the
port genuinely needs a value the reference lacks, that is a finding to record, not a token to
add (see §4 and verification §6).

**REQ-2.5 — Themes resolve at the root and on any `[data-theme]` subtree, with no flash**
The light palette applies at `:root`; the dark palette applies both under
`@media (prefers-color-scheme: dark)` and under `[data-theme="dark"]`, and `[data-theme="light"]`
forces light back. Setting `data-theme` on **any element**, not only `<html>`, re-themes that
subtree. No theme is resolved by JavaScript, so no flash of the wrong theme is possible.
*Why:* two requirements meet here. `roadmap.md` Phase 2 requires `data-theme` switching with no
flash; the same document's Phase 2 exit criterion requires the styleguide to render every
primitive **in both themes side by side**, which is only possible if the palettes are scoped to
a subtree rather than to `:root` alone. `design/arcade-tokens.css` as written puts light on
`:root` and dark on `[data-theme="dark"]`, so a nested `[data-theme="light"]` container would
inherit dark — the port must widen the selectors without changing a value.
> **DECIDED 2026-08-20 (Ahmed, in the planning session): follow the device.** With no
> `data-theme` attribute present, the product renders the palette the device's
> `prefers-color-scheme` asks for; `data-theme` still overrides it, and `<html>` carries no
> theme attribute. The alternative considered and rejected was pinning `data-theme="light"` on
> `<html>` to match the prototype's default state.
> **What it costs:** a large share of the audience will see the dark palette first, and dark is
> the theme nobody has played a match in. That risk is not closed by this phase — Gate 6 checks
> both themes on a styleguide, not in a match — and is carried into Phase 5. It is recorded in
> verification.md §9.

**REQ-2.6 — Global states and keyframes ship with the token layer**
`:focus { outline: none }`, `:focus-visible { outline: 3px solid var(--red); outline-offset: 3px }`,
`::selection { background: rgba(255,201,60,.55) }`, and `[aria-disabled="true"], :disabled
{ opacity: .45; cursor: not-allowed }`, plus the four keyframes `pop`, `bob`, `ring`, `slidein`
with the reference's exact durations and values.
*Why:* `design/README.md` — "Never leave a default browser focus ring." These are global
because they are global in the reference; scattering them into per-component CSS is how a
screen ends up with a default focus ring. `ring` is unused by any current screen and is ported
anyway, because REQ-2.4 says the port is complete, not selective.

**REQ-2.7 — `.ltr-num` isolates Latin and numeric runs**
A single utility sets Archivo, `direction: ltr` and `unicode-bidi: isolate` on a run, so that a
room code, clock, tally or score numeral embedded in Arabic text renders in Archivo and does not
reorder its surroundings.
*Why:* `mission.md` §3 makes this a pillar-level requirement, and it has no representation in
the prototypes at all — they are single-purpose demos where the bidi hazard does not surface.
It is the one part of this phase with no reference to copy, which is exactly why it needs its
own requirement and its own test rather than being folded into a primitive.

### 2.3 The primitives

**REQ-2.8 — Press behaviour is one mechanism, and the shadow-shrink invariant is arithmetic**
Every raised control presses through a single shared rule, parameterised by its rest offset and
its travel. The pressed offset is **computed** from those two values, not written as a third
number. The rule changes only `transform` and `box-shadow` — never `scale`, never `opacity`.
It does not fire on a disabled control.
*Why:* `mission.md` §3 names the press as one of the specific things that makes the Arcade look
itself, and names the exact way it is usually lost. Expressing the invariant as arithmetic means
a future variant with a `0 7px 0` rest shadow cannot press wrong; expressing it as three
hard-coded pairs means it eventually will. The three pairs measured from the prototypes (§1.1)
become the test's expected values, not the implementation's.

**REQ-2.9 — `Panel`, `Card`, `Pill` and `Dot` exist with the prototypes' measured values**
Four primitives, each reproducing values measured from the prototypes rather than chosen:
Panel/Card at 3px border, radius 20px, `0 4px 0`, 14px padding with a raised and a flat form and
a 24px `--r-lg` form for the question card; Pill at 999px radius, 2.5px border, 13.5px/700, with
a selected form carrying `0 3px 0`; Dot at 9px and 11px, 50% radius, 2px border.
*Why:* these are the shapes that recur on every screen. Building them once from measurement is
the difference between Phases 5–7 reproducing the prototype and Phases 5–7 approximating it.
**Note the Pill's padding is asymmetric on the inline axis and this is a documented RTL trap —
see specs.md §2.6.**

**REQ-2.10 — `Button` carries the primary, secondary and action variants, and their real differences**
Three variants, differing in more than colour: **primary** (3px, radius 18px, padding 17px 20px,
20px/800, yellow, `0 6px 0`, label and glyph pushed apart), **action** (3px, radius 18px,
padding 15px 8px, 15.5px/800, `0 5px 0`, with a 11px/700 sub-label at 60% opacity), and
**secondary** (2.5px, radius 16px, padding 13px, 15px/700, panel fill, **no shadow and therefore
no press travel** — it is the one control in the system that is not raised). Disabled renders
at `opacity .45` with `cursor: not-allowed` and does not press.
*Why:* the roadmap names the three variants; the prototypes show that they are not a colour
enum. Encoding secondary as "primary but grey" would give it a press it does not have and a
shadow the reference never draws — a fidelity regression that would then appear on the ready,
roundEnd and match screens.

### 2.4 The proof surface

**REQ-2.11 — `/styleguide` renders every primitive in both themes side by side, and does not ship**
A route in `apps/web` renders every primitive and every variant twice — once in a forced-light
subtree, once in a forced-dark subtree — on one page, in `dir="rtl"`. It is unreachable in a
production deployment.
*Why:* this is the phase's exit criterion made concrete, and it is the only surface on which a
human can perform the comparison that the automated checks cannot (verification §3). It must not
ship because it is a development instrument, not a product screen: `mission.md` §6 is explicit
that نلعب is not a showcase, and a public `/styleguide` is one more thing to keep correct
forever for nobody's benefit.

**REQ-2.12 — 🚦 The four gate commands pass with no escape hatch**
`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass, on a fresh
`pnpm install --frozen-lockfile`, with **none** of the following introduced anywhere to make
them pass: `pnpm.overrides`, `peerDependencyRules`, `--no-strict-peer-dependencies`,
`skipLibCheck` beyond `tsconfig.base.json`, `@ts-expect-error`, `eslint-disable`,
`stylelint-disable`, a floated (`^`/`~`) version pin, a weakening of the two RTL rules in
`stylelint.config.mjs`, or a change to the `ci` job name.
*Why:* Phase 1's verdict gate asked whether the pinned stack held for a toolchain. This asks
whether it holds for a **component library consumed as TypeScript source** — `.tsx` and
`.module.css` inside a workspace package, seen simultaneously by `tsc --build`'s project-reference
graph, by Vite/oxc under Vitest, by Next's `transpilePackages`, and by Stylelint. Four tools, one
set of files. A FAIL is not a bug: it means `@nel3ab/ui` cannot be a source-consumed React
package on this stack, and the fallback (ship built output from `packages/ui`, or move the
primitives into `apps/web`) is an architecture change that `tech-specs.md` §2.3 has to record.
Ordinary compile and lint errors are fixed and retried freely — the gate FAILs only if the fix
*requires* one of the escapes listed above.

---

## 3. Non-Functional Requirements

**NFR-2.1 — `design/` and `specs/` are not edited.** `design/` is the reference of record and
is never linted, formatted or edited (`CLAUDE.md` invariant 5). `specs/` is prose of record and
read-only during implementation (invariant 6); `verification.md` may only have boxes ticked and
measured values recorded. A test may *read* `design/`; nothing may write to it.

**NFR-2.2 — The RTL guardrail stays green with zero disables.** Every CSS file added by this
phase passes `stylelint.config.mjs` as it stands. No `stylelint-disable` comment is added
anywhere, and the two rules in that file are not disabled, narrowed or weakened
(`CLAUDE.md` invariant 3). All new CSS is written on the inline axis.

**NFR-2.3 — Exact pins, no overrides.** Any dependency added is pinned exactly, with no `^` or
`~`, in any of the manifests (`CLAUDE.md` invariant 4). `pnpm install --frozen-lockfile` succeeds
from a fresh clone.

**NFR-2.4 — LF and Prettier stay consistent, and binaries stay binary.** `.gitattributes`
already excludes `*.woff2`/`*.woff`/`*.ttf`/`*.otf` from EOL normalisation; committed font files
must land byte-identical to their source (verified by SHA-256, REQ-2.2). `prettier --check .`
passes.

**NFR-2.5 — Every workspace project still contributes a collected test file.**
`scripts/check-collected-tests.mjs` derives its expected count from the workspace, so a project
dropping out of collection fails `pnpm test` (`CLAUDE.md` invariant 2). Widening a Vitest
`include` to pick up `.tsx` must not narrow it for `.ts`.

**NFR-2.6 — Fidelity claims are re-checkable, not one-off observations.** The token contract and
the press invariant are asserted by tests that read `design/` at run time, so a later phase that
drifts the port fails CI rather than shipping. A verification box that can only be satisfied by
looking at a screen is marked as such, and the phase does not rely on one where a test is
possible.

---

## 4. Explicit Non-Goals

An implementer that wants to do any of the following must **stop**, not proceed.

- **No product screens.** Setup, room-ready, play, round end, match end, join, lobby, live and
  waiting are Phases 5–7 and 13–14. The `/styleguide` route is not a screen and must not grow
  into a mock of one.
- **No screen composites.** `TimerCard`, the question card with its header strip and hint
  footer, the reveal overlay, the judge-only answer box, the category rail and tile, the team
  tile, the score card, the round-log panel, the waiting panel. Each depends on game state that
  does not exist until Phase 3, and each belongs to the phase that renders it. This includes
  `TimerCard` despite `tech-specs.md` §2.3 naming it as an eventual member of `@nel3ab/ui`
  (see §1.2, reading 2).
- **No landing-page values.** `#ffe2db`, `#d8ecfb`, `0 9px 0`, `0 5px 0` on a bobbing card,
  `rotate(-1.4deg)`, `bob` loops at 3.4s/3.8s/4.1s, the 64px→40px hero step, `<image-slot>`.
  Phase 21 owns the landing page and will decide whether any of these becomes a token.
- **No token that `design/arcade-tokens.css` does not declare.** Including "obvious"
  improvements: no `tabular-nums` on the clock (the reference does not set it), no additional
  radius, no blurred shadow, no hover token. If the port needs one, record it as a finding.
- **No theme toggle UI and no theme persistence.** No `localStorage`, no cookie, no context
  provider, no toggle component. The prototypes' day/night switch lives on the debug top bar,
  which `roadmap.md` Phase 5 removes entirely as "not part of the product."
- **No icon set.** The prototypes' Unicode glyphs (`▶ ↺ ↔ ✕ ⏭ ✔ 💡 👁 ⤴ 🏆 👑 ⏳ 🎉`) stay as
  literal content in the phase that renders them, until someone chooses a set. No `Icon`
  component.
- **No Storybook, no visual-regression or screenshot tooling, no Chromatic.** The `/styleguide`
  route is the proof surface for this phase; adding a second one is a toolchain decision that
  belongs to whoever is maintaining six screens, not to the phase that has none.
- **No accessibility work beyond `:focus-visible`.** Focus order, contrast auditing,
  screen-reader labels and the rest are Phase 23.
- **No game logic, protocol, content or server code.** `@nel3ab/game`, `@nel3ab/protocol`,
  `@nel3ab/content` and `apps/game` remain shells exporting `PLACEHOLDER`.
- **No change to `.github/workflows/ci.yml`, `stylelint.config.mjs`, `eslint.config.mjs` or
  `.gitattributes`.** All four are load-bearing (`CLAUDE.md` invariants 1, 3, 7, 8) and this
  phase has no reason to touch any of them. If it appears to, that is the signal to stop.

---

*Last updated: 2026-08-20*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
