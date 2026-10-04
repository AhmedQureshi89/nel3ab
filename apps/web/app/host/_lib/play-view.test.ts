import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { reduce } from '@nel3ab/game'
import type { Action, Question, RoomState } from '@nel3ab/game'
import { describe, expect, test } from 'vitest'

import { CATALOG } from './catalog'
import type { CatalogEntry } from './catalog'
import { drawRound } from './driver'
import { playView } from './play-view'
import type { PlayView, TimerView } from './play-view'
import { seedRoom } from './seed'

// REQ-6.1 – REQ-6.5 — specs/phase-6/verification.md Gate 1 and its Table X: `playView` gives every
// value the play screen shows. See specs.md §2.1 (the field table) and §2.5 (this file's row).
//
// Table X's rooms are reached through the engine's own actions from the seed, never hand-built:
// `openRoom`, then `startMatch` carrying `drawRound(…, CATALOG, () => 0.5)` — أمثال (`proverbs`),
// its questions in the order ١، ٣، ٢ (Phase 5's Table T2) — then the judge's actions and the
// driver's `tick` / `passTurn`. Rows X6–X11 edit one field of S1 by hand, as each says; no action
// produces those rooms on `play`.

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

/** Table X gives the bar to four decimals. */
const fourDecimals = (n: number): number => Math.round(n * 10_000) / 10_000
/** The view with its bar at Table X's precision; every other field exact. */
const pinned = (v: PlayView): PlayView => ({ ...v, bankPct: fourDecimals(v.bankPct) })

/** The room with its current question's fields replaced — no index, no `!`. */
const withCurrentQuestion = (state: RoomState, patch: Partial<Question>): RoomState => ({
  ...state,
  questionPool: state.questionPool.map((question, i) =>
    i === state.questionIndex % state.questionPool.length ? { ...question, ...patch } : question,
  ),
})

const UNWON = [false, false, false]
const FACT = 'معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨'

/** Table X1 — S1, every field. */
const X1: PlayView = {
  timers: {
    a: { name: 'النمور', clock: 45, active: true, status: 'دورهم الآن', dots: UNWON },
    b: { name: 'الصقور', clock: 45, active: false, status: 'بالانتظار', dots: UNWON },
  },
  activeTeam: 'a',
  activeName: 'النمور',
  catEmoji: '💬',
  catName: 'أمثال',
  bankPct: 100,
  qNumber: 1,
  questionText: 'سؤال تجريبي ١ — أمثال',
  hintText: 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا',
  hintSpent: false,
  hintsLeft: 2,
  hintBtnNote: '−٢ ثانية · باقي 2',
  reveal: null,
  judgeName: 'ماجد',
  answerText: 'إجابة تجريبية ١',
  altText: 'لا توجد بدائل',
}

/** Table X2 — S2: what changes from X1. */
const X2: PlayView = {
  ...X1,
  timers: { a: { ...X1.timers.a, clock: 43 }, b: X1.timers.b },
  bankPct: 95.5556,
  hintText: 'تلميح تجريبي ١',
  hintSpent: true,
  hintsLeft: 1,
  hintBtnNote: '−٢ ثانية · باقي 1',
}

/** Table X3 — S3: what changes from X2. */
const X3: PlayView = {
  ...X2,
  timers: { a: { ...X2.timers.a, clock: 41 }, b: X2.timers.b },
  bankPct: 91.1111,
  hintText: 'تلميح تجريبي ٢',
  hintsLeft: 0,
  hintBtnNote: 'انتهت التلميحات',
}

/** Table X4 — S4: the reveal; every other field as X3. */
const X4: PlayView = { ...X3, reveal: { answer: 'إجابة تجريبية ١', fact: FACT } }

/** Table X5 — S5: team B's turn on question 2 (the pool's ٣); the hint as on S1. */
const X5: PlayView = {
  ...X1,
  timers: {
    a: { name: 'النمور', clock: 41, active: false, status: 'مجمّد', dots: UNWON },
    b: { name: 'الصقور', clock: 45, active: true, status: 'دورهم الآن', dots: UNWON },
  },
  activeTeam: 'b',
  activeName: 'الصقور',
  qNumber: 2,
  questionText: 'سؤال تجريبي ٣ — أمثال',
  answerText: 'إجابة تجريبية ٣',
}

const STATES = [
  ['S1', S1, X1],
  ['S2', S2, X2],
  ['S3', S3, X3],
  ['S4', S4, X4],
  ['S5', S5, X5],
] as const

describe("Table X's rooms", () => {
  test('S1 is round 1 of أمثال on play, its questions ١، ٣، ٢; S2–S5 stay on play', () => {
    expect([S1.screen, S1.round, S1.categoryId]).toStrictEqual(['play', 1, 'proverbs'])
    expect(S1.questionPool.map(({ q }) => q)).toStrictEqual([
      'سؤال تجريبي ١ — أمثال',
      'سؤال تجريبي ٣ — أمثال',
      'سؤال تجريبي ٢ — أمثال',
    ])
    expect([S2, S3, S4, S5].map(({ screen }) => screen)).toStrictEqual([
      'play',
      'play',
      'play',
      'play',
    ])
    // The turn passes on the tenth step after صحيح, not the ninth (REQ-4.6).
    expect(after(S4, ...steps(9)).reveal).not.toBeNull()
    expect(S5.reveal).toBeNull()
  })
})

describe('REQ-6.2: the timer cards', () => {
  test('X1–X5: names, clocks 45 · 43 · 41 · 41 · 41 / 45, active, the three statuses', () => {
    for (const [, state, expected] of STATES) {
      expect(view(state).timers).toStrictEqual(expected.timers)
    }
    expect(STATES.map(([, state]) => view(state).timers.a.clock)).toStrictEqual([
      45, 43, 41, 41, 41,
    ])
    expect(STATES.map(([, state]) => view(state).timers.b.clock)).toStrictEqual([
      45, 45, 45, 45, 45,
    ])
    expect(view(S1).timers.b.status).toBe('بالانتظار')
    expect(view(S5).timers.a.status).toBe('مجمّد')
    expect(view(S5).timers.b.status).toBe('دورهم الآن')
  })

  test("the clock is the engine's: rounded up — 41,300 ms shows 42, 50 ms shows 1 — and 0 at 0", () => {
    const at41300 = after(S1, { type: 'tick', ms: 3_700 })
    expect(view(at41300).timers.a.clock).toBe(42)
    expect(view(after(S1, { type: 'tick', ms: 44_950 })).timers.a.clock).toBe(1)
    // Hand-built: a running bank already at 0 (the next tick ends the round).
    const empty: RoomState = {
      ...S1,
      clock: { ...S1.clock, banks: { ...S1.clock.banks, a: { ms: 0, started: true } } },
    }
    expect(view(empty).timers.a.clock).toBe(0)
  })

  test('X6: dots for tallies 0–2 and winsNeeded 2, 3 and 4', () => {
    const tallied: RoomState = { ...S1, tallyA: 2, tallyB: 1 }
    expect(view(tallied).timers.a.dots).toStrictEqual([true, true, false])
    expect(view(tallied).timers.b.dots).toStrictEqual([true, false, false])

    const four = (state: RoomState): RoomState => ({
      ...state,
      config: { ...state.config, winsNeeded: 4 },
    })
    expect(view(four(S1)).timers.a.dots).toStrictEqual([false, false, false, false])
    expect(view(four(S1)).timers.b.dots).toStrictEqual([false, false, false, false])
    expect(view(four(tallied)).timers.a.dots).toStrictEqual([true, true, false, false])
    expect(view(four(tallied)).timers.b.dots).toStrictEqual([true, false, false, false])

    const two: RoomState = { ...S1, config: { ...S1.config, winsNeeded: 2 }, tallyA: 1 }
    expect(view(two).timers.a.dots).toStrictEqual([true, false])
    expect(view(two).timers.b.dots).toStrictEqual([false, false])
  })
})

describe('REQ-6.3: the category, the bank bar, whose turn, which question', () => {
  test('X1–X5: 💬 أمثال; bankPct 100, 95.5556, 91.1111, 91.1111, 100; النمور then الصقور; qNumber 1, 1, 1, 1, 2', () => {
    for (const [, state] of STATES) {
      expect([view(state).catEmoji, view(state).catName]).toStrictEqual(['💬', 'أمثال'])
    }
    expect(STATES.map(([, state]) => fourDecimals(view(state).bankPct))).toStrictEqual([
      100, 95.5556, 91.1111, 91.1111, 100,
    ])
    expect(
      STATES.map(([, state]) => [view(state).activeTeam, view(state).activeName]),
    ).toStrictEqual([
      ['a', 'النمور'],
      ['a', 'النمور'],
      ['a', 'النمور'],
      ['a', 'النمور'],
      ['b', 'الصقور'],
    ])
    expect(STATES.map(([, state]) => view(state).qNumber)).toStrictEqual([1, 1, 1, 1, 2])
  })

  test("the bar is the active team's bank over a full one: 41,300 ms → 91.7778; clamped to 0–100", () => {
    expect(fourDecimals(view(after(S1, { type: 'tick', ms: 3_700 })).bankPct)).toBe(91.7778)
    // S5: team B's full bank, while team A's frozen 41,000 ms would read 91.1111.
    expect(view(S5).bankPct).toBe(100)
    // Hand-built: a bank longer than the room's round (45 s in a room of 40 s) reads 100, not 112.5.
    expect(view({ ...S1, config: { ...S1.config, roundSeconds: 40 } }).bankPct).toBe(100)
    // Hand-built: a running bank at 0 reads 0.
    const empty: RoomState = {
      ...S1,
      clock: { ...S1.clock, banks: { ...S1.clock.banks, a: { ms: 0, started: true } } },
    }
    expect(view(empty).bankPct).toBe(0)
  })

  test('X9: questionIndex 3 → qNumber 4, the pool wrapping to its first question', () => {
    const fourth = view({ ...S1, questionIndex: 3 })
    expect(fourth.qNumber).toBe(4)
    expect(fourth.questionText).toBe('سؤال تجريبي ١ — أمثال')
    expect(fourth.answerText).toBe('إجابة تجريبية ١')
  })

  test('the category is read from the catalog given, not a fixed one', () => {
    const renamed: readonly CatalogEntry[] = CATALOG.map((entry) =>
      entry.id === 'proverbs' ? { ...entry, name: 'x', emoji: 'y' } : entry,
    )
    expect([playView(S1, renamed).catEmoji, playView(S1, renamed).catName]).toStrictEqual([
      'y',
      'x',
    ])
  })
})

describe('REQ-6.4: the hint — placeholder, shown, used up', () => {
  test('X1–X5: the placeholder, the first and the second hint, hintSpent, hintsLeft 2 / 1 / 0, both notes', () => {
    const rows = STATES.map(([name, state]) => {
      const { hintText, hintSpent, hintsLeft, hintBtnNote } = view(state)
      return [name, hintText, hintSpent, hintsLeft, hintBtnNote]
    })
    expect(rows).toStrictEqual([
      ['S1', 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا', false, 2, '−٢ ثانية · باقي 2'],
      ['S2', 'تلميح تجريبي ١', true, 1, '−٢ ثانية · باقي 1'],
      ['S3', 'تلميح تجريبي ٢', true, 0, 'انتهت التلميحات'],
      ['S4', 'تلميح تجريبي ٢', true, 0, 'انتهت التلميحات'],
      ['S5', 'لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا', false, 2, '−٢ ثانية · باقي 2'],
    ])
  })

  test('X7: a question with no hints — "ما فيه تلميحات لهذا السؤال", not spent, 0 left, "انتهت التلميحات"', () => {
    const v = view(withCurrentQuestion(S1, { h: [] }))
    expect([v.hintText, v.hintSpent, v.hintsLeft, v.hintBtnNote]).toStrictEqual([
      'ما فيه تلميحات لهذا السؤال',
      false,
      0,
      'انتهت التلميحات',
    ])
  })

  test('the strip shows the most recent hint spent, never the next one', () => {
    const three = withCurrentQuestion(S1, { h: ['h1', 'h2', 'h3'] })
    expect(view(three).hintText).toBe('لا يوجد تلميح بعد — اضغط تلميح إذا احتاجوا')
    expect(view(after(three, { type: 'hint' })).hintText).toBe('h1')
    expect(view(after(three, { type: 'hint' }, { type: 'hint' })).hintText).toBe('h2')
    expect(view(after(three, { type: 'hint' }, { type: 'hint' })).hintBtnNote).toBe(
      '−٢ ثانية · باقي 1',
    )
  })
})

describe('REQ-6.5: the reveal and the judge’s answer box', () => {
  test("X4: the reveal's answer and fact on S4 only", () => {
    expect(view(S4).reveal).toStrictEqual({ answer: 'إجابة تجريبية ١', fact: FACT })
    expect(view(S4).reveal?.answer).toBe(view(S4).answerText)
    expect([S1, S2, S3, S5].map((state) => view(state).reveal)).toStrictEqual([
      null,
      null,
      null,
      null,
    ])
    // Every other field as X3.
    expect(pinned(view(S4))).toStrictEqual({ ...pinned(view(S3)), reveal: X4.reveal })
  })

  test('X1, X5: the judge ماجد; the answer of the current question; "لا توجد بدائل"', () => {
    expect([view(S1).judgeName, view(S1).answerText, view(S1).altText]).toStrictEqual([
      'ماجد',
      'إجابة تجريبية ١',
      'لا توجد بدائل',
    ])
    expect([view(S5).judgeName, view(S5).answerText]).toStrictEqual(['ماجد', 'إجابة تجريبية ٣'])
  })

  test('X8: variants ["أ", "ب"] → "أ، ب"; [""] → "" (the prototype\'s conditional, not `|| …`)', () => {
    expect(view(withCurrentQuestion(S1, { alts: ['أ', 'ب'] })).altText).toBe('أ، ب')
    expect(view(withCurrentQuestion(S1, { alts: [''] })).altText).toBe('')
  })

  test('X10: no players → "—"; judgeIndex 7 of 5 → نورة', () => {
    expect(view({ ...S1, players: [] }).judgeName).toBe('—')
    expect(view({ ...S1, judgeIndex: 7 }).judgeName).toBe('نورة')
  })
})

describe('REQ-6.1: one pure view', () => {
  const PLAY_VIEW_FIELDS: readonly (keyof PlayView)[] = [
    'timers',
    'activeTeam',
    'activeName',
    'catEmoji',
    'catName',
    'bankPct',
    'qNumber',
    'questionText',
    'hintText',
    'hintSpent',
    'hintsLeft',
    'hintBtnNote',
    'reveal',
    'judgeName',
    'answerText',
    'altText',
  ]
  const TIMER_VIEW_FIELDS: readonly (keyof TimerView)[] = [
    'name',
    'clock',
    'active',
    'status',
    'dots',
  ]

  test('X1–X5: every field of every view, exactly (the bar to four decimals)', () => {
    for (const [, state, expected] of STATES) {
      expect(pinned(view(state))).toStrictEqual(expected)
    }
  })

  test("PlayView's fields are exactly specs.md §2.1's sixteen, TimerView's its five", () => {
    expect(PLAY_VIEW_FIELDS).toHaveLength(16)
    expect(TIMER_VIEW_FIELDS).toHaveLength(5)
    for (const [, state] of STATES) {
      const v = view(state)
      expect(Object.keys(v).sort()).toStrictEqual([...PLAY_VIEW_FIELDS].sort())
      expect(Object.keys(v.timers).sort()).toStrictEqual(['a', 'b'])
      expect(Object.keys(v.timers.a).sort()).toStrictEqual([...TIMER_VIEW_FIELDS].sort())
      expect(Object.keys(v.timers.b).sort()).toStrictEqual([...TIMER_VIEW_FIELDS].sort())
    }
  })

  test('X11: the seed on setup (no pool), an empty pool, categoryId "nope" and null all throw RangeError', () => {
    expect(() => view(seedRoom('SKZJ62'))).toThrow(RangeError)
    expect(() => view(seedRoom('SKZJ62'))).toThrow(/no current question/)
    expect(() => view({ ...S1, questionPool: [] })).toThrow(/no current question/)
    expect(() => view({ ...S1, categoryId: 'nope' })).toThrow(RangeError)
    expect(() => view({ ...S1, categoryId: 'nope' })).toThrow(/no category with id "nope"/)
    expect(() => view({ ...S1, categoryId: null })).toThrow(RangeError)
    expect(() => view({ ...S1, categoryId: null })).toThrow(/no category with id null/)
    // A catalog without the room's category, the room itself valid.
    expect(() => playView(S1, [])).toThrow(RangeError)
  })

  test('the same room and catalog, deep-frozen, give deep-equal views on every call, and are not mutated', () => {
    const rooms: readonly RoomState[] = [
      S1,
      S2,
      S3,
      S4,
      S5,
      { ...S1, tallyA: 2, tallyB: 1 },
      withCurrentQuestion(S1, { h: [], alts: ['أ', 'ب'] }),
      { ...S1, questionIndex: 3, judgeIndex: 7 },
    ]
    const catalog = deepFreeze(structuredClone(CATALOG))
    for (const room of rooms) {
      const frozen = deepFreeze(structuredClone(room))
      const first = playView(frozen, catalog)
      expect(first).toStrictEqual(playView(room, CATALOG))
      expect(playView(frozen, catalog)).toStrictEqual(first)
      expect(playView(frozen, catalog)).toStrictEqual(first)
      expect(frozen).toStrictEqual(room)
    }
    expect(catalog).toStrictEqual(CATALOG)
  })

  test("_lib/play-view.ts imports nothing but @nel3ab/game and ./catalog's type", () => {
    const imports = [...PLAY_VIEW_SOURCE.matchAll(IMPORT)].map((match) => ({
      typeOnly: match[1] !== undefined,
      names: group(match, 2)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== ''),
      from: group(match, 3),
    }))
    // Every import statement in the file is one the pattern read.
    expect(PLAY_VIEW_SOURCE.match(/^import\b/gm)).toHaveLength(imports.length)
    expect(PLAY_VIEW_SOURCE).not.toMatch(/\brequire\s*\(|\bimport\s*\(/)
    expect(new Set(imports.map(({ from }) => from))).toStrictEqual(
      new Set(['@nel3ab/game', './catalog']),
    )
    // The engine's four helpers of specs.md §2.1 at run time, and types.
    expect(
      imports.filter(({ typeOnly, from }) => !typeOnly && from === '@nel3ab/game'),
    ).toStrictEqual([
      {
        typeOnly: false,
        names: ['currentJudge', 'currentQuestion', 'displaySeconds', 'remainingMs'],
        from: '@nel3ab/game',
      },
    ])
    // The catalog's type only — never its data.
    expect(imports.filter(({ from }) => from === './catalog')).toStrictEqual([
      { typeOnly: true, names: ['CatalogEntry'], from: './catalog' },
    ])
  })

  test('every field is named after the renderVals keys it mirrors, and the header comment names them', () => {
    // The prototype's `renderVals(){ … }`, read at run time: exactly one block.
    expect(RENDER_VALS_BLOCKS).toHaveLength(1)
    expect(Object.keys(RENDER_VALS_KEYS).sort()).toStrictEqual([...PLAY_VIEW_FIELDS].sort())
    expect(Object.keys(TIMER_RENDER_VALS_KEYS).sort()).toStrictEqual([...TIMER_VIEW_FIELDS].sort())
    // Eleven fields carry their key's own name.
    const sameName = PLAY_VIEW_FIELDS.filter((field) => RENDER_VALS_KEYS[field].includes(field))
    expect(sameName).toStrictEqual([
      'activeName',
      'catEmoji',
      'catName',
      'bankPct',
      'qNumber',
      'questionText',
      'hintText',
      'hintBtnNote',
      'judgeName',
      'answerText',
      'altText',
    ])

    const keys = [
      ...Object.values(RENDER_VALS_KEYS).flat(),
      ...Object.values(TIMER_RENDER_VALS_KEYS).flat(),
    ]
    for (const key of new Set(keys)) {
      // A key of the prototype's renderVals, once.
      expect(all(RENDER_VALS, new RegExp(`(?<![\\w$])${key}\\s*:`, 'g')), key).toHaveLength(1)
      // Named in this file's header comment.
      expect(HEADER, key).toMatch(new RegExp(`(?<![\\w$])${key}(?![\\w$])`))
    }
    for (const field of PLAY_VIEW_FIELDS) {
      expect(HEADER, field).toMatch(new RegExp(`^//\\s+${field}\\b`, 'm'))
    }
  })
})

// --- what the REQ-6.1 tests read --------------------------------------------------------------

/** `value`, and everything reachable from it, frozen — a write anywhere then throws (ESM is strict). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

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

// Paths resolve from import.meta.url: each Vitest project sets its own `root`.
const PLAY_VIEW_SOURCE = readFileSync(
  fileURLToPath(new URL('./play-view.ts', import.meta.url)),
  'utf8',
)
const PROTOTYPE = readFileSync(
  fileURLToPath(new URL('../../../../../design/designs/Nel3ab - Arcade.dc.html', import.meta.url)),
  'utf8',
)

/** `import [type] { … } from '…'`, capturing `type`, the names and the specifier. */
const IMPORT = /^import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'$/gm

/** The file's leading comment: every line before its first import. */
const HEADER = PLAY_VIEW_SOURCE.slice(0, PLAY_VIEW_SOURCE.search(/^import\b/m))

/** The prototype's `renderVals(){ … }`, read at run time; exactly one. */
const RENDER_VALS_BLOCKS = all(PROTOTYPE, /^ {2}renderVals\(\)\{\n([\s\S]*?)^ {2}\}$/gm)
const RENDER_VALS = RENDER_VALS_BLOCKS[0]?.[1] ?? ''

/** specs.md §2.1's field table: each field of `PlayView` and the `renderVals` keys it mirrors. */
const RENDER_VALS_KEYS: { readonly [F in keyof PlayView]: readonly string[] } = {
  timers: ['teamAName', 'teamBName', 'clockA', 'clockB', 'statusA', 'statusB', 'dotsA', 'dotsB'],
  activeTeam: ['activeColor'],
  activeName: ['activeName'],
  catEmoji: ['catEmoji'],
  catName: ['catName'],
  bankPct: ['bankPct'],
  qNumber: ['qNumber'],
  questionText: ['questionText'],
  hintText: ['hintText'],
  hintSpent: ['hintColor', 'hintAnim'],
  hintsLeft: ['hintBtnBg', 'hintBtnFg', 'hintBtnOpacity', 'hintBtnCursor'],
  hintBtnNote: ['hintBtnNote'],
  reveal: ['revealOn', 'revealAnswer', 'revealFact'],
  judgeName: ['judgeName'],
  answerText: ['answerText'],
  altText: ['altText'],
}

/** The same for `TimerView`: team A's key and team B's. */
const TIMER_RENDER_VALS_KEYS: { readonly [F in keyof TimerView]: readonly string[] } = {
  name: ['teamAName', 'teamBName'],
  clock: ['clockA', 'clockB'],
  active: ['timerABg', 'timerBBg', 'timerAShadow', 'timerBShadow'],
  status: ['statusA', 'statusB'],
  dots: ['dotsA', 'dotsB'],
}
