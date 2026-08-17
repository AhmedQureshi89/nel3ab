# Handoff: Nel3ab (نلعب) — Trivia party game

## Overview
Nel3ab is an Arabic-first, RTL party trivia game for in-person gatherings. One person hosts on a single "judge" screen; everyone else joins from their own phone with a 6-character room code — no signup, no app install. Two teams share a category, each team has a time bank, and the judge rules answers correct / gives hints / skips. First team to win 3 rounds takes the match.

This bundle covers three surfaces: the **marketing landing page**, the **judge (host) app** with all its game states, and the **player join screen**.

## About the Design Files
The files in `designs/` are **design references created in HTML** — prototypes that show intended look and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns, component library, state management and routing. If no environment exists yet, choose the most appropriate framework for the product (a real-time web app with phone clients — a React/Next + WebSocket stack is a reasonable default) and implement the designs there.

The prototypes are single-player simulations: the judge screen and the player screen are toggled with a debug switch in the top bar, and all state lives in one in-memory component. In production these are **two separate clients synced over a live connection** (see State Management).

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, borders, shadows, copy and interaction timings are final and intentional. Recreate the UI pixel-accurately, mapping each value onto the codebase's own tokens where equivalents exist. The chunky "arcade" style — 2.5–3px ink borders, hard offset drop shadows with no blur, 14–24px radii — is the identity; do not soften it into a generic material/flat look.

Exception: the landing page's game-library artwork is placeholder image slots. Real artwork is required before shipping.

---

## Screens / Views

### 1. Landing page (`Nel3ab Landing - Arcade.dc.html`)
**Purpose:** explain the game in one scroll and convert to "open a room" / "join with a code".
**Layout:** centered column, `max-width: 1180px`, `padding: 0 26px`, sections separated by `56px` bottom padding. Desktop-first; sections collapse to one column on narrow widths.
- **Nav:** sticky top bar, brand mark (18px red circle with 2.5px ink border + wordmark "نلعب"), anchor links, primary CTA.
- **Hero:** two columns. Left: eyebrow label, `h1` at **64px / line-height 1.06 / weight 800 / letter-spacing -0.01em**, second line in `--red`; sub-paragraph; CTA row. Right: a live-looking score panel — two team cards (red / sky) each with a **40px Archivo 800** numeral and a 34px team dot.
- **How it works (`#how`):** `h2` 40px/800, then `grid-template-columns: repeat(3,1fr); gap: 18px`. Each card: panel fill, 3px ink border, radius `--r` (20px), `box-shadow: 0 6px 0 var(--stroke)`, `padding: 22px`; a 44px numbered circle (red / sky / leaf), `h3` 23px/800, body 14.5px/600/1.6 in `--muted`.
- **Game library (`#games`):** `h2` 40px/800 with a right-aligned 14px muted note. Card grid; each card is a panel with `overflow: hidden`, a **250px** tinted image area (`<image-slot>` placeholder) with a 3px ink bottom border, an Archivo badge pill top-left, an optional "قريباً" pill top-right, then `h3` 26px/800, blurb, and tag pills.
- **Pricing / signup close:** full-width `--red` panel, radius 28px, `box-shadow: 0 8px 0 var(--stroke)`, `padding: 46px 40px`, white text. `h2` 46px/800/1.12 capped at `max-width: 16ch`, sub-line 16px/600 at 90% opacity, CTA on the right.

### 2. Judge app — Setup (`Nel3ab - Arcade.dc.html`, `screen: 'setup'`)
**Purpose:** the host builds the game before anyone plays.
**Layout:** single centered phone-width column, `max-width: 440px`, `padding: 6px 14px`. A debug top bar (judge/player, day/night) sits above it — **not part of the product**, remove it.
Header row: brand mark + wordmark on one side, round label on the other (`إعداد`, or `جولة N — أول 3 جولات`).
- `h1` "يلا نلعب" 34px/800/1.15; sub-paragraph 14.5px/600 muted.
- **Teams card** (panel, 3px border, radius 20px, `0 4px 0` ink shadow, padding 14px): title row (15px/800 + muted count "N لاعبين"); two side-by-side team tiles in a `1fr 1fr` grid, gap 10px — team A `--red`, team B `--sky`, radius 16px, 2.5px border, padding 11px. Each tile: 11px label at 80% white, a shuffle-name button (`↺`, translucent black 18%, radius 8px), an **editable team-name input** (transparent, white, 17px/800), and a truncated member list at 11.5px.
  Below: wrapping player chips, gap 7px — pill (`border-radius: 999px`, 2.5px ink border, padding `4px 8px 4px 12px`, 13.5px/700) tinted by team, with `↔` (swap team) and `✕` (remove) buttons.
- **Judge card:** title row (15px/800 + hint "العدد فردي — يفضّل التبديل" when the player count is odd, else "ثابت طول المباراة"); explanatory line 12.5px muted; a wrapping row of player pills where the selected judge is `--yellow` with a `0 3px 0` ink shadow; then a full-width toggle button "بدّل الحكم كل جولة" (`✔`/`○` prefix, `--leaf` when on, sunken when off, radius 14px, **text-align right**).
- **Categories card:** title row + "N من 11 مختارة". Horizontal snap-scroll rail (`overflow-x: auto; scroll-snap-type: x mandatory`, gap 9px, scrollbar hidden, bleeding to the card edges via `margin: 0 -14px; padding-inline: 14px`). Each tile: 92px wide, radius 16px, 2.5px border, 22px emoji, 11.5px/700 name, 10px status line. Selected = `--yellow` + `0 3px 0` shadow; locked = `opacity .5`, `cursor: not-allowed`, red "🔒 مدفوعة" tag.
- **Primary CTA:** full width, `--yellow`, 3px border, radius 18px, padding `17px 20px`, 20px/800, `box-shadow: 0 6px 0 var(--stroke)`, label left + `▶` right (`justify-content: space-between`). Active: `translateY(4px)` with shadow shrinking to `0 2px 0`. Hover: `filter: brightness(1.04)`.
- Footnote 12.5px muted: "الحكم يشوف الإجابات · 45 ثانية لكل فريق · ما تحتاج تسجّل دخول".

### 3. Judge app — Room ready (`screen: 'ready'`)
**Purpose:** share the code and confirm who's in.
Centered: 54px 🎉 with `bob` animation, `h2` 26px/800 "الغرفة جاهزة!", muted caption, then the **room code** — Archivo 800 at 26px, `letter-spacing: .2em`, panel fill, 3px border, radius 16px, `0 4px 0` shadow, padding `12px 18px` — beside a **share button** (⤴ + label) that turns `--leaf` on success. Below: an "في الغرفة" panel (right-aligned) listing player chips and the current judge. Two stacked buttons: yellow "ابدأ الجولة الأولى" and a plain "رجوع للإعداد" (panel fill, 2.5px border, radius 16px, 15px/700).

### 4. Judge app — Play (`screen: 'play'`) — the core screen
**Purpose:** run the round. This is the only screen that shows answers.
Top to bottom:
1. **Two timer cards** (`display: flex; gap: 8px`, each `flex: 1; min-width: 0`), radius 14px, 2.5px border, padding `9px 11px`. Active team card is filled (`--red` / `--sky`, white text) with a `0 3px 0` shadow; inactive is panel. Contents: truncated team name 12.5px/800 + **Archivo 22px/800 clock (whole seconds, ceil)**; second row: win dots (9px circles, 2px border, `--yellow` when won) + status text 10.5px at 75% opacity ("دورهم الآن" / "مجمّد" / "بالانتظار").
2. **Category pill + time-bank bar:** pill (emoji + name, radius 999px, 2.5px border, panel, 12.5px/700) then a 10px-tall track (radius 999px, 2.5px border, `--sunken`) whose fill is the active team color, width = `time / roundSeconds`, `transition: width .1s linear`.
3. **Question card:** radius 24px, 3px border, `0 6px 0` shadow, `overflow: hidden`. Header strip in the active team color, white, 12.5px/800: "دور <team>" left, "سؤال N" right. Body: `padding: 26px 20px; min-height: 150px`, centered, **24px/800/1.45 with `text-wrap: pretty`**. Footer (hint strip): top border 2.5px, `--sunken` fill, `min-height: 56px`, 💡 + hint text 14px/700 — muted placeholder copy until a hint is spent, then ink-colored with a `slidein .22s ease-out` entrance.
   **Reveal overlay:** on "correct", an absolutely positioned `--leaf` panel covers the card (`inset: 0; z-index: 5`, `animation: pop .18s ease-out`): label "الإجابة" 13px/800 at 70% opacity, answer **30px/800**, trivia fact 13.5px/600. Auto-dismisses after **1000ms**, then the turn passes.
4. **Judge-only answer box:** panel fill with a **3px dashed `--red`** border, radius 18px. Row: "للحكم فقط 👁" 11.5px/800 in red + judge name muted. Answer 19px/800. "يُقبل أيضاً: …" 12px/600 muted. **This block must never render on a player client.**
5. **Action row:** three equal buttons (`flex: 1`, 3px border, radius 18px, padding `15px 8px`, 15.5px/800, `0 5px 0` ink shadow, active `translateY(3px)` → `0 2px 0`), each with a 11px/700 sub-label at 60% opacity:
   - **تخطي ⏭** — panel fill — "−3 ثوانٍ"
   - **تلميح 💡** — `--yellow` when hints remain, else panel at `opacity .45` and `cursor: not-allowed` — "−2 ثانية · باقي N" / "انتهت التلميحات"
   - **صحيح ✔** — `--leaf`, text `#0d2b1b` — "يمرّ الدور"

### 5. Judge app — Round end (`screen: 'roundEnd'`)
54px 🏆 (bob), `h2` 24px/800 "<team> كسبوا الجولة!", reason line 13.5px muted ("انتهى وقت <team> — الفئة: <cat>"). Two score cards (`flex: 1`, 3px border, radius 18px, `0 5px 0` shadow; winner `--leaf`): Archivo 30px/800 tally, team name 13px/700, win dots (11px). Progress line 13px muted. Yellow "الجولة التالية" CTA + plain "رجوع للإعداد".

### 6. Judge app — Match end (`screen: 'match'`)
60px 👑 (bob), 12px/800 tracked label "نهاية المباراة", `h2` 28px/800 winner line, winners' names 14px/700 muted. Two score cards with Archivo **34px** tallies. Then a round log panel: rows separated by 2px `--sunken` borders, `padding: 11px 14px`, 13.5px/700 — "جولة N · <category>" muted on one side, winning team on the other. Yellow "نفس الفرق — مباراة جديدة" + plain "غيّر اللاعبين والفئات".

### 7. Player — Join (`JoinRoom.dc.html`)
**Purpose:** get into the room in under 15 seconds, from a link.
`max-width: 440px`, padding 14px. `h1` 32px/800 "انضم للعبة" + muted 15px sub. Two panels (3px border, radius 20px, `0 4px 0` shadow, padding 16px), each with a 13px/800 label:
- **كود الغرفة** — input: `--sunken` fill, 2.5px border, radius 14px, padding 14px, **Archivo 26px/800, letter-spacing .24em, centered, uppercase**, placeholder `SKZJ62`.
- **اسمك** — input: same shell, 16px/700, placeholder "مثلاً: ريم".
Error state: `--red` panel, white, 2.5px border, radius 14px, 13.5px/700 — "اكتب اسمك عشان فريقك يعرفك" (empty name) or "الكود غير صحيح — تأكد من صاحب الغرفة" (mismatch). Yellow CTA "انضم" + `▶`. Footnote: "بدون تحميل تطبيق — بس افتح الرابط".

### 8. Player — Lobby / live (`device: 'player'`, `pscreen: 'lobby'`)
- **Judge banner** (only when this player is the judge): `--yellow` panel, 3px border, radius 16px, `0 4px 0` shadow, 14px/800 — "أنت الحكم هذي الجولة — افتح شاشة الحكم".
- **Team card:** filled with the player's team color, radius 20px, padding 18px, white: "أهلاً <name> — أنت مع" 13px/700 at 85%, team name **28px/800** truncated, and a "بدّل فريقي ↺" button (translucent black 20%, 2.5px border, radius 12px) **shown only before play starts**.
- **When live:** compact versions of the two timer cards (Archivo 20px clocks, no win dots) and a question card identical to the judge's minus the reveal overlay and answer box — header shows "دور <team>" + category, body 22px/800, hint strip identical.
- **When waiting:** `--sunken` panel with a **2.5px dashed** ink border, radius 20px, centered: 30px bobbing ⏳ (or 👑 at match end), 15px/800 title ("بانتظار الحكم يبدأ" / "انتهت المباراة"), 13px muted body.

---

## Interactions & Behavior

**Judge actions during play** (all no-ops while the reveal overlay is up or the clock is stopped):
- **صحيح** → stop clock, show reveal overlay for 1000ms, then pass the turn to the other team (starting their bank at full time on their first turn), advance the question index, reset hints.
- **تلميح** → spend **2s** from the active team's bank, reveal the next hint only; disabled when hints are exhausted.
- **تخطي** → spend **3s**, advance to the next question in the shuffled pool (no repeats until the pool wraps).
- Any spend that reaches 0 immediately ends the round.

**Clock:** ticks every 100ms on the active team only, decrementing 0.1s; paused while a reveal overlay is visible; displayed as `Math.ceil(seconds)`. Reaching 0 ends the round with that team as loser.

**Round / match flow:** category is drawn at random from selected-but-unused categories (falls back to the full selection when exhausted). Odd rounds start with team A, even rounds with team B. Round win = the opponent's clock ran out. Match ends when a team reaches `winsNeeded` (default 3) or categories run out. `nextRound` also rotates the judge index when "بدّل الحكم كل جولة" is on.

**Share:** tries `navigator.share({title, text, url})` with `https://nel3ab.game/j/<code>`; falls back to `navigator.clipboard.writeText`, then to showing the raw code. Confirmation label flashes on the button (`--leaf`) for **1800ms**. Ignore `AbortError` (user dismissed the sheet).

**Join validation:** name required; code compared case-insensitively against the room code after `trim().toUpperCase()`; error clears on any keystroke; Enter submits.

**Animations** (all defined as keyframes; durations exact):
- `pop` — `scale(.72) → scale(1)`, opacity 0→1, **180ms ease-out** — reveal overlay.
- `bob` — `translateY(0 → -7px → 0)`, **1.0–1.2s ease-in-out infinite** — celebration emoji.
- `slidein` — `translateY(10px) → 0`, opacity 0→1, **220ms ease-out** — new hint text.
- `ring` — pulsing 10px yellow glow, 
 available for attention states.
- Button press: `transform: translateY(3–4px)` with the offset shadow shrinking by the same amount (never a scale or opacity change).

**Focus / states:** `:focus-visible { outline: 3px solid var(--red); outline-offset: 3px; }` and `::selection` tinted yellow at 55%. Never leave a default browser focus ring. Disabled = `opacity .45` + `cursor: not-allowed`.

**Responsive:** the judge and player views are phone-width (440px max) and work as-is on any phone; the landing page is desktop-first and needs the three-up grids to collapse to one column and the 64px hero to step down (~40px) under ~760px.

**RTL:** every screen is `dir="rtl"`. Layout mirrors; Latin/numeric runs (room code, clocks, tallies, stat numerals) are set in Archivo and must be direction-isolated so they don't reorder inside Arabic text.

**Dark mode:** a `data-theme="dark"` attribute on the root swaps the token values (see below). Both themes are final.

---

## State Management

Production splits the prototype's single state object into **shared room state** (server-authoritative, broadcast to all clients) and **local client state**.

**Room state (shared):**
- `roomCode: string` (6 chars, uppercase)
- `players: {id, name, team: 'a'|'b'}[]`
- `teamA: string`, `teamB: string` (editable names)
- `judgeIndex: number`, `rotateJudge: boolean`
- `pickedCategories: number[]`, `usedCategories: number[]`
- `screen: 'setup'|'ready'|'play'|'roundEnd'|'match'`
- `round: number`, `tallyA: number`, `tallyB: number`, `log: {n, category, winner}[]`
- `categoryIndex: number|null`, `questionPool` (shuffled), `questionIndex`, `hintIndex`
- `banks: {a: {time, started}, b: {time, started}}`, `active: 'a'|'b'`
- `reveal: {answer, fact} | null`

**Local (client) state:** `theme`, join form fields + error, `myPlayerId`, and the derived `iAmJudge`.

**Authority rules that matter:**
- The clock must be server-authoritative (or reconciled against a server timestamp) — two clients must not disagree on the bank.
- `answer`, `alts` and `fact` for the current question are sent **only** to the judge's client. Do not ship them to players and hide them in CSS.
- On judge rotation, the new judge's client gains answer data and the previous judge's loses it immediately.
- Reconnect must restore a player into their existing seat (persist the player id locally).

**Data:** 11 categories, each `{name, emoji, desc, chips[], locked?, qs: [{q, a, alts[], h[], f}]}` — 3 questions each in the prototype. In production this is a content API; questions are drawn from a shuffled per-round pool. Two categories are `locked: true` (paid) and one more is marked paid on the landing page.

**Configurable (exposed as tweaks in the prototype):** `roundSeconds` (default 45, range 20–90), `winsNeeded` (2 / 3 / 4, default 3), `roomCode`.

---

## Design Tokens

The product's visual language is its own **"Arcade" system** — it is not a third-party design system, and there is no library to install. Everything it consists of is here: `arcade-tokens.css` carries every token, keyframe and global state as declarations you can port directly; the tables below are the same values with usage notes. Component styling lives in the prototypes (see Screens above) rather than in a shared stylesheet — the prototypes style inline on purpose.

**Light theme**
| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#fff3df` | page ground (warm cream) |
| `--panel` | `#fffaf0` | cards, pills, inputs shell |
| `--sunken` | `#f0e2c8` | input fills, hint strip, tracks |
| `--ink` | `#241c17` | primary text |
| `--muted` | `#8a7a6a` | secondary text |
| `--stroke` | `#241c17` | every border and drop shadow |
| `--red` | `#ec3013` | team A, accent, judge-only box, errors |
| `--yellow` | `#ffc93c` | primary CTA, selected state, win dots |
| `--sky` | `#2fa3e8` | team B |
| `--leaf` | `#3dbe6e` | correct / success / winner |
| on-leaf text | `#0d2b1b` | text over `--leaf` |

**Dark theme** (`[data-theme="dark"]`): `--bg #1c1a25`, `--panel #272433`, `--sunken #171521`, `--ink #fff3df`, `--muted #a79bb5`, `--stroke #0d0c13`, `--red #ff5a3c`. Sky, yellow and leaf are unchanged.

**Typography:** `--font: "Baloo Bhaijaan 2"` (weights 500/600/700/800) for all Arabic UI; `--font-en: "Archivo"` (600/800) for Latin, numerals, clocks and the room code. Both from Google Fonts. Scale in use: 64 / 46 / 40 / 34 / 32 / 30 / 28 / 26 / 24 / 23 / 22 / 20 / 19 / 17 / 16 / 15.5 / 15 / 14.5 / 13.5 / 12.5 / 11.5 / 11 / 10.5 px. Body copy `line-height: 1.6`; headings `1.06–1.2`; question text `1.45`.

**Radii:** `--r: 20px` (cards) · 28px and 24px (hero/question/pricing) · 18px (buttons, dashed box) · 16px (team tiles, category tiles, secondary buttons) · 14px (inputs, timer cards, toggles) · 12px · 8px · `999px` pills · `50%` dots.

**Borders:** 3px ink on cards and primary buttons; 2.5px on pills, inputs, tiles and secondary buttons; 2px on inner dots and log dividers. Dashed variants: 3px `--red` (judge-only box), 2.5px ink (waiting panel).

**Shadows** — hard offsets, **zero blur, always `--stroke`**: `0 8px 0` (pricing) · `0 6px 0` (`--drop`-family: primary CTA, question card, landing cards) · `0 5px 0` (action buttons, score cards) · `0 4px 0` (`--drop`, standard cards) · `0 3px 0` (selected pills, active timer cards).

**Spacing:** 4-based; recurring values 4 / 6 / 7 / 8 / 9 / 10 / 11 / 12 / 14 / 16 / 18 / 20 / 22 / 26 px. Card padding 14px (phone) and 22px (landing). Grid/flex `gap` throughout — never margin-spaced siblings.

**Motion:** 100ms (clock tick / bar), 180ms (pop), 220ms (slidein), 1000ms (reveal hold), 1800ms (share confirmation), 1.0–1.2s (bob loop).

---

## Assets
- **Fonts:** Baloo Bhaijaan 2 + Archivo, Google Fonts — self-host in production.
- **Icons/emoji:** the prototypes use Unicode glyphs (`▶ ↺ ↔ ✕ ⏭ ✔ 💡 👁 ⤴ 🏆 👑 ⏳ 🎉`) and emoji for category tiles. Replace the UI glyphs with the codebase's icon set; the category emoji are content and can stay (or become real illustrations).
- **Landing artwork:** `<image-slot>` placeholders (`image-slot.js` is bundled) sized 250px tall in the game-library cards — **real artwork needed**.
- **Brand mark:** a filled `--red` circle with a 2.5–3px ink border (18px in-app, 34px on the landing hero). No logo file exists yet.
- No third-party imagery is used, so there is nothing to license.

## Files
- `arcade-tokens.css` — the Arcade design system: all tokens (both themes), keyframes, focus/selection/disabled states, and the press behavior. Port these onto the codebase's token layer.
- `user-stories.md` — the judge and player user stories with acceptance criteria.

In `designs/`:
- `Nel3ab - Arcade.dc.html` — the judge app plus the player views: setup, room-ready, play, round end, match end, player lobby/live/waiting. Contains the full category/question dataset and all game logic. The top debug bar (judge/player, day/night) is a prototype affordance — remove it.
- `JoinRoom.dc.html` — the player join screen, with code + name validation.
- `Nel3ab Landing - Arcade.dc.html` — the marketing page (hero, how-it-works, game library, pricing close).
- `support.js`, `image-slot.js` — prototype runtime and the image placeholder element. **Reference only; do not port.**

Open any `.dc.html` in a browser to interact with it. To read the intent: the markup is the layout and styling, the class at the bottom of the file is the behavior, and `renderVals()` is the bridge between them — every value the UI shows is named there.

## Open questions for product
- Can players answer from their phones, or does the answer stay spoken with the judge ruling? (Prototype assumes spoken.)
- What happens if the judge disconnects mid-round?
- Are locked categories bought inside the room or on the account beforehand?
- Is there a cap on players per team?
