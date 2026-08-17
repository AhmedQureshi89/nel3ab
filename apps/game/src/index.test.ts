import { expect, test } from 'vitest'

import { PLACEHOLDER as CONTENT } from '@nel3ab/content'
import { PLACEHOLDER as GAME } from '@nel3ab/game'
import { PLACEHOLDER as PROTOCOL } from '@nel3ab/protocol'

import { PLACEHOLDER } from './index.js'

test('nel3ab-game exposes its shell export', () => {
  expect(PLACEHOLDER).toBe(true)
})

test('nel3ab-game resolves its three workspace dependencies', () => {
  expect([GAME, PROTOCOL, CONTENT]).toEqual([true, true, true])
})
