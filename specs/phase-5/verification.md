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
these at least once: an `openRoom` that fills; an `openRoom` refused by the guard; a `backToSetup`; a
match reaching `match`; a `resetMatch` back to setup followed by a second `openRoom`; a setup edit
attempted, and inert, on `ready` and on `roundEnd`.

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

- [ ] **REQ-5.7 (Phases 3–4 green):** `pnpm vitest run packages/game` passes every test of Phases 3 and
  4 — their two verdict tests included — with **0** failures and **0** skips; their test count is the
  `7a60dcc` count.
  > Measured:

- [ ] **REQ-5.7 (The invariants, over the sample):** Table U's 300 sequences run through `reduce` with
  Phase 3's I1–I10, Phase 4's J1–J8 and this phase's K1–K5 asserted after every step: **0** violations.
  The totals — sequences, events, actions, `openRoom`s effective and refused, fills, `backToSetup`s,
  matches ended, second `openRoom`s, inert setup edits per screen — are recorded, and every population
  Table U requires is non-zero.
  > Measured:

- [ ] **REQ-5.7 (No path to the fallback):** over the same sample, J6 (`usedCategories.length ===
  round`) never fails and `nextRoundChoices` never returns the whole selection because the unused list is
  empty — Phase 4's fallback is reached **0** times. Recorded in the roadmap at close (Phase 4, R6).
  > Measured:

- [ ] **NFR-5.3 (Pure):** over the sample, with every state and action deep-frozen: **0** `TypeError`s;
  every step reduced twice gives deep-equal results; every inert step returns its input (`===`) —
  counted per action type, the eight new types included; and the malformed forms of Gate 1 throw on
  every screen the sample visits.
  > Measured:

- [ ] **NFR-5.3 / NFR-5.2 (No ambient time, randomness or timers):** the sample and `shuffleTeamName`
  run with `Date.now`, `Math.random`, `performance.now`, `setTimeout` and `setInterval` spied to throw —
  the spies shown live first — and **0** calls. And §8's two greps over `packages/game/src` non-test
  source return **0** lines; the manifest has no dependency key.
  > Measured:

## 3. Gate 3 — The UI kit (independent; blocks Gate 4's screen boxes)

- [ ] **REQ-5.23 (The press, importable):** `packages/ui/package.json`'s `exports` holds exactly the
  four entries `"."`, `"./tokens.css"`, `"./base.css"`, `"./press.module.css"`, the last pointing at
  `./src/styles/press.module.css`; a module importing `@nel3ab/ui/press.module.css` gets the **same**
  `press` class `Button` applies.
  > Measured:

- [ ] **REQ-5.23 (A 19 px primary):** `<Button size="md">` renders `data-size="md"`; the default renders
  `data-size="lg"`; `Button.module.css` holds the one rule
  `.button[data-variant='primary'][data-size='md'] { font-size: 19px }`, and the primary rule still
  declares `font-size: 20px`.
  > Measured:

- [ ] **NFR-5.4 (Phase 2 untouched):** `@nel3ab/ui`'s runtime exports are still exactly `Button`,
  `Card`, `Dot`, `Panel`, `Pill`; every Phase 2 test passes; `git diff 7a60dcc` over `packages/ui`
  touches `package.json`, `Button.tsx`, `Button.module.css` and the two new test files only.
  > Measured:

## 4. Gate 4 — The driver, the stand-ins and the screens (needs Gates 1–3)

- [ ] **REQ-5.14 (The catalog):** eleven entries in the prototype's order with specs.md §2.9's ids,
  names, emoji and locks; three placeholder questions each, with two hints, of exactly the placeholder
  text. `host-source.test.ts`: **0** of the prototype's question, answer, variant, hint and fact strings
  occur in any non-test source under `apps/web`.
  > Measured:

- [ ] **REQ-5.10 (The seed):** `seedRoom('SKZJ62')` equals `createRoom`'s room with specs.md §2.9's
  players, judge 4, rotation off, `SEED_PICKED`, `النمور` / `الصقور`, 45 s and 3 wins — and the
  prototype's initial `state` read at test time (W6).
  > Measured:

- [ ] **REQ-5.10 / REQ-5.11 (Room code and default source):** Table T6 and T7.
  > Measured:

- [ ] **REQ-5.11 (The draw):** Table T1 and T2 exactly; `startMatch()` and `nextRound()` dispatch the
  `drawRound` result; Table T3's bounds hold with the real `Math.random`.
  > Measured:

- [ ] **REQ-5.12 (The loop):** Table T4 and T5 exactly, under Vitest's fake timers.
  > Measured:

- [ ] **REQ-5.13 (No `startRound`):** over a recorded session — setup edits, `openRoom`, `backToSetup`,
  `openRoom`, `startMatch()`, 450 intervals, `nextRound()`, 100 intervals — the dispatch log holds **0**
  `startRound`; `DriverAction` does not admit `startRound`, `startMatch`, `nextRound`, `tick` or
  `passTurn` (a type test); `host-source.test.ts`: **0** occurrences of `startRound` in non-test source
  under `apps/web`.
  > Measured:

- [ ] **REQ-5.21 (Share and flash):** Table T8's seven paths and T9's timings exactly.
  > Measured:

- [ ] **REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 (The view):** `setupView` and `readyView` give every label of specs.md
  §2.9's table for the seed and for edited rooms: "5 لاعبين" / "4 لاعبين"; members and "بدون لاعبين";
  both judge hints; both rotation labels; "8 من 11 مختارة" / "0 من 11 مختارة"; each tile's tag;
  `canStart` false with nothing picked; the footnote with 45; "إعداد" and "جولة 2 — أول 3 جولات";
  "الحكم: ماجد" and "—".
  > Measured:

- [ ] **REQ-5.15 – REQ-5.20 (The markup):** the static markup of `SetupScreen` and `ReadyScreen` for the
  seed holds every text of W1 and W3, the three `title`s of W2, `data-team` on tiles and chips,
  `data-selected` on ماجد's choice and the eight picked tiles, `data-locked` on three tiles with neither
  `disabled` nor `aria-disabled`, `data-on` on the toggle, `data-flash` on share when a label is given,
  the CTA `disabled` when `canStart` is false, `data-size="md"` on the ready CTA, and `.ltr-num` on the
  room code; `HostApp`'s server markup holds no debug-bar text ("شاشة الحكم", "شاشة لاعب", "نهاري",
  "ليلي") and is **identical** for two different random sources.
  > Measured:

- [ ] **REQ-5.22 (The words and the driver's numbers, read from the prototype):** each extraction
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
  > Measured:

- [ ] **NFR-5.7 (Nothing leaves the page):** `host-source.test.ts`: **0** occurrences of `fetch(`,
  `WebSocket`, `EventSource`, `sendBeacon`, `XMLHttpRequest` or `localStorage` in non-test source under
  `apps/web/app/host`.
  > Measured:

- [ ] **NFR-5.8 (RTL):** `pnpm lint:css` passes over the three new stylesheets with **0** disable
  comments; they contain no `left` / `right` property or value.
  > Measured:

## 5. Gate 5 — Fidelity in the browser (needs Gate 4; fix freely)

- [ ] 👁 **REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 (Setup against Table P):** Procedure M at 480 × 1000, light: every row of
  Table P within tolerance. Every deviation found is written down here, with its fix.
  > Measured:

- [ ] 👁 **REQ-5.20 (Room-ready against Table Q):** as above, Table Q (Q16 by pressing share).
  > Measured:

- [ ] 👁 **REQ-5.15 – REQ-5.20 (Phone width and dark):** Table R at 375 × 900, light; Tables P–R's
  geometry and Table S's colours in dark, both widths.
  > Measured:

- [ ] 👁 **REQ-5.16, REQ-5.17, REQ-5.18, REQ-5.19 (Every control does what it says):** on `/host`, from the seed:
  ↔ on ريم makes her chip sky and the members "نورة، ماجد" / "ريم، سعد، خالد"; ✕ on سعد gives
  "4 لاعبين", "ثابت طول المباراة" and ماجد still selected; choosing ريم selects her; the toggle reads
  "✔ بدّل الحكم كل جولة" on `--leaf`; ↺ changes team A's name to another of the four; typing renames;
  unpicking صناعة gives "7 من 11 مختارة" and re-picking it moves it to the end of the selection; pressing
  ثقافة changes nothing; unpicking all eight gives "0 من 11 مختارة" and a CTA at opacity 0.45 that does
  not move when pressed; the rail scrolls sideways with no scrollbar.
  > Measured:

- [ ] 👁 **REQ-5.6 / REQ-5.20 / REQ-5.21 (Room-ready behaves):** "ابدأ اللعبة" opens room-ready with
  five chips and "الحكم: ماجد"; "رجوع للإعداد" returns to setup with every edit intact; opening again
  shows the **same** room code; share flashes a label on `--leaf` for 1.8 s by whichever path this
  browser takes; the 🎉's computed `animation-name` is `bob`, duration 1s, infinite, and it runs.
  > Measured:

- [ ] 👁 **REQ-5.20 / REQ-5.21 (The presses):** applying the served `:active` rules (as Phase 2's Gate 6
  did): share moves **3 px**, `0 4px 0` → `0 1px 0`; "ابدأ الجولة الأولى" **4 px**, `0 6px 0` →
  `0 2px 0`; no scale, no opacity change, no blur.
  > Measured:

- [ ] 👁 **REQ-5.12 / REQ-5.15 (The match starts):** "ابدأ الجولة الأولى" shows the placeholder on
  `play`, the header "جولة 1 — أول 3 جولات", and team A's clock counting down from 45; about 45 s later
  the placeholder shows `roundEnd`, tallies 0–1.
  > Measured:

- [ ] 👁 **NFR-5.7 / REQ-5.10 (Network, console, focus):** after the page loads, through all of the
  above: **0** network requests; **0** console errors, no hydration warning. Tabbing through setup shows
  the 3 px red ring on every control except the two team-name fields (the prototype's `outline: none`),
  and no default ring anywhere.
  > Measured:

## 6. Gate 6 — Coverage, mutations and the gate commands (evaluated once, over the finished phase)

- [ ] **REQ-5.9 (Full coverage):** `pnpm test` reports **100%** lines, branches, functions and
  statements over `packages/game/src`, with `setup.ts` listed; the coverage block of
  `vitest.config.ts` is byte-identical to `7a60dcc`'s.
  > Measured:

- [ ] **REQ-5.9 (Assertions that bite):** each mutation below, applied alone and reverted, fails at least
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
  > Measured:

- [ ] **REQ-5.25 (The four gate commands, no escape hatch):** on a fresh clone at a **short path**
  (Windows `LongPathsEnabled` is 0 on this machine), `pnpm install --frozen-lockfile`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0 on Windows and on this phase's pull request's
  Ubuntu CI (`ci` job); §8's escape-hatch greps return the baseline measured at `7a60dcc` — **5** prose
  lines (`CLAUDE.md` × 3, `press.module.css`, `stylelint.config.mjs`), **0** directives, `skipLibCheck`
  in `tsconfig.base.json` only, and one `prettier-ignore` (`draw.test.ts:561`, Phase 4's) — unchanged.
  > Measured:

- [ ] **NFR-5.6 (Six projects, and fast enough):** `[check-collected-tests]` reports **six** projects;
  the `@nel3ab/game` project's test duration on Windows on mains power is under **20 s** (three runs);
  CI's is recorded. If over, it is a finding — no sample is shrunk.
  > Measured:

- [ ] **NFR-5.1 / NFR-5.5 (Configuration and records):** `git diff --stat 7a60dcc HEAD` lists files under
  `packages/game/src/`, `packages/ui/` (specs.md §3's five), `apps/web/app/host/` and
  `specs/phase-5/verification.md` only (and, at close, `specs/roadmap.md` and `CLAUDE.md`) — no `design/`
  file, no other `specs/` file, no lockfile, no other manifest or configuration file of NFR-5.5's list.
  > Measured:

- [ ] **REQ-5.7 (Re-checked over the finished phase):** Gate 1's sanctioned-edits box, repeated at the
  phase's final commit.
  > Measured:

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
