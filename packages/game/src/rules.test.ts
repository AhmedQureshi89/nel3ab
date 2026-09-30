import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { describe, expect, test } from 'vitest'

import { displaySeconds, remainingMs } from './clock.js'
import { reduce } from './reducer.js'
import { createRoom, currentQuestion } from './room.js'
import {
  HINT_COST_MS,
  ROUND_SECONDS_DEFAULT,
  ROUND_SECONDS_OPTIONS,
  SKIP_COST_MS,
  WINS_NEEDED_DEFAULT,
  WINS_NEEDED_OPTIONS,
} from './rules.js'
import type { Action, Question, RoomState } from './types.js'

// REQ-3.10 — verification.md Gate 2, "Numbers read from the prototype". See
// specs/phase-3/specs.md §2.9: the rules.test.ts row, "Reading design/" and
// "Extraction of the configurable values".
//
// The engine's rules are not remembered. Every number and every ordering below
// is read from design/designs/Nel3ab - Arcade.dc.html and design/user-stories.md
// when the test runs, and each extraction is asserted three ways:
//   1. its MATCH COUNT — so an extraction that finds nothing fails, rather than
//      "every one of zero values matched" passing vacuously;
//   2. its value, against verification.md's pre-registered table (counts and
//      values verified against the file on 2026-09-30);
//   3. against the engine — the exported constant and, where the table says
//      so, the reducer's behaviour, driven by the EXTRACTED value rather than by
//      a number written into this file.
// design/ is never edited (CLAUDE.md invariant 5, NFR-3.1), so this file can go
// red only by the engine drifting — never by the reference moving.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root. The
// prototype's file name has spaces, which `URL` percent-encodes; fileURLToPath
// decodes them, where slicing `.pathname` would not.
//
// The readers are deliberately small — regular expressions over two files that
// never change — and each is checked for soundness before it is trusted (the
// first describe block). No HTML or JavaScript parser: that would be a
// dependency for thirteen extractions.
//
// Every question below is synthetic. Nothing is copied from design/: the
// prototype's question content is not this package's to ship.

const read = (relativeToRepoRoot: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8')

const PROTOTYPE = read('design/designs/Nel3ab - Arcade.dc.html')
const USER_STORIES = read('design/user-stories.md')

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

// --- the prototype's logic script and its component class --------------------

/** `<script type="text/x-dc" …>…</script>`: the prototype's one logic script. */
const SCRIPTS = all(PROTOTYPE, /<script type="text\/x-dc"([^>]*)>([\s\S]*?)<\/script>/g)
const scriptAttributes = SCRIPTS[0]?.[1] ?? ''
const script = SCRIPTS[0]?.[2] ?? ''

/** The component class, from its header to the `}` alone on a line that closes it. */
const CLASSES = all(script, /^class Component extends DCLogic \{\n([\s\S]*?)^\}$/gm)
const classBody = CLASSES[0]?.[1] ?? ''

/**
 * A class member's first line: exactly two spaces, an optional `get`, a name,
 * then `=` (an arrow-function or value property) or `(` (a method). Member
 * bodies are indented deeper, and their closing `};` / `}` lines begin with a
 * brace, so neither is mistaken for a member.
 */
const MEMBER_HEADER = /^ {2}(?:get )?([A-Za-z_$][\w$]*)\s*[=(]/gm
const headers = all(classBody, MEMBER_HEADER)

/** Each member's source, from its header to the next member's: a partition of the class body. */
const members: ReadonlyMap<string, string> = new Map(
  headers.map((header, i) => [
    group(header, 1),
    classBody.slice(header.index, headers[i + 1]?.index ?? classBody.length),
  ]),
)
const member = (name: string): string => members.get(name) ?? ''

/** The members this file reads by name. */
const MEMBERS_READ = ['startClock', 'spend', 'markCorrect', 'markSkip', 'giveHint']

/** Every match of `pattern` inside the class, with the member it falls in, in source order. */
const inMembers = (
  pattern: RegExp,
): { readonly member: string; readonly match: RegExpExecArray }[] =>
  [...members].flatMap(([name, body]) =>
    all(body, pattern).map((match) => ({ member: name, match })),
  )

/** The label of every landmark match in `body`, in source order: an ordering is read off this. */
const sequence = (
  body: string,
  landmarks: readonly (readonly [label: string, pattern: RegExp])[],
): string[] =>
  landmarks
    .flatMap(([label, pattern]) => all(body, pattern).map((match) => ({ label, at: match.index })))
    .sort((x, y) => x.at - y.at)
    .map(({ label }) => label)

// --- the patterns, one per extraction (verification.md §2, REQ-3.10's table) --

/** #1, #2, #7 — `this.spend(N)`, capturing whatever sits between the parentheses. */
const SPEND = /this\.spend\(([^)]*)\)/g
/** #3 — `cur.time - D`, capturing D. Read in `startClock` only: `spend` holds `cur.time - sec`. */
const DRAIN = /cur\.time\s*-\s*([^)]*)/g
/** #4 — `setInterval(callback, P)`: P is the digits after the callback's closing `},`. */
const INTERVAL = /setInterval\([\s\S]*?\},\s*(\d+)\s*\)/g
/** #5 — a `time` compared with zero, capturing the operator. */
const ZERO_TEST = /\btime\s*(<=|<|===|==|>=|>)\s*0(?![\d.])/g
/** #6 — the guard that makes a judge action inert with the clock stopped or a reveal up. */
const GUARD = /if\s*\(\s*!this\.clockId\s*\|\|\s*this\.state\.reveal\s*\)\s*return\s*;/g
/** #7 — `giveHint`'s exhaustion check. */
const EXHAUSTED =
  /if\s*\(\s*this\.state\.hintIdx\s*>=\s*\(\s*this\.question\.h\s*\|\|\s*\[\s*\]\s*\)\.length\s*\)\s*return\s*;/g
/** #8, #9 — a spend's early return, `if(this.spend(N)) return;`. */
const SPEND_RETURN = /if\s*\(\s*this\.spend\([^)]*\)\s*\)\s*return\s*;/g
/** #8 — `giveHint`'s index advance. */
const HINT_ADVANCE = /hintIdx\s*:\s*s\.hintIdx\s*\+\s*1\b/g
/** #9 — `markSkip`'s index advance. */
const NEXT_QUESTION = /this\.nextQuestion\(\s*\)/g
/** #10 — the reveal's two fields, capturing the question property each one reads. */
const REVEAL = /reveal\s*:\s*\{\s*answer\s*:\s*q\.(\w+)\s*,\s*fact\s*:\s*q\.(\w+)/g
/** #11 — a clock face, `Math.<fn>(s.<team>.time)`, capturing the rounding function and the team. */
const CLOCK_FACE = /Math\.(\w+)\(\s*s\.([ab])\.time\s*\)/g

// --- #12, #13: the configurable values, from `data-props` ---------------------
// specs.md §2.9: the prototype declares them in its logic script's `data-props`
// attribute as HTML-entity-encoded JSON. Decode `&quot;` and parse it — never
// regex the numbers out of the encoded string.

const DATA_PROPS = all(scriptAttributes, /\sdata-props="([^"]*)"/g)
const decodedProps = (DATA_PROPS[0]?.[1] ?? '').replaceAll('&quot;', '"')

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined // the reader test below reports a failed parse
  }
}
const props = parseJson(decodedProps)

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const prop = (x: unknown, key: string): unknown =>
  isRecord(x) && Object.hasOwn(x, key) ? x[key] : undefined
const num = (x: unknown): number => (typeof x === 'number' ? x : NaN)
const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((e): e is string => typeof e === 'string') : []

/**
 * How many times `key` is declared in the decoded JSON. `JSON.parse` would
 * silently keep the last of two, so the count is read off the text — the
 * decoded text, and only the key: the values come from the parse.
 */
const declarations = (key: string): number =>
  all(decodedProps, new RegExp(`"${key}"\\s*:`, 'g')).length

const roundSecondsProp = prop(props, 'roundSeconds')
const winsNeededProp = prop(props, 'winsNeeded')

// --- the extracted values -------------------------------------------------------

const hintSpends = all(member('giveHint'), SPEND).map((m) => Number(group(m, 1)))
const skipSpends = all(member('markSkip'), SPEND).map((m) => Number(group(m, 1)))
const tickDrains = all(member('startClock'), DRAIN).map((m) => Number(group(m, 1)))
const intervals = all(member('startClock'), INTERVAL).map((m) => Number(group(m, 1)))
const zeroTests = inMembers(ZERO_TEST).map(({ member: name, match }) => ({
  member: name,
  operator: group(match, 1),
}))
const guarded = inMembers(GUARD).map(({ member: name }) => name)
const reveals = all(PROTOTYPE, REVEAL).map((m) => ({ answer: group(m, 1), fact: group(m, 2) }))
const clockFaces = all(PROTOTYPE, CLOCK_FACE).map((m) => ({
  round: group(m, 1),
  team: group(m, 2),
}))
const roundSecondsDeclared = {
  default: prop(roundSecondsProp, 'default'),
  min: prop(roundSecondsProp, 'min'),
  max: prop(roundSecondsProp, 'max'),
  step: prop(roundSecondsProp, 'step'),
}
const winsNeededDeclared = {
  default: prop(winsNeededProp, 'default'),
  options: prop(winsNeededProp, 'options'),
}

// --- design/user-stories.md's numeric rules -----------------------------------
// The lines under "قواعد رقمية تحكم كل القصص" (the numeric rules that govern
// every story) that begin `- **`: a bold value, then what it is the value of.
// Each rule is identified by its own words, not by its position. The minus sign
// in that file is U+2212 (−), not a hyphen-minus — a pattern written with `-`
// would find no cost at all.

/** U+2212 MINUS SIGN, spelled by code point so it cannot be mistaken for a hyphen-minus. */
const MINUS = String.fromCodePoint(0x2212)
const RULE_LINES = all(USER_STORIES, /^- \*\*(.+?)\*\* (.+)$/gm).map((m) => ({
  token: group(m, 1),
  label: group(m, 2),
}))

/** `45s` → { value: 45, unit: 's' }; `−2s` → { value: −2, unit: 's' }; `3` → { value: 3, unit: '' }. */
const parseRule = (token: string): { readonly value: number; readonly unit: string } | null => {
  const match = new RegExp(`^(${MINUS}?)(\\d+)(s?)$`).exec(token)
  if (match === null) return null
  const [, minus = '', digits = '', unit = ''] = match
  return { value: (minus === MINUS ? -1 : 1) * Number(digits), unit }
}

const USER_STORY_RULES = [
  {
    keyword: 'رصيد الوقت', // the time bank
    what: 'the time bank',
    token: '45s',
    engine: { value: ROUND_SECONDS_DEFAULT, unit: 's' },
  },
  {
    keyword: 'تلميح', // a hint
    what: 'a hint’s cost',
    token: `${MINUS}2s`,
    engine: { value: -HINT_COST_MS / 1000, unit: 's' },
  },
  {
    keyword: 'تخطي', // a skip
    what: 'a skip’s cost',
    token: `${MINUS}3s`,
    engine: { value: -SKIP_COST_MS / 1000, unit: 's' },
  },
  {
    keyword: 'جولات مكسوبة', // rounds won
    what: 'the rounds won that take the match',
    token: '3',
    engine: { value: WINS_NEEDED_DEFAULT, unit: '' },
  },
] as const

const linesFor = (keyword: string) => RULE_LINES.filter((line) => line.label.includes(keyword))

// --- the extraction table ---------------------------------------------------------

interface Extraction {
  /** The row of verification.md §2's REQ-3.10 table, or the user-story rule's keyword. */
  readonly row: number | string
  readonly what: string
  /** Matches found — one count per pattern: one for a value, one per landmark for an ordering. */
  readonly counts: readonly number[]
  /** verification.md's pre-registered count(s). */
  readonly expectedCounts: readonly number[]
  readonly value: unknown
  /** verification.md's pre-registered value. */
  readonly expectedValue: unknown
}

const PROTOTYPE_EXTRACTIONS: readonly Extraction[] = [
  {
    row: 1,
    what: 'this.spend(N) inside giveHint',
    counts: [hintSpends.length],
    expectedCounts: [1],
    value: hintSpends,
    expectedValue: [2],
  },
  {
    row: 2,
    what: 'this.spend(N) inside markSkip',
    counts: [skipSpends.length],
    expectedCounts: [1],
    value: skipSpends,
    expectedValue: [3],
  },
  {
    row: 3,
    what: 'cur.time - D inside startClock',
    counts: [tickDrains.length],
    expectedCounts: [1],
    value: tickDrains,
    expectedValue: [0.1],
  },
  {
    row: 4,
    what: 'the setInterval period in startClock',
    counts: [intervals.length],
    expectedCounts: [1],
    value: intervals,
    expectedValue: [100],
  },
  {
    // File-wide count; the value places each one in its member — the tick's
    // (`startClock`) and the spend's (`spend`) — so one outside the class shows.
    row: 5,
    what: 'time <= 0',
    counts: [all(PROTOTYPE, ZERO_TEST).length],
    expectedCounts: [2],
    value: zeroTests,
    expectedValue: [
      { member: 'startClock', operator: '<=' },
      { member: 'spend', operator: '<=' },
    ],
  },
  {
    // File-wide count; the value is the member holding each occurrence.
    row: 6,
    what: 'if(!this.clockId || this.state.reveal) return;',
    counts: [all(PROTOTYPE, GUARD).length],
    expectedCounts: [3],
    value: guarded,
    expectedValue: ['markCorrect', 'markSkip', 'giveHint'],
  },
  {
    row: 7,
    what: 'in giveHint, the exhaustion check precedes this.spend(2)',
    counts: [all(member('giveHint'), EXHAUSTED).length, all(member('giveHint'), SPEND).length],
    expectedCounts: [1, 1],
    value: sequence(member('giveHint'), [
      ['exhaustion check', EXHAUSTED],
      ['this.spend(N)', SPEND],
    ]),
    expectedValue: ['exhaustion check', 'this.spend(N)'],
  },
  {
    row: 8,
    what: 'in giveHint, this.spend(2)’s early return precedes hintIdx: s.hintIdx + 1',
    counts: [
      all(member('giveHint'), SPEND_RETURN).length,
      all(member('giveHint'), HINT_ADVANCE).length,
    ],
    expectedCounts: [1, 1],
    value: sequence(member('giveHint'), [
      ['spend’s early return', SPEND_RETURN],
      ['hintIdx + 1', HINT_ADVANCE],
    ]),
    expectedValue: ['spend’s early return', 'hintIdx + 1'],
  },
  {
    row: 9,
    what: 'in markSkip, this.spend(3)’s early return precedes this.nextQuestion()',
    counts: [
      all(member('markSkip'), SPEND_RETURN).length,
      all(member('markSkip'), NEXT_QUESTION).length,
    ],
    expectedCounts: [1, 1],
    value: sequence(member('markSkip'), [
      ['spend’s early return', SPEND_RETURN],
      ['nextQuestion()', NEXT_QUESTION],
    ]),
    expectedValue: ['spend’s early return', 'nextQuestion()'],
  },
  {
    row: 10,
    what: 'reveal:{answer:q.a, fact:q.f',
    counts: [reveals.length],
    expectedCounts: [1],
    value: reveals,
    expectedValue: [{ answer: 'a', fact: 'f' }],
  },
  {
    row: 11,
    what: 'Math.ceil(s.a.time), Math.ceil(s.b.time)',
    counts: [clockFaces.length],
    expectedCounts: [2],
    value: clockFaces,
    expectedValue: [
      { round: 'ceil', team: 'a' },
      { round: 'ceil', team: 'b' },
    ],
  },
  {
    row: 12,
    what: 'data-props → roundSeconds',
    counts: [declarations('roundSeconds')],
    expectedCounts: [1],
    value: roundSecondsDeclared,
    expectedValue: { default: 45, min: 20, max: 90, step: 5 },
  },
  {
    row: 13,
    what: 'data-props → winsNeeded',
    counts: [declarations('winsNeeded')],
    expectedCounts: [1],
    value: winsNeededDeclared,
    expectedValue: { default: '3', options: ['2', '3', '4'] },
  },
]

const USER_STORY_EXTRACTIONS: readonly Extraction[] = USER_STORY_RULES.map((rule) => ({
  row: rule.keyword,
  what: rule.what,
  counts: [linesFor(rule.keyword).length],
  expectedCounts: [1],
  value: linesFor(rule.keyword).map((line) => line.token),
  expectedValue: [rule.token],
}))

// --- driving the engine ------------------------------------------------------------

const ROOM = { roomCode: 'TEST01', teamA: 'أ', teamB: 'ب' } as const

const question = (n: number, hints = 2): Question => ({
  q: `سؤال تجريبي ${n}`,
  a: `جواب ${n}`,
  alts: [],
  h: [`تلميح ${n}-1`, `تلميح ${n}-2`].slice(0, hints),
  f: `معلومة ${n}`,
})

/** Three questions with two hints each — every question in the prototype's dataset has exactly two. */
const POOL: readonly [Question, ...Question[]] = [question(0), question(1), question(2)]

const tick = (ms: number): Action => ({ type: 'tick', ms })
const HINT: Action = { type: 'hint' }
const SKIP: Action = { type: 'skip' }
const CORRECT: Action = { type: 'correct' }

/** The prototype's judge-action methods, and the engine action each one is. */
const JUDGE_ACTIONS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['markCorrect', CORRECT],
  ['markSkip', SKIP],
  ['giveHint', HINT],
])

/** A fresh default room with a round started by team `a` at engine time 0. */
const started = (questions: readonly [Question, ...Question[]] = POOL): RoomState =>
  reduce(createRoom(ROOM), { type: 'startRound', startingTeam: 'a', questions })

/** `n` steps of `tick(ms)`, one reducer call each. */
const ticks = (state: RoomState, n: number, ms = 100): RoomState => {
  let s = state
  for (let i = 0; i < n; i += 1) s = reduce(s, tick(ms))
  return s
}

/** What the active team has left. */
const left = (s: RoomState): number => remainingMs(s.clock, s.clock.active)

/** `s` with the round ended on the active team's bank: only `screen` and the clock change. */
const roundEndOf = (s: RoomState): RoomState => ({
  ...s,
  screen: 'roundEnd',
  clock: {
    ...s.clock,
    runningSince: null,
    banks: { ...s.clock.banks, [s.clock.active]: { ...s.clock.banks[s.clock.active], ms: 0 } },
  },
})

/** A question's own property named `key`, or `undefined`. */
const field = (q: Question | null, key: string): unknown =>
  q === null ? undefined : new Map<string, unknown>(Object.entries(q)).get(key)

/** The rounding functions a clock face could use, by the name it is written with. */
const ROUNDING: ReadonlyMap<string, (x: number) => number> = new Map([
  ['ceil', Math.ceil],
  ['floor', Math.floor],
  ['round', Math.round],
  ['trunc', Math.trunc],
])

// ============================================================================
// The readers are sound before they are trusted
// ============================================================================

describe('REQ-3.10: the readers really read design/ — nothing here passes vacuously', () => {
  test('one logic script, one component class, one data-props attribute', () => {
    expect([SCRIPTS.length, CLASSES.length, DATA_PROPS.length]).toStrictEqual([1, 1, 1])
  })

  test('the class splits into members with nothing left over and no name twice', () => {
    // The first member begins the body and each runs to the next: a partition.
    expect(headers[0]?.index).toBe(0)
    expect([...members.values()].join('')).toBe(classBody)
    expect(members.size).toBe(headers.length)
    expect(members.size).toBe(35)
    expect(MEMBERS_READ.filter((name) => !members.has(name))).toStrictEqual([])
  })

  test('data-props decodes to JSON: only &quot; was encoded, and it parses to an object', () => {
    expect(decodedProps).not.toBe('')
    expect(decodedProps).not.toMatch(/&[#\w]+;/)
    expect(isRecord(props)).toBe(true)
  })

  test('design/user-stories.md has four numeric-rule lines, each claimed by exactly one rule', () => {
    expect(RULE_LINES).toHaveLength(4)
    expect(
      RULE_LINES.map(
        (line) => USER_STORY_RULES.filter((rule) => line.label.includes(rule.keyword)).length,
      ),
    ).toStrictEqual([1, 1, 1, 1])
  })
})

// ============================================================================
// Each extraction: its count and its value, as verification.md pre-registered them
// ============================================================================

describe('REQ-3.10: 13 extractions from design/designs/Nel3ab - Arcade.dc.html', () => {
  test('the table has the 13 rows of verification.md §2', () => {
    expect(PROTOTYPE_EXTRACTIONS.map(({ row }) => row)).toStrictEqual(
      Array.from({ length: 13 }, (_, i) => i + 1),
    )
  })

  test.for(PROTOTYPE_EXTRACTIONS)(
    'extraction #$row: count and value as pre-registered',
    ({ what, counts, expectedCounts, value, expectedValue }) => {
      expect(counts, `${what}: match count`).toStrictEqual(expectedCounts)
      expect(value, `${what}: value`).toStrictEqual(expectedValue)
    },
  )

  test('extraction #6: the guard is in markCorrect, markSkip and giveHint, and in no other member', () => {
    const holding = [...members]
      .filter(([, body]) => all(body, GUARD).length > 0)
      .map(([name]) => name)
    expect(holding).toStrictEqual(['markCorrect', 'markSkip', 'giveHint'])
    // Every occurrence in the file lies inside a member of the class …
    expect(inMembers(GUARD)).toHaveLength(all(PROTOTYPE, GUARD).length)
    // … and the other 32 of its 35 members hold none.
    expect(members.size - holding.length).toBe(32)
  })
})

describe('REQ-3.10: 4 values from design/user-stories.md’s numeric rules', () => {
  test.for(USER_STORY_EXTRACTIONS)(
    '$what: count and value as pre-registered',
    ({ row, counts, expectedCounts, value, expectedValue }) => {
      expect(counts, `lines naming ${String(row)}`).toStrictEqual(expectedCounts)
      expect(value, `the bold value on the line naming ${String(row)}`).toStrictEqual(expectedValue)
    },
  )

  test.for(USER_STORY_RULES)('$what equals the engine’s — $token', ({ keyword, engine }) => {
    expect(linesFor(keyword).map((line) => parseRule(line.token))).toStrictEqual([engine])
  })
})

test('REQ-3.10 tally: 13 / 13 extractions and 4 / 4 user-story values found, no count or value mismatch', () => {
  const tally = (extractions: readonly Extraction[]) => ({
    of: extractions.length,
    found: extractions.filter(({ counts }) => counts.every((n) => n > 0)).length,
    countMismatches: extractions.filter((e) => !isDeepStrictEqual(e.counts, e.expectedCounts))
      .length,
    valueMismatches: extractions.filter((e) => !isDeepStrictEqual(e.value, e.expectedValue)).length,
  })
  expect({
    prototype: tally(PROTOTYPE_EXTRACTIONS),
    userStories: tally(USER_STORY_EXTRACTIONS),
  }).toStrictEqual({
    prototype: { of: 13, found: 13, countMismatches: 0, valueMismatches: 0 },
    userStories: { of: 4, found: 4, countMismatches: 0, valueMismatches: 0 },
  })
})

// ============================================================================
// Each extraction, asserted against the engine — by its extracted value
// ============================================================================

describe('REQ-3.10: the extracted rules drive the engine', () => {
  const [hintSeconds = NaN] = hintSpends
  const [skipSeconds = NaN] = skipSpends
  const [drainSeconds = NaN] = tickDrains
  const [intervalMs = NaN] = intervals

  test('extraction #1: HINT_COST_MS / 1000 is giveHint’s spend, and a hint drains exactly spend × 1000 ms', () => {
    expect(HINT_COST_MS / 1000).toBe(hintSeconds)
    const before = ticks(started(), 10) // live, 44,000 ms left, no hint given yet
    const after = reduce(before, HINT)
    expect(left(before) - left(after)).toBe(hintSeconds * 1000)
    expect([after.screen, after.hintIndex]).toStrictEqual(['play', 1])
  })

  test('extraction #2: SKIP_COST_MS / 1000 is markSkip’s spend, and a skip drains exactly spend × 1000 ms', () => {
    expect(SKIP_COST_MS / 1000).toBe(skipSeconds)
    const before = ticks(started(), 10)
    const after = reduce(before, SKIP)
    expect(left(before) - left(after)).toBe(skipSeconds * 1000)
    expect([after.screen, after.questionIndex]).toStrictEqual(['play', 1])
  })

  test('extractions #3 + #4: the prototype drains D s every P ms — real time — and tick(P) drains exactly P ms', () => {
    expect(drainSeconds * 1000).toBe(intervalMs)
    const s = started()
    const full = left(s)
    expect(full - left(reduce(s, tick(intervalMs)))).toBe(intervalMs)
    // A whole bank in ticks of P: live, with P ms left, one tick short; ended by the last.
    const steps = full / intervalMs
    expect(Number.isInteger(steps)).toBe(true)
    const penultimate = ticks(s, steps - 1, intervalMs)
    expect([penultimate.screen, left(penultimate)]).toStrictEqual(['play', intervalMs])
    expect(reduce(penultimate, tick(intervalMs)).screen).toBe('roundEnd')
  })

  test('extraction #5: a bank at exactly 0 ends the round — by tick and by spend', () => {
    const s = started()
    const full = left(s)
    // By tick: the whole bank in one step ends the round; one millisecond short does not.
    const byTick = reduce(s, tick(full))
    expect([byTick.screen, left(byTick)]).toStrictEqual(['roundEnd', 0])
    const short = reduce(s, tick(full - 1))
    expect([short.screen, left(short)]).toStrictEqual(['play', 1])
    // By spend: exactly the cost left, then the spend — for a hint and for a skip.
    for (const [action, seconds] of [
      [HINT, hintSeconds],
      [SKIP, skipSeconds],
    ] as const) {
      const atCost = reduce(s, tick(full - seconds * 1000))
      expect(left(atCost)).toBe(seconds * 1000)
      expect(reduce(atCost, action)).toStrictEqual(roundEndOf(atCost))
      const above = reduce(reduce(s, tick(full - seconds * 1000 - 1)), action)
      expect([above.screen, left(above)]).toStrictEqual(['play', 1])
    }
  })

  test('extraction #6: correct, skip and hint are each inert during a reveal and with the clock stopped', () => {
    const actions = guarded.map((name) => JUDGE_ACTIONS.get(name))
    expect(actions).toStrictEqual([CORRECT, SKIP, HINT])

    const live = ticks(started(), 10)
    const states: readonly (readonly [label: string, state: RoomState])[] = [
      ['a reveal is up', reduce(live, CORRECT)],
      ['setup, no round in play', createRoom(ROOM)],
      ['the round has ended', reduce(live, tick(left(live)))],
    ]
    // Each state is the one its label names, with the clock stopped — the
    // prototype's `!this.clockId`.
    expect(
      states.map(([, s]) => [s.screen, s.clock.runningSince, s.reveal !== null]),
    ).toStrictEqual([
      ['play', null, true],
      ['setup', null, false],
      ['roundEnd', null, false],
    ])
    // 3 states × 3 actions: each returns the very state it was given.
    const inert = Object.fromEntries(
      states.map(([label, s]) => [
        label,
        actions.map((action) => action !== undefined && reduce(s, action) === s),
      ]),
    )
    expect(inert).toStrictEqual({
      'a reveal is up': [true, true, true],
      'setup, no round in play': [true, true, true],
      'the round has ended': [true, true, true],
    })
    // Control: in the live round each one acts.
    expect(
      actions.map((action) => action !== undefined && reduce(live, action) !== live),
    ).toStrictEqual([true, true, true])
  })

  test('extraction #7: the exhaustion check comes first, so an exhausted hint costs nothing', () => {
    const twice = reduce(reduce(started(), HINT), HINT)
    expect([twice.hintIndex, currentQuestion(twice)?.h.length]).toStrictEqual([2, 2])
    expect(reduce(twice, HINT)).toBe(twice)
    // Even with exactly the cost left: were the spend first, this hint would end the round.
    const atCost = reduce(twice, tick(left(twice) - hintSeconds * 1000))
    expect(reduce(atCost, HINT)).toBe(atCost)
    // A question with no hints is exhausted before its first.
    const hintless = started([question(0, 0), question(1)])
    expect(reduce(hintless, HINT)).toBe(hintless)
  })

  test('extraction #8: a round-ending hint does not advance hintIndex', () => {
    const one = reduce(started(), HINT) // hintIndex 1, so "unchanged" is not "still 0"
    const atCost = reduce(one, tick(left(one) - hintSeconds * 1000))
    const ended = reduce(atCost, HINT)
    expect(ended).toStrictEqual(roundEndOf(atCost))
    expect(ended.hintIndex).toBe(1)
  })

  test('extraction #9: a round-ending skip does not advance questionIndex', () => {
    const one = reduce(started(), SKIP) // questionIndex 1, so "unchanged" is not "still 0"
    const atCost = reduce(one, tick(left(one) - skipSeconds * 1000))
    const ended = reduce(atCost, SKIP)
    expect(ended).toStrictEqual(roundEndOf(atCost))
    expect(ended.questionIndex).toBe(1)
  })

  test('extraction #10: the reveal carries the current question’s `a` and `f`', () => {
    const answerKey = reveals[0]?.answer ?? ''
    const factKey = reveals[0]?.fact ?? ''
    const live = reduce(ticks(started(), 10), SKIP) // on the pool's second question, not its first
    const q = currentQuestion(live)
    expect(q).toBe(POOL[1])
    const { reveal } = reduce(live, CORRECT)
    expect(reveal).toStrictEqual({ answer: field(q, answerKey), fact: field(q, factKey) })
    expect(reveal?.answer).not.toBe(reveal?.fact)
  })

  test('extraction #11: displaySeconds rounds up, as the prototype’s clock faces do', () => {
    // Unknown names map to a function that matches nothing, so they fail below.
    const faces = clockFaces.map(({ round }) => ROUNDING.get(round) ?? (() => NaN))
    // Every tenth of a second the longest bank can show, and the edges between.
    const samples = [1, 999, 1001, 44_001]
    for (let ms = 0; ms <= num(roundSecondsDeclared.max) * 1000; ms += 100) samples.push(ms)
    const mismatches = faces.flatMap((face) =>
      samples.filter((ms) => !Object.is(displaySeconds(ms), face(ms / 1000))),
    )
    expect({ checked: faces.length * samples.length, mismatches }).toStrictEqual({
      checked: 2 * 905,
      mismatches: [],
    })
  })

  test('extraction #12: ROUND_SECONDS_DEFAULT and ROUND_SECONDS_OPTIONS are data-props’ roundSeconds, and createRoom keeps to them', () => {
    const def = num(roundSecondsDeclared.default)
    const min = num(roundSecondsDeclared.min)
    const max = num(roundSecondsDeclared.max)
    const step = num(roundSecondsDeclared.step)
    expect(ROUND_SECONDS_DEFAULT).toBe(def)
    expect(step).toBeGreaterThan(0) // so the loop below ends
    const range: number[] = []
    for (let v = min; v <= max; v += step) range.push(v)
    expect(ROUND_SECONDS_OPTIONS).toStrictEqual(range)

    // The engine: no configuration means the default; every value in range is
    // accepted with a bank of that many seconds; outside it or off the step, rejected.
    const room = createRoom(ROOM)
    expect([room.config.roundSeconds, room.clock.banks.a.ms, room.clock.banks.b.ms]).toStrictEqual([
      def,
      def * 1000,
      def * 1000,
    ])
    expect(
      range.map((v) => createRoom({ ...ROOM, config: { roundSeconds: v } }).clock.banks.a.ms),
    ).toStrictEqual(range.map((v) => v * 1000))
    for (const v of [min - step, max + step, def - 1, def + 1]) {
      expect(() => createRoom({ ...ROOM, config: { roundSeconds: v } })).toThrow(RangeError)
    }
  })

  test('extraction #13: WINS_NEEDED_DEFAULT and WINS_NEEDED_OPTIONS are data-props’ winsNeeded, and createRoom keeps to them', () => {
    // The prototype declares them as strings and reads them through Number(…).
    const def = Number(winsNeededDeclared.default)
    const options = strings(winsNeededDeclared.options).map(Number)
    expect(WINS_NEEDED_DEFAULT).toBe(def)
    expect(WINS_NEEDED_OPTIONS).toStrictEqual(options)

    expect(createRoom(ROOM).config.winsNeeded).toBe(def)
    expect(
      options.map((n) => createRoom({ ...ROOM, config: { winsNeeded: n } }).config.winsNeeded),
    ).toStrictEqual(options)
    for (const n of [Math.min(...options) - 1, Math.max(...options) + 1]) {
      expect(() => createRoom({ ...ROOM, config: { winsNeeded: n } })).toThrow(RangeError)
    }
  })
})
