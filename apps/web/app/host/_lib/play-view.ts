// REQ-6.1 – REQ-6.5 — specs/phase-6/specs.md §2.1, `play-view.ts`. The bridge between the room and
// the play screen: one pure function from the room and the catalog to every value the screen shows,
// named after the keys of the prototype's `renderVals()` that compute them, as Phase 5's `view.ts` is
// for setup and room-ready (design/README.md: "`renderVals()` is the bridge between them"). The
// engine and the driver are the behaviour; this file is the bridge; `PlayScreen.tsx` takes a view
// and three callbacks and computes nothing of its own.
//
// Each field, and the `renderVals` keys it mirrors:
//
//   timers.a / timers.b   teamAName / teamBName, clockA / clockB, timerABg / timerBBg and
//                         timerAShadow / timerBShadow (`active`), statusA / statusB,
//                         dotsA / dotsB (through `dots(n)`: `i < n`, `winsNeeded` long)
//   activeTeam            activeColor
//   activeName            activeName
//   catEmoji              catEmoji
//   catName               catName
//   bankPct               bankPct — a number in [0, 100]; the screen writes the '%'
//   qNumber               qNumber — `s.qi + 1`, counting past the pool
//   questionText          questionText
//   hintText              hintText — the most recent hint spent, `hints[s.hintIdx - 1]`
//   hintSpent             hintColor / hintAnim
//   hintsLeft             hintBtnBg / hintBtnFg / hintBtnOpacity / hintBtnCursor
//   hintBtnNote           hintBtnNote
//   reveal                revealOn / revealAnswer / revealFact
//   judgeName             judgeName
//   answerText            answerText
//   altText               altText — the prototype's conditional, not `join(…) || …`
//
// The colours `renderVals` computes are not here: they are the screen's CSS, keyed on `active`,
// `activeTeam`, `hintSpent` and `hintsLeft` (specs.md §2.3). Every rule is the engine's: the clock
// is `displaySeconds(remainingMs(…))` (REQ-3.9), the judge is `currentJudge`, the question is
// `currentQuestion`; this file decides nothing a rule decides.
//
// This is a judge view (requirements.md, reading 7): it carries the answer, its variants and the
// fact, which is correct on `/host` (mission.md §3). It is never a player payload and is never
// reused for one — Phase 14 builds the player's card from the payload Phase 12 builds from scratch.
//
// Pure and framework-free: no React import, no clock, no timer, no random source (specs.md §2.1).
// It imports the engine and the catalog's type, nothing else.

import { currentJudge, currentQuestion, displaySeconds, remainingMs } from '@nel3ab/game'
import type { Reveal, RoomState, Team } from '@nel3ab/game'

import type { CatalogEntry } from './catalog'

/** One timer card — the prototype's teamAName, clockA, timerABg / timerAShadow, statusA, dotsA. */
export interface TimerView {
  readonly name: string
  /** Whole seconds, as displayed: rounded up, never below zero (the engine's `displaySeconds`). */
  readonly clock: number
  readonly active: boolean
  /** 'دورهم الآن' | 'مجمّد' | 'بالانتظار'. */
  readonly status: string
  /** `config.winsNeeded` entries; `true` = a round won. */
  readonly dots: readonly boolean[]
}

/** Every value the play screen shows. */
export interface PlayView {
  readonly timers: { readonly a: TimerView; readonly b: TimerView }
  /** activeColor. */
  readonly activeTeam: Team
  readonly activeName: string
  readonly catEmoji: string
  readonly catName: string
  /** The active team's remaining time as a percentage of a full bank, in [0, 100]. */
  readonly bankPct: number
  /** The question index plus one — it keeps counting past the pool (requirements.md, reading 4). */
  readonly qNumber: number
  readonly questionText: string
  /** The most recent hint spent, or the muted placeholder while none is. */
  readonly hintText: string
  /** hintColor / hintAnim: whether a hint of the current question has been spent. */
  readonly hintSpent: boolean
  /** hintBtnBg / hintBtnFg / hintBtnOpacity / hintBtnCursor all turn on this. */
  readonly hintsLeft: number
  readonly hintBtnNote: string
  /** revealOn / revealAnswer / revealFact: the engine's reveal, or `null` while none is up. */
  readonly reveal: Reveal | null
  /** The judge's name, or '—' when the room has no judge. */
  readonly judgeName: string
  readonly answerText: string
  readonly altText: string
}

/** The strip's text until a hint is spent, for a question with hints — the prototype's. */
const HINT_PLACEHOLDER = 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا'
/** The strip's text for a question with no hints — the prototype's. */
const NO_HINTS = 'ما فيه تلميحات لهذا السؤال'

/**
 * Every value the play screen shows, for a room on `play` and the catalog its category comes from.
 * Throws `RangeError` for a room with no current question (an empty pool — never on `play`) or
 * whose category the catalog does not hold (a `null` id included): both unreachable from the
 * driver on `play`.
 */
export function playView(state: RoomState, catalog: readonly CatalogEntry[]): PlayView {
  const question = currentQuestion(state)
  if (question === null) {
    throw new RangeError('playView: the room has no current question (its question pool is empty)')
  }
  const category = catalog.find((entry) => entry.id === state.categoryId)
  if (category === undefined) {
    throw new RangeError(
      `playView: the catalog holds no category with id ${JSON.stringify(state.categoryId)}`,
    )
  }

  const timer = (team: Team): TimerView => {
    const active = state.clock.active === team
    const tally = team === 'a' ? state.tallyA : state.tallyB
    return {
      name: team === 'a' ? state.teamA : state.teamB,
      clock: displaySeconds(remainingMs(state.clock, team)),
      active,
      status: active ? 'دورهم الآن' : state.clock.banks[team].started ? 'مجمّد' : 'بالانتظار',
      dots: Array.from({ length: state.config.winsNeeded }, (_, i) => i < tally),
    }
  }
  const timers = { a: timer('a'), b: timer('b') }
  const activeTeam = state.clock.active
  const hintsLeft = question.h.length - state.hintIndex

  return {
    timers,
    activeTeam,
    activeName: timers[activeTeam].name,
    catEmoji: category.emoji,
    catName: category.name,
    bankPct: Math.max(
      0,
      Math.min(
        100,
        (remainingMs(state.clock, activeTeam) / (state.config.roundSeconds * 1000)) * 100,
      ),
    ),
    qNumber: state.questionIndex + 1,
    questionText: question.q,
    hintText:
      question.h.slice(0, state.hintIndex).at(-1) ??
      (question.h.length > 0 ? HINT_PLACEHOLDER : NO_HINTS),
    hintSpent: state.hintIndex > 0,
    hintsLeft,
    hintBtnNote: hintsLeft > 0 ? `−٢ ثانية · باقي ${hintsLeft}` : 'انتهت التلميحات',
    reveal: state.reveal,
    judgeName: currentJudge(state)?.name ?? '—',
    answerText: question.a,
    altText: question.alts.length > 0 ? question.alts.join('، ') : 'لا توجد بدائل',
  }
}
