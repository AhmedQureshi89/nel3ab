import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { reduce } from '@nel3ab/game'
import type { Action, Question, RoomState, Team } from '@nel3ab/game'
import { Button, Dot } from '@nel3ab/ui'
import { isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { CATALOG } from './_lib/catalog'
import { drawRound } from './_lib/driver'
import { playView } from './_lib/play-view'
import type { PlayView } from './_lib/play-view'
import { seedRoom } from './_lib/seed'
import styles from './play.module.css'
import { PlayScreen } from './PlayScreen'
import type { PlayScreenProps } from './PlayScreen'

// REQ-6.6 – REQ-6.12, REQ-6.11 / REQ-6.13, NFR-6.6 — specs/phase-6/verification.md Gate 2, "The
// markup", "The glyphs", "The buttons call what they say" and "RTL". See specs.md §2.2 (the tree),
// §2.3 (the stylesheet) and §2.5 (this file's row).
//
// The screen is rendered in Node with `renderToStaticMarkup`, as Phase 5's host-markup.test.tsx
// renders its screens — no DOM and no new dependency (requirements.md §4) — for the views of Table
// X1–X5. Their rooms are reached as play-view.test.ts reaches them: the seed, opened, `startMatch`
// with `drawRound(…, CATALOG, () => 0.5)` — أمثال, its questions ١، ٣، ٢ — then the judge's
// actions and the driver's loop steps. The markup is read into a tree and the tree compared whole
// with the one specs.md §2.2 draws: every element, its order and nesting, the play.module.css
// classes it carries (each checked to be one the stylesheet defines — under Vitest a CSS Module is
// a proxy that names any key), every attribute and every text. Verification's Procedure M6 finds
// the roles on both pages by that same structural path, so the tree is a contract. The cells the
// box names — which card is active, the bar's width, the hint's state, the hint Button's tone and
// disabled state, the reveal — are asserted again per state from literal tables, not from the view.
//
// Nothing here clicks (specs.md §4, R2). That the three Buttons call what they say is read from the
// React element tree `PlayScreen(props)` returns — the function called directly, its elements
// walked — not from a rendered DOM.
//
// The screen and its view read no clock, no timer and no random source: their sources are searched
// for six names, whole words, as verification.md §7's `grep -nwE` searches them. This file names
// them; it is a test file, which no source scan reads.

// --- Table X's rooms and views ----------------------------------------------------------------

/** The room after `actions`, each reduced in turn from `from`. */
const after = (from: RoomState, ...actions: readonly Action[]): RoomState =>
  actions.reduce((state, action) => reduce(state, action), from)

/** `n` of the driver's loop steps: a tick of 100 ms, then `passTurn`. */
const steps = (n: number): Action[] =>
  Array.from({ length: n }, (): Action[] => [
    { type: 'tick', ms: 100 },
    { type: 'passTurn' },
  ]).flat()

const READY = after(seedRoom('SKZJ62'), { type: 'openRoom' })
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

const view = (state: RoomState): PlayView => playView(state, CATALOG)

/** Table X1–X5's views, in state order. */
const VIEWS: readonly (readonly [string, PlayView])[] = [
  ['S1', view(S1)],
  ['S2', view(S2)],
  ['S3', view(S3)],
  ['S4', view(S4)],
  ['S5', view(S5)],
]

/** The room with its current question's fields replaced — no index, no `!`. */
const withCurrentQuestion = (state: RoomState, patch: Partial<Question>): RoomState => ({
  ...state,
  questionPool: state.questionPool.map((question, i) =>
    i === state.questionIndex % state.questionPool.length ? { ...question, ...patch } : question,
  ),
})

/** Table X6 — S1 with tallies 2 / 1: won dots. */
const X6 = view({ ...S1, tallyA: 2, tallyB: 1 })
/** Table X7 — S1 with a question that has no hints: تلميح disabled before any is spent. */
const X7 = view(withCurrentQuestion(S1, { h: [] }))

const noop = (): void => undefined

const markupOf = (v: PlayView): string =>
  renderToStaticMarkup(<PlayScreen view={v} onSkip={noop} onHint={noop} onCorrect={noop} />)

const FACT = 'معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨'

// --- the stylesheet's classes ----------------------------------------------------------------

// Paths resolve from import.meta.url: each Vitest project sets its own `root`.
const CSS = readFileSync(fileURLToPath(new URL('./play.module.css', import.meta.url)), 'utf8')
/** The stylesheet without its comments. */
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
/** Every class play.module.css defines, in first-use order. */
const CSS_CLASSES: readonly string[] = [
  ...new Set([...CSS_CODE.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1] ?? '')),
]

/** The class a CSS Module name is served as. A miss is a defect of this file, not of the screen. */
const served = (name: string): string => {
  const value = styles[name]
  if (value === undefined) throw new Error(`play.module.css: no class value for .${name}`)
  return value
}

/** The served class → its name in play.module.css. */
const CLASS_NAME: ReadonlyMap<string, string> = new Map(
  CSS_CLASSES.map((name) => [served(name), name]),
)

/** Names of play.module.css classes, each checked to be one the stylesheet defines. */
const own = (...names: string[]): string[] => {
  for (const name of names) {
    if (!CSS_CLASSES.includes(name)) throw new Error(`play.module.css defines no .${name}`)
  }
  return names
}

// --- reading markup --------------------------------------------------------------------------

type Attributes = Readonly<Record<string, string>>

interface Element {
  readonly tag: string
  readonly attributes: Attributes
  readonly children: readonly Node[]
}
type Node = Element | string

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
}
const decode = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ENTITIES[entity] ?? entity)

/** A start tag's attributes, by name; a valueless attribute maps to ''. */
const attributesOf = (source: string): Attributes =>
  Object.fromEntries(
    [...source.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)].map((m) => [m[1] ?? '', decode(m[2] ?? '')]),
  )

/** An end tag, a start tag (its attributes, a self-closing slash) or a text run. */
const TOKEN = /<\/([a-z][a-z0-9]*)>|<([a-z][a-z0-9]*)(\s[^>]*?)?(\/?)>|([^<]+)/g
const VOID = new Set(['br'])

/**
 * React's static markup read into a tree. React 19's `renderToStaticMarkup` writes no separator
 * between adjacent text nodes — "دور " and the team's name are one run, as the element's DOM text
 * reads — and anything this reader does not know (a comment included) stops it with an error.
 */
const parse = (markup: string): readonly Node[] => {
  interface Open {
    readonly tag: string
    readonly attributes: Attributes
    readonly children: Node[]
  }
  const top: Node[] = []
  const stack: Open[] = []
  const append = (node: Node): void => {
    ;(stack.at(-1)?.children ?? top).push(node)
  }
  let read = 0
  for (const m of markup.matchAll(TOKEN)) {
    if (m.index !== read) throw new Error(`unreadable markup at ${read}`)
    read = m.index + m[0].length
    const [, close, open, attributes, selfClosing, text] = m
    if (text !== undefined) {
      append(decode(text))
    } else if (open !== undefined) {
      const element: Open = { tag: open, attributes: attributesOf(attributes ?? ''), children: [] }
      if (selfClosing === '/' || VOID.has(open)) append(element)
      else stack.push(element)
    } else if (close !== undefined) {
      const element = stack.pop()
      if (element?.tag !== close) throw new Error(`</${close}> closes <${element?.tag ?? ''}>`)
      append(element)
    }
  }
  if (read !== markup.length || stack.length > 0) throw new Error('unbalanced markup')
  return top
}

/** An element as compared: its classes by their play.module.css names, every other attribute. */
interface Shape {
  readonly tag: string
  readonly classes: readonly string[]
  readonly attributes: Attributes
  readonly children: readonly (Shape | string)[]
}

const shapeOf = (node: Node): Shape | string =>
  typeof node === 'string'
    ? node
    : {
        tag: node.tag,
        classes: (node.attributes.class ?? '')
          .split(' ')
          .filter((name) => name !== '')
          .map((name) => CLASS_NAME.get(name) ?? name),
        attributes: Object.fromEntries(
          Object.entries(node.attributes).filter(([name]) => name !== 'class'),
        ),
        children: node.children.map(shapeOf),
      }

/** The single element a markup string holds. */
const rootOf = (markup: string): Element => {
  const nodes = parse(markup)
  const [root] = nodes
  if (nodes.length !== 1 || root === undefined || typeof root === 'string') {
    throw new Error('expected one root element')
  }
  return root
}

/** Every element under `element`, itself included, in document order. */
const descendants = (element: Element): Element[] => [
  element,
  ...element.children.flatMap((child) => (typeof child === 'string' ? [] : descendants(child))),
]

/** The elements carrying play.module.css's class `name`. */
const withClass = (element: Element, name: string): Element[] =>
  descendants(element).filter((e) => (e.attributes.class ?? '').split(' ').includes(served(name)))

/** The one element carrying play.module.css's class `name`. */
const theOne = (element: Element, name: string): Element => {
  const found = withClass(element, name)
  const [first] = found
  if (found.length !== 1 || first === undefined) throw new Error(`${found.length} × .${name}`)
  return first
}

/** The element children of `element`. */
const elementChildren = (element: Element): Element[] =>
  element.children.filter((child): child is Element => typeof child !== 'string')

// --- what the primitives render, read from the primitives themselves ---------------------------

/** An action Button's own classes and its sub-label's, as Button renders them (Phase 2). */
const BUTTON = (() => {
  const button = rootOf(
    renderToStaticMarkup(
      <Button variant="action" subLabel="s">
        x
      </Button>,
    ),
  )
  const subLabel = elementChildren(button).at(-1)
  const shape = shapeOf(button)
  const subShape = subLabel === undefined ? undefined : shapeOf(subLabel)
  if (typeof shape === 'string' || subShape === undefined || typeof subShape === 'string') {
    throw new Error('the action Button renders no sub-label')
  }
  return { classes: shape.classes, subLabel: subShape.classes }
})()

/** A 9px Dot's own classes (Phase 2). */
const DOT_CLASSES = (() => {
  const shape = shapeOf(rootOf(renderToStaticMarkup(<Dot size="sm" />)))
  if (typeof shape === 'string') throw new Error('Dot renders no element')
  return shape.classes
})()

// --- specs.md §2.2's tree, for a view ------------------------------------------------------------

const h = (
  tag: string,
  classes: readonly string[],
  attributes: Attributes,
  ...children: (Shape | string)[]
): Shape => ({ tag, classes, attributes, children })

const TEAMS: readonly Team[] = ['a', 'b']

/** An action Button: its label, a `<br>`, then its sub-label — last (Procedure M6). */
const actionButton = (
  attributes: Attributes,
  label: string,
  glyph: string,
  subLabel: string,
): Shape =>
  h(
    'button',
    [...BUTTON.classes, ...own('action')],
    { type: 'button', 'data-variant': 'action', 'data-size': 'lg', ...attributes },
    label,
    h('span', own('glyph'), {}, glyph),
    h('br', [], {}),
    h('span', BUTTON.subLabel, {}, subLabel),
  )

/** The tree specs.md §2.2 draws, with the view's values in it. */
const expectedTree = (v: PlayView): Shape =>
  h(
    'div',
    [],
    {},
    h(
      'div',
      own('timers'),
      {},
      ...TEAMS.map((team) => {
        const timer = v.timers[team]
        return h(
          'div',
          own('timer'),
          { 'data-team': team, 'data-active': String(timer.active) },
          h(
            'div',
            own('row'),
            {},
            h('span', own('name'), {}, timer.name),
            h('span', [...own('clock'), 'ltr-num'], {}, String(timer.clock)),
          ),
          h(
            'div',
            own('row', 'row-2'),
            {},
            h(
              'div',
              own('dots'),
              {},
              ...timer.dots.map((won) =>
                h('span', DOT_CLASSES, {
                  'aria-hidden': 'true',
                  'data-size': 'sm',
                  'data-won': String(won),
                }),
              ),
            ),
            h('span', own('status'), {}, timer.status),
          ),
        )
      }),
    ),
    h(
      'div',
      own('category-row'),
      {},
      h('div', own('category'), {}, h('span', [], {}, v.catEmoji), h('span', [], {}, v.catName)),
      h(
        'div',
        own('track'),
        {},
        h('div', own('fill'), { 'data-team': v.activeTeam, style: `width:${v.bankPct}%` }),
      ),
    ),
    h(
      'div',
      own('question'),
      {},
      h(
        'div',
        own('question-head'),
        { 'data-team': v.activeTeam },
        h('span', own('turn'), {}, `دور ${v.activeName}`),
        h('span', own('number'), {}, `سؤال ${v.qNumber}`),
      ),
      h('div', own('question-body'), {}, h('div', own('question-text'), {}, v.questionText)),
      h(
        'div',
        own('hint-strip'),
        {},
        h('span', own('bulb'), {}, h('span', own('glyph'), {}, '💡')),
        h('div', own('hint-text'), { 'data-spent': String(v.hintSpent) }, v.hintText),
      ),
      ...(v.reveal === null
        ? []
        : [
            h(
              'div',
              own('reveal'),
              {},
              h('div', own('reveal-label'), {}, 'الإجابة'),
              h('div', own('reveal-answer'), {}, v.reveal.answer),
              h('div', own('reveal-fact'), {}, v.reveal.fact),
            ),
          ]),
    ),
    h(
      'div',
      own('answer-box'),
      {},
      h(
        'div',
        own('answer-head'),
        {},
        h('span', own('judge-only'), {}, 'للحكم فقط ', h('span', own('glyph'), {}, '👁')),
        h('span', own('judge-name'), {}, v.judgeName),
      ),
      h('div', own('answer'), {}, v.answerText),
      h('div', own('alts'), {}, `يُقبل أيضاً: ${v.altText}`),
    ),
    h(
      'div',
      own('actions'),
      {},
      actionButton({}, 'تخطي ', '⏭', '−٣ ثوانٍ'),
      actionButton(
        v.hintsLeft > 0 ? { 'data-tone': 'yellow' } : { disabled: '', 'aria-disabled': 'true' },
        'تلميح ',
        '💡',
        v.hintBtnNote,
      ),
      actionButton({ 'data-tone': 'leaf' }, 'صحيح ', '✔', 'يمرّ الدور'),
    ),
  )

// --- the texts -----------------------------------------------------------------------------------

/** Y1 — the prototype's literal text runs of its play block, in order (verification.md Gate 3). */
const Y1 = [
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
] as const

/**
 * The markup's text runs in document order, after removing the `.glyph` span tags (as Y1 is
 * compared): every text between two tags, exactly as written.
 */
const runsOf = (markup: string): string[] =>
  markup
    .replace(new RegExp(`<span class="${served('glyph')}">([^<]*)</span>`, 'g'), '$1')
    .split(/<[^>]*>/)
    .filter((run) => run !== '')

/** A piece of a run: one of Y1's literals, or a value of the view. */
type Part = { readonly literal: string } | { readonly value: string }
const literal = (text: string): Part => ({ literal: text })
const value = (v: string | number): Part => ({ value: String(v) })

/**
 * The screen's runs as the prototype's play block writes them: each run its literal and value
 * parts, in order. "دور ", "سؤال " and "يُقبل أيضاً: " each begin the run their value ends, as
 * `دور {{ activeName }}` does in the prototype.
 */
const runParts = (v: PlayView): (readonly Part[])[] => [
  ...TEAMS.flatMap((team) => [
    [value(v.timers[team].name)],
    [value(v.timers[team].clock)],
    [value(v.timers[team].status)],
  ]),
  [value(v.catEmoji)],
  [value(v.catName)],
  [literal('دور '), value(v.activeName)],
  [literal('سؤال '), value(v.qNumber)],
  [value(v.questionText)],
  [literal('💡')],
  [value(v.hintText)],
  ...(v.reveal === null
    ? []
    : [[literal('الإجابة')], [value(v.reveal.answer)], [value(v.reveal.fact)]]),
  [literal('للحكم فقط 👁')],
  [value(v.judgeName)],
  [value(v.answerText)],
  [literal('يُقبل أيضاً: '), value(v.altText)],
  [literal('تخطي ⏭')],
  [literal('−٣ ثوانٍ')],
  [literal('تلميح 💡')],
  [value(v.hintBtnNote)],
  [literal('صحيح ✔')],
  [literal('يمرّ الدور')],
]

const joined = (parts: readonly Part[]): string =>
  parts.map((part) => ('literal' in part ? part.literal : part.value)).join('')

/** The play screen's markup and tree for each of Table X1–X5's views. */
const RENDERED = VIEWS.map(([name, v]) => {
  const markup = markupOf(v)
  return { name, v, markup, root: rootOf(markup) }
})

/** One value per state, S1–S5. */
const perState = <T,>(read: (root: Element, markup: string) => T): T[] =>
  RENDERED.map(({ root, markup }) => read(root, markup))

describe('REQ-6.6 – REQ-6.11: the markup, for Table X1–X5', () => {
  test("the views are Table X's: clocks, hints left, the reveal, the turn", () => {
    expect(
      VIEWS.map(([, v]) => [v.timers.a.clock, v.timers.b.clock, v.hintsLeft, v.activeTeam]),
    ).toStrictEqual([
      [45, 45, 2, 'a'],
      [43, 45, 1, 'a'],
      [41, 45, 0, 'a'],
      [41, 45, 0, 'a'],
      [41, 45, 2, 'b'],
    ])
    expect(VIEWS.map(([, v]) => v.reveal)).toStrictEqual([
      null,
      null,
      null,
      { answer: 'إجابة تجريبية ١', fact: FACT },
      null,
    ])
  })

  test("specs.md §2.2's tree, whole: every element, class, attribute and text, on S1–S5, X6 and X7", () => {
    for (const { name, v, root } of RENDERED) {
      expect(shapeOf(root), name).toStrictEqual(expectedTree(v))
    }
    expect(shapeOf(rootOf(markupOf(X6)))).toStrictEqual(expectedTree(X6))
    expect(shapeOf(rootOf(markupOf(X7)))).toStrictEqual(expectedTree(X7))
  })

  test("the root's five children; each card's two rows; the question card's three children, four on S4 only", () => {
    expect(
      perState((root) => [
        root.attributes.class,
        elementChildren(root).map((e) => CLASS_NAME.get(e.attributes.class ?? '')),
      ]),
    ).toStrictEqual(
      Array.from({ length: 5 }, () => [
        undefined,
        ['timers', 'category-row', 'question', 'answer-box', 'actions'],
      ]),
    )
    expect(
      perState((root) => withClass(root, 'timer').map((card) => elementChildren(card).length)),
    ).toStrictEqual(Array.from({ length: 5 }, () => [2, 2]))
    expect(
      perState((root) =>
        elementChildren(theOne(root, 'question')).map((e) =>
          CLASS_NAME.get(e.attributes.class ?? ''),
        ),
      ),
    ).toStrictEqual([
      ['question-head', 'question-body', 'hint-strip'],
      ['question-head', 'question-body', 'hint-strip'],
      ['question-head', 'question-body', 'hint-strip'],
      ['question-head', 'question-body', 'hint-strip', 'reveal'],
      ['question-head', 'question-body', 'hint-strip'],
    ])
    expect(perState((root) => withClass(root, 'reveal').length)).toStrictEqual([0, 0, 0, 1, 0])
  })

  test('data-team a / b on the cards, data-active true on exactly the active one; the fill and the header strip carry the active team', () => {
    expect(
      perState((root) =>
        withClass(root, 'timer').map((card) => [
          card.attributes['data-team'],
          card.attributes['data-active'],
        ]),
      ),
    ).toStrictEqual([
      [
        ['a', 'true'],
        ['b', 'false'],
      ],
      [
        ['a', 'true'],
        ['b', 'false'],
      ],
      [
        ['a', 'true'],
        ['b', 'false'],
      ],
      [
        ['a', 'true'],
        ['b', 'false'],
      ],
      [
        ['a', 'false'],
        ['b', 'true'],
      ],
    ])
    expect(
      perState((root) => [
        theOne(root, 'fill').attributes['data-team'],
        theOne(root, 'question-head').attributes['data-team'],
      ]),
    ).toStrictEqual([
      ['a', 'a'],
      ['a', 'a'],
      ['a', 'a'],
      ['a', 'a'],
      ['b', 'b'],
    ])
  })

  test("the fill's width is the view's bankPct: 100% · 95.555…% · 91.111…% · 91.111…% · 100%", () => {
    expect(perState((root) => theOne(root, 'fill').attributes.style)).toStrictEqual([
      'width:100%',
      'width:95.55555555555556%',
      'width:91.11111111111111%',
      'width:91.11111111111111%',
      'width:100%',
    ])
  })

  test('data-spent: true once a hint of the question is spent — S2, S3, and S4 under the reveal', () => {
    expect(perState((root) => theOne(root, 'hint-text').attributes['data-spent'])).toStrictEqual([
      'false',
      'true',
      'true',
      'true',
      'false',
    ])
    // The view's own flag, which X4 carries over from X3 (verification.md Table X).
    expect(VIEWS.map(([, v]) => v.hintSpent)).toStrictEqual([false, true, true, true, false])
    expect(theOne(rootOf(markupOf(X7)), 'hint-text').attributes['data-spent']).toBe('false')
  })

  test('every dot is a 9px Dot, data-won false on S1–S5; won dots on X6', () => {
    expect(
      perState((root) =>
        withClass(root, 'dots').map((dots) =>
          elementChildren(dots).map((dot) => [
            dot.attributes['data-size'],
            dot.attributes['data-won'],
          ]),
        ),
      ),
    ).toStrictEqual(
      Array.from({ length: 5 }, () =>
        Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => ['sm', 'false'])),
      ),
    )
    expect(
      withClass(rootOf(markupOf(X6)), 'dots').map((dots) =>
        elementChildren(dots).map((dot) => dot.attributes['data-won']),
      ),
    ).toStrictEqual([
      ['true', 'true', 'false'],
      ['true', 'false', 'false'],
    ])
  })

  test('.ltr-num on both clocks, and on nothing else', () => {
    expect(
      perState((root) =>
        descendants(root)
          .filter((e) => (e.attributes.class ?? '').split(' ').includes('ltr-num'))
          .map((e) => [CLASS_NAME.get((e.attributes.class ?? '').split(' ')[0] ?? ''), e.children]),
      ),
    ).toStrictEqual([
      [
        ['clock', ['45']],
        ['clock', ['45']],
      ],
      [
        ['clock', ['43']],
        ['clock', ['45']],
      ],
      [
        ['clock', ['41']],
        ['clock', ['45']],
      ],
      [
        ['clock', ['41']],
        ['clock', ['45']],
      ],
      [
        ['clock', ['41']],
        ['clock', ['45']],
      ],
    ])
  })

  test('the action row: تلميح yellow on S1, S2, S5 and disabled on S3–S4, its tone dropped; صحيح leaf; nothing else disabled', () => {
    const buttons = (root: Element): Element[] =>
      elementChildren(theOne(root, 'actions')).filter((e) => e.tag === 'button')
    expect(perState((root) => buttons(root).length)).toStrictEqual([3, 3, 3, 3, 3])
    expect(
      perState((root) =>
        buttons(root).map((b) => [
          b.attributes['data-variant'],
          b.attributes['data-tone'],
          b.attributes.disabled,
          b.attributes['aria-disabled'],
        ]),
      ),
    ).toStrictEqual([
      [
        ['action', undefined, undefined, undefined],
        ['action', 'yellow', undefined, undefined],
        ['action', 'leaf', undefined, undefined],
      ],
      [
        ['action', undefined, undefined, undefined],
        ['action', 'yellow', undefined, undefined],
        ['action', 'leaf', undefined, undefined],
      ],
      [
        ['action', undefined, undefined, undefined],
        ['action', undefined, '', 'true'],
        ['action', 'leaf', undefined, undefined],
      ],
      [
        ['action', undefined, undefined, undefined],
        ['action', undefined, '', 'true'],
        ['action', 'leaf', undefined, undefined],
      ],
      [
        ['action', undefined, undefined, undefined],
        ['action', 'yellow', undefined, undefined],
        ['action', 'leaf', undefined, undefined],
      ],
    ])
    // The only disabled control on the screen is the spent تلميح.
    expect(perState((_, markup) => markup.match(/\sdisabled=""/g)?.length ?? 0)).toStrictEqual([
      0, 0, 1, 1, 0,
    ])
    expect(
      perState((_, markup) => markup.match(/\saria-disabled="true"/g)?.length ?? 0),
    ).toStrictEqual([0, 0, 1, 1, 0])
    // X7: a question with no hints — disabled before any is spent, "انتهت التلميحات".
    const [, hint] = buttons(rootOf(markupOf(X7)))
    expect(hint?.attributes).toMatchObject({ disabled: '', 'aria-disabled': 'true' })
    expect(hint?.attributes['data-tone']).toBeUndefined()
    // The sub-label is each Button's last child (Procedure M6's `lastElementChild`).
    expect(
      perState((root) => buttons(root).map((b) => elementChildren(b).at(-1)?.children)),
    ).toStrictEqual([
      [['−٣ ثوانٍ'], ['−٢ ثانية · باقي 2'], ['يمرّ الدور']],
      [['−٣ ثوانٍ'], ['−٢ ثانية · باقي 1'], ['يمرّ الدور']],
      [['−٣ ثوانٍ'], ['انتهت التلميحات'], ['يمرّ الدور']],
      [['−٣ ثوانٍ'], ['انتهت التلميحات'], ['يمرّ الدور']],
      [['−٣ ثوانٍ'], ['−٢ ثانية · باقي 2'], ['يمرّ الدور']],
    ])
  })

  test("the texts of Y1 and the view's, in order — the reveal's three on S4 only", () => {
    for (const { name, v, markup } of RENDERED) {
      const parts = runParts(v)
      // Every run of the markup is its literal and value parts, in order …
      expect(runsOf(markup), name).toStrictEqual(parts.map(joined))
      // … and the literal parts are Y1's, in the prototype's order: all eleven with the reveal,
      // ten without ("الإجابة" is the reveal's).
      expect(
        parts.flat().flatMap((part) => ('literal' in part ? [part.literal] : [])),
        name,
      ).toStrictEqual(v.reveal === null ? Y1.filter((run) => run !== 'الإجابة') : [...Y1])
    }
    // S4 written out: every run of the screen, as the prototype's play block orders them.
    const s4 = RENDERED[3]
    expect(s4?.name).toBe('S4')
    expect(runsOf(s4?.markup ?? '')).toStrictEqual([
      'النمور',
      '41',
      'دورهم الآن',
      'الصقور',
      '45',
      'بالانتظار',
      '💬',
      'أمثال',
      'دور النمور',
      'سؤال 1',
      'سؤال تجريبي ١ — أمثال',
      '💡',
      'تلميح تجريبي ٢',
      'الإجابة',
      'إجابة تجريبية ١',
      FACT,
      'للحكم فقط 👁',
      'ماجد',
      'إجابة تجريبية ١',
      'يُقبل أيضاً: لا توجد بدائل',
      'تخطي ⏭',
      '−٣ ثوانٍ',
      'تلميح 💡',
      'انتهت التلميحات',
      'صحيح ✔',
      'يمرّ الدور',
    ])
  })

  test('every class play.module.css defines is one the screen uses, and the screen uses no other', () => {
    expect(CSS_CLASSES).toHaveLength(34)
    const used = new Set(
      RENDERED.flatMap(({ root }) =>
        descendants(root).flatMap((e) =>
          (e.attributes.class ?? '')
            .split(' ')
            .filter((name) => name !== '')
            .map((name) => CLASS_NAME.get(name) ?? name),
        ),
      ),
    )
    const foreign = new Set([...BUTTON.classes, ...BUTTON.subLabel, ...DOT_CLASSES, 'ltr-num'])
    expect([...used].filter((name) => !foreign.has(name)).sort()).toStrictEqual(
      [...CSS_CLASSES].sort(),
    )
  })
})

describe('REQ-6.12: the glyphs', () => {
  test('exactly five .glyph spans — 💡 alone in span.bulb, 👁 in "للحكم فقط", ⏭ 💡 ✔ in their Buttons — each holding its glyph alone', () => {
    for (const { name, root } of RENDERED) {
      const glyphs = withClass(root, 'glyph')
      expect(
        glyphs.map((span) => [span.tag, span.attributes.class, span.children]),
        name,
      ).toStrictEqual([
        ['span', served('glyph'), ['💡']],
        ['span', served('glyph'), ['👁']],
        ['span', served('glyph'), ['⏭']],
        ['span', served('glyph'), ['💡']],
        ['span', served('glyph'), ['✔']],
      ])
      // Where each sits: the bulb's only child; inside the judge-only label; inside each Button.
      const parentOf = (child: Element): Element | undefined =>
        descendants(root).find((e) => e.children.includes(child))
      expect(
        glyphs.map((span) => {
          const parent = parentOf(span)
          return [
            parent?.tag,
            CLASS_NAME.get(parent?.attributes.class?.split(' ').at(-1) ?? ''),
            parent?.children.length,
          ]
        }),
        name,
      ).toStrictEqual([
        ['span', 'bulb', 1],
        ['span', 'judge-only', 2],
        ['button', 'action', 4],
        ['button', 'action', 4],
        ['button', 'action', 4],
      ])
    }
  })

  test("the category's emoji is content: in a plain span, in no .glyph span", () => {
    for (const { name, root } of RENDERED) {
      const [emoji, catName] = elementChildren(theOne(root, 'category'))
      expect([emoji?.attributes, emoji?.children], name).toStrictEqual([{}, ['💬']])
      expect([catName?.attributes, catName?.children], name).toStrictEqual([{}, ['أمثال']])
      expect(
        withClass(root, 'glyph').filter((span) => span.children.includes('💬')),
        name,
      ).toStrictEqual([])
    }
  })

  test("play.module.css's .glyph declares exactly font-family: system-ui, sans-serif, in one rule", () => {
    const rules = [...CSS_CODE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: (m[1] ?? '').trim(),
      declarations: (m[2] ?? '')
        .split(';')
        .map((d) => d.trim().replace(/\s+/g, ' '))
        .filter((d) => d !== ''),
    }))
    expect(rules.filter(({ selector }) => /\.glyph\b/.test(selector))).toStrictEqual([
      { selector: '.glyph', declarations: ['font-family: system-ui, sans-serif'] },
    ])
  })
})

describe('REQ-6.11 / REQ-6.13: the buttons call what they say', () => {
  /** Every element of a React element tree, depth first, in document order — nothing rendered. */
  const elementsOf = (node: ReactNode): ReactElement[] => {
    if (Array.isArray(node)) return node.flatMap(elementsOf)
    if (!isValidElement(node)) return []
    return [node, ...elementsOf((node.props as { readonly children?: ReactNode }).children)]
  }

  interface ButtonElementProps {
    readonly variant?: string
    readonly onClick?: unknown
    readonly disabled?: boolean
    readonly 'data-tone'?: string
  }
  const buttonProps = (element: ReactElement): ButtonElementProps =>
    element.props as ButtonElementProps

  /** Three distinct callbacks, so that `toBe` tells them apart. */
  const propsFor = (v: PlayView): PlayScreenProps => ({
    view: v,
    onSkip: () => undefined,
    onHint: () => undefined,
    onCorrect: () => undefined,
  })

  test('the three action Buttons, in order, have onClick onSkip, onHint and onCorrect — the props’ own functions', () => {
    for (const [name, v] of [...VIEWS, ['X7', X7] as const]) {
      const props = propsFor(v)
      const buttons = elementsOf(PlayScreen(props)).filter((e) => e.type === Button)
      expect(
        buttons.map((b) => buttonProps(b).variant),
        name,
      ).toStrictEqual(['action', 'action', 'action'])
      const [skip, hint, correct] = buttons.map((b) => buttonProps(b).onClick)
      expect(skip, name).toBe(props.onSkip)
      expect(hint, name).toBe(props.onHint)
      expect(correct, name).toBe(props.onCorrect)
    }
  })

  test("the hint Button's disabled is true exactly when the view has 0 hints left; the others are never disabled", () => {
    const rows = [...VIEWS, ['X7', X7] as const].map(([name, v]) => {
      const buttons = elementsOf(PlayScreen(propsFor(v))).filter((e) => e.type === Button)
      return [name, v.hintsLeft, ...buttons.map((b) => buttonProps(b).disabled)]
    })
    expect(rows).toStrictEqual([
      ['S1', 2, undefined, false, undefined],
      ['S2', 1, undefined, false, undefined],
      ['S3', 0, undefined, true, undefined],
      ['S4', 0, undefined, true, undefined],
      ['S5', 2, undefined, false, undefined],
      ['X7', 0, undefined, true, undefined],
    ])
  })

  test('the hint text is one element: it carries no key, so the second hint does not replace it', () => {
    for (const [name, v] of VIEWS) {
      const hintText = elementsOf(PlayScreen(propsFor(v))).filter(
        (e) => (e.props as { readonly className?: string }).className === served('hint-text'),
      )
      expect(hintText, name).toHaveLength(1)
      expect(hintText[0]?.key, name).toBeNull()
    }
  })
})

describe('the screen and its view read no clock, no timer and no random source', () => {
  /** The six names verification.md §7 greps for, each as a whole word (`grep -w`). */
  const NAMES = ['Date', 'performance', 'setTimeout', 'setInterval', 'Math.random', 'startRound']
  const wholeWord = (name: string): RegExp =>
    new RegExp(`(?<![\\w])${name.replace('.', '\\.')}(?![\\w])`, 'g')
  const count = (source: string, name: string): number =>
    [...source.matchAll(wholeWord(name))].length

  const source = (path: string): string =>
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

  test('the search is live: each name found once in a line that uses it, and not inside a longer word', () => {
    const uses =
      'Date.now(); performance.now(); setTimeout(f); setInterval(f); Math.random(); startRound'
    expect(NAMES.map((name) => count(uses, name))).toStrictEqual([1, 1, 1, 1, 1, 1])
    const lookalikes =
      'DateTime, performances, setTimeouts, mySetInterval, Math.randomInt, startRounds'
    expect(NAMES.map((name) => count(lookalikes, name))).toStrictEqual([0, 0, 0, 0, 0, 0])
  })

  test('0 occurrences in PlayScreen.tsx and _lib/play-view.ts, comments included', () => {
    const files = {
      'PlayScreen.tsx': './PlayScreen.tsx',
      '_lib/play-view.ts': './_lib/play-view.ts',
    }
    const found = Object.entries(files).flatMap(([file, path]) => {
      const text = source(path)
      expect(text.length, file).toBeGreaterThan(0)
      return NAMES.filter((name) => count(text, name) > 0).map((name) => ({ file, name }))
    })
    expect(found).toStrictEqual([])
  })
})

describe('NFR-6.6: the stylesheet is written on the logical axes', () => {
  test('no left / right, no physical block-axis margin or top border, no disable comment — comments included', () => {
    expect(CSS.match(/\b(left|right)\b/gi)).toBeNull()
    expect(CSS.match(/\b(margin-top|margin-bottom|border-top)\b/g)).toBeNull()
    expect(CSS).not.toContain('stylelint-disable')
    // The prototype's physical forms, written logically.
    for (const logical of ['margin-block-start', 'margin-block-end', 'border-block-start']) {
      expect(CSS_CODE, logical).toContain(`${logical}:`)
    }
  })
})
