import { expect, test } from 'vitest'

import { PLACEHOLDER } from './index.js'

test('@nel3ab/content exposes its shell export', () => {
  expect(PLACEHOLDER).toBe(true)
})
