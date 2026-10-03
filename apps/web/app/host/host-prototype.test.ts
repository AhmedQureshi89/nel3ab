import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { currentJudge } from '@nel3ab/game'
import { describe, expect, test } from 'vitest'

import { CATALOG } from './_lib/catalog'
import { SEED_JUDGE_INDEX, SEED_PICKED, SEED_PLAYERS, seedRoom } from './_lib/seed'

// REQ-5.22 — specs/phase-5/verification.md Gate 4, "The words and the driver's numbers, read from
// the prototype". See specs.md §2.12 (this file's row: extractions W1–W9).
//
// Each extraction is read from design/designs/Nel3ab - Arcade.dc.html when the test runs, its
// match count asserted — so an extraction that finds nothing fails rather than passing vacuously —
// and asserted equal to what the app renders or holds. design/ is never edited (CLAUDE.md
// invariant 5, NFR-5.1), so this file goes red only when the app drifts from the prototype.
//
// The extractions land with the units that build what they are asserted against, each box of
// Gate 4 that names one asserting it here: W6 (the initial `state`) with the seed, REQ-5.10.
// REQ-5.22's own box is ticked only when all nine — W1–W9 — are in this file.
//
// The reader is Phases 3–5's (packages/game/src/setup-rules.test.ts): small regular expressions
// over the prototype's one logic script and its component class; no HTML or JavaScript parser.
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

describe("REQ-5.22: the screens' words and the driver's numbers, read from the prototype", () => {
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
})
