# Phase 5 Verification & Test Plan — Judge app: setup & room-ready

> **Phase:** Phase 5
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

**Gate ordering.** **Gates 1–2 are one block and block Gates 4–7**: the engine's setup rules, the two
sanctioned edits to Phases 3–4's tests, and the flow's invariants. STEP 1 of [specs.md](specs.md) §1
lands the eight `Action` members, their reducer cases, `match-purity.test.ts`'s `perType()` edit, the
exports and `index.test.ts`'s edit **in one commit** — measured during planning, `pnpm typecheck` fails
until all of them agree — so the sanctioned-edits box can be ticked inside the block it belongs to. Each
box in the block is ticked as soon as the code it exercises exists. **Gate 3** (the UI kit) is
independent of Gates 1–2 and may run in parallel; it blocks Gate 4's screen boxes. **Gate 4** needs
Gates 1–3. **Gate 5** is the browser pass in which deviations from the prototype are found and fixed;
it needs Gate 4. **Gate 6** is evaluated once, over the finished phase. **Gate 7** is evaluated last,
once, **on the commit at which Gate 6 passed** — no code changes after it.

**Who performs Gates 5 and 7 — DECIDED 2026-10-02 (Ahmed, in the planning session).** Both need a
browser beside the prototype. Claude performs Gate 5 and Gate 7's 🚦 measured box at the owner's
direction, in the Claude desktop app's built-in Chromium browser, as Phase 2's Gate 6 was; **the owner
performs Gate 7's 👁 look** at the eight screenshot pairs. Each box records who performed it. A subagent
with no browser tools cannot tick them; an autonomous run halts before Gate 5 and the session that owns
the browser resumes it.

**A tick with an empty `Measured:` line is not a tick.**

---

## Pre-registered values

Measured on 2026-10-02, before any code existed. The prototype was served read-only
(`python -m http.server 8765 --bind 127.0.0.1` from `design/designs/`) and measured in the desktop app's
built-in Chromium at device-pixel ratio **1.5**, with Baloo Bhaijaan 2 (500/600/700/800) and Archivo
(800) loaded from Google Fonts, by Procedure M below. At DPR 1.5 Chromium paints a 3 px border as
**2.667 px** and a 2.5 px border as **2 px**; the tables give painted values, and both pages snap
identically. **No table in this section may be edited to match a result.**

### Procedure M — how both pages are measured (Gates 5 and 7)

1. **Serve.** The prototype as above. The app as a production build: `pnpm build`, then
   `pnpm --filter nel3ab-web start` (port 3000), `/host`. Each in its own tab of the built-in browser.
2. **Viewport and theme.** Each tab at **480 × 1000**, then at **375 × 900**. Light: the app with
   `prefers-color-scheme: light` emulated, the prototype as loaded. Dark: the app with
   `prefers-color-scheme: dark` emulated; the prototype through its own "ليلي" button (its debug bar is
   its only theme switch).
3. **Fonts.** On the prototype, `document.fonts` shows Baloo Bhaijaan 2 at 500, 600, 700 and 800 and
   Archivo at 800 `loaded` before anything is measured.
4. **Animations.** On both: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0 })`
   — the 🎉's `bob` moves its box by up to 7 px.
5. **The column** is the element whose computed `max-width` is `440px`. Every position is relative to
   it: **x** = the distance from the column's inline-start (right) edge to the box's right edge; **y** =
   from the column's top.
6. **Room-ready on the app only:** before measuring, the room code's text is set to `SKZJ62`, the
   prototype's — different characters are different Archivo advances, and the code is random by design.
7. **Measure** both with this function, verbatim, `col` being the column:

```js
const measure = (root, col) => {
  const cr = col.getBoundingClientRect(), rows = []
  const walk = (el, depth) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    if (cs.display === 'none' || (r.width === 0 && r.height === 0)) return
    rows.push({ depth, tag: el.tagName.toLowerCase(),
      text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim(),
      x: +(cr.right - r.right).toFixed(2), y: +(r.top - cr.top).toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      font: cs.fontSize + '/' + cs.fontWeight, family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, textAlign: cs.textAlign,
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
      border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      radius: cs.borderTopLeftRadius, background: cs.backgroundColor, color: cs.color,
      shadow: cs.boxShadow, opacity: cs.opacity, gap: cs.gap })
    ;[...el.children].forEach(c => walk(c, depth + 1))
  }
  walk(root, 0)
  return rows
}
```

8. **Compare** every row of Tables P–R (and S in dark): x, y, w, h within **0.5 px**; every other
   listed property **exactly** as `getComputedStyle` reports it. The two DOMs differ in wrappers (the
   prototype's runtime wraps each `{{ }}` value in a `<span>`), so rows are matched by role — the
   element the row names — not by walk position.

> **Correction 2026-10-03 — made before the verdict's evaluation, decided by the owner (Ahmed, in
> session: "A — void attempt 2, run the verdict in one tab").** Two attempts at Gate 7 were made and
> are **void**, both recorded in full in commit `f895a65`'s RUN-HALTED.md and its diagnostic
> (`6f057f8`): attempt 1 measured a prototype laid out in a 0 px viewport (the pane was hidden);
> attempt 2 measured the two pages in two tabs that, it was then shown, rasterise at different
> effective ratios — one tab painted a 3 px border as 2.66667 px, the other as 3 px — so the pages
> were not compared on one instrument (and that attempt's property comparison was also broken by a
> fault in the session's measuring script, since fixed and proven: 0 differences on identical
> measurements, 2 of 2 planted differences found). The diagnostic then measured both pages in one tab
> at a true 2-ratio raster: **0** differences on setup and on room-ready. **Procedure M is amended for
> Gate 7 as follows, and nothing else in it changes:** (a) both pages are measured **in one tab, one
> after the other**, each loaded after that configuration's viewport and colour scheme are set, so
> every configuration compares the two at one raster; (b) the painted width of the teams card's 3 px
> border is recorded for both pages of each configuration and must be equal; (c) the prototype is
> measured first and checked against Tables P–R; where the raster reproduces them, both pages must;
> where it does not, step R7's rule applies — the comparison is page against page and the drift from
> the tables is recorded; (d) the measuring script's comparison is the fixed one. The tolerance
> (0.5 px; every other property exactly), the eight configurations and "evaluated once" are
> unchanged.

### Table P — setup, 480 × 1000, light (column 440 px)

The seed room: five players, ماجد judging, rotation off, the eight free categories picked.

| # | Element | x | y | w | h | Other properties |
|---|---|---|---|---|---|---|
| P1 | column | 0 | 0 | 440 | **915.55** | — |
| P2 | header row | 0 | 0 | 440 | 32.67 | 14 px below it |
| P3 | brand (mark + "نلعب") | 0 | 0 | 68.69 | 32.67 | 19px/800, gap 9px |
| P4 | brand mark | 0 | 7.33 | 18 | 18 | border 2px solid rgb(36, 28, 23); radius 50%; bg rgb(236, 48, 19) |
| P5 | round label "إعداد" | 413.65 | 6.33 | 26.35 | 20 | 12px/700; rgb(138, 122, 106) |
| P6 | h1 "يلا نلعب" | 0 | 46.67 | 440 | 39.09 | 34px/800; line-height 39.1px |
| P7 | lede | 0 | 87.76 | 440 | 24.67 | 14.5px/600; rgb(138, 122, 106) |
| P8 | teams card | 0 | 128.43 | 440 | 263.67 | padding 14px ×4; border 2.66667px solid rgb(36, 28, 23); radius 20px; bg rgb(255, 250, 240); shadow rgb(36, 28, 23) 0px 4px 0px 0px |
| P9 | teams head | 16.67 | 145.09 | 406.67 | 25.33 | "الفرق" 15px/800 w 34.76; "5 لاعبين" 12px/600 rgb(138, 122, 106) at x 385.6, w 37.73, h 20 |
| P10 | team A tile | 16.67 | 180.43 | 198.33 | 107.33 | padding 11px ×4; border 2px solid rgb(36, 28, 23); radius 16px; bg rgb(236, 48, 19) |
| P11 | team B tile | 225 | 180.43 | 198.33 | 107.33 | as P10; bg rgb(47, 163, 232) |
| P12 | label "فريق ١" | 29.67 | 198.09 | 28.16 | 18.67 | 11px/700; rgba(255, 255, 255, 0.8) |
| P13 | ↺ (team A) | 177.33 | 193.43 | 24.67 | 28 | 13px; padding 3px 7px 3px 7px; radius 8px; bg rgba(0, 0, 0, 0.18); rgb(255, 255, 255); no border |
| P14 | team A name field | 29.67 | 221.43 | 172.33 | 33.33 | 17px/800; padding 2px 0px 2px 0px; rgb(255, 255, 255); transparent; no border |
| P15 | members A "ريم، نورة، ماجد" | 29.67 | 254.76 | 172.33 | 20 | 11.5px/600; rgba(255, 255, 255, 0.85) |
| P16 | chips container | 16.67 | 297.76 | 406.67 | 77.67 | gap 7px; two rows |
| P17 | chip ريم | 16.67 | 297.76 | 104.69 | 35.33 | 13.5px/700; padding **4px 8px 4px 12px**; border 2px; radius 999px; bg rgb(236, 48, 19); rgb(255, 255, 255); gap 7px |
| P18 | its ↔ / ✕ | 53.87 / 84.36 | 304.09 | 23.49 / 22.99 | 22.67 | 11px/800; padding 2px 7px 2px 7px; radius 999px; bg rgba(0, 0, 0, 0.2) |
| P19 | other chips | سعد 128.35 · نورة 246.48 · خالد 16.67 (y 340.09) · ماجد 132.53 (y 340.09) | — | 111.13 · 107.9 · 108.86 · 112.81 | 35.33 | سعد and خالد bg rgb(47, 163, 232) |
| P20 | judge card | 0 | 406.09 | 440 | 191.67 | as P8 |
| P21 | judge head | 16.67 | 422.76 | 406.67 | 25.33 | 4 px below it; hint "العدد فردي — يفضّل التبديل" 12px/600 at x 291.23, w 132.1 |
| P22 | judge line | 16.67 | 452.09 | 406.67 | 21.33 | 12.5px/600; rgb(138, 122, 106) |
| P23 | choices row | 16.67 | 483.43 | 406.67 | 39.33 | gap 7px; one row |
| P24 | choice ريم | 16.67 | 483.43 | 52.21 | 39.33 | 13.5px/700; padding 6px 14px 6px 14px; border 2px; radius 999px; bg rgb(255, 250, 240); no shadow |
| P25 | other choices | سعد 75.87 · نورة 141.52 · خالد 203.94 · **ماجد 267.32** | 483.43 | 58.65 · 55.42 · 56.39 · 60.33 | 39.33 | ماجد: bg rgb(255, 201, 60), rgb(36, 28, 23), shadow rgb(36, 28, 23) 0px 3px 0px 0px |
| P26 | rotation toggle | 16.67 | 533.76 | 406.67 | 47.33 | 13.5px/700; padding 10px ×4; border 2px; radius 14px; bg rgb(240, 226, 200); text-align right (start); label "○ بدّل الحكم كل جولة" at x 28.67 |
| P27 | categories card | 0 | 611.76 | 440 | 181.13 | as P8; 18 px below it |
| P28 | categories head | 16.67 | 628.43 | 406.67 | 25.33 | "8 من 11 مختارة" at x 352.5, w 70.83 |
| P29 | rail | **2.67** | 663.76 | 434.67 | 112.46 | padding 0px 14px 6px 14px; gap 9px; horizontally scrollable |
| P30 | tile صناعة | **2.67** | 663.76 | 92 | 106.46 | padding 12px 5px 12px 5px; border 2px; radius 16px; bg rgb(255, 201, 60); shadow rgb(36, 28, 23) 0px 3px 0px 0px; gap 5px |
| P31 | tiles 2–5 | 103.67 · 204.67 · 305.67 · 406.67 | 663.76 | 92 | 106.46 | the fifth (ثقافة): bg rgb(255, 250, 240), opacity **0.5**, no shadow |
| P32 | tile صناعة's parts | emoji y 677.76 h 38 (22px) · name y 717.43 (11.5px/700, line-height 13.8px) · tag "مختارة" y 739.55 h 16.67 (10px/800, rgb(138, 122, 106)) | | | | locked tag "🔒 مدفوعة" rgb(236, 48, 19) |
| P33 | CTA "ابدأ اللعبة" | 0 | 810.89 | 440 | 73.33 | 20px/800; padding 17px 20px 17px 20px; border 2.66667px; radius 18px; bg rgb(255, 201, 60); rgb(36, 28, 23); shadow rgb(36, 28, 23) 0px 6px 0px 0px; label at x 22.67, ▶ at x 400.1 |
| P34 | footnote | 0 | 894.22 | 440 | 21.33 | 12.5px/600; rgb(138, 122, 106); centred |

### Table Q — room-ready, 480 × 1000, light

| # | Element | x | y | w | h | Other properties |
|---|---|---|---|---|---|---|
| Q1 | column | 0 | 0 | 440 | **626** | — |
| Q2 | header | as P2–P5, "إعداد" | | | | |
| Q3 | screen root | 0 | 46.67 | 440 | 579.33 | padding 40px 10px 0px 10px; centred |
| Q4 | 🎉 (paused at 0) | 10 | 86.67 | 420 | 92 | 54px; animation-name `bob`, 1s, infinite |
| Q5 | h2 "الغرفة جاهزة!" | 10 | 192.67 | 420 | 44.67 | 26px/800 |
| Q6 | caption | 10 | 253.33 | 420 | 22 | 13px/600; rgb(138, 122, 106) |
| Q7 | code row | 10 | 285.33 | 420 | 60.67 | gap 10px |
| Q8 | room code (text `SKZJ62`) | 77.35 | 287 | 177.03 | 57.33 | Archivo 26px/800; letter-spacing 5.2px; padding 12px 18px 12px 18px; border 2.66667px; radius 16px; bg rgb(255, 250, 240); shadow rgb(36, 28, 23) 0px 4px 0px 0px |
| Q9 | share | 264.39 | 285.33 | 98.25 | 60.67 | 14px/800; padding 14px 16px 14px 16px; border 2.66667px; radius 16px; bg rgb(255, 250, 240); shadow 0px 4px 0px; gap 7px; ⤴ 16px; label "مشاركة" |
| Q10 | in-room panel | 10 | 366 | 420 | 102.67 | padding 14px ×4; border 2.66667px; radius 20px; shadow 0px 4px 0px |
| Q11 | in-room head | 26.67 | 382.67 | 386.67 | 24 | "في الغرفة" 14px/800 w 50.58; "الحكم: ماجد" 12px/600 rgb(138, 122, 106) at x 355.6, w 57.73, h 20 |
| Q12 | chips row | 26.67 | 416.67 | 386.67 | 35.33 | gap 7px; one row |
| Q13 | chips | ريم 26.67 · سعد 81.87 · نورة 143.52 · خالد 201.94 · ماجد 261.32 | 416.67 | 48.21 · 54.65 · 51.42 · 52.39 · 56.33 | 35.33 | 13.5px/700; padding **4px 12px 4px 12px**; border 2px; radius 999px; gap 6px; red / sky; rgb(255, 255, 255) |
| Q14 | "ابدأ الجولة الأولى" | 10 | 486.67 | 420 | **72** | **19px**/800; padding 17px 20px; border 2.66667px; radius 18px; bg rgb(255, 201, 60); shadow 0px 6px 0px; label at x 32.67 |
| Q15 | "رجوع للإعداد" | 10 | 570.67 | 420 | 55.33 | 15px/700; padding 13px ×4; border 2px; radius 16px; bg rgb(255, 250, 240); no shadow |
| Q16 | share, flashed | — | — | 137.09 with "الكود: SKZJ62" | 60.67 | bg rgb(61, 190, 110); rgb(13, 43, 27) — the clipboard-denied path this browser took |

### Table R — both screens, 375 × 900, light (column 347.33 px)

| # | Element | x | y | w | h |
|---|---|---|---|---|---|
| R1 | setup column | 0 | 0 | 347.33 | **982.55** |
| R2 | lede (two lines) | 0 | 87.76 | 347.33 | 49.33 |
| R3 | teams card | 0 | 153.09 | 347.33 | 306 |
| R4 | team tiles | 16.67 / 178.67 | 205.09 | 152 | 107.33 |
| R5 | chips container (three rows) | 16.67 | 322.43 | 314 | 120 |
| R6 | judge card · choices row (one row) | 0 · 16.67 | 473.09 · 550.43 | 347.33 · 314 | 191.67 · 39.33 |
| R7 | rotation toggle | 16.67 | 600.76 | 314 | 47.33 |
| R8 | categories card · rail | 0 · **2.67** | 678.76 · 730.76 | 347.33 · 342 | 181.13 · 112.46 |
| R9 | tiles | **2.67** · 103.67 · 204.67 … | 730.76 | 92 | 106.46 |
| R10 | CTA · footnote | 0 | 877.89 · 961.22 | 347.33 | 73.33 · 21.33 |
| R11 | ready column | 0 | 0 | 347.33 | **626** |
| R12 | room code · share | 31.02 · 218.05 | 287 · 285.33 | 177.03 · 98.25 | 57.33 · 60.67 |
| R13 | in-room panel · its head | 10 · 26.67 | 366 · 382.67 | 327.33 · 294 | 102.67 · 24 |
| R14 | start · back | 10 | 486.67 · 570.67 | 327.33 | 72 · 55.33 |

### Table S — dark

**Geometry is identical to light** at both widths: 0 of the setup screen's 157 measured boxes and 0 of
room-ready's move or resize. Colours, as the prototype computes them:

| Light | Dark | Where |
|---|---|---|
| rgb(36, 28, 23) — ink borders and shadows | **rgb(13, 12, 19)** | every border and every shadow |
| rgb(255, 250, 240) — `--panel` | **rgb(39, 36, 51)** | cards, unselected choices and tiles, room code, share, back |
| rgb(240, 226, 200) — `--sunken` | **rgb(23, 21, 33)** | rotation toggle off |
| rgb(36, 28, 23) — ink text | **rgb(255, 243, 223)** | text on panel and page — **except** text on yellow (selected choice, selected tiles, both CTAs), which stays rgb(36, 28, 23) |
| rgb(138, 122, 106) — `--muted` | **rgb(167, 155, 181)** | labels, notes, the "مختارة" tags |
| rgb(236, 48, 19) — `--red` | **rgb(255, 90, 60)** | brand mark, team A tile and chips, "🔒 مدفوعة" |
| page ground rgb(255, 243, 223) | **rgb(28, 26, 37)** | the frame |
| yellow rgb(255, 201, 60), sky rgb(47, 163, 232), leaf rgb(61, 190, 110), on-leaf rgb(13, 43, 27), white text, the black overlays | unchanged | |

### Table T — the driver's numbers

Rooms are `seedRoom('SKZJ62')` after `openRoom` (on `ready`), unless stated.

| # | Input | Expected |
|---|---|---|
| T1 | `drawRound` with the random sequence 0.5, 0, 0, 0 | category **`proverbs`** (`floor(0.5 × 8)` = 4 of `SEED_PICKED`); questions in the order **٣، ٢، ١**; the source called **4** times |
| T2 | `drawRound` with a source that always returns 0.5 | **`proverbs`**; order **١، ٣، ٢**; **4** calls |
| T3 | 8,000 `drawRound`s with `Math.random` | each of the 8 picked categories drawn **853–1,147** times (1,000 ± 5σ); each of the 6 question orders **1,167–1,500** times (1,333 ± 5σ); never a locked or unpicked category |
| T4 | `startMatch()` (source always 0.5) at fake time 0, then fake time advanced | at 99 ms, **0** loop actions; at 100 ms exactly **`tick` 100, `passTurn`**; at 45,000 ms the screen is **`roundEnd`**, `tallyB` **1**, log **`[{ n: 1, category: 'proverbs', winner: 'b' }]`**, **450** ticks and **450** `passTurn`s dispatched in all; a further 10,000 ms dispatches **0**; the interval was set **once** and cleared **once** |
| T5 | as T4, then `correct` dispatched at 5,000 ms | `revealedAt` **5,000**; at 5,900 ms the reveal is up and `active` is `a`; at **6,000** ms `active` **`b`**, `banks.b` `{ ms: 45,000, started: true }`, `runningSince` **6,000**, `questionIndex` **1**, `banks.a.ms` **40,000** |
| T6 | `makeRoomCode` with sources always 0, always 0.999, always 0.5 | **`AAAAAA`**, **`999999`**, **`SSSSSS`**; 6 calls each; a value of 1, −0.1 or `NaN` throws `RangeError` |
| T7 | `createLocalRoom()` with `Math.random` spied | the spy is called **6** times at creation (the code) and **0** times by `startMatch()` / `nextRound()` on `setup` |
| T8 | `shareRoom('SKZJ62', …)` | share resolves → `'تمت المشاركة ✔'`, clipboard untouched, share called once with `{ title: 'نلعب', text: 'انضم لغرفتنا بالكود SKZJ62', url: 'https://nel3ab.game/j/SKZJ62' }` · rejects `AbortError` → `null`, clipboard untouched · rejects another error → clipboard written with the link → `'نُسخ الرابط ✔'` · rejects `undefined` → the same · no share, clipboard resolves → `'نُسخ الرابط ✔'` · no share, clipboard rejects → `'الكود: SKZJ62'` · neither → `'الكود: SKZJ62'` |
| T9 | `createFlash` under fake timers: `show` at 0, `show` again at 1,000 | the label is set at 0; still set at 2,799; `null` at **2,800**; a single `show` alone clears at **1,800**, not at 1,799 |

### Table U — the setup sample ([specs.md](specs.md) §2.6)

`SETUP_SEED = 0x20265005` · `SETUP_SEQUENCES = 300` · `SETUP_MAX_STEPS = 2_000` · `SETUP_EDITS = 40` ·
`SETUP_TICK_MS = 1_000`. Totals are **reported**, not pre-registered; the sample must show every one of
these at least once: an `openRoom` that fills; a `backToSetup`; a match reaching `match`; a `resetMatch`
back to setup followed by a second `openRoom`; a setup edit attempted, and inert, on `ready` and on
`roundEnd`.

> **Correction 2026-10-03 — made before Gate 2's sample box was ticked, decided by the owner (Ahmed,
> in session: "A — drop it").** As first written, this list also required "an `openRoom` refused by
> the guard". The planning session pre-registered that population without measuring it, and the
> first run of the sample, built exactly as specs.md §2.6 specifies, showed **0** refusals in
> **1,134** `openRoom` attempts: each of the 11 categories ends up picked about half the time, so an
> empty selection has probability ≈ 1/2,048 per attempt — ≈ 0.55 refusals expected over the sample,
> a ≈ 42% chance of seeing one (selection sizes at the attempts measured as {1: 6, 2: 27, 3: 104,
> 4: 176, 5: 248, 6: 260, 7: 190, 8: 86, 9: 28, 10: 8, 11: 1}). The population is **removed**. What
> it would have shown is covered directly: Gate 1's REQ-5.6 box (with nothing picked `openRoom`
> returns its input and `canOpenRoom` is false), its REQ-5.1 box, and E9; and a refused `openRoom` is
> inert by definition, so the sample's invariants gain nothing from it. **What it costs:** the
> generator's recovery branch for a refusal (specs.md §2.6, "if it is inert (nothing picked),
> `pickCategory('c0', true)` then `openRoom`") is not exercised at this seed; it is test support,
> outside coverage, and its absence is recorded here rather than worked around. The alternatives
> considered and rejected were changing the generator so empty selections occur (a new sample to
> measure) and re-running with another seed (the retry-into-green of §10). The seed, the sizes and
> every other constant of this table are unchanged; no other box changes what it accepts. The halt
> note of 2026-10-03 (commit `f07d72d`) is cleared by the same commit as this correction.

---

## 1. Gate 1 — The setup rules (Gates 1–2 are one block; the block blocks Gates 4–7)

- [x] **REQ-5.2 (Removing a player):** on `seedRoom`: removing `seed-5` (ماجد, the judge at 4) gives
  four players and `judgeIndex` **3** (خالد); removing `seed-1` gives `judgeIndex` **3**, still ماجد. On
  a room judged by index 0, removing index 0 keeps `judgeIndex` **0** — the next player. Removing the
  only player, judged at 0, gives `[]` and **0**. An absent id returns the input (`===`).
  > Measured: `setup.test.ts` "REQ-5.2: removing a player keeps the right judge", **6 / 6** — `seed-5` removed → 4 players, judge **3** (خالد); `seed-1` removed → judge **3**, still ماجد; judged by 0, index 0 removed → judge **0**, سعد; a player after the judge removed → judge unchanged (1); the only player removed → `[]`, **0**; `'ghost'` → the input (`toBe`) · STEP 1 commit, 2026-10-03

- [x] **REQ-5.2 (Swapping a player):** swapping `seed-1` puts ريم on team `b`; the other four player
  objects are the input's (`===`); nothing else changes. An absent id returns the input.
  > Measured: `setup.test.ts` "REQ-5.2: swapping a player…", **3 / 3** — ريم to `b`, the other four player objects `toBe` the input's, the rest `toStrictEqual`; a `b` player to `a`; `'ghost'` → the input · STEP 1 commit, 2026-10-03

- [x] **REQ-5.3 (Renaming and the names):** `renameTeam` sets `teamA` or `teamB` to the text — `'x'`
  and `''` both accepted — and returns the input when the name is unchanged. `TEAM_NAMES` equals the
  prototype's lists (E1). `shuffleTeamName('النمور', TEAM_NAMES.a, () => 0)` = **الأسود**; with
  `() => 0.999` = **النسور**; `('الصقور', TEAM_NAMES.b, () => 0.5)` = **الأبطال**;
  `('custom', TEAM_NAMES.a, () => 0)` = **النمور**; exactly one call each; a value of 1, −0.1 or `NaN`,
  or a list holding only the current name, throws `RangeError`.
  > Measured: `setup.test.ts` "REQ-5.3: …", **6 / 6** — `'x'` (team a) and `''` (team b) set; the current name → the input, both teams; `TEAM_NAMES` the two four-name lists, a new room's defaults النمور / الصقور; `shuffleTeamName` → **الأسود · النسور · الأبطال · النمور**, **1** call each; never the current name over 8 names × 5 values (40 draws); `RangeError` for 1, −0.1, `NaN` and a one-name list. (E1, the lists read from the prototype, is REQ-5.8's box, STEP 2.) · STEP 1 commit, 2026-10-03

- [x] **REQ-5.4 (The judge):** `setJudge('seed-1')` gives `judgeIndex` 0; `setJudge('seed-5')` on the
  seed (already judge) and an absent id return the input. `setRotateJudge(true)` sets it;
  `setRotateJudge(false)` on `false` returns the input. `currentJudge(seed)` is ماجد; with no players,
  `null`; on a hand-built room of five with `judgeIndex` 7, نورة (index 2).
  > Measured: `setup.test.ts` "REQ-5.4: the judge", **4 / 4** — `setJudge('seed-1')` → judge 0; `'seed-5'` and `'ghost'` → the input; `setRotateJudge(true)` sets it, `false` after it gives back the seed, `false` on `false` → the input; `currentJudge`: ماجد on the seed · `null` with no players · نورة at index 7 of 5 · ريم at index −1 (the prototype's `|| p[0]`) · STEP 1 commit, 2026-10-03

- [x] **REQ-5.5 (Selection order):** from `SEED_PICKED`-shaped ids, unpicking then re-picking the first
  gives the other seven in order and it **last**; picking a locked-in-the-UI id is recorded (the engine
  has no locks); picking a picked id or unpicking an unpicked one returns the input.
  > Measured: `setup.test.ts` "REQ-5.5: …", **3 / 3** — `industry` unpicked, then picked → the other seven in order and `industry` **last**; `culture` (locked on the screen) recorded; picking a picked id and unpicking an unpicked one → the input · STEP 1 commit, 2026-10-03

- [x] **REQ-5.6 (Open, guard, fill, back):** `openRoom` on the seed gives `ready` with the **same**
  `players` array (`===`). With nothing picked it returns the input, and `canOpenRoom` is `false`. The
  fill, four cases: 0 players → `[fill-1 لاعب ١ a, fill-2 لاعب ٢ b]`; 1 player (p1, a) →
  `[fill-1 a, fill-2 b]`, p1 **dropped**; three on `a` → the three, then `fill-1 لاعب ٢ b`; `fill-1` and
  `fill-2` both on `a` → then `fill-3 لاعب ٢ b`. `backToSetup` on `ready` changes `screen` only; on
  every other screen it returns the input.
  > Measured: `setup.test.ts` "REQ-5.6: …", **7 / 7** — the seed → `ready`, `players` `toBe` the seed's; nothing picked → the input, `canOpenRoom` **false** (true on the seed, false on `ready`); the fill: 0 players → `[fill-1 لاعب ١ a, fill-2 لاعب ٢ b]`; 1 (p1, a) → the same, p1 **dropped**; three on `a` → + `fill-1 لاعب ٢ b`; `fill-1`, `fill-2` on `a` → + `fill-3 لاعب ٢ b`; and two on `b` → + `fill-1 لاعب ١ a`; `backToSetup` on `ready` → the screen only, the input on the other four; `openRoom` → the input on the four screens but setup · STEP 1 commit, 2026-10-03

- [x] **REQ-5.1 (Setup only, and validation first):** each of the six editing actions, in an effective
  form, returns its input (`===`) on `ready`, `play`, `roundEnd` and `match`. Each malformed form —
  `playerId` 7, `{}` or `undefined`; `team` `'c'`; `name` `null`; `rotate` `'yes'`; `picked` 1;
  `categoryId` 3 — throws `RangeError` on **all five** screens.
  > Measured: `setup.test.ts` "REQ-5.1: …", **3 / 3**, over the five screens built through the engine itself (and asserted to be the screens they are named) — each of the 6 effective edits changes the seed; each returns its input on `ready`, `play`, `roundEnd` and `match`: **24 / 24**; the 10 malformed forms (`playerId` 7, `{}`, `undefined` across `removePlayer` / `swapTeam` / `setJudge`; `team` `'c'`; `name` `null`; `rotate` `'yes'`; `categoryId` 3; `picked` 1) throw `RangeError` on every screen: **50 / 50** · STEP 1 commit, 2026-10-03

- [x] **REQ-5.8 (The setup rules, read from the prototype):** each extraction below is read from
  `design/designs/Nel3ab - Arcade.dc.html` at run time, its match count asserted, its value equal to the
  engine's, and each drives the engine.

  | # | Extraction | Count | Drives |
  |---|---|---|---|
  | E1 | `NAMES_A`, `NAMES_B` | 1 each | `TEAM_NAMES.a`, `.b`, element for element |
  | E2 | `removePlayer`'s judge line, `s.judgeIdx >= i && s.judgeIdx > 0 ? s.judgeIdx - 1 : s.judgeIdx` | 1 | evaluated against `judgeAfterRemoval` for judge 0–9 × removed 0–9 |
  | E3 | `startGame`'s fill: `players.length < 2`, the names `'لاعب ١'` / `'لاعب ٢'` and their teams | 1 | `FILL_NAMES`; `fillPlayers` at 0–3 players |
  | E4 | `toggleCat`'s append `[...s.picked, i]` and removal `.filter(x => x !== i)` | 1 | `pickCategory`'s order |
  | E5 | `shuffleName`'s `while(next === cur)` | 1 | `shuffleTeamName` never returns the current name, over every name and r ∈ {0, 0.25, 0.5, 0.75, 0.999} |
  | E6 | the `judge` getter, `p[this.state.judgeIdx % p.length] \|\| p[0]` and `if(!p.length) return null` | 1 | `currentJudge` at 0–6 players × index 0–9 |
  | E7 | `startGame` sets `screen:'ready'`; `backToSetup` sets `{screen:'setup'}` and nothing else | 1 each | `openRoom`'s and `backToSetup`'s changed keys |
  | E8 | `swapTeam`'s `idx === i ? {...p, team: p.team === 'a' ? 'b' : 'a'} : p` | 1 | `swapTeam` |
  | E9 | `startGame`'s default `this.state.picked.length ? this.state.picked : [0,1,2]` — the line the guard replaces (reading 1) | 1 | `openRoom` with nothing picked returns its input |
  > Measured: `setup-rules.test.ts` **10 / 10** — the reader finds **1** logic script, **1** component class and all **7** members read; every extraction's count **1** (E1 `NAMES_A` 1 · `NAMES_B` 1; E3 replacement 1 · team pass 1 · append 1; E5 redraw 1 · list choice 1; E6 1 · 1; E7 1 · 1) and its value the table's: E1 the two four-name lists = `TEAM_NAMES`, a room's defaults their first; E2 `>=`, floor 0, step 1 — evaluated against `judgeAfterRemoval` and driving `removePlayer` at **100 / 100** (judge 0–9 × removed 0–9); E3 threshold 2, لاعب ١ a / لاعب ٢ b, order a, b — `openRoom`'s fill equal to the prototype's at every team assignment of 0–3 players (**15** rooms); E4 `...s.picked,i` (append) — `pickCategory` equal to the prototype's toggle after each of **12** toggles; E5 `===`, `NAMES_A` / `NAMES_B` — every other name reached, the current never (8 names × 5 values); E6 fallback `p[0]` — `currentJudge` equal to the getter at 0–6 players × index 0–9 (**70**); E7 startGame's keys `players, picked, screen, copied`, `'ready'` — `openRoom` changes `screen` only on a full room; `backToSetup` `{screen:'setup'}` — the reducer changes `screen` only; E8 a→b, else a — `swapTeam` over a mixed room of 5; E9 `[0,1,2]` — with nothing picked `openRoom` returns its input · three mutations applied alone and reverted, each failing its own extraction only: `>=`→`>` in `judgeAfterRemoval` (E2), a prepended pick (E4), the fill's `< 2`→`< 1` (E3) · `pnpm test` 27 files across 6 projects, **535 / 535**, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244) · 2026-10-03

- [x] **NFR-5.4 (The engine's surface):** `@nel3ab/game`'s runtime exports are exactly the twenty-one of
  specs.md §2.5, with `TEAM_NAMES` an object and the three new names functions; `FILL_NAMES`,
  `playerIndex`, `judgeAfterRemoval`, `fillPlayers` and `assertSetupAction` exist in `setup.ts` and are
  absent from the package.
  > Measured: `index.test.ts` **4 / 4** — the runtime exports are exactly the **21** names; `kinds`: `TEAM_NAMES` `'object'`, `canOpenRoom` / `currentJudge` / `shuffleTeamName` `'function'`; `FILL_NAMES`, `playerIndex`, `judgeAfterRemoval`, `fillPlayers`, `assertSetupAction` present in `setup.ts` and absent from the package · `pnpm typecheck` exit 0 · STEP 1 commit, 2026-10-03

- [x] **REQ-5.7 (The sanctioned edits, and no others):** relative to `7a60dcc`, the only changed files
  Phases 3–4 wrote under `packages/game/src` are `match-purity.test.ts` and `index.test.ts`, and every
  hunk in them is one of specs.md §2.10's; every other Phase 3 and Phase 4 test file and every file under
  `src/testing/` that existed at `7a60dcc` shows **0** lines of diff.
  > Measured: `git diff -U0 7a60dcc` — `match-purity.test.ts` **+11 −1**: the comment's one sentence and `perType()`'s eight keys at 0; `index.test.ts` **+17 −1**: the `./setup.js` import, the title (seventeen → twenty-one, naming phase-5 §2.5), the sorted list's four names, `kinds`' four entries, the comment's sentence, the internal list's five — every hunk one of specs.md §2.10's · `git diff --stat 7a60dcc` over `clock`, `purity`, `rules`, `prototype-equivalence`, `room`, `reducer`, `draw`, `match`, `match-rules`, `match-equivalence` `.test.ts` and `src/testing/`: **0** lines · `pnpm vitest run packages/game` **384 / 384** with the edits and before `setup.test.ts` existed · STEP 1 commit, 2026-10-03

## 2. Gate 2 — Phases 3–4 kept, purity, and the flow's invariants (same block)

- [x] **REQ-5.7 (Phases 3–4 green):** `pnpm vitest run packages/game` passes every test of Phases 3 and
  4 — their two verdict tests included — with **0** failures and **0** skips; their test count is the
  `7a60dcc` count.
  > Measured: `pnpm vitest run packages/game --reporter=json` — Phases 3–4's **12** test files **384 / 384** passed, **0** failed, **0** skipped, their 🚦 verdict tests among them and green (Phase 3's REQ-3.11 in `prototype-equivalence.test.ts`; Phase 4's REQ-4.14 in `match-equivalence.test.ts` and REQ-4.2 in `draw.test.ts`); the count is `7a60dcc`'s **384**: the ten untouched files show 0 lines of diff, the two §2.10 edits add or remove no test (`index.test.ts` **4 → 4**, one title reworded; `match-purity.test.ts` **5 → 5**), and Phase 4's record at its close is 12 files, 384 tests · the whole project **428 / 428** over 14 files · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 27 files across 6 projects, **535 / 535**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244) · 2026-10-03

- [x] **REQ-5.7 (The invariants, over the sample):** Table U's 300 sequences run through `reduce` with
  Phase 3's I1–I10, Phase 4's J1–J8 and this phase's K1–K5 asserted after every step: **0** violations.
  The totals — sequences, events, actions, `openRoom`s effective and refused, fills, `backToSetup`s,
  matches ended, second `openRoom`s, inert setup edits per screen — are recorded, and every population
  Table U requires is non-zero.
  > Measured: `pnpm vitest run packages/game/src/setup-flow.test.ts --reporter=verbose` **9 / 9** — Table U's sample (`SETUP_SEED` 0x20265005, **300** sequences) through `reduce`, Phase 4's `assertMatchInvariants` (I1–I10 through Phase 3's `invariantViolations`, and J1–J8) and K1–K5 after every step: **0** violations over **404,734** states (300 rooms + **404,434** actions in **241,976** events; setup 46,494 · ready 1,431 · play 351,400 · roundEnd 4,313 · match 1,096); all 300 ended on their second `match`, none at 2,000 events · `openRoom` **1,134** effective, **0** refused (reported, not required — Table U's Correction of 2026-10-03); fills **1,045**; `backToSetup` **288**; matches ended **600**; second `openRoom`s **834**, **546** of them after a `resetMatch`; setup edits on `ready` **297 / 297** inert, on `roundEnd` **478 / 478** inert, on `setup` 45,360 (24,474 inert), on `play` and `match` 0 — every population Table U requires non-zero · K1–K5 each flag a state built to break it, and only it (6 tests) · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 28 files across 6 projects, **544 / 544**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244) · 2026-10-03

- [x] **REQ-5.7 (No path to the fallback):** over the same sample, J6 (`usedCategories.length ===
  round`) never fails and `nextRoundChoices` never returns the whole selection because the unused list is
  empty — Phase 4's fallback is reached **0** times. Recorded in the roadmap at close (Phase 4, R6).
  > Measured: `setup-flow.test.ts`, the same run — J6 **0** violations over the 404,734 states (J4, a round end's unused list non-empty, **0**); **1,861** `nextRound` draws, each from a round end whose unused list was non-empty: Phase 4's fallback reached **0** times, `nextRoundChoices` equal to the unused list at **1,861 / 1,861** · the roadmap record is the phase close's · 2026-10-03

- [x] **NFR-5.3 (Pure):** over the sample, with every state and action deep-frozen: **0** `TypeError`s;
  every step reduced twice gives deep-equal results; every inert step returns its input (`===`) —
  counted per action type, the eight new types included; and the malformed forms of Gate 1 throw on
  every screen the sample visits.
  > Measured: `pnpm vitest run packages/game/src/setup-purity.test.ts --reporter=verbose` **6 / 6** — Table U's sample (`SETUP_SEED` 0x20265005, **300** sequences, 241,976 events) as the unfrozen run and, beside it, a frozen chain (each room copied into objects of its own, every state and action deep-frozen before `reduce`): **404,434** pairs reduced twice, **0** `TypeError`s, **0** results differing from the unfrozen run's, **0** room copies differing; **0** double reductions differing; inert returns (`===`) per type, of that type's pairs — `removePlayer` **4,080** of 6,954 · `swapTeam` **4,119** of 6,976 · `renameTeam` **867** of 4,485 · `setJudge` **5,748** of 7,003 · `setRotateJudge` **1,696** of 3,334 · `pickCategory` **8,739** of 17,383 · `openRoom` **0** of 1,134 (equal to the guard's refusals, 0 at this seed — Table U's Correction) · `backToSetup` **0** of 288 (given on `ready` only) · `passTurn` 149,144 of 162,458 · `correct` 1,151 of 14,465 · `skip` 736 of 8,418 · `hint` 643 of 5,825 · `tick` 0 of 162,458 · `startMatch` 0 of 846 · `nextRound` 0 of 1,861 · `resetMatch` 0 of 546 · `startRound` never given — **0** inert copies, the frozen chain and the unfrozen run agreeing type by type; Gate 1's malformed forms (**14**: `playerId` 7, `{}`, `undefined` on each of `removePlayer`, `swapTeam`, `setJudge`; `team` `'c'`; `name` `null`; `rotate` `'yes'`; `categoryId` 3; `picked` 1) at every arrival on a screen — setup 1,134 · ready 1,134 · play 2,707 · roundEnd 2,107 · match 600 — **107,548 / 107,548** `RangeError`s, 0 not thrown, 0 other errors · four mutations applied alone and reverted, each caught: an inert `setRotateJudge` returning a copy (inert), a write to the input in `swapTeam` (frozen), `setRotateJudge` validating after its inert check (validation first), `Math.random` in `shuffleTeamName` (the ambient test below) · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 29 files across 6 projects, **550 / 550**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244) · 2026-10-03

- [x] **NFR-5.3 / NFR-5.2 (No ambient time, randomness or timers):** the sample and `shuffleTeamName`
  run with `Date.now`, `Math.random`, `performance.now`, `setTimeout` and `setInterval` spied to throw —
  the spies shown live first — and **0** calls. And §8's two greps over `packages/game/src` non-test
  source return **0** lines; the manifest has no dependency key.
  > Measured: `setup-purity.test.ts`, the same run — the whole sample generated and reduced (**300** sequences, 241,976 events, **404,434** reductions, **2,707** draws) and `shuffleTeamName` (**92,988** calls, both teams at each of the 46,494 states on `setup`, a seeded source) under the five spies: shown live **5 / 5** before the run (each called once and threw) and 5 / 5 after it; calls during the run **0** to each of the five; every public helper counted under them — `reduce` 404,434 · `remainingMs`, `displaySeconds` 2 × 404,734 states · `currentQuestion`, `acceptsJudgeActions`, `matchWinner`, `canOpenRoom`, `currentJudge` 404,734 each · `shuffleQuestions` 2,707 · §8's ambient grep and non-relative-import grep over the 9 non-test source files (`clock`, `draw`, `index`, `match`, `reducer`, `room`, `rules`, `setup`, `types`): **0** lines each (with test files included, 109 and 30 — the greps live) · `packages/game/package.json` keys `name, version, private, type, main, types, exports, scripts` — **no** dependency key · the file **4,015 ms** in `pnpm test` (coverage on; 2.2 s alone without), the `@nel3ab/game` project alone with coverage 16 files **443 / 443** in **10.20 s**, the six-project `pnpm test` Vitest Duration **10.49 s** · 2026-10-03

## 3. Gate 3 — The UI kit (independent; blocks Gate 4's screen boxes)

- [x] **REQ-5.23 (The press, importable):** `packages/ui/package.json`'s `exports` holds exactly the
  four entries `"."`, `"./tokens.css"`, `"./base.css"`, `"./press.module.css"`, the last pointing at
  `./src/styles/press.module.css`; a module importing `@nel3ab/ui/press.module.css` gets the **same**
  `press` class `Button` applies.
  > Measured: `pnpm vitest run packages/ui` — `press-export.test.ts` **3 / 3**: the `exports` keys exactly `"."`, `"./tokens.css"`, `"./base.css"`, `"./press.module.css"`, in that order, the last `./src/styles/press.module.css` (the file exists and is the one `Button.tsx` imports); `import … from '@nel3ab/ui/press.module.css'`, resolved through the manifest's `exports`, gives a `press` class **equal** to `press.module.css`'s own and present in `<Button>`'s class list · mutation: the subpath pointed at a byte-identical copy → **2 / 3** fail, the copy's class differing (one rule, not two) · a throwaway probe in `apps/web` (deleted, never committed): the same import under the web project's Vitest **1 / 1**, `pnpm typecheck` exit 0 · the manifest's diff against `7a60dcc` **+2 −1** — the one entry and the comma it needs after `"./base.css"`; no dependency, no version · 2026-10-03

- [x] **REQ-5.23 (A 19 px primary):** `<Button size="md">` renders `data-size="md"`; the default renders
  `data-size="lg"`; `Button.module.css` holds the one rule
  `.button[data-variant='primary'][data-size='md'] { font-size: 19px }`, and the primary rule still
  declares `font-size: 20px`.
  > Measured: `button-size.test.tsx` **16 / 16** — `<Button size="md">` → `data-size="md"`; no `size` → `data-size="lg"`; all **9** variant × size combinations (primary / secondary / action × omitted / `lg` / `md`) emit it; `Button.module.css` holds `.button[data-variant='primary'][data-size='md']` declaring exactly `font-size: 19px`, directly after the primary rule and directly before its hover, and it is the only rule naming `data-size`; the primary rule still declares `font-size: 20px` (Phase 2's `primitives.test.tsx`, unedited, still asserts that rule's declarations exactly); 19px is the prototype's one "ابدأ الجولة الأولى" CTA (count **1**), read at run time, whose padding `17px 20px`, weight 800 and `0 6px 0` are the primary's · three mutations applied alone and reverted, each caught: `data-size` not emitted (**11** fail), the md rule at 20px (**2**), the rule on every variant (**4**) · 2026-10-03

- [x] **NFR-5.4 (Phase 2 untouched):** `@nel3ab/ui`'s runtime exports are still exactly `Button`,
  `Card`, `Dot`, `Panel`, `Pill`; every Phase 2 test passes; `git diff 7a60dcc` over `packages/ui`
  touches `package.json`, `Button.tsx`, `Button.module.css` and the two new test files only.
  > Measured: `pnpm vitest run packages/ui --reporter=json` — Phase 2's **7** test files **83 / 83** passed, 0 failed, 0 skipped (83 before the change too); `index.test.ts` **2 / 2**: the runtime exports exactly `Button`, `Card`, `Dot`, `Panel`, `Pill`; the project **102 / 102** over 9 files · `git diff --stat 7a60dcc` over Phase 2's seven test files: **0** lines; over `packages/ui`: **5** files — `package.json` +2 −1, `Button.tsx` +12, `Button.module.css` +9, and the new `button-size.test.tsx` and `press-export.test.ts` · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 31 files across 6 projects, **569 / 569**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 · 2026-10-03

## 4. Gate 4 — The driver, the stand-ins and the screens (needs Gates 1–3)

- [x] **REQ-5.14 (The catalog):** eleven entries in the prototype's order with specs.md §2.9's ids,
  names, emoji and locks; three placeholder questions each, with two hints, of exactly the placeholder
  text. `host-source.test.ts`: **0** of the prototype's question, answer, variant, hint and fact strings
  occur in any non-test source under `apps/web`.
  > Measured: `pnpm vitest run apps/web/app/host --reporter=verbose` **9 / 9** — `_lib/catalog.test.ts` **5 / 5**: **11** entries equal specs.md §2.9's table row for row (ids, names, emoji — 🏛️ as U+1F3DB U+FE0F — and locks, locked exactly ثقافة، فن، أفلام), ids and names unique; every entry **3** questions equal to the placeholder text with `d` = ١، ٢، ٣ — `alts` `[]`, **2** hints, the fact "معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨" — **33** distinct `q`, all **165** texts carrying تجريبي; `catalogEntry` finds all 11 (`toBe`) and throws `RangeError` for 4 unknown ids · `host-source.test.ts` **4 / 4**: the prototype's `CATS` read at run time — **1** block, **33** `{q:` openings, **33** questions · **33** answers · **34** variants · **66** hints · **33** facts (**199** strings, all distinct), every one found by the whole-token matcher in the prototype's own block; **11** non-test source files under `apps/web` scanned (the catalog among them; no test file, nothing under `node_modules` or `.next`): **0** of the 199 occur (whole-token; plain substring also **0**, measured ad hoc) · eight mutations applied alone and reverted, each caught: a prototype hint as a placeholder hint, a prototype question in a comment, the answer `'Au'` as a literal, the variant `Joey` in a template literal in a new file outside `host` (host-source); ثقافة unlocked, two tiles swapped, 🏛️'s U+FE0F dropped, the fact's ٨ → ٩ (catalog) · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 33 files across 6 projects, **578 / 578**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 · 2026-10-03

- [x] **REQ-5.10 (The seed):** `seedRoom('SKZJ62')` equals `createRoom`'s room with specs.md §2.9's
  players, judge 4, rotation off, `SEED_PICKED`, `النمور` / `الصقور`, 45 s and 3 wins — and the
  prototype's initial `state` read at test time (W6).
  > Measured: `pnpm vitest run apps/web/app/host --reporter=verbose` **16 / 16** — `_lib/seed.test.ts` **5 / 5**: `seedRoom('SKZJ62')` equal, all **21** fields written out, to the room with `seed-1` ريم a · `seed-2` سعد b · `seed-3` نورة a · `seed-4` خالد b · `seed-5` ماجد a, judge **4**, rotation off, النمور / الصقور, `{ roundSeconds: 45, winsNeeded: 3 }`, both banks 45,000 ms, on `setup`; it is `createRoom({ roomCode, teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] })` with exactly **3** fields replaced (`players`, `judgeIndex`, `pickedCategories`); the code is the caller's, `Math.random` called **0** times; `SEED_PICKED` = the catalog's **8** free tiles in order (positions 0,1,2,3,5,6,7,10); J8 and K1–K4 hold on the seed and on `openRoom`'s `ready` (no fill: `players` `toBe` the seed's), each shape flagging a room built to break it and only it · `host-prototype.test.ts` W6 **2 / 2**: the prototype's initial `state` read at run time — **1** logic script, **1** class, **1** `state` block; `players`, `teamA`, `teamB`, `judgeIdx`, `rotateJudge`, `picked` **1** match each; **5** players (5 `{` openings) — equal to `SEED_PLAYERS` by name and team, النمور / الصقور, `4`, `false`, `[0,1,2,3,5,6,7,10]` through `CATALOG`'s order = `SEED_PICKED`, and `seedRoom`'s room holding each, its judge the prototype's ماجد · six mutations applied alone and reverted, each caught: judge 4 → 3, نورة on b, two picks swapped, rotation on, team A's second name, a repeated id · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 35 files across 6 projects, **585 / 585**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 · 2026-10-03

- [x] **REQ-5.10 / REQ-5.11 (Room code and default source):** Table T6 and T7.
  > Measured: `pnpm vitest run apps/web/app/host --reporter=verbose` **45 / 45** — `_lib/room-code.test.ts` **7 / 7**: T6 — always 0 → **`AAAAAA`**, always 0.999 → **`999999`**, always 0.5 → **`SSSSSS`**, **6** calls each; all **36** characters reached at `floor(r × 36)`, one call per character in call order (0, 0.05, 0.3, 0.7, 0.75, 0.99 → `ABKZ19`); 1, −0.1 and `NaN` (and ∞) throw `RangeError` naming the value; a 1 at the 4th call throws after **4** calls; the alphabet A–Z then 0–9, 36 distinct, length 6 · T7 — `createLocalRoom()` with `Math.random` spied: **6** calls at creation, the code the spy's (`SSSSSS` for 0.5; the room otherwise `seedRoom`'s), **0** `setInterval`s; `startMatch()` and `nextRound()` on `setup`: **0** further calls, the state the same object, **0** notifications; the code kept across `openRoom` → `backToSetup` → `openRoom`, still 6 calls · mutations applied alone and reverted, each caught: `startMatch()`'s screen guard dropped (D8) and `nextRound()`'s — T7 and the driver's off-screen test fail (**2**) · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 37 files across 6 projects, **614 / 614**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 · 2026-10-03

- [x] **REQ-5.11 (The draw):** Table T1 and T2 exactly; `startMatch()` and `nextRound()` dispatch the
  `drawRound` result; Table T3's bounds hold with the real `Math.random`.
  > Measured: the same run — `_lib/driver.test.ts` REQ-5.11 **8 / 8**: T1 — 0.5, 0, 0, 0 → **`proverbs`** (`floor(0.5 × 8)` = 4 of `SEED_PICKED`), order **٣، ٢، ١**, **4** calls; T2 — always 0.5 → **`proverbs`**, **١، ٣، ٢**, **4** calls, the catalog's own question objects in a new array; the draw follows `drawableCategories` (0 → industry, 0.999 → science on `ready`; 0.5 → society of the 7 unused on a round end) and the catalog it is given (a two-question entry → **3** calls; a catalog without the category → `RangeError`) · `startMatch()` on `ready` dispatches exactly `{ type: 'startMatch', ...drawRound(…) }`, **4** calls; a whole match driven under fake timers: each of **4** `nextRound()`s dispatches its round end's `drawRound` result, **4** calls each — proverbs, society, history, nature, religion — and the rematch `startMatch()` on `match` (2–3, b) draws from the whole selection again, proverbs, **4** calls; off their screens both are no-ops: **0** calls, **0** actions reach the reducer · T3 — **8,000** `drawRound`s with the real `Math.random` (spied through: **32,000** calls): exactly the 8 picked categories, never a locked or unpicked one — industry **977** · animals **1,012** · nature **1,006** · society **955** · proverbs **997** · history **1,035** · religion **1,009** · science **1,009** (bounds 853–1,147); all **6** orders — ١٢٣ **1,323** · ١٣٢ **1,319** · ٢١٣ **1,322** · ٢٣١ **1,336** · ٣١٢ **1,364** · ٣٢١ **1,336** (bounds 1,167–1,500); inside the bounds on every run this session, R3's re-run never needed · mutations applied alone and reverted, each caught: D4 `drawableCategories(state)[0]` (**8** fail, T1 and T3 among them), D5 no shuffle (**5**, T1 and T3 among them) · gate commands as above · 2026-10-03

- [x] **REQ-5.12 (The loop):** Table T4 and T5 exactly, under Vitest's fake timers.
  > Measured: the same run — `_lib/driver.test.ts` REQ-5.12 **5 / 5**, under Vitest's fake timers through the driver's default timers (`globalThis`): T4 — `startMatch()` (always 0.5) at 0: `setInterval` **1** call, with **100**; at 99 ms **0** loop actions; at 100 ms exactly **`tick` 100, `passTurn`**; still `play` at 44,900 ms; at 45,000 ms **`roundEnd`**, `tallyB` **1**, log **`[{ n: 1, category: 'proverbs', winner: 'b' }]`**, **450** ticks and **450** `passTurn`s, alternating, every tick 100 ms; a further 10,000 ms **0** actions; `setInterval` **1**, `clearInterval` **1** with its handle, **0** timers left; `Date.now` and `performance.now` **0** calls · T5 — `correct` at 5,000 ms: `revealedAt` **5,000**; at 5,900 ms the reveal up, `active` `a`, `questionIndex` 0; at **6,000** ms `active` **`b`**, `banks.b` **`{ ms: 45,000, started: true }`**, `runningSince` **6,000**, `questionIndex` **1**, `banks.a.ms` **40,000** · no timer on `setup` or `ready` (0 `setInterval`s over 10,000 ms); a `skip` that empties the bank stops the loop in that dispatch; `nextRound()` restarts it (2 set, 2 cleared, 0 timers left after `resetMatch`); `dispose` clears it, the room stays usable and the next change on `play` (a `hint`) restarts it; injected timers, handle `0` cleared · mutations applied alone and reverted, each caught: D1 no `passTurn` (**5** fail, T4 and T5 among them), D2 1,000 ms every 1,000 ms (**6**, T4 among them), D3 never cleared (**4**, T4 among them) · gate commands as above · 2026-10-03

- [x] **REQ-5.13 (No `startRound`):** over a recorded session — setup edits, `openRoom`, `backToSetup`,
  `openRoom`, `startMatch()`, 450 intervals, `nextRound()`, 100 intervals — the dispatch log holds **0**
  `startRound`; `DriverAction` does not admit `startRound`, `startMatch`, `nextRound`, `tick` or
  `passTurn` (a type test); `host-source.test.ts`: **0** occurrences of `startRound` in non-test source
  under `apps/web`.
  > Measured: the same run — the recorded session through a recording reducer under fake timers: seven setup edits — each of the six kinds — and a `shuffleTeamName`, `openRoom`, `backToSetup`, `openRoom`, `startMatch()`, **450** intervals (round end), `nextRound()`, **100** intervals (round 2 on `play`) — **1,113** actions dispatched, **0** `startRound` (swapTeam 1 · removePlayer 1 · renameTeam 2 · setJudge 1 · setRotateJudge 1 · pickCategory 2 · openRoom 2 · backToSetup 1 · startMatch 1 · nextRound 1 · tick 550 · passTurn 550) · the type test, checked by `pnpm typecheck`: `DriverAction['type']` is exactly specs.md §2.9's **12**; `Exclude<Action['type'], DriverAction['type']>` is exactly `startRound | startMatch | nextRound | tick | passTurn`, each `Extract`ed from `DriverAction` as `never`; `dispatch` takes `DriverAction` — mutation: `'tick'` admitted → `tsc --build` exit 1, **3** errors in `driver.test.ts` · `host-source.test.ts` REQ-5.13 **2 / 2**: **14** non-test source files under `apps/web` scanned (`driver.ts` and `room-code.ts` among them; the build's `next-env.d.ts` included), **0** contain `startRound` (plain substring); the search live against the engine's `types.ts` · mutations: `'startRound'` admitted in `DriverAction`, and `// never startRound` in a comment of `driver.ts` → the grep fails on `driver.ts` · gate commands as above · 2026-10-03

- [x] **REQ-5.21 (Share and flash):** Table T8's seven paths and T9's timings exactly.
  > Measured: `pnpm vitest run apps/web/app/host --reporter=verbose` **93 / 93** — `_lib/share.test.ts` **13 / 13**: T8, `shareRoom('SKZJ62', …)` — share resolves → **'تمت المشاركة ✔'**, share called **1** time with exactly `{ title: 'نلعب', text: 'انضم لغرفتنا بالكود SKZJ62', url: 'https://nel3ab.game/j/SKZJ62' }`, clipboard untouched · rejects `AbortError` (a `DOMException`) → **`null`**, clipboard untouched · rejects `NotAllowedError` → the link written **1** time → **'نُسخ الرابط ✔'** · rejects `undefined` → the same · no share, clipboard resolves → **'نُسخ الرابط ✔'** · no share, clipboard rejects → **'الكود: SKZJ62'** · neither → **'الكود: SKZJ62'**; a dismissal is an object named `AbortError` (**3** forms → `null`), **10** other rejections (`undefined`, `null`, `0`, `''`, the string `'AbortError'`, an `Error` with that message, …) → the clipboard; share failing with the clipboard failing, absent or without `writeText` → the raw code; both methods called on their own object (navigator's receiver); a synchronous throw handled as that method's rejection; `Navigator` is a `ShareTarget` (type test) · `_lib/flash.test.ts` **8 / 8**: T9 under fake timers through the default `globalThis` — one `show`: set at 0, still set at **1,799**, `null` at **1,800**; `show` at 0 and again at 1,000: set at 0, still set at **2,799**, `null` at **2,800**, **0** timers left; a second label restarts from its press; on injected timers the prototype's order — report, clear the pending handle (`0` included), set **1800**; `dispose` clears without reporting · `host-prototype.test.ts` W5 **1 / 1**: the prototype's `shareRoom` read at run time — **1** block; the link base, `flash`, the share call, its outcome, the clipboard's outcome and the no-clipboard branch **1** match each, `flash(` **4** — `'https://nel3ab.game/j/'`, `'نلعب'`, `'انضم لغرفتنا بالكود '`, `'تمت المشاركة ✔'`, `'نُسخ الرابط ✔'`, `'الكود: '` (both branches), **1800**, `'AbortError'` — equal to `SHARE_URL_BASE`, to `shareRoom`'s payload and labels path by path, and to `FLASH_MS` and `createFlash`'s timer calls · mutations applied alone and reverted, each caught: D6 `AbortError` falls through (**4** fail), D7 `FLASH_MS` 1,000 (**7**), `undefined` taken for a dismissal (**3**), `share` called detached (**1**), the pending countdown not cleared (**4**), `share` typed to resolve a string (`pnpm typecheck` exit 1, the `Navigator` type test among **17** errors) · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 40 files across 6 projects, **662 / 662**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0 · 2026-10-03

- [x] **REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 (The view):** `setupView` and `readyView` give every label of specs.md
  §2.9's table for the seed and for edited rooms: "5 لاعبين" / "4 لاعبين"; members and "بدون لاعبين";
  both judge hints; both rotation labels; "8 من 11 مختارة" / "0 من 11 مختارة"; each tile's tag;
  `canStart` false with nothing picked; the footnote with 45; "إعداد" and "جولة 2 — أول 3 جولات";
  "الحكم: ماجد" and "—".
  > Measured: the same run — `_lib/view.test.ts` **24 / 24**: on the seed — **"5 لاعبين"**; فريق ١ النمور **"ريم، نورة، ماجد"** · فريق ٢ الصقور **"سعد، خالد"**; **5** chips in order; **"العدد فردي — يفضّل التبديل"**; ماجد's choice alone selected; **"○ بدّل الحكم كل جولة"**; **"8 من 11 مختارة"**; the **11** tiles — 8 **"مختارة"**, ثقافة · فن · أفلام **"🔒 مدفوعة"**; `canStart` true; **"الحكم يشوف الإجابات · 45 ثانية لكل فريق · ما تحتاج تسجّل دخول"**; exactly the table's **11** fields — and on rooms edited through `reduce`: سعد removed → **"4 لاعبين"**, **"ثابت طول المباراة"**, ماجد still selected; ريم swapped → "نورة، ماجد" / "ريم، سعد، خالد"; a team emptied, either side → **"بدون لاعبين"**; everyone removed → "0 لاعبين", no chips, no choices; names `'x'` and `''` as typed; ريم chosen; index 7 of 5 → no choice selected (`===`) while the judge is نورة; rotation on → **"✔ بدّل الحكم كل جولة"**, off again → "○ …"; nothing picked → **"0 من 11 مختارة"**, the eight free tags `''`, `canStart` **false**; one unpicked "7 من 11 مختارة", re-picked "8 من 11 مختارة"; ثقافة picked → selected and still "🔒 مدفوعة", "9 من 11 مختارة"; a two-tile catalog "1 من 2 مختارة"; a 60 s room → the note with 60; on `ready` the edits inert and the view the seed's but `canStart` false · `roundLabel` / `readyView`: **"إعداد"** on setup and ready; "جولة 1 — أول 3 جولات" on play and the round end; **"جولة 2 — أول 3 جولات"** on round 2; "جولة 5 — أول 3 جولات" on the match end (2–3); "إعداد" after `resetMatch`; "جولة 1 — أول 2 جولات" in a room of 2 · `readyView` on ready → `SKZJ62`, **ماجد** ("الحكم: ماجد"), 5 chips; ريم when chosen; سعد of a pair; **"—"** with no players; لاعب ١ / لاعب ٢ after the fill · `host-prototype.test.ts` W4 **1 / 1**: `renderVals` read at run time — **1** block; members **2** matches, `i === s.judgeIdx` **3**, the other 11 extractions **1** each; its **21** parts (`' لاعبين'`, `'، '`, `'بدون لاعبين'`, both hints, `'✔ '`, `'○ '`, `'بدّل الحكم كل جولة'`, `' من '`, `' مختارة'`, `'🔒 مدفوعة'`, `'مختارة'`, `''`, the footnote's two parts, `'إعداد'`, `'جولة '`, `' — أول '`, `' جولات'`, `'—'`, `'مشاركة'`) — the prototype's expressions, evaluated over **16** rooms × **2** catalogs, equal to `setupView`, `readyView` and `roundLabel`, every part shown at least once; `SHARE_LABEL` is `'مشاركة'` · mutations applied alone and reverted, each caught: the judge choice by modulo (**2** fail), members without "بدون لاعبين" (**3**), "لاعب" for "لاعبين" (**5**), the lock ignored in the tag (**5**), `SHARE_LABEL` changed (**2**) · gate commands as above · 2026-10-03

- [x] **REQ-5.15 – REQ-5.20 (The markup):** the static markup of `SetupScreen` and `ReadyScreen` for the
  seed holds every text of W1 and W3, the three `title`s of W2, `data-team` on tiles and chips,
  `data-selected` on ماجد's choice and the eight picked tiles, `data-locked` on three tiles with neither
  `disabled` nor `aria-disabled`, `data-on` on the toggle, `data-flash` on share when a label is given,
  the CTA `disabled` when `canStart` is false, `data-size="md"` on the ready CTA, and `.ltr-num` on the
  room code; `HostApp`'s server markup holds no debug-bar text ("شاشة الحكم", "شاشة لاعب", "نهاري",
  "ليلي") and is **identical** for two different random sources.
  > Measured: `pnpm vitest run apps/web/app/host --reporter=verbose` — `host-markup.test.tsx` **16 / 16**: `SetupScreen` for the seed — W1's **14** texts in the prototype's order, each once but ↺ **2**, ↔ **5**, ✕ **5**, every view value between them, the team names the two fields' values (`aria-label` فريق ١ / فريق ٢); W2's titles on **12** buttons — اسم ثاني ×2, بدّل الفريق ×5, حذف ×5 — each also its `aria-label`, no other titled element; `data-team` on the **2** team tiles (a, b) and the **5** chips (a, b, a, b, a; red / sky); `data-selected="true"` on ماجد's choice alone of 5 and on the **8** picked tiles, `aria-pressed` the same; `data-locked="true"` on **3** tiles — ثقافة، فن، أفلام — and **0** of the 11 carrying `disabled` or `aria-disabled` (ثقافة picked: locked and selected); `data-on` false on the seed, true with rotation on ("✔ بدّل الحكم كل جولة"); the CTA primary `data-size="lg"`, enabled on the seed, `disabled=""` and `aria-disabled="true"` with nothing picked ("0 من 11 مختارة"), the screen's only disabled element · `ReadyScreen` on ready — W3's texts in order with `SKZJ62`, مشاركة, "الحكم: ماجد" and the 5 chips (**16** runs), 🎉 and ⤴ `aria-hidden`, "الحكم: —" with no players; `.ltr-num` on the room code; `data-flash` false with "مشاركة" and no label, true with "نُسخ الرابط ✔", share carrying `press.press` (Button's class); chips `data-team` a, b, a, b, a; "ابدأ الجولة الأولى" `data-variant="primary"` **`data-size="md"`**, back `secondary`, 3 buttons, none disabled · `PendingScreen` on `play` → `roundEnd`: the key in `.ltr-num`, round 1, clocks 45 / 45 → 0 / 45, tallies 0–0 → 0–1, no button, none of the round's 15 question strings · `HostApp`'s server markup: `data-screen="setup"`, the header "نلعب" and "إعداد", then the seed's `SetupScreen` markup verbatim; **0** of "شاشة الحكم", "شاشة لاعب", "نهاري", "ليلي", "Nel3ab trivia", no `data-theme`; `Math.random` always 0 and always 0.999 — **6** calls each (codes AAAAAA / 999999) — markup **identical**, and identical again under the real `Math.random`, neither code in it; `/host`'s page renders it · ten mutations applied alone and reverted, each caught: locked tiles `disabled` (**2** fail), the room code in the header (**3**, the identical-markup test among them), the start CTA at `lg`, `data-flash` always false, `ltr-num` dropped, the CTA never disabled, the choice's `data-selected` false, the toggle's `data-on` and the chips' `data-team` dropped (**1** each), "ليلي" in the frame (**3**) · `pnpm lint`, `pnpm typecheck` exit 0; `pnpm test` 41 files across 6 projects, **685 / 685**, `[check-collected-tests] OK`, coverage 100% (lines 201 · branches 216 · functions 48 · statements 244); `pnpm build` exit 0, `/host` static · 2026-10-03

- [x] **REQ-5.22 (The words and the driver's numbers, read from the prototype):** each extraction
  below is read at run time, its count asserted, and asserted equal to what the app renders or holds.

  | # | Extraction | Asserted against |
  |---|---|---|
  | W1 | every literal text node of the setup block — the header's "نلعب", "يلا نلعب", the lede, "الفرق", "فريق ١", "فريق ٢", ↺, ↔, ✕, "الحكم", the judge line, "الفئات", "ابدأ اللعبة", ▶ | `SetupScreen`'s markup |
  | W2 | the `title` attributes "اسم ثاني", "بدّل الفريق", "حذف" | `SetupScreen`'s markup |
  | W3 | every literal text node of the ready block — 🎉, "الغرفة جاهزة!", the caption, ⤴, "في الغرفة", "الحكم: ", "ابدأ الجولة الأولى", ▶, "رجوع للإعداد" | `ReadyScreen`'s markup |
  | W4 | `renderVals`' labels: `' لاعبين'`, `'، '`, `'بدون لاعبين'`, both judge hints, `'✔ '`, `'○ '`, `'بدّل الحكم كل جولة'`, `' من '`, `' مختارة'`, `'🔒 مدفوعة'`, `'مختارة'`, the footnote's two parts, `'إعداد'`, the round label's parts, `'—'`, `'مشاركة'` | `view.ts` |
  | W5 | `shareRoom`: `'https://nel3ab.game/j/'`, `'نلعب'`, `'انضم لغرفتنا بالكود '`, the three labels, `1800`, `'AbortError'` | `share.ts`, `flash.ts` |
  | W6 | the initial `state`: players, `teamA`, `teamB`, `judgeIdx`, `rotateJudge`, `picked` | `seed.ts` (picked through `CATALOG`'s order) |
  | W7 | `CATS`' eleven names, emoji and `locked` | `CATALOG`, in order |
  | W8 | `startClock`'s interval, `}, 100)` | `TICK_MS` |
  | W9 | the `<title>`, "نلعب — لعبة المعلومات" | `page.tsx`'s metadata |
  > Measured: `pnpm vitest run apps/web/app/host --reporter=verbose` — `host-prototype.test.ts` **10 / 10**, all nine extractions in it, each read at run time: W1 — the header row **1** block, the setup block **1** (**0** nested `sc-if`; `sc-for` chips, judgeOptions, catGrid); literal text runs **1** ("نلعب") + **14** (يلا نلعب, the lede, الفرق, فريق ١, ↺, فريق ٢, ↺, ↔, ✕, الحكم, the judge line, الفئات, ابدأ اللعبة, ▶), none mixed with a placeholder; `SetupScreen` for the seed renders them in that order and as many times as the template renders them for its lists — ↺ **2**, ↔ **5**, ✕ **5**, the other 11 once; `HostApp`'s markup "نلعب" first, then the 14 in order · W2 — **4** titles (اسم ثاني ×2 on ↺, بدّل الفريق on ↔, حذف on ✕), 2 outside every list, 2 inside the chips' `sc-for`; `SetupScreen` **12** titled buttons = 2 + 5 × 2, the same glyphs, each `aria-label` its title · W3 — the ready block **1** (`sc-for` chips), **9** literal runs (🎉, الغرفة جاهزة!, the caption, ⤴, في الغرفة, "الحكم: {{ judgeName }}", ابدأ الجولة الأولى, ▶, رجوع للإعداد); `ReadyScreen` renders each once, in order, "الحكم: ماجد" in the placeholder's place · W9 — `<title>` **1** match, "نلعب — لعبة المعلومات" = `page.tsx`'s `metadata.title` · W4–W8 unchanged and green · six mutations applied alone and reverted, each caught: a W2 title (بدّل → بدل), the lede, the caption, `metadata.title`, the header's "نلعب", "الحكم: " → "الحكم : " (**1–2** fail each) · gate commands as in the markup box · 2026-10-03

- [x] **NFR-5.7 (Nothing leaves the page):** `host-source.test.ts`: **0** occurrences of `fetch(`,
  `WebSocket`, `EventSource`, `sendBeacon`, `XMLHttpRequest` or `localStorage` in non-test source under
  `apps/web/app/host`.
  > Measured: `host-source.test.ts` NFR-5.7 **3 / 3** — **15** non-test source files under `apps/web/app/host` scanned (`page.tsx`, `HostApp.tsx`, the three screens, the three stylesheets, the seven `_lib` modules; no test file): **0** occurrences of each of `fetch(`, `WebSocket`, `EventSource`, `sendBeacon`, `XMLHttpRequest`, `localStorage` (plain substring, comments included; `grep -rnE` over the same 15 files also **0** lines); the search live — all **6** found in TypeScript's `lib.dom.d.ts` · mutation: `localStorage` named in a comment of `HostApp.tsx` → caught · gate commands as in the markup box · 2026-10-03

- [x] **NFR-5.8 (RTL):** `pnpm lint:css` passes over the three new stylesheets with **0** disable
  comments; they contain no `left` / `right` property or value.
  > Measured: `pnpm lint:css` exit 0; `stylelint` over the three new stylesheets **0** warnings each (`host.module.css` 7 rules, `setup.module.css` 36, `ready.module.css` 19); `stylelint-disable` **0**; `grep -ciE 'left|right'` **0** in each, comments included — the prototype's physical `text-align` written `start` (rotation toggle, in-room panel) and its `margin: 0 -14px` written `margin-inline: -14px` (rail); the room code `.ltr-num` (`host-markup.test.tsx`) · 2026-10-03

## 5. Gate 5 — Fidelity in the browser (needs Gate 4; fix freely)

- [x] 👁 **REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 (Setup against Table P):** Procedure M at 480 × 1000, light: every row of
  Table P within tolerance. Every deviation found is written down here, with its fix.
  > Measured: performed by Claude (`claude-opus-5-5`) at the owner's direction (DECIDED 2026-10-02), in the desktop app's built-in Chromium, /host's production build (`next start`, rebuilt at each fix) beside the prototype, both at DPR **1.5** — the pane's natural ratio, viewports 497 and 533 px (any width ≥ 468 gives the 440 px column; viewport emulation forced DPR 2 in this session, so the wide pass ran without it). The prototype, re-measured first, reproduces Table P (P1 915.55, P8 263.67, P10 198.33 × 107.33, P17 104.69, P26 47.33, P29 2.67 / 434.67, P30 92 × 106.46, P33 440 × 73.33, P34 21.33) — no R7 drift. Procedure M's walk, matched by role, **103** roles × 17 properties per page: at `7230ef6` **25** differences, all one cause — **deviation 1, FIXED in `1f3a406`**: UI glyphs Baloo lacks were drawn by next/font's Arial-based "baloo Fallback" instead of the system font (↔ 10.66 px against 9.48 at 11px/800, each chip 1.18 px wider; ▶ 12.54 against 17.23); after the fix, with a nested span for flex-item glyphs (the CTA ▶ had sat 3.66 px low): **0** geometry or style differences, every glyph baseline equal (↺ 210.43, ↔ and ✕ 318.09, ○ 560.43, ▶ 851.89). **Deviation 2, FIXED in `7230ef6`** (found by Gate 4's screens unit; recorded here as the halt note asked): both primary CTAs need `width: 100%`, which specs.md §2.11 omits — a `<button>` keeps its content width (58.83 px measured in a 400 px box); P33 is 440 px. **Not a deviation:** the rotation toggle's computed `text-align` is `start` against the prototype's physical `right` — identical in this RTL document, and NFR-5.8's logical form. Method note: a baseline probe beside bare text in a flex box measures the box's centre, so the chip names were compared by their text boxes — identical (ريم 26.67 / 303.76 / 20.21 × 23.33) · 2026-10-03

- [x] 👁 **REQ-5.20 (Room-ready against Table Q):** as above, Table Q (Q16 by pressing share).
  > Measured: same session and method, at DPR 1.5, the app's code text set to `SKZJ62` (Procedure M step 6) after `document.fonts.ready` — Archivo loads only when room-ready first shows; measured before it loaded the code box read 167.6 px, a timing artefact of the measurement, not a deviation. The prototype reproduces Table Q (Q1 626, Q4 92, Q8 77.35 / 287 / 177.03 × 57.33, Q9 264.39 / 98.25 × 60.67, Q10 102.67, Q13 48.21 × 35.33, Q14 420 × 72, Q15 420 × 55.33). **24** roles × 17 properties: **0** geometry or style differences besides the computed `text-align` keyword on the in-room panel and its nine descendants (`start` against `right`, identical in RTL); the ▶ and the ⤴ sit on the prototype's baselines (527, 319.33); the share icon's box 283.05 / 302 / 11.73 × 27.33, the prototype's. Q16: with the clipboard refusing, the share flashes "الكود: <code>" on rgb(61, 190, 110) with rgb(13, 43, 27), 60.67 px tall, as the prototype; the width carries the code's glyphs — **141.27** px for this room's `GTUTF9` on both pages (the prototype's flashed label set to the same code), 137.09 for the prototype's own `SKZJ62` · 2026-10-03

- [x] 👁 **REQ-5.15 – REQ-5.20 (Phone width and dark):** Table R at 375 × 900, light; Tables P–R's
  geometry and Table S's colours in dark, both widths.
  > Measured: Table R at 375 px (viewport emulation; the pane reported DPR 2, yet the prototype reproduced every row of Table R exactly — R1 347.33 × 982.55, R2 49.33, R3 306, R4 152 × 107.33, R5 120 (three chip rows), R7 314 × 47.33, R8 rail 2.67 / 342, R10 877.89, R11 626, R12 31.02 / 218.05, R14 486.67 / 570.67): /host **0** differences on both screens. Dark (the prototype's ليلي; the app's `prefers-color-scheme: dark` emulated): setup and room-ready at 480 px × DPR 1.5 and at 375 px — **0** differences over 103 + 24 roles × 17 properties, so every Table S colour equal (page rgb(28, 26, 37), panel rgb(39, 36, 51), sunken rgb(23, 21, 33), ink rgb(255, 243, 223), muted rgb(167, 155, 181), red rgb(255, 90, 60), every border and shadow rgb(13, 12, 19); the selected choice and tiles keep rgb(36, 28, 23) on yellow) and geometry identical to light; glyph baselines equal · **8 / 8** screen × width × theme combinations match · 2026-10-03

- [x] 👁 **REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 (Every control does what it says):** on `/host`, from the seed:
  ↔ on ريم makes her chip sky and the members "نورة، ماجد" / "ريم، سعد، خالد"; ✕ on سعد gives
  "4 لاعبين", "ثابت طول المباراة" and ماجد still selected; choosing ريم selects her; the toggle reads
  "✔ بدّل الحكم كل جولة" on `--leaf`; ↺ changes team A's name to another of the four; typing renames;
  unpicking صناعة gives "7 من 11 مختارة" and re-picking it moves it to the end of the selection; pressing
  ثقافة changes nothing; unpicking all eight gives "0 من 11 مختارة" and a CTA at opacity 0.45 that does
  not move when pressed; the rail scrolls sideways with no scrollbar.
  > Measured: on a fresh /host, by clicks on the page's own controls and real keystrokes: ↔ on ريم → her chip rgb(47, 163, 232), members "نورة، ماجد" / "ريم، سعد، خالد"; ✕ on سعد → "4 لاعبين", "ثابت طول المباراة", ماجد still the selected choice; choosing ريم → selected, `judgeIndex` 0; the toggle → "✔ بدّل الحكم كل جولة" on rgb(61, 190, 110) with rgb(13, 43, 27); ↺ → النمور became الذئاب; typing "فريق النخبة" (11 keystrokes) → the field and `teamA`; unpicking صناعة → "7 من 11 مختارة", the tile on the panel, its tag empty; re-picking → "8 من 11 مختارة", selection `animals nature society proverbs history religion science industry` — industry last (read from the page's room through React's fiber tree, inspection only); pressing ثقافة → nothing (opacity 0.5, `cursor: not-allowed`, no `disabled`, no `aria-disabled`); all eight unpicked → "0 من 11 مختارة", the CTA `disabled`, opacity 0.45, `cursor: not-allowed`, a click leaves the screen on `setup`; the rail scrolls (scrollWidth 1,130 against 435), snaps (`x mandatory`; −150 px settles at −114.67), `scrollbar-width: none`, no `scroll-padding` · 2026-10-03

- [x] 👁 **REQ-5.6 / REQ-5.20 / REQ-5.21 (Room-ready behaves):** "ابدأ اللعبة" opens room-ready with
  five chips and "الحكم: ماجد"; "رجوع للإعداد" returns to setup with every edit intact; opening again
  shows the **same** room code; share flashes a label on `--leaf` for 1.8 s by whichever path this
  browser takes; the 🎉's computed `animation-name` is `bob`, duration 1s, infinite, and it runs.
  > Measured: after a swap of ريم, "ابدأ اللعبة" → room-ready with chips ريم:b, سعد:b, نورة:a, خالد:b, ماجد:a and "الحكم: ماجد"; the code in Archivo, letter-spacing 5.2 px (.2em), `direction: ltr`, `unicode-bidi: isolate`; "رجوع للإعداد" → setup with ريم still on b; reopening → the **same** code (`C6KK06` both times); the 🎉: `animation-name: bob`, 1s, ease-in-out, infinite, its one animation running; share (this browser has no `navigator.share`; the page's clipboard was replaced so the owner's real clipboard was not written) → the link `https://nel3ab.game/j/C6KK06` copied, "نُسخ الرابط ✔" on rgb(61, 190, 110) at 200 ms and at 1,700 ms, back to "مشاركة" on the panel by 1,950 ms · 2026-10-03

- [x] 👁 **REQ-5.20 / REQ-5.21 (The presses):** applying the served `:active` rules (as Phase 2's Gate 6
  did): share moves **3 px**, `0 4px 0` → `0 1px 0`; "ابدأ الجولة الأولى" **4 px**, `0 6px 0` →
  `0 2px 0`; no scale, no opacity change, no blur.
  > Measured: the served rule, `.press_press__…:active:not(:disabled, [aria-disabled="true"]) { transform: translateY(var(--press-travel)); box-shadow: 0 calc(var(--press-rest) - var(--press-travel)) 0 var(--stroke) }`, copied onto a `[data-sim-active]` selector and applied in turn, as Phase 2's Gate 6 did: share moves **3 px**, `0 4px 0` → `0 1px 0`; "ابدأ الجولة الأولى" **4 px**, `0 6px 0` → `0 2px 0` — the prototype's own `style-active` pairs; width and height unchanged, opacity 1, `filter: none`; "رجوع للإعداد" 0 px, no shadow at rest or pressed; the rule excludes disabled controls. Limit, as in Phase 2: the press was produced by the page's own rule under a copied selector, not by a held pointer · 2026-10-03

- [x] 👁 **REQ-5.12 / REQ-5.15 (The match starts):** "ابدأ الجولة الأولى" shows the placeholder on
  `play`, the header "جولة 1 — أول 3 جولات", and team A's clock counting down from 45; about 45 s later
  the placeholder shows `roundEnd`, tallies 0–1.
  > Measured: "ابدأ الجولة الأولى" → the placeholder on `play`, header "جولة 1 — أول 3 جولات"; team A's clock **35** at 10.2 s and **32** at 13.2 s after the click, **1** at 44.4 s, team B 45 throughout; at 51.5 s `roundEnd`, team A 0, team B 45 with **1** round, unchanged 3 s later (the loop stopped) — one silent round, the tab fronted · 2026-10-03

- [x] 👁 **NFR-5.7 / REQ-5.10 (Network, console, focus):** after the page loads, through all of the
  above: **0** network requests; **0** console errors, no hydration warning. Tabbing through setup shows
  the 3 px red ring on every control except the two team-name fields (the prototype's `outline: none`),
  and no default ring anywhere.
  > Measured: a fresh load with nothing injected: requests = the page, 2 stylesheets, 5 scripts and 3 font files, all from `localhost:3000` — **0** other requests (the 127.0.0.1:8766 entries in the browser's log belong to earlier loads, where this pass's measuring script ran); console errors **0**, no hydration warning. 36 real Tab presses: **32** stops per cycle, then it wraps — **30 / 30** buttons show the 3 px `--red` ring (painted 2.66667 px at DPR 1.5, rgb(236, 48, 19)) at offset 3 px, `:focus-visible` matching on the focused one; the **2** team-name fields show none (the prototype's `outline: none`, recorded for Phase 23); **0** default browser rings · 2026-10-03

## 6. Gate 6 — Coverage, mutations and the gate commands (evaluated once, over the finished phase)

- [x] **REQ-5.9 (Full coverage):** `pnpm test` reports **100%** lines, branches, functions and
  statements over `packages/game/src`, with `setup.ts` listed; the coverage block of
  `vitest.config.ts` is byte-identical to `7a60dcc`'s.
  > Measured: `pnpm test` on a fresh clone of `d3c51a1` and on CI run 37143126118: **100%** — lines **201 / 201**, branches **216 / 216**, functions **48 / 48**, statements **244 / 244**, `setup.ts` listed (38 · 39 · 15 · 51 of 38 · 39 · 15 · 51; `reducer.ts` 79 · 106 · 6 · 98); `git diff 7a60dcc -- vitest.config.ts` **0** lines · 2026-10-03

- [x] **REQ-5.9 (Assertions that bite):** each mutation below, applied alone and reverted, fails at least
  one test; the test that caught it is recorded.

  | # | Mutation |
  |---|---|
  | N1 | `judgeAfterRemoval`: `>=` → `>` |
  | N2 | `judgeAfterRemoval`: `&& judgeIndex > 0` dropped |
  | N3 | `pickCategory` prepends |
  | N4 | `openRoom` ignores `canOpenRoom` |
  | N5 | the fill's `< 2` → `< 1` |
  | N6 | the fill keeps a lone player |
  | N7 | setup edits effective on `ready` too |
  | N8 | `shuffleTeamName` without the filter |
  | N9 | `swapTeam` flips every player |
  | N10 | `currentJudge` without the modulo |
  | N11 | `backToSetup` effective from any screen |
  | N12 | `renameTeam` writes the other team |
  | N13 | `assertSetupAction` called after the inert checks |
  | N14 | fill ids always `fill-1` |
  | D1 | the loop sends no `passTurn` |
  | D2 | the loop ticks 1,000 ms every 1,000 ms |
  | D3 | the loop keeps running off `play` |
  | D4 | `drawRound` takes `drawableCategories(state)[0]` |
  | D5 | `drawRound` does not shuffle |
  | D6 | `AbortError` falls through to the clipboard |
  | D7 | `FLASH_MS` 1,000 |
  | D8 | `startMatch()` draws on any screen |
  > Measured: **22 / 22** caught — each applied alone at `d3c51a1`, tested without coverage (`pnpm vitest run packages/game`, 443 tests; `pnpm vitest run apps/web`, 136), reverted, the tree clean before the next — failing tests: N1 **4** · N2 **5** · N3 **3** · N4 **3** · N5 **2** (both `< 2`s of the fill; the first alone is caught by the same 2, the second alone cannot change behaviour) · N6 **2** · N7 **2** (each of the six edits made effective on `ready` alone also 2) · N8 **4** · N9 **2** · N10 **2** · N11 **1** · N12 **2** · N13 **2** (each of the six alone also 2) · N14 **2** · D1 **5** · D2 **6** (the constant; a literal 1,000 in the loop alone also 6) · D3 **3** · D4 **9** · D5 **8** · D6 **4** · D7 **7** · D8 **2** — e.g. N1 by setup.test.ts "judgeAfterRemoval is the prototype's line at its three boundaries", N13 by "each malformed form throws RangeError on all five screens", D1 by driver.test.ts "T5 — correct at 5,000 ms…", D6 by share.test.ts "Table T8 › 2 · share rejects AbortError…", D8 by room-code.test.ts "T7 — startMatch() and nextRound() on setup call it 0 times…"; measured by a subagent of this session, which committed nothing · 2026-10-03

- [x] **REQ-5.25 (The four gate commands, no escape hatch):** on a fresh clone at a **short path**
  (Windows `LongPathsEnabled` is 0 on this machine), `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0 on Windows and on this phase's pull request's
  Ubuntu CI (`ci` job); §8's escape-hatch greps return the baseline measured at `7a60dcc` — **5** prose
  lines (`CLAUDE.md` × 3, `press.module.css`, `stylelint.config.mjs`), **0** directives, `skipLibCheck`
  in `tsconfig.base.json` only, and one `prettier-ignore` (`draw.test.ts:561`, Phase 4's) — unchanged.
  > Measured: Windows **5 / 5** · CI run **37143126118** (`ci` **success**) · escape-hatch lines **5** · directives **0**. **Windows** — cloned from GitHub at `d3c51a1` into `C:\Users\aalsh\AppData\Local\Temp\claude\p5g`, Node v24.14.0, pnpm 11.22.0, on mains power (`Win32_Battery` `BatteryStatus` 2, charge 100%): `pnpm install --frozen-lockfile` exit **0** ("Lockfile is up to date") · `pnpm lint` **0** (7.21 s) · `pnpm typecheck` **0** (2.17 s) · `pnpm test` **0** (13.59 s; 41 files across 6 projects, **685 / 685**, `[check-collected-tests] OK`, coverage 100%) · `pnpm build` **0** (10.38 s). **Ubuntu CI** — PR #32's `ci` job, run 37143126118 at `d3c51a1`, `ubuntu-24.04` `20260927.320.1`, 18:09:07–18:10:31 UTC, conclusion **success**; its `pnpm test` 41 files, 685 / 685, Vitest Duration 33.65 s, `All files 100 | 100 | 100 | 100`. **Escape hatches** — §8's greps in the clone: the **5** prose lines (`CLAUDE.md:67`, `:127`, `:132`, `press.module.css:48`, `stylelint.config.mjs:19`), **0** directives, `skipLibCheck` in `tsconfig.base.json` only, the one `prettier-ignore` at `draw.test.ts:561` — identical to `7a60dcc` · 2026-10-03

- [x] **NFR-5.6 (Six projects, and fast enough):** `[check-collected-tests]` reports **six** projects;
  the `@nel3ab/game` project's test duration on Windows on mains power is under **20 s** (three runs);
  CI's is recorded. If over, it is a finding — no sample is shrunk.
  > Measured: `[check-collected-tests] 41 test file(s) across 6 workspace project(s)` — **six** projects; the `@nel3ab/game` project alone with coverage (`pnpm vitest run --project @nel3ab/game --coverage`, 16 files, 443 / 443) in the fresh clone on Windows on mains power (`BatteryStatus` 2, 100%; CPU 27% before): **11.54 · 11.38 · 11.06 s**, under 20 s; the whole six-project `pnpm test` there 11.09 s (Vitest Duration); CI: the six-project Vitest Duration **33.65 s** (Phase 4: 28.43 s) — recorded, no budget applies on CI · 2026-10-03

- [x] **NFR-5.1 / NFR-5.5 (Configuration and records):** `git diff --stat 7a60dcc HEAD` lists files under
  `packages/game/src/`, `packages/ui/` (specs.md §3's five), `apps/web/app/host/` and
  `specs/phase-5/verification.md` only (and, at close, `specs/roadmap.md` and `CLAUDE.md`) — no `design/`
  file, no other `specs/` file, no lockfile, no other manifest or configuration file of NFR-5.5's list.
  > Measured: `git diff --stat 7a60dcc HEAD` (HEAD `d3c51a1`): **47** files, 10,115 insertions, 9 deletions — **13** under `packages/game/src/`, **5** under `packages/ui/` (`package.json`, `Button.tsx`, `Button.module.css`, `button-size.test.tsx`, `press-export.test.ts`), **25** under `apps/web/app/host/`, the **3** of `specs/phase-5/` and `specs/roadmap.md`; **0** files anywhere else. The range includes the plan commit `d54b726`, which created `requirements.md` and `specs.md` and set the roadmap's status to 🛠️; over the implementation range `d54b726..d3c51a1` the files outside `packages/game/src/` and `apps/web/app/host/` are exactly the five of `packages/ui/` and `specs/phase-5/verification.md` (ticks, measured values, and the owner-approved dated correction `77fc1eb`). No `design/` file, no lockfile, no other manifest or configuration file; `vitest.config.ts` 0 lines · 2026-10-03

- [x] **REQ-5.7 (Re-checked over the finished phase):** Gate 1's sanctioned-edits box, repeated at the
  phase's final commit.
  > Measured: at `d3c51a1`, `git diff 7a60dcc` — `index.test.ts` **+17 −1** and `match-purity.test.ts` **+11 −1**, the same hunks as Gate 1's box (specs.md §2.10's, and only those); **0** lines over the ten other Phase 3–4 test files and the eleven files under `src/testing/` that existed at `7a60dcc`; **0** lines over Phase 2's seven test files · 2026-10-03

## 7. Gate 7 — The exit verdict (once, on the commit at which Gate 6 passed)

- [ ] 🚦 **REQ-5.24 (Setup and room-ready match the prototype in both themes) (VERDICT GATE — no
  retry):** Procedure M, on the production build of the commit at which Gate 6 passed, beside the
  prototype, in one browser session: at 480 × 1000 and 375 × 900, in light and in dark, every row of
  Tables P–R and Table S's colours on the app equal the prototype's as measured in the same session —
  geometry within **0.5 px**, every other listed property exactly — and each page's column height equals
  the other's within 0.5 px (no vertical deviation anywhere in the column leaves it unchanged). The
  prototype is measured first and must reproduce Tables P–R; if it does not (R7), the comparison is made
  page to page and the drift is recorded. **PASS** = 0 deviations over 2 screens × 2 widths × 2 themes.
  **A FAIL here halts the phase** and returns to the owner, with every deviation listed.
  > Measured:

- [ ] 👁 **REQ-5.24 (A designer's eye):** full-column screenshots of both pages, both screens, both
  widths, both themes — eight pairs — placed side by side; the owner finds no spacing, radius or
  shadow deviation. A deviation seen here that
  the measurement missed is a finding, and halts as the box above does.
  > Measured:

---

## 8. Automated Commands

Written for Git Bash or the Ubuntu CI runner, as Phases 2–4's were.

```bash
# Gate 6 — the four gate commands, in this order, from a fresh clone at a short path
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test                 # = check-collected-tests.mjs --coverage
pnpm build

# Gates 1 / 6 — Phases 3–4's files: two edited as specs.md §2.10 says, the rest untouched
git diff 7a60dcc -- packages/game/src/match-purity.test.ts packages/game/src/index.test.ts
git diff --stat 7a60dcc -- packages/game/src/clock.test.ts packages/game/src/purity.test.ts \
  packages/game/src/rules.test.ts packages/game/src/prototype-equivalence.test.ts \
  packages/game/src/room.test.ts packages/game/src/reducer.test.ts packages/game/src/draw.test.ts \
  packages/game/src/match.test.ts packages/game/src/match-rules.test.ts \
  packages/game/src/match-equivalence.test.ts packages/game/src/testing/

# Gates 1–4 — iterate (no coverage, no collected-count check)
pnpm vitest run packages/game
pnpm vitest run packages/ui
pnpm vitest run apps/web
pnpm vitest run -t "extraction"

# Gate 2 — ambient time, randomness, timers and I/O in engine non-test source (expect 0 lines)
grep -rnwE "Date|Math\.random|performance|setTimeout|setInterval|setImmediate|queueMicrotask|crypto|process|fetch|console" \
  packages/game/src --include=*.ts | grep -v "\.test\.ts:" | grep -v "/testing/"

# Gate 2 — non-relative imports in engine non-test source (expect 0 lines)
grep -rnE "from '[^.]" packages/game/src --include=*.ts | grep -v "\.test\.ts:" | grep -v "/testing/"

# Gate 6 — escape hatches (baseline at 7a60dcc: 5 prose lines, 0 directives; skipLibCheck in
# tsconfig.base.json only; one prettier-ignore at packages/game/src/draw.test.ts:561)
git grep -nE "@ts-expect-error|@ts-ignore|eslint-disable|stylelint-disable|v8 ignore|istanbul ignore|c8 ignore" \
  -- ':!design' ':!specs' ':!pnpm-lock.yaml'
git grep -nE "skipLibCheck|pnpm\.overrides|peerDependencyRules|strict-peer" -- ':!design' ':!specs' ':!pnpm-lock.yaml' ':!*.md'
git grep -n "prettier-ignore" -- ':!design' ':!specs'

# Gate 6 — what changed since the plan
git diff --stat 7a60dcc HEAD

# Gates 5 / 7 — Procedure M's two servers
(cd design/designs && python -m http.server 8765 --bind 127.0.0.1)
pnpm build && pnpm --filter nel3ab-web start
```

> `pnpm test` forwards extra arguments to `scripts/check-collected-tests.mjs`, which asserts that
> *every* workspace project contributed a file — so it fails on any filtered run. Iterate with
> `pnpm vitest`, gate with `pnpm test`. `vitest run --dir <path>` does **not** filter. For a single
> recorded run use `--reporter=verbose`: the agent reporter hides passing tests' console output.

---

## 9. Acceptance Criteria

Phase 5 is complete when **all** of the following hold:

1. **Gates 1–2** are green — the setup rules behave as specified and are read from the prototype; Phases
   3–4's tests changed only where specs.md §2.10 says and pass; the flow's invariants hold over the
   setup sample, with no path to the fallback; the engine is still pure and its surface exact.
2. **Gate 3** is green — the press is importable and the primary Button has its 19 px size, with Phase
   2's tests untouched.
3. **Gate 4** is green — the driver draws with the helpers and a real source, runs the 100 ms loop with
   `passTurn`, never dispatches `startRound`; the catalog holds no prototype content; the screens render
   the prototype's words.
4. **Gate 5** is complete — every table row met in the browser, every control exercised, every deviation
   found written down with its fix.
5. **Gate 6** is green — 100% coverage, all twenty-two mutations caught, the four gate commands on
   Windows and Ubuntu CI with no escape hatch, inside the time budget, configuration touched only where
   NFR-5.5 allows.
6. **Gate 7's 🚦 verdict** returned **PASS**, and the owner's look found nothing.
7. Every box above is ticked **with its measured value filled in**.
8. `roadmap.md`'s Phase 5 status is updated and its "Completed Work" section records the verdict with
   the commit it was measured at, and the findings §10 carries forward.

That is the roadmap's exit criterion — "Setup and ready screens match the prototype in both themes; a
designer's eye finds no spacing, radius or shadow deviation" — as criterion 6, and its seven tasks
inside criteria 3–5. No criterion appears here for the first time.

---

## 10. What Would Make This Phase Untrustworthy

- **The tables are the planning session's reading of the prototype.** Tables P–R name the elements a
  designer would look at; a box left out of them can differ and pass every row. The column-height
  comparison catches any vertical deviation; a horizontal one inside an untabled box (a wrapper's inline
  padding) is caught only by the screenshots and the owner's look.

- **Nothing clicks in CI.** The screens are tested as static markup; no test presses a chip's ✕ or a
  locked tile. Wiring is checked in Gate 5 by a person or by Claude in a browser, once. A later change
  that wires ✕ to `swapTeam` fails no automated test this phase adds — the view and the engine would
  both still be right.

- **The verdict is run by the same kind of reader who built the screens.** If the owner directs Claude
  to perform Gates 5 and 7, the implementer and the inspector share every misreading of the prototype.
  The pre-registered tables were measured from the prototype itself, before any code existed, which is
  what keeps that from being circular; the owner's look is the independent check.

- **The browser is one browser.** Every number is Chromium's, at DPR 1.5, on Windows. Safari — a large
  share of the audience's phones — snaps borders and hides scrollbars differently (`scrollbar-width`
  needs Safari 18.2), and its share sheet is the one hosts will actually see. Nothing here measures it.

- **A verdict retried into green.** The ways to do it are specific and each is forbidden: a wider
  tolerance than 0.5 px, a table row dropped, the room code left random so its box "can't match", the
  prototype measured with its fonts not loaded, the dark comparison skipped at one width.

- **The randomness test is statistical.** Table T3's bounds are ±5σ, so it fails spuriously about once
  in 10⁵ runs, and a source that is uniform but predictable passes it. It shows the driver's draws come
  from the page's random source, not that the source is good.

- **The local clock is the browser's timer.** A backgrounded tab's timers are throttled, so a round
  played with the host's screen off runs slow — exactly as the prototype's did. The server owns the clock
  from Phase 11 (`mission.md` §5.2); until then this is accepted, not fixed.

- **Carried forward — binding on later phases, which no test here can check:**
  - **Phase 6** replaces the play placeholder; its screens must set `font-family: var(--font)` and
    `line-height: normal` on their root (requirements §1.1, fact 3), and reach `pop`, `slidein` and
    `bob` through a custom property, never `animation: <name>` in a CSS Module (fact 6). It shows
    questions for the first time, so the fair shuffle's different question order (Phase 4,
    2026-10-02) and the clock's differences at 20, 25 and 65–90 s (2026-09-30) become visible in a
    side-by-side — neither is a regression.
  - **Phase 7** replaces the round-end and match-end placeholders and wires `room.nextRound()`,
    `room.startMatch()` (the rematch) and `resetMatch`; its two 19 px CTAs use `Button size="md"`. Its
    playtest with real people runs with the demo players (REQ-5.10) and placeholder questions
    (REQ-5.14) unless Phase 8 lands first or the owner verifies a question set; it may revisit an
    "add a name" field.
  - **Phase 8** deletes `apps/web/app/host/_lib/catalog.ts` and chooses the content's category ids.
  - **Phase 11** replaces the driver's room, code and clock with the server's; it maps the wire's
    `setJudge`, `pickCategories`, `swapTeam` and `rename` onto this phase's actions (`pickCategory` and
    `setRotateJudge` take a target value, so a retried message is harmless), and its `startRound`
    message onto `startMatch`.
  - **Phase 13** replaces the demo players with joins (the prototype's `onJoinSubmit` balancing rule),
    and owns a player's own swap on room-ready, including what happens if it empties a team after the
    fill has run.
  - **Phase 20** enforces the locks server-side; the engine records any category it is told to pick.
  - **Phase 23** owns the team-name field's missing focus ring (the prototype's `outline: none`) and the
    rest of the accessibility audit.
  - **J6 still holds:** this phase adds no path to a draw with every category used (Gate 2); Phase 4's
    fallback remains reachable only by a hand-built state.

---

*Written: 2026-10-02 — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured values may be added;
gates may not be changed except by a dated planning session.*
