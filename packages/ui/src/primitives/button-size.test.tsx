import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { Button } from './Button.js'

// REQ-5.23 — specs/phase-5/specs.md §2.8, specs/phase-5/verification.md
// Gate 3, "A 19 px primary". A new file: Phase 2's
// primitives.test.tsx is not edited (NFR-5.4), and it still asserts the
// primary rule's declarations exactly, `font-size: 20px` among them.
//
// Two halves, as primitives.test.tsx has: the rendered attribute (no class
// name typed in — they are hashed), and the CSS text, rule by rule.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const read = (relativeToRepoRoot: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8')

// --- the attribute -------------------------------------------------------------

/** The rendered root element's attributes. */
const attributes = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element)
  const open = /^<button([^>]*)>/.exec(markup)
  expect(open, `no <button> root in ${markup}`).not.toBeNull()
  return Object.fromEntries(
    [...open![1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name!, value!]),
  )
}

const variants = ['primary', 'secondary', 'action'] as const
/** `undefined` is the prop left out. */
const sizes = [undefined, 'lg', 'md'] as const

describe('Button size', () => {
  test('the default is lg, emitted as data-size="lg"', () => {
    expect(attributes(<Button>ابدأ</Button>)).toMatchObject({
      'data-variant': 'primary',
      'data-size': 'lg',
    })
  })

  test('size="md" is emitted as data-size="md"', () => {
    expect(attributes(<Button size="md">ابدأ الجولة الأولى</Button>)).toMatchObject({
      'data-variant': 'primary',
      'data-size': 'md',
    })
    expect(attributes(<Button size="lg" />)['data-size']).toBe('lg')
  })

  // "emitted as data-size={size} on every Button" — the attribute is not
  // primary-only; the stylesheet is what gives it meaning on primary alone.
  test.each(variants.flatMap((variant) => sizes.map((size) => [variant, size] as const)))(
    '%s, size %s',
    (variant, size) => {
      const element =
        size === undefined ? <Button variant={variant} /> : <Button variant={variant} size={size} />
      expect(attributes(element)).toMatchObject({
        'data-variant': variant,
        'data-size': size ?? 'lg',
      })
    },
  )
})

// --- the CSS -------------------------------------------------------------------

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** `[selector, { property: value }]` in file order, for a flat stylesheet. */
const rules = (css: string) =>
  [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => {
    const declarations: Record<string, string> = {}
    for (const [, name, value] of body!.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      declarations[name!.trim()] = value!.trim()
    }
    return [selector!.trim().replace(/\s+/g, ' '), declarations] as const
  })

const BUTTON_RULES = rules(read('packages/ui/src/primitives/Button.module.css'))
const PRIMARY = ".button[data-variant='primary']"
const PRIMARY_MD = ".button[data-variant='primary'][data-size='md']"
const PRIMARY_HOVER = ".button[data-variant='primary']:hover:not(:disabled, [aria-disabled='true'])"

const rule = (selector: string) => {
  const found = BUTTON_RULES.find(([s]) => s === selector)
  expect(found, `Button.module.css has no rule for ${selector}`).toBeDefined()
  return found![1]
}

test('one rule, primary md: font-size 19px and nothing else', () => {
  expect(rule(PRIMARY_MD)).toStrictEqual({ 'font-size': '19px' })
})

test('the primary rule still declares font-size 20px — lg is the default and untouched', () => {
  expect(rule(PRIMARY)['font-size']).toBe('20px')
})

test('the size rule sits after the primary rule and before its hover', () => {
  const at = (selector: string) => BUTTON_RULES.findIndex(([s]) => s === selector)
  expect(at(PRIMARY)).toBeGreaterThanOrEqual(0)
  expect(at(PRIMARY_MD)).toBe(at(PRIMARY) + 1)
  expect(at(PRIMARY_HOVER)).toBe(at(PRIMARY_MD) + 1)
})

test('data-size reaches the stylesheet in exactly one rule, and only on primary', () => {
  // "size has no effect on the other two variants" (specs.md §2.8).
  const sized = BUTTON_RULES.filter(([selector]) => selector.includes('data-size'))
  expect(sized.map(([selector]) => selector)).toStrictEqual([PRIMARY_MD])
})

test('19px is the prototype’s room-ready CTA, which is otherwise the 20px primary', () => {
  // design/designs/Nel3ab - Arcade.dc.html, the one button labelled
  // "ابدأ الجولة الأولى". Read at run time: design/ is the reference of record
  // and is never edited, so this goes red only if the stylesheet drifts.
  const prototype = read('design/designs/Nel3ab - Arcade.dc.html')
  const ctas = [
    ...prototype.matchAll(
      /<button[^>]*\sstyle="([^"]*)"[^>]*><span>ابدأ الجولة الأولى<\/span><span>▶<\/span><\/button>/g,
    ),
  ]
  expect(ctas).toHaveLength(1)
  const style = ctas[0]![1]!
  const fontSize = /(?:^|;)font-size:([\d.]+px);/.exec(style)
  expect(fontSize, `no font-size in ${style}`).not.toBeNull()
  expect(rule(PRIMARY_MD)['font-size']).toBe(fontSize![1])

  // The rest of it is the primary Button (whose every value Phase 2's
  // primitives.test.tsx asserts), so the size is the difference.
  expect(style).toContain('padding:17px 20px;')
  expect(style).toContain('font-weight:800;')
  expect(style).toContain('box-shadow:0 6px 0 var(--stroke);')
  expect(rule(PRIMARY)).toMatchObject({
    'padding-block': '17px',
    'padding-inline': '20px',
    'font-weight': '800',
    '--press-rest': '6px',
  })
})
