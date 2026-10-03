// REQ-5.16 – REQ-5.19 — the setup screen. See specs/phase-5/specs.md §2.11,
// "SetupScreen.tsx / setup.module.css", and design/README.md §2.
//
// The prototype's setup markup (design/designs/Nel3ab - Arcade.dc.html, the `isSetup` block)
// reproduced top to bottom: the heading and lede; the teams card (two team tiles, each with its
// ↺ shuffle, its editable name and its members, then every player as a chip with ↔ and ✕); the
// judge card (one choice per player and the rotation toggle); the categories rail; the start
// button and the footnote.
//
// Presentational: it takes `setupView`'s values and one callback per action, and computes
// nothing of its own but the target a toggle sends — `!rotateOn`, `!selected` — since the
// engine's `setRotateJudge` and `pickCategory` carry the value rather than toggling
// (specs.md §2.1). A locked tile's handler returns before calling anything, as the prototype's
// `if(!c.locked)` does; a locked tile is not a disabled control (REQ-5.18). The start button is
// disabled by `canStart`, the engine's own `canOpenRoom` (REQ-5.19, reading 1).
//
// Icon-only buttons keep the prototype's `title` and carry the same text as their accessible name
// (requirements.md §4). `host-markup.test.tsx` asserts the attributes the stylesheet keys on;
// `host-prototype.test.ts` reads this screen's words and titles from the prototype (W1, W2).

import type { CategoryId, PlayerId, Team } from '@nel3ab/game'
import { Button, Panel, Pill } from '@nel3ab/ui'

import type { SetupView } from './_lib/view'
import styles from './setup.module.css'

export interface SetupScreenProps {
  readonly view: SetupView
  /** ↺ — another of the team's names. */
  readonly onShuffleTeamName: (team: Team) => void
  /** Every keystroke in a team's name field. */
  readonly onRenameTeam: (team: Team, name: string) => void
  /** ↔ on a chip. */
  readonly onSwapTeam: (playerId: PlayerId) => void
  /** ✕ on a chip. */
  readonly onRemovePlayer: (playerId: PlayerId) => void
  /** A judge choice. */
  readonly onSetJudge: (playerId: PlayerId) => void
  /** The rotation toggle, with the value it switches to. */
  readonly onSetRotateJudge: (rotate: boolean) => void
  /** A free tile, with whether it becomes picked. Never called for a locked tile. */
  readonly onPickCategory: (categoryId: CategoryId, picked: boolean) => void
  /** "ابدأ اللعبة". */
  readonly onOpenRoom: () => void
}

const TEAMS: readonly Team[] = ['a', 'b']

/** Class names joined, an absent one dropped. */
const cx = (...names: (string | undefined)[]): string => names.filter(Boolean).join(' ')

export function SetupScreen({
  view,
  onShuffleTeamName,
  onRenameTeam,
  onSwapTeam,
  onRemovePlayer,
  onSetJudge,
  onSetRotateJudge,
  onPickCategory,
  onOpenRoom,
}: SetupScreenProps) {
  return (
    <div>
      <h1 className={styles.title}>يلا نلعب</h1>
      <p className={styles.lede}>
        فريقان، حكم واحد، وأسئلة معلومات — كل شي جاهز، عدّل اللي تبيه بس.
      </p>

      <Panel className={styles.card}>
        <div className={styles.head}>
          <span className={styles['head-title']}>الفرق</span>
          <span className={styles['head-note']}>{view.playerCountLabel}</span>
        </div>
        <div className={styles.teams}>
          {TEAMS.map((team) => {
            const { label, name, members } = view.teams[team]
            return (
              <div key={team} className={styles.team} data-team={team}>
                <div className={styles['team-head']}>
                  <span className={styles['team-label']}>{label}</span>
                  <button
                    type="button"
                    className={styles.shuffle}
                    title="اسم ثاني"
                    aria-label="اسم ثاني"
                    onClick={() => onShuffleTeamName(team)}
                  >
                    ↺
                  </button>
                </div>
                <input
                  className={styles['team-name']}
                  aria-label={label}
                  value={name}
                  onChange={(event) => onRenameTeam(team, event.target.value)}
                />
                <div className={styles.members}>{members}</div>
              </div>
            )
          })}
        </div>
        <div className={styles.chips}>
          {view.chips.map((chip) => (
            <Pill key={chip.id} tone={chip.team === 'a' ? 'red' : 'sky'} data-team={chip.team}>
              {chip.name}
              <button
                type="button"
                className={styles['chip-button']}
                title="بدّل الفريق"
                aria-label="بدّل الفريق"
                onClick={() => onSwapTeam(chip.id)}
              >
                ↔
              </button>
              <button
                type="button"
                className={styles['chip-button']}
                title="حذف"
                aria-label="حذف"
                onClick={() => onRemovePlayer(chip.id)}
              >
                ✕
              </button>
            </Pill>
          ))}
        </div>
      </Panel>

      <Panel className={styles.card}>
        <div className={cx(styles.head, styles['head-tight'])}>
          <span className={styles['head-title']}>الحكم</span>
          <span className={styles['head-note']}>{view.judgeHint}</span>
        </div>
        <p className={styles['judge-line']}>الحكم يشوف الإجابة الصحيحة — بقية الشاشات لا.</p>
        <div className={styles.choices}>
          {view.judgeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.choice}
              data-selected={option.selected}
              aria-pressed={option.selected}
              onClick={() => onSetJudge(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.rotate}
          data-on={view.rotateOn}
          aria-pressed={view.rotateOn}
          onClick={() => onSetRotateJudge(!view.rotateOn)}
        >
          {view.rotateLabel}
        </button>
      </Panel>

      <Panel className={styles.categories}>
        <div className={styles.head}>
          <span className={styles['head-title']}>الفئات</span>
          <span className={styles['head-note']}>{view.pickedLabel}</span>
        </div>
        <div className={styles.rail}>
          {view.tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={styles.tile}
              data-selected={tile.selected}
              data-locked={tile.locked}
              aria-pressed={tile.selected}
              onClick={() => {
                if (tile.locked) return
                onPickCategory(tile.id, !tile.selected)
              }}
            >
              <span className={styles['tile-emoji']}>{tile.emoji}</span>
              <span className={styles['tile-name']}>{tile.name}</span>
              <span className={styles['tile-tag']}>{tile.tag}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Button className={styles.start} disabled={!view.canStart} onClick={onOpenRoom}>
        <span>ابدأ اللعبة</span>
        <span>▶</span>
      </Button>
      <p className={styles.note}>{view.setupNote}</p>
    </div>
  )
}
