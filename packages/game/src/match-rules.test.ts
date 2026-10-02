import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { describe, expect, test } from 'vitest'

import { otherTeam, passClock, remainingMs, roundMs } from './clock.js'
import { drawableCategories, drawCategory, unusedCategories } from './draw.js'
import { beginRound, nextJudgeIndex, scoreRound, startingTeam } from './match.js'
import { reduce } from './reducer.js'
import { REVEAL_HOLD_MS, WINS_NEEDED_OPTIONS } from './rules.js'
import { categoryIds, categoryQuestions, readyRoom } from './testing/rooms.js'
import type { ReadyRoomSetup } from './testing/rooms.js'
import type { Action, CategoryId, ClockState, RoomState, Screen, Team, TeamBank } from './types.js'

// REQ-4.12 — specs/phase-4/verification.md Gate 4, "The flow, read from the
// prototype". See specs/phase-4/requirements.md REQ-4.12 and specs.md §2.11
// (this file's row).
//
// Phase 3's rules.test.ts read a round's numbers from the prototype; this file
// reads the match flow's. The flow is not remembered: each of the seventeen
// extractions of Gate 4's table is read from
// design/designs/Nel3ab - Arcade.dc.html when the test runs, and asserted four
// ways:
//   1. its MATCH COUNT, against the table's Count column — so an extraction
//      that finds nothing fails, rather than passing vacuously;
//   2. its value, against the plan's pre-registered value — the table's Value
//      column where it gives one, otherwise the literals of the table's own
//      snippet (for #16, the screens that specs.md §2.10's generator table
//      gives each flow button);
//   3. against the engine's own rule — a constant, an internal helper or the
//      reducer — over a set of probes, with the EXTRACTED value applied to the
//      same probes;
//   4. driving the engine as the table's Drives column says: the reducer runs,
//      and its result is compared with what the extracted value says it should
//      be — never with a number written into this file.
//
// #15, the prototype's shuffle, is the one row the table itself sets apart.
// The engine departs from it by decision (REQ-4.2, DECIDED 2026-10-02), so it
// has no engine value to equal; and what it drives is Gate 2's 🚦 premise box,
// which verification.md's "Gate ordering" evaluates once, AFTER this box has
// pinned the line. Here the line is pinned character for character and is not
// run.
//
// design/ is never edited (CLAUDE.md invariant 5, NFR-4.1), so this file can go
// red only by the engine drifting — never by the reference moving.
//
// The readers are Phase 3's (rules.test.ts): small regular expressions over the
// prototype's one logic script, its component class split into members, and —
// for #16 — the markup's screen blocks; no HTML or JavaScript parser. Paths
// resolve from import.meta.url, not process.cwd(): each Vitest project sets its
// own `root`. The prototype's file name has spaces, which `URL` percent-encodes
// and fileURLToPath decodes.
//
// Every match starts from testing/rooms.ts's readyRoom, which stands in for
// Phase 5's setup. Every category and question is synthetic: nothing is copied
// from design/.

const read = (relativeToRepoRoot: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8')

const PROTOTYPE = read('design/designs/Nel3ab - Arcade.dc.html')

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

// --- the prototype's logic script, its component class and its members --------

/** `<script type="text/x-dc" …>…</script>`: the prototype's one logic script. */
const SCRIPTS = all(PROTOTYPE, /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/g)
const script = SCRIPTS[0]?.[1] ?? ''

/** The component class, from its header to the `}` alone on a line that closes it. */
const CLASSES = all(script, /^class Component extends DCLogic \{\n([\s\S]*?)^\}$/gm)
const classBody = CLASSES[0]?.[1] ?? ''

/** A class member's first line, exactly as Phase 3's reader defines it (rules.test.ts). */
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

/** Every match of `pattern` inside the class, with the member it falls in, in source order. */
const inMembers = (
  pattern: RegExp,
): { readonly member: string; readonly match: RegExpExecArray }[] =>
  [...members].flatMap(([name, body]) =>
    all(body, pattern).map((match) => ({ member: name, match })),
  )

/** The members whose bodies this file reads. */
const MEMBERS_READ = [
  'drawCategory',
  'endRound',
  'goWheel',
  'markCorrect',
  'nextRound',
  'passTurn',
  'rematch',
  'remaining',
  'renderVals',
  'resetAll',
  'startRound',
  'startingTeam',
]

// --- the patterns, one per extraction (verification.md Gate 4's table) ----------

/** #1 — the reveal's timer, `setTimeout(() => this.passTurn(), N)`, capturing N. */
const HOLD = /setTimeout\(\s*\(\s*\)\s*=>\s*this\.passTurn\(\s*\)\s*,\s*(\d+)\s*\)/g
/** #2 — `this.state.round % M === R ? 'x' : 'y'`. */
const PARITY = /this\.state\.round\s*%\s*(\d+)\s*===\s*(\d+)\s*\?\s*'([ab])'\s*:\s*'([ab])'/g
/** #3, #4 — `s.rotateJudge ? (s.judgeIdx + K) % Math.max(F, s.players.length) : E`. */
const ROTATION =
  /s\.rotateJudge\s*\?\s*\(\s*s\.judgeIdx\s*\+\s*(\d+)\s*\)\s*%\s*Math\.max\(\s*(\d+)\s*,\s*s\.players\.length\s*\)\s*:\s*([\w.]+)/g
/** #4 — the judge's index, named anywhere. */
const JUDGE = /\bjudgeIdx\b/g
/** #5 — the draw's list: `this.remaining.length ? this.X : this.Y`. */
const FALLBACK = /this\.remaining\.length\s*\?\s*this\.([\w.]+)\s*:\s*this\.([\w.]+)/g
/** #6 — the pick: `pool[Math.F(Math.random() * pool.length)]`. */
const PICK = /pool\[\s*Math\.(\w+)\(\s*Math\.random\(\)\s*\*\s*pool\.length\s*\)\s*\]/g
/** #7 — the `remaining` getter: `this.state.X.filter(i => !this.state.Y.includes(i))`. */
const REMAINING =
  /this\.state\.(\w+)\.filter\(\s*(\w+)\s*=>\s*!this\.state\.(\w+)\.includes\(\s*\2\s*\)\s*\)/g
/** #8 — endRound's test; the third clause, exhaustion, is captured so its absence shows as a value. */
const DONE =
  /tallyA\s*(>=|>|===|==)\s*this\.winsNeeded\s*\|\|\s*tallyB\s*(>=|>|===|==)\s*this\.winsNeeded(\s*\|\|\s*this\.remaining\.length\s*===\s*0)?/g
/** #9 — `loserKey === 'x' ? 'y' : 'z'`. */
const WINNER = /loserKey\s*===\s*'([ab])'\s*\?\s*'([ab])'\s*:\s*'([ab])'/g
/** #10 — the entry endRound appends, `log: [...s.log, {…}]`, capturing the object's body. */
const LOG_ENTRY = /log\s*:\s*\[\s*\.\.\.s\.log\s*,\s*\{([^}]*)\}\s*\]/g
/** #11 — passTurn's next bank: `X.started ? Y : {time:this.Z, started:B}`. */
const NEXT_BANK =
  /(\w+)\.started\s*\?\s*(\w+)\s*:\s*\{\s*time\s*:\s*this\.(\w+)\s*,\s*started\s*:\s*(true|false)\s*\}/g
/** #12 — passTurn's indices: `qi: this.state.qi + K, hintIdx:H, reveal:R`. */
const PASS_INDICES =
  /qi\s*:\s*this\.state\.qi\s*\+\s*(\d+)\s*,\s*hintIdx\s*:\s*(\d+)\s*,\s*reveal\s*:\s*(\w+)/g
/** #13, #14 — a `this.setState({…})` whose argument is one flat object literal, capturing its body. */
const SET_STATE = /this\.setState\(\s*\{([^{}]*)\}/g
/** #15 — the shuffle's declaration: the whole line, character for character. */
const SHUFFLE = /^const shuffle\b[^\r\n]*/gm
/** #16 — a button's binding, `onClick="{{ method }}"`. */
const ON_CLICK = /onClick="\{\{\s*(\w+)\s*\}\}"/g
/** #17 — startRound's used list: `usedCats: s.usedCats.includes(s.catIdx) ? X : [Y]`. */
const APPEND_ONCE =
  /usedCats\s*:\s*s\.usedCats\.includes\(\s*s\.catIdx\s*\)\s*\?\s*([\w.]+)\s*:\s*(\[[^\]]*\])/g

// --- #16's screens: the markup's host screen blocks ----------------------------
// renderVals names, for each host screen, the flag that shows it
// (`isReady: host && s.screen === 'ready'`); the markup wraps each screen in
// `<sc-if value="{{ isReady }}" …>`. A screen's block runs to the `</sc-if>` at
// the opening tag's own indentation, so a nested `<sc-if>` (the reveal, inside
// play) cannot close it early.

const SCREEN_FLAG = /(is\w+)\s*:\s*host\s*&&\s*s\.screen\s*===\s*'(\w+)'/g
const SCREEN_FLAGS: ReadonlyMap<string, string> = new Map(
  all(member('renderVals'), SCREEN_FLAG).map((m) => [group(m, 1), group(m, 2)]),
)
const SC_IF_BLOCK = /^( *)<sc-if value="\{\{ (\w+) \}\}"[^>]*>([\s\S]*?)^\1<\/sc-if>/gm
const SCREEN_BLOCKS = all(PROTOTYPE, SC_IF_BLOCK).flatMap((m) => {
  const screen = SCREEN_FLAGS.get(group(m, 2))
  return screen === undefined ? [] : [{ screen, body: group(m, 3) }]
})

/** The engine action behind each flow button (requirements.md, reading 2). */
type FlowAction = 'startMatch' | 'nextRound' | 'resetMatch'
const FLOW: ReadonlyMap<string, FlowAction> = new Map([
  ['goWheel', 'startMatch'],
  ['nextRound', 'nextRound'],
  ['rematch', 'startMatch'],
  ['resetAll', 'resetMatch'],
])
const FLOW_METHODS = [...FLOW.keys()]
const FLOW_ACTIONS: readonly FlowAction[] = ['startMatch', 'nextRound', 'resetMatch']
const SCREENS: readonly Screen[] = ['setup', 'ready', 'play', 'roundEnd', 'match']
const TEAMS: readonly Team[] = ['a', 'b']

/** Each flow button in a host screen's block, in file order. */
const bindings = SCREEN_BLOCKS.flatMap(({ screen, body }) =>
  all(body, ON_CLICK)
    .map((m) => group(m, 1))
    .filter((method) => FLOW.has(method))
    .map((method) => ({ screen, method })),
)
const flowButtons = all(PROTOTYPE, ON_CLICK)
  .map((m) => group(m, 1))
  .filter((method) => FLOW.has(method))
const screensOf = (method: string): string[] =>
  bindings.filter((b) => b.method === method).map((b) => b.screen)

// --- reading the prototype's expressions -----------------------------------------

/**
 * The prototype's state fields this file reads, by the RoomState field each one
 * is: the handoff contract of specs/phase-3/specs.md §2.1 (rows 5, 7–14, 20), in
 * the prototype's own spelling.
 */
const FIELDS: ReadonlyMap<string, string> = new Map([
  ['screen', 'screen'],
  ['round', 'round'],
  ['tallyA', 'tallyA'],
  ['tallyB', 'tallyB'],
  ['log', 'log'],
  ['picked', 'pickedCategories'],
  ['usedCats', 'usedCategories'],
  ['catIdx', 'categoryId'],
  ['judgeIdx', 'judgeIndex'],
  ['reveal', 'reveal'],
])
const engineField = (name: string): string => FIELDS.get(name) ?? `(no field for ${name})`

/** A log entry's keys, the prototype's → the engine's: `cat` → `category` (requirements.md, reading 3). */
const LOG_KEYS: ReadonlyMap<string, string> = new Map([
  ['n', 'n'],
  ['cat', 'category'],
  ['winner', 'winner'],
])

/** `key: expression` pairs of a flat object literal's body (no nested commas in the bodies read here). */
const entries = (body: string): (readonly [key: string, expression: string])[] =>
  body.split(',').map((part) => {
    const at = part.indexOf(':')
    return at < 0 ? [part.trim(), ''] : [part.slice(0, at).trim(), part.slice(at + 1).trim()]
  })

/**
 * A literal as the prototype writes one in a reset: a whole number, `null`,
 * `[]` or a single-quoted string. Anything else is kept as its text, so it fails
 * whichever comparison reads it.
 */
const literal = (text: string): unknown => {
  if (text === 'null') return null
  if (text === '[]') return []
  if (/^\d+$/.test(text)) return Number(text)
  const quoted = /^'([^']*)'$/.exec(text)
  return quoted === null ? { unparsed: text } : group(quoted, 1)
}

/** The object a reset's body sets, with the prototype's keys. */
const resetOf = (body: string): Record<string, unknown> =>
  Object.fromEntries(entries(body).map(([key, expression]) => [key, literal(expression)]))

/** The same object with each key renamed to the RoomState field it is. */
const asEngineFields = (o: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).map(([key, value]) => [engineField(key), value]))

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((e): e is string => typeof e === 'string') : []

/** A state's own field named `key`, or `undefined`. */
const fieldOf = (s: RoomState, key: string): unknown =>
  new Map<string, unknown>(Object.entries(s)).get(key)
const fieldsOf = (s: RoomState, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((key) => [key, fieldOf(s, key)]))

/** The rounding functions a pick could use, by the name it is written with. */
const ROUNDING: ReadonlyMap<string, (x: number) => number> = new Map([
  ['ceil', Math.ceil],
  ['floor', Math.floor],
  ['round', Math.round],
  ['trunc', Math.trunc],
])

/** The comparisons a match-end test could use, by the operator it is written with. */
const COMPARE: ReadonlyMap<string, (x: number, y: number) => boolean> = new Map([
  ['>=', (x: number, y: number) => x >= y],
  ['>', (x: number, y: number) => x > y],
  ['===', (x: number, y: number) => x === y],
  ['==', (x: number, y: number) => x === y],
])
const unknownComparison = (): boolean => false

// --- the extracted values ----------------------------------------------------------

const holds = all(PROTOTYPE, HOLD).map((m) => Number(group(m, 1)))

const parities = inMembers(PARITY).map(({ member: name, match }) => ({
  member: name,
  modulus: Number(group(match, 1)),
  remainder: Number(group(match, 2)),
  then: group(match, 3),
  otherwise: group(match, 4),
}))

const rotations = all(PROTOTYPE, ROTATION).map((m) => ({
  step: Number(group(m, 1)),
  atLeast: Number(group(m, 2)),
  otherwise: group(m, 3),
}))
const rotatingMembers = inMembers(ROTATION).map(({ member: name }) => name)
const rematchJudgeMentions = all(member('rematch'), JUDGE).length

const fallbacks = inMembers(FALLBACK).map(({ member: name, match }) => ({
  member: name,
  whenAny: group(match, 1),
  whenNone: group(match, 2),
}))

const picks = inMembers(PICK).map(({ member: name, match }) => ({
  member: name,
  round: group(match, 1),
}))

const remainders = inMembers(REMAINING).map(({ member: name, match }) => ({
  member: name,
  from: group(match, 1),
  without: group(match, 3),
}))

const matchEnds = inMembers(DONE).map(({ member: name, match }) => ({
  member: name,
  a: group(match, 1),
  b: group(match, 2),
  exhaustion: match[3] !== undefined,
}))

const winners = inMembers(WINNER).map(({ member: name, match }) => ({
  member: name,
  when: group(match, 1),
  then: group(match, 2),
  otherwise: group(match, 3),
}))

const logEntries = inMembers(LOG_ENTRY).map(({ member: name, match }) => ({
  member: name,
  fields: entries(group(match, 1)),
}))
const logFields = logEntries[0]?.fields ?? []
const logKeys = logFields.map(([key]) => key)

const nextBanks = inMembers(NEXT_BANK).map(({ member: name, match }) => ({
  member: name,
  tested: group(match, 1),
  kept: group(match, 2),
  refill: group(match, 3),
  started: group(match, 4) === 'true',
}))

const passIndices = all(member('passTurn'), PASS_INDICES).map((m) => ({
  qiStep: Number(group(m, 1)),
  hintIdx: Number(group(m, 2)),
  reveal: literal(group(m, 3)),
}))

const rematchResets = all(member('rematch'), SET_STATE).map((m) => resetOf(group(m, 1)))
const rematchReset = rematchResets[0] ?? {}

const resetAllResets = all(member('resetAll'), SET_STATE).map((m) => resetOf(group(m, 1)))
const resetAllReset = resetAllResets[0] ?? {}

const shuffles = all(PROTOTYPE, SHUFFLE).map((m) => m[0])

const appendOnce = all(member('startRound'), APPEND_ONCE).map((m) => ({
  whenUsed: group(m, 1),
  otherwise: group(m, 2),
}))

// --- the extracted values, applied — the prototype's rule as a function ------------

const protoStartingTeam = (round: number): string => {
  const [p] = parities
  if (p === undefined) return '(no parity)'
  return round % p.modulus === p.remainder ? p.then : p.otherwise
}

const protoNextJudge = (rotate: boolean, judge: number, players: number): number => {
  const [r] = rotations
  if (r === undefined) return NaN
  if (rotate) return (judge + r.step) % Math.max(r.atLeast, players)
  return r.otherwise === 's.judgeIdx' ? judge : NaN
}

/** The `remaining` getter: the selected categories not used, in the order the source list has them. */
const protoRemaining = (s: RoomState): string[] => {
  const [r] = remainders
  if (r === undefined) return ['(no remaining)']
  const excluded = strings(fieldOf(s, engineField(r.without)))
  return strings(fieldOf(s, engineField(r.from))).filter((id) => !excluded.includes(id))
}

/** One of drawCategory's list expressions, `remaining` or `state.<field>`. */
const protoList = (s: RoomState, expression: string): string[] => {
  if (expression === 'remaining') return protoRemaining(s)
  const [scope, name = ''] = expression.split('.')
  return scope === 'state' ? strings(fieldOf(s, engineField(name))) : [`(unread ${expression})`]
}

/** drawCategory's list: `this.remaining.length ? … : …`. */
const protoChoices = (s: RoomState): string[] => {
  const [f] = fallbacks
  if (f === undefined) return ['(no fallback)']
  return protoRemaining(s).length > 0 ? protoList(s, f.whenAny) : protoList(s, f.whenNone)
}

/** drawCategory's pick, with `r` where the prototype calls its random source. */
const protoPick = (list: readonly string[], r: number): string | undefined => {
  const round = ROUNDING.get(picks[0]?.round ?? '')
  return round === undefined ? '(no pick)' : list[round(r * list.length)]
}

const protoMatchOver = (
  tallyA: number,
  tallyB: number,
  winsNeeded: number,
  remaining: number,
): boolean => {
  const [d] = matchEnds
  if (d === undefined) return false
  return (
    (COMPARE.get(d.a) ?? unknownComparison)(tallyA, winsNeeded) ||
    (COMPARE.get(d.b) ?? unknownComparison)(tallyB, winsNeeded) ||
    (d.exhaustion && remaining === 0)
  )
}

const protoWinner = (loser: Team): string => {
  const [w] = winners
  if (w === undefined) return '(no winner)'
  return loser === w.when ? w.then : w.otherwise
}

/** What the log entry records for the round that ended in `end`, field by field. */
const protoLogEntry = (end: RoomState): Record<string, unknown> =>
  Object.fromEntries(
    logFields.map(([key, expression]) => [
      LOG_KEYS.get(key) ?? `(no key for ${key})`,
      expression === 's.round'
        ? end.round
        : // `CATS[s.catIdx].name`: the round's category — its id, reading 3
          /\bs\.catIdx\b/.test(expression)
          ? end.categoryId
          : // `winner === 'a' ? s.teamA : s.teamB`: the Team, not its name, reading 3
            /^winner\b/.test(expression)
            ? protoWinner(end.clock.active)
            : { unread: expression },
    ]),
  )

interface BankView {
  readonly ms: number
  readonly started: boolean
  /** Whether it is the very bank the team had before — kept, not rebuilt. */
  readonly same: boolean
}
const bankView = (before: TeamBank, after: TeamBank): BankView => ({
  ms: after.ms,
  started: after.started,
  same: after === before,
})

/** passTurn's next bank: `nx.started ? nx : {time:this.roundTime, started:true}`; `full` is this.roundTime. */
const protoNextBank = (bank: TeamBank, full: number): BankView => {
  const [n] = nextBanks
  if (n === undefined) return { ms: NaN, started: false, same: false }
  if (bank.started) {
    return n.kept === n.tested ? { ...bank, same: true } : { ms: NaN, started: false, same: false }
  }
  return { ms: n.refill === 'roundTime' ? full : NaN, started: n.started, same: false }
}

const protoAfterPass = (s: RoomState): Record<string, unknown> => {
  const [p] = passIndices
  if (p === undefined) return { unread: 'passTurn' }
  return { questionIndex: s.questionIndex + p.qiStep, hintIndex: p.hintIdx, reveal: p.reveal }
}

/** startRound's used list: kept as it is when the category is in it, appended once otherwise. */
const protoAppendOnce = (
  used: readonly CategoryId[],
  categoryId: CategoryId,
): { readonly used: readonly CategoryId[] | null; readonly same: boolean } => {
  const [a] = appendOnce
  const evaluate = (expression: string): readonly CategoryId[] | null => {
    if (expression === 's.usedCats') return used
    if (/^\[\s*\.\.\.s\.usedCats\s*,\s*s\.catIdx\s*\]$/.test(expression)) {
      return [...used, categoryId]
    }
    return null
  }
  if (a === undefined) return { used: null, same: false }
  const result = evaluate(used.includes(categoryId) ? a.whenUsed : a.otherwise)
  return { used: result, same: result === used }
}

// --- driving the engine ------------------------------------------------------------

/** The prototype's initial state, as a ready room — verification.md Table G's default. */
const TABLE_G_DEFAULT: ReadyRoomSetup = {
  roundSeconds: 45,
  winsNeeded: 3,
  picked: categoryIds(8),
  players: 5,
  rotateJudge: false,
  judgeIndex: 4,
}
const room = (setup: Partial<ReadyRoomSetup> = {}): RoomState =>
  readyRoom({ ...TABLE_G_DEFAULT, ...setup })

const tick = (ms: number): Action => ({ type: 'tick', ms })
const CORRECT: Action = { type: 'correct' }
const HINT: Action = { type: 'hint' }
const SKIP: Action = { type: 'skip' }
const PASS: Action = { type: 'passTurn' }
const RESET: Action = { type: 'resetMatch' }
const startMatch = (categoryId: CategoryId): Action => ({
  type: 'startMatch',
  categoryId,
  questions: categoryQuestions(categoryId),
})
const nextRound = (categoryId: CategoryId): Action => ({
  type: 'nextRound',
  categoryId,
  questions: categoryQuestions(categoryId),
})

/** What the active team has left. */
const left = (s: RoomState): number => remainingMs(s.clock, s.clock.active)
/** The active team's bank runs out: the round ends. */
const endTurn = (s: RoomState): RoomState => reduce(s, tick(left(s)))
/** The active team answers after `ms`; the reveal is held the engine's hold; the turn passes. */
const answerAndPass = (s: RoomState, ms: number): RoomState =>
  reduce(reduce(reduce(reduce(s, tick(ms)), CORRECT), tick(REVEAL_HOLD_MS)), PASS)

const last = <T>(xs: readonly T[]): T => {
  const x = xs.at(-1)
  if (x === undefined) throw new Error('an empty list')
  return x
}

/**
 * A match from `ready` whose rounds draw `categories` in order, every one lost
 * by the team that starts it — nobody answers — until the match ends or the
 * list does. Each round's state at its start and at its end.
 */
const silentMatch = (ready: RoomState, categories: readonly CategoryId[]) => {
  const rounds: { readonly start: RoomState; readonly end: RoomState }[] = []
  let s = ready
  for (const [i, categoryId] of categories.entries()) {
    if (i > 0 && s.screen !== 'roundEnd') break
    const start = reduce(s, i === 0 ? startMatch(categoryId) : nextRound(categoryId))
    s = endTurn(start)
    rounds.push({ start, end: s })
  }
  return rounds
}

/** The flow action behind a button, drawn as a driver draws it: the engine's helpers, the first choice. */
const flowAction = (kind: FlowAction, s: RoomState): Action => {
  if (kind === 'resetMatch') return RESET
  const categoryId = drawCategory(drawableCategories(s), () => 0)
  return { type: kind, categoryId, questions: categoryQuestions(categoryId) }
}

/**
 * One state on each of the five screens, every one reached by actions, from a
 * ready room with two categories: a round in play, its end, the match's end
 * (both categories used, 1–1) and setup (back from the match's end).
 */
const flowStates = (setup: Partial<ReadyRoomSetup> = {}): ReadonlyMap<string, RoomState> => {
  const ready = room({ picked: ['c0', 'c1'], ...setup })
  const play = reduce(ready, startMatch('c0'))
  const roundEnd = endTurn(play)
  const match = endTurn(reduce(roundEnd, nextRound('c1')))
  const setupScreen = reduce(match, RESET)
  return new Map<string, RoomState>([
    ['setup', setupScreen],
    ['ready', ready],
    ['play', play],
    ['roundEnd', roundEnd],
    ['match', match],
  ])
}
/** The state on `screen`; each is checked to be on it by the extraction #16 comparisons. */
const stateOn = (states: ReadonlyMap<string, RoomState>, screen: string): RoomState => {
  const s = states.get(screen)
  if (s === undefined) throw new Error(`no state on ${screen}`)
  return s
}

/** A round end's state, hand-built from a real one: picked `picked`, used `used`. */
const roundEndWith = (picked: readonly CategoryId[], used: readonly CategoryId[]): RoomState => {
  const [first = ''] = picked
  return { ...endTurn(reduce(room({ picked }), startMatch(first))), usedCategories: used }
}

/** The largest double below 1: the top of the range a random source may return. */
const LARGEST_BELOW_ONE = 1 - 2 ** -53
/** The probes of a pick from `length` items: each item's middle, and both ends of [0, 1). */
const probes = (length: number): number[] => [
  0,
  ...Array.from({ length }, (_, k) => (k + 0.5) / length),
  LARGEST_BELOW_ONE,
]

// ============================================================================
// The extraction table
// ============================================================================

/** The extracted value applied to a set of probes, beside the engine's own answer for the same probes. */
interface Comparison {
  readonly engine: unknown
  readonly prototype: unknown
}

interface Extraction {
  /** The row of verification.md Gate 4's REQ-4.12 table. */
  readonly row: number
  readonly what: string
  /** Matches found — one count per snippet the row's Count column counts. */
  readonly counts: readonly number[]
  /** The table's Count column. */
  readonly expectedCounts: readonly number[]
  readonly value: unknown
  /** The plan's pre-registered value (see the header: the table's Value column, or its snippet's literals). */
  readonly expectedValue: unknown
  /** Against the engine's rule; `null` for #15 only — the engine departs from it by decision (REQ-4.2). */
  readonly againstEngine: (() => Comparison) | null
  /** The table's Drives column, run through the reducer; `null` for #15 only — it drives Gate 2's 🚦 box. */
  readonly drive: (() => Comparison) | null
}

const EXTRACTIONS: readonly Extraction[] = [
  {
    row: 1,
    what: 'setTimeout(() => this.passTurn(), N) — the hold',
    counts: [holds.length],
    expectedCounts: [1],
    value: holds,
    expectedValue: [1000],
    againstEngine: () => ({ engine: [REVEAL_HOLD_MS], prototype: holds }),
    // REVEAL_HOLD_MS; passTurn inert at N − 1 ms, effective at N.
    drive: () => {
      const [n = NaN] = holds
      const revealed = reduce(reduce(reduce(room(), startMatch('c0')), tick(3_700)), CORRECT)
      const after = (elapsed: number) => {
        const held = reduce(revealed, tick(elapsed))
        const passed = reduce(held, PASS)
        return { elapsed, inert: passed === held, active: passed.clock.active }
      }
      return {
        engine: [after(n - 1), after(n)],
        // The prototype's timer has not fired at N − 1 — a still answering; at N it has — b's turn.
        prototype: [
          { elapsed: n - 1, inert: true, active: 'a' },
          { elapsed: n, inert: false, active: 'b' },
        ],
      }
    },
  },
  {
    row: 2,
    what: "this.state.round % 2 === 1 ? 'a' : 'b' in startingTeam",
    counts: [all(member('startingTeam'), PARITY).length],
    expectedCounts: [1],
    value: parities,
    expectedValue: [
      { member: 'startingTeam', modulus: 2, remainder: 1, then: 'a', otherwise: 'b' },
    ],
    againstEngine: () => {
      const rounds = Array.from({ length: 8 }, (_, i) => i + 1)
      return {
        engine: rounds.map((round) => startingTeam(round)),
        prototype: rounds.map(protoStartingTeam),
      }
    },
    // The starting team of rounds 1 … 4.
    drive: () => {
      const rounds = silentMatch(room(), ['c0', 'c1', 'c2', 'c3'])
      return {
        engine: rounds.map(({ start }) => ({
          round: start.round,
          active: start.clock.active,
          started: [start.clock.banks.a.started, start.clock.banks.b.started],
        })),
        prototype: [1, 2, 3, 4].map((round) => {
          const team = protoStartingTeam(round)
          return { round, active: team, started: [team === 'a', team === 'b'] }
        }),
      }
    },
  },
  {
    row: 3,
    what: '(s.judgeIdx + 1) % Math.max(1, s.players.length) behind s.rotateJudge ?',
    counts: [rotations.length],
    expectedCounts: [1],
    value: rotations,
    expectedValue: [{ step: 1, atLeast: 1, otherwise: 's.judgeIdx' }],
    againstEngine: () => {
      const cases = [0, 1, 2, 3, 4, 5, 6].flatMap((players) =>
        Array.from({ length: Math.max(1, players) }, (_, judge) => judge).flatMap((judge) =>
          [false, true].map((rotate) => ({ players, judge, rotate })),
        ),
      )
      return {
        engine: cases.map((c) => ({
          ...c,
          next: nextJudgeIndex(
            room({ players: c.players, judgeIndex: c.judge, rotateJudge: c.rotate }),
          ),
        })),
        prototype: cases.map((c) => ({ ...c, next: protoNextJudge(c.rotate, c.judge, c.players) })),
      }
    },
    // nextRound's judge for players 0 and 5, the judge at the last index.
    drive: () => {
      const cases = [
        { players: 0, judge: 0 },
        { players: 5, judge: 4 },
      ].flatMap((c) => [true, false].map((rotate) => ({ ...c, rotate })))
      return {
        engine: cases.map((c) => {
          const ended = endTurn(
            reduce(
              room({ players: c.players, judgeIndex: c.judge, rotateJudge: c.rotate }),
              startMatch('c0'),
            ),
          )
          return { ...c, next: reduce(ended, nextRound('c1')).judgeIndex }
        }),
        prototype: cases.map((c) => ({ ...c, next: protoNextJudge(c.rotate, c.judge, c.players) })),
      }
    },
  },
  {
    row: 4,
    what: 'the rotation appears only in nextRound; rematch’s body names no judgeIdx',
    counts: [all(member('nextRound'), ROTATION).length, rematchJudgeMentions],
    expectedCounts: [1, 0],
    value: rotatingMembers,
    expectedValue: ['nextRound'],
    // Which flow buttons move the judge: in the prototype, the methods that name
    // judgeIdx at all; in the engine, the actions behind them that change it, on
    // the screens where the prototype shows their buttons, with rotation on.
    againstEngine: () => {
      const states = flowStates({ rotateJudge: true, judgeIndex: 2 })
      return {
        engine: FLOW_METHODS.filter((method) =>
          screensOf(method).some((screen) => {
            const s = stateOn(states, screen)
            const kind = FLOW.get(method) ?? 'resetMatch'
            return reduce(s, flowAction(kind, s)).judgeIndex !== s.judgeIndex
          }),
        ),
        prototype: FLOW_METHODS.filter((method) => all(member(method), JUDGE).length > 0),
      }
    },
    // A rematch keeps the judge.
    drive: () => {
      const finished = last(
        silentMatch(room({ rotateJudge: true }), ['c0', 'c1', 'c2', 'c3', 'c4']),
      ).end
      const rematched = reduce(finished, startMatch('c7'))
      return {
        engine: { screen: finished.screen, judge: rematched.judgeIndex },
        prototype: {
          screen: 'match',
          judge:
            rematchJudgeMentions === 0
              ? finished.judgeIndex
              : protoNextJudge(true, finished.judgeIndex, finished.players.length),
        },
      }
    },
  },
  {
    row: 5,
    what: 'this.remaining.length ? this.remaining : this.state.picked',
    counts: [all(PROTOTYPE, FALLBACK).length],
    expectedCounts: [1],
    value: fallbacks,
    expectedValue: [{ member: 'drawCategory', whenAny: 'remaining', whenNone: 'state.picked' }],
    againstEngine: () => {
      const picked = ['c3', 'c0', 'c5', 'c1']
      const states = [[], ['c5', 'c3'], ['c1', 'c0', 'c3'], picked, ['c1', 'c5', 'c0', 'c3']].map(
        (used) => roundEndWith(picked, used),
      )
      return {
        engine: states.map((s) => drawableCategories(s)),
        prototype: states.map(protoChoices),
      }
    },
    // The fallback of drawableCategories: every selected category used, so every
    // selected one may be drawn — and, beside it, a list with some unused.
    drive: () => {
      const picked = ['c3', 'c0', 'c5', 'c1']
      const states = [roundEndWith(picked, ['c1', 'c5', 'c0', 'c3']), roundEndWith(picked, ['c3'])]
      const rs = (s: RoomState) => probes(protoChoices(s).length)
      return {
        engine: states.map((s) =>
          rs(s).map(
            (r) => reduce(s, nextRound(drawCategory(drawableCategories(s), () => r))).categoryId,
          ),
        ),
        prototype: states.map((s) => rs(s).map((r) => protoPick(protoChoices(s), r))),
      }
    },
  },
  {
    row: 6,
    what: 'pool[Math.floor(Math.random() * pool.length)]',
    counts: [all(PROTOTYPE, PICK).length],
    expectedCounts: [1],
    value: picks,
    expectedValue: [{ member: 'drawCategory', round: 'floor' }],
    againstEngine: () => {
      const cases = Array.from({ length: 11 }, (_, i) => categoryIds(i + 1)).flatMap((list) =>
        probes(list.length).map((r) => ({ list, r })),
      )
      return {
        engine: cases.map(({ list, r }) => drawCategory(list, () => r)),
        prototype: cases.map(({ list, r }) => protoPick(list, r)),
      }
    },
    // drawCategory against the same r: the round startMatch begins, on ready.
    drive: () => {
      const ready = room()
      const rs = probes(protoChoices(ready).length)
      return {
        engine: rs.map(
          (r) =>
            reduce(ready, startMatch(drawCategory(drawableCategories(ready), () => r))).categoryId,
        ),
        prototype: rs.map((r) => protoPick(protoChoices(ready), r)),
      }
    },
  },
  {
    row: 7,
    what: 'this.state.picked.filter(i => !this.state.usedCats.includes(i))',
    counts: [all(PROTOTYPE, REMAINING).length],
    expectedCounts: [1],
    value: remainders,
    expectedValue: [{ member: 'remaining', from: 'picked', without: 'usedCats' }],
    againstEngine: () => {
      const picked = ['c3', 'c0', 'c5', 'c1']
      const states = [[], ['c5', 'c3'], ['c1'], ['c1', 'c5', 'c0', 'c3'], ['c9']].map((used) => ({
        ...room({ picked }),
        usedCategories: used,
      }))
      return {
        engine: states.map((s) => unusedCategories(s)),
        prototype: states.map(protoRemaining),
      }
    },
    // The order of drawableCategories: c5 then c3 used from the selection c3, c0,
    // c5, c1 — by actions — leaves c0, c1, in selection order, and each is drawn
    // by the r that picks its position.
    drive: () => {
      const firstEnd = endTurn(reduce(room({ picked: ['c3', 'c0', 'c5', 'c1'] }), startMatch('c5')))
      const s = endTurn(reduce(firstEnd, nextRound('c3')))
      const order = protoRemaining(s)
      const rs = order.map((_, k) => (k + 0.5) / order.length)
      return {
        engine: {
          screen: s.screen,
          drawable: drawableCategories(s),
          drawn: rs.map(
            (r) => reduce(s, nextRound(drawCategory(drawableCategories(s), () => r))).categoryId,
          ),
        },
        prototype: { screen: 'roundEnd', drawable: order, drawn: order },
      }
    },
  },
  {
    row: 8,
    what: 'tallyA >= this.winsNeeded || tallyB >= this.winsNeeded || this.remaining.length === 0',
    counts: [all(PROTOTYPE, DONE).length],
    expectedCounts: [1],
    value: matchEnds,
    expectedValue: [{ member: 'endRound', a: '>=', b: '>=', exhaustion: true }],
    // Every tally a round can end from, at each wins-needed option, either team
    // losing, with 0, 1 or 2 categories left unused — scored by scoreRound.
    againstEngine: () => {
      const cases = WINS_NEEDED_OPTIONS.flatMap((winsNeeded) =>
        Array.from({ length: winsNeeded * winsNeeded }, (_, i) => ({
          winsNeeded,
          tallyA: Math.floor(i / winsNeeded),
          tallyB: i % winsNeeded,
        })).flatMap((c) =>
          TEAMS.flatMap((loser) => [0, 1, 2].map((unused) => ({ ...c, loser, unused }))),
        ),
      )
      const picked = categoryIds(4)
      return {
        engine: cases.map((c) => {
          const live = reduce(room({ winsNeeded: c.winsNeeded, picked }), startMatch('c0'))
          const clock: ClockState = { ...live.clock, active: c.loser }
          return scoreRound({
            ...live,
            tallyA: c.tallyA,
            tallyB: c.tallyB,
            usedCategories: picked.slice(0, picked.length - c.unused),
            clock,
          }).screen
        }),
        prototype: cases.map((c) => {
          const winner = protoWinner(c.loser)
          const tallyA = c.tallyA + (winner === 'a' ? 1 : 0)
          const tallyB = c.tallyB + (winner === 'b' ? 1 : 0)
          return protoMatchOver(tallyA, tallyB, c.winsNeeded, c.unused) ? 'match' : 'roundEnd'
        }),
      }
    },
    // match vs roundEnd, at every round end of six silent matches: wins needed
    // 2, 3 and 4 over eight categories, and 2 and 3 over two, and 3 over one.
    drive: () => {
      const matches = [
        [2, 8],
        [3, 8],
        [4, 8],
        [2, 2],
        [3, 2],
        [3, 1],
      ].map(([winsNeeded = NaN, k = NaN]) =>
        silentMatch(room({ winsNeeded, picked: categoryIds(k) }), categoryIds(k)).map(
          ({ end }) => end,
        ),
      )
      return {
        engine: matches.map((ends) => ends.map((end) => end.screen)),
        prototype: matches.map((ends) =>
          ends.map((end) =>
            protoMatchOver(
              end.tallyA,
              end.tallyB,
              end.config.winsNeeded,
              protoRemaining(end).length,
            )
              ? 'match'
              : 'roundEnd',
          ),
        ),
      }
    },
  },
  {
    row: 9,
    what: "loserKey === 'a' ? 'b' : 'a'",
    counts: [all(PROTOTYPE, WINNER).length],
    expectedCounts: [1],
    value: winners,
    expectedValue: [{ member: 'endRound', when: 'a', then: 'b', otherwise: 'a' }],
    againstEngine: () => ({
      engine: TEAMS.map((loser) => otherTeam(loser)),
      prototype: TEAMS.map(protoWinner),
    }),
    // The log's winner: a loses round 1 and b round 2, each the team that started;
    // in round 3 b loses after a answered and passed it the turn.
    drive: () => {
      const e1 = endTurn(reduce(room(), startMatch('c0')))
      const e2 = endTurn(reduce(e1, nextRound('c1')))
      const e3 = endTurn(answerAndPass(reduce(e2, nextRound('c2')), 1_000))
      const ends = [e1, e2, e3]
      return {
        engine: ends.map((e) => ({ loser: e.clock.active, winner: e.log.at(-1)?.winner })),
        prototype: ends.map((e) => ({
          loser: e.clock.active,
          winner: protoWinner(e.clock.active),
        })),
      }
    },
  },
  {
    row: 10,
    what: 'the log entry {n: s.round, cat: …, winner: …}',
    counts: [logEntries.length],
    expectedCounts: [1],
    value: logEntries.map(({ member: name, fields }) => ({
      member: name,
      keys: fields.map(([key]) => key),
      n: fields.find(([key]) => key === 'n')?.[1],
    })),
    expectedValue: [{ member: 'endRound', keys: ['n', 'cat', 'winner'], n: 's.round' }],
    againstEngine: () => {
      const [entry] = endTurn(reduce(room(), startMatch('c0'))).log
      return {
        engine: Object.keys(entry ?? {}),
        prototype: logKeys.map((key) => LOG_KEYS.get(key) ?? `(no key for ${key})`),
      }
    },
    // RoundLogEntry's 3 keys, and what each records, over a five-round match.
    drive: () => {
      const rounds = silentMatch(room(), categoryIds(5))
      return {
        engine: last(rounds).end.log,
        prototype: rounds.map(({ end }) => protoLogEntry(end)),
      }
    },
  },
  {
    row: 11,
    what: 'nx.started ? nx : {time:this.roundTime, started:true}',
    counts: [all(PROTOTYPE, NEXT_BANK).length],
    expectedCounts: [1],
    value: nextBanks,
    expectedValue: [
      { member: 'passTurn', tested: 'nx', kept: 'nx', refill: 'roundTime', started: true },
    ],
    againstEngine: () => {
      const full = 45_000
      const clockWith = (b: TeamBank): ClockState => ({
        now: 9_000,
        active: 'a',
        runningSince: null,
        banks: { a: { ms: 41_300, started: true }, b },
      })
      const banks: TeamBank[] = [
        { ms: full, started: false },
        { ms: 12_300, started: true },
      ]
      return {
        engine: banks.map((b) => bankView(b, passClock(clockWith(b), full).banks.b)),
        prototype: banks.map((b) => protoNextBank(b, full)),
      }
    },
    // The first-turn and later-turn banks: b's first turn, then a's second.
    drive: () => {
      const live = reduce(room(), startMatch('c0'))
      const full = roundMs(live.config)
      const toB = answerAndPass(live, 2_000)
      const toA = answerAndPass(toB, 5_000)
      return {
        engine: [
          bankView(live.clock.banks.b, toB.clock.banks.b),
          bankView(toB.clock.banks.a, toA.clock.banks.a),
        ],
        prototype: [
          protoNextBank(live.clock.banks.b, full),
          protoNextBank(toB.clock.banks.a, full),
        ],
      }
    },
  },
  {
    row: 12,
    what: 'qi: this.state.qi + 1, hintIdx:0, reveal:null in passTurn',
    counts: [passIndices.length],
    expectedCounts: [1],
    value: passIndices,
    expectedValue: [{ qiStep: 1, hintIdx: 0, reveal: null }],
    againstEngine: () => {
      const held = reduce(
        reduce(reduce(reduce(reduce(room(), startMatch('c0')), SKIP), HINT), CORRECT),
        tick(REVEAL_HOLD_MS),
      )
      const passed = reduce(held, PASS)
      return {
        engine: {
          questionIndex: passed.questionIndex,
          hintIndex: passed.hintIndex,
          reveal: passed.reveal,
        },
        prototype: protoAfterPass(held),
      }
    },
    // The indices after a pass, three passes in one round: from question 1 with a
    // hint, from question 2 with both its hints, from question 4 after a skip.
    drive: () => {
      const passes: RoomState[] = []
      const passFrom = (s: RoomState): RoomState => {
        const held = reduce(reduce(s, CORRECT), tick(REVEAL_HOLD_MS))
        passes.push(held)
        return reduce(held, PASS)
      }
      const live = reduce(room(), startMatch('c0'))
      const first = passFrom(reduce(reduce(live, SKIP), HINT))
      const second = passFrom(reduce(reduce(first, HINT), HINT))
      const third = passFrom(reduce(second, SKIP))
      return {
        engine: [first, second, third].map((s) => ({
          questionIndex: s.questionIndex,
          hintIndex: s.hintIndex,
          reveal: s.reveal,
        })),
        prototype: passes.map(protoAfterPass),
      }
    },
  },
  {
    row: 13,
    what: 'rematch’s reset {round:1, tallyA:0, tallyB:0, log:[], usedCats:[]}',
    counts: [rematchResets.length],
    expectedCounts: [1],
    value: rematchResets,
    expectedValue: [{ round: 1, tallyA: 0, tallyB: 0, log: [], usedCats: [] }],
    // The five fields after a rematch from the match's end: the reset's values,
    // with the drawn category then recorded as used by the round's start (#17).
    againstEngine: () => {
      const finished = stateOn(flowStates(), 'match')
      const action = flowAction('startMatch', finished)
      const categoryId = action.type === 'startMatch' ? action.categoryId : ''
      const reset = asEngineFields(rematchReset)
      return {
        engine: fieldsOf(reduce(finished, action), Object.keys(reset)),
        prototype: {
          ...reset,
          usedCategories: protoAppendOnce(strings(reset['usedCategories']), categoryId).used,
        },
      }
    },
    // The fields startMatch resets on match: after a five-round match, 2–3.
    drive: () => {
      const finished = last(silentMatch(room(), categoryIds(5))).end
      const reset = asEngineFields(rematchReset)
      return {
        engine: {
          before: fieldsOf(finished, ['screen', 'round', 'tallyA', 'tallyB']),
          after: fieldsOf(reduce(finished, startMatch('c7')), Object.keys(reset)),
        },
        prototype: {
          before: { screen: 'match', round: 5, tallyA: 2, tallyB: 3 },
          after: {
            ...reset,
            usedCategories: protoAppendOnce(strings(reset['usedCategories']), 'c7').used,
          },
        },
      }
    },
  },
  {
    row: 14,
    what: "resetAll's {screen:'setup', round:1, tallyA:0, tallyB:0, log:[], usedCats:[], catIdx:null, reveal:null}",
    counts: [resetAllResets.length],
    expectedCounts: [1],
    value: resetAllResets,
    expectedValue: [
      {
        screen: 'setup',
        round: 1,
        tallyA: 0,
        tallyB: 0,
        log: [],
        usedCats: [],
        catIdx: null,
        reveal: null,
      },
    ],
    // From a round end on which every one of the eight differs from its reset
    // value — a reveal included, hand-built — the fields resetMatch changes, and
    // their values. `revealedAt` is the engine's one added field, cleared with
    // `reveal` (specs.md §2.1's `+` row).
    againstEngine: () => {
      const roundTwoEnd = last(silentMatch(room(), ['c0', 'c1'])).end
      const before: RoomState = {
        ...roundTwoEnd,
        reveal: { answer: 'c1-a0', fact: 'c1-f0' },
        revealedAt: roundTwoEnd.clock.now,
      }
      const after = reduce(before, RESET)
      const reset = asEngineFields(resetAllReset)
      const keys = Object.keys(reset)
      return {
        engine: {
          values: fieldsOf(after, keys),
          changed: Object.keys(after)
            .filter((key) => fieldOf(after, key) !== fieldOf(before, key))
            .sort(),
        },
        prototype: {
          values: reset,
          changed: [...keys, ...(keys.includes('reveal') ? ['revealedAt'] : [])].sort(),
        },
      }
    },
    // The fields resetMatch changes, from a round end and from a match's end:
    // exactly the eight, and nothing else.
    drive: () => {
      const states = [
        last(silentMatch(room(), ['c0', 'c1'])).end,
        last(silentMatch(room({ picked: ['c0'] }), ['c0'])).end,
      ]
      const reset = asEngineFields(resetAllReset)
      return {
        engine: states.map((s) => ({ from: s.screen, after: reduce(s, RESET) })),
        prototype: states.map((s) => ({
          from: s.screen,
          after: { ...s, ...reset, revealedAt: null },
        })),
      }
    },
  },
  {
    row: 15,
    what: 'const shuffle = (arr) => arr.slice().sort(() => Math.random() - .5);',
    counts: [shuffles.length],
    expectedCounts: [1],
    value: shuffles,
    expectedValue: ['const shuffle = (arr) => arr.slice().sort(() => Math.random() - .5);'],
    againstEngine: null,
    drive: null,
  },
  {
    row: 16,
    what: 'onClick="{{ goWheel }}" · {{ nextRound }} · {{ rematch }} · {{ resetAll }}',
    counts: FLOW_METHODS.map((method) => flowButtons.filter((name) => name === method).length),
    expectedCounts: [1, 1, 1, 2],
    value: Object.fromEntries(FLOW_METHODS.map((method) => [method, screensOf(method)])),
    // specs.md §2.10's generator table: "the only flow events are those whose
    // buttons the prototype shows on that screen".
    expectedValue: {
      goWheel: ['ready'],
      nextRound: ['roundEnd'],
      rematch: ['match'],
      resetAll: ['roundEnd', 'match'],
    },
    // Per engine action, the screens it takes effect on: the engine's, over one
    // state per screen; the prototype's, the screens showing a button behind it.
    againstEngine: () => {
      const states = flowStates()
      return {
        engine: Object.fromEntries(
          FLOW_ACTIONS.map((kind) => [
            kind,
            SCREENS.filter((screen) => {
              const s = stateOn(states, screen)
              return reduce(s, flowAction(kind, s)) !== s
            }),
          ]),
        ),
        prototype: Object.fromEntries(
          FLOW_ACTIONS.map((kind) => [
            kind,
            SCREENS.filter((screen) =>
              bindings.some((b) => b.screen === screen && FLOW.get(b.method) === kind),
            ),
          ]),
        ),
      }
    },
    // Which screen offers which action: each button pressed on its own screen
    // takes the room where the prototype's method does — a round in play
    // (startRound's `screen:'play'`), or resetAll's own screen (#14).
    drive: () => {
      const states = flowStates()
      return {
        engine: bindings.map(({ screen, method }) => {
          const s = stateOn(states, screen)
          return {
            screen,
            method,
            to: reduce(s, flowAction(FLOW.get(method) ?? 'resetMatch', s)).screen,
          }
        }),
        prototype: bindings.map(({ screen, method }) => ({
          screen,
          method,
          to: FLOW.get(method) === 'resetMatch' ? resetAllReset['screen'] : 'play',
        })),
      }
    },
  },
  {
    row: 17,
    what: 'usedCats: s.usedCats.includes(s.catIdx) ? s.usedCats : [...s.usedCats, s.catIdx] in startRound',
    counts: [appendOnce.length],
    expectedCounts: [1],
    value: appendOnce,
    expectedValue: [{ whenUsed: 's.usedCats', otherwise: '[...s.usedCats, s.catIdx]' }],
    againstEngine: () => {
      const ready = room({ picked: ['c3', 'c0', 'c5', 'c1'] })
      const cases: (readonly [used: readonly CategoryId[], categoryId: CategoryId])[] = [
        [['c5', 'c3', 'c0'], 'c3'],
        [['c5', 'c3', 'c0'], 'c1'],
        [[], 'c0'],
      ]
      return {
        engine: cases.map(([used, categoryId]) => {
          const after = beginRound(
            { ...ready, usedCategories: used },
            2,
            categoryId,
            categoryQuestions(categoryId),
          ).usedCategories
          return { used: after, same: after === used }
        }),
        prototype: cases.map(([used, categoryId]) => protoAppendOnce(used, categoryId)),
      }
    },
    // The used list after the fallback: every selected category used, each one
    // drawn again — and, beside it, an unused one drawn as usual.
    drive: () => {
      const firstEnd = endTurn(reduce(room({ picked: ['c3', 'c0', 'c5'] }), startMatch('c5')))
      const secondEnd = endTurn(reduce(firstEnd, nextRound('c3')))
      const exhausted: RoomState = { ...secondEnd, usedCategories: ['c5', 'c3', 'c0'] }
      const cases: (readonly [state: RoomState, categoryId: CategoryId])[] = [
        ...drawableCategories(exhausted).map((c) => [exhausted, c] as const),
        [secondEnd, 'c0'],
      ]
      return {
        engine: cases.map(([s, categoryId]) => {
          const after = reduce(s, nextRound(categoryId)).usedCategories
          return { used: after, same: after === s.usedCategories }
        }),
        prototype: cases.map(([s, categoryId]) => protoAppendOnce(s.usedCategories, categoryId)),
      }
    },
  },
]

/** Found: every snippet the row counts as present was found; a count the table puts at 0 is only read. */
const isFound = (e: Extraction): boolean =>
  e.counts.length === e.expectedCounts.length &&
  e.counts.every((n, i) => e.expectedCounts[i] === 0 || n > 0)

// ============================================================================
// The readers are sound before they are trusted
// ============================================================================

describe('REQ-4.12: the readers really read design/ — nothing here passes vacuously', () => {
  test('one logic script, one component class, split into its 35 members with nothing left over', () => {
    expect([SCRIPTS.length, CLASSES.length]).toStrictEqual([1, 1])
    expect(headers[0]?.index).toBe(0)
    expect([...members.values()].join('')).toBe(classBody)
    expect(members.size).toBe(headers.length)
    expect(members.size).toBe(35)
  })

  test('every member this file reads exists and has a body', () => {
    expect(MEMBERS_READ.filter((name) => member(name).trim() === '')).toStrictEqual([])
    // So #4's count of 0 is the rematch body's, not an empty string's.
    expect(member('rematch')).toMatch(/^ {2}rematch = \(\) =>/)
  })

  test('each member-scoped extraction occurs nowhere else in the file', () => {
    // #2 in startingTeam, #4 in nextRound, #12 in passTurn, #17 in startRound.
    expect(
      [PARITY, ROTATION, PASS_INDICES, APPEND_ONCE].map((pattern) => ({
        file: all(PROTOTYPE, pattern).length,
        members: inMembers(pattern).map(({ member: name }) => name),
      })),
    ).toStrictEqual([
      { file: 1, members: ['startingTeam'] },
      { file: 1, members: ['nextRound'] },
      { file: 1, members: ['passTurn'] },
      { file: 1, members: ['startRound'] },
    ])
  })

  test('the five host screens: one flag each in renderVals, one block each in the markup', () => {
    expect([...SCREEN_FLAGS.values()]).toStrictEqual(SCREENS)
    expect(SCREEN_BLOCKS.map(({ screen }) => screen)).toStrictEqual(SCREENS)
  })

  test('every flow button in the file lies inside a host screen’s block', () => {
    expect(bindings).toHaveLength(flowButtons.length)
    expect(flowButtons.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Each extraction: its count and its value, as the plan pre-registered them
// ============================================================================

describe('REQ-4.12: 17 extractions from design/designs/Nel3ab - Arcade.dc.html', () => {
  test('the table has the 17 rows of verification.md Gate 4', () => {
    expect(EXTRACTIONS.map(({ row }) => row)).toStrictEqual(
      Array.from({ length: 17 }, (_, i) => i + 1),
    )
  })

  test.for(EXTRACTIONS)(
    'extraction #$row: count and value as pre-registered',
    ({ what, counts, expectedCounts, value, expectedValue }) => {
      expect(counts, `${what}: match count`).toStrictEqual(expectedCounts)
      expect(value, `${what}: value`).toStrictEqual(expectedValue)
    },
  )

  test('extraction #15: the whole line, as the table writes it, occurs exactly once in the file', () => {
    const [line = ''] = shuffles
    expect(line).not.toBe('')
    expect(PROTOTYPE.split(line)).toHaveLength(2)
  })
})

// ============================================================================
// Each extraction against the engine's rule, and driving the engine
// ============================================================================

const withEngine = EXTRACTIONS.flatMap(({ row, what, againstEngine }) =>
  againstEngine === null ? [] : [{ row, what, compare: againstEngine }],
)
const driving = EXTRACTIONS.flatMap(({ row, what, drive }) =>
  drive === null ? [] : [{ row, what, compare: drive }],
)

describe('REQ-4.12: each extracted rule equals the engine’s', () => {
  test.for(withEngine)('extraction #$row equals the engine’s rule', ({ what, compare }) => {
    const { engine, prototype } = compare()
    expect(engine, what).toStrictEqual(prototype)
  })
})

describe('REQ-4.12: each extracted rule drives the engine', () => {
  test.for(driving)('extraction #$row drives the reducer', ({ what, compare }) => {
    const { engine, prototype } = compare()
    expect(engine, what).toStrictEqual(prototype)
  })
})

test('REQ-4.12 tally: 17 / 17 extractions found, no count or value mismatch; 16 equal the engine’s rule and drive it, #15 pinned for Gate 2’s 🚦 box', () => {
  const mismatched = (comparisons: readonly { readonly compare: () => Comparison }[]) =>
    comparisons.filter(({ compare }) => {
      const { engine, prototype } = compare()
      return !isDeepStrictEqual(engine, prototype)
    }).length
  expect({
    of: EXTRACTIONS.length,
    found: EXTRACTIONS.filter(isFound).length,
    countMismatches: EXTRACTIONS.filter((e) => !isDeepStrictEqual(e.counts, e.expectedCounts))
      .length,
    valueMismatches: EXTRACTIONS.filter((e) => !isDeepStrictEqual(e.value, e.expectedValue)).length,
    againstEngine: withEngine.length,
    engineMismatches: mismatched(withEngine),
    driving: driving.length,
    driveMismatches: mismatched(driving),
    neither: EXTRACTIONS.filter((e) => e.againstEngine === null && e.drive === null).map(
      ({ row }) => row,
    ),
  }).toStrictEqual({
    of: 17,
    found: 17,
    countMismatches: 0,
    valueMismatches: 0,
    againstEngine: 16,
    engineMismatches: 0,
    driving: 16,
    driveMismatches: 0,
    neither: [15],
  })
  // The reset rows' values are objects, so the comparisons above are not vacuous.
  expect([isRecord(rematchReset), isRecord(resetAllReset)]).toStrictEqual([true, true])
})
