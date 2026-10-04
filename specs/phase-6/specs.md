# Phase 6 Technical Specification — Judge app: the play screen

> **Phase:** Phase 6
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** 1 day

---

## 1. Architecture Overview

Phase 6 touches one workspace project, `apps/web`, and inside it one folder, `app/host`. No package
changes (NFR-6.2), no dependency is added and no configuration changes (NFR-6.3).

```
                 ┌──────────────────────────── apps/web/app/host ─────────────────────────────┐
                 │                                                                            │
   browser ──▶   │  page.tsx ─▶ HostApp.tsx ── useSyncExternalStore ─┐                         │
   (/host)       │                 │                                 │                         │
                 │                 ├─ setup / ready  ─▶ SetupScreen, ReadyScreen (Phase 5)     │
                 │                 ├─ play           ─▶ PlayScreen  [NEW]  ◀── playView(state) │
                 │                 │                      │  onSkip / onHint / onCorrect       │
                 │                 │                      ▼                                     │
                 │                 │      room.dispatch({ type: 'skip' | 'hint' | 'correct' })  │
                 │                 └─ roundEnd / match ─▶ PendingScreen (Phase 5, unchanged)    │
                 │                                                                            │
                 │   _lib/driver.ts (Phase 5, unchanged) ─ reduce ─▶ @nel3ab/game (unchanged)  │
                 │      └─ on play: tick(100) then passTurn every 100 ms                         │
                 │   _lib/play-view.ts [NEW] — pure: RoomState + catalog ─▶ PlayView            │
                 │   @nel3ab/ui (unchanged): Button variant="action" · Dot · press              │
                 └────────────────────────────────────────────────────────────────────────────┘
```

The split is Phase 5's, which is the prototype's own: the engine and the driver are the behaviour,
`_lib/play-view.ts` is the bridge (`renderVals`), and `PlayScreen.tsx` is presentational — it takes a
view and three callbacks and computes nothing. `_lib/play-view.ts` is framework-free and runs under
Vitest in Node with no DOM; the screen is tested as static markup and as the React element tree its
function returns, which is what lets this phase add no test dependency.

**Dependency order is part of the design.** A runner walks it top to bottom; each step is buildable and
testable before the next begins.

```
  STEP 1 ─ The play view, and the prototype's round in CI            (apps/web/app/host/_lib)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ play-view.ts         [NEW]  playView, PlayView, TimerView            │
  │ play-view.test.ts    [NEW]  Table X                                  │
  │ play-round.test.ts   [NEW]  Table V under fake timers; the dispatch  │
  │                             log of the three judge actions           │
  │   ── pnpm vitest run apps/web: all green                             │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 2 ─ The screen, and the route ▼  needs STEP 1             (apps/web/app/host)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ PlayScreen.tsx · play.module.css     [NEW]                           │
  │ HostApp.tsx                          [MOD]  play ─▶ PlayScreen        │
  │ play-markup.test.tsx · play-routing.test.tsx   [NEW]                 │
  │ host-source.test.ts                  [MOD]  three paths (§2.6)        │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 3 ─ Read from the prototype   ▼  needs STEPS 1–2         (apps/web/app/host)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ play-prototype.test.ts   [NEW]  extractions Y1–Y4 (REQ-6.14)         │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 4 ─ Fidelity and the round in the browser ▼ (verification Gate 4 — fix freely)
                                   │
  STEP 5 ─ Mutations, the four gate commands ▼ (Gate 5)
                                   │
  STEP 6 ─ 🚦 The two verdicts ▼ (Gate 6 — once, on the commit Gate 5 passed at)
```

**Inside `apps/web/app/host`** the arrows run from the screens down, as in Phase 5: `PlayScreen.tsx`
imports `_lib/play-view.ts`'s types and nothing else from `_lib/`; `HostApp.tsx` is the only file
that calls `playView` and the driver; `_lib/` never imports React or a component.

---

## 2. Component Specifications

### 2.1 `apps/web/app/host/_lib/play-view.ts` [NEW]

**Implements:** REQ-6.1 – REQ-6.5

Pure; no React import; no `Date`, `performance`, timer or `Math.random` — `play-markup.test.tsx`
greps for them (§2.5). Imports only `@nel3ab/game` (`currentJudge`, `currentQuestion`,
`displaySeconds`, `remainingMs`, and types) and `./catalog`'s `CatalogEntry` type. The header comment
names the `renderVals` keys each field mirrors, as `view.ts`'s does.

```ts
/** One timer card — the prototype's teamAName, clockA, timerABg / timerAShadow, statusA, dotsA. */
export interface TimerView {
  readonly name: string
  readonly clock: number                 // whole seconds, as displayed
  readonly active: boolean
  readonly status: string                // 'دورهم الآن' | 'مجمّد' | 'بالانتظار'
  readonly dots: readonly boolean[]      // config.winsNeeded entries; true = a round won
}

/** Every value the play screen shows. */
export interface PlayView {
  readonly timers: { readonly a: TimerView; readonly b: TimerView }
  readonly activeTeam: Team              // activeColor
  readonly activeName: string            // activeName
  readonly catEmoji: string              // catEmoji
  readonly catName: string               // catName
  readonly bankPct: number               // bankPct, as a number in [0, 100]
  readonly qNumber: number               // qNumber
  readonly questionText: string          // questionText
  readonly hintText: string              // hintText
  readonly hintSpent: boolean            // hintColor / hintAnim
  readonly hintsLeft: number             // hintBtnBg / hintBtnFg / hintBtnOpacity / hintBtnCursor
  readonly hintBtnNote: string           // hintBtnNote
  readonly reveal: Reveal | null         // revealOn / revealAnswer / revealFact
  readonly judgeName: string             // judgeName
  readonly answerText: string            // answerText
  readonly altText: string               // altText
}

export function playView(state: RoomState, catalog: readonly CatalogEntry[]): PlayView
```

| Field | Value | The prototype's expression |
|---|---|---|
| `timers[t].name` | `t === 'a' ? state.teamA : state.teamB` | `s.teamA` / `s.teamB` |
| `timers[t].clock` | `displaySeconds(remainingMs(state.clock, t))` | `String(Math.ceil(s.a.time))` |
| `timers[t].active` | `state.clock.active === t` | `s.active === 'a' && live` |
| `timers[t].status` | `active ? 'دورهم الآن' : state.clock.banks[t].started ? 'مجمّد' : 'بالانتظار'` | `statusA` |
| `timers[t].dots` | `Array.from({ length: state.config.winsNeeded }, (_, i) => i < tally)`, `tally` = `tallyA` / `tallyB` | `dots(n)`: `i < n` |
| `activeTeam` | `state.clock.active` | `activeColor` |
| `activeName` | `timers[activeTeam].name` | `activeName` |
| `catEmoji`, `catName` | the catalog entry whose `id === state.categoryId` | `cat.emoji`, `cat.name` |
| `bankPct` | `Math.max(0, Math.min(100, remainingMs(state.clock, active) / (state.config.roundSeconds * 1000) * 100))` | `Math.max(0, Math.min(100, (act.time / this.roundTime) * 100))` |
| `qNumber` | `state.questionIndex + 1` | `s.qi + 1` |
| `questionText` | `question.q` | `q.q` |
| `hintSpent` | `state.hintIndex > 0` | `s.hintIdx > 0` |
| `hintText` | `question.h.slice(0, state.hintIndex).at(-1) ?? (question.h.length > 0 ? 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا' : 'ما فيه تلميحات لهذا السؤال')` | `hintText` |
| `hintsLeft` | `question.h.length - state.hintIndex` | `hints.length - s.hintIdx` |
| `hintBtnNote` | `hintsLeft > 0 ? \`−٢ ثانية · باقي ${hintsLeft}\` : 'انتهت التلميحات'` | `hintBtnNote` |
| `reveal` | `state.reveal` | `s.reveal` |
| `judgeName` | `currentJudge(state)?.name ?? '—'` | `judge ? judge.name : '—'` |
| `answerText` | `question.a` | `q.a` |
| `altText` | `question.alts.length > 0 ? question.alts.join('، ') : 'لا توجد بدائل'` | `q.alts && q.alts.length ? q.alts.join('، ') : 'لا توجد بدائل'` |

`question` is `currentQuestion(state)`. **Preconditions, thrown as `RangeError`** (no `!` anywhere):
`currentQuestion(state)` is `null` (an empty pool — never on `play`), or no catalog entry has
`state.categoryId` (a `null` id included). Both are unreachable from the driver on `play`; a test
reaches each with a hand-built state.

**Silent failure modes:**

- **Units in `bankPct`.** `remainingMs` is milliseconds and `roundSeconds` seconds; the engine writes
  the conversion once (`roundMs`, internal), so the view writes `roundSeconds * 1000` itself. Without
  the `* 1000` every value clamps to 100 and the bar never moves — Table X2 (95.5556 %) catches it.
- **The clock's rounding is the engine's.** `displaySeconds` rounds up and never shows −0; a
  `Math.round` or `Math.floor` here would show 44 for 44,100 ms (Table V2: 42 at 41,300 ms).
- **The hint is the most recent one spent**, `h[hintIndex − 1]`: `h[hintIndex]` is the next one,
  which would put the hint on the strip before it is paid for — an answer leak to the room.
- **`altText` is the prototype's conditional, not `join(…) || …`**: the two differ for a variant list
  holding one empty string; Y2 compares the prototype's expression.

### 2.2 `apps/web/app/host/PlayScreen.tsx` [NEW]

**Implements:** REQ-6.6 – REQ-6.12

A presentational component; no hooks, no state, no effect; nothing random, nothing timed.

```ts
export interface PlayScreenProps {
  readonly view: PlayView
  readonly onSkip: () => void
  readonly onHint: () => void
  readonly onCorrect: () => void
}
export function PlayScreen({ view, onSkip, onHint, onCorrect }: PlayScreenProps)
```

**The element tree mirrors the prototype's play block, element for element** (without the
prototype runtime's `<span>` around each `{{ }}` value, which Phase 5 measured to be layout-neutral).
Verification's Procedure M6 finds every role on both pages by the same structural path, so the
order and nesting below are part of the contract:

```
div                                      the screen root (no class of its own)
├─ div.timers
│  ├─ div.timer [data-team="a"] [data-active]
│  │  ├─ div.row
│  │  │  ├─ span.name                    {timers.a.name}
│  │  │  └─ span.clock.ltr-num           {timers.a.clock}
│  │  └─ div.row.row-2
│  │     ├─ div.dots                     <Dot size="sm" won={…} /> × winsNeeded
│  │     └─ span.status                  {timers.a.status}
│  └─ div.timer [data-team="b"] …        the same
├─ div.category-row
│  ├─ div.category                       <span>{catEmoji}</span><span>{catName}</span>
│  └─ div.track
│     └─ div.fill [data-team={activeTeam}] style={{ width: `${bankPct}%` }}
├─ div.question
│  ├─ div.question-head [data-team={activeTeam}]
│  │  ├─ span.turn                       دور {activeName}
│  │  └─ span.number                     سؤال {qNumber}
│  ├─ div.question-body
│  │  └─ div.question-text               {questionText}
│  ├─ div.hint-strip
│  │  ├─ span.bulb > span.glyph          💡
│  │  └─ div.hint-text [data-spent]      {hintText}
│  └─ div.reveal                         ONLY while view.reveal !== null
│     ├─ div.reveal-label                الإجابة
│     ├─ div.reveal-answer               {reveal.answer}
│     └─ div.reveal-fact                 {reveal.fact}
├─ div.answer-box
│  ├─ div.answer-head
│  │  ├─ span.judge-only                 للحكم فقط <span.glyph>👁</span>
│  │  └─ span.judge-name                 {judgeName}
│  ├─ div.answer                         {answerText}
│  └─ div.alts                           يُقبل أيضاً: {altText}
└─ div.actions
   ├─ <Button variant="action" className={action} subLabel="−٣ ثوانٍ" onClick={onSkip}>
   │     تخطي <span.glyph>⏭</span>
   ├─ <Button variant="action" className={action} data-tone={hintsLeft > 0 ? 'yellow' : undefined}
   │          disabled={hintsLeft === 0} subLabel={hintBtnNote} onClick={onHint}>
   │     تلميح <span.glyph>💡</span>
   └─ <Button variant="action" className={action} data-tone="leaf" subLabel="يمرّ الدور"
              onClick={onCorrect}>
         صحيح <span.glyph>✔</span>
```

- **The hint text is one element** for the life of the screen — no `key` that changes with the hint
  or the question — so its animation applies when `data-spent` turns true and is not restarted by
  the second hint (REQ-6.8, DECIDED). The reveal is rendered conditionally, so every reveal is a new
  element and `pop` runs each time (REQ-6.9).
- **The bulb is a flex item**, so its glyph sits inside a plain `span.bulb` (Phase 5's rule): the
  flex item keeps Baloo's box and the glyph its baseline. The four other glyphs are inline in a text
  run and need no wrapper of their own beyond `.glyph` (REQ-6.12, DECIDED).
- **`data-tone` and `disabled` are `Button`'s own API** (Phase 2): `data-tone` passes through
  `...rest`, and `disabled` sets both `disabled` and `aria-disabled="true"`, so base.css's disabled
  state applies and the press does not (reading 2). When `hintsLeft === 0` the hint Button carries
  no `data-tone`, so it is `--panel`.
- **The three Buttons call their callbacks and nothing else**; whether a press counts is the
  engine's (`acceptsJudgeActions`), so during the reveal a press reaches the engine and changes
  nothing (reading 1). `PlayScreen` does not read `acceptsJudgeActions`.
- The literal texts — "دور ", "سؤال ", 💡, "الإجابة", "للحكم فقط 👁", "يُقبل أيضاً: ", "تخطي ⏭",
  "−٣ ثوانٍ", "تلميح 💡", "صحيح ✔", "يمرّ الدور" — are written in this file, as the prototype writes
  them in its markup; the computed ones come from the view (Y1, Y2).

### 2.3 `apps/web/app/host/play.module.css` [NEW]

**Implements:** REQ-6.6 – REQ-6.12, NFR-6.6

Every value is the prototype's (verification Tables A–D), on `@nel3ab/ui`'s tokens where one exists.
Class names kebab-case (`selector-class-pattern`), read as `styles['hint-text']`. Every rule logical;
no `stylelint-disable`.

| Class | Declarations |
|---|---|
| `.timers` | `display: flex; gap: 8px; margin-block-end: 10px` |
| `.timer` | `flex: 1; min-width: 0; border: var(--bd) solid var(--stroke); border-radius: var(--r-input); background: var(--panel); color: var(--ink); padding: 9px 11px` |
| `.timer[data-active='true']` | `color: #fff; box-shadow: var(--sh-sel)` |
| `.timer[data-active='true'][data-team='a']` · `…[data-team='b']` | `background: var(--red)` · `background: var(--sky)` |
| `.row` | `display: flex; align-items: center; justify-content: space-between; gap: 6px` |
| `.row-2` | `margin-block-start: 3px` |
| `.name` | `font-size: 12.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| `.clock` | `font-size: 22px; font-weight: 800` — `.ltr-num` (global) supplies Archivo and the isolation |
| `.dots` | `display: flex; gap: 4px` |
| `.status` | `font-size: 10.5px; font-weight: 700; opacity: 0.75; white-space: nowrap` |
| `.category-row` | `display: flex; align-items: center; gap: 9px; margin-block-end: 10px` |
| `.category` | `flex: none; display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: var(--r-pill); border: var(--bd) solid var(--stroke); background: var(--panel); font-weight: 700; font-size: 12.5px; white-space: nowrap` |
| `.track` | `flex: 1; min-width: 0; height: 10px; border-radius: var(--r-pill); border: var(--bd) solid var(--stroke); background: var(--sunken); overflow: hidden` |
| `.fill` | `height: 100%; background: var(--red); transition: width 0.1s linear`; `[data-team='b']` → `background: var(--sky)` |
| `.question` | `position: relative; border-radius: var(--r-lg); border: var(--bd-thick) solid var(--stroke); box-shadow: var(--sh-cta); background: var(--panel); overflow: hidden; margin-block-end: 12px` |
| `.question-head` | `background: var(--red); color: #fff; padding: 8px 16px; font-size: 12.5px; font-weight: 800; display: flex; align-items: center; justify-content: space-between; gap: 8px`; `[data-team='b']` → `background: var(--sky)` |
| `.turn` | `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` |
| `.number` | `white-space: nowrap; opacity: 0.85` |
| `.question-body` | `padding: 26px 20px; min-height: 150px; display: flex; align-items: center; justify-content: center; text-align: center` |
| `.question-text` | `font-size: 24px; font-weight: 800; line-height: 1.45; text-wrap: pretty` |
| `.hint-strip` | `border-block-start: var(--bd) solid var(--stroke); background: var(--sunken); padding: 12px 16px; min-height: 56px; display: flex; align-items: center; gap: 9px` |
| `.bulb` | `flex: none; font-size: 18px` |
| `.hint-text` | `flex: 1; min-width: 0; font-size: 14px; font-weight: 700; color: var(--muted); line-height: 1.4` |
| `.hint-text[data-spent='true']` | `--slidein: slidein 0.22s ease-out; color: var(--ink); animation: var(--slidein)` |
| `.reveal` | `--pop: pop 0.18s ease-out; position: absolute; inset: 0; z-index: 5; background: var(--leaf); color: var(--on-leaf); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 22px; animation: var(--pop)` |
| `.reveal-label` | `font-size: 13px; font-weight: 800; letter-spacing: 0.1em; opacity: 0.7` |
| `.reveal-answer` | `font-size: 30px; font-weight: 800; line-height: 1.25` |
| `.reveal-fact` | `font-size: 13.5px; font-weight: 600; opacity: 0.8` |
| `.answer-box` | `background: var(--panel); border: var(--bd-thick) dashed var(--red); border-radius: var(--r-btn); padding: 12px 14px; margin-block-end: 12px` |
| `.answer-head` | `display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-block-end: 4px` |
| `.judge-only` | `font-size: 11.5px; font-weight: 800; color: var(--red); letter-spacing: 0.06em; white-space: nowrap` |
| `.judge-name` | `font-size: 11.5px; font-weight: 700; color: var(--muted); white-space: nowrap` |
| `.answer` | `font-size: 19px; font-weight: 800; line-height: 1.3` |
| `.alts` | `font-size: 12px; font-weight: 600; color: var(--muted); margin-block-start: 2px` |
| `.actions` | `display: flex; gap: 9px` |
| `.action` | `flex: 1` |
| `.actions .action[aria-disabled='true']` | `color: var(--muted)` — specificity 0,3,0, so it outranks `Button`'s `.button[data-variant='action']` (0,2,0) whatever order the two stylesheets load in (Phase 5's R5) |
| `.glyph` | `font-family: system-ui, sans-serif` (REQ-6.12) |

**`pop` and `slidein` are the global keyframes of `@nel3ab/ui`'s `base.css`, reached through a
custom property.** Never `animation: pop …` or `animation: slidein …` in this module — Next's CSS
Modules rewrite a name written in `animation` to a hashed local one that no keyframe defines, and
`global(…)` is rejected by Stylelint (Phase 5, fact 6 of its §1.1). Y4 reads this file and checks.

### 2.4 `apps/web/app/host/HostApp.tsx` [MODIFIED]

**Implements:** REQ-6.13

One branch added to the screen switch, before Phase 5's placeholder; nothing else in the component
changes:

```tsx
) : state.screen === 'play' ? (
  <PlayScreen
    view={playView(state, CATALOG)}
    onSkip={() => room.dispatch({ type: 'skip' })}
    onHint={() => room.dispatch({ type: 'hint' })}
    onCorrect={() => room.dispatch({ type: 'correct' })}
  />
) : (
  <PendingScreen state={state} />
)}
```

The header comment gains one paragraph: Phase 6's play screen, its three dispatches, and that
`PendingScreen` remains for `roundEnd` and `match` until Phase 7. The frame, the header's round
label and every Phase 5 callback are unchanged. No source file names Phase 3's round primitive —
Phase 5's `host-source.test.ts` greps every non-test source under `apps/web`, comments included.

### 2.5 `apps/web/app/host/` tests [NEW]

All run in Node under the web project's existing Vitest configuration, with no DOM — `_lib` is
framework-free, and the screen is tested as `renderToStaticMarkup` output (as Phase 5's
`host-markup.test.tsx`) and as the React element tree `PlayScreen(props)` returns. Each file defines
its own small markup helpers; none imports from another test file.

| File | Asserts | Gate |
|---|---|---|
| `_lib/play-view.test.ts` | every row of Table X; every field of `PlayView` named after its `renderVals` key; both `RangeError` preconditions | 1 |
| `_lib/play-round.test.ts` | Table V's script through `createLocalRoom({ random: () => 0.5, initial: <seed, opened> })` under Vitest's fake timers, read through `playView` at each of its 17 points, equal to Table V; through a recording reducer, the dispatch log of the script holds `startMatch` once, the judge's presses as exactly `{ type: 'hint' }`, `{ type: 'skip' }` and `{ type: 'correct' }`, the loop's `tick` / `passTurn`, and **0** `startRound` | 1 |
| `play-markup.test.tsx` | the static markup of `PlayScreen` for the views of S1–S5 (Table X1–X5): the texts in order, the tree of §2.2 (five children of the root; two cards; four children of the question card only with a reveal), `data-team` / `data-active` / `data-spent` / `data-tone`, `disabled` and `aria-disabled` on the hint Button only at 0 hints left, `data-won` on the dots, `.ltr-num` on both clocks, the fill's `style="width:…%"`, five `.glyph` spans, the reveal present exactly when the view has one; the element tree: the three action Buttons' `onClick` are `onSkip`, `onHint`, `onCorrect`, in that order; and a grep of `PlayScreen.tsx` and `_lib/play-view.ts` for `Date`, `performance`, `setTimeout`, `setInterval`, `Math.random` and `startRound` — **0** | 2 |
| `play-routing.test.tsx` | `HostApp` with `./_lib/driver` replaced by `vi.mock` (Vitest's own; no dependency) with a stub room: on `play` it renders `PlayScreen`'s markup for `playView(state, CATALOG)` under the header "جولة 1 — أول 3 جولات"; on `roundEnd` and `match`, `PendingScreen`'s; on `setup`, Phase 5's setup markup, unchanged | 2 |
| `play-prototype.test.ts` | extractions Y1–Y4 (REQ-6.14) | 3 |

Heavy passes — none is expected; Table V is 17 points — carry the explicit `120_000` ceiling if one
appears (`CLAUDE.md`, the fourth trap).

### 2.6 Phase 5's files — the sanctioned edits [MODIFIED]

**Implements:** NFR-6.4

These are the **only** changes to any file Phase 5 wrote. Every other byte of every Phase 5 source,
stylesheet and test file is unchanged — verification Gate 2 checks it with `git diff` against
`77ed5a4`.

| File | Edit |
|---|---|
| `HostApp.tsx` | §2.4's branch, its two imports (`PlayScreen`, `playView`), and the header comment's paragraph |
| `host-source.test.ts` | the `arrayContaining` list of the NFR-5.7 scan gains `'app/host/PlayScreen.tsx'`, `'app/host/play.module.css'` and `'app/host/_lib/play-view.ts'`, and the test's title gains "and Phase 6's play screen". Without it the scan would still cover the three files — it scans the folder — but nothing would prove it did (NFR-6.5) |

`PendingScreen.tsx` is **not** edited: it is still rendered on `roundEnd` and `match`, and its first
line ("Phase 6 replaces this on `play`") remains true. Phase 5's `host-markup.test.tsx` renders it
directly with a `play` state and stays green.

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `apps/web/app/host/_lib/play-view.ts` | NEW | REQ-6.1 – REQ-6.5 |
| `apps/web/app/host/PlayScreen.tsx` | NEW | REQ-6.6 – REQ-6.12 |
| `apps/web/app/host/play.module.css` | NEW | REQ-6.6 – REQ-6.12, NFR-6.6 |
| `apps/web/app/host/HostApp.tsx` | MODIFIED | REQ-6.13 — §2.4's branch only |
| `apps/web/app/host/host-source.test.ts` | MODIFIED | NFR-6.5 — §2.6's three paths only |
| `apps/web/app/host/_lib/{play-view,play-round}.test.ts` | NEW | Gate 1 |
| `apps/web/app/host/{play-markup,play-routing}.test.tsx` | NEW | Gate 2 |
| `apps/web/app/host/play-prototype.test.ts` | NEW | Gate 3 |
| `apps/web/app/host/PendingScreen.tsx` | UNTOUCHED — still the placeholder on `roundEnd` and `match` (Phase 7) | NFR-6.4 |
| `apps/web/app/host/{SetupScreen,ReadyScreen,page}.tsx`, `{host,setup,ready}.module.css`, every other file under `apps/web/app/host/_lib/`, every other Phase 5 test | UNTOUCHED — the driver already admits `hint`, `skip`, `correct`; the frame already sets the font and line height | NFR-6.4 |
| `packages/**` | UNTOUCHED — the engine and the UI kit already provide everything (requirements §1) | NFR-6.2 |
| `apps/web/app/{layout.tsx,globals.css,fonts.ts,page.tsx}`, `apps/web/app/styleguide/**`, `apps/web/*.test.ts`, `apps/web/{package.json,tsconfig.json,next.config.ts}` | UNTOUCHED — `fonts.ts` by REQ-6.12's decision | NFR-6.3 |
| `vitest.config.ts`, root `package.json`, `pnpm-lock.yaml`, every `tsconfig*.json`, `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`, `eslint.config.mjs`, `stylelint.config.mjs`, `prettier.config.mjs`, `.gitattributes`, `.gitignore`, `.prettierignore` | UNTOUCHED | NFR-6.3 |
| `design/**`, `specs/**` (except ticking `verification.md`) | UNTOUCHED | NFR-6.1 |

---

## 4. Known Risks in This Phase

**R1 — A deviation the tables do not name.** Tables A–E name the roles a designer would look at; a
wrapper's padding or a line box left out can differ and pass every row. *Revealed by:* partly — the
verdict compares the two columns' heights in every state (a vertical deviation anywhere moves it),
and the owner looks at side-by-side screenshots. A horizontal deviation inside an untabled box is
caught only by the look. *Fallback:* none in the verdict; it halts and returns to the owner.

**R2 — Nothing clicks in CI.** The element-tree test proves each Button calls its own callback, and
`play-round.test.ts` proves the driver hands each action to the engine; nothing in CI proves that
`HostApp` passes `onSkip` a `skip` rather than a `hint`. *Revealed by:* Gate 4's browser pass and
REQ-6.16's verdict, which press every button and read the clock. Recorded in verification §9.

**R3 — Staged text.** The browser comparisons copy the prototype's texts onto the app (reading 8).
A difference that exists only for the app's own placeholder texts — none is expected, since the CSS
is the same — would not be seen. *Revealed by:* Gate 4's real-time round, which runs on the app's own
texts, and the owner's look.

**R4 — The stepped clock is not the real one.** REQ-6.16 (a) replaces `setInterval` with a stepper on
both pages, so it proves the screens follow the rules tick for tick, not that the loop runs in real
time. *Revealed by:* REQ-6.16 (b), Table W, with the browser's own timers. A fault that appears only
under real timer jitter and stays inside Table W's tolerances would not be seen.

**R5 — The raster.** The built-in browser's raster changes with the pane's fit-scaling and after a
screenshot (requirements §1.1, fact 2). *Revealed by:* Procedure M6's parity probe on both pages of
every configuration; a mismatch voids that configuration's comparison — an instrument fault, decided
here, not a result.

**R6 — A hidden pane throttles timers.** A background or hidden browser pane runs `setInterval` at
reduced frequency, which would make the real clock run slow. *Revealed by:* Table W records
`document.visibilityState` at the start and the end of the real-time round; a run that was not
`visible` throughout is void (an instrument fault, as R5), not failed.

**R7 — A CSS Module and the cascade.** The two traps Phase 5 measured apply: a keyframe named in
`animation` inside a module (Y4 checks this file), and a screen class losing to a primitive's
`[data-variant]` selector (the exhausted hint's colour is written at 0,3,0, §2.3). *Revealed by:*
Gate 4's computed-style rows.

**R8 — The second hint.** React may re-create the hint element if a `key` or a conditional wrapper is
introduced around it, which would replay `slidein` on every hint — the behaviour the owner decided
against. *Revealed by:* Gate 4's animation box (no animation running after the second تلميح). No CI
test can see a running animation.

---

*Last updated: 2026-10-03*
