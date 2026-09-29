import { expect, test } from 'vitest'

import * as ui from './index.js'

// specs/phase-2/specs.md §2.8. This file used to assert the Phase 1 shell's
// `PLACEHOLDER`; it is updated rather than deleted, because
// scripts/check-collected-tests.mjs needs a collected file in every workspace
// project (CLAUDE.md invariant 2, NFR-2.5).
//
// The export set is asserted exactly, not as "at least these": an internal
// helper leaking into the public surface is as much a change to the package's
// contract as a primitive going missing.
test('@nel3ab/ui exports exactly its primitives, each a component', () => {
  expect(Object.keys(ui).sort()).toStrictEqual(['Button', 'Card', 'Dot', 'Panel', 'Pill'])
  for (const [name, value] of Object.entries(ui)) {
    expect(typeof value, name).toBe('function')
  }
})

test('the Phase 1 shell export is gone', () => {
  expect('PLACEHOLDER' in ui).toBe(false)
})
