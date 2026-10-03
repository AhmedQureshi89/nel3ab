# Phase 5 Requirements — Judge app: setup & room-ready

> **Phase Status:** Ready for Implementation
> **Parent Roadmap:** [../roadmap.md](../roadmap.md)
> **Constitution:** [../mission.md](../mission.md) · A-1, A-2, A-3 in force, none binds this phase · four owner decisions of 2026-10-02 recorded in REQ-5.1, REQ-5.10, REQ-5.12 and REQ-5.14 · no proposals in force
> **Duration:** 1 day

---

## 1. Overview & Objectives

Phase 5 is the first phase a person can see. It builds the judge app's first two screens — **setup**
(the teams, the judge, the categories) and **room-ready** (the room code, the share button, who is in
the room) — at `/host`, pixel-accurate to the prototype in both themes, and it builds the thing that
sits between those screens and the rules engine: a **local driver** that holds one room in the browser,
draws each round's category and questions with real randomness, runs the 100 ms clock and passes the
turn. When the host presses "ابدأ الجولة الأولى" the match really starts. The play, round-end and
match-end screens are Phases 6 and 7; until they exist those three screens show a plain placeholder.

The premise this phase rests on is Phase 4, and it held. All 46 of Phase 4's verification boxes are
ticked with measured values. Its two 🚦 verdicts returned **PASS**: REQ-4.14 at `de425e9` — a full match
runs as it does in the prototype's own floating-point flow, 0 of 16 scripted matches and 0 of 500
pre-registered sequences diverging over 1,172,055 steps, all 600 completed matches ending with the same
round log — and REQ-4.2 at `430d7b8`, the premise of the fair-shuffle decision. The owner's exit verdict
is recorded at `13ea670` and the phase merged as PR #31 (`7a60dcc`). Phase 4 recorded no FAIL, so
nothing constrains what this phase may assume. Phases 2, 3 and 4 carried forward eleven findings that
bind this phase; §1.3 lists each and where it is met.

`@nel3ab/game` today is the whole rules engine — `RoomState` (21 top-level fields), one reducer handling
nine actions, seventeen runtime exports, 100% coverage enforced by `pnpm test` — and it has **no setup
actions at all**: Phase 4's tests reach `ready` only through a hand-built room
(`packages/game/src/testing/rooms.ts`). `@nel3ab/ui` ships the token layer, the globals, `.ltr-num`, the
press and five primitives. `apps/web` has a placeholder home page, the root layout (`lang="ar"
dir="rtl"`, both font families, no `data-theme`) and the dev-only `/styleguide`; it imports nothing
from `@nel3ab/game`. `packages/protocol`, `packages/content` and `apps/game` remain `PLACEHOLDER` shells.

The sharpest version of the question this phase answers:

> **Can a host build a game — teams, judge, categories — and open a room on one phone, on screens that
> a designer comparing them with the prototype finds no spacing, radius or shadow difference in, in
> light and in dark, with every rule of setup living in the engine and the match started by a driver
> that keeps both of Phase 4's driver obligations?**

### 1.1 The prototype's setup and room-ready, measured before this plan was written

`design/designs/Nel3ab - Arcade.dc.html` was served read-only (`python -m http.server` from
`design/designs/`) and opened in the Claude desktop app's built-in Chromium browser on 2026-10-02, at a
device-pixel ratio of 1.5, with both of its Google-hosted font families loaded (Baloo Bhaijaan 2
500/600/700/800, Archivo 800). Every element of the setup screen (157 boxes) and the room-ready screen
was measured — position and size relative to the 440 px column, padding, border, radius, fill, text
colour, shadow, type size and weight — at a 480 px viewport (the column at its full 440 px) and at
375 px (a phone; the column 347.33 px), in the light theme and in the dark one. The numbers are
pre-registered in [verification.md](verification.md) as Tables P–S and are what REQ-5.24's verdict
compares against. Five facts about the prototype were found by measuring it rather than reading it, and
are recorded here so that they are decisions on the record rather than discoveries at the keyboard:

1. **Geometry is identical in the two themes.** Switching to dark changes colours only — 0 of 157
   setup boxes and 0 of the room-ready boxes move or resize. Every ink border and shadow becomes
   `rgb(13, 12, 19)`, `--panel` `rgb(39, 36, 51)`, `--sunken` `rgb(23, 21, 33)`, `--ink`
   `rgb(255, 243, 223)`, `--muted` `rgb(167, 155, 181)`, `--red` `rgb(255, 90, 60)`; yellow, sky and
   leaf, and the text colour on a selected (yellow) control, do not change.
2. **The categories rail's first tile sits flush against the card's border, not 14 px in.** The rail
   bleeds to the card edges (`margin: 0 -14px; padding-inline: 14px`) and snaps
   (`scroll-snap-type: x mandatory`, tiles `scroll-snap-align: start`); the snap aligns the first tile
   with the scroll container's own edge, which scrolls the 14 px start padding out of view. Measured:
   the first tile's inline-start edge is 2.67 px from the column's (the card's painted border), at both
   widths. An implementation that "fixes" this with `scroll-padding` deviates from the prototype.
3. **The prototype's body has no `line-height`; this repository's does.** `apps/web/app/globals.css`
   sets `body { line-height: 1.5 }` (Phase 1). Every prototype text block with no line-height of its own
   renders at the font's `normal` — the sub-paragraph is 24.67 px tall at 14.5 px — and would render
   shorter here. The screen root must restore `normal` (REQ-5.15).
4. **There are three pill shapes on these two screens, and `Pill` is one of them.** The setup chip
   (`4px 8px 4px 12px`, gap 7 px, with ↔ and ✕ inside) is Phase 2's `Pill`. The judge choice is a
   button, `6px 14px` (Phase 2's open finding). The room-ready chip is a third: `4px 12px`, gap 6 px,
   nothing inside. Both one-offs appear on exactly one screen in every prototype.
5. **Three values differ from what `@nel3ab/ui` provides.** The room-ready CTA is **19 px**, not the
   primary Button's 20 px (73.33 px tall at 20 px against the prototype's 72 px — a spacing deviation for
   everything below it). The share button is a raised control with its own press (`0 4px 0` → `0 1px 0`,
   3 px travel) that is no Button variant. And a locked category tile is `opacity: .5`, not the global
   disabled state's `.45`.

Two facts about the platform were measured on a scratch copy of this repository, also on 2026-10-02:

6. **A CSS Module cannot name a global keyframe directly.** `animation: bob 1s …` in a `.module.css`
   is rewritten by Next's CSS Modules to a hashed local name (`exp_bob__o85V_` in the build output) that
   no keyframe defines, so the 🎉 silently does not move. `animation-name: global(bob)` builds, but
   Stylelint rejects it (`declaration-property-value-no-unknown`) and `stylelint.config.mjs` may not be
   loosened. A custom property's value is opaque to CSS Modules: `--bob: bob 1s ease-in-out infinite;
   animation: var(--bob)` builds, lints clean, and the built CSS names the global `bob`.
7. **Adding the setup actions to the engine breaks exactly two earlier-phase test files, both by
   design.** The eight new `Action` members, their reducer cases and four new exports were added to a
   scratch copy and `pnpm typecheck` and `pnpm vitest run packages/game` run: `pnpm typecheck` failed
   once — `match-purity.test.ts`'s `perType()` is a `Record<Action['type'], number>` and must name every
   action type — and after that, 382 of 384 tests passed, the two failures being `index.test.ts`'s exact
   export list and its `kinds` map. Both were written to fail when the surface grows. specs.md §2.10
   lists the edits; nothing else in Phases 3–4's tests changes.

### 1.2 The four decisions of 2026-10-02

The planning session put four questions to the owner, each with a recommended option. The owner took
every recommendation. Each is recorded as a **DECIDED** block in the requirement it governs.

| Question | Decided | Recorded in |
|---|---|---|
| Where do the setup rules live? | In the engine, under the 100% coverage bar | REQ-5.1 |
| What does "ابدأ الجولة الأولى" do in Phase 5? | Really start the match: Phase 5 builds the local driver | REQ-5.12 |
| Where do question texts come from before Phase 8? | Obvious placeholders; nothing of the prototype's question content | REQ-5.14 |
| Who is in the room before players can join (Phase 13)? | The prototype's five demo players | REQ-5.10 |

### 1.3 Findings carried forward into this phase, and where each is met

| From | Finding | Met by |
|---|---|---|
| Phase 2 | The judge-choice pill (`6px 14px`) is a shape `Pill` does not implement — Phase 5 decides | REQ-5.17: a screen-local style, neither a `Pill` variant nor a primitive (§1.1, fact 4) |
| Phase 2 | Nothing applies `var(--font)` to the page; every screen root must | REQ-5.15 |
| Phase 2 | Dark is the untested default — open risk | REQ-5.24 measures both screens in dark, against the prototype's dark |
| Phase 2 | `next/font` preload is inert on a Windows build | Not this phase's (Phase 9); the fonts still load, so the verdict is unaffected |
| Phase 3 | A loop that measures wall time and rounds each delta can drift ±225 ms; prefer `tick(100)` | REQ-5.12: a fixed `tick(100)` per 100 ms interval, never a measured delta |
| Phase 3 | The engine differs from the prototype at 20, 25 and 65–90 s banks | Phase 5 exposes no configuration; the app plays the 45 s default only (§4) |
| Phase 4 | Every driver must send `passTurn` | REQ-5.12 |
| Phase 4 | Every driver must draw with `drawableCategories` / `drawCategory` / `shuffleQuestions` and a real random source | REQ-5.11 |
| Phase 4 | No driver may dispatch `startRound` | REQ-5.13 |
| Phase 4 | Setup is Phase 5's: the engine has no setup actions | REQ-5.1 – REQ-5.6 |
| Phase 4 | If Phase 5 adds a path to a draw with every category used, the fallback goes live and J6 stops holding — record it | REQ-5.7: no such path is added; shown over generated setup-then-match sequences |
| Phase 4 | The engine's question order differs from the prototype's for any random source | Visible only once questions are shown (Phase 6); recorded in verification §9 |

### 1.4 Where Phase 5 stops

| Behaviour | Phase 5 | Later |
|---|---|---|
| Setup and room-ready screens | built, pixel-accurate | — |
| The play, round-end and match-end screens | a plain placeholder showing the screen, the round, both clocks and both tallies | **Phase 6** (play) and **Phase 7** (round end, match end, their buttons) |
| The clock, the turn pass, the draw | the local driver runs all three | **Phase 11** moves the source of truth to the server — "same screens, different source of truth" |
| Hint, skip, correct | the driver accepts them; no screen sends them | **Phase 6** wires the buttons |
| Next round, rematch, back to setup from a match | the driver accepts them; no screen sends them | **Phase 7** wires the buttons |
| Players | the prototype's five demo players; remove and swap on setup | **Phase 13**: players join from their phones and the demo players go; a player's own "بدّل فريقي" |
| Category content | a temporary catalog: the eleven tiles and placeholder questions | **Phase 8** replaces it with `@nel3ab/content`; **Phase 20** enforces the locks server-side |
| The room code | a placeholder generated in the browser | **Phase 11** generates codes on the server |
| Joining by the code or the link | the link is shared; nothing answers it | **Phase 13** (`/j/[code]`) |

### Amendment discipline (binding on this phase)

Phase 5 requires **no amendment to `mission.md` §8**. Every requirement traces to an existing decision:

| Requirement source | Recorded in |
|---|---|
| Setup screen: teams card, editable names with shuffle, player chips with swap/remove | `roadmap.md` Phase 5 · `design/README.md` §2 · `design/user-stories.md` H-01 |
| Judge card: selection, odd-count hint, "بدّل الحكم كل جولة" | `roadmap.md` Phase 5 · `design/README.md` §2 · H-02 |
| Categories rail: snap-scroll bleeding to the card edges, selected/locked | `roadmap.md` Phase 5 · `design/README.md` §2 · H-03 |
| Cannot start with zero categories | `roadmap.md` Phase 5 · H-03 ("منع البدء بدون فئة واحدة على الأقل") |
| Room-ready: Archivo room code with `.2em` tracking, share, in-room list | `roadmap.md` Phase 5 · `design/README.md` §3 · H-04 |
| Share: `navigator.share` → clipboard → raw code; 1800 ms; ignore `AbortError` | `roadmap.md` Phase 5 · `design/README.md` "Share" |
| Remove the debug top bar | `roadmap.md` Phase 5 · `design/README.md` §2 and "Files" |
| Setup and ready match the prototype in both themes | `roadmap.md` Phase 5 exit · `mission.md` §5.3, §7 "Design fidelity" |
| Judge app at `/host`, client-rendered, no account | `tech-specs.md` §3.1, §8 |
| The rules engine is pure and dependency-free; setup rules reduce over room state | `tech-specs.md` §2.3, §8 (`setJudge`, `pickCategories`, `swapTeam`, `rename` are reduced messages) · REQ-3.3 |
| The server owns the clock; clients never decide a round ended | `mission.md` §5.2 — met: the engine decides, and Phase 11 moves it to the server |
| Players never sign up | `mission.md` §5.1 — nothing here touches the player join path |
| Answer secrecy | `mission.md` §3 — `/host` is the judge's client; NFR-5.7 |
| 100% coverage of the engine on every run | REQ-3.12 (DECIDED 2026-09-30), REQ-4.15 |
| Exact pins, no overrides, no `@ts-expect-error`, `pnpm test` is the wrapper | `CLAUDE.md` invariants 2, 4 |

Four decisions were taken by the owner in the planning session on 2026-10-02 (§1.2). None departs from
the prototype's rules; two are stand-ins, explicitly temporary, for things later phases own (the demo
players until Phase 13, the placeholder questions until Phase 8). One requirement departs from the
prototype's **implementation** by the route `mission.md` §5.3 provides — the roadmap and user story
H-03 replace the prototype's silent default selection with a guard (REQ-5.6, reading 1) — and needs no
§8 entry, because the roadmap is the decision and this triad is the spec update.

Eight readings are recorded explicitly. **None contradicts a binding document:**

1. **The zero-category guard replaces the prototype's default selection.** The prototype's `startGame`
   quietly selects the first three categories when none is selected
   (`this.state.picked.length ? this.state.picked : [0,1,2]`). `roadmap.md` ("Guard: cannot start with
   zero categories selected") and H-03 forbid starting instead. The CTA shows the design system's own
   disabled state (`opacity .45`, `cursor: not-allowed`, no press) — the one place these screens look
   different from the prototype, and only in a state the prototype cannot reach.
2. **The prototype's player fill is kept exactly, oddity included.** With fewer than two players,
   `startGame` *replaces* the list with "لاعب ١" (team A) and "لاعب ٢" (team B) — a lone player is
   dropped — and then adds "لاعب ١" or "لاعب ٢" to a team that has nobody. Kept verbatim (REQ-5.6);
   with the demo players it never fires unless the host removes people.
3. **Setup actions take effect on the setup screen only.** In the prototype the chips' ↔ and ✕, the
   judge choices, the rotation toggle, the team names and the tiles exist only on setup. The engine
   makes them inert everywhere else. A player swapping their own team on room-ready ("بدّل فريقي",
   P-02; `tech-specs.md` §8 "`swapTeam` rejected once play starts") is Phase 13's, and Phase 13 owns
   the rule that would let a swap empty a team after the fill has run.
4. **Players are addressed by id, not by index.** The prototype removes and swaps "player *i*"; the
   engine's `Player` has an `id` (Phase 3), and an index stops naming the same person the moment a
   player joins or leaves (Phase 13). The judge is still `judgeIndex`, as Phase 3 typed it, and the
   prototype's index rule for it on removal is kept verbatim.
5. **The shuffle keeps the prototype's distribution, not its loop.** The prototype draws from the
   team's four names until it gets one different from the current name. The engine picks uniformly
   among the names other than the current one, with one call to the random source — the same
   distribution (uniform over the others; over all four when the current name is not on the list),
   without a loop a broken random source could spin forever.
6. **The engine knows nothing of locked categories.** Which categories are paid is content (Phase 8)
   and entitlement (Phase 20, "the lock icon in the UI is a hint, never the control" — `tech-specs.md`
   §6). The engine records any category id it is told to pick; the screen refuses to pick a locked tile,
   exactly as the prototype's `if(!c.locked)` does.
7. **Team names are free text.** The prototype accepts any text, including empty, on every keystroke;
   so does the engine. Length limits and trimming would be new rules.
8. **The room code is the driver's placeholder.** The engine never generated codes (Phase 3:
   "Phase 11 generates codes"). Until Phase 11, the driver makes one per page load from the random
   source — six characters, `A`–`Z` and `0`–`9` — and keeps it for the life of the page, including
   across room-ready → setup → room-ready (H-04, "الرجوع للإعداد دون فقدان الغرفة").

---

## 2. Detailed Functional Requirements

This is a one-day phase, so requirements are grouped by workstream. **Dependency order is specified in
[specs.md](specs.md) §1 and is not the same as the order below.**

### 2.1 The setup rules (`@nel3ab/game`)

**REQ-5.1 — Setup is edited through engine actions, on the setup screen only**
Six actions edit a room's setup: remove a player, swap a player's team, rename a team, choose the
judge, turn rotation on or off, and pick or unpick a category. Each takes effect only on the `setup`
screen and is inert on every other — it returns the state it was given. Each is also inert when it
names a player who is not in the room or would change nothing. A malformed action — a player id or
category id that is not a string, a team that is not `a` or `b`, a name that is not a string, a flag
that is not a boolean — throws on every screen: validation precedes inertness (REQ-3.3, NFR-4.3).
*Why:* `tech-specs.md` §2.3 puts the room's rules in a pure reducer over room state, and §8 lists
`setJudge`, `pickCategories`, `swapTeam` and `rename` as messages the server reduces (Phase 11). Written
once, here, the rules are the same on the browser in Phases 5–10 and on the server from Phase 11, and
are held to the engine's 100% bar.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): the setup rules live in the engine.** Every
> setup rule — the judge index on removal, the selection order, the guard, the player fill, the shuffle —
> is an engine action or an engine helper, under REQ-3.12's 100% coverage bar. The alternative
> considered and rejected was React state on the setup screen, turned into a room when "ابدأ اللعبة"
> is pressed. **What it costs:** two of Phases 3–4's test files change in the places specs.md §2.10
> lists (§1.1, fact 7); the engine's public surface grows by four names; and Phase 5 carries engine work
> in what is otherwise a screen phase. It was chosen because Phase 11 needs the same rules on the server,
> and a second copy of them written later would be a second place for them to drift.

**REQ-5.2 — Players: removing one keeps the right judge; swapping one moves them**
Removing a player takes them out of the list and moves the judge index by the prototype's rule,
verbatim: if the judge index is at or after the removed position and above 0, it goes down by one;
otherwise it stays. So removing someone listed before the judge keeps the same person judging; removing
the judge makes the person before them judge, or — when the judge was first — the person after. Swapping
a player moves them to the other team and changes nothing else.
*Why:* `roadmap.md` ("player chips with swap/remove"), H-01 ("حذف لاعب وتبديل فريقه بضغطة واحدة"), and
the prototype's `removePlayer` / `swapTeam`. The judge rule keeps Phase 4's invariant J8
(`0 ≤ judgeIndex < max(1, players.length)`) true through every removal.

**REQ-5.3 — Team names: free text, and a shuffle that always changes the name**
Renaming a team sets its name to the given text, whatever it is (reading 7). The engine exports the two
teams' name lists — the prototype's `النمور، الأسود، الذئاب، النسور` and `الصقور، الفهود، الأبطال،
النجوم` — and a helper that, given a team's current name, its list and a random source, returns a name
from the list other than the current one, uniformly, with one call to the random source (reading 5).
A new room's default names are the first of each list, as the prototype's are.
*Why:* `roadmap.md` ("editable team names with shuffle"), H-01 ("اسم الفريق قابل للتحرير مع اقتراح اسم
عشوائي"), the prototype's `shuffleName`, `NAMES_A` and `NAMES_B`. A shuffle that could return the name
already showing would be a button that sometimes does nothing.

**REQ-5.4 — The judge: chosen from the players, rotation toggled, resolved by the prototype's rule**
Choosing a judge sets the judge index to that player's position. Turning rotation on or off sets the
flag Phase 4's `nextRound` reads. The engine exports who the judge is: the player at
`judgeIndex mod players.length`, or the first player if that is empty, or nobody when there are no
players — the prototype's `judge` getter.
*Why:* `roadmap.md` ("Judge card: judge selection … toggle"), H-02, and the prototype's
`judgeOptions[].onPick`, `toggleRotate` and `get judge()`. The room-ready screen names the judge
("الحكم: …"), Phase 6's answer box names them, and Phase 11 checks every judge action against them —
one rule, exported once.

**REQ-5.5 — Categories keep the order they were picked in**
Picking a category appends it to the selection; unpicking removes it; picking one already picked or
unpicking one not picked changes nothing. The engine accepts any category id (reading 6).
*Why:* `roadmap.md` ("selected/locked states"), H-03, and the prototype's `toggleCat`
(`[...s.picked, i]`). Selection order is not cosmetic: Phase 4's `drawableCategories` keeps it, so a
given random value picks the same category in the engine as in the prototype (REQ-4.3).

**REQ-5.6 — From setup to room-ready and back: the guard and the fill**
Opening the room moves the screen from `setup` to `ready`, applying the prototype's player fill first
(reading 2). It is inert — on setup as everywhere else — when no category is picked: the zero-category
guard (reading 1). The engine exports the rule as a predicate, so the screen disables its button by the
same rule the reducer applies, as Phase 3's `acceptsJudgeActions` does for the judge's buttons. Going
back moves the screen from `ready` to `setup` and changes nothing else; it is inert everywhere else.
*Why:* `roadmap.md` ("Guard: cannot start with zero categories selected"), H-03, H-04 ("إمكانية الرجوع
للإعداد دون فقدان الغرفة"), and the prototype's `startGame` and `backToSetup`. The fill guarantees that
every room reaching `ready` has two teams with someone in each, which is what Phase 4's match flow
assumes and does not check (Phase 4, reading 7).

**REQ-5.7 — Phases 3 and 4 are unchanged, and the match flow's invariants still hold**
Every Phase 3 and Phase 4 action keeps its contract, and `RoomState` gains no field. Every Phase 3 and
Phase 4 test passes, and their test files change in exactly the places [specs.md](specs.md) §2.10 lists
— two files, each a list written to fail when the surface grows — and nowhere else; their oracles,
harnesses, generators, invariants and pre-registered tables are not edited. Over a pre-registered sample
of generated sequences that edit setup, open the room, go back, open it again and play a match, Phase
3's invariants I1–I10, Phase 4's J1–J8 and this phase's K1–K5 hold after every step.
*Why:* Phases 3 and 4's verdicts were each evaluated exactly once, and their tests are the regression
check that those verdicts still describe the engine. J6 (`usedCategories.length === round`) holds only
because no flow reaches a draw with every category used (Phase 4, R6); setup changes the selection, so
this is where a new path to that draw would appear. None is added: setup actions are inert outside
`setup`, and on `setup` and `ready` the used list is always empty (K1). Phase 4 asked that this be
recorded; the sample is the record.

**REQ-5.8 — The setup rules are read from the prototype at test time**
The removal rule for the judge index, the player fill (its two names and its threshold), the selection
order, the team name lists, the shuffle's "different from the current name", the judge getter, which
screen opening the room moves to, which fields going back changes, and the default selection the
guard replaces are each extracted from `design/designs/Nel3ab - Arcade.dc.html` when the test runs —
nine extractions, listed in [verification.md](verification.md) Gate 1 — asserted equal to the engine's
(the ninth asserted to be the line reading 1 departs from), and each drives the engine.
The number of matches of every extraction is asserted, so an extraction that finds nothing fails.
*Why:* REQ-3.10, REQ-4.12 and NFR-2.6: a fidelity claim is worth something only if a change that breaks
it fails CI. `design/` is never edited, so these tests can go red only by the engine drifting.

**REQ-5.9 — Full coverage of the whole engine, still enforced on every run**
Every line, branch, function and statement of `packages/game/src` — with the same two exclusions — is
executed by the test suite, and `pnpm test` fails if that stops being true. Named plausible mutations
of the setup rules are each caught by an assertion.
*Why:* REQ-3.12 (DECIDED 2026-09-30) and REQ-4.15. The coverage configuration already includes every
`.ts` file under `packages/game/src`, so the new module is measured with no configuration change.

### 2.2 The local driver and its stand-ins (`apps/web`)

**REQ-5.10 — One room per page, seeded with the prototype's own room**
Opening `/host` creates one room, held in the page for as long as the page is open. Its starting state
is the prototype's: five players — ريم (A), سعد (B), نورة (A), خالد (B), ماجد (A) — with ماجد judging,
rotation off, team names النمور and الصقور, the eight free categories picked in the prototype's order,
the 45-second default and three wins to take a match. Its room code is the driver's placeholder
(reading 8). Nothing that depends on the random source is rendered before the host's first action, so
the server-rendered page and the hydrated one are the same markup.
*Why:* `tech-specs.md` §3.1 (`/host`, client-rendered); the prototype's initial `state`. Until players
can join (Phase 13) a room with no players would leave the judge card empty and the rotation toggle
meaningless.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): the prototype's five demo players.** The
> setup screen opens with ريم، سعد، نورة، خالد، ماجد, ماجد judging, exactly as the prototype does, so
> every control can be used and the screen can be compared with the prototype without any staging.
> Phase 13 replaces them with players who join. The alternatives considered and rejected were an empty
> room (honest, but nothing on the setup screen could be exercised before Phase 13) and an "add a name"
> field (H-01 asks for adding a player, but the prototype's screen has no such field, so it would have
> to be designed outside the prototype). **What it costs:** demo names are in the app until Phase 13 —
> including on the public URL Phase 9 deploys — and Phase 7's playtest with real people uses them (the
> host removes and swaps chips to match the room, but cannot type real names). Phase 7 may revisit the
> field when the playtest shows whether it is missed.

**REQ-5.11 — The driver draws with the engine's helpers and a real random source**
Every round the driver starts — the match's first from room-ready, a rematch, and the next round —
carries a category drawn with `drawCategory(drawableCategories(state), random)` and the catalog's
questions for it ordered by `shuffleQuestions(…, random)`, in that order, with no other call to the
random source. In the page the random source is `Math.random`.
*Why:* Phase 4's carried-forward obligation: the engine checks that a draw is *allowed*, not that it
was *random* (REQ-4.1). A driver that always took the first category would pass every check the engine
has; only the driver's own tests can show it draws, and they must use the real source to show it.

**REQ-5.12 — The clock runs in 100 ms ticks, and the turn passes after the reveal**
While the room is on the play screen, the driver dispatches `tick` of exactly 100 ms once every 100 ms
of the browser's timer, and `passTurn` immediately after every tick. It runs no timer on any other
screen; the loop stops in the step that leaves `play` and starts in the step that enters it. It never
measures elapsed wall time.
*Why:* Phase 4's carried-forward obligation — a driver that never sends `passTurn` leaves the reveal up
and the game stalled — and Phase 3's: a loop that measures wall time and rounds each delta drifts by up
to ±225 ms over a 45 s bank, invisibly to the engine. A fixed `tick(100)` per callback is the
prototype's own clock (`setInterval(…, 100)` draining 0.1 s), and with `passTurn` after each tick the
turn passes at exactly 1000 ms, the prototype's hold.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): "ابدأ الجولة الأولى" really starts the
> match.** Phase 5 builds the whole local driver — the room, the draw, the clock loop and `passTurn` —
> so both obligations Phase 4 handed to Phase 5 are met and verified here, and the room-ready screen's
> button does what it says. Until Phase 6, the play screen (and Phase 7's two) is a plain placeholder.
> The alternatives considered and rejected were a draw with no clock (moving the `passTurn` obligation
> to Phase 6) and an inert button (moving both). **What it costs:** a larger Phase 5, and a placeholder
> screen that exists for one phase. A round started in Phase 5 runs out its clock in front of a
> placeholder, and nothing on it can be pressed; reloading the page starts again.

**REQ-5.13 — No driver path dispatches `startRound`**
The driver's interface cannot express `startRound`, `startMatch`, `nextRound`, `tick` or `passTurn` as
a raw action: the first never, the next two only through the methods that draw for them, the last two
only from the clock loop. No non-test source file in `apps/web` contains the string `startRound`.
*Why:* Phase 4's carried-forward obligation. `startRound` is Phase 3's primitive, kept public for Phase
3's tests; the rounds it starts are unscored.

**REQ-5.14 — A temporary catalog: the prototype's eleven tiles, and placeholder questions**
The judge app's categories come from a catalog in `apps/web` that is explicitly temporary: eleven
entries in the prototype's order, each with the prototype's name, emoji and lock (ثقافة، فن، أفلام
locked), and three placeholder questions of two hints each whose text says plainly that they are
placeholders. No question, answer, accepted variant, hint or fact from the prototype appears in any
non-test source file in `apps/web`.
*Why:* The rail needs eleven tiles; the draw needs questions; Phase 8 owns the content and its
human-verification gate (A-3). `apps/web` does not depend on `@nel3ab/content` — in production it learns
the categories from the server (`tech-specs.md` §2.1, §3.3) — so the stand-in lives in the app, where
Phase 8 and Phase 11 replace it.

> **DECIDED 2026-10-02 (Ahmed, in the planning session): placeholder questions.** The tiles reproduce
> the prototype's names, emoji and locks; the questions are placeholders, so no unchecked fact enters
> the repository before Phase 8's review gate exists. The alternative considered and rejected was
> transcribing the prototype's 33 questions now for the owner to verify in the pull request. The planning
> session found at least one already wrong — the prototype gives "إنسايد آوت ٢" as the highest-grossing
> animated film, which *Ne Zha 2* overtook in 2025 — which is `mission.md` §5.4's point.
> **What it costs:** Phases 6 and 7 play with placeholder questions until Phase 8 lands; Phase 7's
> "play a real match with real people" needs real questions, so it either follows Phase 8 or the owner
> verifies a set first. That is Phase 7's to decide.

### 2.3 The screens (`apps/web/app/host`)

**REQ-5.15 — The judge app's frame at `/host`**
`/host` renders the judge app: a full-height page in the theme's ground colour with the prototype's
title, a centred column at most 440 px wide with 14 px of side padding, and the header row — the brand
mark (an 18 px `--red` circle with a 2.5 px ink border) and the wordmark "نلعب" at 19 px / 800 on one
side, the round label at 12 px / 700 `--muted` on the other ("إعداد" on setup and room-ready; "جولة N —
أول W جولات" otherwise). The frame's root sets `font-family: var(--font)` and `line-height: normal`. It
follows the device's theme, with no switch. The prototype's debug top bar — judge/player and day/night
— does not exist in any form. On `play`, `roundEnd` and `match` the column shows a plain placeholder.
*Why:* `roadmap.md` Phase 5 ("Remove the prototype's debug top bar entirely"); `design/README.md` §2;
Phase 2's findings (`var(--font)` on every screen root; follow the device, REQ-2.5); §1.1, fact 3.

**REQ-5.16 — Setup: the teams card**
The title row ("الفرق" and "N لاعبين"); the two team tiles side by side — team A `--red`, team B `--sky` —
each with its label ("فريق ١" / "فريق ٢"), a ↺ shuffle button, the team's name as an editable field that
renames the team on every keystroke, and its members' names (or "بدون لاعبين"); and below them every
player as a chip in their team's colour, with ↔ (swap) and ✕ (remove). Every value is the prototype's
(Table P).
*Why:* `roadmap.md` ("teams card, editable team names with shuffle, player chips with swap/remove");
`design/README.md` §2; H-01 ("عدّاد اللاعبين ظاهر طوال الإعداد").

**REQ-5.17 — Setup: the judge card**
The title row ("الحكم" and "العدد فردي — يفضّل التبديل" when the player count is odd, else "ثابت طول
المباراة"); the explanatory line; one choice per player, the judge's `--yellow` with a `0 3px 0` shadow;
and the full-width toggle "بدّل الحكم كل جولة", prefixed ✔ and `--leaf` when on, ○ and `--sunken` when
off, its text at the inline start. The judge choice is styled on this screen, not by a `@nel3ab/ui`
primitive (§1.1, fact 4).
*Why:* `roadmap.md` ("Judge card: judge selection, odd-count hint, 'بدّل الحكم كل جولة' toggle"); H-02;
Phase 2's open finding on the second pill shape, which this phase decides: a one-off used on one screen
does not earn a place in the shared package.

**REQ-5.18 — Setup: the categories rail**
The title row ("الفئات" and "N من 11 مختارة"); a horizontal rail of eleven 92 px tiles that scrolls and
snaps, bleeds to the card's edges and shows no scrollbar; each tile with its emoji, its name and a
status line — selected tiles `--yellow` with a `0 3px 0` shadow and "مختارة"; locked tiles at
`opacity: .5` with `cursor: not-allowed` and a `--red` "🔒 مدفوعة", which a press does not select.
A locked tile is not a disabled control: it carries neither `disabled` nor `aria-disabled`, whose global
rule would make it `.45` (§1.1, fact 5).
*Why:* `roadmap.md` ("horizontal snap-scroll bleeding to card edges, selected/locked states"); H-03
("الفئات المدفوعة معلّمة بقفل وغير قابلة للاختيار"); §1.1, fact 2.

**REQ-5.19 — Setup: the start button, the guard and the footnote**
The full-width primary CTA "ابدأ اللعبة" ▶ opens the room. With no category picked it is disabled — the
design system's disabled state, with no press (reading 1). Below it, the footnote "الحكم يشوف الإجابات ·
45 ثانية لكل فريق · ما تحتاج تسجّل دخول", its number the room's round length.
*Why:* `roadmap.md` ("Guard: cannot start with zero categories selected"); H-03; `design/README.md` §2.

**REQ-5.20 — The room-ready screen**
Centred: the 🎉 at 54 px bobbing on a 1 s loop; "الغرفة جاهزة!"; the caption "كود الانضمام — شاركه مع
اللاعبين"; the room code — Archivo 800 at 26 px with `.2em` tracking, direction-isolated, in a raised
panel box — beside the share button; the "في الغرفة" panel listing every player as a chip in their
team's colour, with "الحكم: <name>"; the primary CTA "ابدأ الجولة الأولى" ▶ at **19 px**, which starts
the match through the driver; and the secondary "رجوع للإعداد", which goes back. The 🎉's animation is
base.css's global `bob`, reached through a custom property (§1.1, fact 6).
*Why:* `roadmap.md` ("Room-ready screen: room code in Archivo with `.2em` tracking, share button,
in-room list"); `design/README.md` §3; H-04; §1.1, facts 5 and 6.

**REQ-5.21 — Share**
Pressing share first offers the operating system's share sheet (`navigator.share`) with the title
"نلعب", the text "انضم لغرفتنا بالكود <code>" and the link `https://nel3ab.game/j/<code>`. If the sheet
is unavailable, or fails for any reason other than the host dismissing it, the link is copied to the
clipboard; if that is unavailable or fails, the raw code is shown. The outcome flashes on the button —
"تمت المشاركة ✔", "نُسخ الرابط ✔" or "الكود: <code>" — with the button `--leaf`, for exactly 1800 ms,
a second press restarting the 1800 ms. Dismissing the sheet (`AbortError`) shows nothing and copies
nothing. The button presses down by the shared press (`0 4px 0` → `0 1px 0`).
*Why:* `roadmap.md` ("Share: `navigator.share` → clipboard → raw code fallback; 1800ms leaf
confirmation; ignore `AbortError`"); `design/README.md` "Share"; the prototype's `shareRoom`.

**REQ-5.22 — The screens' words and the driver's numbers are read from the prototype at test time**
Every literal text the prototype's setup and room-ready markup shows, every label its `renderVals`
builds for them, its share strings and timings, its initial room, its eleven categories' names, emoji
and locks, and its clock interval are extracted from `design/designs/Nel3ab - Arcade.dc.html` when the
test runs — the extractions listed in [verification.md](verification.md) Gate 4 — and asserted to be
what the screens render, what the driver uses, or what the seed and the catalog hold. Each extraction's
match count is asserted.
*Why:* as REQ-5.8, for the screens: Arabic copy is a design decision (`mission.md` §3), and a typo in a
label is a fidelity defect that no other check catches.

**REQ-5.23 — `@nel3ab/ui` grows by exactly two things**
The shared press is importable by a screen — `@nel3ab/ui/press.module.css` — so the share button presses
by the one press rule rather than a copy of it. And the primary `Button` takes a size: the default stays
20 px, and the second size is the prototype's 19 px. Nothing else in `@nel3ab/ui` changes; its five
runtime exports are unchanged and every Phase 2 test passes untouched.
*Why:* §1.1, fact 5. Phase 2's REQ-2.8 made the press one shared mechanism ("never a scale, never an
opacity fade"); a second copy is how it drifts. Phase 2 recorded the 19 px / 20 px split and chose
20 px for the default (2026-09-30, "no change"); a second size keeps that ruling and lets the
prototypes' four 19 px CTAs — this phase's, Phase 7's two and Phase 13's "انضم" — be exact (measured:
four CTAs at 19 px and three at 20 px across the three prototype files). Both were tried on a
scratch copy: `pnpm typecheck`, all 83 `@nel3ab/ui` tests, ESLint, Stylelint and `next build` pass.

### 2.4 The exit criterion and the gate

**REQ-5.24 — 🚦 Setup and room-ready match the prototype in both themes**
Measured in one browser session beside the prototype, by the procedure [verification.md](verification.md)
pre-registers, every element of Tables P–R on both screens matches the prototype — position and size
within 0.5 px, and border width, radius, padding, shadow offset and colour, fill, text colour and type
size and weight exactly — at a 480 px and a 375 px viewport, in the light theme and in the dark one.
*Why:* this is the roadmap's exit criterion — "Setup and ready screens match the prototype in both
themes; a designer's eye finds no spacing, radius or shadow deviation" — measured against the only
specification of these screens there is. It compares the implementation with an external reference, so
it is a **verdict gate**: Gate 5 is where deviations are found and fixed; a deviation that survives to
the verdict is a fact about this phase's reading of the prototype, and returns to the owner.

**REQ-5.25 — The four gate commands pass with no escape hatch**
`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass on a fresh
`pnpm install --frozen-lockfile`, on Windows and on Ubuntu CI, with none of Phase 3's REQ-3.13 escape
hatches introduced anywhere.
*Why:* the phase gate (`CLAUDE.md`). Phase 5 adds **no** dependency (NFR-5.5), so nothing about the
stack is being measured and this is an ordinary gate: a failure is a defect in this phase's code.

---

## 3. Non-Functional Requirements

**NFR-5.1 — `design/` and `specs/` are not edited.** Tests may read `design/`; nothing writes to it
(`CLAUDE.md` invariant 5). `specs/` is read-only during implementation (invariant 6); `verification.md`
may only have boxes ticked and measured values recorded.

**NFR-5.2 — `@nel3ab/game` stays dependency-free and ambient-free.** Its manifest gains nothing, no
non-test source file imports anything but a relative path inside the package, and no non-test source
file — comments included — contains any word Phase 3's ambient grep searches for (`Date`,
`Math.random`, `performance`, `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `crypto`,
`process`, `fetch`, `console`). The shuffle helper takes its random source as a parameter.

**NFR-5.3 — Every setup action is pure.** For the eight new actions, as for Phase 3's five and Phase
4's four: the reducer never mutates its inputs; the same state and action give a deep-equal result every
time; an inert action returns the object it was given; validation precedes inertness, so a malformed
action throws on every screen; and no ambient time, randomness or timer is touched.

**NFR-5.4 — The public surfaces are exact.** `@nel3ab/game`'s runtime exports are Phase 4's seventeen
plus exactly four — `TEAM_NAMES`, `canOpenRoom`, `currentJudge`, `shuffleTeamName` — and the new
internal helpers stay internal. `@nel3ab/ui`'s runtime exports are unchanged (the five primitives); its
manifest's `exports` gains exactly one subpath, `./press.module.css`.

**NFR-5.5 — No dependency, and configuration changed in one place.** No manifest gains a dependency
and `pnpm-lock.yaml` does not change. The one configuration change is the `@nel3ab/ui` subpath of
NFR-5.4. `vitest.config.ts`, the root `package.json`, every other `package.json`, every `tsconfig*.json`,
`apps/web/next.config.ts`, `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`,
`eslint.config.mjs`, `stylelint.config.mjs`, `prettier.config.mjs`, `.gitattributes`, `.gitignore`,
`.prettierignore` and `apps/web/app/{layout.tsx,globals.css,fonts.ts}` are untouched. If a change to any
of them appears necessary, that is the signal to stop.

**NFR-5.6 — Every project still contributes a test, and the suite stays fast enough.** `pnpm test`
still reports six projects (`CLAUDE.md` invariant 2). The `@nel3ab/game` project completes in under
**20 s** on the Windows development machine on mains power, as NFR-4.5 required; if it cannot, no sample
is shrunk and the overrun is recorded as a finding. Every heavy pass carries an explicit `120_000`
ceiling (`CLAUDE.md`, the fourth trap).

**NFR-5.7 — The judge app sends nothing anywhere.** `/host` makes no network request of its own after
the page and its assets load: no fetch, no socket, no beacon. The only thing that leaves the page is the
share payload — the title, the text with the room code, and the link — handed to the operating system's
share sheet or the clipboard. `RoomState`, which holds every answer of the round in play, never leaves
the page (`mission.md` §3: `/host` is the judge's client, and the only client in Phases 5–10).

**NFR-5.8 — RTL is the starting point.** Every new stylesheet passes Stylelint with no disable comment
— logical properties and `start` / `end` only — and the room code is direction-isolated (`.ltr-num`).
The prototype's physical `text-align: right` and `margin: 0 -14px` are written as `start` and
`margin-inline`, which in this right-to-left document are the same values.

---

## 4. Explicit Non-Goals

An implementer that wants to do any of the following must **stop**, not proceed.

- **No play, round-end or match-end screen.** No timer card, no question card, no answer box, no action
  row, no score card, no round log, no button on the placeholder (Phases 6 and 7).
- **No adding players, no joining, no player screens.** No name field on setup; no `/j/[code]`; no
  lobby; no "بدّل فريقي" (Phases 13–14). The demo players are the only players.
- **No real question content.** Nothing from the prototype's `qs` arrays, from `desc` or from `chips`;
  no change to `packages/content` (Phase 8).
- **No server, no wire protocol, no persistence.** No fetch, no socket, no `localStorage`, no change to
  `packages/protocol` or `apps/game` (Phases 10–11, 15). The room lives and dies with the page.
- **No configuration exposed.** No round-length or wins-to-take-a-match control; the prototype's
  tweak panel is a prototype affordance like its top bar. The app plays 45 s and three wins.
- **No theme switch.** The theme follows the device (REQ-2.5). The prototype's day/night buttons are
  part of the debug bar this phase removes.
- **No entitlement.** Locks are content in the catalog; the engine knows nothing of them (reading 6);
  enforcing them is Phase 20's.
- **No accessibility pass beyond what the prototype does.** Icon-only buttons keep the prototype's
  `title` and gain the same text as an accessible name; the team-name field keeps the prototype's
  `outline: none`. The audit is Phase 23's.
- **No change to Phase 3's or Phase 4's rules, records or test support** beyond specs.md §2.10's two
  files; no change to `@nel3ab/ui` beyond REQ-5.23; no change to any file NFR-5.5 lists.
- **No dependency.** No DOM test environment, no testing library, no browser automation package. The
  screens are tested as rendered markup and measured in the desktop app's browser (specs.md §4, R2).

---

*Last updated: 2026-10-02*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
