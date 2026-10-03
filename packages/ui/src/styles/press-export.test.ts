import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import pressBySubpath from '@nel3ab/ui/press.module.css'

import { Button } from '../primitives/Button.js'
import press from './press.module.css'

// REQ-5.23 — specs/phase-5/specs.md §2.8, specs/phase-5/verification.md
// Gate 3, "The press, importable". A screen that is not a Button (room-ready's
// share button) presses by the one press rule through
// `@nel3ab/ui/press.module.css` rather than by a copy of it — a second copy is
// how the press drifts (REQ-2.8).
//
// The import above is the package's own subpath, resolved through the
// manifest's `exports` exactly as apps/web resolves it. CSS Modules name a
// class after the file it comes from, so the subpath yields Button's class
// only if it reaches the same file: one rule, not two.
//
// A .ts file, not .tsx: the one render uses createElement.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const packageRoot = (relative: string) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url))

const manifest = JSON.parse(readFileSync(packageRoot('package.json'), 'utf8')) as {
  name: string
  exports: Record<string, string>
}

test('the manifest exports exactly four entries, the press last', () => {
  expect(manifest.name).toBe('@nel3ab/ui')
  expect(Object.keys(manifest.exports)).toStrictEqual([
    '.',
    './tokens.css',
    './base.css',
    './press.module.css',
  ])
})

test('the subpath points at styles/press.module.css, which exists', () => {
  const target = manifest.exports['./press.module.css']
  expect(target).toBe('./src/styles/press.module.css')
  expect(existsSync(packageRoot(target!))).toBe(true)
  expect(packageRoot(target!)).toBe(fileURLToPath(new URL('./press.module.css', import.meta.url)))
})

test('@nel3ab/ui/press.module.css yields the same press class Button applies', () => {
  expect(pressBySubpath.press, 'the subpath exports no `press` class').toBeTruthy()
  expect(pressBySubpath.press).toBe(press.press)

  const markup = renderToStaticMarkup(createElement(Button, null, 'ابدأ'))
  const classes = /^<button[^>]*\sclass="([^"]*)"/.exec(markup)?.[1]?.split(' ') ?? []
  expect(classes).toContain(pressBySubpath.press)
})
