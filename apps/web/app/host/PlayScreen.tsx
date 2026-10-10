// REQ-6.6 – REQ-6.12 — the play screen. See specs/phase-6/specs.md §2.2, `PlayScreen.tsx`, and
// design/README.md §4.
//
// The prototype's play markup (design/designs/Nel3ab - Arcade.dc.html, the `isPlay` block)
// reproduced element for element, without the prototype runtime's `<span>` around each `{{ }}`
// value, which Phase 5 measured to be layout-neutral: the two timer cards; the category pill and
// the time-bank bar; the question card — its header strip, its body, its hint strip and, only
// while a reveal is up, the reveal overlay; the judge-only answer box; the three action Buttons.
// The order and the nesting are a contract: verification.md's Procedure M6 finds every role on
// both pages by the same structural path, and `play-markup.test.tsx` asserts the tree.
//
// Presentational: it takes `playView`'s values and three callbacks and computes nothing of its
// own — no hook, no state, no effect, nothing random, nothing timed. Whether a press counts is the
// engine's (`acceptsJudgeActions`), not this screen's: while the reveal is up the three Buttons
// keep their look, and a press reaches the engine, which changes nothing (requirements.md,
// reading 1). تلميح is disabled when no hint is left, through Button's own `disabled`, which also
// sets `aria-disabled`: the design system's disabled state applies and the press does not
// (reading 2). Its `data-tone` is dropped then, so it is `--panel`.
//
// The hint text is ONE element for the life of the screen — it carries no `key` — so its
// `slidein` starts when `data-spent` turns true and is not restarted by the second hint (REQ-6.8,
// DECIDED 2026-10-03). The reveal is rendered only while the view carries one, so every reveal is
// a new element and its `pop` runs each time (REQ-6.9).
//
// Each UI glyph Baloo Bhaijaan 2 lacks — ⏭ 💡 ✔ 👁 — sits alone in a `.glyph` span (REQ-6.12,
// DECIDED 2026-10-03: Phase 5's per-glyph rule; play.module.css). The strip's 💡 is a flex item,
// so its `.glyph` sits inside the plain `span.bulb`. The category's emoji is content, not a UI
// glyph, and is not wrapped. The clocks are digit runs in `.ltr-num` (reading 9).
//
// This is the judge's screen: it shows the answer, its variants and the fact, which is correct on
// `/host` and nowhere else (mission.md §3; requirements.md, reading 7).

import type { Team } from '@nel3ab/game'
import { Button, Dot } from '@nel3ab/ui'

import type { PlayView } from './_lib/play-view'
import styles from './play.module.css'

export interface PlayScreenProps {
  readonly view: PlayView
  /** تخطي. */
  readonly onSkip: () => void
  /** تلميح. */
  readonly onHint: () => void
  /** صحيح. */
  readonly onCorrect: () => void
}

const TEAMS: readonly Team[] = ['a', 'b']

/** Class names joined, an absent one dropped. */
const cx = (...names: (string | undefined)[]): string => names.filter(Boolean).join(' ')

export function PlayScreen({ view, onSkip, onHint, onCorrect }: PlayScreenProps) {
  return (
    <div>
      <div className={styles.timers}>
        {TEAMS.map((team) => {
          const { name, clock, active, status, dots } = view.timers[team]
          return (
            <div key={team} className={styles.timer} data-team={team} data-active={active}>
              <div className={styles.row}>
                <span className={styles.name}>{name}</span>
                <span className={cx(styles.clock, 'ltr-num')}>{clock}</span>
              </div>
              <div className={cx(styles.row, styles['row-2'])}>
                <div className={styles.dots}>
                  {dots.map((won, i) => (
                    <Dot key={i} size="sm" won={won} />
                  ))}
                </div>
                <span className={styles.status}>{status}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles['category-row']}>
        <div className={styles.category}>
          <span>{view.catEmoji}</span>
          <span>{view.catName}</span>
        </div>
        <div className={styles.track}>
          <div
            className={styles.fill}
            data-team={view.activeTeam}
            style={{ width: `${view.bankPct}%` }}
          />
        </div>
      </div>

      <div className={styles.question}>
        <div className={styles['question-head']} data-team={view.activeTeam}>
          <span className={styles.turn}>دور {view.activeName}</span>
          <span className={styles.number}>سؤال {view.qNumber}</span>
        </div>
        <div className={styles['question-body']}>
          <div className={styles['question-text']}>{view.questionText}</div>
        </div>
        <div className={styles['hint-strip']}>
          <span className={styles.bulb}>
            <span className={styles.glyph}>💡</span>
          </span>
          <div className={styles['hint-text']} data-spent={view.hintSpent}>
            {view.hintText}
          </div>
        </div>
        {view.reveal !== null && (
          <div className={styles.reveal}>
            <div className={styles['reveal-label']}>الإجابة</div>
            <div className={styles['reveal-answer']}>{view.reveal.answer}</div>
            <div className={styles['reveal-fact']}>{view.reveal.fact}</div>
          </div>
        )}
      </div>

      <div className={styles['answer-box']}>
        <div className={styles['answer-head']}>
          <span className={styles['judge-only']}>
            للحكم فقط <span className={styles.glyph}>👁</span>
          </span>
          <span className={styles['judge-name']}>{view.judgeName}</span>
        </div>
        <div className={styles.answer}>{view.answerText}</div>
        <div className={styles.alts}>يُقبل أيضاً: {view.altText}</div>
      </div>

      <div className={styles.actions}>
        <Button variant="action" className={styles.action} subLabel="−٣ ثوانٍ" onClick={onSkip}>
          تخطي <span className={styles.glyph}>⏭</span>
        </Button>
        <Button
          variant="action"
          className={styles.action}
          data-tone={view.hintsLeft > 0 ? 'yellow' : undefined}
          disabled={view.hintsLeft === 0}
          subLabel={view.hintBtnNote}
          onClick={onHint}
        >
          تلميح <span className={styles.glyph}>💡</span>
        </Button>
        <Button
          variant="action"
          className={styles.action}
          data-tone="leaf"
          subLabel="يمرّ الدور"
          onClick={onCorrect}
        >
          صحيح <span className={styles.glyph}>✔</span>
        </Button>
      </div>
    </div>
  )
}
