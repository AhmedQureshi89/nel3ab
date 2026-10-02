# Phase 5 Technical Specification — Judge app: setup & room-ready

> **Phase:** Phase 5
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** 1 day

---

## 1. Architecture Overview

Phase 5 touches three workspace projects and nothing else: `packages/game` (the setup rules),
`packages/ui` (two additions) and `apps/web` (the driver, its stand-ins and the screens). No dependency
is added anywhere; the only configuration change is one subpath in `packages/ui/package.json`
(NFR-5.5).

```
                 ┌───────────────────────── apps/web/app/host ─────────────────────────┐
                 │                                                                     │
   browser ──▶   │  page.tsx ─▶ HostApp.tsx ── useSyncExternalStore ──┐                │
   (/host)       │                │   │                               │                │
                 │                │   └─ SetupScreen / ReadyScreen / PendingScreen     │
                 │                │            ▲ props: a view + callbacks             │
                 │                ▼            │                                       │
                 │   _lib/driver.ts  ── createLocalRoom ──▶ state ─▶ _lib/view.ts       │
                 │     │  │  └─ clock loop: tick(100) + passTurn every 100 ms in play  │
                 │     │  └──── draws: drawCategory(drawableCategories) + shuffle     │
                 │     │           ▲ _lib/catalog.ts (temporary — Phase 8 replaces)   │
                 │     │           ▲ _lib/seed.ts, _lib/room-code.ts                  │
                 │     ▼                                                              │
                 │   @nel3ab/game  reduce · setup actions · helpers                   │
                 │   @nel3ab/ui    Panel · Pill · Button(size) · press.module.css     │
                 │   _lib/share.ts · _lib/flash.ts — navigator.share → clipboard → code │
                 └─────────────────────────────────────────────────────────────────────┘
```

The split is the prototype's own: "the markup is the layout and styling, the class at the bottom of the
file is the behavior, and `renderVals()` is the bridge between them" (`design/README.md`). Here the
behaviour is the engine (rules) and the driver (time, randomness, the room's one copy); the bridge is
`_lib/view.ts`, a pure function from state to every value a screen shows, named after `renderVals`'s
keys; and the screens are presentational components that take a view and callbacks. Everything under
`_lib/` is framework-free and runs under Vitest in Node with no DOM, which is what lets this phase add no
test dependency (requirements §4).

**Dependency order is part of the design.** A runner walks it top to bottom; each step is buildable and
testable before the next begins.

```
  STEP 1 ─ The setup rules, and Phases 3–4 kept green              (packages/game)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ types.ts      [MOD]  Action + 8 — LANDS WITH its reducer cases (the  │
  │                      exhaustive `never` default) AND with            │
  │                      match-purity.test.ts's perType() edit (§2.10):  │
  │                      without both, pnpm typecheck fails               │
  │ rules.ts      [MOD]  TEAM_NAMES                                      │
  │ setup.ts      [NEW]  canOpenRoom, currentJudge, shuffleTeamName;     │
  │                      internal helpers                                │
  │ reducer.ts    [MOD]  eight cases                                     │
  │ index.ts      [MOD]  21 exports — LANDS WITH index.test.ts (§2.10)   │
  │ setup.test.ts [NEW]                                                  │
  │   ── pnpm typecheck; pnpm vitest run packages/game: all green        │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 2 ─ Fidelity, purity, the flow's invariants   ▼            (packages/game)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ setup-rules.test.ts          [NEW]  extractions E1–E8 (REQ-5.8)      │
  │ testing/setup-sequences.ts · testing/setup-invariants.ts   [NEW]     │
  │ setup-flow.test.ts           [NEW]  I1–I10, J1–J8, K1–K5 (REQ-5.7)   │
  │ setup-purity.test.ts         [NEW]  NFR-5.3                          │
  │   ── pnpm test: 100% coverage still                                  │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 3 ─ The UI kit's two additions ▼  (independent of 1–2)    (packages/ui)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ package.json            [MOD]  exports + "./press.module.css"        │
  │ primitives/Button.tsx · Button.module.css   [MOD]  size: 'lg' | 'md' │
  │ button-size.test.tsx · press-export.test.ts [NEW]                    │
  │   ── every Phase 2 test green and untouched                          │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 4 ─ The driver and its stand-ins ▼  needs STEP 1         (apps/web/app/host/_lib)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ catalog.ts · seed.ts · room-code.ts · driver.ts · share.ts ·         │
  │ flash.ts · view.ts                    [NEW] + a test file each       │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 5 ─ The screens ▼  needs STEPS 3–4                        (apps/web/app/host)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ page.tsx · HostApp.tsx · SetupScreen.tsx · ReadyScreen.tsx ·         │
  │ PendingScreen.tsx · host / setup / ready .module.css   [NEW]         │
  │ host-markup.test.tsx · host-prototype.test.ts · host-source.test.ts  │
  └──────────────────────────────────────────────────────────────────────┘
                                   │
  STEP 6 ─ Fidelity in the browser ▼ (verification Gate 5 — fix freely)
                                   │
  STEP 7 ─ Coverage, mutations, the four gate commands ▼ (Gate 6)
                                   │
  STEP 8 ─ 🚦 The verdict ▼ (Gate 7 — once, on the commit Gate 6 passed at)
```

**Module dependency inside `packages/game`** stays one way and acyclic. `setup.ts` imports only
`types.ts`; the reducer imports it.

```
  types.ts ◀── rules.ts ◀── clock.ts ◀── room.ts ◀── draw.ts ◀── match.ts ◀── setup.ts ◀── reducer.ts ◀── index.ts
```

**Inside `apps/web/app/host`** the arrows run from the screens down: components import `_lib/view.ts`
types and nothing else from `_lib/` except through `HostApp.tsx`; `_lib/` never imports React or a
component.

---

## 2. Component Specifications

### 2.1 `packages/game/src/types.ts` [MODIFIED]

**Implements:** REQ-5.1 – REQ-5.6

Types only, every property `readonly`. **`RoomState` does not change** — setup edits fields Phase 3
already defined (`players`, `teamA`, `teamB`, `judgeIndex`, `rotateJudge`, `pickedCategories`,
`screen`). `Action` gains eight members, nothing else changes:

```ts
export type Action =
  // … Phase 3's five and Phase 4's four, unchanged …
  // Phase 5 — setup (specs/phase-5/specs.md §2.4). Effective on `setup` only; the
  // last two move between `setup` and `ready`.
  | { readonly type: 'removePlayer'; readonly playerId: PlayerId }
  | { readonly type: 'swapTeam'; readonly playerId: PlayerId }
  | { readonly type: 'renameTeam'; readonly team: Team; readonly name: string }
  | { readonly type: 'setJudge'; readonly playerId: PlayerId }
  | { readonly type: 'setRotateJudge'; readonly rotate: boolean }
  | { readonly type: 'pickCategory'; readonly categoryId: CategoryId; readonly picked: boolean }
  | { readonly type: 'openRoom' }
  | { readonly type: 'backToSetup' }
```

The members **land in the same commit as their reducer cases and as the `perType()` edit of §2.10**:
the reducer's exhaustive `never` default and `match-purity.test.ts`'s `Record<Action['type'], number>`
both fail `pnpm typecheck` until all three agree (measured, requirements §1.1, fact 7).

`setRotateJudge` and `pickCategory` carry the target value rather than toggling: a toggle delivered twice
undoes itself, which a server receiving a retried message (Phase 11) must not do. The screen computes
the target from the state it shows (`!rotateJudge`, `!selected`).

### 2.2 `packages/game/src/rules.ts` [MODIFIED]

**Implements:** REQ-5.3

One constant, beside Phase 3's and Phase 4's:

```ts
/** The shuffle's names, per team — the prototype's NAMES_A and NAMES_B; a new room's defaults are the first of each. */
export const TEAM_NAMES = {
  a: ['النمور', 'الأسود', 'الذئاب', 'النسور'],
  b: ['الصقور', 'الفهود', 'الأبطال', 'النجوم'],
} as const
```

`createRoom` is not changed: it takes `teamA` / `teamB` as input, as Phase 3 wrote it. Callers (the
driver's seed, Phase 11's server) pass `TEAM_NAMES.a[0]` and `TEAM_NAMES.b[0]`.

### 2.3 `packages/game/src/setup.ts` [NEW]

**Implements:** REQ-5.2 – REQ-5.6

Pure functions; no import but `./types.js`. Nothing here calls a random source of its own, and no word Phase 3's ambient grep searches for appears, comments included (NFR-5.2).

**Public** (exported from `index.ts`):

| Function | Contract |
|---|---|
| `canOpenRoom(state): boolean` | `state.screen === 'setup' && state.pickedCategories.length > 0` — the zero-category guard (REQ-5.6). The reducer's `openRoom` and the setup screen's CTA both use it, so they cannot disagree |
| `currentJudge(state): Player \| null` | the prototype's getter, verbatim in effect: `players[judgeIndex % players.length] ?? players[0] ?? null`. With no players `x % 0` is `NaN`, the lookup is `undefined`, `players[0]` is `undefined`, and the result is `null` — every operand of both `??` reachable, no `!` (Phase 3's R5) |
| `shuffleTeamName(current, names, random): string` | `others = names.filter(n => n !== current)`; `r = random()`, exactly one call; `pick = others[Math.floor(r × others.length)]`; if `pick === undefined` — `others` empty, or `r` outside [0, 1), or `NaN` — throw `RangeError` naming `r` and `others.length`. One guard covers every bad input, as Phase 4's `drawCategory` does |

**Internal** (exported from the module for the reducer, **not** from `index.ts`):

| Name | Contract |
|---|---|
| `FILL_NAMES` | `{ a: 'لاعب ١', b: 'لاعب ٢' }` — the prototype's placeholder names |
| `playerIndex(state, playerId): number` | `state.players.findIndex(p => p.id === playerId)`; `-1` when absent |
| `judgeAfterRemoval(judgeIndex, removed): number` | `judgeIndex >= removed && judgeIndex > 0 ? judgeIndex − 1 : judgeIndex` — the prototype's `removePlayer` line, verbatim |
| `fillPlayers(players): readonly Player[]` | the prototype's `startGame` fill (reading 2): if `players.length < 2`, the result **starts empty** (the lone player, if any, is dropped) and gains `{ name: FILL_NAMES.a, team: 'a' }` then `{ name: FILL_NAMES.b, team: 'b' }`; then, for team `a` then `b`, if no player is on that team, one `{ name: FILL_NAMES[team], team }` is appended. Each added player's id is `fill-<k>`, the smallest `k ≥ 1` not already an id in the list being built. If nothing is added, **the input array is returned as is** (same object), so an `openRoom` on a full room does not replace `players` |
| `assertSetupAction(action)` | validation, called first by every setup case, in every state (REQ-5.1): throws `RangeError` unless `playerId` / `categoryId` / `name` is a `string`, `team` is `'a'` or `'b'`, and `rotate` / `picked` is a `boolean` — whichever of these the action carries. `openRoom` and `backToSetup` carry nothing and pass |

**Why ids for fill players are computed, not random.** The reducer may not draw (REQ-3.3), the fill
happens inside it, and the id must be unique within the room: after a fill, back to setup, a swap and a
second `openRoom`, a second fill can be needed while `fill-1` and `fill-2` exist (both on one team).
"Smallest unused `fill-<k>`" is deterministic and always unique.

### 2.4 `packages/game/src/reducer.ts` [MODIFIED]

**Implements:** REQ-5.1 – REQ-5.6

Eight cases; nothing existing moves. **Validation precedes inertness**; an inert action returns `state`
itself (`===`).

| Action | Validation (throws) | Inert when (returns `state`) | Effect |
|---|---|---|---|
| `removePlayer` | `assertSetupAction` | `screen !== 'setup'`, or `i = playerIndex(…) === -1` | `players` without index `i`; `judgeIndex = judgeAfterRemoval(judgeIndex, i)` |
| `swapTeam` | `assertSetupAction` | `screen !== 'setup'`, or the id is absent | the player at `i` gets the other team (`otherTeam` from `clock.ts`); every other player object is kept by identity |
| `renameTeam` | `assertSetupAction` | `screen !== 'setup'`, or the name equals the team's current name | `teamA` or `teamB` = `name` |
| `setJudge` | `assertSetupAction` | `screen !== 'setup'`, the id is absent, or `i === judgeIndex` | `judgeIndex = i` |
| `setRotateJudge` | `assertSetupAction` | `screen !== 'setup'`, or `rotate === rotateJudge` | `rotateJudge = rotate` |
| `pickCategory` | `assertSetupAction` | `screen !== 'setup'`, or `pickedCategories.includes(categoryId) === picked` | `picked`: append at the end; else: filter it out. Order otherwise kept |
| `openRoom` | — | `!canOpenRoom(state)` | `players = fillPlayers(players)`; `screen = 'ready'` |
| `backToSetup` | — | `screen !== 'ready'` | `screen = 'setup'` |

Nothing else changes in any of them: not the room code, the clock, the round, the tallies, the log, the
used list or the question pool. On `setup` and `ready` the match fields already hold their reset values —
every way onto `setup` (a new room, `resetMatch`) and onto `ready` (`openRoom`) leaves them so — which is
verification invariant K1, and why no path to a draw with every category used is added (REQ-5.7).

### 2.5 `packages/game/src/index.ts` [MODIFIED]

**Implements:** NFR-5.4

Runtime exports are **exactly** these twenty-one — Phase 4's seventeen and four more:

```
acceptsJudgeActions   createRoom   currentQuestion   displaySeconds   reduce   remainingMs
HINT_COST_MS   SKIP_COST_MS   ROUND_SECONDS_DEFAULT   ROUND_SECONDS_OPTIONS
WINS_NEEDED_DEFAULT   WINS_NEEDED_OPTIONS
REVEAL_HOLD_MS   drawableCategories   drawCategory   shuffleQuestions   matchWinner
TEAM_NAMES   canOpenRoom   currentJudge   shuffleTeamName
```

plus `export type` of every type in `types.ts`, as before. `setup.ts`'s internal names — `FILL_NAMES`,
`playerIndex`, `judgeAfterRemoval`, `fillPlayers`, `assertSetupAction` — are not exported. The header
comment names Phase 5 beside Phases 3 and 4. This file **lands with** §2.10's `index.test.ts` edit.

### 2.6 `packages/game/src/testing/` [NEW] — test support

**Implements:** REQ-5.7. Excluded from coverage, never exported, imported only by tests. **Phase 3's six
modules and Phase 4's five are not edited**; this phase adds two and imports `prng.ts`, `rooms.ts`
(`categoryIds`, `categoryQuestions`), `match-sequences.ts` (`permutation`), `invariants.ts`,
`match-invariants.ts` and `deep-freeze.ts` from them unchanged.

**`setup-invariants.ts`** — `assertSetupInvariants(state, prev?)`, called after every step of the setup
sample **together with** Phase 3's `assertInvariants` and Phase 4's `assertMatchInvariants`:

| # | Invariant |
|---|---|
| K1 | on `setup` and `ready`: `round === 1`, both tallies 0, `log` and `usedCategories` empty, `categoryId`, `reveal` and `revealedAt` `null` |
| K2 | `pickedCategories` has no repeats |
| K3 | player ids are unique |
| K4 | on `ready`: `pickedCategories` non-empty; at least two players; at least one on each team |
| K5 | when neither `prev` nor `state` is on `setup`: `players`, `teamA`, `teamB`, `rotateJudge` and `pickedCategories` are identical (`===`) to `prev`'s, and `judgeIndex` is `prev`'s or — only in a step whose screen goes `roundEnd → play` — `(prev.judgeIndex + 1) mod max(1, players.length)` with `rotateJudge` on |

K5 is the one that would catch a setup action leaking into a match. Together with Phase 4's J6
(`usedCategories.length === round`) it is the record REQ-5.7 asks for.

**`setup-sequences.ts`** — the pre-registered generator. These constants are **fixed by this document**;
changing any of them changes the sample and is forbidden (verification Gate 2):

```ts
export const SETUP_SEED = 0x20265005
export const SETUP_SEQUENCES = 300
export const SETUP_MAX_STEPS = 2_000      // events, not actions
export const SETUP_EDITS = 40             // setup edits before the room is opened
export const SETUP_TICK_MS = 1_000        // the sample's tick; the clock's own precision is Phases 3–4's
```

One `mulberry32(SETUP_SEED)` is shared by the whole sample. Sequence *i* first draws its room — in this
order: `k = floor(rand() × 11)` players `p1 … pk`, each on team `rand() < 0.5 ? 'a' : 'b'`;
`judgeIndex = floor(rand() × max(1, k))`; `rotateJudge = rand() < 0.5`; `winsNeeded = [2, 3, 4][floor(rand() × 3)]`;
`pickedCategories` = those of `categoryIds(11)` for which `rand() < 0.5`, in order — as
`{ ...createRoom({ roomCode: 'TEST05', teamA: 'أ', teamB: 'ب', config: { roundSeconds: 45, winsNeeded } }), players, judgeIndex, rotateJudge, pickedCategories }`,
on `setup`. Then it generates events, one at a time, from the **engine's** current screen:

| Screen | Event |
|---|---|
| `setup` | while fewer than `SETUP_EDITS` edits have been made since the last arrival on `setup`, an edit: `r = rand()` — `< 0.15` `removePlayer`, `< 0.30` `swapTeam`, `< 0.40` `renameTeam`, `< 0.55` `setJudge`, `< 0.62` `setRotateJudge(rand() < 0.5)`, else `pickCategory(c<floor(rand() × 11)>, rand() < 0.5)`. A player id is an existing player's (`floor(rand() × players.length)`) when `rand() < 0.8` and there is one, else `'ghost'`; a team is `rand() < 0.5 ? 'a' : 'b'`; a name is `TEAM_NAMES[team][floor(rand() × 4)]` when `rand() < 0.8`, else `'x'`. After the edits, `openRoom`; if it is inert (nothing picked), `pickCategory('c0', true)` then `openRoom` |
| `ready` | `r = rand()`: `< 0.2` `backToSetup`; `< 0.4` one setup edit, drawn as above (it is inert); else `startMatch` with a draw |
| `play` | `rand() < 0.15` ? (`r = rand()`: `< 0.5` `correct`; `< 0.8` `skip`; else `hint`) : `tick(SETUP_TICK_MS)` then `passTurn` |
| `roundEnd` | `r = rand()`: `< 0.7` `nextRound` with a draw; `< 0.8` `resetMatch`; else one setup edit (inert) |
| `match` | the first time: `resetMatch` (the sequence continues on `setup`). The second time: **the sequence ends** |

**A draw** is `categoryId = drawCategory(drawableCategories(state), rand)` and
`questions = permutation(rand, 3).map(k => categoryQuestions(categoryId)[k])` — the engine's public
draw and Phase 4's harness permutation, so the sample does not depend on `shuffleQuestions`. A sequence
also ends at `SETUP_MAX_STEPS` events. Generation reads the engine's state rather than an oracle's: this
sample tests the engine against its own invariants, not against the prototype.

### 2.7 `packages/game/src/` tests [NEW]

| File | Asserts | Gate |
|---|---|---|
| `setup.test.ts` | every row of §2.4's table, inert on each of the four other screens, every validation branch, `canOpenRoom`, `currentJudge` (seed, empty, a hand-built index past the end), `shuffleTeamName` (verification's pinned values, its one call, its guard), `fillPlayers` (the four cases of verification Gate 1), the `fill-<k>` id rule | 1 |
| `setup-rules.test.ts` | extractions E1–E8 from `design/designs/Nel3ab - Arcade.dc.html`, each count-asserted and each driving the engine | 1 |
| `setup-flow.test.ts` | the sample of §2.6 through `reduce`, I1–I10, J1–J8 and K1–K5 after every step; the population counts of verification Gate 2 | 2 |
| `setup-purity.test.ts` | frozen inputs, determinism, inert `===`, validation before inertness on every screen, and ambient spies, over the sample | 2 |

Reading `design/` follows Phases 3–4's pattern: `new URL('../../../design/…', import.meta.url)`,
`fileURLToPath`, `readFileSync`; the file name has spaces. Heavy passes carry the explicit `120_000`
ceiling.

### 2.8 `packages/ui` [MODIFIED]

**Implements:** REQ-5.23, NFR-5.4

**`package.json`** — `exports` gains exactly one entry, after `"./base.css"`:

```json
"./press.module.css": "./src/styles/press.module.css"
```

A screen then imports the one press rule — `import press from '@nel3ab/ui/press.module.css'` — and adds
`press.press` to its element beside its own class, which sets `--press-rest` and `--press-travel`, as
`Button.tsx` does. Measured on a scratch copy: it resolves under `pnpm typecheck` (apps/web's
`next-env.d.ts` types `*.module.css`), under the web project's Vitest (to the **same** hashed class
Button carries — one rule, not two) and under `next build`.

**`primitives/Button.tsx`** — one optional prop, `size?: 'lg' | 'md'`, default `'lg'`, emitted as
`data-size={size}` on every Button. **`primitives/Button.module.css`** — one rule, added after the
primary rule and before its hover:

```css
.button[data-variant='primary'][data-size='md'] {
  font-size: 19px;
}
```

The primary rule's own `font-size: 20px` is not touched — Phase 2's `primitives.test.tsx` reads that
rule's declarations exactly — and `size` has no effect on the other two variants. Both changes were made
on a scratch copy: all 83 `@nel3ab/ui` tests pass unedited.

**New tests, in new files** (Phase 2's test files are not edited): `src/primitives/button-size.test.tsx`
(the attribute, the rule, the default) and `src/styles/press-export.test.ts` (the manifest's subpath
points at `press.module.css`, and that module's `press` class is the one `Button` applies).

### 2.9 `apps/web/app/host/_lib/` [NEW] — the driver and its stand-ins

**Implements:** REQ-5.10 – REQ-5.14, REQ-5.21, REQ-5.22. Framework-free TypeScript; no React import.
The leading underscore keeps the folder out of Next's routing.

**`catalog.ts`** — *temporary; Phase 8 replaces it with `@nel3ab/content`, Phase 11 with the server's
list.* The header comment says so in its first line.

```ts
export interface CatalogEntry {
  readonly id: CategoryId
  readonly name: string
  readonly emoji: string
  readonly locked: boolean
  readonly questions: readonly [Question, ...Question[]]
}
export const CATALOG: readonly CatalogEntry[]          // 11, in the prototype's order
export function catalogEntry(id: CategoryId): CatalogEntry  // throws RangeError for an unknown id
```

| # | `id` | `name` | `emoji` | `locked` |
|---|---|---|---|---|
| 0 | `industry` | صناعة | 🏭 | |
| 1 | `animals` | حيوانات | 🦁 | |
| 2 | `nature` | طبيعة | 🌋 | |
| 3 | `society` | إنسان ومجتمع | 🌍 | |
| 4 | `culture` | ثقافة | 🎎 | ✔ |
| 5 | `proverbs` | أمثال | 💬 | |
| 6 | `history` | تاريخ | 🏛️ | |
| 7 | `religion` | دين | 🕌 | |
| 8 | `art` | فن | 🎨 | ✔ |
| 9 | `movies` | أفلام | 🎬 | ✔ |
| 10 | `science` | علوم | 🔬 | |

The ids are this file's; Phase 8 chooses the content's. Every entry's questions are three placeholders,
`d` = ١، ٢، ٣ in turn:

```ts
{ q: `سؤال تجريبي ${d} — ${name}`, a: `إجابة تجريبية ${d}`, alts: [],
  h: ['تلميح تجريبي ١', 'تلميح تجريبي ٢'], f: 'معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨' }
```

**`seed.ts`** — the prototype's initial room (REQ-5.10, DECIDED):

```ts
export const SEED_PLAYERS: readonly Player[] = [
  { id: 'seed-1', name: 'ريم', team: 'a' }, { id: 'seed-2', name: 'سعد', team: 'b' },
  { id: 'seed-3', name: 'نورة', team: 'a' }, { id: 'seed-4', name: 'خالد', team: 'b' },
  { id: 'seed-5', name: 'ماجد', team: 'a' },
]
export const SEED_JUDGE_INDEX = 4
export const SEED_PICKED: readonly CategoryId[] =      // the prototype's [0,1,2,3,5,6,7,10]
  ['industry', 'animals', 'nature', 'society', 'proverbs', 'history', 'religion', 'science']
export function seedRoom(roomCode: string): RoomState
  // { ...createRoom({ roomCode, teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] }),
  //   players: SEED_PLAYERS, judgeIndex: SEED_JUDGE_INDEX, pickedCategories: SEED_PICKED }
```

**`room-code.ts`** — `ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`,
`ROOM_CODE_LENGTH = 6`, `makeRoomCode(random): string` — six characters, each
`ROOM_CODE_ALPHABET[Math.floor(random() × 36)]`, six calls; a `RangeError` if any lookup is `undefined`.
*Placeholder until Phase 11* (reading 8).

**`driver.ts`** — the local room:

```ts
export const TICK_MS = 100   // the prototype's setInterval(…, 100); verification extracts it

/** What a screen may dispatch raw. No startRound ever; startMatch / nextRound only through the
 *  methods that draw for them; tick / passTurn only from the clock loop (REQ-5.13). */
export type DriverAction = Extract<Action, { readonly type:
  | 'removePlayer' | 'swapTeam' | 'renameTeam' | 'setJudge' | 'setRotateJudge' | 'pickCategory'
  | 'openRoom' | 'backToSetup' | 'hint' | 'skip' | 'correct' | 'resetMatch' }>

export interface Timers {
  setInterval(callback: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

export interface LocalRoomOptions {
  readonly random?: Random                    // default Math.random
  readonly timers?: Timers                    // default globalThis
  readonly catalog?: readonly CatalogEntry[]  // default CATALOG
  readonly reducer?: (state: RoomState, action: Action) => RoomState  // default reduce; tests record
  readonly initial?: RoomState                // default seedRoom(makeRoomCode(random))
}

export interface LocalRoom {
  getState(): RoomState
  subscribe(listener: () => void): () => void
  dispatch(action: DriverAction): void
  startMatch(): void       // on ready and match only: draw, then startMatch
  nextRound(): void        // on roundEnd only: draw, then nextRound
  shuffleTeamName(team: Team): void
  dispose(): void
}

export function drawRound(state: RoomState, catalog: readonly CatalogEntry[], random: Random):
  { readonly categoryId: CategoryId; readonly questions: readonly [Question, ...Question[]] }

export function createLocalRoom(options?: LocalRoomOptions): LocalRoom
```

| Part | Behaviour |
|---|---|
| `drawRound` | `categoryId = drawCategory(drawableCategories(state), random)`; then `shuffleQuestions(entry.questions, random)` — **one** call for the category, then exactly one per question, nothing else (REQ-5.11). The shuffled list is re-asserted non-empty for its type without a `!` |
| creation | `state = initial ?? seedRoom(makeRoomCode(random))`. No timer starts |
| `apply(action)` (private) | `next = reducer(state, action)`; if `next !== state`: `state = next`, notify every listener, then `sync()`. An inert action notifies nobody |
| `dispatch` | `apply(action)` |
| `startMatch` / `nextRound` | if the screen is not one where the action takes effect (`ready` or `match`; `roundEnd`), **do nothing and call no random source**. Else `apply({ type, ...drawRound(state, catalog, random) })` |
| `shuffleTeamName(team)` | `apply({ type: 'renameTeam', team, name: shuffleTeamName(current, TEAM_NAMES[team], random) })` |
| `sync()` (private) | on `play` with no interval running: `timers.setInterval(step, TICK_MS)`; off `play` with one running: `timers.clearInterval(…)` |
| `step()` (private) | `apply({ type: 'tick', ms: TICK_MS })`, then `apply({ type: 'passTurn' })` — every interval, unconditionally; the engine refuses the pass until it is due (REQ-5.12) |
| `dispose()` | clears the interval if one runs. The room stays usable: the next `apply` that lands on `play` restarts the loop (React's development double-mount calls `dispose` and re-subscribes) |

The driver never reads a clock: it counts intervals, not milliseconds (Phase 3's finding). A browser that
throttles a background tab's timers slows this room's clock exactly as it slows the prototype's — the
server owns the clock from Phase 11 (`mission.md` §5.2); verification §9 records it.

**`share.ts`** — the prototype's `shareRoom`, framework-free:

```ts
export const SHARE_URL_BASE = 'https://nel3ab.game/j/'
export interface ShareTarget {
  readonly share?: (data: { title: string; text: string; url: string }) => Promise<void>
  readonly clipboard?: { readonly writeText?: (text: string) => Promise<void> }
}
/** The label to flash, or null when the host dismissed the share sheet. */
export async function shareRoom(code: string, target: ShareTarget): Promise<string | null>
```

`link = SHARE_URL_BASE + code`. If `target.share`: await it with `{ title: 'نلعب', text: 'انضم لغرفتنا
بالكود ' + code, url: link }` → `'تمت المشاركة ✔'`; on rejection with an error whose `name` is
`'AbortError'` → `null`; on any other rejection (an `undefined` one included) → `copy()`. Without
`share` → `copy()`. `copy()`: if `target.clipboard?.writeText`, await it with `link` →
`'نُسخ الرابط ✔'`, on rejection `'الكود: ' + code`; without it, `'الكود: ' + code`. In the page,
`target` is `navigator`.

**`flash.ts`** — `FLASH_MS = 1800`; `createFlash(onChange, timers = globalThis): { show(label), dispose() }`.
`show` calls `onChange(label)`, clears any pending timeout, and sets one for `FLASH_MS` that calls
`onChange(null)` — the prototype's `flash`, whose `clearTimeout` makes a second press restart the
1800 ms.

**`view.ts`** — the `renderVals` bridge, pure, named after its keys (REQ-5.16 – REQ-5.20, REQ-5.22):

| Function / field | Value |
|---|---|
| `roundLabel(state)` | `'إعداد'` on `setup` and `ready`; else `` `جولة ${round} — أول ${winsNeeded} جولات` `` |
| `setupView(state, catalog)` | the fields below |
| `.playerCountLabel` | `` `${players.length} لاعبين` `` |
| `.teams.a` / `.teams.b` | `{ label: 'فريق ١' / 'فريق ٢', name: teamA / teamB, members }`; `members` = the team's names joined by `'، '`, or `'بدون لاعبين'` |
| `.chips` | one `{ id, name, team }` per player, in order |
| `.judgeHint` | `players.length % 2 === 1 ? 'العدد فردي — يفضّل التبديل' : 'ثابت طول المباراة'` |
| `.judgeOptions` | one `{ id, name, selected: index === judgeIndex }` per player — `===`, not modulo, as the prototype writes it |
| `.rotateOn`, `.rotateLabel` | `rotateJudge`; `(rotateJudge ? '✔ ' : '○ ') + 'بدّل الحكم كل جولة'` |
| `.pickedLabel` | `` `${pickedCategories.length} من ${catalog.length} مختارة` `` |
| `.tiles` | per catalog entry: `{ id, name, emoji, locked, selected: picked.includes(id), tag }`, `tag` = `locked ? '🔒 مدفوعة' : selected ? 'مختارة' : ''` |
| `.canStart` | `canOpenRoom(state)` |
| `.setupNote` | `` `الحكم يشوف الإجابات · ${roundSeconds} ثانية لكل فريق · ما تحتاج تسجّل دخول` `` |
| `readyView(state)` | `{ roundLabel, roomCode, judgeName: currentJudge(state)?.name ?? '—', chips }` |

### 2.10 Phases 3–4's test files — the sanctioned edits [MODIFIED]

**Implements:** REQ-5.7

These are the **only** changes to any file Phases 3 or 4 wrote under `packages/game/src`. Each is a
list written to fail when the surface grows. Every other byte of every Phase 3 and Phase 4 test file and
of `src/testing/*` is unchanged — verification Gate 1 checks it with `git diff` against `7a60dcc`.

| File | Edit |
|---|---|
| `match-purity.test.ts` (Phase 4) | `perType()` gains `removePlayer`, `swapTeam`, `renameTeam`, `setJudge`, `setRotateJudge`, `pickCategory`, `openRoom`, `backToSetup`, each `0`, after `startRound: 0`; the comment above it gains one sentence: Phase 5's eight setup actions are counted though the harness never gives them, as `startRound` is. **Measured** (requirements §1.1, fact 7): without it, `pnpm typecheck` fails with TS2740 at this function; with it, every assertion in the file passes unchanged |
| `index.test.ts` (Phase 3) | `import * as setup from './setup.js'`; the sorted export list gains `TEAM_NAMES`, `canOpenRoom`, `currentJudge`, `shuffleTeamName`, and the test title's "seventeen names of specs.md §2.6 and specs/phase-4/specs.md §2.8" becomes "twenty-one names of specs.md §2.6, specs/phase-4/specs.md §2.8 and specs/phase-5/specs.md §2.5"; the `kinds` map gains `TEAM_NAMES: 'object'` and the three `'function'`s; the internal-names test gains `FILL_NAMES`, `playerIndex`, `judgeAfterRemoval`, `fillPlayers` and `assertSetupAction`, each with `setup`, and its comment one sentence naming them. **Measured:** without it, two tests fail (the list and the map) |

`apps/game/src/index.test.ts` imports only `createRoom` and is untouched.

### 2.11 `apps/web/app/host/` [NEW] — the screens

**Implements:** REQ-5.15 – REQ-5.21. Every value below is the prototype's (verification Tables P–S),
mapped onto `@nel3ab/ui`'s tokens where one exists. Class names are kebab-case
(`selector-class-pattern`), read as `styles['team-name']`. Every rule is logical (NFR-5.8).

**`page.tsx`** — a server component: `export const metadata = { title: 'نلعب — لعبة المعلومات' }` and
`<HostApp />`. **`HostApp.tsx`** — `'use client'`:

```tsx
const [room] = useState(() => createLocalRoom())          // one room per page load
useEffect(() => () => room.dispose(), [room])
const state = useSyncExternalStore(room.subscribe, room.getState, room.getState)
const [shareLabel, setShareLabel] = useState<string | null>(null)
const [flash] = useState(() => createFlash(setShareLabel))
```

It renders the frame and, by `state.screen`, `SetupScreen` (with `setupView(state, CATALOG)` and
callbacks that dispatch §2.4's actions, `room.shuffleTeamName`, and `{ type: 'openRoom' }`),
`ReadyScreen` (with `readyView(state)`, `shareLabel`, and callbacks: share →
`shareRoom(code, navigator).then(l => { if (l !== null) flash.show(l) })`, start → `room.startMatch()`,
back → `{ type: 'backToSetup' }`), or `PendingScreen`. The share flash is held here, above the screens,
so it outlives a trip to setup exactly as the prototype's does. Nothing random is computed during render;
the room code, the only random value created before the host's first action, renders on `ready` only, so
the server and the hydrated markup agree (REQ-5.10).

**The frame (`host.module.css`)**

| Class | Declarations |
|---|---|
| `.page` (root, `data-screen`) | `min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--font); line-height: normal; padding-block-end: 60px` — `line-height: normal` because `globals.css` sets 1.5 on `body` and the prototype's body has none (requirements §1.1, fact 3) |
| `.stage` | `display: flex; justify-content: center; padding: 6px 14px` |
| `.column` | `width: 100%; max-width: 440px` |
| `.header` | `display: flex; align-items: center; justify-content: space-between; margin-block-end: 14px` |
| `.brand` | `display: flex; align-items: center; gap: 9px; font-size: 19px; font-weight: 800; white-space: nowrap` |
| `.mark` | `display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: var(--red); border: var(--bd) solid var(--stroke)` |
| `.round` | `font-size: 12px; font-weight: 700; color: var(--muted); white-space: nowrap` |

**`SetupScreen.tsx` / `setup.module.css`** — top to bottom (`design/README.md` §2):

| Element | Built from | Declarations beyond the primitive |
|---|---|---|
| `h1` "يلا نلعب" | — | `margin: 0 0 2px; font-size: 34px; font-weight: 800; line-height: 1.15` |
| lede `p` | — | `margin: 0 0 16px; font-size: 14.5px; font-weight: 600; color: var(--muted)` |
| teams / judge / categories card | `Panel` (3px · 20px · 14px · `0 4px 0`) | `margin-block-end: 14px` (categories `18px`) |
| card head | — | `display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-block-end: 10px` (judge `4px`); title `15px / 800`, note `12px / 600 var(--muted)`, both `nowrap` |
| team tiles | — | grid `1fr 1fr`, `gap: 10px`; tile `border: var(--bd) solid var(--stroke); border-radius: var(--r-tile); padding: 11px`; `data-team` → `var(--red)` / `var(--sky)` |
| tile head | — | `display: flex; align-items: center; justify-content: space-between`; label `11px / 700 rgb(255 255 255 / 80%)` |
| ↺ shuffle | `<button title="اسم ثاني" aria-label="اسم ثاني">` | `background: rgb(0 0 0 / 18%); border: none; border-radius: var(--r-xs); color: #fff; font-family: inherit; font-size: 13px; padding: 3px 7px; cursor: pointer` |
| team name | `<input aria-label="فريق ١">` | `width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: inherit; font-size: 17px; font-weight: 800; padding: 2px 0` — `outline: none` is the prototype's inline style, which beats its global `:focus-visible` |
| members | — | `font-size: 11.5px; font-weight: 600; color: rgb(255 255 255 / 85%); overflow: hidden; text-overflow: ellipsis; white-space: nowrap` |
| chips | `Pill tone={team === 'a' ? 'red' : 'sky'}` with the name, then ↔ and ✕ | container `display: flex; flex-wrap: wrap; gap: 7px; margin-block-start: 10px`. ↔ / ✕: `<button title="بدّل الفريق">` / `"حذف"`, each `aria-label` the same; `background: rgb(0 0 0 / 20%); border: none; border-radius: var(--r-pill); color: #fff; font-family: inherit; font-size: 11px; font-weight: 800; padding: 2px 7px; cursor: pointer` |
| judge line `p` | — | `margin: 0 0 10px; font-size: 12.5px; font-weight: 600; color: var(--muted)` |
| judge choices | `<button aria-pressed>` — screen-local, not `Pill` (requirements §1.1, fact 4) | container `display: flex; flex-wrap: wrap; gap: 7px`; choice `border: var(--bd) solid var(--stroke); border-radius: var(--r-pill); background: var(--panel); color: var(--ink); padding: 6px 14px; font-family: inherit; font-size: 13.5px; font-weight: 700; white-space: nowrap; cursor: pointer`; `[data-selected='true']` → `background: var(--yellow); color: var(--on-yellow); box-shadow: var(--sh-sel)` |
| rotation toggle | `<button aria-pressed>` | `margin-block-start: 11px; width: 100%; border: var(--bd) solid var(--stroke); border-radius: var(--r-input); background: var(--sunken); color: var(--ink); padding: 10px; font-family: inherit; font-size: 13.5px; font-weight: 700; text-align: start; cursor: pointer`; `[data-on='true']` → `background: var(--leaf); color: var(--on-leaf)` |
| rail | — | `display: flex; gap: 9px; overflow-x: auto; scroll-snap-type: x mandatory; padding-block-end: 6px; margin-inline: -14px; padding-inline: 14px; scrollbar-width: none`. No `scroll-padding` (requirements §1.1, fact 2). The prototype's `-webkit-overflow-scrolling: touch` is omitted: it has no effect in any browser this app supports, and its vendor prefix is not Stylelint-clean |
| tile | `<button aria-pressed>`; **no** `disabled` / `aria-disabled` | `position: relative; flex: 0 0 auto; width: 92px; scroll-snap-align: start; border: var(--bd) solid var(--stroke); border-radius: var(--r-tile); background: var(--panel); color: var(--ink); padding: 12px 5px; display: flex; flex-direction: column; align-items: center; gap: 5px; font-family: inherit; cursor: pointer`. `[data-selected='true']` → `background: var(--yellow); color: var(--on-yellow); box-shadow: var(--sh-sel)`; `[data-locked='true']` → `opacity: 0.5; cursor: not-allowed`. Its own `font-size` is left to the browser, as the prototype leaves it |
| tile parts | three `<span>`s, always all three | emoji `22px`; name `11.5px / 700`, `text-align: center; line-height: 1.2`; tag `10px / 800; white-space: nowrap; color: var(--muted)`, locked `var(--red)` |
| CTA | `Button` (primary, 20px), `disabled={!view.canStart}`, children `<span>ابدأ اللعبة</span><span>▶</span>` | — |
| footnote `p` | — | `margin: 10px 0 0; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--muted)` |

A locked tile's click handler returns before calling anything (the prototype's `if(!c.locked)`).

**`ReadyScreen.tsx` / `ready.module.css`** (`design/README.md` §3):

| Element | Built from | Declarations |
|---|---|---|
| root | — | `text-align: center; padding: 40px 10px 0` |
| 🎉 | `<div aria-hidden>` | `font-size: 54px; --bob: bob 1s ease-in-out infinite; animation: var(--bob)` — the **global** keyframe through a custom property (requirements §1.1, fact 6). Never `animation: bob …` in the module (renamed to a keyframe that does not exist) and never `global(bob)` (Stylelint) |
| `h2` "الغرفة جاهزة!" | — | `margin: 14px 0 4px; font-size: 26px; font-weight: 800` |
| caption | — | `margin-block-start: 16px; font-size: 13px; font-weight: 600; color: var(--muted)` |
| code row | — | `display: flex; align-items: center; justify-content: center; gap: 10px; margin-block-start: 10px` |
| room code | `<div className="ltr-num …">` | `font-weight: 800; font-size: 26px; letter-spacing: 0.2em; background: var(--panel); border: var(--bd-thick) solid var(--stroke); border-radius: var(--r-tile); box-shadow: var(--sh-card); padding: 12px 18px; white-space: nowrap` — `.ltr-num` supplies Archivo and the isolation |
| share | `<button>` with `press.press` from `@nel3ab/ui/press.module.css` | `--press-rest: 4px; --press-travel: 3px; display: flex; align-items: center; gap: 7px; border: var(--bd-thick) solid var(--stroke); border-radius: var(--r-tile); background: var(--panel); color: var(--ink); font-family: inherit; font-size: 14px; font-weight: 800; padding: 14px 16px; white-space: nowrap; cursor: pointer`; `[data-flash='true']` → `background: var(--leaf); color: var(--on-leaf)`; icon `<span aria-hidden>⤴</span>` at `16px`; label `shareLabel ?? 'مشاركة'` |
| in-room panel | `Panel` | `margin-block-start: 20px; text-align: start`; head as the setup card head but title `14px / 800`, judge "الحكم: <name>" `12px / 600 var(--muted)` |
| room chips | `<span>` — screen-local, not `Pill` | container `display: flex; flex-wrap: wrap; gap: 7px`; chip `display: inline-flex; align-items: center; gap: 6px; border: var(--bd) solid var(--stroke); border-radius: var(--r-pill); padding: 4px 12px; font-size: 13.5px; font-weight: 700; white-space: nowrap; color: #fff`; `data-team` → `var(--red)` / `var(--sky)` |
| start | `Button` primary `size="md"` (19px), `<span>ابدأ الجولة الأولى</span><span>▶</span>` | `margin-block-start: 18px` |
| back | `Button` secondary, "رجوع للإعداد" | `width: 100%; margin-block-start: 12px` — the secondary Button sets no width of its own |

**`PendingScreen.tsx`** — *temporary; Phases 6 and 7 replace it.* A `Panel` showing the screen key
(`play` / `roundEnd` / `match`, in `.ltr-num`), the round, both teams' names with
`displaySeconds(remainingMs(clock, team))` and their tallies. No button, no question, no answer. It has no
prototype counterpart and is not compared.

### 2.12 `apps/web` tests [NEW]

All run in Node under the web project's existing Vitest configuration, with no DOM: `_lib` is
framework-free, and the screens are tested as `renderToStaticMarkup` output, as `rtl-root.test.ts`
already does.

| File | Asserts | Gate |
|---|---|---|
| `_lib/catalog.test.ts` | eleven entries, ids unique, three placeholder questions each with distinct `q`, the placeholder text | 4 |
| `_lib/seed.test.ts` | `seedRoom` field for field; Phase 4's J8 and this phase's K1–K4 shapes hold on it | 4 |
| `_lib/room-code.test.ts` | length, alphabet, pinned values, the guard, the default source | 4 |
| `_lib/driver.test.ts` | `drawRound`'s pinned draws and call counts; the real-source statistics; the loop under fake timers (Table T); the dispatch log has no `startRound`; `startMatch` / `nextRound` off their screens call no random source; `dispose` | 4 |
| `_lib/share.test.ts` · `_lib/flash.test.ts` | the seven share paths; the 1800 ms flash and its restart | 4 |
| `_lib/view.test.ts` | every label of §2.9's view table, for the seed and for edited rooms | 4 |
| `host-markup.test.tsx` | the static markup of each screen for given views: text, attributes (`data-team`, `data-selected`, `data-locked`, `data-on`, `data-flash`, `disabled`), the ready CTA's `data-size="md"`, no debug bar, `HostApp`'s server markup identical for two random sources | 4 |
| `host-prototype.test.ts` | extractions W1–W9 (REQ-5.22) | 4 |
| `host-source.test.ts` | greps over `apps/web` non-test source: no `startRound`; no question, answer, variant, hint or fact string of the prototype's; no `fetch(`, `WebSocket`, `EventSource`, `sendBeacon`, `XMLHttpRequest` or `localStorage` under `app/host` (NFR-5.7) | 4 |

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `packages/game/src/types.ts` | MODIFIED | REQ-5.1 – REQ-5.6 — `Action` + 8 |
| `packages/game/src/rules.ts` | MODIFIED | REQ-5.3 — `TEAM_NAMES` |
| `packages/game/src/setup.ts` | NEW | REQ-5.2 – REQ-5.6 |
| `packages/game/src/reducer.ts` | MODIFIED | REQ-5.1 – REQ-5.6 — eight cases |
| `packages/game/src/index.ts` | MODIFIED | NFR-5.4 — twenty-one exports |
| `packages/game/src/{index,match-purity}.test.ts` | MODIFIED | REQ-5.7 — §2.10's edits, and only those |
| `packages/game/src/{setup,setup-rules,setup-flow,setup-purity}.test.ts` | NEW | Gates 1–2 |
| `packages/game/src/testing/{setup-sequences,setup-invariants}.ts` | NEW | REQ-5.7 |
| every other file under `packages/game/src` | UNTOUCHED — Phases 3–4's code and evidence | REQ-5.7 |
| `packages/ui/package.json` | MODIFIED | REQ-5.23 — one `exports` subpath |
| `packages/ui/src/primitives/Button.{tsx,module.css}` | MODIFIED | REQ-5.23 — `size` |
| `packages/ui/src/primitives/button-size.test.tsx`, `packages/ui/src/styles/press-export.test.ts` | NEW | Gate 3 |
| every other file under `packages/ui` | UNTOUCHED — Phase 2's tests included | REQ-5.23 |
| `apps/web/app/host/page.tsx`, `HostApp.tsx`, `SetupScreen.tsx`, `ReadyScreen.tsx`, `PendingScreen.tsx`, `{host,setup,ready}.module.css` | NEW | REQ-5.15 – REQ-5.21 |
| `apps/web/app/host/_lib/{catalog,seed,room-code,driver,share,flash,view}.ts` | NEW | REQ-5.10 – REQ-5.14, REQ-5.21, REQ-5.22 |
| `apps/web/app/host/**/*.test.{ts,tsx}` | NEW | Gate 4 |
| `apps/web/app/{layout.tsx,globals.css,fonts.ts,page.tsx}`, `apps/web/app/styleguide/**`, `apps/web/*.test.ts`, `apps/web/{package.json,tsconfig.json,next.config.ts}` | UNTOUCHED | NFR-5.5 |
| `vitest.config.ts`, root `package.json`, `pnpm-lock.yaml`, every `tsconfig*.json`, `.github/workflows/ci.yml`, `scripts/check-collected-tests.mjs`, `eslint.config.mjs`, `stylelint.config.mjs`, `prettier.config.mjs`, `.gitattributes`, `.gitignore`, `.prettierignore` | UNTOUCHED | NFR-5.5 |
| `apps/game/**`, `packages/{protocol,content}/**` | UNTOUCHED | requirements §4 |
| `design/**`, `specs/**` (except ticking `verification.md`) | UNTOUCHED | NFR-5.1 |

---

## 4. Known Risks in This Phase

**R1 — A deviation the tables do not name.** Tables P–R pre-register the elements a designer would look
at; an element left out of them (a wrapper's padding, a line box) can differ and pass every row.
*Revealed by:* partly — the verdict also compares the two columns' total heights, which no vertical
deviation anywhere in the column leaves unchanged, and attaches screenshots for the owner's look. A
horizontal deviation inside an untabled box is caught only by the look. *Fallback:* none in the
verdict — a deviation found there halts and returns to the owner.

**R2 — No DOM in the tests.** No test clicks a button. A chip whose ✕ calls `swapTeam`, or a tile whose
handler ignores `locked`, passes every static-markup test. *Revealed by:* Gate 5's browser pass, which
clicks every control and records what changed. The click wiring is therefore re-checked by a person or by
Claude in a browser, not by CI; verification §9 records that.

**R3 — The draw is shown random only statistically.** Pinned-value tests prove the driver calls the
helpers; only the real-source distribution test shows `Math.random` is the source. Its bounds are ±5σ,
so it fails spuriously about once in 10⁵ runs. *Fallback:* a failure is re-run once and recorded; two
consecutive failures are a defect.

**R4 — Hydration.** A room code or any random value rendered on the first paint makes the server's
markup and the client's differ. *Revealed by:* `host-markup.test.tsx` renders `HostApp` twice with two
random sources and requires identical markup; React's own hydration warning in Gate 5's browser pass.

**R5 — CSS Modules and the cascade.** Three traps were measured on a scratch copy and are written into
§2.11: the global keyframe (requirements §1.1, fact 6); a screen class losing to a primitive's
`[data-variant]` selector (the 19 px CTA is a `Button` prop, not an override, for this reason); and the
`body` line-height (fact 3). *Revealed by:* Gate 5's computed-style rows.

**R6 — Phase 3's and Phase 4's suites go red for a reason that looks like a sanctioned edit.** *Revealed
by:* Gate 1's `git diff` box, which allows exactly §2.10's hunks. *Fallback:* none — a Phase 3 or 4 test
failing outside §2.10 means one of their rules changed. Stop.

**R7 — The verdict's environment drifts.** The prototype loads its fonts from Google; the app self-hosts
its own copies. A different font build, a different device-pixel ratio (border snapping: 3 px paints
2.667 px and 2.5 px paints 2 px at 1.5) or a missing font changes every height. *Revealed by:* the
verdict's procedure re-measures the prototype first and requires it to reproduce Tables P–R before
comparing; if it does not, the comparison is made between the two pages as measured, and the difference
from the tables is recorded as a finding.

**R8 — The suite's time.** The setup sample adds about 300 sequences of up to 2,000 events, each checked
against 23 invariants, to a game project that already takes ~10–11 s of NFR-5.6's 20 s on Windows and
28 s on Ubuntu CI. *Revealed by:* Gate 6's timing box. *Fallback:* none — the sample is pre-registered;
an overrun is a finding.

---

*Last updated: 2026-10-02*
