// REQ-5.20, REQ-5.21 — the room-ready screen. See specs/phase-5/specs.md §2.11,
// "ReadyScreen.tsx / ready.module.css", and design/README.md §3.
//
// The prototype's room-ready markup (design/designs/Nel3ab - Arcade.dc.html, the `isReady`
// block) reproduced: the 🎉 bobbing on the global `bob`, "الغرفة جاهزة!", the caption, the room
// code beside the share button, the "في الغرفة" panel with every player as a chip and the judge's
// name, the 19px "ابدأ الجولة الأولى" and the secondary "رجوع للإعداد".
//
// Presentational: it takes `readyView`'s values, the share outcome `HostApp` holds (so the flash
// outlives a trip to setup, as the prototype's does) and three callbacks. The room code is a
// Latin run inside Arabic text: `.ltr-num` gives it Archivo and isolates it (NFR-5.8). It is the
// only value on these two screens that depends on the random source, and it renders on this
// screen only — never on the first paint (REQ-5.10).
//
// The share button presses by the one shared press, `@nel3ab/ui/press.module.css` — the same
// class `Button` carries — rather than a copy of it (REQ-5.23). Its label is the flashed outcome
// or, with none, the prototype's idle `copyLabel` ('مشاركة', `SHARE_LABEL`).

import { Button, Panel } from '@nel3ab/ui'
import press from '@nel3ab/ui/press.module.css'

import { SHARE_LABEL } from './_lib/view'
import type { ReadyView } from './_lib/view'
import styles from './ready.module.css'

export interface ReadyScreenProps {
  readonly view: ReadyView
  /** The share outcome flashing on the button, or `null` when none is. */
  readonly shareLabel: string | null
  /** The share button. */
  readonly onShare: () => void
  /** "ابدأ الجولة الأولى". */
  readonly onStart: () => void
  /** "رجوع للإعداد". */
  readonly onBack: () => void
}

/** Class names joined, an absent one dropped. */
const cx = (...names: (string | undefined)[]): string => names.filter(Boolean).join(' ')

export function ReadyScreen({ view, shareLabel, onShare, onStart, onBack }: ReadyScreenProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.party} aria-hidden="true">
        🎉
      </div>
      <h2 className={styles.title}>الغرفة جاهزة!</h2>
      <div className={styles.caption}>كود الانضمام — شاركه مع اللاعبين</div>
      <div className={styles['code-row']}>
        <div className={cx('ltr-num', styles.code)}>{view.roomCode}</div>
        <button
          type="button"
          className={cx(press.press, styles.share)}
          data-flash={shareLabel !== null}
          onClick={onShare}
        >
          <span className={styles['share-icon']} aria-hidden="true">
            ⤴
          </span>
          {shareLabel ?? SHARE_LABEL}
        </button>
      </div>

      <Panel className={styles.room}>
        <div className={styles.head}>
          <span className={styles['head-title']}>في الغرفة</span>
          <span className={styles['head-note']}>{`الحكم: ${view.judgeName}`}</span>
        </div>
        <div className={styles.chips}>
          {view.chips.map((chip) => (
            <span key={chip.id} className={styles.chip} data-team={chip.team}>
              {chip.name}
            </span>
          ))}
        </div>
      </Panel>

      <Button size="md" className={styles.start} onClick={onStart}>
        <span>ابدأ الجولة الأولى</span>
        <span>▶</span>
      </Button>
      <Button variant="secondary" className={styles.back} onClick={onBack}>
        رجوع للإعداد
      </Button>
    </div>
  )
}
