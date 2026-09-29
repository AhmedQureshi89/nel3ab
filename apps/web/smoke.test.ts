import { expect, test } from 'vitest'

import { Panel } from '@nel3ab/ui'

// Deliberately trivial. The rendered `<html lang="ar" dir="rtl">` assertion is
// REQ-1.4's work (verification Gate 4) and is not built here. This test exists
// so that nel3ab-web is one of the six projects Vitest collects, and so that a
// dropped project is visible as a missing file in the collected count.
//
// It imports a real primitive (specs/phase-2/specs.md §2.8), so it now also
// proves that a .tsx and its .module.css in packages/ui resolve under this
// project's own transform, not only under packages/ui's.
test('nel3ab-web resolves a workspace dependency under the test runner', () => {
  expect(typeof Panel).toBe('function')
})
