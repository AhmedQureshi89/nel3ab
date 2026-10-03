import { expect, test } from 'vitest'

import * as clock from './clock.js'
import * as draw from './draw.js'
import * as game from './index.js'
import * as match from './match.js'
import * as room from './room.js'
import * as setup from './setup.js'

// specs/phase-3/specs.md §2.6–§2.7, NFR-3.5. This file used to assert the
// Phase 1 shell's `PLACEHOLDER`; it is updated rather than deleted, because
// scripts/check-collected-tests.mjs needs a collected file in every workspace
// project (CLAUDE.md invariant 2, NFR-3.4).
//
// The export set is asserted exactly, not as "at least these": an internal
// helper leaking into the public surface is as much a change to the package's
// contract as a rule going missing. The list is written out here, not derived
// from the modules, so an export added to index.ts fails this test until the
// list — and specs.md §2.6 — say so too.
test('@nel3ab/game exports exactly the twenty-one names of specs.md §2.6, specs/phase-4/specs.md §2.8 and specs/phase-5/specs.md §2.5', () => {
  expect(Object.keys(game).sort()).toStrictEqual([
    'HINT_COST_MS',
    'REVEAL_HOLD_MS',
    'ROUND_SECONDS_DEFAULT',
    'ROUND_SECONDS_OPTIONS',
    'SKIP_COST_MS',
    'TEAM_NAMES',
    'WINS_NEEDED_DEFAULT',
    'WINS_NEEDED_OPTIONS',
    'acceptsJudgeActions',
    'canOpenRoom',
    'createRoom',
    'currentJudge',
    'currentQuestion',
    'displaySeconds',
    'drawCategory',
    'drawableCategories',
    'matchWinner',
    'reduce',
    'remainingMs',
    'shuffleQuestions',
    'shuffleTeamName',
  ])
})

test('each function export is a function, and each rule constant is a value', () => {
  const kinds = Object.fromEntries(
    Object.entries(game).map(([name, value]) => [name, typeof value]),
  )
  expect(kinds).toStrictEqual({
    HINT_COST_MS: 'number',
    REVEAL_HOLD_MS: 'number',
    ROUND_SECONDS_DEFAULT: 'number',
    ROUND_SECONDS_OPTIONS: 'object',
    SKIP_COST_MS: 'number',
    TEAM_NAMES: 'object',
    WINS_NEEDED_DEFAULT: 'number',
    WINS_NEEDED_OPTIONS: 'object',
    acceptsJudgeActions: 'function',
    canOpenRoom: 'function',
    createRoom: 'function',
    currentJudge: 'function',
    currentQuestion: 'function',
    displaySeconds: 'function',
    drawCategory: 'function',
    drawableCategories: 'function',
    matchWinner: 'function',
    reduce: 'function',
    remainingMs: 'function',
    shuffleQuestions: 'function',
    shuffleTeamName: 'function',
  })
})

test('the Phase 1 shell export is gone', () => {
  expect('PLACEHOLDER' in game).toBe(false)
})

// The exact list above already excludes these; this test names them, because
// each is exported from its own module for the reducer and is one careless
// `export *` away from the public surface (specs.md §2.3's internal table and
// §2.4's `liveQuestion`). Each is first shown to exist in its module, so its
// absence from the package is not vacuous. Phase 4 adds its nine under the same
// title (specs/phase-4/specs.md §2.8): clock.ts's `otherTeam` and `passClock`,
// draw.ts's `unusedCategories` and `nextRoundChoices`, and match.ts's
// `startingTeam`, `nextJudgeIndex`, `assertRoundPayload`, `beginRound` and `scoreRound`.
// Phase 5 adds setup.ts's five (specs/phase-5/specs.md §2.5): `FILL_NAMES`,
// `playerIndex`, `judgeAfterRemoval`, `fillPlayers` and `assertSetupAction`.
test('the clock transitions and liveQuestion stay internal to the package', () => {
  const internal = [
    ['roundMs', clock],
    ['startClock', clock],
    ['settleActive', clock],
    ['stopClock', clock],
    ['zeroActive', clock],
    ['liveQuestion', room],
    ['otherTeam', clock],
    ['passClock', clock],
    ['unusedCategories', draw],
    ['nextRoundChoices', draw],
    ['startingTeam', match],
    ['nextJudgeIndex', match],
    ['assertRoundPayload', match],
    ['beginRound', match],
    ['scoreRound', match],
    ['FILL_NAMES', setup],
    ['playerIndex', setup],
    ['judgeAfterRemoval', setup],
    ['fillPlayers', setup],
    ['assertSetupAction', setup],
  ] as const
  for (const [name, source] of internal) {
    expect(name in source, `${name} in its module`).toBe(true)
    expect(name in game, `${name} in @nel3ab/game`).toBe(false)
  }
})
