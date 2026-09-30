import { expect, test } from 'vitest'

import { PLACEHOLDER as CONTENT } from '@nel3ab/content'
import { createRoom } from '@nel3ab/game'
import { PLACEHOLDER as PROTOCOL } from '@nel3ab/protocol'

import { PLACEHOLDER } from './index.js'

test('nel3ab-game exposes its shell export', () => {
  expect(PLACEHOLDER).toBe(true)
})

// Phase 3 removed @nel3ab/game's Phase 1 `PLACEHOLDER` (specs/phase-3/specs.md
// §2.7, NFR-3.4), so a real export stands in for it: the test still proves
// that all three workspace dependencies resolve. It is updated rather than
// deleted, because scripts/check-collected-tests.mjs needs a collected file in
// every workspace project (CLAUDE.md invariant 2).
test('nel3ab-game resolves its three workspace dependencies', () => {
  expect([typeof createRoom, PROTOCOL, CONTENT]).toEqual(['function', true, true])
})
