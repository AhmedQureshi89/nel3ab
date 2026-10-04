# Phase 6 Requirements — Judge app: the play screen

> **Phase Status:** Ready for Implementation
> **Parent Roadmap:** [../roadmap.md](../roadmap.md)
> **Constitution:** [../mission.md](../mission.md) · A-1, A-2, A-3 in force, none binds this phase · four owner decisions of 2026-10-03 recorded in REQ-6.8, REQ-6.12, REQ-6.6 and verification.md's gate ordering · no proposals in force
> **Duration:** 1 day

---

## 1. Overview & Objectives

Phase 6 builds the screen the whole product exists for: the judge's **play** screen at `/host`. Two
timer cards, the round's category and the active team's time bank, the question card with its hint
strip and its reveal overlay, the judge-only answer box, and the three buttons — تخطي، تلميح، صحيح —
that decide every question. It replaces Phase 5's placeholder on `play` and wires the three buttons
to the local driver, which hands them to the rules engine. Round end and match end stay Phase 5's
placeholder until Phase 7.

The premise this phase rests on is Phase 5, and it held. All 46 of Phase 5's verification boxes are
ticked with measured values. Its 🚦 verdict, REQ-5.24, returned **PASS** at `96d6540`, measured on
the production build of `d3c51a1`: setup and room-ready equal the prototype in all eight
configurations (2 screens × 480 and 375 px × light and dark), 0 differences over 103 and 24 matched
elements × 17 properties, both pages measured in one tab at a true 2× raster; the owner's look found
nothing (`5a8e78d`). The phase closed at `d76fa23` and merged as PR #32 (`77ed5a4`, 2026-10-03).
Phase 5 recorded no FAIL, so nothing constrains what this phase may assume.

What Phase 6 starts from, as measured on `77ed5a4`:

- **The engine needs nothing new.** `@nel3ab/game` already reduces `hint`, `skip` and `correct`
  (Phase 3), passes the turn after the 1000 ms hold (`passTurn`, Phase 4), and exports every helper
  the screen reads: `currentQuestion`, `acceptsJudgeActions`, `remainingMs`, `displaySeconds`,
  `currentJudge`, `HINT_COST_MS`, `SKIP_COST_MS`. Its 21 runtime exports and its 100% coverage are
  unchanged by this phase.
- **The driver needs nothing new.** `apps/web/app/host/_lib/driver.ts` already admits `hint`, `skip`
  and `correct` through `dispatch` (`DriverAction`), runs `tick(100)` then `passTurn` every 100 ms
  on `play`, draws with the engine's helpers and never dispatches Phase 3's round primitive.
- **The UI kit needs nothing new.** `@nel3ab/ui`'s `Button variant="action"` is the prototype's
  action button — `15px 8px`, 15.5 px / 800, `0 5px 0` pressing 3 px, the 11 px / 700 / `.6`
  sub-label after a `<br>`, and the panel / `data-tone="yellow"` / `data-tone="leaf"` fills — and
  `Dot size="sm"` is the 9 px tally dot (Phase 2, Gate 6).
- **The frame already sets the type.** Phase 5's `.page` (`host.module.css`) sets
  `font-family: var(--font)` and `line-height: normal` on the root every judge screen renders
  inside, so the play screen inherits both (Phase 5's first carried finding).

So Phase 6 is a screen phase only: a pure view of the play state, the screen, one routing change in
`HostApp.tsx`, and their tests. No package changes.

The sharpest version of the question this phase answers:

> **Can a judge run a full round on one phone — the clock running, hints spending 2 s, skips
> spending 3 s and moving on, صحيح revealing the answer and passing the turn after a second — on a
> screen that a designer comparing it with the prototype finds identical, in light and in dark, with
> every rule decided by the engine and none by the screen?**

### 1.1 The prototype's play screen, measured before this plan was written

`design/designs/Nel3ab - Arcade.dc.html` was served read-only (`python -m http.server 8765 --bind
127.0.0.1` from `design/designs/`) and opened in the Claude desktop app's built-in Chromium on
2026-10-03, with both of its Google-hosted families loaded (Baloo Bhaijaan 2 500/600/700/800,
Archivo 800). The prototype was staged into play deterministically: `Math.random` replaced by
`() => 0.5` (so the round draws أمثال, the fifth of the eight picked categories, and keeps its
questions in their written order), and `setInterval` replaced by a stepper that holds each interval's
callback for the measurer to call — one call is one 100 ms tick — so the clock moves only when told
to. Five states were measured, in this order, by the same function at each of four configurations
(480 × 800 and 375 × 800, light and dark): **S1** round start, **S2** after one hint, **S3** after
the second hint (hints used up), **S4** after صحيح (the reveal up), **S5** after the turn passed.
Every value is pre-registered in [verification.md](verification.md) Tables A–E, which REQ-6.17's
verdict compares against. A fresh load reproduced the light 480 px measurement with **0** differences
over every role and property of all five states.

Eight facts were found by measuring rather than reading, and are recorded here so that they are
decisions on the record rather than discoveries at the keyboard:

1. **Geometry is identical in the two themes**, at both widths: 0 boxes of the five states move or
   resize between light and dark. Dark changes colours only (Table D), with the same mapping as
   Phase 5's Table S and three play-screen additions: the hint strip, the bank track and an unwon
   dot are `--sunken`; the hint button's text stays ink on yellow; the صحيح button and the reveal
   keep their `#0d2b1b` on leaf.
2. **The browser pane's raster depends on whether the viewport fits the pane.** An emulated 480 ×
   1100 viewport was scaled down to fit and rasterised at an effective 1.5 (a 3 px border painted
   2.667 px) although `devicePixelRatio` read 2; at 480 × 800 and 375 × 800 it rasterised at a true
   2 (3 px painted 3 px; 2.5 px painted 2 px). Tables A–E are measured at 480 × 800 and 375 × 800,
   true 2. This is Phase 5's carried finding (a screenshot can switch the ratio) with a second
   cause; the verdict's parity check covers both.
3. **Only the first hint of a question slides in.** The hint text is one element that stays in the
   document; its `animation` becomes `slidein .22s ease-out` when the first hint is spent and stays
   that value through the second, so the second hint replaces the text with no animation (measured:
   no running animation after the second تلميح; the same node before and after). A skip or a turn
   pass returns it to `none`, so the next question's first hint slides in again. See REQ-6.8.
4. **The four UI glyphs on this screen fall back the same way on both pages.** ⏭ 💡 ✔ 👁 are in
   neither Baloo Bhaijaan 2 (the self-hosted file nor the Google subsets the prototype loads) nor
   Arial (next/font's "baloo Fallback"), so both pages reach the platform's symbol font for them.
   Phase 5's ▶ difference had a different cause: the self-hosted Baloo file contains ▶, and the
   Google subsets' `unicode-range` leaves it out (measured on the prototype's own `document.fonts`).
   See REQ-6.12.
5. **The exhausted hint button is the design system's disabled state plus a muted colour.** After the
   second hint the prototype's تلميح button is `--panel` with `--muted` text at `opacity: .45` and
   `cursor: not-allowed`, keeping its `0 5px 0` shadow; its sub-label reads "انتهت التلميحات". During
   the reveal the prototype draws all three buttons unchanged.
6. **The reveal overlay covers the card's padding box.** It is `position: absolute; inset: 0` inside
   the 3 px border: 434 × 244 on a 440 × 250 card at 480 px. Its label "الإجابة" is tracked `.1em`
   (1.3 px) and the answer box's "للحكم فقط 👁" `.06em` (0.69 px).
7. **The app's driver plays the prototype's round tick for tick.** The scripted round of verification
   Table V — 37 ticks, تلميح, 5 ticks, تلميح, تلميح on the spent button, تخطي, 8 ticks, صحيح, تخطي
   under the reveal, 10 ticks, 1 tick, صحيح, 10 ticks, then until a clock runs out — was run on the
   prototype with its stepper and, on a throwaway test (deleted, never committed), through
   `createLocalRoom` under Vitest's fake timers with the same random source: every displayed clock,
   active team, started flag, question number, hint count, reveal and bank percentage (to four
   decimals) is equal at all 17 points, and both rounds end on the 330th tick after the last pass
   with team B the winner. The question **texts** differ — the app plays Phase 5's placeholders
   (REQ-5.14) in the fair shuffle's order (Phase 4) — and are not part of the trace.
8. **The CSS this screen needs passes the repository's linters unchanged.** A throwaway stylesheet
   (deleted) holding `text-wrap: pretty`, `position: absolute; inset: 0`, `--pop: pop 0.18s
   ease-out; animation: var(--pop)`, `transition: width 0.1s linear` and `letter-spacing: 0.06em`
   passed `stylelint` and `prettier --check` with the repository's configurations.

### 1.2 The four decisions of 2026-10-03

The planning session put four questions to the owner, each with a recommended option. The owner took
every recommendation. Each is recorded as a **DECIDED** block where it governs.

| Question | Decided | Recorded in |
|---|---|---|
| How do the glyphs Baloo lacks draw as in the prototype? | Keep Phase 5's rule: each UI glyph in its own `.glyph` span | REQ-6.12 |
| Where are the timer card and the question card built? | On the judge screen; Phase 14 decides whether to lift them into `@nel3ab/ui` | REQ-6.6 |
| Does the second hint of a question slide in? | No — copy the prototype: only the first hint does | REQ-6.8 |
| Who performs the browser gates? | Claude measures; the owner performs the look, as in Phase 5 | verification.md, gate ordering |

### 1.3 Findings carried forward into this phase, and where each is met

| From | Finding | Met by |
|---|---|---|
| Phase 5 | A judge screen's root sets `font-family: var(--font)` and `line-height: normal`, and reaches a global keyframe through a custom property | The frame's `.page` already sets both (§1); `pop` and `slidein` are reached as `--pop` / `--slidein` (REQ-6.8, REQ-6.9), checked by Y4 |
| Phase 5 | A UI glyph Baloo lacks is drawn in the system font — per glyph, unless Phase 6 changes `fonts.ts` | REQ-6.12, DECIDED: per glyph; `fonts.ts` untouched |
| Phase 5 | Phase 6 shows questions for the first time; the fair shuffle's order and the clock's 20 / 25 / 65–90 s differences become visible | §2 reading 8; the app plays 45 s only; Table V compares question **numbers**, not texts |
| Phase 5 | Play, round end and match end are placeholders; Phase 6 replaces play | REQ-6.13 |
| Phase 5 | The room is five demo players and the questions are placeholders | Kept (REQ-5.10, REQ-5.14); the browser comparisons stage the prototype's texts (reading 8) |
| Phase 5 | A browser verdict needs one tab, no screenshot inside a comparison, a 3 px border painting the same width on both pages, and the raster recorded | Procedure M6 (verification.md), with fact 2's second cause |
| Phase 5 | The browser holds the room, the code and the clock until Phase 11 | Unchanged; the play screen reads the local driver's room |
| Phase 4 | Every driver sends `passTurn`, draws with the helpers, never dispatches `startRound` | Met by Phase 5's driver, unchanged; REQ-6.13 adds no path |
| Phase 3 | The engine deliberately differs from the prototype at 20, 25 and 65–90 s banks | Not visible: no configuration is exposed (§4) |

### 1.4 Where Phase 6 stops

| Behaviour | Phase 6 | Later |
|---|---|---|
| The play screen | built, pixel-accurate, wired | — |
| Round end and match end | Phase 5's placeholder, unchanged | **Phase 7** (screens, "الجولة التالية", the rematch, back to setup) |
| A round after the first: won dots filled, team B starting | the view and the markup are tested; no button reaches them in a browser | **Phase 7**, whose browser pass measures them (§2 reading 6) |
| The clock and the turn pass | the local driver, unchanged | **Phase 11** (the server) and **Phase 16** (reconciliation) |
| Question content | Phase 5's placeholders | **Phase 8** |
| The player's question card and timer cards | not built | **Phase 14**, from the player payload (reading 7) |

### Amendment discipline (binding on this phase)

Phase 6 requires **no amendment to `mission.md` §8**. Every requirement traces to an existing decision:

| Requirement source | Recorded in |
|---|---|
| Two timer cards: active fill, win dots, status, Archivo 22 px clock | `roadmap.md` Phase 6 · `design/README.md` §4.1 · H-07 |
| Category pill and time-bank bar, `width` at `.1s linear` | `roadmap.md` Phase 6 · `design/README.md` §4.2 · H-07 |
| Question card: coloured header, 24 / 800 body with `text-wrap: pretty`, hint strip | `roadmap.md` Phase 6 · `design/README.md` §4.3 |
| Hint reveal with `slidein` 220 ms; muted placeholder until a hint is spent | `roadmap.md` Phase 6 · `design/README.md` §4.3, "Animations" · H-06 |
| Reveal overlay: leaf, `pop` 180 ms, answer 30 / 800, dismissed at 1000 ms | `roadmap.md` Phase 6 · `design/README.md` §4.3 · REQ-4.6 |
| Judge-only answer box: 3 px dashed red, answer and variants | `roadmap.md` Phase 6 · `design/README.md` §4.4 · H-05 |
| Action row: sub-labels, disabled states, press | `roadmap.md` Phase 6 · `design/README.md` §4.5 · H-06 · REQ-2.8, REQ-2.10 |
| The three actions through the Phase 3–4 reducer | `roadmap.md` Phase 6 · REQ-3.6, REQ-3.8, REQ-4.6 · REQ-5.12, REQ-5.13 |
| A full round playable on one device | `roadmap.md` Phase 6 exit |
| Match the prototype in both themes | `mission.md` §5.3, §7 "Design fidelity" |
| The answer reaches the judge's client and no other | `mission.md` §3 — `/host` is the judge's client (NFR-6.5) |
| The server owns the clock; clients never decide a round ended | `mission.md` §5.2 — the engine decides; Phase 11 moves it to the server |
| Exact pins, no overrides, no `@ts-expect-error`, `pnpm test` is the wrapper | `CLAUDE.md` invariants 2, 4 |

Four decisions were taken by the owner on 2026-10-03 (§1.2). None departs from the prototype; one —
the timer and question cards on the judge screen — defers, not contradicts, `tech-specs.md` §2.3's
list of `@nel3ab/ui` primitives (REQ-6.6). Nine readings are recorded explicitly. **None contradicts a
binding document:**

1. **During the reveal the three buttons look as the prototype draws them, and do nothing.** H-06
   says "الأزرار معطّلة أثناء كشف الإجابة أو توقف الساعة"; the prototype draws no disabled state then
   (§1.1, fact 5). Their inertness is the engine's — `acceptsJudgeActions` is false while the reveal
   is up — so a press is handed to the engine and changes nothing.
2. **The exhausted hint button is a disabled control.** Its look is the prototype's — `--panel`,
   `--muted` text, `opacity .45`, `cursor: not-allowed`, the rest shadow kept — which is the design
   system's disabled state with a muted colour. Unlike the prototype's, it does not press: Phase 2's
   press is guarded off disabled controls (REQ-2.8). The difference is visible only while a pointer
   holds a control that does nothing.
3. **The reveal comes down 900–1000 ms after صحيح, not exactly 1000 ms.** The hold is measured in
   engine time from the last tick before the press (REQ-4.6, DECIDED 2026-10-02), and the loop
   ticks every 100 ms, so in wall time the pass lands on the tenth tick after the press. The
   prototype's `setTimeout(…, 1000)` starts at the press. In tick time the two are identical — both
   pass on the tenth tick (Table V). Not a regression; recorded so a stopwatch does not find it.
4. **The question number keeps counting past the pool.** "سؤال 4" on a three-question pool, as the
   prototype's `qi + 1`; the question itself wraps to the pool's start (REQ-3.6).
5. **Only the first hint of a question slides in** (§1.1, fact 3; DECIDED, REQ-6.8).
6. **A round after the first is not reachable in this phase's browser.** Phase 6 has no round-end
   button (Phase 7), so won dots and a round that team B starts are tested in the view and the
   markup, and measured in Phase 7's browser pass. On the play screen of round 1 every dot is
   unwon and team A starts.
7. **The play view is a judge view.** It carries the answer, its variants and the fact, which is
   correct on `/host` (`mission.md` §3). It is never a player payload and is never reused for one:
   Phase 14 builds the player's question card from the player payload Phase 12 constructs from
   scratch, never by removing fields from this view.
8. **The browser comparisons stage the prototype's texts on the app.** The app plays Phase 5's
   placeholder questions (REQ-5.14) in the fair shuffle's order (Phase 4); the prototype plays its
   own. For every geometric comparison the app's question, hint, answer, variants and fact texts are
   set to the prototype's for that state before measuring — Phase 5's Procedure M step 6 for the
   room code, extended — so the comparison measures the screen's CSS on identical text. No
   prototype string enters the repository's source (REQ-5.14 stands).
9. **The clocks are direction-isolated.** They are Archivo digit runs in `.ltr-num`
   (`mission.md` §3). The prototype sets `font-family: var(--font-en)` without isolation; for a run
   of digits the two lay out identically.

---

## 2. Detailed Functional Requirements

This is a one-day phase, so requirements are grouped by workstream. **Dependency order is specified in
[specs.md](specs.md) §1 and is not the same as the order below.**

### 2.1 The play view (`apps/web/app/host/_lib/play-view.ts`)

**REQ-6.1 — One pure function gives every value the play screen shows**
The play screen computes nothing of its own. A pure, framework-free function of the room and the
catalog returns every value it shows, named after the keys of the prototype's `renderVals()` that
compute them, as Phase 5's `view.ts` is for setup and room-ready. It is defined for a room on `play`;
for a room with no current question, or whose category the catalog does not hold, it throws.
*Why:* `design/README.md` — "`renderVals()` is the bridge between them — every value the UI shows is
named there". A view that can be tested without React is what lets this phase add no test
dependency (§4), and naming it after `renderVals` is what lets REQ-6.14 check it against the
prototype key by key.

**REQ-6.2 — The two timer cards' values**
For each team: its name; its clock as the engine displays it — whole seconds, rounded up, never below
zero (`displaySeconds(remainingMs(clock, team))`); whether it is the active team; its status —
"دورهم الآن" when active, else "مجمّد" when its bank has started this round, else "بالانتظار"; and one
dot per round needed to take the match, filled for each round the team has won.
*Why:* `roadmap.md` ("Two timer cards with active fill, win dots, status text, Archivo 22px clock");
H-07 ("الفريق النشط مميّز بلونه … نقاط الجولات المكسوبة ظاهرة لكل فريق"); the prototype's `clockA`,
`statusA`, `dots(n)`, `timerABg`. The clock is the engine's rule, written once (REQ-3.9).

**REQ-6.3 — The category, the bank bar, whose turn, which question**
The round's category's emoji and name; the active team's remaining time as a percentage of a full
bank, clamped to 0–100; the active team's name; and the question number — the question index plus
one, counting past the pool (reading 4).
*Why:* `roadmap.md` ("Category pill + time-bank bar"); H-07 ("الفئة الجارية … شريط التقدّم"); the
prototype's `catEmoji`, `catName`, `bankPct`, `activeName`, `qNumber`.

**REQ-6.4 — The hint: placeholder, shown, used up**
Until a hint of the current question is spent, the strip's text is the prototype's muted placeholder
— "لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا", or "ما فيه تلميحات لهذا السؤال" for a question
with no hints — and the view says no hint is spent. Once one is, the text is the most recent hint
spent. The view gives the hints left and the button's note: "−٢ ثانية · باقي N" while any are left,
else "انتهت التلميحات".
*Why:* `roadmap.md` ("muted placeholder copy until a hint is spent"); H-06 ("«تلميح» … يعرض التلميح
التالي فقط"); the prototype's `hintText`, `hintColor`, `hintAnim`, `hintBtnNote` and its four
`hintBtn*` keys, which all turn on the hints left.

**REQ-6.5 — The reveal and the judge's answer box**
While a reveal is up, the view carries its answer and fact (the engine's `reveal`); otherwise none.
Always: the judge's name (or "—" with no judge), the current question's answer, and its accepted
variants joined by "، " — or "لا توجد بدائل" when it has none.
*Why:* `roadmap.md` ("Reveal overlay … Judge-only answer box … answer + accepted variants"); H-05
("صندوق «للحكم فقط» يعرض الإجابة والبدائل المقبولة"); the prototype's `revealOn`, `revealAnswer`,
`revealFact`, `judgeName`, `answerText`, `altText`.

### 2.2 The screen (`apps/web/app/host/PlayScreen.tsx`, `play.module.css`)

**REQ-6.6 — The timer cards**
Two cards side by side, gap 8 px, each `flex: 1; min-width: 0`, radius 14 px, 2.5 px ink border,
padding `9px 11px`. The active card is filled with its team's colour — team A `--red`, team B
`--sky` — with white text and a `0 3px 0` shadow; the other is `--panel` with ink text and no
shadow. The first row holds the team's name (12.5 px / 800, one line, ellipsis) and its clock
(Archivo 22 px / 800, `.ltr-num`); the second, 3 px below, holds the dots (9 px, gap 4 px, `Dot`)
and the status (10.5 px / 700, `opacity .75`). Every value is Table A's.
*Why:* `roadmap.md`; `design/README.md` §4.1; H-07.

> **DECIDED 2026-10-03 (Ahmed, in the planning session): the timer card and the question card are
> built on the judge screen.** They are styled in `play.module.css`, as Phase 5 built its judge
> choice and room chips, and `@nel3ab/ui` does not change. `tech-specs.md` §2.3 lists a `TimerCard`
> among `@nel3ab/ui`'s primitives; **Phase 14**, which builds the player's compact version (Archivo
> 20 px, no dots, no shadow, one row — `design/README.md` §8), decides whether both versions move
> into the kit once both exist. The alternative considered and rejected was a `TimerCard` primitive
> now. **What it costs:** until Phase 14 the judge's card lives in `apps/web`, and the lift — if
> Phase 14 makes it — moves a measured component rather than designing one. It was chosen because
> the second version's shape is unknown until Phase 14 designs it, and building it in the kit now
> would edit Phase 2's export test and styleguide for a component with one user.

**REQ-6.7 — The category pill and the time-bank bar**
A row, gap 9 px: the pill — the category's emoji and name, gap 6 px, padding `7px 12px`, pill radius,
2.5 px ink border, `--panel`, 12.5 px / 700 — then the track, `flex: 1`, 10 px tall, pill radius,
2.5 px border, `--sunken`, clipping its fill. The fill is the active team's colour, as wide as the
view's percentage, its `width` transitioning over 100 ms linear.
*Why:* `roadmap.md` ("time-bank bar with `width` transitioning at `.1s linear`"); `design/README.md`
§4.2.

**REQ-6.8 — The question card and the hint strip**
A card with radius 24 px, a 3 px ink border, a `0 6px 0` shadow and `--panel` fill, clipping its
content. Its header strip is the active team's colour with white 12.5 px / 800 text: "دور <team>" (one
line, ellipsis) and "سؤال N" (`opacity .85`). Its body, padding `26px 20px`, at least 150 px tall,
centres the question at 24 px / 800, line-height 1.45, `text-wrap: pretty`. Its hint strip —
a 2.5 px top border, `--sunken`, padding `12px 16px`, at least 56 px tall, gap 9 px — holds 💡 at
18 px and the hint text at 14 px / 700, line-height 1.4: `--muted` until a hint of the question is
spent, then ink with the global `slidein` keyframe at 220 ms ease-out, reached through a custom
property.
*Why:* `roadmap.md` ("Question card … Hint reveal with `slidein` 220ms; muted placeholder copy until a
hint is spent"); `design/README.md` §4.3; Phase 5's carried finding (fact 6 of its §1.1).

> **DECIDED 2026-10-03 (Ahmed, in the planning session): only the first hint of a question slides
> in — the prototype's behaviour (§1.1, fact 3).** The hint text is one element for the life of the
> screen; its animation applies when the question's first hint is spent and is unchanged by the
> second, so the second hint appears without moving; a skip or a turn pass clears it, and the next
> question's first hint slides in again. The alternative considered and rejected was sliding in
> every hint (`design/README.md` calls `slidein` the animation for "new hint text"). **What it
> costs:** the second hint has no entrance, exactly as in the prototype; if a playtest (Phase 7)
> finds it missed, the change is one key on one element and a dated amendment to this triad.

**REQ-6.9 — The reveal overlay**
While the view carries a reveal, a `--leaf` panel covers the question card inside its border
(`position: absolute; inset: 0`, above the content), centring "الإجابة" (13 px / 800, tracked
`.1em`, `opacity .7`), the answer (30 px / 800, line-height 1.25) and the fact (13.5 px / 600,
`opacity .8`), gap 8 px, padding 22 px, text `--on-leaf`, entering with the global `pop` keyframe at
180 ms ease-out through a custom property. It exists only while the reveal is up, so every reveal
enters fresh; it goes when the driver's `passTurn` takes effect, 1000 ms of engine time after صحيح
(reading 3).
*Why:* `roadmap.md` ("Reveal overlay: leaf panel, `pop` 180ms, answer at 30px/800, auto-dismiss at
1000ms"); `design/README.md` §4.3; REQ-4.6.

**REQ-6.10 — The judge-only answer box**
A `--panel` box with a 3 px dashed `--red` border, radius 18 px, padding `12px 14px`. Its first row:
"للحكم فقط 👁" (11.5 px / 800, `--red`, tracked `.06em`) and the judge's name (11.5 px / 700,
`--muted`); then the answer (19 px / 800, line-height 1.3); then "يُقبل أيضاً: <variants>" (12 px /
600, `--muted`, 2 px below).
*Why:* `roadmap.md` ("Judge-only answer box: 3px dashed red border, answer + accepted variants");
`design/README.md` §4.4; H-05. `mission.md` §3: `/host` is the judge's client (reading 7).

**REQ-6.11 — The action row**
Three equal buttons, gap 9 px, each `@nel3ab/ui`'s action `Button`: تخطي ⏭ on `--panel` with
"−٣ ثوانٍ"; تلميح 💡 on `--yellow` with the view's note while hints are left; صحيح ✔ on `--leaf` with
"يمرّ الدور". When no hint is left, تلميح is disabled: `--panel`, `--muted` text, the design system's
disabled state, no press (reading 2). Each presses by the shared press — `0 5px 0` to `0 2px 0`,
3 px down. During the reveal all three keep their look (reading 1).
*Why:* `roadmap.md` ("Action row: تخطي / تلميح / صحيح with sub-labels, disabled states, press
behaviour"); `design/README.md` §4.5; H-06; REQ-2.8, REQ-2.10.

**REQ-6.12 — The UI glyphs draw in the system font**
The UI glyphs ⏭, 💡 (both the button's and the strip's), ✔ and 👁 each sit alone in a `.glyph` span
set to `system-ui, sans-serif`, nested inside a plain span where the glyph is a flex item (the
strip's 💡). The category's emoji is content, not a UI glyph, and is not wrapped — as Phase 5's
tiles. `apps/web/app/fonts.ts` is not changed.
*Why:* Phase 5's carried finding; `design/README.md` "Assets" (UI glyphs vs category emoji).

> **DECIDED 2026-10-03 (Ahmed, in the planning session): keep Phase 5's per-glyph rule.** Every UI
> glyph on the screen is wrapped, whether or not it is measured to differ: today none of the four
> differs (§1.1, fact 4), and the wrap makes the equality hold by construction rather than by
> Arial's coverage. The alternatives considered and rejected were changing the fallback once in
> `fonts.ts` — measured insufficient: `adjustFontFallback` cannot fix Phase 5's ▶, which the
> self-hosted Baloo draws itself, so it would also need a `unicode-range` on Baloo's `@font-face`,
> two changes to Phase 2's verified font setup, and the page would lose next/font's guard against
> text shifting while the fonts load — and wrapping only glyphs measured to differ (none here).
> **What it costs:** five spans on this screen, and the rule's cost again in Phase 7 (🏆 👑 ▶).

**REQ-6.13 — The play screen is shown on `play`, and its buttons reach the engine through the driver**
`HostApp.tsx` renders the play screen when the room is on `play`, with the header's round label
("جولة N — أول W جولات", Phase 5's) above it; on `roundEnd` and `match` it still renders Phase 5's
placeholder. تخطي, تلميح and صحيح dispatch `skip`, `hint` and `correct` through the driver's
`dispatch`; the engine decides whether each counts. No driver path is added, and no source file
names Phase 3's round primitive.
*Why:* `roadmap.md` ("Wire all three actions through the Phase 3–4 reducer"); REQ-5.12, REQ-5.13;
`mission.md` §5.2 (the screen never decides a rule).

### 2.3 Fidelity, the round, and the gate

**REQ-6.14 — The screen's words, labels and timings are read from the prototype at test time**
Every literal text of the prototype's play markup, every label its `renderVals` builds for play, the
costs its sub-labels state, and the durations of `pop`, `slidein` and the bar's transition are
extracted from `design/designs/Nel3ab - Arcade.dc.html` when the test runs — extractions Y1–Y4 of
[verification.md](verification.md) Gate 3 — and asserted equal to what the screen renders, what the
view computes, the engine's costs, and the stylesheet's declarations. Each extraction's match count
is asserted.
*Why:* as REQ-5.22: Arabic copy and timings are design decisions (`mission.md` §3, §5.3), and a typo
in a label or a 200 ms pop is a fidelity defect no other check catches.

**REQ-6.15 — The prototype's round, replayed in CI**
Under Vitest's fake timers, the scripted round of Table V, driven through `createLocalRoom` with the
random source `() => 0.5` and read through the play view, gives Table V's trace exactly at every one
of its points.
*Why:* §1.1, fact 7 measured it; this makes it a regression test. It is an ordinary check — it tests
this phase's code against a pre-registered trace — and REQ-6.16 measures the same thing in a real
browser.

**REQ-6.16 — 🚦 A full round is playable on one device**
On the production build, in one browser tab beside the prototype: (a) the scripted round of Table V,
driven on both pages by the same stepped clock and the same clicks, gives the prototype's trace on
the app, field for field; and (b) with the browser's own timers, a round played by clicks stays
within Table W's bounds — the clock runs at real speed, a hint costs exactly 2 s, a skip exactly 3 s
and moves to the next question, صحيح raises the reveal and the turn passes about a second later,
and the round ends when a clock runs out, with the right winner.
*Why:* the roadmap's exit criterion — "A full round is playable on one device — clock runs, hints
spend, skips advance, correct reveals and passes the turn." It compares the implementation with the
prototype and with real time, so it is a **verdict gate**: Gate 4 is where faults are found and
fixed; one that survives to the verdict is a fact about this phase, and returns to the owner.

**REQ-6.17 — 🚦 The play screen matches the prototype in both themes**
Measured in one browser tab beside the prototype by Procedure M6, every role of Tables A–E matches in
each of the five states S1–S5 — position and size within 0.5 px; border, radius, padding, shadow,
fill, text colour, type size, weight and line height, letter spacing, opacity and animation exactly —
at 480 and 375 px, in light and in dark; and the owner, looking at side-by-side screenshots, finds
no spacing, radius or shadow deviation.
*Why:* `mission.md` §5.3 and §7 ("Implemented screens match the prototypes on colour, radius, border,
shadow and timing"), and the roadmap's goal for this phase — "the single most important screen in
the product". It compares with an external reference, so it is a **verdict gate**, as REQ-5.24 was.

**REQ-6.18 — The four gate commands pass with no escape hatch**
`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass on a fresh
`pnpm install --frozen-lockfile`, on Windows and on Ubuntu CI, with none of Phase 3's REQ-3.13
escape hatches introduced anywhere.
*Why:* the phase gate (`CLAUDE.md`). Phase 6 adds no dependency (NFR-6.3), so this is an ordinary
gate: a failure is a defect in this phase's code.

---

## 3. Non-Functional Requirements

**NFR-6.1 — `design/` and `specs/` are not edited.** Tests may read `design/`; nothing writes to it
(`CLAUDE.md` invariant 5). `specs/` is read-only during implementation (invariant 6);
`verification.md` may only have boxes ticked and measured values recorded.

**NFR-6.2 — No package changes.** Nothing under `packages/` changes: `@nel3ab/game`'s 21 runtime
exports, its 100% coverage and every Phase 3–5 test; `@nel3ab/ui`'s five runtime exports, its
`exports` map and every Phase 2 and Phase 5 test. `git diff 77ed5a4 -- packages/` is empty at close.

**NFR-6.3 — No dependency, and no configuration change.** No manifest gains a dependency and
`pnpm-lock.yaml` does not change. `vitest.config.ts`, every `package.json`, every `tsconfig*.json`,
`apps/web/next.config.ts`, `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`,
`eslint.config.mjs`, `stylelint.config.mjs`, `prettier.config.mjs`, `.gitattributes`, `.gitignore`,
`.prettierignore` and `apps/web/app/{layout.tsx,globals.css,fonts.ts}` are untouched. If a change to
any of them appears necessary, that is the signal to stop.

**NFR-6.4 — Phase 5's work is kept.** Every Phase 5 test passes. Phase 5's files change in exactly
the places [specs.md](specs.md) §2.6 lists — `HostApp.tsx` (the routing of REQ-6.13) and
`host-source.test.ts` (three paths added to its scan list) — and nowhere else; `PendingScreen.tsx`,
the three setup and room-ready files, their stylesheets and every `_lib` module are unchanged.

**NFR-6.5 — The judge app sends nothing anywhere, and the answer stays on `/host`.** No source file
under `apps/web/app/host` contains `fetch(`, `WebSocket`, `EventSource`, `sendBeacon`,
`XMLHttpRequest` or `localStorage` (Phase 5's NFR-5.7 scan, extended to this phase's files). The
answer, its variants and the fact are rendered on `/host` only; nothing in this phase creates
another route, a payload, or a copy of the room outside the page (`mission.md` §3).

**NFR-6.6 — RTL is the starting point.** The new stylesheet passes Stylelint with no disable comment
— logical properties and `start` / `end` only. The prototype's physical `border-top` and
`margin-bottom` / `margin-top` are written `border-block-start`, `margin-block-end` and
`margin-block-start`; the clocks are `.ltr-num` (reading 9).

**NFR-6.7 — Every project still contributes a test, and the suite stays fast enough.** `pnpm test`
reports six projects (`CLAUDE.md` invariant 2). The `@nel3ab/game` project is untouched and keeps
NFR-5.6's 20 s budget; the `nel3ab-web` project's duration is recorded on Windows and on CI. Every
heavy pass carries an explicit `120_000` ceiling.

---

## 4. Explicit Non-Goals

An implementer that wants to do any of the following must **stop**, not proceed.

- **No round-end or match-end screen**, and no button on Phase 5's placeholder: no "الجولة التالية",
  no rematch, no back-to-setup from a match (Phase 7). `PendingScreen.tsx` is not edited.
- **No change to any package.** No `TimerCard`, question card or action-row primitive in
  `@nel3ab/ui` (REQ-6.6, DECIDED); no engine action, field, helper or export in `@nel3ab/game`; no
  driver change.
- **No change to the fonts.** `apps/web/app/fonts.ts` is untouched (REQ-6.12, DECIDED).
- **No real question content.** Nothing from the prototype's `qs`, `desc` or `chips` in any source
  file; the catalog stays Phase 5's (Phase 8).
- **No player screens, no player payload, no second route.** The play view is not adapted for a
  player (Phases 12, 14).
- **No server, no persistence, no wall-clock reading.** No fetch, no socket, no `localStorage`; the
  screen reads `Date`, `performance` and timers nowhere — the driver's loop is the only timer (Phases
  11, 16).
- **No configuration exposed.** The app plays 45 s and three wins (Phase 5).
- **No sound, no haptics, no confetti** — nothing the prototype does not do.
- **No accessibility pass beyond what the prototype does.** The buttons are named by their text; the
  reveal is not announced to screen readers. The audit is Phase 23's.
- **No dependency.** No DOM test environment, no testing library, no browser automation package. The
  screen is tested as rendered markup and as React elements, and measured in the desktop app's
  browser (specs.md §4, R2).

---

*Last updated: 2026-10-03*
*Author: Ahmed Alshehri (ahmed@tadawulcom.sa)*
