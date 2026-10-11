import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  currentJudge,
  currentQuestion,
  HINT_COST_MS,
  reduce,
  remainingMs,
  SKIP_COST_MS,
} from '@nel3ab/game'
import type { Action, Question, RoomState, Team } from '@nel3ab/game'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

import { CATALOG } from './_lib/catalog'
import { createLocalRoom, drawRound } from './_lib/driver'
import { playView } from './_lib/play-view'
import type { PlayView } from './_lib/play-view'
import { seedRoom } from './_lib/seed'
import styles from './play.module.css'
import { PlayScreen } from './PlayScreen'

// REQ-6.14 — specs/phase-6/verification.md Gate 3, "The play screen's words, labels, costs and
// timings": extractions Y1–Y4. See specs.md §2.5 (this file's row).
//
// Each extraction is read from design/designs/Nel3ab - Arcade.dc.html when the test runs, its
// match count asserted — so an extraction that finds nothing fails rather than passing vacuously —
// and asserted equal to what it drives: Y1 the play screen's static markup, Y2 the play view's
// fields, Y3 the engine's costs, Y4 play.module.css's declarations. design/ is never edited
// (CLAUDE.md invariant 5, NFR-6.1), so this file goes red only when the app drifts from the
// prototype.
//
// The reader is Phase 5's (host-prototype.test.ts, W1–W9): small regular expressions over the
// prototype's one logic script and its component class, and over its markup's text runs — what
// lies between one tag's `>` and the next `<` — with no HTML or JavaScript parser. The one addition
// is `blockAfter`, which finds the `</sc-if>` that closes a block by counting the `sc-if` tags
// opened inside it: the play block holds the reveal's `sc-if`, so a lazy match would stop at that
// one's close. The screen is rendered in Node with `renderToStaticMarkup`, no DOM. The stylesheet
// is read as text: under Vitest a CSS Module import is a proxy that names any key, so it says
// nothing about what the file declares — it is imported here only for the class the screen gives
// its `.glyph` spans. Paths resolve from import.meta.url, not the working directory: each Vitest
// project sets its own `root`. The prototype's file name has spaces, which `URL` percent-encodes
// and fileURLToPath decodes.

const PROTOTYPE = readFileSync(
  fileURLToPath(new URL('../../../../design/designs/Nel3ab - Arcade.dc.html', import.meta.url)),
  'utf8',
)
const CSS = readFileSync(fileURLToPath(new URL('./play.module.css', import.meta.url)), 'utf8')
/** The stylesheet without its comments, which name `pop`, `slidein` and `animation` in prose. */
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** Every match of a global pattern, in source order. */
const all = (source: string, pattern: RegExp): RegExpExecArray[] => [...source.matchAll(pattern)]

/** A capture group the pattern makes mandatory: its absence means the pattern itself is wrong. */
const group = (match: RegExpExecArray, index: number): string => {
  const captured = match[index]
  if (captured === undefined) {
    throw new Error(`no capture group ${index} in ${JSON.stringify(match[0])}`)
  }
  return captured
}

/** The one match an extraction expects, its count asserted by the caller first. */
const only = (matches: readonly RegExpExecArray[], index: number): string =>
  matches[0] === undefined ? '' : group(matches[0], index)

/** Each extraction's match count, by name. */
const counts = (
  found: Readonly<Record<string, readonly RegExpExecArray[]>>,
): Record<string, number> =>
  Object.fromEntries(Object.entries(found).map(([name, matches]) => [name, matches.length]))

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// --- the prototype's logic script, its component class and its renderVals ------------------------

/** `<script type="text/x-dc" …>…</script>`: the prototype's one logic script. */
const SCRIPTS = all(PROTOTYPE, /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/g)
const script = SCRIPTS[0]?.[1] ?? ''

/** The component class, from its header to the `}` alone on a line that closes it. */
const CLASSES = all(script, /^class Component extends DCLogic \{\n([\s\S]*?)^\}$/gm)
const classBody = CLASSES[0]?.[1] ?? ''

/** The class's `renderVals(){ … }` method, capturing its body. */
const RENDER_VALS_BLOCKS = all(classBody, /^ {2}renderVals\(\)\s*\{\n([\s\S]*?)^ {2}\}$/gm)
const renderValsBody = RENDER_VALS_BLOCKS[0]?.[1] ?? ''

test('the reader finds the one logic script, its component class and its renderVals', () => {
  expect([SCRIPTS.length, CLASSES.length, RENDER_VALS_BLOCKS.length]).toStrictEqual([1, 1, 1])
})

// --- the play block -------------------------------------------------------------------------------

/** `<sc-if value="{{ isPlay }}" …>`: the play screen's opening tag. */
const PLAY_OPENINGS = all(PROTOTYPE, /<sc-if value="\{\{ isPlay \}\}"[^>]*>/g)
/** Every `sc-if` start or end tag. */
const SC_IF_TAG = /<sc-if\b[^>]*>|<\/sc-if>/g
/** The `name` of every `<sc-if value="{{ name }}"` in a block. */
const SC_IF_NAME = /<sc-if value="\{\{ (\w+) \}\}"/g
/** `<sc-for list="{{ name }}" …>` … `</sc-for>`: markup the runtime renders once per item of `name`. */
const SC_FOR = /<sc-for list="\{\{ (\w+) \}\}"[^>]*>([\s\S]*?)<\/sc-for>/g

/**
 * The markup between an opening `sc-if` tag and the `</sc-if>` that closes it — the `sc-if` blocks
 * nested inside it included, each start tag counted and each end tag uncounted until one is left
 * over.
 */
const blockAfter = (source: string, opening: RegExpExecArray | undefined): string => {
  if (opening === undefined) return ''
  const start = opening.index + opening[0].length
  let depth = 0
  for (const tag of source.slice(start).matchAll(SC_IF_TAG)) {
    if (tag[0] !== '</sc-if>') depth += 1
    else if (depth > 0) depth -= 1
    else return source.slice(start, start + tag.index)
  }
  throw new Error(`no </sc-if> closes ${opening[0]}`)
}

const playBlock = blockAfter(PROTOTYPE, PLAY_OPENINGS[0])

/** The reveal, nested in the play block: `<sc-if value="{{ revealOn }}" …>` … its `</sc-if>`. */
const REVEAL_OPENINGS = all(playBlock, /<sc-if value="\{\{ revealOn \}\}"[^>]*>/g)
const revealBlock = blockAfter(playBlock, REVEAL_OPENINGS[0])

/** What lies between one tag's `>` and the next `<`. */
const TEXT_RUN = />([^<]*)</g
/** A `{{ … }}` placeholder, the value the runtime fills in; captured, so `split` keeps it. */
const PLACEHOLDER = /(\{\{[^}]*\}\})/

/** Every text run of `markup`, in order, its whitespace collapsed; empty runs dropped. */
const textRuns = (markup: string): string[] =>
  all(markup, TEXT_RUN)
    .map((m) => group(m, 1).replace(/\s+/g, ' ').trim())
    .filter((run) => run !== '')

/** A literal text node: a run with text of its own, not placeholders alone. */
const isLiteral = (run: string): boolean =>
  run.split(PLACEHOLDER).some((part, index) => index % 2 === 0 && part.trim() !== '')

/** A run's literal text: its placeholders removed. */
const literalOf = (run: string): string =>
  run
    .split(PLACEHOLDER)
    .filter((_, index) => index % 2 === 0)
    .join('')

// --- Table X's rooms (verification.md), reached as play-view.test.ts reaches them ---------------

/** The room after `actions`, each reduced in turn from `from`. */
const after = (from: RoomState, ...actions: readonly Action[]): RoomState =>
  actions.reduce((state, action) => reduce(state, action), from)

/** `n` of the driver's loop steps: a tick of 100 ms, then `passTurn`. */
const steps = (n: number): Action[] =>
  Array.from({ length: n }, (): Action[] => [
    { type: 'tick', ms: 100 },
    { type: 'passTurn' },
  ]).flat()

/** The room with its current question's fields replaced — no index, no `!`. */
const withCurrentQuestion = (state: RoomState, patch: Partial<Question>): RoomState => ({
  ...state,
  questionPool: state.questionPool.map((question, i) =>
    i === state.questionIndex % state.questionPool.length ? { ...question, ...patch } : question,
  ),
})

/** The seed, opened — on `ready` (Phase 5's Table T). */
const READY = after(seedRoom('SKZJ62'), { type: 'openRoom' })
/** S1 — round 1 of أمثال, team A's turn, both clocks 45, question 1, no hint spent. */
const S1 = after(READY, { type: 'startMatch', ...drawRound(READY, CATALOG, () => 0.5) })
/** S2 — after one hint. */
const S2 = after(S1, { type: 'hint' })
/** S3 — after the second hint: hints used up. */
const S3 = after(S2, { type: 'hint' })
/** S4 — after صحيح: the reveal up. */
const S4 = after(S3, { type: 'correct' })
/** S5 — the turn passed on the tenth loop step after صحيح. */
const S5 = after(S4, ...steps(10))

const noop = (): void => undefined

describe("REQ-6.14: the play screen's words, labels, costs and timings, read from the prototype", () => {
  test("Y1 — every literal text run of the play block is PlayScreen's, in order, for S4's view", () => {
    // The block: one, holding one nested sc-if (the reveal) and two sc-for (the dots).
    expect(PLAY_OPENINGS).toHaveLength(1)
    expect(all(playBlock, SC_IF_NAME).map((m) => group(m, 1))).toStrictEqual(['revealOn'])
    expect(all(playBlock, SC_FOR).map((loop) => group(loop, 1))).toStrictEqual(['dotsA', 'dotsB'])
    // No literal run inside a list: each renders once.
    expect(
      all(playBlock, SC_FOR).flatMap((loop) => textRuns(group(loop, 2)).filter(isLiteral)),
    ).toStrictEqual([])

    // The literal runs, as the prototype writes them: three mixed with a placeholder.
    const runs = textRuns(playBlock).filter(isLiteral)
    expect(runs).toStrictEqual([
      'دور {{ activeName }}',
      'سؤال {{ qNumber }}',
      '💡',
      'الإجابة',
      'للحكم فقط 👁',
      'يُقبل أيضاً: {{ altText }}',
      'تخطي ⏭',
      '−٣ ثوانٍ',
      'تلميح 💡',
      'صحيح ✔',
      'يمرّ الدور',
    ])
    // Their literal text — the eleven runs Y1 names.
    expect(runs.map(literalOf)).toStrictEqual([
      'دور ',
      'سؤال ',
      '💡',
      'الإجابة',
      'للحكم فقط 👁',
      'يُقبل أيضاً: ',
      'تخطي ⏭',
      '−٣ ثوانٍ',
      'تلميح 💡',
      'صحيح ✔',
      'يمرّ الدور',
    ])

    // The play screen for S4's view — the reveal up, so "الإجابة" is on it — its `.glyph` span tags
    // removed (the glyph stays in its run, as the prototype writes it), read into text runs.
    // React 19's static markup writes no separator between adjacent text nodes, so "دور " and the
    // team's name are one run, as `دور {{ activeName }}` is: each placeholder is substituted with
    // the view's value, as W3 substitutes `{{ judgeName }}` — never matched by prefix, since
    // "سؤال " also begins every placeholder question's text.
    const v = playView(S4, CATALOG)
    expect(v.reveal).not.toBeNull()
    const markup = renderToStaticMarkup(
      createElement(PlayScreen, { view: v, onSkip: noop, onHint: noop, onCorrect: noop }),
    )
    const GLYPH_SPAN = new RegExp(
      `<span class="${escapeRegExp(styles.glyph ?? '')}">([^<]*)</span>`,
      'g',
    )
    expect(all(markup, GLYPH_SPAN).map((m) => group(m, 1))).toStrictEqual([
      '💡',
      '👁',
      '⏭',
      '💡',
      '✔',
    ])
    const screen = textRuns(markup.replace(GLYPH_SPAN, '$1'))

    /** The view's value for a placeholder of a literal run. */
    const VALUES: Readonly<Record<string, string>> = {
      '{{ activeName }}': v.activeName,
      '{{ qNumber }}': String(v.qNumber),
      '{{ altText }}': v.altText,
    }
    const substituted = runs.map((run) =>
      run
        .split(PLACEHOLDER)
        .map((part, index) => {
          if (index % 2 === 0) return part
          const value = VALUES[part]
          if (value === undefined) throw new Error(`no view value for ${part}`)
          return value
        })
        .join(''),
    )
    expect(substituted).toStrictEqual([
      'دور النمور',
      'سؤال 1',
      '💡',
      'الإجابة',
      'للحكم فقط 👁',
      'يُقبل أيضاً: لا توجد بدائل',
      'تخطي ⏭',
      '−٣ ثوانٍ',
      'تلميح 💡',
      'صحيح ✔',
      'يمرّ الدور',
    ])
    // Each once on the screen …
    expect(substituted.map((run) => screen.filter((r) => r === run).length)).toStrictEqual(
      substituted.map(() => 1),
    )
    // … and, in order, every run of the screen that is not a value of the view: the screen writes
    // no literal text the prototype's play block does not.
    const viewValues = new Set([
      ...(['a', 'b'] as const).flatMap((team) => [
        v.timers[team].name,
        String(v.timers[team].clock),
        v.timers[team].status,
      ]),
      v.catEmoji,
      v.catName,
      v.questionText,
      v.hintText,
      v.reveal?.answer ?? '',
      v.reveal?.fact ?? '',
      v.judgeName,
      v.answerText,
      v.hintBtnNote,
    ])
    expect(screen.filter((run) => !viewValues.has(run))).toStrictEqual(substituted)
  })

  test("Y2 — renderVals' play keys, rebuilt from their parts, are playView's fields over Table V's 17 rooms and Table X's", () => {
    const found = {
      status: all(renderValsBody, STATUS),
      question: all(renderValsBody, QUESTION),
      questionGetter: all(classBody, QUESTION_GETTER),
      hints: all(renderValsBody, HINTS),
      hintsLeft: all(renderValsBody, HINTS_LEFT),
      hintText: all(renderValsBody, HINT_TEXT),
      hintBtnNote: all(renderValsBody, HINT_BTN_NOTE),
      altText: all(renderValsBody, ALT_TEXT),
      qNumber: all(renderValsBody, Q_NUMBER),
      clock: all(renderValsBody, CLOCK),
      act: all(renderValsBody, ACT),
      bankPct: all(renderValsBody, BANK_PCT),
      dots: all(renderValsBody, DOTS),
      dotsOf: all(renderValsBody, DOTS_OF),
      judgeName: all(renderValsBody, JUDGE_NAME),
      judge: all(renderValsBody, JUDGE_GETTER),
      activeName: all(renderValsBody, ACTIVE_NAME),
    }
    expect(counts(found)).toStrictEqual({
      status: 2,
      question: 1,
      questionGetter: 1,
      hints: 1,
      hintsLeft: 1,
      hintText: 1,
      hintBtnNote: 1,
      altText: 1,
      qNumber: 1,
      clock: 2,
      act: 1,
      bankPct: 1,
      dots: 1,
      dotsOf: 2,
      judgeName: 1,
      judge: 1,
      activeName: 1,
    })

    // statusA reads team a and statusB team b, with the same three labels; clockA reads s.a and
    // clockB s.b; dotsA counts tallyA and dotsB tallyB; activeName is team A's name when a is active.
    const [now, frozen, waiting] = [3, 5, 6].map((i) => only(found.status, i))
    expect(found.status.map((m) => [1, 2, 3, 4, 5, 6].map((i) => group(m, i)))).toStrictEqual([
      ['A', 'a', now, 'a', frozen, waiting],
      ['B', 'b', now, 'b', frozen, waiting],
    ])
    expect(found.clock.map((m) => [group(m, 1), group(m, 2)])).toStrictEqual([
      ['A', 'a'],
      ['B', 'b'],
    ])
    expect(found.dotsOf.map((m) => [group(m, 1), group(m, 2)])).toStrictEqual([
      ['A', 'A'],
      ['B', 'B'],
    ])
    expect([1, 2, 3].map((i) => only(found.activeName, i))).toStrictEqual(['a', 'A', 'B'])

    const parts = {
      now: now ?? '',
      frozen: frozen ?? '',
      waiting: waiting ?? '',
      placeholder: only(found.hintText, 1),
      noHints: only(found.hintText, 2),
      notePrefix: only(found.hintBtnNote, 1),
      noneLeft: only(found.hintBtnNote, 2),
      separator: only(found.altText, 1),
      noAlternatives: only(found.altText, 2),
      questionOffset: Number(only(found.qNumber, 1)),
      bankMin: Number(only(found.bankPct, 1)),
      bankMax: Number(only(found.bankPct, 2)),
      percent: Number(only(found.bankPct, 3)),
      bankUnit: only(found.bankPct, 4),
      noJudge: only(found.judgeName, 1),
    }
    // The parts Y2 names, as the prototype writes them (U+2212 minus, U+00B7 middle dot, U+2014 dash).
    expect(parts).toStrictEqual({
      now: 'دورهم الآن',
      frozen: 'مجمّد',
      waiting: 'بالانتظار',
      placeholder: 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا',
      noHints: 'ما فيه تلميحات لهذا السؤال',
      notePrefix: '−٢ ثانية · باقي ',
      noneLeft: 'انتهت التلميحات',
      separator: '، ',
      noAlternatives: 'لا توجد بدائل',
      questionOffset: 1,
      bankMin: 0,
      bankMax: 100,
      percent: 100,
      bankUnit: '%',
      noJudge: '—',
    })

    /** renderVals' play keys, evaluated over the prototype's state for an engine room. */
    const prototypeLabels = (state: RoomState): Labels => {
      const s = prototypeState(state)
      // The component's getters: `this.roundTime` and `this.winsNeeded` read the props the room's
      // config holds; `this.question` is the getter read above, `pool[qi % pool.length]` (every
      // pool here is non-empty, so its `CATS[0].qs[0]` fallback is never taken); `this.judge` is
      // the engine's currentJudge (setup-rules.test.ts, E6 — as W4 uses it).
      const roundTime = state.config.roundSeconds
      const winsNeeded = state.config.winsNeeded
      const q = s.pool[s.qi % s.pool.length]
      if (q === undefined) throw new Error('an empty pool: the prototype would show CATS[0]')
      expect(q).toBe(currentQuestion(state))
      const judge = currentJudge(state)
      const act = s[s.active]
      // `q.h || []`: every engine question has its `h`, empty or not.
      const hints = q.h
      const hintsLeft = hints.length - s.hintIdx
      // `dots(n)`: one `{bg}` per round needed, `yellow` (won) where `i < n` — here, that flag.
      const dots = (n: number): boolean[] => Array.from({ length: winsNeeded }, (_, i) => i < n)
      return {
        statusA: s.active === 'a' ? parts.now : s.a.started ? parts.frozen : parts.waiting,
        statusB: s.active === 'b' ? parts.now : s.b.started ? parts.frozen : parts.waiting,
        hintText:
          s.hintIdx > 0 ? hints[s.hintIdx - 1] : hints.length ? parts.placeholder : parts.noHints,
        hintBtnNote: hintsLeft > 0 ? parts.notePrefix + String(hintsLeft) : parts.noneLeft,
        altText: q.alts.length ? q.alts.join(parts.separator) : parts.noAlternatives,
        qNumber: String(s.qi + parts.questionOffset),
        clockA: String(Math.ceil(s.a.time)),
        clockB: String(Math.ceil(s.b.time)),
        bankPct:
          String(
            fourDecimals(
              Math.max(
                parts.bankMin,
                Math.min(parts.bankMax, (act.time / roundTime) * parts.percent),
              ),
            ),
          ) + parts.bankUnit,
        dotsA: dots(s.tallyA),
        dotsB: dots(s.tallyB),
        judgeName: judge ? judge.name : parts.noJudge,
        activeName: s.active === 'a' ? s.teamA : s.teamB,
      }
    }

    // Table V's 17 rooms, through the page's driver under fake timers, then Table X's and the
    // hand-built rooms Gate 1 pins — every branch of every key taken.
    const rooms: readonly (readonly [string, RoomState])[] = [
      ...tableVRooms(),
      ['X1 (S1)', S1],
      ['X2 (S2)', S2],
      ['X3 (S3)', S3],
      ['X4 (S4)', S4],
      ['X5 (S5)', S5],
      ['X6 tallies 2 / 1', { ...S1, tallyA: 2, tallyB: 1 }],
      ['X6 winsNeeded 4', { ...S1, config: { ...S1.config, winsNeeded: 4 } }],
      [
        'X6 winsNeeded 4, tallies 2 / 1',
        { ...S1, config: { ...S1.config, winsNeeded: 4 }, tallyA: 2, tallyB: 1 },
      ],
      ['X6 winsNeeded 2, tally A 1', { ...S1, config: { ...S1.config, winsNeeded: 2 }, tallyA: 1 }],
      ['X7 no hints', withCurrentQuestion(S1, { h: [] })],
      ['X8 alts أ، ب', withCurrentQuestion(S1, { alts: ['أ', 'ب'] })],
      ["X8 alts ['']", withCurrentQuestion(S1, { alts: [''] })],
      ['X9 questionIndex 3', { ...S1, questionIndex: 3 }],
      ['X10 no players', { ...S1, players: [] }],
      ['X10 judgeIndex 7 of 5', { ...S1, judgeIndex: 7 }],
      ['three hints, none spent', withCurrentQuestion(S1, { h: ['h1', 'h2', 'h3'] })],
      [
        'three hints, one spent',
        after(withCurrentQuestion(S1, { h: ['h1', 'h2', 'h3'] }), { type: 'hint' }),
      ],
      [
        'three hints, two spent',
        after(
          withCurrentQuestion(S1, { h: ['h1', 'h2', 'h3'] }),
          { type: 'hint' },
          { type: 'hint' },
        ),
      ],
      ['A at 50 ms', after(S1, { type: 'tick', ms: 44_950 })],
      [
        'A at 0, running',
        {
          ...S1,
          clock: { ...S1.clock, banks: { ...S1.clock.banks, a: { ms: 0, started: true } } },
        },
      ],
      ['a 45 s bank in a 40 s room', { ...S1, config: { ...S1.config, roundSeconds: 40 } }],
    ]
    expect(rooms).toHaveLength(38)
    expect(rooms.length).toBeGreaterThanOrEqual(30)

    for (const [name, room] of rooms) {
      expect(appLabels(playView(room, CATALOG)), name).toStrictEqual(prototypeLabels(room))
    }

    // Not vacuous: across the rooms, every part and every branch appears in a label.
    const labels = rooms.map(([, room]) => prototypeLabels(room))
    const shown = (key: keyof Labels): Set<unknown> =>
      new Set(labels.map((l) => (Array.isArray(l[key]) ? JSON.stringify(l[key]) : l[key])))
    const statuses = new Set([...shown('statusA'), ...shown('statusB')])
    expect([parts.now, parts.frozen, parts.waiting].filter((p) => statuses.has(p))).toHaveLength(3)
    for (const [key, values] of [
      [
        'hintText',
        [parts.placeholder, parts.noHints, 'تلميح تجريبي ١', 'تلميح تجريبي ٢', 'h1', 'h2'],
      ],
      ['hintBtnNote', [parts.notePrefix + '2', parts.notePrefix + '1', parts.noneLeft]],
      ['altText', [parts.noAlternatives, 'أ' + parts.separator + 'ب', '']],
      ['qNumber', ['1', '2', '3', '4']],
      // 41,300 ms shows 42 (V2: rounded up); 50 ms shows 1; an empty bank 0.
      ['clockA', ['45', '42', '1', '0']],
      // 112.5 clamped to 100 (the 40 s room), and 0.
      ['bankPct', ['100%', '91.7778%', '0%']],
      [
        'dotsA',
        [
          JSON.stringify([false, false, false]),
          JSON.stringify([true, true, false]),
          JSON.stringify([true, true, false, false]),
          JSON.stringify([true, false]),
        ],
      ],
      ['judgeName', [parts.noJudge, 'ماجد', 'نورة']],
      ['activeName', ['النمور', 'الصقور']],
    ] as const) {
      const seen = shown(key)
      expect(
        values.filter((value) => !seen.has(value)),
        key,
      ).toStrictEqual([])
    }
    // The rounding and the clamp, where each is taken.
    const labelsOf = new Map(rooms.map(([name, room]) => [name, prototypeLabels(room)]))
    expect(
      ['V2', 'A at 50 ms', 'A at 0, running', 'a 45 s bank in a 40 s room'].map((name) => [
        labelsOf.get(name)?.clockA,
        labelsOf.get(name)?.bankPct,
      ]),
    ).toStrictEqual([
      ['42', '91.7778%'],
      ['1', '0.1111%'],
      ['0', '0%'],
      ['45', '100%'],
    ])
  })

  test('Y3 — the sub-labels\' costs, "−٣ ثوانٍ" and "−٢ ثانية", are the engine\'s SKIP_COST_MS and HINT_COST_MS', () => {
    const skip = all(playBlock, SKIP_COST_LABEL)
    const hint = all(renderValsBody, HINT_COST_LABEL)
    expect([skip.length, hint.length]).toStrictEqual([1, 1])
    expect([only(skip, 0), only(hint, 0)]).toStrictEqual(['−٣ ثوانٍ', '−٢ ثانية'])
    expect([only(skip, 1), only(hint, 1)]).toStrictEqual(['٣', '٢'])
    // Where each stands: the skip Button's sub-label run, and the head of hintBtnNote's prefix.
    expect(textRuns(playBlock)).toContain(only(skip, 0))
    expect(only(all(renderValsBody, HINT_BTN_NOTE), 1).startsWith(only(hint, 0))).toBe(true)

    // Arabic-Indic digits, read as a number: the seconds each press costs.
    expect(arabicIndic(only(skip, 1))).toBe(SKIP_COST_MS / 1000)
    expect(arabicIndic(only(hint, 1))).toBe(HINT_COST_MS / 1000)
    expect([SKIP_COST_MS / 1000, HINT_COST_MS / 1000]).toStrictEqual([3, 2])
  })

  test("Y4 — pop .18s, slidein .22s and width .1s linear are play.module.css's --pop, --slidein and transition; no animation names a keyframe directly", () => {
    // The prototype: the reveal's own `animation`, inside the reveal's block; `hintAnim`, the hint
    // text's `animation`; the fill's `transition`, on the element whose width is `{{ bankPct }}`.
    expect(REVEAL_OPENINGS).toHaveLength(1)
    const reveal = all(revealBlock, ANIMATION_SHORTHAND)
    const hintAnim = all(renderValsBody, HINT_ANIM)
    const hintText = all(playBlock, HINT_TEXT_ELEMENT)
    const fills = all(playBlock, FILL_STYLE)
    const fill = all(only(fills, 1), TRANSITION_SHORTHAND)
    expect(
      counts({
        reveal,
        hintAnim,
        hintText,
        fills,
        fill,
        // Every `animation:` and `transition:` of the play block: the reveal's, the hint's, the fill's.
        animations: all(playBlock, /\banimation:/g),
        literalAnimations: all(playBlock, ANIMATION_SHORTHAND),
        transitions: all(playBlock, /\btransition:/g),
      }),
    ).toStrictEqual({
      reveal: 1,
      hintAnim: 1,
      hintText: 1,
      fills: 1,
      fill: 1,
      animations: 2,
      literalAnimations: 1,
      transitions: 1,
    })
    expect(only(hintText, 1)).toContain('animation:{{ hintAnim }};')
    const prototype = {
      pop: timing(reveal),
      slidein: timing(hintAnim),
      width: timing(fill),
    }
    expect([reveal, hintAnim, fill].map((m) => [only(m, 1), only(m, 2), only(m, 3)])).toStrictEqual(
      [
        ['pop', '.18', 'ease-out'],
        ['slidein', '.22', 'ease-out'],
        ['width', '.1', 'linear'],
      ],
    )

    // play.module.css, read as text, its comments removed: each timing declared once, in the rule
    // of the element it times, and each keyframe reached through its custom property.
    const rules = all(CSS_CODE, /([^{}]+)\{([^{}]*)\}/g).map((m) => ({
      selector: group(m, 1).trim(),
      declarations: group(m, 2)
        .split(';')
        .map((d) => d.trim().replace(/\s+/g, ' '))
        .filter((d) => d !== ''),
    }))
    const pop = all(CSS_CODE, CUSTOM_POP)
    const slidein = all(CSS_CODE, CUSTOM_SLIDEIN)
    const transition = all(CSS_CODE, TRANSITION_SHORTHAND)
    expect([pop.length, slidein.length, transition.length]).toStrictEqual([1, 1, 1])
    expect({
      pop: timing(pop),
      slidein: timing(slidein),
      width: timing(transition),
    }).toStrictEqual(prototype)
    const ruleOf = (declaration: string): string[] =>
      rules
        .filter((r) => r.declarations.some((d) => d.startsWith(declaration)))
        .map((r) => r.selector)
    expect([ruleOf('--pop:'), ruleOf('--slidein:'), ruleOf('transition:')]).toStrictEqual([
      ['.reveal'],
      [".hint-text[data-spent='true']"],
      ['.fill'],
    ])

    // Every animation declaration is a custom property's value — `var(--pop)` in `.reveal`,
    // `var(--slidein)` in the spent hint's rule — and none names `pop` or `slidein` directly: a CSS
    // Module would rewrite that name to a hashed local one no keyframe defines (specs.md §2.3).
    expect(
      rules.flatMap((r) =>
        r.declarations
          .filter((d) => /^animation(?:-name)?\s*:/.test(d))
          .map((d) => [r.selector, d]),
      ),
    ).toStrictEqual([
      [".hint-text[data-spent='true']", 'animation: var(--slidein)'],
      ['.reveal', 'animation: var(--pop)'],
    ])
    expect(all(CSS_CODE, DIRECT_KEYFRAME)).toHaveLength(0)
  })
})

// --- Y2: renderVals' play keys -------------------------------------------------------------------

/** `statusA: s.active === 'a' ? '…' : (s.a.started ? '…' : '…'),` — and team B's. */
const STATUS =
  /\bstatus([AB])\s*:\s*s\.active\s*===\s*'([ab])'\s*\?\s*'([^']*)'\s*:\s*\(\s*s\.([ab])\.started\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\)\s*,/g
/** `const q = this.question;` */
const QUESTION = /\bconst\s+q\s*=\s*this\.question\s*;/g
/** The class's `get question(){ const p = this.state.pool; return p.length ? p[this.state.qi % p.length] : CATS[0].qs[0]; }` */
const QUESTION_GETTER =
  /^ {2}get question\(\)\s*\{\s*const\s+p\s*=\s*this\.state\.pool\s*;\s*return\s+p\.length\s*\?\s*p\[\s*this\.state\.qi\s*%\s*p\.length\s*\]\s*:\s*CATS\[0\]\.qs\[0\]\s*;\s*\}$/gm
/** `const hints = q.h || [];` */
const HINTS = /\bconst\s+hints\s*=\s*q\.h\s*\|\|\s*\[\]\s*;/g
/** `const hintsLeft = hints.length - s.hintIdx;` */
const HINTS_LEFT = /\bconst\s+hintsLeft\s*=\s*hints\.length\s*-\s*s\.hintIdx\s*;/g
/** `hintText: s.hintIdx > 0 ? hints[s.hintIdx - 1] : (hints.length ? '…' : '…'),` — the last hint spent. */
const HINT_TEXT =
  /\bhintText\s*:\s*s\.hintIdx\s*>\s*0\s*\?\s*hints\[\s*s\.hintIdx\s*-\s*1\s*\]\s*:\s*\(\s*hints\.length\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\)\s*,/g
/** `hintBtnNote: hintsLeft > 0 ? '…' + hintsLeft : '…',` — the prefix, then the exhausted label. */
const HINT_BTN_NOTE =
  /\bhintBtnNote\s*:\s*hintsLeft\s*>\s*0\s*\?\s*'([^']*)'\s*\+\s*hintsLeft\s*:\s*'([^']*)'\s*,/g
/** `altText: (q.alts && q.alts.length ? q.alts.join('…') : '…'),` — the separator, the empty label. */
const ALT_TEXT =
  /\baltText\s*:\s*\(\s*q\.alts\s*&&\s*q\.alts\.length\s*\?\s*q\.alts\.join\('([^']*)'\)\s*:\s*'([^']*)'\s*\)\s*,/g
/** `qNumber: String(s.qi + N),` */
const Q_NUMBER = /\bqNumber\s*:\s*String\(\s*s\.qi\s*\+\s*(\d+)\s*\)\s*,/g
/** `clockA: String(Math.ceil(s.a.time)),` — and team B's: rounded up. */
const CLOCK = /\bclock([AB])\s*:\s*String\(\s*Math\.ceil\(\s*s\.([ab])\.time\s*\)\s*\)\s*,/g
/** `const act = s[s.active];` — the active team's bank. */
const ACT = /\bconst\s+act\s*=\s*s\[\s*s\.active\s*\]\s*;/g
/** `bankPct: Math.max(LO, Math.min(HI, (act.time / this.roundTime) * K)) + '…',` */
const BANK_PCT =
  /\bbankPct\s*:\s*Math\.max\(\s*(\d+)\s*,\s*Math\.min\(\s*(\d+)\s*,\s*\(\s*act\.time\s*\/\s*this\.roundTime\s*\)\s*\*\s*(\d+)\s*\)\s*\)\s*\+\s*'([^']*)'\s*,/g
/** `const dots = (n) => Array.from({length: this.winsNeeded}, (_, i) => ({bg: i < n ? yellow : …` */
const DOTS =
  /\bconst\s+dots\s*=\s*\(n\)\s*=>\s*Array\.from\(\s*\{\s*length\s*:\s*this\.winsNeeded\s*\}\s*,\s*\(_,\s*i\)\s*=>\s*\(\{\s*bg\s*:\s*i\s*<\s*n\s*\?\s*yellow\s*:/g
/** `dotsA: dots(s.tallyA),` — and team B's. */
const DOTS_OF = /\bdots([AB])\s*:\s*dots\(\s*s\.tally([AB])\s*\)\s*,/g
/** `judgeName: judge ? judge.name : '…',` — with `const judge = this.judge;`, the getter. */
const JUDGE_NAME = /\bjudgeName\s*:\s*judge\s*\?\s*judge\.name\s*:\s*'([^']*)'\s*,/g
const JUDGE_GETTER = /\bconst\s+judge\s*=\s*this\.judge\s*;/g
/** `activeName: s.active === 'a' ? s.teamA : s.teamB,` */
const ACTIVE_NAME =
  /\bactiveName\s*:\s*s\.active\s*===\s*'([ab])'\s*\?\s*s\.team([AB])\s*:\s*s\.team([AB])\s*,/g

/** The keys Y2 compares, as the screen shows them. */
interface Labels {
  readonly statusA: string
  readonly statusB: string
  readonly hintText: string | undefined
  readonly hintBtnNote: string
  readonly altText: string
  readonly qNumber: string
  readonly clockA: string
  readonly clockB: string
  /** To four decimals, as Tables V and X give the bar — see `prototypeState`. */
  readonly bankPct: string
  readonly dotsA: readonly boolean[]
  readonly dotsB: readonly boolean[]
  readonly judgeName: string
  readonly activeName: string
}

/** Tables V and X give the bar to four decimals. */
const fourDecimals = (n: number): number => Math.round(n * 10_000) / 10_000

/**
 * The same keys from playView's fields, as PlayScreen renders them: React writes a number as its
 * `String`, and the fill's width is `${bankPct}%` (specs.md §2.2).
 */
const appLabels = (v: PlayView): Labels => ({
  statusA: v.timers.a.status,
  statusB: v.timers.b.status,
  hintText: v.hintText,
  hintBtnNote: v.hintBtnNote,
  altText: v.altText,
  qNumber: String(v.qNumber),
  clockA: String(v.timers.a.clock),
  clockB: String(v.timers.b.clock),
  bankPct: `${fourDecimals(v.bankPct)}%`,
  dotsA: v.timers.a.dots,
  dotsB: v.timers.b.dots,
  judgeName: v.judgeName,
  activeName: v.activeName,
})

/** One team's bank as the prototype keeps it: `{time, started}`, `time` in SECONDS. */
interface PrototypeBank {
  readonly time: number
  readonly started: boolean
}

/** The fields of the prototype's `this.state` that its play keys read. */
interface PrototypeState {
  readonly teamA: string
  readonly teamB: string
  readonly active: Team
  readonly a: PrototypeBank
  readonly b: PrototypeBank
  readonly pool: readonly Question[]
  readonly qi: number
  readonly hintIdx: number
  readonly tallyA: number
  readonly tallyB: number
}

/**
 * The prototype's state for an engine room, mapped field by field, because the two shapes differ:
 *
 * - `s.a` / `s.b` are each team's bank, `{time, started}`, with `time` in SECONDS — a float the
 *   prototype lowers by 0.1 a tick. The engine keeps integer MILLISECONDS in `clock.banks`, and the
 *   running team's remainder is `remainingMs(clock, team)`; so `time` = remainingMs / 1000 and
 *   `started` = `clock.banks[team].started`.
 * - `s.active` is `clock.active`; `s.pool` is `questionPool`; `s.qi` is `questionIndex`;
 *   `s.hintIdx` is `hintIndex`; `s.teamA` / `s.teamB` and `s.tallyA` / `s.tallyB` are the room's own.
 *
 * Because `time` is a quotient, the prototype's bar, `(time / roundTime) * 100`, and the view's,
 * `(ms / (roundSeconds * 1000)) * 100`, are one ratio computed in two orders, and for some banks
 * they differ in the last bit (41,300 ms: 91.77777777777777 and 91.77777777777779). The bar is
 * therefore compared at the precision Tables V and X pre-register for it, four decimals; every
 * other key is compared exactly.
 */
const prototypeState = (state: RoomState): PrototypeState => {
  const bank = (team: Team): PrototypeBank => ({
    time: remainingMs(state.clock, team) / 1000,
    started: state.clock.banks[team].started,
  })
  return {
    teamA: state.teamA,
    teamB: state.teamB,
    active: state.clock.active,
    a: bank('a'),
    b: bank('b'),
    pool: state.questionPool,
    qi: state.questionIndex,
    hintIdx: state.hintIndex,
    tallyA: state.tallyA,
    tallyB: state.tallyB,
  }
}

/** Table V's script (verification.md): the match's start, n loop steps, or one of the three presses. */
type Act = 'start' | 'hint' | 'skip' | 'correct' | { readonly steps: number }
const TABLE_V_SCRIPT: readonly (readonly [string, Act])[] = [
  ['V1', 'start'],
  ['V2', { steps: 37 }],
  ['V3', 'hint'],
  ['V4', { steps: 5 }],
  ['V5', 'hint'],
  ['V6', 'hint'],
  ['V7', 'skip'],
  ['V8', { steps: 8 }],
  ['V9', 'correct'],
  ['V10', 'skip'],
  ['V11', { steps: 9 }],
  ['V12', { steps: 1 }],
  ['V13', { steps: 1 }],
  ['V14', 'correct'],
  ['V15', { steps: 10 }],
  ['V16', { steps: 329 }],
  ['V17', { steps: 1 }],
]

/**
 * Table V's 17 rooms, as play-round.test.ts reaches them: the page's room — `createLocalRoom` with
 * the random source `() => 0.5`, on the seed, opened — its loop run under Vitest's fake timers
 * through the driver's default timers, one step `vi.advanceTimersByTime(100)`, each press the
 * driver's `dispatch`. V1–V16 are on `play`; V17 is the round's end, on `roundEnd`, where the
 * room keeps its question pool and category, so the view and `renderVals` — which the prototype
 * evaluates on every render, whatever the screen — both still read it.
 */
const tableVRooms = (): (readonly [string, RoomState])[] => {
  vi.useFakeTimers()
  try {
    const room = createLocalRoom({ random: () => 0.5, initial: READY })
    const rooms = TABLE_V_SCRIPT.map(([at, act]): readonly [string, RoomState] => {
      if (act === 'start') room.startMatch()
      else if (typeof act === 'object') vi.advanceTimersByTime(100 * act.steps)
      else room.dispatch({ type: act })
      return [at, room.getState()]
    })
    expect(rooms.map(([, state]) => state.screen)).toStrictEqual([
      ...Array.from({ length: 16 }, () => 'play'),
      'roundEnd',
    ])
    room.dispose()
    return rooms
  } finally {
    vi.useRealTimers()
  }
}

// --- Y3: the costs -------------------------------------------------------------------------------

/** The skip Button's sub-label in the markup: `−N ثوانٍ`, U+2212 then Arabic-Indic digits. */
const SKIP_COST_LABEL = /−([٠-٩]+) ثوانٍ/g
/** The head of hintBtnNote's prefix in renderVals: `−N ثانية`. */
const HINT_COST_LABEL = /−([٠-٩]+) ثانية/g

/** Arabic-Indic digits (U+0660–U+0669), read as a number. */
const arabicIndic = (digits: string): number =>
  [...digits].reduce((n, digit) => n * 10 + ((digit.codePointAt(0) ?? NaN) - 0x0660), 0)

// --- Y4: the timings -----------------------------------------------------------------------------

/** `animation:NAME DURATIONs EASING;` written with a keyframe — the reveal's `pop`. */
const ANIMATION_SHORTHAND = /\banimation:\s*([a-z][a-z-]*)\s+(\d*\.?\d+)s\s+([a-z-]+)\s*;/g
/** `hintAnim: s.hintIdx > 0 ? 'NAME DURATIONs EASING' : 'none',` */
const HINT_ANIM =
  /\bhintAnim\s*:\s*s\.hintIdx\s*>\s*0\s*\?\s*'([a-z][a-z-]*)\s+(\d*\.?\d+)s\s+([a-z-]+)'\s*:\s*'none'\s*,/g
/** The element holding `{{ hintText }}`, capturing its style. */
const HINT_TEXT_ELEMENT = /<div style="([^"]*)">\{\{ hintText \}\}<\/div>/g
/** The fill: the style attribute that sets `width:{{ bankPct }}`. */
const FILL_STYLE = /style="([^"]*width:\{\{ bankPct \}\}[^"]*)"/g
/** `transition: PROPERTY DURATIONs EASING;` */
const TRANSITION_SHORTHAND = /\btransition:\s*([a-z][a-z-]*)\s+(\d*\.?\d+)s\s+([a-z-]+)\s*;/g
/** `--pop: NAME DURATIONs EASING;` and `--slidein: …;` */
const CUSTOM_POP = /--pop:\s*([a-z][a-z-]*)\s+(\d*\.?\d+)s\s+([a-z-]+)\s*;/g
const CUSTOM_SLIDEIN = /--slidein:\s*([a-z][a-z-]*)\s+(\d*\.?\d+)s\s+([a-z-]+)\s*;/g
/** An `animation` or `animation-name` declaration whose value names `pop` or `slidein` itself. */
const DIRECT_KEYFRAME = /(?<![\w-])animation(?:-name)?\s*:(?!\s*var\()[^;]*\b(?:pop|slidein)\b/g

/** A shorthand's name, duration (as a number of seconds — '.18' and '0.18' alike) and easing. */
const timing = (
  matches: readonly RegExpExecArray[],
): { readonly name: string; readonly seconds: number; readonly easing: string } => ({
  name: only(matches, 1),
  seconds: Number(only(matches, 2)),
  easing: only(matches, 3),
})
