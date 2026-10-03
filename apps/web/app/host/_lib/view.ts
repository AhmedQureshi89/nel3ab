// REQ-5.15 – REQ-5.20, REQ-5.22 — specs/phase-5/specs.md §2.9, `view.ts`. The bridge between the
// room and the screens: pure functions from state to every value the setup and room-ready screens show,
// named after the keys of the prototype's `renderVals()` (design/README.md: "the markup is the
// layout and styling, the class at the bottom of the file is the behavior, and `renderVals()` is
// the bridge between them"). Here the behaviour is the engine and the driver; this file is the
// bridge; the screens take a view and callbacks and compute nothing of their own.
//
// Every label is the prototype's, built as `renderVals` builds it, from the same parts:
//
//   playerCountLabel  s.players.length + ' لاعبين'
//   membersA / B      names.join('، ') || 'بدون لاعبين'
//   judgeHint         s.players.length % 2 === 1 ? 'العدد فردي — يفضّل التبديل' : 'ثابت طول المباراة'
//   judgeOptions      selected when i === s.judgeIdx — `===`, not modulo
//   rotateLabel       (s.rotateJudge ? '✔ ' : '○ ') + 'بدّل الحكم كل جولة'
//   pickedLabel       s.picked.length + ' من ' + CATS.length + ' مختارة'
//   catGrid[].tag     c.locked ? '🔒 مدفوعة' : (on ? 'مختارة' : '')
//   setupNote         'الحكم يشوف الإجابات · ' + this.roundTime + ' ثانية لكل فريق · ما تحتاج تسجّل دخول'
//   roundLabel        'إعداد' on setup and ready, else 'جولة ' + round + ' — أول ' + winsNeeded + ' جولات'
//   judgeName         judge ? judge.name : '—'
//   copyLabel         s.shareMsg ? s.shareMsg : 'مشاركة'
//
// `host-prototype.test.ts` reads those parts from the prototype at run time and asserts this
// file's output is built from them (REQ-5.22, extraction W4). The colours `renderVals` also
// computes are not here: they are the screens' CSS, keyed on the `selected` / `locked` / `on`
// flags this file supplies (specs.md §2.11).
//
// Framework-free: no React import (specs.md §1). The screens import this file's types only.

import { canOpenRoom, currentJudge } from '@nel3ab/game'
import type { CategoryId, PlayerId, RoomState, Team } from '@nel3ab/game'

import type { CatalogEntry } from './catalog'

/** One player as a chip: on setup with ↔ and ✕, on room-ready alone. */
export interface ChipView {
  readonly id: PlayerId
  readonly name: string
  readonly team: Team
}

/** One team's tile on the teams card. */
export interface TeamView {
  /** 'فريق ١' or 'فريق ٢'. */
  readonly label: string
  /** The team's name, as typed — the editable field's value. */
  readonly name: string
  /** The team's players' names joined by '، ', or 'بدون لاعبين'. */
  readonly members: string
}

/** One choice on the judge card. */
export interface JudgeOptionView {
  readonly id: PlayerId
  readonly name: string
  readonly selected: boolean
}

/** One tile on the categories rail. */
export interface TileView {
  readonly id: CategoryId
  readonly name: string
  readonly emoji: string
  readonly locked: boolean
  readonly selected: boolean
  /** '🔒 مدفوعة' when locked, else 'مختارة' when selected, else ''. */
  readonly tag: string
}

/** Every value the setup screen shows. */
export interface SetupView {
  readonly playerCountLabel: string
  readonly teams: { readonly a: TeamView; readonly b: TeamView }
  readonly chips: readonly ChipView[]
  readonly judgeHint: string
  readonly judgeOptions: readonly JudgeOptionView[]
  readonly rotateOn: boolean
  readonly rotateLabel: string
  readonly pickedLabel: string
  readonly tiles: readonly TileView[]
  /** Whether "ابدأ اللعبة" opens the room — the engine's own guard, `canOpenRoom`. */
  readonly canStart: boolean
  readonly setupNote: string
}

/** Every value the room-ready screen shows but the share outcome, which `HostApp` holds. */
export interface ReadyView {
  readonly roundLabel: string
  readonly roomCode: string
  /** The judge's name, or '—' when there is none; the screen writes "الحكم: " before it. */
  readonly judgeName: string
  readonly chips: readonly ChipView[]
}

/** The share button's label while no outcome is flashing — the prototype's `copyLabel` default. */
export const SHARE_LABEL = 'مشاركة'

/** The header's round label: 'إعداد' on setup and room-ready, else the round and the match's length. */
export function roundLabel(state: RoomState): string {
  return state.screen === 'setup' || state.screen === 'ready'
    ? 'إعداد'
    : `جولة ${state.round} — أول ${state.config.winsNeeded} جولات`
}

/** Every player, in order, as a chip. */
const chips = (state: RoomState): readonly ChipView[] =>
  state.players.map(({ id, name, team }) => ({ id, name, team }))

/** A team's members, joined by '، ' — or 'بدون لاعبين' when that is empty, as the prototype's `||`. */
const members = (state: RoomState, team: Team): string =>
  state.players
    .filter((player) => player.team === team)
    .map((player) => player.name)
    .join('، ') || 'بدون لاعبين'

/** The setup screen's values, for the room and the catalog the rail shows. */
export function setupView(state: RoomState, catalog: readonly CatalogEntry[]): SetupView {
  return {
    playerCountLabel: `${state.players.length} لاعبين`,
    teams: {
      a: { label: 'فريق ١', name: state.teamA, members: members(state, 'a') },
      b: { label: 'فريق ٢', name: state.teamB, members: members(state, 'b') },
    },
    chips: chips(state),
    judgeHint: state.players.length % 2 === 1 ? 'العدد فردي — يفضّل التبديل' : 'ثابت طول المباراة',
    judgeOptions: state.players.map(({ id, name }, index) => ({
      id,
      name,
      selected: index === state.judgeIndex,
    })),
    rotateOn: state.rotateJudge,
    rotateLabel: (state.rotateJudge ? '✔ ' : '○ ') + 'بدّل الحكم كل جولة',
    pickedLabel: `${state.pickedCategories.length} من ${catalog.length} مختارة`,
    tiles: catalog.map(({ id, name, emoji, locked }) => {
      const selected = state.pickedCategories.includes(id)
      return {
        id,
        name,
        emoji,
        locked,
        selected,
        tag: locked ? '🔒 مدفوعة' : selected ? 'مختارة' : '',
      }
    }),
    canStart: canOpenRoom(state),
    setupNote: `الحكم يشوف الإجابات · ${state.config.roundSeconds} ثانية لكل فريق · ما تحتاج تسجّل دخول`,
  }
}

/** The room-ready screen's values. */
export function readyView(state: RoomState): ReadyView {
  return {
    roundLabel: roundLabel(state),
    roomCode: state.roomCode,
    judgeName: currentJudge(state)?.name ?? '—',
    chips: chips(state),
  }
}
