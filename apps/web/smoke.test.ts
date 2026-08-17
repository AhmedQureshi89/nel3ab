import { expect, test } from 'vitest'

import { PLACEHOLDER } from '@nel3ab/ui'

// Deliberately trivial. The rendered `<html lang="ar" dir="rtl">` assertion is
// REQ-1.4's work (verification Gate 4) and is not built here. This test exists
// so that nel3ab-web is one of the six projects Vitest collects, and so that a
// dropped project is visible as a missing file in the collected count.
test('nel3ab-web resolves a workspace dependency under the test runner', () => {
  expect(PLACEHOLDER).toBe(true)
})
