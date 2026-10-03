import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createRoom, currentJudge, reduce } from '@nel3ab/game'
import type { Action, CategoryId, RoomState, Team } from '@nel3ab/game'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

import { CATALOG, catalogEntry } from './_lib/catalog'
import type { CatalogEntry } from './_lib/catalog'
import { TICK_MS } from './_lib/driver'
import { createFlash, FLASH_MS } from './_lib/flash'
import { SEED_JUDGE_INDEX, SEED_PICKED, SEED_PLAYERS, seedRoom } from './_lib/seed'
import { SHARE_URL_BASE, shareRoom } from './_lib/share'
import { readyView, roundLabel, setupView, SHARE_LABEL } from './_lib/view'
import { HostApp } from './HostApp'
import { metadata } from './page'
import { ReadyScreen } from './ReadyScreen'
import { SetupScreen } from './SetupScreen'

// REQ-5.22 — specs/phase-5/verification.md Gate 4, "The words and the driver's numbers, read from
// the prototype". See specs.md §2.12 (this file's row: extractions W1–W9).
//
// Each extraction is read from design/designs/Nel3ab - Arcade.dc.html when the test runs, its
// match count asserted — so an extraction that finds nothing fails rather than passing vacuously —
// and asserted equal to what the app renders or holds. design/ is never edited (CLAUDE.md
// invariant 5, NFR-5.1), so this file goes red only when the app drifts from the prototype.
//
// The extractions land with the units that build what they are asserted against, each box of
// Gate 4 that names one asserting it here: W6 (the initial `state`) with the seed, REQ-5.10; W8
// (the clock's interval) with the driver, which defines `TICK_MS` (REQ-5.12); W5 (`shareRoom`'s
// strings and timing) with share.ts and flash.ts (REQ-5.21); W4 (`renderVals`' labels) with
// view.ts (REQ-5.16 – REQ-5.19). W7 (the categories) checks the catalog, REQ-5.14's, and was
// added after it, beside W5. W1–W3 (the setup and room-ready markup's words and titles) and W9
// (the `<title>`) land with the screens and page.tsx (REQ-5.15 – REQ-5.20); with them all nine
// are here, which is what REQ-5.22's own box asks.
//
// The reader is Phases 3–5's (packages/game/src/setup-rules.test.ts): small regular expressions
// over the prototype's one logic script and its component class; no HTML or JavaScript parser.
// W1–W3 and W9 read the prototype's markup, outside the script, the same way: its text runs —
// what lies between one tag's `>` and the next `<` — and its `title` attributes, each count
// asserted, compared with the screens' own static markup (`renderToStaticMarkup`, no DOM).
// The path resolves from import.meta.url, not the working directory: each Vitest project sets its
// own `root`. The file name has spaces, which `URL` percent-encodes and fileURLToPath decodes.

const PROTOTYPE = readFileSync(
  fileURLToPath(new URL('../../../../design/designs/Nel3ab - Arcade.dc.html', import.meta.url)),
  'utf8',
)

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

// --- the prototype's logic script and its component class ---------------------------------------

/** `<script type="text/x-dc" …>…</script>`: the prototype's one logic script. */
const SCRIPTS = all(PROTOTYPE, /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/g)
const script = SCRIPTS[0]?.[1] ?? ''

/** The component class, from its header to the `}` alone on a line that closes it. */
const CLASSES = all(script, /^class Component extends DCLogic \{\n([\s\S]*?)^\}$/gm)
const classBody = CLASSES[0]?.[1] ?? ''

test('the reader finds the one logic script and its component class', () => {
  expect(SCRIPTS).toHaveLength(1)
  expect(CLASSES).toHaveLength(1)
})

// --- W4: renderVals' labels --------------------------------------------------------------------

/** The class's `renderVals(){ … }` method, capturing its body. */
const RENDER_VALS_BLOCKS = all(classBody, /^ {2}renderVals\(\)\s*\{\n([\s\S]*?)^ {2}\}$/gm)
const renderValsBody = RENDER_VALS_BLOCKS[0]?.[1] ?? ''

/** `playerCountLabel: s.players.length + '…',` */
const PLAYER_COUNT_LABEL = /\bplayerCountLabel\s*:\s*s\.players\.length\s*\+\s*'([^']*)'\s*,/g
/** `membersA` / `membersB`: the team's names `.join('…') || '…'` — the separator and the empty label. */
const MEMBERS =
  /\bmembers([AB])\s*:\s*s\.players\.filter\(\s*p\s*=>\s*p\.team\s*===\s*'([ab])'\s*\)\.map\(\s*p\s*=>\s*p\.name\s*\)\.join\('([^']*)'\)\s*\|\|\s*'([^']*)'\s*,/g
/** `judgeHint: s.players.length % 2 === 1 ? '…' : '…',` — odd, then even. */
const JUDGE_HINT =
  /\bjudgeHint\s*:\s*s\.players\.length\s*%\s*2\s*===\s*1\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*,/g
/** A judge choice is the judge by `i === s.judgeIdx` — `===`, not modulo (bg, fg, shadow). */
const JUDGE_SELECTED = /\bi\s*===\s*s\.judgeIdx\b/g
/** `rotateLabel: (s.rotateJudge ? '…' : '…') + '…',` — on, off, the text. */
const ROTATE_LABEL =
  /\brotateLabel\s*:\s*\(\s*s\.rotateJudge\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\)\s*\+\s*'([^']*)'\s*,/g
/** `pickedLabel: s.picked.length + '…' + CATS.length + '…',` */
const PICKED_LABEL =
  /\bpickedLabel\s*:\s*s\.picked\.length\s*\+\s*'([^']*)'\s*\+\s*CATS\.length\s*\+\s*'([^']*)'\s*,/g
/** A tile's `on`: `s.picked.includes(i)`. */
const TILE_ON = /\bconst\s+on\s*=\s*s\.picked\.includes\(i\)\s*;/g
/** `tag: c.locked ? '…' : (on ? '…' : '…'),` — locked, selected, neither. */
const TILE_TAG =
  /\btag\s*:\s*c\.locked\s*\?\s*'([^']*)'\s*:\s*\(\s*on\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\)\s*,/g
/** `setupNote: '…' + this.roundTime + '…',` */
const SETUP_NOTE = /\bsetupNote\s*:\s*'([^']*)'\s*\+\s*this\.roundTime\s*\+\s*'([^']*)'\s*,/g
/** `roundLabel: s.screen === 'setup' || s.screen === 'ready' ? '…' : '…' + s.round + '…' + this.winsNeeded + '…',` */
const ROUND_LABEL =
  /\broundLabel\s*:\s*s\.screen\s*===\s*'setup'\s*\|\|\s*s\.screen\s*===\s*'ready'\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\+\s*s\.round\s*\+\s*'([^']*)'\s*\+\s*this\.winsNeeded\s*\+\s*'([^']*)'\s*,/g
/** `judgeName: judge ? judge.name : '…',` — with `const judge = this.judge;`, the getter. */
const JUDGE_NAME = /\bjudgeName\s*:\s*judge\s*\?\s*judge\.name\s*:\s*'([^']*)'\s*,/g
const JUDGE_GETTER = /\bconst\s+judge\s*=\s*this\.judge\s*;/g
/** `copyLabel: s.shareMsg ? s.shareMsg : '…',` — the share button's idle label. */
const COPY_LABEL = /\bcopyLabel\s*:\s*s\.shareMsg\s*\?\s*s\.shareMsg\s*:\s*'([^']*)'\s*,/g

/** The labels `renderVals` would build for `state`, from the parts read above, evaluated here. */
interface Labels {
  readonly playerCountLabel: string
  readonly membersA: string
  readonly membersB: string
  readonly judgeHint: string
  readonly judgeSelected: readonly boolean[]
  readonly rotateLabel: string
  readonly pickedLabel: string
  readonly tags: readonly string[]
  readonly setupNote: string
  readonly roundLabel: string
  readonly judgeName: string
}

/** The same labels, as view.ts gives them. */
const appLabels = (state: RoomState, catalog: readonly CatalogEntry[]): Labels => {
  const setup = setupView(state, catalog)
  const ready = readyView(state)
  // The header's label and room-ready's are one function's.
  expect(ready.roundLabel).toBe(roundLabel(state))
  return {
    playerCountLabel: setup.playerCountLabel,
    membersA: setup.teams.a.members,
    membersB: setup.teams.b.members,
    judgeHint: setup.judgeHint,
    judgeSelected: setup.judgeOptions.map(({ selected }) => selected),
    rotateLabel: setup.rotateLabel,
    pickedLabel: setup.pickedLabel,
    tags: setup.tiles.map(({ tag }) => tag),
    setupNote: setup.setupNote,
    roundLabel: roundLabel(state),
    judgeName: ready.judgeName,
  }
}

// --- W5: shareRoom -------------------------------------------------------------------------------

/** The class's `shareRoom = () => { … };` arrow, capturing its body. */
const SHARE_ROOM_BLOCKS = all(classBody, /^ {2}shareRoom = \(\) => \{\n([\s\S]*?)^ {2}\};$/gm)
const shareRoomBody = SHARE_ROOM_BLOCKS[0]?.[1] ?? ''

/** `const link = '…' + code;` — the join link's base. */
const LINK_BASE = /\bconst\s+link\s*=\s*'([^']*)'\s*\+\s*code\s*;/g
/** `flash`: report the label, clear the pending timeout, set one that clears the label after N ms. */
const FLASH =
  /\bconst\s+flash\s*=\s*\(label\)\s*=>\s*\{\s*this\.setState\(\{\s*shareMsg\s*:\s*label\s*\}\)\s*;\s*clearTimeout\(this\.copyId\)\s*;\s*this\.copyId\s*=\s*setTimeout\(\s*\(\)\s*=>\s*this\.setState\(\{\s*shareMsg\s*:\s*''\s*\}\)\s*,\s*(\d+)\s*\)\s*;/g
/** `navigator.share({title:'…', text:'…' + code, url:link})`, capturing the title and the text. */
const SHARE_CALL =
  /\bnavigator\.share\(\{\s*title\s*:\s*'([^']*)'\s*,\s*text\s*:\s*'([^']*)'\s*\+\s*code\s*,\s*url\s*:\s*link\s*\}\)/g
/** The sheet's outcome: resolved → `flash('…')`; rejected → `copy()` unless `e.name` is '…'. */
const SHARE_OUTCOME =
  /\.then\(\s*\(\)\s*=>\s*flash\('([^']*)'\)\s*,\s*\(e\)\s*=>\s*\{\s*if\s*\(\s*!e\s*\|\|\s*e\.name\s*!==\s*'([^']*)'\s*\)\s*copy\(\)\s*;?\s*\}\s*\)/g
/** The clipboard's outcome: `writeText(link)` resolved → `flash('…')`, rejected → `flash('…' + code)`. */
const COPY_OUTCOME =
  /\bnavigator\.clipboard\.writeText\(link\)\.then\(\s*\(\)\s*=>\s*flash\('([^']*)'\)\s*,\s*\(\)\s*=>\s*flash\('([^']*)'\s*\+\s*code\)\s*\)/g
/** No clipboard: `else flash('…' + code)`. */
const NO_CLIPBOARD = /\belse\s+flash\('([^']*)'\s*\+\s*code\)/g
/** Every call of `flash(` — so an outcome the patterns above miss cannot go unnoticed. */
const FLASH_CALLS = /\bflash\(/g

/** A share sheet or a clipboard that settles as given, recording its argument. */
const settles = <T>(outcome: 'resolve' | 'reject', reason?: unknown) =>
  vi.fn((argument: T): Promise<void> => {
    void argument
    return outcome === 'resolve' ? Promise.resolve() : Promise.reject(reason)
  })

// --- W6: the initial `state` ---------------------------------------------------------------------

/** The class's `state = { … };` field, capturing its body. */
const STATE_BLOCKS = all(classBody, /^ {2}state = \{\n([\s\S]*?)^ {2}\};$/gm)
const stateBody = STATE_BLOCKS[0]?.[1] ?? ''

/** `players:[ … ]`, capturing the list's text; and each `{name:'…', team:'a'|'b'}` in it. */
const PLAYERS = /\bplayers\s*:\s*\[([^\]]*)\]/g
const PLAYER = /\{\s*name\s*:\s*'([^']*)'\s*,\s*team\s*:\s*'([ab])'\s*\}/g
/** Every `{` the list opens — so a player the full pattern misses cannot go unnoticed. */
const OPENINGS = /\{/g
const TEAM_A = /\bteamA\s*:\s*'([^']*)'/g
const TEAM_B = /\bteamB\s*:\s*'([^']*)'/g
const JUDGE_INDEX = /\bjudgeIdx\s*:\s*(\d+)/g
const ROTATE = /\brotateJudge\s*:\s*(true|false)\b/g
/** `picked:[ … ]`, capturing the list of category indices. */
const PICKED = /\bpicked\s*:\s*\[([^\]]*)\]/g

// --- W7: the categories ----------------------------------------------------------------------

/** `const CATS = [` … `];`, the script's category list, capturing its body. */
const CATS_BLOCKS = all(script, /^const CATS = \[\n([\s\S]*?)^\];$/gm)
const catsBody = CATS_BLOCKS[0]?.[1] ?? ''

/** Each category's opening line, `  {name:'…', emoji:'…', … qs:[` — its questions are indented four. */
const CATEGORY_LINES = /^ {2}\{([^\n]*)$/gm
/** Every category's question list — so a category the line pattern misses cannot go unnoticed. */
const QUESTION_LISTS = /\bqs\s*:\s*\[/g
const CATEGORY_NAME = /\bname\s*:\s*'([^']*)'/g
const CATEGORY_EMOJI = /\bemoji\s*:\s*'([^']*)'/g
const CATEGORY_LOCKED = /\blocked\s*:\s*(true|false)\b/g
/** Every `locked` in the list — so a lock outside a category's opening line cannot go unnoticed. */
const ANY_LOCKED = /\blocked\b/g

// --- W8: the clock's interval ---------------------------------------------------------------

/** The class's `startClock(){ … }` method, capturing its body. */
const START_CLOCK_BLOCKS = all(classBody, /^ {2}startClock\(\)\s*\{\n([\s\S]*?)^ {2}\}$/gm)
const startClockBody = START_CLOCK_BLOCKS[0]?.[1] ?? ''

/** Every interval timer the class starts — so a second clock could not go unnoticed. */
const SET_INTERVAL = /\bsetInterval\s*\(/g
/** The delay that closes `setInterval(() => { … }, N)`, in ms. */
const INTERVAL_MS = /\}\s*,\s*(\d+)\s*\)/g
/** What one callback drains from the active team's time: `cur.time - N`, in seconds. */
const DRAIN_SECONDS = /\bcur\.time\s*-\s*(\d+(?:\.\d+)?)/g

// --- W1–W3, W9: the markup ------------------------------------------------------------------

/** The 440px column, from its opening to the first screen's `<sc-if`: the header row. */
const HEADER_BLOCKS = all(PROTOTYPE, /<div style="width:100%;max-width:440px;">([\s\S]*?)<sc-if /g)
const headerBlock = HEADER_BLOCKS[0]?.[1] ?? ''

/** `<sc-if value="{{ isSetup }}" …>` … `</sc-if>`: the setup screen's markup. */
const SETUP_BLOCKS = all(PROTOTYPE, /<sc-if value="\{\{ isSetup \}\}"[^>]*>([\s\S]*?)<\/sc-if>/g)
const setupBlock = SETUP_BLOCKS[0]?.[1] ?? ''

/** `<sc-if value="{{ isReady }}" …>` … `</sc-if>`: the room-ready screen's markup. */
const READY_BLOCKS = all(PROTOTYPE, /<sc-if value="\{\{ isReady \}\}"[^>]*>([\s\S]*?)<\/sc-if>/g)
const readyBlock = READY_BLOCKS[0]?.[1] ?? ''

/** Every `<sc-if` — so one nested in a block, which would cut the block short, cannot go unnoticed. */
const SC_IF = /<sc-if\b/g
/** `<sc-for list="{{ name }}" …>` … `</sc-for>`: markup the runtime renders once per item of `name`. */
const SC_FOR = /<sc-for list="\{\{ (\w+) \}\}"[^>]*>([\s\S]*?)<\/sc-for>/g

/** What lies between one tag's `>` and the next `<`. */
const TEXT_RUN = />([^<]*)</g
/** A `{{ … }}` placeholder, the value the runtime fills in; captured, so `split` keeps it. */
const PLACEHOLDER = /(\{\{[^}]*\}\})/
/**
 * A `<button … title="…" …>glyph</button>`, capturing the title and the button's content. The
 * rendered glyph sits in a span since Gate 5 (setup.module.css, `.glyph`), so the content may hold
 * tags; `glyphOf` reads its text.
 */
const TITLED_BUTTON = /<button\b[^>]*\stitle="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g
const glyphOf = (content: string): string => content.replace(/<[^>]*>/g, '').trim()
/** Every `title="…"` — so a titled element the button pattern misses cannot go unnoticed. */
const TITLE = /\stitle="([^"]*)"/g
/** A `<button …>` start tag, capturing its attributes. */
const BUTTON_START = /<button\b([^>]*)>/g
/** One attribute's value in a start tag's attributes, or `null` when it has none. */
const attributeOf = (attributes: string, name: string): string | null =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1] ?? null
/** The document's `<title>`. */
const PAGE_TITLE = /<title>([^<]*)<\/title>/g

/** Every text run of `markup`, in order, its whitespace collapsed; empty runs dropped. */
const textRuns = (markup: string): string[] =>
  all(markup, TEXT_RUN)
    .map((m) => group(m, 1).replace(/\s+/g, ' ').trim())
    .filter((run) => run !== '')

/** A literal text node: a run with text of its own, not placeholders alone. */
const isLiteral = (run: string): boolean =>
  run.split(PLACEHOLDER).some((part, index) => index % 2 === 0 && part.trim() !== '')

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A run as a pattern for a rendered run: its literal text exactly, each placeholder any text. */
const runPattern = (run: string): RegExp =>
  new RegExp(
    `^${run
      .split(PLACEHOLDER)
      .map((part, index) => (index % 2 === 0 ? escapeRegExp(part) : '(.+)'))
      .join('')}$`,
    'u',
  )

/** For each pattern in turn, the first rendered run after the last one matched that it matches. */
const matchInOrder = (patterns: readonly RegExp[], runs: readonly string[]): (string | null)[] => {
  let from = 0
  return patterns.map((pattern) => {
    const index = runs.findIndex((run, i) => i >= from && pattern.test(run))
    if (index === -1) return null
    from = index + 1
    return runs[index] ?? null
  })
}

/**
 * How many times the runtime renders each literal run of `block`, the lists having the given
 * lengths: a run outside every `sc-for` once per occurrence, a run inside one once per item.
 */
const renderedCounts = (
  block: string,
  lengths: Readonly<Record<string, number>>,
): Map<string, number> => {
  const counts = new Map<string, number>()
  const add = (markup: string, times: number): void => {
    for (const run of textRuns(markup).filter(isLiteral)) {
      counts.set(run, (counts.get(run) ?? 0) + times)
    }
  }
  add(block.replace(SC_FOR, ''), 1)
  for (const loop of all(block, SC_FOR)) {
    const length = lengths[group(loop, 1)]
    if (length === undefined) throw new Error(`no length given for the list ${group(loop, 1)}`)
    add(group(loop, 2), length)
  }
  return counts
}

/** How many rendered runs each literal run's pattern matches. */
const appCounts = (literals: Iterable<string>, runs: readonly string[]): Map<string, number> =>
  new Map(
    [...literals].map((run) => [
      run,
      runs.filter((rendered) => runPattern(run).test(rendered)).length,
    ]),
  )

const noop = (): void => undefined

/** The seed's setup screen, rendered alone. */
const setupScreenMarkup = (): string =>
  renderToStaticMarkup(
    createElement(SetupScreen, {
      view: setupView(seedRoom('SKZJ62'), CATALOG),
      onShuffleTeamName: noop,
      onRenameTeam: noop,
      onSwapTeam: noop,
      onRemovePlayer: noop,
      onSetJudge: noop,
      onSetRotateJudge: noop,
      onPickCategory: noop,
      onOpenRoom: noop,
    }),
  )

/** The seed's room-ready screen, on `ready`, with no share outcome flashing, rendered alone. */
const readyScreenMarkup = (): string =>
  renderToStaticMarkup(
    createElement(ReadyScreen, {
      view: readyView(reduce(seedRoom('SKZJ62'), { type: 'openRoom' })),
      shareLabel: null,
      onShare: noop,
      onStart: noop,
      onBack: noop,
    }),
  )

describe("REQ-5.22: the screens' words and the driver's numbers, read from the prototype", () => {
  test("W1 — every literal text node of the header and the setup block is HostApp's and SetupScreen's, in order", () => {
    expect([HEADER_BLOCKS.length, SETUP_BLOCKS.length]).toStrictEqual([1, 1])
    expect(all(setupBlock, SC_IF)).toHaveLength(0)
    expect(all(setupBlock, SC_FOR).map((loop) => group(loop, 1))).toStrictEqual([
      'chips',
      'judgeOptions',
      'catGrid',
    ])

    const header = textRuns(headerBlock).filter(isLiteral)
    const setup = textRuns(setupBlock).filter(isLiteral)
    // The texts W1 names, as the prototype writes them; none mixed with a placeholder.
    expect(header).toStrictEqual(['نلعب'])
    expect(setup).toStrictEqual([
      'يلا نلعب',
      'فريقان، حكم واحد، وأسئلة معلومات — كل شي جاهز، عدّل اللي تبيه بس.',
      'الفرق',
      'فريق ١',
      '↺',
      'فريق ٢',
      '↺',
      '↔',
      '✕',
      'الحكم',
      'الحكم يشوف الإجابة الصحيحة — بقية الشاشات لا.',
      'الفئات',
      'ابدأ اللعبة',
      '▶',
    ])
    expect([...header, ...setup].filter((run) => PLACEHOLDER.test(run))).toStrictEqual([])

    // The setup screen, for the seed: each in the prototype's order, and each as many times as
    // the prototype's template renders it — ↔ and ✕ once per chip, inside its `sc-for`.
    const screen = textRuns(setupScreenMarkup())
    expect(matchInOrder(setup.map(runPattern), screen)).toStrictEqual(setup)
    const view = setupView(seedRoom('SKZJ62'), CATALOG)
    const expected = renderedCounts(setupBlock, {
      chips: view.chips.length,
      judgeOptions: view.judgeOptions.length,
      catGrid: view.tiles.length,
    })
    expect(Object.fromEntries(expected)).toStrictEqual({
      'يلا نلعب': 1,
      'فريقان، حكم واحد، وأسئلة معلومات — كل شي جاهز، عدّل اللي تبيه بس.': 1,
      الفرق: 1,
      'فريق ١': 1,
      '↺': 2,
      'فريق ٢': 1,
      '↔': 5,
      '✕': 5,
      الحكم: 1,
      'الحكم يشوف الإجابة الصحيحة — بقية الشاشات لا.': 1,
      الفئات: 1,
      'ابدأ اللعبة': 1,
      '▶': 1,
    })
    expect(appCounts(expected.keys(), screen)).toStrictEqual(expected)

    // The frame: the header's "نلعب" first, then the setup screen's, in order.
    const host = textRuns(renderToStaticMarkup(createElement(HostApp)))
    expect(host[0]).toBe(header[0])
    expect(matchInOrder([...header, ...setup].map(runPattern), host)).toStrictEqual([
      ...header,
      ...setup,
    ])
    expect(appCounts(header, host)).toStrictEqual(new Map([[header[0], 1]]))
  })

  test("W2 — the setup block's title attributes are SetupScreen's, on the same buttons, once per rendering", () => {
    const titles = all(setupBlock, TITLE).map((m) => group(m, 1))
    const titled = all(setupBlock, TITLED_BUTTON).map((m) => [group(m, 1), glyphOf(group(m, 2))])
    expect(titles).toStrictEqual(['اسم ثاني', 'اسم ثاني', 'بدّل الفريق', 'حذف'])
    expect(titled).toStrictEqual([
      ['اسم ثاني', '↺'],
      ['اسم ثاني', '↺'],
      ['بدّل الفريق', '↔'],
      ['حذف', '✕'],
    ])
    // Two outside every list — the team tiles' ↺ — and two inside the chips' `sc-for`.
    const loops = all(setupBlock, SC_FOR)
    expect(all(setupBlock.replace(SC_FOR, ''), TITLED_BUTTON)).toHaveLength(2)
    expect(
      loops.map((loop) => [group(loop, 1), all(group(loop, 2), TITLED_BUTTON).length]),
    ).toStrictEqual([
      ['chips', 2],
      ['judgeOptions', 0],
      ['catGrid', 0],
    ])

    // The setup screen, for the seed: the two ↺, then ↔ and ✕ on each of the five chips — every
    // titled element a button with the prototype's glyph, its accessible name its title.
    const [shuffleA, shuffleB, swap, remove] = titled
    const markup = setupScreenMarkup()
    const view = setupView(seedRoom('SKZJ62'), CATALOG)
    const rendered = all(markup, TITLED_BUTTON).map((m) => [group(m, 1), glyphOf(group(m, 2))])
    expect(rendered).toStrictEqual([
      shuffleA,
      shuffleB,
      ...view.chips.flatMap(() => [swap, remove]),
    ])
    expect(all(markup, TITLE)).toHaveLength(rendered.length)
    const names = all(markup, BUTTON_START)
      .map((m) => group(m, 1))
      .filter((attributes) => attributeOf(attributes, 'title') !== null)
      .map((attributes) => [
        attributeOf(attributes, 'title'),
        attributeOf(attributes, 'aria-label'),
      ])
    expect(names).toStrictEqual(rendered.map(([title]) => [title, title]))
  })

  test("W3 — every literal text node of the room-ready block is ReadyScreen's, in order", () => {
    expect(READY_BLOCKS).toHaveLength(1)
    expect(all(readyBlock, SC_IF)).toHaveLength(0)
    expect(all(readyBlock, SC_FOR).map((loop) => group(loop, 1))).toStrictEqual(['chips'])

    const ready = textRuns(readyBlock).filter(isLiteral)
    // The texts W3 names, as the prototype writes them: "الحكم: " is the one mixed with a value.
    expect(ready).toStrictEqual([
      '🎉',
      'الغرفة جاهزة!',
      'كود الانضمام — شاركه مع اللاعبين',
      '⤴',
      'في الغرفة',
      'الحكم: {{ judgeName }}',
      'ابدأ الجولة الأولى',
      '▶',
      'رجوع للإعداد',
    ])

    // The room-ready screen, for the seed on ready: each in order, the judge's name in its
    // placeholder's place, each once.
    const screen = textRuns(readyScreenMarkup())
    const view = readyView(reduce(seedRoom('SKZJ62'), { type: 'openRoom' }))
    expect(matchInOrder(ready.map(runPattern), screen)).toStrictEqual(
      ready.map((run) => run.replace('{{ judgeName }}', view.judgeName)),
    )
    expect(view.judgeName).toBe('ماجد')
    const expected = renderedCounts(readyBlock, { chips: view.chips.length })
    expect([...expected.values()]).toStrictEqual(ready.map(() => 1))
    expect(appCounts(expected.keys(), screen)).toStrictEqual(expected)
  })

  test("W4 — renderVals' setup and room-ready labels are view.ts's, for the seed and edited rooms", () => {
    expect(RENDER_VALS_BLOCKS).toHaveLength(1)
    const found = {
      count: all(renderValsBody, PLAYER_COUNT_LABEL),
      members: all(renderValsBody, MEMBERS),
      hint: all(renderValsBody, JUDGE_HINT),
      selected: all(renderValsBody, JUDGE_SELECTED),
      rotate: all(renderValsBody, ROTATE_LABEL),
      picked: all(renderValsBody, PICKED_LABEL),
      on: all(renderValsBody, TILE_ON),
      tag: all(renderValsBody, TILE_TAG),
      note: all(renderValsBody, SETUP_NOTE),
      round: all(renderValsBody, ROUND_LABEL),
      judge: all(renderValsBody, JUDGE_NAME),
      getter: all(renderValsBody, JUDGE_GETTER),
      copy: all(renderValsBody, COPY_LABEL),
    }
    expect(counts(found)).toStrictEqual({
      count: 1,
      members: 2,
      hint: 1,
      selected: 3,
      rotate: 1,
      picked: 1,
      on: 1,
      tag: 1,
      note: 1,
      round: 1,
      judge: 1,
      getter: 1,
      copy: 1,
    })

    // membersA reads team a and membersB team b, with one separator and one empty label.
    const separator = only(found.members, 3)
    const empty = only(found.members, 4)
    expect(
      found.members.map((m) => [group(m, 1), group(m, 2), group(m, 3), group(m, 4)]),
    ).toStrictEqual([
      ['A', 'a', separator, empty],
      ['B', 'b', separator, empty],
    ])

    const parts = {
      count: only(found.count, 1),
      separator,
      empty,
      odd: only(found.hint, 1),
      even: only(found.hint, 2),
      on: only(found.rotate, 1),
      off: only(found.rotate, 2),
      rotate: only(found.rotate, 3),
      of: only(found.picked, 1),
      picked: only(found.picked, 2),
      locked: only(found.tag, 1),
      selected: only(found.tag, 2),
      neither: only(found.tag, 3),
      noteBefore: only(found.note, 1),
      noteAfter: only(found.note, 2),
      setup: only(found.round, 1),
      roundBefore: only(found.round, 2),
      roundMiddle: only(found.round, 3),
      roundAfter: only(found.round, 4),
      noJudge: only(found.judge, 1),
      share: only(found.copy, 1),
    }
    // The strings W4 names, as the prototype writes them.
    expect(parts).toStrictEqual({
      count: ' لاعبين',
      separator: '، ',
      empty: 'بدون لاعبين',
      odd: 'العدد فردي — يفضّل التبديل',
      even: 'ثابت طول المباراة',
      on: '✔ ',
      off: '○ ',
      rotate: 'بدّل الحكم كل جولة',
      of: ' من ',
      picked: ' مختارة',
      locked: '🔒 مدفوعة',
      selected: 'مختارة',
      neither: '',
      noteBefore: 'الحكم يشوف الإجابات · ',
      noteAfter: ' ثانية لكل فريق · ما تحتاج تسجّل دخول',
      setup: 'إعداد',
      roundBefore: 'جولة ',
      roundMiddle: ' — أول ',
      roundAfter: ' جولات',
      noJudge: '—',
      share: 'مشاركة',
    })

    /** renderVals' expressions, evaluated over the engine's room with the parts read above. */
    const prototypeLabels = (state: RoomState, catalog: readonly CatalogEntry[]): Labels => {
      const membersOf = (team: Team): string =>
        state.players
          .filter((p) => p.team === team)
          .map((p) => p.name)
          .join(parts.separator) || parts.empty
      // The prototype's `this.judge` getter is the engine's currentJudge (setup-rules.test.ts, E6).
      const judge = currentJudge(state)
      return {
        playerCountLabel: String(state.players.length) + parts.count,
        membersA: membersOf('a'),
        membersB: membersOf('b'),
        judgeHint: state.players.length % 2 === 1 ? parts.odd : parts.even,
        judgeSelected: state.players.map((_, i) => i === state.judgeIndex),
        rotateLabel: (state.rotateJudge ? parts.on : parts.off) + parts.rotate,
        pickedLabel:
          String(state.pickedCategories.length) + parts.of + String(catalog.length) + parts.picked,
        tags: catalog.map((c) => {
          const on = state.pickedCategories.includes(c.id)
          return c.locked ? parts.locked : on ? parts.selected : parts.neither
        }),
        setupNote: parts.noteBefore + String(state.config.roundSeconds) + parts.noteAfter,
        roundLabel:
          state.screen === 'setup' || state.screen === 'ready'
            ? parts.setup
            : parts.roundBefore +
              String(state.round) +
              parts.roundMiddle +
              String(state.config.winsNeeded) +
              parts.roundAfter,
        judgeName: judge ? judge.name : parts.noJudge,
      }
    }

    // The seed, and rooms edited through the engine: every branch of every label taken.
    const after = (from: RoomState, ...actions: Action[]): RoomState =>
      actions.reduce((state, action) => reduce(state, action), from)
    const start = (type: 'startMatch' | 'nextRound', categoryId: CategoryId): Action => ({
      type,
      categoryId,
      questions: catalogEntry(categoryId).questions,
    })
    const seed = seedRoom('SKZJ62')
    const ready = after(seed, { type: 'openRoom' })
    const play = after(ready, start('startMatch', 'proverbs'))
    const roundEnd = after(play, { type: 'tick', ms: 45_000 })
    const shortMatch: RoomState = {
      ...createRoom({
        roomCode: 'SKZJ62',
        teamA: 'النمور',
        teamB: 'الصقور',
        config: { roundSeconds: 60, winsNeeded: 2 },
      }),
      players: SEED_PLAYERS,
      pickedCategories: SEED_PICKED,
    }
    const rooms: readonly RoomState[] = [
      seed,
      after(seed, { type: 'removePlayer', playerId: 'seed-2' }),
      after(seed, { type: 'swapTeam', playerId: 'seed-1' }),
      after(
        seed,
        { type: 'swapTeam', playerId: 'seed-1' },
        { type: 'swapTeam', playerId: 'seed-3' },
        { type: 'swapTeam', playerId: 'seed-5' },
      ),
      after(
        seed,
        ...SEED_PLAYERS.map(({ id }): Action => ({ type: 'removePlayer', playerId: id })),
      ),
      after(seed, { type: 'setJudge', playerId: 'seed-1' }),
      { ...seed, judgeIndex: 7 },
      after(seed, { type: 'setRotateJudge', rotate: true }),
      after(
        seed,
        ...SEED_PICKED.map((categoryId): Action => ({
          type: 'pickCategory',
          categoryId,
          picked: false,
        })),
      ),
      after(seed, { type: 'pickCategory', categoryId: 'culture', picked: true }),
      ready,
      play,
      roundEnd,
      after(roundEnd, start('nextRound', 'society')),
      shortMatch,
      after(shortMatch, { type: 'openRoom' }, start('startMatch', 'proverbs')),
    ]
    const twoTiles = [catalogEntry('industry'), catalogEntry('culture')]
    for (const room of rooms) {
      expect(appLabels(room, CATALOG)).toStrictEqual(prototypeLabels(room, CATALOG))
      expect(appLabels(room, twoTiles)).toStrictEqual(prototypeLabels(room, twoTiles))
    }

    // Not vacuous: across the rooms, every part appears in a label.
    const labels = rooms.map((room) => prototypeLabels(room, CATALOG))
    const shown = new Set(
      labels.flatMap((l) => [
        l.membersA,
        l.membersB,
        l.judgeHint,
        l.rotateLabel,
        ...l.tags,
        l.roundLabel,
        l.judgeName,
      ]),
    )
    for (const value of [
      parts.empty,
      parts.odd,
      parts.even,
      parts.on + parts.rotate,
      parts.off + parts.rotate,
      parts.locked,
      parts.selected,
      parts.neither,
      parts.setup,
      parts.roundBefore + '2' + parts.roundMiddle + '3' + parts.roundAfter,
      parts.roundBefore + '1' + parts.roundMiddle + '2' + parts.roundAfter,
      parts.noJudge,
    ]) {
      expect(shown.has(value)).toBe(true)
    }
    expect(labels.map(({ playerCountLabel }) => playerCountLabel)).toEqual(
      expect.arrayContaining(['5' + parts.count, '4' + parts.count, '0' + parts.count]),
    )
    expect(labels.map(({ pickedLabel }) => pickedLabel)).toEqual(
      expect.arrayContaining(['8 من 11 مختارة', '0 من 11 مختارة', '9 من 11 مختارة']),
    )
    // ماجد selected on the seed; nobody at an index past the end (`===`, not modulo).
    expect(labels[0]?.judgeSelected).toStrictEqual([false, false, false, false, true])
    expect(labels[6]?.judgeSelected).toStrictEqual([false, false, false, false, false])
    expect(labels[14]?.setupNote).toBe(parts.noteBefore + '60' + parts.noteAfter)

    // The share button's idle label.
    expect(SHARE_LABEL).toBe(parts.share)
  })

  test("W5 — shareRoom's link, title, text, three labels and AbortError are share.ts's; its 1800 is flash.ts's", async () => {
    expect(SHARE_ROOM_BLOCKS).toHaveLength(1)
    const found = {
      link: all(shareRoomBody, LINK_BASE),
      flash: all(shareRoomBody, FLASH),
      share: all(shareRoomBody, SHARE_CALL),
      shared: all(shareRoomBody, SHARE_OUTCOME),
      copied: all(shareRoomBody, COPY_OUTCOME),
      none: all(shareRoomBody, NO_CLIPBOARD),
      calls: all(shareRoomBody, FLASH_CALLS),
    }
    expect(counts(found)).toStrictEqual({
      link: 1,
      flash: 1,
      share: 1,
      shared: 1,
      copied: 1,
      none: 1,
      calls: 4,
    })
    const prototype = {
      base: only(found.link, 1),
      title: only(found.share, 1),
      text: only(found.share, 2),
      shared: only(found.shared, 1),
      abort: only(found.shared, 2),
      copied: only(found.copied, 1),
      copyFailed: only(found.copied, 2),
      noClipboard: only(found.none, 1),
      ms: Number(only(found.flash, 1)),
    }
    expect(prototype).toStrictEqual({
      base: 'https://nel3ab.game/j/',
      title: 'نلعب',
      text: 'انضم لغرفتنا بالكود ',
      shared: 'تمت المشاركة ✔',
      abort: 'AbortError',
      copied: 'نُسخ الرابط ✔',
      copyFailed: 'الكود: ',
      noClipboard: 'الكود: ',
      ms: 1800,
    })

    // share.ts, path by path: the link, the payload, the three labels, and the dismissal.
    const code = 'SKZJ62'
    const link = prototype.base + code
    expect(SHARE_URL_BASE).toBe(prototype.base)

    const sheet = settles<{ title: string; text: string; url: string }>('resolve')
    await expect(shareRoom(code, { share: sheet })).resolves.toBe(prototype.shared)
    expect(sheet.mock.calls).toStrictEqual([
      [{ title: prototype.title, text: prototype.text + code, url: link }],
    ])

    const untouched = settles<string>('resolve')
    await expect(
      shareRoom(code, {
        share: settles('reject', new DOMException('Share canceled', prototype.abort)),
        clipboard: { writeText: untouched },
      }),
    ).resolves.toBeNull()
    expect(untouched).not.toHaveBeenCalled()

    // `!e`: a rejection with nothing falls through to the clipboard.
    const written = settles<string>('resolve')
    await expect(
      shareRoom(code, { share: settles('reject', undefined), clipboard: { writeText: written } }),
    ).resolves.toBe(prototype.copied)
    expect(written.mock.calls).toStrictEqual([[link]])

    await expect(
      shareRoom(code, { clipboard: { writeText: settles('reject', new Error('denied')) } }),
    ).resolves.toBe(prototype.copyFailed + code)
    await expect(shareRoom(code, {})).resolves.toBe(prototype.noClipboard + code)

    // flash.ts: report the label, clear the pending countdown, set one of the prototype's ms.
    expect(FLASH_MS).toBe(prototype.ms)
    const calls: string[] = []
    const flash = createFlash(
      (label) => {
        calls.push(`report ${String(label)}`)
      },
      {
        setTimeout: (callback, ms) => {
          void callback
          calls.push(`set ${ms}`)
          return calls.length
        },
        clearTimeout: (handle) => {
          calls.push(`clear ${String(handle)}`)
        },
      },
    )
    flash.show(prototype.shared)
    flash.show(prototype.copied)
    expect(calls).toStrictEqual([
      `report ${prototype.shared}`,
      `set ${prototype.ms}`,
      `report ${prototype.copied}`,
      'clear 2',
      `set ${prototype.ms}`,
    ])
  })

  test("W6 — the initial state's players, teamA, teamB, judgeIdx, rotateJudge and picked are seed.ts's room", () => {
    expect(STATE_BLOCKS).toHaveLength(1)

    const players = all(stateBody, PLAYERS)
    const teamA = all(stateBody, TEAM_A)
    const teamB = all(stateBody, TEAM_B)
    const judgeIndex = all(stateBody, JUDGE_INDEX)
    const rotate = all(stateBody, ROTATE)
    const picked = all(stateBody, PICKED)
    expect(
      [players, teamA, teamB, judgeIndex, rotate, picked].map((matches) => matches.length),
    ).toStrictEqual([1, 1, 1, 1, 1, 1])

    // players — five, in order, by name and team; the ids are seed.ts's own (the prototype's
    // players carry none).
    const list = only(players, 1)
    const entries = all(list, PLAYER)
    expect(all(list, OPENINGS)).toHaveLength(5)
    expect(entries).toHaveLength(5)
    const prototypePlayers = entries.map((m) => ({ name: group(m, 1), team: group(m, 2) }))
    expect(prototypePlayers).toStrictEqual([
      { name: 'ريم', team: 'a' },
      { name: 'سعد', team: 'b' },
      { name: 'نورة', team: 'a' },
      { name: 'خالد', team: 'b' },
      { name: 'ماجد', team: 'a' },
    ])
    expect(SEED_PLAYERS.map(({ name, team }) => ({ name, team }))).toStrictEqual(prototypePlayers)

    // teamA, teamB, judgeIdx, rotateJudge.
    expect([only(teamA, 1), only(teamB, 1)]).toStrictEqual(['النمور', 'الصقور'])
    expect(Number(only(judgeIndex, 1))).toBe(4)
    expect(only(rotate, 1)).toBe('false')
    expect(SEED_JUDGE_INDEX).toBe(Number(only(judgeIndex, 1)))

    // picked — category indices, through CATALOG's order.
    const indices = only(picked, 1)
      .split(',')
      .map((text) => Number(text.trim()))
    expect(indices).toStrictEqual([0, 1, 2, 3, 5, 6, 7, 10])
    expect(indices.map((i) => CATALOG[i]?.id)).toStrictEqual([...SEED_PICKED])

    // And the room seedRoom builds holds every one of them.
    const room = seedRoom('SKZJ62')
    expect(room.players.map(({ name, team }) => ({ name, team }))).toStrictEqual(prototypePlayers)
    expect([room.teamA, room.teamB]).toStrictEqual([only(teamA, 1), only(teamB, 1)])
    expect(room.judgeIndex).toBe(Number(only(judgeIndex, 1)))
    expect(String(room.rotateJudge)).toBe(only(rotate, 1))
    expect(room.pickedCategories).toStrictEqual(indices.map((i) => CATALOG[i]?.id))
    // The judge it names is the prototype's: players[judgeIdx].
    expect(currentJudge(room)?.name).toBe(prototypePlayers[Number(only(judgeIndex, 1))]?.name)
  })

  test("W7 — CATS' eleven names, emoji and locks are CATALOG's, in order", () => {
    expect(CATS_BLOCKS).toHaveLength(1)
    const lines = all(catsBody, CATEGORY_LINES).map((m) => group(m, 1))
    expect(lines).toHaveLength(11)
    expect(all(catsBody, QUESTION_LISTS)).toHaveLength(11)
    expect(all(catsBody, ANY_LOCKED)).toHaveLength(3)

    const categories = lines.map((line) => {
      const name = all(line, CATEGORY_NAME)
      const emoji = all(line, CATEGORY_EMOJI)
      const locked = all(line, CATEGORY_LOCKED)
      expect([name.length, emoji.length, all(line, QUESTION_LISTS).length]).toStrictEqual([1, 1, 1])
      expect(locked.length).toBeLessThanOrEqual(1)
      // The prototype reads `c.locked` for truth: a category without the key is not locked.
      return { name: only(name, 1), emoji: only(emoji, 1), locked: only(locked, 1) === 'true' }
    })
    expect(categories.filter(({ locked }) => locked).map(({ name }) => name)).toStrictEqual([
      'ثقافة',
      'فن',
      'أفلام',
    ])
    // 🏛️ with its variation selector, code point for code point.
    expect([...(categories[6]?.emoji ?? '')].map((c) => c.codePointAt(0))).toStrictEqual([
      0x1f3db, 0xfe0f,
    ])

    expect(CATALOG.map(({ name, emoji, locked }) => ({ name, emoji, locked }))).toStrictEqual(
      categories,
    )
    // And the setup screen's rail shows them, in that order.
    expect(
      setupView(seedRoom('SKZJ62'), CATALOG).tiles.map(({ name, emoji, locked }) => ({
        name,
        emoji,
        locked,
      })),
    ).toStrictEqual(categories)
  })

  test("W8 — startClock's interval, `}, 100)`, is TICK_MS, and one callback drains TICK_MS", () => {
    expect(START_CLOCK_BLOCKS).toHaveLength(1)
    // One interval timer in the whole class, and it is startClock's.
    expect(all(classBody, SET_INTERVAL)).toHaveLength(1)
    expect(all(startClockBody, SET_INTERVAL)).toHaveLength(1)

    const interval = all(startClockBody, INTERVAL_MS)
    const drain = all(startClockBody, DRAIN_SECONDS)
    expect([interval.length, drain.length]).toStrictEqual([1, 1])
    expect(Number(only(interval, 1))).toBe(100)
    expect(only(drain, 1)).toBe('0.1')

    // The driver's loop is the prototype's: every TICK_MS of the timer, a tick of TICK_MS.
    expect(TICK_MS).toBe(Number(only(interval, 1)))
    expect(TICK_MS).toBe(Number(only(drain, 1)) * 1000)
  })

  test("W9 — the prototype's <title>, 'نلعب — لعبة المعلومات', is page.tsx's metadata title", () => {
    const found = all(PROTOTYPE, PAGE_TITLE)
    expect(found).toHaveLength(1)
    expect(only(found, 1)).toBe('نلعب — لعبة المعلومات')
    expect(metadata.title).toBe(only(found, 1))
  })
})
