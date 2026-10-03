import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { reduce } from './reducer.js'
import { createRoom } from './room.js'
import { TEAM_NAMES } from './rules.js'
import {
  canOpenRoom,
  currentJudge,
  FILL_NAMES,
  judgeAfterRemoval,
  shuffleTeamName,
} from './setup.js'
import type { CategoryId, Player, RoomState, Team } from './types.js'

// REQ-5.8 — specs/phase-5/verification.md Gate 1, "The setup rules, read from the
// prototype". See specs/phase-5/requirements.md REQ-5.8 and specs.md §2.7 (this
// file's row).
//
// Phase 3's rules.test.ts read a round's numbers from the prototype and Phase
// 4's match-rules.test.ts its match flow; this file reads its setup. Each of the
// nine extractions of Gate 1's table is read from
// design/designs/Nel3ab - Arcade.dc.html when the test runs, and asserted three
// ways:
//   1. its MATCH COUNT, against the table's Count column — so an extraction that
//      finds nothing fails, rather than passing vacuously;
//   2. its value, against the literals of the table's own snippet;
//   3. driving the engine as the table's Drives column says: the engine runs, and
//      its result is compared with what the EXTRACTED rule, applied to the same
//      input, says it should be — never with a number written into this file.
//
// E9 is the one row that asserts a departure: the prototype's silent default
// selection, which the zero-category guard replaces (requirements.md, reading 1).
// It is pinned so that the departure stays a recorded decision, and what it
// drives is the guard.
//
// design/ is never edited (CLAUDE.md invariant 5, NFR-5.1), so this file can go
// red only by the engine drifting — never by the reference moving.
//
// The reader is Phases 3–4's: small regular expressions over the prototype's one
// logic script and its component class split into members; no HTML or
// JavaScript parser. The path resolves from import.meta.url, not the working
// directory: each Vitest project sets its own `root`. The file name has spaces,
// which `URL` percent-encodes and fileURLToPath decodes.

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

/** A class member's first line, exactly as Phases 3–4's reader defines it. */
const headers = all(classBody, /^ {2}(?:get )?([A-Za-z_$][\w$]*)\s*[=(]/gm)

/** Each member's source, from its header to the next member's: a partition of the class body. */
const members: ReadonlyMap<string, string> = new Map(
  headers.map((header, i) => [
    group(header, 1),
    classBody.slice(header.index, headers[i + 1]?.index ?? classBody.length),
  ]),
)
const member = (name: string): string => members.get(name) ?? ''

/** The members whose bodies this file reads. */
const MEMBERS_READ = [
  'removePlayer',
  'swapTeam',
  'shuffleName',
  'toggleCat',
  'startGame',
  'backToSetup',
  'judge',
]

/** The single-quoted strings of a list's text, in order. */
const quoted = (text: string): string[] => all(text, /'([^']*)'/g).map((m) => group(m, 1))

// --- the patterns, one or more per extraction (verification.md Gate 1's table) --

/** E1 — `const NAMES_X = [ … ];`, capturing the list's text. */
const NAMES_A = /^const NAMES_A\s*=\s*\[([^\]]*)\]\s*;/gm
const NAMES_B = /^const NAMES_B\s*=\s*\[([^\]]*)\]\s*;/gm

/** E2 — removePlayer's judge line, capturing the comparison, the floor and the step. */
const REMOVAL =
  /judgeIdx\s*:\s*s\.judgeIdx\s*(>=|>)\s*i\s*&&\s*s\.judgeIdx\s*>\s*(\d+)\s*\?\s*s\.judgeIdx\s*-\s*(\d+)\s*:\s*s\.judgeIdx\b/g

/** E3 — startGame's replacement: `if(players.length < N) players = [{…}, {…}]`. */
const FILL_REPLACE =
  /if\s*\(\s*players\.length\s*<\s*(\d+)\s*\)\s*players\s*=\s*\[\s*\{\s*name\s*:\s*'([^']*)'\s*,\s*team\s*:\s*'([ab])'\s*\}\s*,\s*\{\s*name\s*:\s*'([^']*)'\s*,\s*team\s*:\s*'([ab])'\s*\}\s*\]/g
/** E3 — the per-team pass: `['x','y'].forEach(t => { if(players.some(p => p.team === t)) return;`. */
const FILL_TEAMS =
  /\[\s*'([ab])'\s*,\s*'([ab])'\s*\]\.forEach\(\s*t\s*=>\s*\{\s*if\s*\(\s*players\.some\(\s*p\s*=>\s*p\.team\s*===\s*t\s*\)\s*\)\s*return\s*;/g
/** E3 — the name it appends: `name: t === 'a' ? 'X' : 'Y'`. */
const FILL_APPEND = /name\s*:\s*t\s*===\s*'a'\s*\?\s*'([^']*)'\s*:\s*'([^']*)'/g

/** E4 — toggleCat: `s.picked.includes(i) ? s.picked.filter(x => x !== i) : [ … ]`, capturing the new list. */
const TOGGLE =
  /s\.picked\.includes\(\s*i\s*\)\s*\?\s*s\.picked\.filter\(\s*x\s*=>\s*x\s*!==\s*i\s*\)\s*:\s*\[\s*([^\]]*?)\s*\]/g

/** E5 — shuffleName's redraw: `while(next === cur) next = list[Math.floor(Math.random() * list.length)]`. */
const REDRAW =
  /while\s*\(\s*next\s*(===|!==)\s*cur\s*\)\s*next\s*=\s*list\[\s*Math\.floor\(\s*Math\.random\(\)\s*\*\s*list\.length\s*\)\s*\]/g
/** E5 — which list each team shuffles through. */
const LIST_CHOICE = /const list\s*=\s*team\s*===\s*'a'\s*\?\s*(NAMES_[AB])\s*:\s*(NAMES_[AB])/g

/** E6 — the judge getter's two lines. */
const NO_JUDGE = /if\s*\(\s*!p\.length\s*\)\s*return\s+null\s*;/g
const JUDGE_PICK = /p\[\s*this\.state\.judgeIdx\s*%\s*p\.length\s*\]\s*\|\|\s*p\[\s*(\d+)\s*\]/g

/** E7 — a `this.setState({…})` whose argument is one flat object literal, capturing its body. */
const SET_STATE = /this\.setState\(\s*\{([^{}]*)\}/g

/** E8 — swapTeam's flip: `idx === i ? {...p, team: p.team === 'x' ? 'y' : 'z'} : p`. */
const FLIP =
  /idx\s*===\s*i\s*\?\s*\{\s*\.\.\.p\s*,\s*team\s*:\s*p\.team\s*===\s*'([ab])'\s*\?\s*'([ab])'\s*:\s*'([ab])'\s*\}\s*:\s*p\b/g

/** E9 — startGame's default selection: `this.state.picked.length ? this.state.picked : [ … ]`. */
const DEFAULT_PICK = /this\.state\.picked\.length\s*\?\s*this\.state\.picked\s*:\s*\[([^\]]*)\]/g

// --- rooms ------------------------------------------------------------------------

/** A setup room with `count` players p1…pN on the given teams (default all `a`). */
const roomWith = (teams: readonly Team[], fields: Partial<RoomState> = {}): RoomState => ({
  ...createRoom({ roomCode: 'TEST05', teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] }),
  players: teams.map((team, i) => ({ id: `p${i + 1}`, name: `p${i + 1}`, team })),
  pickedCategories: ['c0'],
  ...fields,
})

/** Every assignment of teams to `count` players. */
const assignments = (count: number): Team[][] =>
  count === 0
    ? [[]]
    : assignments(count - 1).flatMap((rest) => [['a', ...rest] as Team[], ['b', ...rest] as Team[]])

/** A player as the prototype holds one — name and team, no id. */
const shape = (player: Player): { readonly name: string; readonly team: Team } => ({
  name: player.name,
  team: player.team,
})

// ============================================================================
// The reader itself
// ============================================================================

test('the reader finds the one logic script, its component class, and every member this file reads', () => {
  expect(SCRIPTS).toHaveLength(1)
  expect(CLASSES).toHaveLength(1)
  for (const name of MEMBERS_READ) expect(member(name), name).not.toBe('')
})

// ============================================================================
// The nine extractions
// ============================================================================

describe('REQ-5.8: the setup rules, read from the prototype', () => {
  test('E1 — NAMES_A and NAMES_B, once each, are TEAM_NAMES; the shuffle stays inside them; a room’s defaults are their first', () => {
    const a = all(script, NAMES_A)
    const b = all(script, NAMES_B)
    expect([a.length, b.length]).toStrictEqual([1, 1])
    const listA = quoted(a[0] === undefined ? '' : group(a[0], 1))
    const listB = quoted(b[0] === undefined ? '' : group(b[0], 1))
    expect(listA).toStrictEqual(['النمور', 'الأسود', 'الذئاب', 'النسور'])
    expect(listB).toStrictEqual(['الصقور', 'الفهود', 'الأبطال', 'النجوم'])
    expect([...TEAM_NAMES.a]).toStrictEqual(listA)
    expect([...TEAM_NAMES.b]).toStrictEqual(listB)

    for (const list of [listA, listB]) {
      for (const current of list) {
        for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
          expect(list).toContain(shuffleTeamName(current, list, () => r))
        }
      }
    }
    const fresh = createRoom({ roomCode: 'TEST05', teamA: TEAM_NAMES.a[0], teamB: TEAM_NAMES.b[0] })
    expect([fresh.teamA, fresh.teamB]).toStrictEqual([listA[0], listB[0]])
  })

  test('E2 — removePlayer’s judge line, once, is judgeAfterRemoval and drives removePlayer, for judge 0–9 × removed 0–9', () => {
    const found = all(member('removePlayer'), REMOVAL)
    expect([found.length, all(script, REMOVAL).length]).toStrictEqual([1, 1])
    const [match] = found
    if (match === undefined) return
    const comparison = group(match, 1)
    const floor = Number(group(match, 2))
    const step = Number(group(match, 3))
    expect({ comparison, floor, step }).toStrictEqual({ comparison: '>=', floor: 0, step: 1 })

    const prototype = (judge: number, removed: number): number =>
      (comparison === '>=' ? judge >= removed : judge > removed) && judge > floor
        ? judge - step
        : judge
    const ten: Team[] = Array.from({ length: 10 }, () => 'a')
    for (let judge = 0; judge < 10; judge += 1) {
      for (let removed = 0; removed < 10; removed += 1) {
        const expected = prototype(judge, removed)
        expect(judgeAfterRemoval(judge, removed), `${judge} − ${removed}`).toBe(expected)
        const next = reduce(roomWith(ten, { judgeIndex: judge }), {
          type: 'removePlayer',
          playerId: `p${removed + 1}`,
        })
        expect(next.judgeIndex, `reduce: ${judge} − ${removed}`).toBe(expected)
      }
    }
  })

  test('E3 — startGame’s fill, once, is FILL_NAMES and the fill openRoom applies, at 0–3 players on every team assignment', () => {
    const replace = all(member('startGame'), FILL_REPLACE)
    const teams = all(member('startGame'), FILL_TEAMS)
    const append = all(member('startGame'), FILL_APPEND)
    expect([replace.length, teams.length, append.length]).toStrictEqual([1, 1, 1])
    const [r] = replace
    const [t] = teams
    const [n] = append
    if (r === undefined || t === undefined || n === undefined) return

    const threshold = Number(group(r, 1))
    const seeded = [
      { name: group(r, 2), team: group(r, 3) as Team },
      { name: group(r, 4), team: group(r, 5) as Team },
    ]
    const order = [group(t, 1), group(t, 2)] as Team[]
    const appended = { a: group(n, 1), b: group(n, 2) }
    expect({ threshold, seeded, order, appended }).toStrictEqual({
      threshold: 2,
      seeded: [
        { name: 'لاعب ١', team: 'a' },
        { name: 'لاعب ٢', team: 'b' },
      ],
      order: ['a', 'b'],
      appended: { a: 'لاعب ١', b: 'لاعب ٢' },
    })
    expect(FILL_NAMES).toStrictEqual(appended)

    // The prototype's fill, built from what was extracted, over name-and-team shapes.
    const prototypeFill = (
      list: readonly { readonly name: string; readonly team: Team }[],
    ): { readonly name: string; readonly team: Team }[] => {
      let players = list.length < threshold ? seeded : list.slice()
      for (const team of order) {
        if (players.some((p) => p.team === team)) continue
        players = [...players, { name: appended[team], team }]
      }
      return players
    }
    for (let count = 0; count <= 3; count += 1) {
      for (const assignment of assignments(count)) {
        const before = roomWith(assignment)
        const opened = reduce(before, { type: 'openRoom' })
        expect(opened.players.map(shape), assignment.join('') || '(none)').toStrictEqual(
          prototypeFill(before.players.map(shape)),
        )
      }
    }
  })

  test('E4 — toggleCat, once, appends a pick and filters an unpick; pickCategory keeps the same order over a toggle sequence', () => {
    const found = all(member('toggleCat'), TOGGLE)
    expect(found).toHaveLength(1)
    const [match] = found
    if (match === undefined) return
    const added = group(match, 1).replace(/\s+/g, '')
    expect(added).toBe('...s.picked,i')
    const appends = added.startsWith('...')

    const prototypeToggle = (picked: readonly number[], i: number): number[] =>
      picked.includes(i) ? picked.filter((x) => x !== i) : appends ? [...picked, i] : [i, ...picked]
    const id = (i: number): CategoryId => `c${i}`
    const toggles = [3, 0, 7, 3, 10, 0, 5, 3, 1, 7, 2, 10]
    let picked: number[] = []
    let state = roomWith(['a', 'b'], { pickedCategories: [] })
    for (const i of toggles) {
      picked = prototypeToggle(picked, i)
      state = reduce(state, {
        type: 'pickCategory',
        categoryId: id(i),
        picked: !state.pickedCategories.includes(id(i)),
      })
      expect(state.pickedCategories, `after toggling ${i}`).toStrictEqual(picked.map(id))
    }
  })

  test('E5 — shuffleName redraws while the name is unchanged, once; shuffleTeamName never returns it, and reaches every other name', () => {
    const redraws = all(member('shuffleName'), REDRAW)
    const choices = all(member('shuffleName'), LIST_CHOICE)
    expect([redraws.length, choices.length]).toStrictEqual([1, 1])
    const [redraw] = redraws
    const [choice] = choices
    if (redraw === undefined || choice === undefined) return
    expect(group(redraw, 1)).toBe('===')
    expect([group(choice, 1), group(choice, 2)]).toStrictEqual(['NAMES_A', 'NAMES_B'])

    for (const list of [TEAM_NAMES.a, TEAM_NAMES.b]) {
      for (const current of list) {
        const others = list.filter((name) => name !== current)
        // A value in the middle of each of the others' equal slices of [0, 1).
        const reached = others.map((_, k) =>
          shuffleTeamName(current, list, () => (k + 0.5) / others.length),
        )
        expect(reached, current).toStrictEqual(others)
        for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
          expect(
            shuffleTeamName(current, list, () => r),
            `${current} at ${r}`,
          ).not.toBe(current)
        }
      }
    }
  })

  test('E6 — the judge getter, once, is currentJudge, at 0–6 players × index 0–9', () => {
    const none = all(member('judge'), NO_JUDGE)
    const picks = all(member('judge'), JUDGE_PICK)
    expect([none.length, picks.length]).toStrictEqual([1, 1])
    const [pick] = picks
    if (pick === undefined) return
    const fallback = Number(group(pick, 1))
    expect(fallback).toBe(0)

    const prototypeJudge = (players: readonly Player[], judgeIdx: number): Player | null => {
      if (!players.length) return null
      return players[judgeIdx % players.length] ?? players[fallback] ?? null
    }
    for (let count = 0; count <= 6; count += 1) {
      const teams: Team[] = Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 'a' : 'b'))
      for (let judgeIndex = 0; judgeIndex < 10; judgeIndex += 1) {
        const state = roomWith(teams, { judgeIndex })
        expect(currentJudge(state), `${count} players, index ${judgeIndex}`).toBe(
          prototypeJudge(state.players, judgeIndex),
        )
      }
    }
  })

  test('E7 — startGame moves to the screen openRoom moves to; backToSetup sets the screen and nothing else, as the reducer does', () => {
    const start = all(member('startGame'), SET_STATE)
    const back = all(member('backToSetup'), SET_STATE)
    expect([start.length, back.length]).toStrictEqual([1, 1])
    const [s] = start
    const [b] = back
    if (s === undefined || b === undefined) return
    const fields = (body: string): Map<string, string> =>
      new Map(
        body.split(',').map((part) => {
          const at = part.indexOf(':')
          return at < 0
            ? [part.trim(), part.trim()]
            : [part.slice(0, at).trim(), part.slice(at + 1).trim()]
        }),
      )
    const startFields = fields(group(s, 1))
    const backFields = fields(group(b, 1))
    // startGame sets the fill's players (E3), the default selection the guard
    // replaces (E9), the screen, and `copied` — the share flash, which is the
    // judge app's own state, not the room's.
    expect([...startFields.keys()]).toStrictEqual(['players', 'picked', 'screen', 'copied'])
    expect(startFields.get('screen')).toBe("'ready'")
    expect([...backFields]).toStrictEqual([['screen', "'setup'"]])

    const changed = (before: RoomState, after: RoomState): string[] =>
      Object.keys(after).filter(
        (key) =>
          new Map<string, unknown>(Object.entries(after)).get(key) !==
          new Map<string, unknown>(Object.entries(before)).get(key),
      )
    const setup = roomWith(['a', 'b'])
    const ready = reduce(setup, { type: 'openRoom' })
    expect(changed(setup, ready)).toStrictEqual(['screen'])
    expect(`'${ready.screen}'`).toBe(startFields.get('screen'))
    const back2 = reduce(ready, { type: 'backToSetup' })
    expect(changed(ready, back2)).toStrictEqual([...backFields.keys()])
    expect(`'${back2.screen}'`).toBe(backFields.get('screen'))
  })

  test('E8 — swapTeam’s flip, once, is the flip swapTeam applies, to every player of a mixed room', () => {
    const found = all(member('swapTeam'), FLIP)
    expect(found).toHaveLength(1)
    const [match] = found
    if (match === undefined) return
    const flip = { when: group(match, 1), then: group(match, 2), otherwise: group(match, 3) }
    expect(flip).toStrictEqual({ when: 'a', then: 'b', otherwise: 'a' })
    const prototypeFlip = (team: Team): Team =>
      (team === flip.when ? flip.then : flip.otherwise) as Team

    const state = roomWith(['a', 'b', 'a', 'b', 'a'])
    state.players.forEach((player, i) => {
      const next = reduce(state, { type: 'swapTeam', playerId: player.id })
      expect(
        next.players.map((p) => p.team),
        player.id,
      ).toStrictEqual(state.players.map((p, k) => (k === i ? prototypeFlip(p.team) : p.team)))
    })
  })

  test('E9 — startGame’s default selection, once, is the line the guard replaces: with nothing picked the room does not open', () => {
    const found = all(member('startGame'), DEFAULT_PICK)
    expect(found).toHaveLength(1)
    const [match] = found
    if (match === undefined) return
    expect(group(match, 1).replace(/\s+/g, '')).toBe('0,1,2')

    const empty = roomWith(['a', 'b'], { pickedCategories: [] })
    expect(canOpenRoom(empty)).toBe(false)
    expect(reduce(empty, { type: 'openRoom' })).toBe(empty)
  })
})
