import { reduce } from '@nel3ab/game'
import type { Action, RoomState, Screen } from '@nel3ab/game'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

import { CATALOG } from './_lib/catalog'
import { drawRound } from './_lib/driver'
import type { LocalRoom } from './_lib/driver'
import { playView } from './_lib/play-view'
import { seedRoom } from './_lib/seed'
import { setupView } from './_lib/view'
import styles from './host.module.css'
import { HostApp } from './HostApp'
import { PendingScreen } from './PendingScreen'
import { PlayScreen } from './PlayScreen'
import { SetupScreen } from './SetupScreen'

// REQ-6.13 — specs/phase-6/verification.md Gate 2, "The route". See specs.md §2.4 (HostApp's
// `play` branch) and §2.5 (this file's row).
//
// `HostApp` is rendered with `renderToStaticMarkup`, as Phase 5's host-markup.test.tsx renders it —
// in Node, with no DOM and no new dependency — but with `./_lib/driver` replaced by `vi.mock`
// (Vitest's own): `createLocalRoom` returns a stub room whose state is whatever this file last set,
// so `HostApp` can be shown a room on any screen with no clock and no click. Everything else the
// driver module exports is the real one — `drawRound`, which builds the rooms below. The stub's
// other methods do nothing: nothing here presses (specs.md §4, R2).
//
// The rooms are real, reached from the seed through the engine's `reduce` as play-view.test.ts
// reaches Table X's: `openRoom`, `startMatch` carrying `drawRound(…, CATALOG, () => 0.5)` (أمثال),
// the judge's actions and the driver's loop steps; for round end and match end, each round's bank
// run out in one tick and the next round drawn as the driver draws it, until a team has three.
//
// Each screen's expected markup is its own component rendered alone for the same room — PlayScreen
// for `playView(state, CATALOG)`, PendingScreen for the room, SetupScreen for `setupView(state,
// CATALOG)` — inside Phase 5's frame written out tag for tag, the header's two texts as literals.
// `HostApp`'s whole markup must equal it: the frame, the header, then exactly that screen.

// --- the stub driver -------------------------------------------------------------------------

/** The state the stub room hands `HostApp`: whatever the test last set. */
const held = vi.hoisted((): { state: RoomState | null } => ({ state: null }))

vi.mock('./_lib/driver', async (importOriginal) => {
  const driver = await importOriginal<typeof import('./_lib/driver')>()
  const room: LocalRoom = {
    getState: () => {
      if (held.state === null) throw new Error('play-routing.test.tsx: no room state set')
      return held.state
    },
    subscribe: () => () => undefined,
    dispatch: () => undefined,
    startMatch: () => undefined,
    nextRound: () => undefined,
    shuffleTeamName: () => undefined,
    dispose: () => undefined,
  }
  return { ...driver, createLocalRoom: (): LocalRoom => room }
})

/** `HostApp`'s server markup for a room on `state`. */
const hostMarkup = (state: RoomState): string => {
  held.state = state
  return renderToStaticMarkup(<HostApp />)
}

// --- the rooms -------------------------------------------------------------------------------

/** The room after `actions`, each reduced in turn from `from`. */
const after = (from: RoomState, ...actions: readonly Action[]): RoomState =>
  actions.reduce((state, action) => reduce(state, action), from)

/** `n` of the driver's loop steps: a tick of 100 ms, then `passTurn`. */
const steps = (n: number): Action[] =>
  Array.from({ length: n }, (): Action[] => [
    { type: 'tick', ms: 100 },
    { type: 'passTurn' },
  ]).flat()

const SEED = seedRoom('SKZJ62')
const READY = after(SEED, { type: 'openRoom' })
/** S1 — round 1, team A's turn, both clocks 45, question 1, no hint spent. */
const S1 = after(READY, { type: 'startMatch', ...drawRound(READY, CATALOG, () => 0.5) })
/** S2 — after one hint. */
const S2 = after(S1, { type: 'hint' })
/** S3 — after the second hint: hints used up. */
const S3 = after(S2, { type: 'hint' })
/** S4 — after صحيح: the reveal up. */
const S4 = after(S3, { type: 'correct' })
/** S5 — the turn passed on the tenth loop step after صحيح. */
const S5 = after(S4, ...steps(10))

/** Table X1–X5's rooms, in state order. */
const PLAY: readonly (readonly [string, RoomState])[] = [
  ['S1', S1],
  ['S2', S2],
  ['S3', S3],
  ['S4', S4],
  ['S5', S5],
]

/** The bank of the team on the clock, run out in one tick: the round ends and is scored. */
const RUN_OUT: Action = { type: 'tick', ms: 45_000 }

/** Round 1 run out: team A's bank empties and team B takes the round — `roundEnd`, 0 – 1. */
const ROUND_END = after(S1, RUN_OUT)

/** From a round's end: the next round, drawn as the driver draws it, then run out. */
const nextRoundRunOut = (state: RoomState): RoomState =>
  after(state, { type: 'nextRound', ...drawRound(state, CATALOG, () => 0.5) }, RUN_OUT)

/** Rounds 2–5, each lost by the team that starts it (B, A, B, A… alternately): `match`, 2 – 3. */
const MATCH = Array.from({ length: 4 }).reduce<RoomState>(
  (state) => nextRoundRunOut(state),
  ROUND_END,
)

// --- the expected markup ----------------------------------------------------------------------

const noop = (): void => undefined

/** A host.module.css class as served. A miss is a defect of this file, not of `HostApp`. */
const served = (name: string): string => {
  const value = styles[name]
  if (value === undefined) throw new Error(`host.module.css: no class value for .${name}`)
  return value
}

/** Phase 5's frame (HostApp.tsx), tag for tag: the page, the stage, the column, the header row. */
const frame = (screen: Screen, roundLabel: string, body: string): string =>
  [
    `<div class="${served('page')}" data-screen="${screen}">`,
    `<div class="${served('stage')}">`,
    `<div class="${served('column')}">`,
    `<div class="${served('header')}">`,
    `<div class="${served('brand')}"><span class="${served('mark')}"></span>نلعب</div>`,
    `<div class="${served('round')}">${roundLabel}</div>`,
    '</div>',
    body,
    '</div></div></div>',
  ].join('')

const playMarkup = (state: RoomState): string =>
  renderToStaticMarkup(
    <PlayScreen view={playView(state, CATALOG)} onSkip={noop} onHint={noop} onCorrect={noop} />,
  )

const pendingMarkup = (state: RoomState): string =>
  renderToStaticMarkup(<PendingScreen state={state} />)

const setupMarkup = (state: RoomState): string =>
  renderToStaticMarkup(
    <SetupScreen
      view={setupView(state, CATALOG)}
      onShuffleTeamName={noop}
      onRenameTeam={noop}
      onSwapTeam={noop}
      onRemovePlayer={noop}
      onSetJudge={noop}
      onSetRotateJudge={noop}
      onPickCategory={noop}
      onOpenRoom={noop}
    />,
  )

/** The text between tags, in document order: every run, whitespace collapsed, empty ones dropped. */
const textRuns = (markup: string): string[] =>
  [...markup.matchAll(/>([^<]*)</g)]
    .map((m) => (m[1] ?? '').replace(/\s+/g, ' ').trim())
    .filter((run) => run !== '')

// --- the route -------------------------------------------------------------------------------

describe('REQ-6.13: HostApp shows PlayScreen on play, and Phase 5’s screens everywhere else', () => {
  test('the rooms: S1–S5 on play in round 1; round end at 0 – 1; match end at 2 – 3 in round 5; the seed on setup', () => {
    expect(PLAY.map(([, state]) => [state.screen, state.round])).toStrictEqual(
      PLAY.map(() => ['play', 1]),
    )
    expect(PLAY.map(([, state]) => state.clock.active)).toStrictEqual(['a', 'a', 'a', 'a', 'b'])
    expect(PLAY.map(([, state]) => state.reveal !== null)).toStrictEqual([
      false,
      false,
      false,
      true,
      false,
    ])
    expect(ROUND_END).toMatchObject({ screen: 'roundEnd', round: 1, tallyA: 0, tallyB: 1 })
    expect(MATCH).toMatchObject({ screen: 'match', round: 5, tallyA: 2, tallyB: 3 })
    expect(MATCH.log.map(({ n, winner }) => [n, winner])).toStrictEqual([
      [1, 'b'],
      [2, 'a'],
      [3, 'b'],
      [4, 'a'],
      [5, 'b'],
    ])
    expect(SEED.screen).toBe('setup')
  })

  test('on play (S1–S5): the frame, "نلعب" / "جولة 1 — أول 3 جولات", then exactly PlayScreen’s markup for playView(state, CATALOG)', () => {
    for (const [name, state] of PLAY) {
      const markup = hostMarkup(state)
      expect(markup, name).toBe(frame('play', 'جولة 1 — أول 3 جولات', playMarkup(state)))
      expect(textRuns(markup).slice(0, 2), name).toStrictEqual(['نلعب', 'جولة 1 — أول 3 جولات'])
      // Not Phase 5's placeholder: its screen key is nowhere in the markup.
      expect(markup, name).not.toContain(pendingMarkup(state))
      expect(markup, name).not.toContain('<span class="ltr-num">play</span>')
    }
  })

  test('on roundEnd and on match: the frame, the header, then exactly Phase 5’s PendingScreen markup — no play screen', () => {
    for (const [state, roundLabel] of [
      [ROUND_END, 'جولة 1 — أول 3 جولات'],
      [MATCH, 'جولة 5 — أول 3 جولات'],
    ] as const) {
      const markup = hostMarkup(state)
      expect(markup, state.screen).toBe(frame(state.screen, roundLabel, pendingMarkup(state)))
      expect(textRuns(markup).slice(0, 3), state.screen).toStrictEqual([
        'نلعب',
        roundLabel,
        state.screen,
      ])
      expect(markup, state.screen).not.toContain(playMarkup(state))
      expect(markup, state.screen).not.toContain('<button')
    }
  })

  test('on setup: the frame, "نلعب" / "إعداد", then exactly Phase 5’s setup markup for the seed, unchanged', () => {
    const markup = hostMarkup(SEED)
    expect(markup).toBe(frame('setup', 'إعداد', setupMarkup(SEED)))
    expect(textRuns(markup).slice(0, 3)).toStrictEqual(['نلعب', 'إعداد', 'يلا نلعب'])
  })
})
