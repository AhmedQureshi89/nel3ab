# Phase 6 Verification & Test Plan — Judge app: the play screen

> **Phase:** Phase 6
> **Parent Requirements:** [requirements.md](requirements.md)
> **Parent Specification:** [specs.md](specs.md)

---

## Notation

| Marker | Meaning | On failure |
|---|---|---|
| `- [ ]` | ordinary check — tests *our code* | fix and retry freely |
| `- [ ] 👁` | ordinary check performed in a browser, by the owner or by Claude at the owner's direction — recorded as which | fix and retry freely |
| `- [ ] 🚦 **(VERDICT GATE — no retry)**` | measures *reality* | **halt.** Record the result. Never retry into green |

A verdict gate's failure is a finding, not a bug. `/spec-next` and `/spec-run` are required to stop at
one. If a check's kind is unclear, it is a verdict gate.

**Gate ordering.** **Gate 1** (the play view and the round in CI) blocks Gates 2–6. **Gate 2** (the
screen, the route, the sanctioned edits) needs Gate 1 and blocks Gates 3–6. **Gate 3** (read from the
prototype) needs Gates 1–2. Each box in Gates 1–3 is ticked as soon as the code it exercises exists.
**Gate 4** is the browser pass in which deviations from the prototype and faults in the round are
found and fixed; it needs Gates 1–3. **Gate 5** is evaluated once, over the finished phase. **Gate
6** is evaluated last, once, **on the commit at which Gate 5 passed** — no code changes after it —
and both of its 🚦 verdicts are measured in one session, on one production build.

**Who performs Gates 4 and 6 — DECIDED 2026-10-03 (Ahmed, in the planning session).** Both need a
browser beside the prototype. Claude performs Gate 4 and Gate 6's two 🚦 boxes at the owner's
direction, in the Claude desktop app's built-in Chromium browser, as Phase 5's Gates 5 and 7 were;
**the owner performs Gate 6's 👁 look** at the eight screenshot pairs. Each box records who performed
it. A subagent with no browser tools cannot tick them; an autonomous run halts before Gate 4 and the
session that owns the browser resumes it.

**A tick with an empty `Measured:` line is not a tick.**

---

## Pre-registered values

Measured on 2026-10-03, before any code existed, by Claude (`claude-opus-5-5`) in the planning
session. The prototype was served read-only (`python -m http.server 8765 --bind 127.0.0.1` from
`design/designs/`) and measured in the desktop app's built-in Chromium by Procedure M6 below, with
Baloo Bhaijaan 2 (500/600/700/800) and Archivo (800) loaded from Google Fonts. **Raster: a true 2.**
At emulated viewports of 480 × 800 and 375 × 800, `devicePixelRatio` was 2, a 3 px border painted
**3 px** and a 2.5 px border **2 px**; the tables give painted values. (At 480 × 1100 the pane
scaled the viewport down to fit and rasterised at an effective 1.5 — a 3 px border painted 2.667 px —
which is why the tables use 800 px heights; requirements §1.1, fact 2.) A fresh load reproduced every
role and property of all five states at 480 × 800 light with **0** differences. **No table in this
section may be edited to match a result.**

The five states, reached in this order on both pages (Procedure M6, step 4):

| State | Reached by | What it shows |
|---|---|---|
| **S1** | "ابدأ اللعبة", "ابدأ الجولة الأولى" | round 1, team A's turn, both clocks 45, question 1, no hint spent |
| **S2** | تلميح | A 43, the first hint in ink, "−٢ ثانية · باقي 1" |
| **S3** | تلميح | A 41, the second hint, تلميح disabled, "انتهت التلميحات" |
| **S4** | صحيح | the reveal up over the question card |
| **S5** | the turn passes (prototype: its held reveal timeout called; app: 10 held loop steps) | team B's turn at 45, A "مجمّد" at 41, question 2 |

### Procedure M6 — how both pages are measured (Gates 4 and 6)

1. **Serve.** The prototype as above. The app as a production build: `pnpm build`, then
   `pnpm --filter nel3ab-web start` (port 3000), `/host`.
2. **One tab, a fresh load per page.** Each configuration — 480 × 800 or 375 × 800, light or dark —
   is set (viewport emulation; `prefers-color-scheme` emulation for the app, the prototype's own
   "ليلي" button for its dark) **before** each page is loaded, and both pages are measured in the
   same tab, **the prototype first**. No screenshot is taken inside a configuration's comparison.
3. **Instrument checks, on each page after load:** `document.fonts.ready` awaited, and on the
   prototype Baloo Bhaijaan 2 at 500/600/700/800 and Archivo at 800 `loaded`; `innerWidth` is the
   configuration's width; the **raster probe** — a `<div>` with `border: 3px solid red` appended to
   `body`, its computed `border-top-width` recorded, the `<div>` removed. The two pages' probes must
   be equal; if they are not, the configuration's comparison is **void** (an instrument fault —
   specs.md §4, R5), recorded, and the configuration re-measured from its first load.
4. **Stage.** Before pressing anything, install the stepper below (every `setInterval` callback is
   held, never run by the browser; `Math.random` returns 0.5, so both pages draw أمثال and the
   prototype keeps its questions in order). Then: "ابدأ اللعبة", "ابدأ الجولة الأولى" → **S1**;
   تلميح → **S2**; تلميح → **S3**; صحيح → **S4** — on the prototype with `setTimeout` replaced for
   the duration of the click only, its callback held; **S5** — on the prototype the held callback is
   called, on the app `step(10)`. Each press is `element.click()` on the page's own button, followed
   by a 30 ms wait before measuring.
5. **The app's texts.** On the app only, before measuring each state, the `textContent` of these roles
   is set to the prototype's for the same state, as recorded in step 4: `qtext`, `hintText`,
   `answer`, `alts`, and on S4 `revealAnswer` and `revealFact` (requirements, reading 8). Nothing
   else is staged: team names, the judge, the category, the clocks, the numbers and every label are
   the app's own.
6. **Animations.** `document.getAnimations().forEach(a => a.finish())` before measuring, so the hint's
   `slidein`, the reveal's `pop` and the bar's width transition are at their end state; their
   computed `animation-*` / `transition-*` values are compared as properties.
7. **Measure** both pages with the functions below, verbatim. Roles are found by the same structural
   path on both pages (specs.md §2.2); the prototype runtime's `<span>` wrappers sit inside roles
   and are not roles.
8. **Compare** every role of each state: x, y, w, h within **0.5 px**; every other field
   **exactly**, after mapping the app's font-family names (`baloo` → `Baloo Bhaijaan 2`,
   `archivo` → `Archivo`) as the function does. The `column` role's `h` is the column height.

```js
// Step 4 — the stepper. Every interval's callback is held; step(n) calls each held callback n times.
const installStepper = () => {
  const held = new Map(); let next = 1000
  window.setInterval = (fn, ms) => { const h = ++next; held.set(h, fn); return h }
  window.clearInterval = (h) => { held.delete(h) }
  window.step = (n = 1) => { for (let i = 0; i < n; i++) for (const fn of [...held.values()]) fn() }
  Math.random = () => 0.5
}

// Step 7 — the roles, by one structural path on both pages.
const roles = () => {
  const col = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).maxWidth === '440px')
  const play = col.children[1]
  const [timers, catRow, qcard, abox, actions] = play.children
  const card = (c) => ({ card: c, name: c.children[0].children[0], clock: c.children[0].children[1],
    dots: c.children[1].children[0], dot1: c.children[1].children[0].children[0], status: c.children[1].children[1] })
  const A = card(timers.children[0]), B = card(timers.children[1])
  const [skip, hint, correct] = actions.children
  const r = { column: col, header: col.children[0], roundLabel: col.children[0].children[1], play, timers,
    cardA: A.card, nameA: A.name, clockA: A.clock, dotsA: A.dots, dotA1: A.dot1, statusA: A.status,
    cardB: B.card, nameB: B.name, clockB: B.clock, dotsB: B.dots, dotB1: B.dot1, statusB: B.status,
    catRow, pill: catRow.children[0], pillEmoji: catRow.children[0].children[0],
    pillName: catRow.children[0].children[1], track: catRow.children[1], fill: catRow.children[1].children[0],
    qcard, qhead: qcard.children[0], turnLabel: qcard.children[0].children[0], qnum: qcard.children[0].children[1],
    qbody: qcard.children[1], qtext: qcard.children[1].children[0], hintStrip: qcard.children[2],
    bulb: qcard.children[2].children[0], hintText: qcard.children[2].children[1],
    abox, aboxRow: abox.children[0], aboxLabel: abox.children[0].children[0],
    aboxJudge: abox.children[0].children[1], answer: abox.children[1], alts: abox.children[2],
    actions, skip, skipSub: skip.lastElementChild, hint, hintSub: hint.lastElementChild,
    correct, correctSub: correct.lastElementChild }
  if (qcard.children[3]) {
    const ov = qcard.children[3]
    Object.assign(r, { reveal: ov, revealLabel: ov.children[0], revealAnswer: ov.children[1], revealFact: ov.children[2] })
  }
  return r
}

const FAMILY = { baloo: 'Baloo Bhaijaan 2', archivo: 'Archivo' }
const props = (el, col) => {
  const cs = getComputedStyle(el), b = el.getBoundingClientRect(), cr = col.getBoundingClientRect()
  const family = cs.fontFamily.split(',')[0].replace(/"/g, '').trim()
  return { x: +(cr.right - b.right).toFixed(2), y: +(b.top - cr.top).toFixed(2),
    w: +b.width.toFixed(2), h: +b.height.toFixed(2), text: el.textContent.replace(/\s+/g, ''),
    font: cs.fontSize + '/' + cs.fontWeight, family: FAMILY[family] ?? family, lh: cs.lineHeight,
    ls: cs.letterSpacing, pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
    bd: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, rad: cs.borderTopLeftRadius,
    bg: cs.backgroundColor, color: cs.color, sh: cs.boxShadow, op: cs.opacity, gap: cs.gap,
    anim: cs.animationName === 'none' ? 'none' : `${cs.animationName} ${cs.animationDuration} ${cs.animationTimingFunction}`,
    trans: cs.transitionDuration === '0s' ? '' : `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`,
    wrap: cs.textWrapStyle || cs.textWrap, ws: cs.whiteSpace, cursor: cs.cursor, ta: cs.textAlign,
    minH: cs.minHeight, ov: cs.overflow, tov: cs.textOverflow, pos: cs.position, z: cs.zIndex }
}

const measure = () => {
  document.getAnimations().forEach((a) => { try { a.finish() } catch {} })
  const r = roles(), out = {}
  for (const [k, el] of Object.entries(r)) out[k] = props(el, r.column)
  return out
}

// Table E — the UI glyphs' own boxes, by a Range over the text node that holds each.
const glyphs = () => {
  const col = roles().column, cr = col.getBoundingClientRect(), out = {}
  const walker = document.createTreeWalker(col, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode()); ) for (const ch of ['⏭', '💡', '✔', '👁']) {
    const i = n.textContent.indexOf(ch); if (i < 0) continue
    const range = document.createRange(); range.setStart(n, i); range.setEnd(n, i + ch.length)
    const b = range.getBoundingClientRect(), key = out[ch] ? ch + '2' : ch
    out[key] = [+(cr.right - b.right).toFixed(2), +(b.top - cr.top).toFixed(2), +b.width.toFixed(2), +b.height.toFixed(2)]
  }
  return out
}
```

### Table A — S1, 480 × 800, light (column 440 px)

The seed room (five players, ماجد judging), round 1, أمثال, team A's turn, the prototype's first
أمثال question (one line at this width). Colours: ink `rgb(36, 28, 23)`; muted `rgb(138, 122, 106)`;
panel `rgb(255, 250, 240)`; sunken `rgb(240, 226, 200)`; red `rgb(236, 48, 19)`; yellow
`rgb(255, 201, 60)`; leaf `rgb(61, 190, 110)`; on-leaf `rgb(13, 43, 27)`. Every border and shadow
not otherwise named is ink. Family is Baloo Bhaijaan 2 unless named; `line-height` normal unless
named.

| # | Role | x | y | w | h | Other properties |
|---|---|---|---|---|---|---|
| A1 | column | 0 | 0 | 440 | **638.69** | — |
| A2 | header row | 0 | 0 | 440 | 33 | — |
| A3 | round label "جولة 1 — أول 3 جولات" | 335.52 | 6 | 104.48 | 21 | 12px/700; muted; nowrap |
| A4 | screen root | 0 | 47 | 440 | 591.69 | — |
| A5 | timers row | 0 | 47 | 440 | 67 | gap 8px |
| A6 | card A (active) | 0 | 47 | 216 | 67 | padding 9px 11px; border 2px solid; radius 14px; bg red; color rgb(255, 255, 255); shadow rgb(36, 28, 23) 0px 3px 0px 0px |
| A7 | name A "النمور" | 13 | 59 | 31.69 | 22 | 12.5px/800; nowrap; overflow hidden; text-overflow ellipsis |
| A8 | clock A "45" | 175.47 | 58 | 27.53 | 24 | **Archivo** 22px/800 |
| A9 | dots A | 13 | 89.5 | 35 | 9 | gap 4px; first dot 9 × 9, border 2px solid, radius 50%, bg sunken |
| A10 | status A "دورهم الآن" | 156.02 | 85 | 46.98 | 18 | 10.5px/700; opacity 0.75; nowrap |
| A11 | card B | 224 | 47 | 216 | 67 | as A6 but bg panel, color ink, shadow none |
| A12 | name B "الصقور" | 237 | 59 | 37.25 | 22 | as A7 |
| A13 | clock B "45" | 399.47 | 58 | 27.53 | 24 | Archivo 22px/800 |
| A14 | dots B | 237 | 89.5 | 35 | 9 | as A9 |
| A15 | status B "بالانتظار" | 393 | 85 | 34 | 18 | as A10 |
| A16 | category row | 0 | 124 | 440 | 40 | gap 9px |
| A17 | category pill | 0 | 124 | 78.3 | 40 | 12.5px/700; padding 7px 12px; border 2px solid; radius 999px; bg panel; gap 6px; nowrap |
| A18 | its emoji 💬 · its name "أمثال" | 14 · 37.17 | 133 | 17.17 · 27.13 | 22 | 12.5px/700 |
| A19 | track | 87.3 | 139 | 352.7 | 10 | border 2px solid; radius 999px; bg sunken; overflow hidden |
| A20 | fill | 89.3 | 141 | 348.7 | 6 | bg red; transition **width 0.1s linear** |
| A21 | question card | 0 | 174 | 440 | 250 | border **3px** solid; radius 24px; bg panel; shadow rgb(36, 28, 23) 0px 6px 0px 0px; overflow hidden; position relative |
| A22 | header strip | 3 | 177 | 434 | 38 | 12.5px/800; padding 8px 16px; bg red; color rgb(255, 255, 255); gap 8px |
| A23 | "دور النمور" | 19 | 185 | 52.88 | 22 | nowrap; overflow hidden; text-overflow ellipsis |
| A24 | "سؤال 1" | 384.58 | 185 | 36.42 | 22 | opacity 0.85; nowrap |
| A25 | body | 3 | 215 | 434 | 150 | padding 26px 20px; min-height 150px; text-align center |
| A26 | question text | 43.53 | 272.59 | 352.92 | 34.8 | 24px/800; line-height 34.8px; text-wrap **pretty**; text-align center; one line |
| A27 | hint strip | 3 | 365 | 434 | 56 | padding 12px 16px; border-top 2px solid; bg sunken; gap 9px; min-height 56px |
| A28 | bulb 💡 | 19 | 379 | 24.72 | 30 | 18px/400 |
| A29 | hint text (placeholder) | 52.72 | 384.2 | 368.28 | 19.59 | 14px/700; line-height 19.6px; color muted; animation none |
| A30 | answer box | 0 | 436 | 440 | 100.69 | padding 12px 14px; border **3px dashed** red; radius 18px; bg panel |
| A31 | its head row | 17 | 451 | 406 | 19 | gap 8px |
| A32 | "للحكم فقط 👁" | 17 | 451 | 66.77 | 19 | 11.5px/800; letter-spacing **0.69px**; color red; nowrap |
| A33 | judge "ماجد" | 398.86 | 451 | 24.14 | 19 | 11.5px/700; muted; nowrap |
| A34 | answer | 17 | 474 | 406 | 24.69 | 19px/800; line-height 24.7px |
| A35 | variants line | 17 | 500.69 | 406 | 21 | 12px/600; muted |
| A36 | action row | 0 | 548.69 | 440 | 90 | gap 9px |
| A37 | تخطي | 0 | 548.69 | 140.66 | 90 | 15.5px/800; padding 15px 8px; border 3px solid; radius 18px; bg panel; color ink; shadow rgb(36, 28, 23) 0px 5px 0px 0px; nowrap; cursor pointer; text-align center |
| A38 | its sub-label "−٣ ثوانٍ" | 52.77 | 598.69 | 35.14 | 19 | 11px/700; opacity 0.6 |
| A39 | تلميح | 149.66 | 548.69 | 140.67 | 90 | as A37 but bg yellow, color ink |
| A40 | its sub-label "−٢ ثانية · باقي 2" | 188.36 | 598.69 | 63.28 | 19 | as A38 |
| A41 | صحيح | 299.33 | 548.69 | 140.67 | 90 | as A37 but bg leaf, color on-leaf |
| A42 | its sub-label "يمرّ الدور" | 349.64 | 598.69 | 40.05 | 19 | as A38, color on-leaf |

### Table B — S2–S5, 480 × 800, light: what changes from S1

Every role a state does not name is as in the state before it — S2 from S1 (Table A), S3 from S2,
S4 from S3, S5 from S4. The column stays **638.69** in every state.

> **Correction 2026-10-11 — made before any box that reads this table was evaluated, decided by the
> owner (Ahmed, in session: "yes, make the correction and continue the run").** As first written,
> this line read "Every role not named here is as in Table A." The table is cumulative, and the
> planning session's measurements were taken state after state on one load: read literally, the
> first wording would put clock A back at Table A's 45 on S4 (it is S3's 41) and S4's hint text back
> at Table A's placeholder (it is S3's spent hint, under the reveal). The line is corrected to say
> what the rows were measured as. **No measured value in any table changes.** Found by the subagent
> building specs.md §1's STEP 2 and recorded in the halt note of commit `7e9e347`, which this
> correction clears.

| State | Role | x | y | w | h | Other properties |
|---|---|---|---|---|---|---|
| S2 | clock A | 175.47 | 58 | 27.53 | 24 | "43" |
| S2 | fill | 89.3 | 141 | **333.2** | 6 | — |
| S2 | hint text | 52.72 | 384.2 | 368.28 | 19.59 | color **ink**; animation **slidein 0.22s ease-out**; the question's first hint |
| S2 | تلميح's sub-label | 189.09 | 598.69 | 61.8 | 19 | "−٢ ثانية · باقي 1" |
| S3 | clock A | 175.47 | 58 | 27.53 | 24 | "41" |
| S3 | fill | 89.3 | 141 | **317.7** | 6 | — |
| S3 | hint text | 52.72 | 384.2 | 368.28 | 19.59 | ink; animation slidein 0.22s ease-out (computed — no animation runs on this hint; Gate 4); the second hint |
| S3 | تلميح | 149.66 | 548.69 | 140.67 | 90 | bg **panel**; color **muted**; opacity **0.45**; cursor **not-allowed**; shadow 0px 5px 0px kept |
| S3 | تلميح's sub-label | 183.8 | 598.69 | 72.41 | 19 | "انتهت التلميحات"; color muted; opacity 0.6 |
| S4 | reveal | 3 | 177 | 434 | 244 | position absolute; z-index 5; padding 22px; bg **leaf**; color on-leaf; gap 8px; text-align center; animation **pop 0.18s ease-out** |
| S4 | "الإجابة" | 202.8 | 249.25 | 34.39 | 22 | 13px/800; letter-spacing **1.3px**; opacity 0.7 |
| S4 | answer | 197.66 | 279.25 | 44.67 | 37.5 | **30px/800**; line-height 37.5px |
| S4 | fact | 143.44 | 324.75 | 153.11 | 24 | 13.5px/600; opacity 0.8 |
| S5 | card A | 0 | 47 | 216 | 67 | bg panel; color ink; shadow none |
| S5 | status A | 177 | 85 | 26 | 18 | "مجمّد" |
| S5 | card B | 224 | 47 | 216 | 67 | bg **rgb(47, 163, 232)**; color rgb(255, 255, 255); shadow rgb(36, 28, 23) 0px 3px 0px 0px |
| S5 | status B | 380.02 | 85 | 46.98 | 18 | "دورهم الآن" |
| S5 | clock A · clock B | 175.47 · 399.47 | 58 | 27.53 | 24 | "41" · "45" |
| S5 | fill | 89.3 | 141 | 348.7 | 6 | bg rgb(47, 163, 232) |
| S5 | header strip | 3 | 177 | 434 | 38 | bg rgb(47, 163, 232) |
| S5 | "دور الصقور" · "سؤال 2" | 19 · 382.97 | 185 | 58.44 · 38.03 | 22 | — |
| S5 | question text | **23** | **255.2** | **394** | **69.59** | the prototype's second أمثال question: **two lines** |
| S5 | hint text | 52.72 | 384.2 | 368.28 | 19.59 | placeholder; muted; animation none |
| S5 | تلميح · its sub-label | 149.66 · 188.36 | 548.69 · 598.69 | 140.67 · 63.28 | 90 · 19 | as S1 — yellow, "−٢ ثانية · باقي 2" |

### Table C — 375 × 800, light (column 347 px)

| State | Role | x | y | w | h |
|---|---|---|---|---|---|
| S1 | column | 0 | 0 | 347 | **638.69** |
| S1 | card A · card B | 0 · 177.5 | 47 | 169.5 | 67 |
| S1 | clock A · status A | 128.97 · 109.52 | 58 · 85 | 27.53 · 46.98 | 24 · 18 |
| S1 | clock B · status B | 306.47 · 300 | 58 · 85 | 27.53 · 34 | 24 · 18 |
| S1 | category pill · track · fill | 0 · 87.3 · 89.3 | 124 · 139 · 141 | 78.3 · 259.7 · 255.7 | 40 · 10 · 6 |
| S1 | question card · header strip · body | 0 · 3 · 3 | 174 · 177 · 215 | 347 · 341 · 341 | 250 · 38 · 150 |
| S1 | "سؤال 1" | 291.58 | 185 | 36.42 | 22 |
| S1 | question text (**two lines** at this width) | 23 | 255.2 | 301 | 69.59 |
| S1 | hint strip · hint text | 3 · 52.72 | 365 · 384.2 | 341 · 275.28 | 56 · 19.59 |
| S1 | answer box · judge · answer · variants | 0 · 305.86 · 17 · 17 | 436 · 451 · 474 · 500.69 | 347 · 24.14 · 313 · 313 | 100.69 · 19 · 24.69 · 21 |
| S1 | action row · تخطي · تلميح · صحيح | 0 · 0 · 118.66 · 237.33 | 548.69 | 347 · 109.66 · 109.67 · 109.67 | 90 |
| S1 | sub-labels: تخطي · تلميح · صحيح | 37.27 · 141.86 · 272.14 | 598.69 | 35.14 · 63.28 · 40.05 | 19 |
| S3 | fill · تلميح's sub-label | 89.3 · 137.3 | 141 · 598.69 | 232.97 · 72.41 | 6 · 19 |
| S4 | reveal · "الإجابة" · answer · fact | 3 · 156.3 · 151.16 · 96.94 | 177 · 249.25 · 279.25 · 324.75 | 341 · 34.39 · 44.67 · 153.11 | 244 · 22 · 37.5 · 24 |
| S5 | status A · status B | 130.5 · 287.02 | 85 | 26 · 46.98 | 18 |
| S5 | "سؤال 2" · question text | 289.97 · 23 | 185 · 255.2 | 38.03 · 301 | 22 · 69.59 |

Every property other than geometry is as at 480 px: **0** differences in any non-geometric field
between the two widths, in either theme.

### Table D — dark

**Geometry is identical to light** at both widths: 0 of the five states' roles move or resize.
Colours, as the prototype computes them:

| Light | Dark | Where |
|---|---|---|
| rgb(36, 28, 23) — ink borders and shadows | **rgb(13, 12, 19)** | every border and shadow but the answer box's |
| rgb(255, 250, 240) — `--panel` | **rgb(39, 36, 51)** | the inactive card, the pill, the question card, the answer box, تخطي, the spent تلميح |
| rgb(240, 226, 200) — `--sunken` | **rgb(23, 21, 33)** | unwon dots, the track, the hint strip |
| rgb(36, 28, 23) — ink text | **rgb(255, 243, 223)** | text on panel, sunken and page — **except** text on yellow (تلميح and its sub-label while hints remain), which stays rgb(36, 28, 23) |
| rgb(138, 122, 106) — `--muted` | **rgb(167, 155, 181)** | the round label, the hint placeholder, the judge's name, the variants line, the spent تلميح's text and sub-label |
| rgb(236, 48, 19) — `--red` | **rgb(255, 90, 60)** | team A's active card, fill and header strip; the answer box's dashed border and its "للحكم فقط 👁" |
| page ground rgb(255, 243, 223) | **rgb(28, 26, 37)** | the frame |
| yellow rgb(255, 201, 60), sky rgb(47, 163, 232), leaf rgb(61, 190, 110), on-leaf rgb(13, 43, 27), white text | unchanged | تلميح, team B's card / fill / strip, صحيح and the reveal, their text, the active card's and the strip's text |

### Table E — the UI glyphs' boxes, S1, 480 × 800, light

Measured by `glyphs()` (a `Range` over each glyph's text node).

| Glyph | x | y | w | h |
|---|---|---|---|---|
| ⏭ (تخطي) | 84.25 | 566.69 | 12.75 | 27 |
| 💡 (تلميح) | 228.72 | 566.69 | 21.3 | 27 |
| ✔ (صحيح) | 385.52 | 566.69 | 12.42 | 27 |
| 👁 (للحكم فقط) | 72.27 | 451 | 11.5 | 19 |
| 💡 (the strip) | 19 | 379 | 24.72 | 30 |

### Table V — the scripted round ([specs.md](specs.md) §2.5; REQ-6.15, REQ-6.16 (a))

Measured on the prototype with the stepper of Procedure M6 (one step = one 100 ms tick; the reveal's
held timeout called on the tenth step after صحيح), from S1, at 375 × 800 — the trace does not depend
on the viewport. "Hints" is spent / left; a spent hint is the question's own, in ink. "Bar" is the
fill's width as a percentage, to four decimals. On the app the same script is the driver's own loop,
stepped (`step(n)` in the browser; `vi.advanceTimersByTime(100 × n)` in CI). In CI a press is the
driver's `dispatch` of its action, so V6's `hint` reaches the engine, which refuses it (REQ-3.6); in
the browser V6's click lands on a disabled button and reaches no handler. Both leave V5's state.

| # | Action | Clock A | Clock B | Turn | Status A | Status B | Question | Hints | Note | Reveal | Bar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V1 | start (S1) | 45 | 45 | A | دورهم الآن | بالانتظار | سؤال 1 | 0 / 2 | −٢ ثانية · باقي 2 | — | 100 |
| V2 | +37 steps | 42 | 45 | A | دورهم الآن | بالانتظار | سؤال 1 | 0 / 2 | باقي 2 | — | 91.7778 |
| V3 | تلميح | 40 | 45 | A | ″ | ″ | سؤال 1 | 1 / 1 | −٢ ثانية · باقي 1 | — | 87.3333 |
| V4 | +5 steps | 39 | 45 | A | ″ | ″ | سؤال 1 | 1 / 1 | باقي 1 | — | 86.2222 |
| V5 | تلميح | 37 | 45 | A | ″ | ″ | سؤال 1 | 2 / 0 | انتهت التلميحات (button disabled) | — | 81.7778 |
| V6 | تلميح on the spent button | 37 | 45 | A | ″ | ″ | سؤال 1 | 2 / 0 | انتهت التلميحات | — | 81.7778 |
| V7 | تخطي | 34 | 45 | A | ″ | ″ | **سؤال 2** | 0 / 2 | باقي 2 | — | 75.1111 |
| V8 | +8 steps | 33 | 45 | A | ″ | ″ | سؤال 2 | 0 / 2 | باقي 2 | — | 73.3333 |
| V9 | صحيح | 33 | 45 | A | دورهم الآن | بالانتظار | سؤال 2 | 0 / 2 | باقي 2 | **up** — the answer box's answer | 73.3333 |
| V10 | تخطي under the reveal | 33 | 45 | A | ″ | ″ | سؤال 2 | 0 / 2 | باقي 2 | up | 73.3333 |
| V11 | +9 steps | 33 | 45 | A | ″ | ″ | سؤال 2 | 0 / 2 | باقي 2 | up | 73.3333 |
| V12 | +1 step (the tenth) | 33 | 45 | **B** | **مجمّد** | **دورهم الآن** | **سؤال 3** | 0 / 2 | باقي 2 | — | 100 |
| V13 | +1 step | 33 | 45 | B | مجمّد | دورهم الآن | سؤال 3 | 0 / 2 | باقي 2 | — | 99.7778 |
| V14 | صحيح | 33 | 45 | B | مجمّد | دورهم الآن | سؤال 3 | 0 / 2 | باقي 2 | up | 99.7778 |
| V15 | +10 steps | 33 | 45 | **A** | دورهم الآن | **مجمّد** | **سؤال 4** | 0 / 2 | باقي 2 | — | 73.3333 |
| V16 | +329 steps | **1** | 45 | A | دورهم الآن | مجمّد | سؤال 4 | 0 / 2 | باقي 2 | — | 0.2222 |
| V17 | +1 step (the 330th) | — | — | — | — | — | — | — | — | — | — |

At **V17** the round is over: the screen is `roundEnd` (the prototype's "الصقور كسبوا الجولة!"; the
app's Phase 5 placeholder), tallies **A 0 – B 1**, and the log holds one entry — round 1, أمثال (the
app's `proverbs`), won by team B (الصقور). The app's throwaway replay of this script through
`createLocalRoom` under fake timers (requirements §1.1, fact 7) gave every value above.

### Table W — the round in real time (REQ-6.16 (b))

On the app only: the production build, 480 × 800 light, one tab, the pane **visible**, the
browser's own timers and `Math.random` — no stepper. Times by the page's `performance.now()`. "Across
the press" means: read, `click()`, two `await Promise.resolve()`, read — no timer callback can run
in between, so the difference is the press's alone.

| # | Step | Bound |
|---|---|---|
| W0 | before W1 and after W6 | `document.visibilityState === 'visible'` both times — else the run is **void** (specs.md §4, R6), not failed |
| W1 | "ابدأ اللعبة", "ابدأ الجولة الأولى" | the play screen; A active "دورهم الآن" at **45**; B "بالانتظار" at **45**; "سؤال 1"; the strip's placeholder in muted; "−٢ ثانية · باقي 2" |
| W2 | wait 5,000 ms from W1's read | A's clock **4–6** lower; B **45** |
| W3 | تلميح | A **exactly 2** lower across the press; the strip shows the question's first hint in ink, and `document.getAnimations()` holds a running `slidein` on it; "−٢ ثانية · باقي 1" |
| W4 | تخطي | A **exactly 3** lower across the press; "سؤال 2"; the placeholder in muted; "باقي 2" |
| W5 | صحيح | across the press the reveal is up, its answer equal to the answer box's; A's clock unchanged at +500 ms; the reveal gone at a poll (every 25 ms) between **850 and 1,150 ms** after the press; then B active "دورهم الآن" at **45**, A "مجمّد" at its value before صحيح, "سؤال 3" |
| W6 | no further press | the screen leaves `play` between **44,000 and 48,000 ms** after the reveal went down; the placeholder shows `roundEnd`, team A **1** round, team B **0** |
| W7 | throughout | **0** console errors; **0** network requests beyond the page's own origin |

### Table X — the play view's pinned values (REQ-6.1 – REQ-6.5)

Rooms are `reduce(seedRoom('SKZJ62'), { type: 'openRoom' })` after `startMatch` with
`drawRound(…, CATALOG, () => 0.5)` — أمثال (`proverbs`), questions in the order ١، ٣، ٢ (Phase 5's
Table T2) — then the actions named, with no tick unless stated. Placeholder texts are Phase 5's
(`سؤال تجريبي d — أمثال`, `إجابة تجريبية d`, `تلميح تجريبي ١ / ٢`, the fact
`معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨`).

| # | Room | Expected |
|---|---|---|
| X1 | S1 | `timers.a` = { النمور, **45**, active, "دورهم الآن", [false, false, false] }; `timers.b` = { الصقور, **45**, not active, "بالانتظار", [false, false, false] }; `activeTeam` a; `activeName` النمور; 💬 أمثال; `bankPct` **100**; `qNumber` **1**; `questionText` "سؤال تجريبي ١ — أمثال"; `hintText` "لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا", not spent; `hintsLeft` **2**; "−٢ ثانية · باقي 2"; `reveal` null; `judgeName` ماجد; `answerText` "إجابة تجريبية ١"; `altText` "لا توجد بدائل" |
| X2 | S1 + `hint` (S2) | clock A **43**; `bankPct` **95.5556** (43,000 / 45,000 × 100, to four decimals); `hintText` "تلميح تجريبي ١", spent; `hintsLeft` **1**; "−٢ ثانية · باقي 1" |
| X3 | S2 + `hint` (S3) | clock A **41**; `bankPct` **91.1111**; `hintText` "تلميح تجريبي ٢"; `hintsLeft` **0**; "انتهت التلميحات" |
| X4 | S3 + `correct` (S4) | `reveal` = { "إجابة تجريبية ١", "معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨" }; every other field as X3 |
| X5 | S4 + 10 × (`tick` 100, `passTurn`) (S5) | `timers.a` = { 41, not active, "**مجمّد**" }; `timers.b` = { 45, active, "دورهم الآن" }; `activeTeam` b; `activeName` الصقور; `bankPct` 100; `qNumber` **2**; `questionText` "سؤال تجريبي **٣** — أمثال"; placeholder, not spent; `hintsLeft` 2; `reveal` null; `answerText` "إجابة تجريبية ٣" |
| X6 | S1 with `tallyA` 2, `tallyB` 1 · `winsNeeded` 4 · `winsNeeded` 2 | dots a [true, true, false], b [true, false, false] · four dots each · two dots each |
| X7 | S1 with the current question's `h` = [] | `hintText` "ما فيه تلميحات لهذا السؤال", not spent; `hintsLeft` 0; "انتهت التلميحات" |
| X8 | S1 with the current question's `alts` = ['أ', 'ب'] · = [''] | `altText` "أ، ب" · "" (the prototype's conditional, not `|| …`) |
| X9 | S1 with `questionIndex` 3 | `qNumber` **4**; `questionText` the pool's first, "سؤال تجريبي ١ — أمثال" |
| X10 | S1 with no players · with `judgeIndex` 7 of 5 | `judgeName` "—" · نورة |
| X11 | the seed on `setup` (no pool) · S1 with `categoryId` 'nope' · with `categoryId` null | `RangeError`, each |

---

## 1. Gate 1 — The play view and the round in CI (blocks Gates 2–6)

- [x] **REQ-6.2 (The timer cards' values):** Table X1–X6 for `timers.a` and `timers.b`: names, clocks
  (45, 43, 41, then 41 / 45), `active`, all three statuses, and the dots for tallies 0–2 and
  `winsNeeded` 2, 3 and 4.
  > Measured: `pnpm vitest run apps/web/app/host/_lib/play-view.test.ts --reporter=verbose` — "REQ-6.2: the timer cards" **3 / 3**: X1–X5 `timers` `toStrictEqual` Table X — النمور / الصقور; clock A **45 · 43 · 41 · 41 · 41**, clock B **45** on all five; `active` a on S1–S4, **b** on S5; statuses **"دورهم الآن"** (the active team), **"بالانتظار"** (B on S1–S4), **"مجمّد"** (A on S5); the clock rounded up as the engine displays it — 41,300 ms (S1 + `tick` 3,700) → **42**, 50 ms → **1**, a running bank at 0 → **0**; X6 dots — tallies 2 / 1 → a `[true, true, false]` · b `[true, false, false]`; `winsNeeded` 4 → **4** dots each, all unwon, and `[t, t, f, f]` / `[t, f, f, f]` at tallies 2 / 1; `winsNeeded` 2 with tally A 1 → `[true, false]` · `[false, false]`; **3** unwon dots per card on S1–S5 · mutations applied alone and reverted, each caught: M1 "مجمّد" for every inactive team (**2** fail — X1–X5 timers and the full-view row), M2 the clock floored (**1** — the rounding test; Table X's whole-second clocks cannot see it, and specs.md §2.1 names Table V2, in `play-round.test.ts`, not yet written, as its catch), M9 dots of length `tally` (**3**), M10 the tallies swapped (**1** — X6) · STEP 1 commit, 2026-10-04

- [x] **REQ-6.3 (Category, bar, turn, number):** Table X1–X5 and X9: 💬 أمثال; `bankPct` 100,
  95.5556, 91.1111, 91.1111, 100; `activeName` النمور then الصقور; `qNumber` 1, 1, 1, 1, 2, and 4 at
  `questionIndex` 3.
  > Measured: the same run — "REQ-6.3" **4 / 4**: 💬 أمثال on S1–S5; `bankPct` to four decimals **100 · 95.5556 · 91.1111 · 91.1111 · 100**; `activeTeam` / `activeName` a النمور on S1–S4, then **b الصقور**; `qNumber` **1 · 1 · 1 · 1 · 2**, and **4** at `questionIndex` 3, the pool wrapping to "سؤال تجريبي ١ — أمثال" (X9); the bar at 41,300 ms **91.7778** (Table V2's); S5's **100** is B's full bank (A's frozen 41,000 ms would read 91.1111); clamped — a 45 s bank in a room of 40 s reads **100**, not 112.5, and a bank at 0 reads **0**; a catalog with `proverbs` renamed gives its own emoji and name (the catalog given is read) · mutations caught: M5 the inactive team's bank (**3** fail), M6 without `* 1000` (**3** — every value clamps to 100), M7 `qNumber` = `questionIndex` (**3**) · STEP 1 commit, 2026-10-04

- [x] **REQ-6.4 (The hint):** Table X1–X5 and X7: the two placeholders, the first and second hint,
  `hintSpent`, `hintsLeft` 2 / 1 / 0, both notes.
  > Measured: the same run — "REQ-6.4" **3 / 3**: (`hintText`, `hintSpent`, `hintsLeft`, `hintBtnNote`) on S1 **"لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا"**, false, **2**, **"−٢ ثانية · باقي 2"** · S2 **"تلميح تجريبي ١"**, true, **1**, **"−٢ ثانية · باقي 1"** · S3 **"تلميح تجريبي ٢"**, true, **0**, **"انتهت التلميحات"** · S4 as S3 · S5 as S1; X7, the current question's `h` = [] → **"ما فيه تلميحات لهذا السؤال"**, false, **0**, "انتهت التلميحات"; a three-hint question → the placeholder, then h1, then h2 — the last spent, never the next — with "−٢ ثانية · باقي 1"; every label in `play-view.ts` byte-equal to its literal in the prototype's `renderVals` (U+2212 minus, U+00B7 middle dot, U+2014 dash) · mutations caught: M3 `h[hintIndex]` (**3** fail), M4 the note counting hints spent (**3**) · STEP 1 commit, 2026-10-04

- [x] **REQ-6.5 (The reveal and the answer box):** Table X4, X8 and X10: the reveal's answer and fact
  only on S4; `judgeName` ماجد, "—" and نورة; `answerText`; `altText` "لا توجد بدائل", "أ، ب" and "".
  > Measured: the same run — "REQ-6.5" **4 / 4**: X4 `reveal` = { **"إجابة تجريبية ١"**, **"معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨"** } on S4, its answer equal to the view's `answerText`; `null` on S1, S2, S3 and S5; S4's view otherwise equal to S3's; `judgeName` **ماجد** (S1, S5), **"—"** with no players, **نورة** at `judgeIndex` 7 of 5 (X10); `answerText` "إجابة تجريبية ١" (S1) / **"إجابة تجريبية ٣"** (S5); `altText` **"لا توجد بدائل"** (`alts` []), **"أ، ب"**, and **""** for `['']` (X8) · mutations caught: M8 joined with ", " (**1** fail — X8), the conditional written `join(…) || …` (**1** — X8's `['']`) · STEP 1 commit, 2026-10-04

- [x] **REQ-6.1 (One pure view):** `PlayView`'s fields are exactly specs.md §2.1's sixteen and
  `TimerView`'s its five; Table X11's three rooms throw `RangeError`; the same room and catalog give
  deep-equal views on every call and the room is not mutated (deep-frozen input); and
  `_lib/play-view.ts` imports nothing but `@nel3ab/game` and `./catalog`'s type.
  > Measured: the same run — "REQ-6.1" **6 / 6**, with "Table X's rooms" **1 / 1** (S1 round 1 of `proverbs` on `play`, its pool ١، ٣، ٢ — Phase 5's T2; S2–S5 on `play`; the reveal still up after 9 loop steps, gone after the 10th): X1–X5 every field `toStrictEqual` Table X (the bar to four decimals); `Object.keys` exactly specs.md §2.1's **16** on all five views, `timers` `a` and `b`, each `TimerView` its **5**; X11 — the seed on `setup` and an S1 with an empty pool throw `RangeError` "…no current question…", `categoryId` `'nope'` and `null` throw `RangeError` "…no category with id …", and so does an empty catalog; **8** rooms (S1–S5 and three hand-built) and the catalog `structuredClone`d and deep-frozen — each view equal to the unfrozen room's, **3** calls deep-equal, the frozen room and catalog equal to their originals afterwards; the imports read from `play-view.ts`'s source — **3** statements, **3** parsed, no `require(` or `import(` — runtime `{ currentJudge, currentQuestion, displaySeconds, remainingMs }` and types from `@nel3ab/game`, and `type { CatalogEntry }` from `./catalog`; naming — the prototype's `renderVals` read at run time (**1** block), each of the **33** keys specs.md §2.1's table maps the 16 fields and the 5 timer fields to occurs in it **1** time and in `play-view.ts`'s header comment, **11** fields carry their key's own name, each of the 16 heads a line of the header; `grep -nwE "Date|performance|setTimeout|setInterval|Math\.random|startRound"` over `play-view.ts` **0** lines · mutations caught: a write to the input (**1** fail — the frozen test), `CATALOG`'s data imported (**1** — the imports test), an unknown category falling back to the first entry (**1** — X11) · the file **21 / 21** · `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` 42 files across 6 projects (apps/web 14), **706 / 706** (+1 file, +21 tests), `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `git diff 77ed5a4 -- packages/ apps/web/app/fonts.ts` empty · STEP 1 commit, 2026-10-04

- [x] **REQ-6.15 (The prototype's round, replayed in CI):** `play-round.test.ts` drives Table V's
  script through `createLocalRoom({ random: () => 0.5, initial: <the seed, opened> })` and
  `room.startMatch()` under Vitest's fake timers, reading `playView` at each of V1–V16 and the room
  at V17: every cell of Table V equal — clocks, turn, statuses, question number, hints spent / left,
  note, reveal up or not (and its answer equal to the view's `answerText`), bar to four decimals —
  and at V17 `roundEnd`, tallies 0 – 1, log `[{ n: 1, category: 'proverbs', winner: 'b' }]`.
  > Measured: `pnpm vitest run apps/web/app/host/_lib/play-round.test.ts --reporter=verbose` — "REQ-6.15" **1 / 1**: `createLocalRoom({ random: () => 0.5, initial: reduce(seedRoom('SKZJ62'), { type: 'openRoom' }) })`, `room.startMatch()`, the loop under Vitest's fake timers through the driver's default timers (`vi.advanceTimersByTime(100 × n)` per n steps), each press `room.dispatch({ type })`; at each of V1–V16 the ten cells read through `playView(room.getState(), CATALOG)` (hints spent from the room's `hintIndex`) `toStrictEqual` Table V's row — clock A **45 · 42 · 40 · 39 · 37 · 37 · 34 · 33 · 33 · 33 · 33 · 33 · 33 · 33 · 33 · 1**, clock B **45** at all 16; turn a on V1–V11, **b** on V12–V14, **a** on V15–V16; statuses دورهم الآن / بالانتظار on V1–V11, **مجمّد / دورهم الآن** on V12–V14, **دورهم الآن / مجمّد** on V15–V16; question **1** (V1–V6) · **2** (V7–V11) · **3** (V12–V14) · **4** (V15–V16); hints spent / left **0/2 · 0/2 · 1/1 · 1/1 · 2/0 · 2/0**, then 0/2 from V7; the note "−٢ ثانية · باقي 2", "−٢ ثانية · باقي 1", **"انتهت التلميحات"** on V5–V6 (Table V's shortened "باقي N" cells written out in full, the only two forms `hintBtnNote` has); reveal up on **V9, V10, V11, V14** only, its answer equal to the view's `answerText` each time; bar to four decimals **100 · 91.7778 · 87.3333 · 86.2222 · 81.7778 · 81.7778 · 75.1111 · 73.3333 · 73.3333 · 73.3333 · 73.3333 · 100 · 99.7778 · 99.7778 · 73.3333 · 0.2222**; and at every point the screen `play`, `active` on the turn's card only, a spent hint the question's own (`hintSpent` true) and the placeholder otherwise; V6's تلميح and V10's تخطي reach the engine and leave the room the same object (`toBe`), every other action changes it · V17, the 330th step after the last pass: `roundEnd`, tallies **0 – 1**, log `[{ n: 1, category: 'proverbs', winner: 'b' }]`, **0** timers pending · mutations applied alone and reverted, each failing this test: Gate 5's **M2** the clock floored (fails at **V2**, 41 for 42 — the catch specs.md §2.1 names), M1 "مجمّد" for every inactive team (V1), M5 the inactive team's bank (V2), M6 without `* 1000` (V2), the driver sending no `passTurn` (V12 — the turn never passes), `passTurn` before `tick` in a step (V12 — the pass lands a step late), a tick of 200 ms (V2, 38 for 42), `hint` dispatched as `skip` (V3) · STEP 1 commit, 2026-10-04

- [x] **REQ-6.13 (The three actions reach the reducer):** over the same script through a recording
  reducer, the dispatch log holds `startMatch` **1** time, `{ type: 'hint' }` **3** times,
  `{ type: 'skip' }` **2** times and `{ type: 'correct' }` **2** times — each exactly that object —
  and otherwise only `tick` and `passTurn`; **0** `startRound`.
  > Measured: the same file — "REQ-6.13" **1 / 1**: the same script, V1–V17, through a recording reducer (`createLocalRoom`'s `reducer` option wrapping the engine's `reduce`); the log's counts by `type` `toStrictEqual` { startMatch **1**, tick **401**, passTurn **401**, hint **3**, skip **2**, correct **2** } — no other type; `startRound` **0** (counted by `type`; no non-test source under `apps/web` names it); the hints, skips and corrects each `toStrictEqual` `{ type: 'hint' }`, `{ type: 'skip' }`, `{ type: 'correct' }`; the whole log, in order, equal to the script's — `{ type: 'startMatch', ...drawRound(READY, CATALOG, () => 0.5) }` (proverbs), each press where pressed, each step `{ type: 'tick', ms: 100 }` then `{ type: 'passTurn' }`, the step that ends the round included — **810** actions · mutations applied alone and reverted, each failing this test: a driver that drops a press while the reveal is up (**this test only** — skip **1**; the trace stays equal, V10 being refused either way), `hint` dispatched as `skip` (no `hint` in the log), the driver sending no `passTurn` (the round never ends), `passTurn` before `tick` (the log out of order), a tick of 200 ms (tick **206**); `git status` after each revert: only `play-round.test.ts`, untracked · the file **2 / 2** · `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` 43 files across 6 projects (apps/web 15), **708 / 708** (+1 file, +2 tests), `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); no source file changed in this step; `git diff 77ed5a4 -- packages/ apps/web/app/fonts.ts` empty · STEP 1 commit, 2026-10-04

## 2. Gate 2 — The screen, the route and Phase 5's files (needs Gate 1; blocks Gates 3–6)

- [x] **REQ-6.6 – REQ-6.11 (The markup):** `PlayScreen`'s static markup for Table X1–X5's views holds
  the tree of specs.md §2.2 — the root's five children; each card's two rows; the question card's
  three children, four on S4 only — with `data-team` a / b on the cards, `data-active` true on
  exactly the active one, `data-team` on the fill and the header strip equal to the active team,
  `data-spent` true on S2–S4 only, `data-won` false on every dot, `.ltr-num` on both clocks, the
  fill's `style` `width:100%` / `width:95.55555555555556%` …, `data-tone="yellow"` on تلميح on S1,
  S2 and S5 and none on S3–S4, `disabled=""` with `aria-disabled="true"` on تلميح on S3–S4 and on
  nothing else, `data-tone="leaf"` on صحيح, and the texts of Y1 and the view's in order.
  > Measured: `pnpm vitest run apps/web/app/host/play-markup.test.tsx --reporter=verbose` — "REQ-6.6 – REQ-6.11" **11 / 11**: the five views Table X's (clock A **45 · 43 · 41 · 41 · 41**, B 45; hints left **2 · 1 · 0 · 0 · 2**; the reveal on S4 only; turn a, a, a, a, **b**); `PlayScreen`'s static markup read into a tree and compared whole with specs.md §2.2's tree built from the view — every element, its order and nesting, its play.module.css classes (each checked against the **34** classes the stylesheet defines: under Vitest a CSS Module is a proxy that names any key), every attribute and every text — equal on S1–S5, X6 and X7; the root no class and **5** children (timers, category-row, question, answer-box, actions) on all five; each card **2** rows; the question card **3** children on S1–S3 and S5, **4** on S4 (`.reveal` count 0 · 0 · 0 · 1 · 0); the cards `data-team` a / b, `data-active` true / false on S1–S4 and false / true on S5; `data-team` on the fill and the header strip a · a · a · a · **b**; `data-spent` **false · true · true · true · false** — true on S2–S4 only, as the corrected box asks (Correction 2026-10-11, `917d77e`), S4 being X4, which carries X3's `hintSpent`; every dot `data-size="sm"` `data-won="false"` (**3** per card) on S1–S5, and on X6 a [true, true, false] · b [true, false, false]; `.ltr-num` on the two clocks and on nothing else; the fill's `style` `width:100%` · `width:95.55555555555556%` · `width:91.11111111111111%` · `width:91.11111111111111%` · `width:100%`; تلميح `data-tone="yellow"` on S1, S2, S5 and none on S3–S4, `disabled=""` with `aria-disabled="true"` on S3–S4 (and on X7, a question with no hints) and on nothing else — `disabled=""` count **0 · 0 · 1 · 1 · 0**; صحيح `data-tone="leaf"` on all five; each Button's last child its sub-label (Procedure M6's `lastElementChild`); the text runs, the `.glyph` span tags removed, exactly the view's values and Y1's **11** literals in the prototype's order (**10** without the reveal) — React 19's static markup writes "دور النمور", "سؤال 1" and "يُقبل أيضاً: …" as one run each — and S4's **26** runs written out literally; every one of the 34 classes used by the screen and no other · mutations applied alone and reverted, the file's SHA-256 checked equal after each, each caught: Gate 5's M11 تلميح never disabled (**3** fail), M13 the reveal always rendered (**3**), M14 `.ltr-num` dropped (**2**); a class the stylesheet does not define (**3**); `data-spent` false under the reveal (**2**) · the file **20 / 20**, its grep of `Date`, `performance`, `setTimeout`, `setInterval`, `Math.random`, `startRound` over `PlayScreen.tsx` and `_lib/play-view.ts` **0** (2 / 2, the search shown live; NFR-6.5's box is the next step's) · STEP 2 commit, 2026-10-11

  > **Correction 2026-10-11 — made before this box was evaluated, decided by the owner (Ahmed, in
  > session: "yes, make the correction and continue the run").** As first written, this box said
  > "`data-spent` true on S2–S3 only". Every other part of the plan makes it S2–S4: specs.md §2.2 and
  > §2.3 key `data-spent` on the view's `hintSpent` (`hintIndex > 0`, the prototype's `hintColor` /
  > `hintAnim`); Table X4 gives S4 every field of X3, so `hintSpent` is true there, as Gate 1 already
  > pins (commit `21ca043`); and the prototype's `markCorrect` does not reset `hintIdx`, so under the
  > reveal its hint text stays ink with `slidein` (measured in planning: S4 changes only the reveal's
  > roles from S3). A screen that showed S4's hint as unspent would fail S4's comparison under
  > REQ-6.17. The box is corrected to S2–S4. What it accepts otherwise is unchanged; no measured
  > value changes. The alternatives considered and rejected were ruling that the hint shows as
  > unspent under the reveal (a departure from the prototype) and returning the plan to a planning
  > session. Found by the subagent building specs.md §1's STEP 2; the halt note of commit `7e9e347`
  > is cleared by the same commit as this correction.

- [x] **REQ-6.12 (The glyphs):** exactly **five** `.glyph` spans — ⏭, 💡 and ✔ inside their Buttons,
  👁 inside "للحكم فقط", and 💡 as the only child of `span.bulb`; the category's emoji in no
  `.glyph` span; `play.module.css`'s `.glyph` declares exactly `font-family: system-ui, sans-serif`;
  `git diff 77ed5a4 -- apps/web/app/fonts.ts` is empty.
  > Measured: the same run — "REQ-6.12" **3 / 3**: exactly **5** `.glyph` spans on each of S1–S5, in document order 💡 · 👁 · ⏭ · 💡 · ✔, each holding its glyph alone (U+1F4A1, U+1F441, U+23ED, U+2714 — the prototype's code points, no variation selector); the first the only child of `span.bulb`, the second inside `span.judge-only` after "للحكم فقط ", the other three inside their Buttons (label, glyph, `<br>`, sub-label); the category's 💬 in a plain span with no attribute, in no `.glyph` span; play.module.css's `.glyph` exactly **1** rule, declaring exactly `font-family: system-ui, sans-serif`; `git diff 77ed5a4 -- apps/web/app/fonts.ts` **0** lines · mutations applied alone and reverted, each caught: Gate 5's M18 the `.glyph` span dropped from ⏭ (**2** fail), the category's emoji wrapped in `.glyph` (**3**), `.glyph` declaring `system-ui` alone (**1**) · STEP 2 commit, 2026-10-11

- [x] **REQ-6.11 / REQ-6.13 (The buttons call what they say):** in the React element tree
  `PlayScreen(props)` returns, the three `variant="action"` Buttons are, in order, the ones whose
  `onClick` is `props.onSkip`, `props.onHint` and `props.onCorrect` (`toBe`); the hint Button's
  `disabled` is `true` exactly when `view.hintsLeft === 0`.
  > Measured: the same run — "REQ-6.11 / REQ-6.13" **3 / 3**: `PlayScreen(props)` called as a function and its React element tree walked — no DOM, nothing rendered: exactly **3** `Button` elements, all `variant="action"`, whose `onClick` are `toBe` `props.onSkip`, `props.onHint` and `props.onCorrect`, in that order, on S1–S5 and X7, three distinct functions each time; the hint Button's `disabled` false · false · **true · true** · false on S1–S5 (`hintsLeft` 2 · 1 · 0 · 0 · 2) and **true** on X7 (0), the skip and correct Buttons carrying no `disabled`; the hint text one element, its `key` `null` · mutations applied alone and reverted, each caught: Gate 5's M12 `onSkip` and `onHint` swapped (**1** fail), the skip Button given `onHint` alone (**1**), a `key={view.hintText}` on the hint text (**1**) · STEP 2 commit, 2026-10-11

- [x] **REQ-6.13 (The route):** `play-routing.test.tsx`, with the driver replaced by a stub room: on
  `play` `HostApp`'s markup is the frame, the header "نلعب" / "جولة 1 — أول 3 جولات", then exactly
  `PlayScreen`'s markup for `playView(state, CATALOG)`; on `roundEnd` and on `match`, Phase 5's
  `PendingScreen` markup; on `setup`, Phase 5's setup markup, unchanged.
  > Measured: `pnpm vitest run apps/web/app/host/play-routing.test.tsx --reporter=verbose` — "REQ-6.13" **4 / 4**: `HostApp` rendered with `renderToStaticMarkup` while `./_lib/driver` is replaced by `vi.mock` (Vitest's own; `importOriginal` spread, so `drawRound` is the real one), its `createLocalRoom` returning a stub `LocalRoom` whose `getState` is the room the test set and whose other six methods do nothing; the rooms real, reached through `reduce` — S1–S5 (Table X1–X5's: `play`, round 1, turn a · a · a · a · **b**, the reveal on S4 only), round 1 run out in one 45,000 ms tick (**`roundEnd`**, round 1, **0 – 1**), rounds 2–5 each drawn by `drawRound(…, CATALOG, () => 0.5)` and run out (**`match`**, round **5**, **2 – 3**, log winners b · a · b · a · b), the seed on `setup`; on `play`, for each of S1–S5, `HostApp`'s whole markup `toBe` Phase 5's frame written out tag for tag (`data-screen="play"`; page, stage, column, header; the brand's mark, then "نلعب"; the round label) with **"جولة 1 — أول 3 جولات"**, then exactly `PlayScreen`'s markup for `playView(state, CATALOG)` rendered alone — its first two text runs "نلعب" / "جولة 1 — أول 3 جولات"; `PendingScreen`'s markup and its `<span class="ltr-num">play</span>` absent; on `roundEnd` and on `match`, the frame with "جولة 1 — أول 3 جولات" / **"جولة 5 — أول 3 جولات"**, then exactly `PendingScreen`'s markup for the room (runs "نلعب", the label, `roundEnd` / `match`), no `PlayScreen` markup and no `<button`; on `setup`, the frame with "إعداد", then exactly `SetupScreen`'s markup for `setupView(seed, CATALOG)` (runs "نلعب", "إعداد", "يلا نلعب") · mutations applied alone to `HostApp.tsx` and reverted, its SHA-256 checked equal after each: Gate 5's **M17** `play` routed to `PendingScreen` (the branch's test made `false`) — **1** fail, this file's `play` test, no other test in apps/web; `roundEnd` routed to `PlayScreen` (**1** — the roundEnd / match test); `match` routed to `PlayScreen` (**1** — the same); `onSkip` dispatching `{ type: 'hint' }` — **0** fail, apps/web **183 / 183**: no CI test catches a swapped dispatch, as §9 and specs.md §4, R2 record (Gate 4's browser pass checks it) · STEP 2 commit, 2026-10-11

- [x] **NFR-6.4 (Phase 5's files: the sanctioned edits, and no others):** relative to `77ed5a4`, the
  only Phase 5 files changed are `HostApp.tsx` (specs.md §2.4's branch, its two imports and its
  comment's paragraph) and `host-source.test.ts` (§2.6's three paths and the title) — every hunk one
  of §2.6's; every other file under `apps/web/app/host/` that existed at `77ed5a4` shows **0** lines
  of diff; `pnpm vitest run apps/web` passes every Phase 5 test (**136** at `d3c51a1`'s record) with
  **0** failures and **0** skips.
  > Measured: `git diff 77ed5a4 -- apps/web/app/host/HostApp.tsx apps/web/app/host/host-source.test.ts` — **4** hunks, every one §2.6's: `HostApp.tsx` +16 / −0 in **2** — the header comment's one paragraph (Phase 6's play screen, its three dispatches `skip` / `hint` / `correct`, `PendingScreen` remaining on `roundEnd` and `match` until Phase 7) with the two imports `playView` and `PlayScreen`, and specs.md §2.4's `play` branch, verbatim; `host-source.test.ts` +4 / −1 in **2** — the NFR-5.7 scan test's title gains "— and Phase 6's play screen —" and its `arrayContaining` list gains `'app/host/PlayScreen.tsx'`, `'app/host/play.module.css'` and `'app/host/_lib/play-view.ts'`; `git diff --stat 77ed5a4 --` over the other **23** files under `apps/web/app/host/` at `77ed5a4` (`git ls-tree`: 25, less those two) — `PendingScreen.tsx`, `SetupScreen.tsx`, `ReadyScreen.tsx`, `page.tsx`, the three stylesheets, all **14** `_lib` files, `host-markup.test.tsx`, `host-prototype.test.ts` — **0** lines; §7's command, which names `_lib/` as a folder, lists only Phase 6's three new `_lib` files (`play-view.ts`, `play-view.test.ts`, `play-round.test.ts`; 927 insertions, all new files); `pnpm vitest run apps/web` (JSON reporter): the **13** test files that existed at `77ed5a4` hold **136** tests, `d3c51a1`'s record — **136** passed, **0** failed, **0** skipped; apps/web 17 files, **183 / 183**; `git diff 77ed5a4 --` over `packages/`, `design/`, `apps/web/app/fonts.ts` and every file of NFR-6.3's list empty · STEP 2 commit, 2026-10-11

- [x] **NFR-6.5 (Nothing leaves the page; the answer stays on `/host`):** `host-source.test.ts`, with
  §2.6's three paths: the scan covers `PlayScreen.tsx`, `play.module.css` and `_lib/play-view.ts`,
  and finds **0** of `fetch(`, `WebSocket`, `EventSource`, `sendBeacon`, `XMLHttpRequest`,
  `localStorage` under `app/host`, **0** `startRound` and **0** of the prototype's 199 content strings
  under `apps/web`; `PlayScreen.tsx` and `_lib/play-view.ts` contain **0** of `Date`, `performance`,
  `setTimeout`, `setInterval`, `Math.random`; and `apps/web/app` has no route but `/`, `/host` and
  `/styleguide`.
  > Measured: `pnpm vitest run apps/web/app/host/host-source.test.ts --reporter=verbose` **9 / 9**, with §2.6's three paths: NFR-5.7's "the scan covers every screen, stylesheet and _lib module under app/host — and Phase 6's play screen — and no test file" — the scan's **18** non-test source files under `app/host` include `PlayScreen.tsx`, `play.module.css` and `_lib/play-view.ts`; **0** of `fetch(`, `WebSocket`, `EventSource`, `sendBeacon`, `XMLHttpRequest`, `localStorage` under `app/host` (each found live in TypeScript's DOM declarations); REQ-5.13's **0** files under `apps/web` containing `startRound`; REQ-5.14's **0** of the prototype's **199** content strings (33 questions, 33 answers, 34 variants, 66 hints, 33 facts) in any non-test source under `apps/web`; `play-markup.test.tsx`'s search for `Date`, `performance`, `setTimeout`, `setInterval`, `Math.random`, `startRound` — whole words, comments included — over `PlayScreen.tsx` and `_lib/play-view.ts` **0** (2 / 2), and §7's `grep -nwE` **0** lines (over `HostApp.tsx`, **0**); `apps/web/app` holds a `page.tsx` at `app/`, `app/host/` and `app/styleguide/` only and no `route.*`, and `pnpm build` lists `/`, `/_not-found` (Next's own), `/host`, `/styleguide` · mutations, each appended alone as a comment and reverted (SHA-256 checked equal), each caught: `// localStorage` in `PlayScreen.tsx`, `/* fetch( */` in `play.module.css`, `// WebSocket` in `_lib/play-view.ts` — NFR-5.7's 0-occurrence test (**1** fail each); `// startRound` in `PlayScreen.tsx` — REQ-5.13's scan and play-markup's search (**2**); the prototype's first question in `_lib/play-view.ts` — REQ-5.14's (**1**) · `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` 45 files across 6 projects (apps/web 17), **732 / 732** (+1 file, +4 tests), `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 — `/host` **10 kB** (8.26 kB before the route); play.module.css now in the built CSS: `--pop:pop 0.18s ease-out` and `--slidein:slidein 0.22s ease-out` name the global keyframes unhashed, with `animation:var(--pop)`, `animation:var(--slidein)` and `transition:width .1s linear`, and the build's only keyframes are the four global `bob`, `pop`, `ring`, `slidein` (Phase 5's fact 6) · STEP 2 commit, 2026-10-11

- [x] **NFR-6.6 (RTL):** `pnpm lint:css` passes over `play.module.css` with **0** disable comments; it
  contains no `left` / `right` property or value and no `margin-top`, `margin-bottom`, `border-top`
  physical forms — written `margin-block-*` and `border-block-start`.
  > Measured: `pnpm lint:css` exit 0; `stylelint apps/web/app/host/play.module.css` **0** problems over **41** rules and **163** declarations — every rule and declaration equal, in order, to specs.md §2.3's table (compared by script: 41 / 41 rules, 0 differences); `stylelint-disable` **0**; `grep -ciE 'left|right'` **0**, comments included; `margin-top`, `margin-bottom`, `border-top` **0** — written `margin-block-end` ×**5**, `margin-block-start` ×**2**, `border-block-start` ×**1**; the clocks `.ltr-num` (the markup box); `play-markup.test.tsx` "NFR-6.6" **1 / 1** asserts the same over the file · mutations applied alone and reverted: `margin-bottom` on `.timers` — caught by that test only (Stylelint allows the block axis, `CLAUDE.md` invariant 3); `text-align: left` on `.question-body` — caught by the test and by Stylelint's `declaration-property-value-disallowed-list` · on HEAD `917d77e` with this step's three files: `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` 44 files across 6 projects (apps/web 16), **728 / 728** (+1 file, +20 tests), `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 — `/host` 8.26 kB; play.module.css is not yet in the built CSS (`PlayScreen` is routed by the next step); `git diff 77ed5a4 -- packages/ apps/web/app/fonts.ts` empty · STEP 2 commit, 2026-10-11

## 3. Gate 3 — Read from the prototype (needs Gates 1–2)

- [ ] **REQ-6.14 (The play screen's words, labels, costs and timings):** each extraction below is read
  from `design/designs/Nel3ab - Arcade.dc.html` at run time, its match count asserted, and asserted
  equal to what it drives.

  | # | Extraction | Count | Asserted against |
  |---|---|---|---|
  | Y1 | the play block (`<sc-if value="{{ isPlay }}"` to its closing `</sc-if>`, one nested `sc-if` and two `sc-for` inside) and its literal text runs, in order: "دور ", "سؤال ", 💡, "الإجابة", "للحكم فقط 👁", "يُقبل أيضاً: ", "تخطي ⏭", "−٣ ثوانٍ", "تلميح 💡", "صحيح ✔", "يمرّ الدور" | block 1; runs **11** | `PlayScreen`'s static markup for S4's view, in the same order, after removing the `.glyph` span tags |
  | Y2 | `renderVals`' play keys — `statusA` / `statusB`, `hintText` (its two placeholders and `hints[s.hintIdx - 1]`), `hintBtnNote` (its prefix and "انتهت التلميحات"), `altText` (its separator and its empty label), `qNumber` (`s.qi + 1`), `clockA` / `clockB` (`Math.ceil`), `bankPct` (the clamp and `* 100`), `dots` (`i < n`, length `this.winsNeeded`), `judgeName` ("—"), `activeName` | 1 each; `statusA`/`statusB` 1 each | rebuilt from the extracted parts as the prototype writes them and evaluated over Table V's 17 rooms and Table X's — **≥ 30** rooms — equal to `playView`'s fields |
  | Y3 | the sub-labels' costs: "−٣ ثوانٍ" in the markup and "−٢ ثانية" in `hintBtnNote` | 1 each | their Arabic-Indic digits equal `SKIP_COST_MS / 1000` (3) and `HINT_COST_MS / 1000` (2) |
  | Y4 | the timings: the reveal's `animation:pop .18s ease-out`, `hintAnim`'s `'slidein .22s ease-out'`, the fill's `transition:width .1s linear` | 1 each | `play.module.css` declares `--pop: pop 0.18s ease-out`, `--slidein: slidein 0.22s ease-out` and `transition: width 0.1s linear` — names and easings equal, durations equal as numbers — and contains **no** `animation:` declaration naming `pop` or `slidein` directly |

## 4. Gate 4 — The browser pass (needs Gates 1–3; fix freely)

- [ ] 👁 **REQ-6.6 – REQ-6.11 (S1–S5 against Tables A and B):** Procedure M6 at 480 × 800, light:
  every role of every state within tolerance, the column 638.69 in each. Every deviation found is
  written down here, with its fix.

- [ ] 👁 **REQ-6.6 – REQ-6.11 (Phone width and dark):** Table C at 375 × 800, light; Tables A–C's
  geometry and Table D's colours in dark, at both widths — **4 / 4** configurations.

- [ ] 👁 **REQ-6.12 (The glyphs):** Table E on both pages within 0.5 px; each glyph's computed
  font-family on the app is `system-ui` (its `.glyph` span); the category's emoji box equals the
  prototype's (A18).

- [ ] 👁 **REQ-6.11, REQ-6.13 (Every button does what it says):** on `/host`'s production build, from
  S1 with the stepper: تلميح lowers A by 2 and shows the first hint; تخطي lowers A by 3 and moves to
  "سؤال 2"; صحيح raises the reveal; under the reveal تخطي, تلميح and صحيح each change nothing; the
  spent تلميح changes nothing and its `click` reaches no handler; after `step(10)` the turn is B's.

- [ ] 👁 **REQ-6.8, REQ-6.9 (The motion):** `document.getAnimations()` immediately after each press:
  the first تلميح of a question starts one `slidein` (0.22 s, ease-out) on the hint text; the second
  تلميح starts **none** (requirements §1.1, fact 3; REQ-6.8, DECIDED); after تخطي the next question's
  first تلميح starts one again; every صحيح starts one `pop` (0.18 s, ease-out) on a new reveal
  element; every change of the bar starts one `width` transition (0.1 s, linear). And the 🎉-style
  trap is absent: the computed `animation-name` of the hint text and the reveal is the global
  `slidein` / `pop`, not a hashed name.

- [ ] 👁 **REQ-6.11 (The presses):** applying the served `:active` rule (as Phase 2's Gate 6 and Phase
  5's Gate 5 did): تخطي, تلميح and صحيح each move **3 px**, `0 5px 0` → `0 2px 0`; the spent تلميح
  does not move; no scale, no opacity change, no blur.

- [ ] 👁 **REQ-6.16 (b) rehearsed (The round in real time):** Table W, W0–W7, on the production build
  with the browser's own timers. Any bound missed is a fault to fix here, before the verdict.

- [ ] 👁 **NFR-6.5 (Network, console, focus):** through the passes above: **0** network requests beyond
  the page's origin; **0** console errors; tabbing reaches the three buttons with the 3 px `--red`
  ring at offset 3 px (the spent تلميح skipped while disabled); no default ring anywhere.

## 5. Gate 5 — Mutations, the gate commands, the record (evaluated once, over the finished phase)

- [ ] **NFR-6.2 (No package changes; coverage unchanged):** `git diff 77ed5a4 -- packages/` is
  empty; `pnpm test` reports **100%** lines, branches, functions and statements over
  `packages/game/src` — Phase 5's **201 · 216 · 48 · 244** — and `vitest.config.ts`'s coverage block
  is byte-identical to `77ed5a4`'s.

- [ ] **REQ-6.1 – REQ-6.14 (Assertions that bite):** each mutation below, applied alone and reverted,
  fails at least one test; the test that caught it is recorded.

  | # | Mutation |
  |---|---|
  | M1 | `status`: "مجمّد" for every inactive team (no "بالانتظار") |
  | M2 | the clock floored (`Math.floor(remainingMs / 1000)`) instead of `displaySeconds` |
  | M3 | `hintText` shows `h[hintIndex]` (the next hint, not the last spent) |
  | M4 | `hintBtnNote` counts hints spent |
  | M5 | `bankPct` from the inactive team's bank |
  | M6 | `bankPct` without `* 1000` |
  | M7 | `qNumber` = `questionIndex` |
  | M8 | `altText` joined with ", " |
  | M9 | `dots` of length `tally` |
  | M10 | the tallies swapped between the teams' dots |
  | M11 | `PlayScreen`: تلميح never disabled |
  | M12 | `PlayScreen`: `onSkip` and `onHint` swapped |
  | M13 | `PlayScreen`: the reveal always rendered |
  | M14 | `PlayScreen`: `.ltr-num` dropped from the clocks |
  | M15 | `play.module.css`: `animation: pop 0.18s ease-out` written directly |
  | M16 | `play.module.css`: `--pop` at 0.2s |
  | M17 | `HostApp`: `play` routed to `PendingScreen` |
  | M18 | `PlayScreen`: the `.glyph` span dropped from ⏭ |

- [ ] **REQ-6.18 (The four gate commands, no escape hatch):** on a fresh clone at a **short path**
  (Windows `LongPathsEnabled` is 0 on this machine), `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0 on Windows and on this phase's pull request's
  Ubuntu CI (`ci` job); §7's escape-hatch greps return the baseline measured at `77ed5a4` — **5** prose
  lines (`CLAUDE.md:80`, `:140`, `:145`, `press.module.css:48`, `stylelint.config.mjs:19`), **0**
  directives, `skipLibCheck` in `tsconfig.base.json` only, and one `prettier-ignore`
  (`draw.test.ts:561`, Phase 4's) — unchanged.

- [ ] **NFR-6.7 (Six projects, and fast enough):** `[check-collected-tests]` reports **six** projects;
  the `@nel3ab/game` project's duration on Windows on mains power is under **20 s** (three runs); the
  `nel3ab-web` project's duration on Windows and CI's six-project Vitest duration are recorded. If
  over, it is a finding — no test is shrunk.

- [ ] **NFR-6.1 / NFR-6.3 (Configuration and records):** `git diff --stat 77ed5a4 HEAD` lists files
  under `apps/web/app/host/` and `specs/phase-6/` only (and, at close, `specs/roadmap.md` and
  `CLAUDE.md`) — no `design/` file, no other `specs/` file, no lockfile, no manifest, no file of
  NFR-6.3's list.

## 6. Gate 6 — The exit verdicts (once, on the commit at which Gate 5 passed)

- [ ] 🚦 **REQ-6.16 (A full round is playable on one device) (VERDICT GATE — no retry):** on the
  production build of the commit at which Gate 5 passed, in one tab of the built-in browser:
  **(a)** Procedure M6's stepper on both pages, the prototype first, at 480 × 800 light — Table V's
  script by `click()` and `step(n)`, the prototype's reveal timeout held and called on the tenth step
  after each صحيح — and the app's trace equal to the prototype's measured in the same session in
  every cell of Table V (the prototype must reproduce Table V; if it does not, the comparison is page
  against page and its drift from the table is recorded); and **(b)** Table W's run on the app,
  every bound W1–W7 met, W0 holding. **PASS** = (a) 0 differences over V1–V17 and (b) all of W1–W7.
  A run void by W0 or by the raster probe is re-run and the void recorded — those are instrument
  conditions fixed here, not results. **A FAIL here halts the phase** and returns to the owner, with
  every difference listed.

- [ ] 🚦 **REQ-6.17 (The play screen matches the prototype in both themes) (VERDICT GATE — no
  retry):** Procedure M6 on the same build, in the same session: at 480 × 800 and 375 × 800, in light
  and in dark, S1–S5 on the app equal the prototype's as measured in the same session — every role,
  geometry within **0.5 px**, every other field exactly, the raster probe equal on both pages of
  every configuration, the column height equal within 0.5 px in every state. The prototype is
  measured first and must reproduce Tables A–E; if it does not (the raster or the fonts changed),
  the comparison is page against page and the drift from the tables is recorded. **PASS** = 0
  deviations over 5 states × 2 widths × 2 themes. **A FAIL here halts the phase** and returns to the
  owner, with every deviation listed.

- [ ] 👁 **REQ-6.17 (A designer's eye):** full-column screenshots of both pages — S1 and S4, at 480 and
  375 px, in light and dark: **eight** pairs — taken after the two verdicts are recorded, as a
  separate pass that measures nothing, with the app's staged texts as in step 5, and shown side by
  side; **the owner** finds no spacing, radius or shadow deviation. A deviation seen here that the
  measurement missed is a finding, and halts as the boxes above do.

---

## 7. Automated Commands

Written for Git Bash or the Ubuntu CI runner, as Phases 2–5's were.

```bash
# Gate 5 — the four gate commands, in this order, from a fresh clone at a short path
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test                 # = check-collected-tests.mjs --coverage
pnpm build

# Gates 1–3 — iterate (no coverage, no collected-count check)
pnpm vitest run apps/web
pnpm vitest run apps/web/app/host/_lib/play-round.test.ts
pnpm vitest run -t "Y1"

# Gate 2 — Phase 5's files: two edited as specs.md §2.6 says, the rest untouched
git diff 77ed5a4 -- apps/web/app/host/HostApp.tsx apps/web/app/host/host-source.test.ts
git diff --stat 77ed5a4 -- apps/web/app/host/PendingScreen.tsx apps/web/app/host/SetupScreen.tsx \
  apps/web/app/host/ReadyScreen.tsx apps/web/app/host/page.tsx apps/web/app/host/host.module.css \
  apps/web/app/host/setup.module.css apps/web/app/host/ready.module.css apps/web/app/host/_lib/ \
  apps/web/app/host/host-markup.test.tsx apps/web/app/host/host-prototype.test.ts

# Gate 2 — no clock, timer or randomness in the screen or its view (expect 0 lines)
grep -nwE "Date|performance|setTimeout|setInterval|Math\.random|startRound" \
  apps/web/app/host/PlayScreen.tsx apps/web/app/host/_lib/play-view.ts

# Gate 5 — no package and no font change (expect no output)
git diff 77ed5a4 -- packages/ apps/web/app/fonts.ts

# Gate 5 — escape hatches (baseline at 77ed5a4: 5 prose lines, 0 directives; skipLibCheck in
# tsconfig.base.json only; one prettier-ignore at packages/game/src/draw.test.ts:561)
git grep -nE "@ts-expect-error|@ts-ignore|eslint-disable|stylelint-disable|v8 ignore|istanbul ignore|c8 ignore" \
  -- ':!design' ':!specs' ':!pnpm-lock.yaml'
git grep -nE "skipLibCheck|pnpm\.overrides|peerDependencyRules|strict-peer" -- ':!design' ':!specs' ':!pnpm-lock.yaml' ':!*.md'
git grep -n "prettier-ignore" -- ':!design' ':!specs'

# Gate 5 — what changed since the plan's base
git diff --stat 77ed5a4 HEAD

# Gates 4 / 6 — Procedure M6's two servers
(cd design/designs && python -m http.server 8765 --bind 127.0.0.1)
pnpm build && pnpm --filter nel3ab-web start
```

> `pnpm test` forwards extra arguments to `scripts/check-collected-tests.mjs`, which asserts that
> *every* workspace project contributed a file — so it fails on any filtered run. Iterate with
> `pnpm vitest`, gate with `pnpm test`. `vitest run --dir <path>` does **not** filter.

---

## 8. Acceptance Criteria

Phase 6 is complete when **all** of the following hold:

1. **Gate 1** is green — the play view gives every value of Table X, and the prototype's round of
   Table V replays exactly through the driver in CI, its three judge actions reaching the engine.
2. **Gate 2** is green — the screen's markup, glyphs and wiring are as specified, `HostApp` routes
   `play` to it, Phase 5's files changed only where specs.md §2.6 says, nothing leaves the page.
3. **Gate 3** is green — the words, labels, costs and timings are the prototype's, read at run time.
4. **Gate 4** is complete — every table row met in the browser in all four configurations, every
   button, motion and press checked, the real-time round within Table W, every deviation found
   written down with its fix.
5. **Gate 5** is green — no package changed, coverage 100%, all eighteen mutations caught, the four
   gate commands on Windows and Ubuntu CI with no escape hatch, inside the time budget,
   configuration untouched.
6. **Gate 6's two 🚦 verdicts** returned **PASS**, and the owner's look found nothing.
7. Every box above is ticked **with its measured value filled in**.
8. `roadmap.md`'s Phase 6 status is updated and its "Completed Work" section records both verdicts
   with the commit they were measured at, and the findings §9 carries forward.

That is the roadmap's exit criterion — "A full round is playable on one device — clock runs, hints
spend, skips advance, correct reveals and passes the turn" — as REQ-6.16 in criterion 6, its eight
tasks inside criteria 1–4, and `mission.md` §7's design fidelity as REQ-6.17. No criterion appears
here for the first time.

---

## 9. What Would Make This Phase Untrustworthy

- **The tables are the planning session's reading of the prototype.** Tables A–E name the roles a
  designer would look at; a box left out can differ and pass every row. The column-height comparison
  catches any vertical deviation in every state; a horizontal one inside an untabled box is caught
  only by the owner's look.

- **The comparison runs on staged text.** The app's question, hint, answer, variants and fact are set
  to the prototype's before every geometric measurement (requirements, reading 8). The app's own
  placeholder texts are seen only by the real-time round (Table W) and the owner's look, not by a
  table.

- **The tick-for-tick comparison runs on a stepped clock.** REQ-6.16 (a) replaces `setInterval` on
  both pages, so it proves the screens follow the rules tick for tick, not that the loop keeps time.
  Table W does that, with tolerances: a fault that appears only under real timer jitter and stays
  inside W's bounds — a missed tick now and then — would pass.

- **Nothing clicks in CI between `HostApp` and the driver.** The element-tree test proves each Button
  calls its own callback, and `play-round.test.ts` that the driver hands each action to the engine;
  that `HostApp` passes `onSkip` a `skip` is checked only in the browser (Gate 4, and REQ-6.16's
  clicks). A later edit swapping two of `HostApp`'s dispatches would fail no CI test this phase adds
  — only M17's coarser routing mutation is caught there.

- **No CI test can see a running animation.** That the second hint does not slide in, that each
  reveal pops, and that the bar transitions are checked in the browser only (Gate 4). A `key` added
  to the hint element later would replay `slidein` on every hint and fail nothing in CI.

- **The verdicts are run by the same kind of reader who built the screen.** Claude implements and
  Claude measures; the pre-registered tables, measured from the prototype before any code existed,
  are what keeps that from being circular, and the owner's look is the independent check.

- **The browser is one browser.** Every number is Chromium's, on Windows, at a 2 raster. Safari — the
  phones most hosts hold — rounds borders and fonts differently and runs `text-wrap: pretty` on its
  own terms (or not at all in older versions). Nothing here measures it, and no phase yet owns that
  pass (Phase 5 recorded the same).

- **A round after the first is unmeasured.** Won dots and a round team B starts cannot be reached in
  this phase's browser (requirements, reading 6). They are tested in the view and the markup only.

- **A verdict retried into green.** The ways to do it are specific and each is forbidden: a wider
  tolerance than 0.5 px or than Table W's bounds; a table row or a Table V cell dropped; a state
  skipped at one width or theme; the prototype measured with its fonts not loaded; a void declared
  for a reason other than W0 or the raster probe; the real-time run repeated until a timing falls
  inside its bound.

- **The local clock is the browser's timer.** A backgrounded tab's timers are throttled, so a round
  played with the host's screen off runs slow — exactly as the prototype's did; the reveal comes down
  900–1,000 ms after صحيح rather than at exactly 1,000 ms (reading 3). The server owns the clock from
  Phase 11 (`mission.md` §5.2); until then both are accepted, not fixed.

- **Carried forward — binding on later phases, which no test here can check:**
  - **Phase 7** replaces the round-end and match-end placeholders and wires "الجولة التالية", the
    rematch and back to setup. Its browser pass is the first to reach the play screen in a round
    after the first, and measures it against the prototype: won dots, team B starting, team A
    "بالانتظار". Its 🏆, 👑 and ▶ follow REQ-6.12's per-glyph rule (▶ is drawn by the self-hosted
    Baloo, which the prototype's Google subsets omit). Its playtest decides whether the second hint's
    missing entrance is missed (REQ-6.8).
  - **Phase 8** replaces the placeholder questions; real questions run to two and three lines, which
    the question card's 150 px minimum and `text-wrap: pretty` were measured with (Tables B, C).
  - **Phase 11** replaces the driver's clock with the server's; the reveal's hold and the turn pass
    come from the server; "same screens, different source of truth".
  - **Phase 12 and Phase 14:** the play view is a judge view — it carries the answer, the variants
    and the fact. The player's question card is built from the player payload, constructed from
    scratch, never from `playView` with fields removed (`mission.md` §3). Phase 14 decides whether
    the judge's timer card and question card move into `@nel3ab/ui` beside its compact versions
    (REQ-6.6, DECIDED; `tech-specs.md` §2.3).
  - **Phase 16:** the bar's 100 ms `width` transition assumes an update every 100 ms; with a server
    that broadcasts transitions and a client that interpolates, Phase 16 decides how the bar moves.
  - **Phase 23** owns the reveal's announcement to screen readers and the rest of the accessibility
    audit.

---

*Written: 2026-10-03 — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured values may be added;
gates may not be changed except by a dated planning session.*
