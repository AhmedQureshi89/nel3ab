import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { Card } from './Card.js'
import { Dot } from './Dot.js'
import { Panel } from './Panel.js'
import { Pill } from './Pill.js'

// REQ-2.9, verification.md Gate 3. See specs/phase-2/specs.md §2.6 and §2.11.
//
// Two halves, because neither is enough alone:
//
//   1. Rendered markup (`renderToStaticMarkup`, the precedent set by
//      apps/web/rtl-root.test.ts — no jsdom). Every variant is asserted through
//      its `data-*` attribute, never a CSS-Module class name, which is hashed
//      and a build detail (specs.md §2.6).
//   2. The CSS text, value by value. Rendering exercises no CSS at all, so the
//      measured values REQ-2.9 exists for — 3px, 20px, `0 4px 0`, 14px, 24px,
//      999px, 2.5px, 13.5px/700, 9px, 11px — are asserted here, with each
//      `var(--token)` resolved one level through styles/tokens.css so that the
//      number checked is the number that renders.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const read = (relativeToRepoRoot: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8')

// --- rendered markup ----------------------------------------------------------

/** The rendered root element's tag name and attributes. */
const root = (element: ReactElement) => {
  const markup = renderToStaticMarkup(element)
  const open = /^<([a-z]+)([^>]*)>/.exec(markup)
  expect(open, `no root element in ${markup}`).not.toBeNull()
  const attributes = Object.fromEntries(
    [...open![2]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name!, value!]),
  )
  return { tag: open![1]!, attributes, markup }
}

describe('Panel', () => {
  test('defaults to raised and padded', () => {
    const { tag, attributes } = root(<Panel />)
    expect(tag).toBe('div')
    expect(attributes).toMatchObject({ 'data-raised': 'true', 'data-padded': 'true' })
  })

  test('flat and unpadded are observable', () => {
    expect(root(<Panel raised={false} />).attributes['data-raised']).toBe('false')
    expect(root(<Panel padded={false} />).attributes['data-padded']).toBe('false')
  })
})

describe('Card', () => {
  test('md is the default, raised and padded like a Panel', () => {
    const { tag, attributes } = root(<Card />)
    expect(tag).toBe('div')
    expect(attributes).toMatchObject({
      'data-size': 'md',
      'data-raised': 'true',
      'data-padded': 'true',
    })
  })

  test('lg is the question-card shell: raised, and unpadded by default', () => {
    // The shell's header strip and hint footer must reach the border.
    expect(root(<Card size="lg" />).attributes).toMatchObject({
      'data-size': 'lg',
      'data-raised': 'true',
      'data-padded': 'false',
    })
  })

  test('an explicit padded or raised still wins over the size default', () => {
    expect(root(<Card size="lg" padded />).attributes['data-padded']).toBe('true')
    expect(root(<Card raised={false} />).attributes['data-raised']).toBe('false')
  })
})

describe('Pill', () => {
  test('defaults to the panel tone, unselected', () => {
    const { tag, attributes } = root(<Pill />)
    expect(tag).toBe('span')
    expect(attributes).toMatchObject({ 'data-tone': 'panel', 'data-selected': 'false' })
  })

  const tones = ['panel', 'red', 'sky', 'yellow'] as const
  test.each(tones.flatMap((tone) => [true, false].map((selected) => [tone, selected] as const)))(
    'tone %s, selected %s',
    (tone, selected) => {
      expect(root(<Pill tone={tone} selected={selected} />).attributes).toMatchObject({
        'data-tone': tone,
        'data-selected': String(selected),
      })
    },
  )
})

describe('Dot', () => {
  test('defaults to sm, not won, and is hidden from assistive technology', () => {
    const { tag, attributes } = root(<Dot />)
    expect(tag).toBe('span')
    expect(attributes).toMatchObject({
      'data-size': 'sm',
      'data-won': 'false',
      'aria-hidden': 'true',
    })
  })

  test.each([
    ['sm', true],
    ['sm', false],
    ['md', true],
    ['md', false],
  ] as const)('size %s, won %s', (size, won) => {
    expect(root(<Dot size={size} won={won} />).attributes).toMatchObject({
      'data-size': size,
      'data-won': String(won),
      'aria-hidden': 'true',
    })
  })
})

test.each([
  ['Panel', <Panel key="p" className="caller" />],
  ['Card', <Card key="c" className="caller" />],
  ['Pill', <Pill key="i" className="caller" />],
  ['Dot', <Dot key="d" className="caller" />],
] as const)('%s keeps a caller’s className', (_name, element) => {
  expect(root(element).attributes['class']?.split(' ')).toContain('caller')
})

test.each([
  ['Panel', <Panel key="p">نص</Panel>],
  ['Card', <Card key="c">نص</Card>],
  ['Pill', <Pill key="i">نص</Pill>],
] as const)('%s renders its children and passes other props through', (_name, element) => {
  expect(root(element).markup).toContain('>نص<')
  expect(root(<Panel id="x" />).attributes['id']).toBe('x')
})

// --- the CSS, value by value --------------------------------------------------

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** `selector -> { property: value }` for a flat (un-nested) stylesheet. */
const rules = (css: string) => {
  const out = new Map<string, Record<string, string>>()
  for (const [, selector, body] of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Record<string, string> = {}
    for (const [, name, value] of body!.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      declarations[name!.trim()] = value!.trim()
    }
    out.set(selector!.trim().replace(/\s+/g, ' '), declarations)
  }
  return out
}

const TOKENS = (() => {
  const light = /:root,\s*\[data-theme='light'\]\s*\{([^}]*)\}/.exec(
    stripComments(read('packages/ui/src/styles/tokens.css')),
  )
  expect(light, 'tokens.css has no light block').not.toBeNull()
  return Object.fromEntries(
    [...light![1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name!,
      value!.trim(),
    ]),
  )
})()

/** Substitutes each `var(--token)` once — `var(--sh-card)` → `0 4px 0 var(--stroke)`. */
const resolved = (value: string) =>
  value.replace(/var\((--[\w-]+)\)/g, (match, name: string) => TOKENS[name] ?? match)

const declared = (file: string, selector: string) => {
  const found = rules(read(`packages/ui/src/primitives/${file}`)).get(selector)
  expect(found, `${file} has no rule for ${selector}`).toBeDefined()
  return Object.fromEntries(Object.entries(found!).map(([name, value]) => [name, resolved(value)]))
}

test('Panel: 3px ink border, 20px radius, 0 4px 0 when raised, 14px when padded', () => {
  expect(declared('Panel.module.css', '.panel')).toStrictEqual({
    background: '#fffaf0',
    border: '3px solid #241c17',
    'border-radius': '20px',
  })
  expect(declared('Panel.module.css', ".panel[data-raised='true']")).toStrictEqual({
    'box-shadow': '0 4px 0 var(--stroke)',
  })
  expect(declared('Panel.module.css', ".panel[data-padded='true']")).toStrictEqual({
    padding: '14px',
  })
})

test('Card lg: 24px radius, 0 6px 0 when raised, contents clipped to the border', () => {
  expect(declared('Card.module.css', ".card[data-size='lg']")).toStrictEqual({
    'border-radius': '24px',
    overflow: 'hidden',
  })
  expect(declared('Card.module.css', ".card[data-size='lg'][data-raised='true']")).toStrictEqual({
    'box-shadow': '0 6px 0 var(--stroke)',
  })
})

test('Pill: 999px radius, 2.5px border, 13.5px/700, 0 3px 0 when selected', () => {
  expect(declared('Pill.module.css', '.pill')).toMatchObject({
    border: '2.5px solid #241c17',
    'border-radius': '999px',
    'font-size': '13.5px',
    'font-weight': '700',
  })
  expect(declared('Pill.module.css', ".pill[data-selected='true']")).toStrictEqual({
    'box-shadow': '0 3px 0 var(--stroke)',
  })
})

test('Pill tones carry the prototype’s text colour for each fill', () => {
  // The prototype's player chips: red / sky with `#fff`; its selected judge
  // option: yellow with `#241c17` (= --on-yellow); unselected: panel with ink.
  const tone = (name: string) => declared('Pill.module.css', `.pill[data-tone='${name}']`)
  expect(tone('panel')).toStrictEqual({ background: '#fffaf0', color: '#241c17' })
  expect(tone('red')).toStrictEqual({ background: '#ec3013', color: '#fff' })
  expect(tone('sky')).toStrictEqual({ background: '#2fa3e8', color: '#fff' })
  expect(tone('yellow')).toStrictEqual({ background: '#ffc93c', color: '#241c17' })
})

test('Pill inline padding is start 8 / end 12, derived from the prototype under dir="rtl"', () => {
  // specs.md §2.6 — the phase's most likely fidelity error. The expected pair
  // is not typed in here: it is read from the prototype's player chip, whose
  // physical `padding: T R B L` becomes `padding-inline: R L` because the
  // prototype's root is dir="rtl", where physical right is inline-start.
  const prototype = read('design/designs/Nel3ab - Arcade.dc.html')
  expect(prototype).toMatch(/<div data-theme="\{\{ theme \}\}" dir="rtl"/)

  const chips = [
    ...prototype.matchAll(
      /style="[^"]*border-radius:999px;padding:(\S+) (\S+) (\S+) (\S+);font-size:13\.5px;[^"]*"/g,
    ),
  ]
  // Exactly one element: the asymmetric chip. Zero would make this vacuous.
  expect(chips).toHaveLength(1)
  const [, top, right, bottom, left] = chips[0]!
  expect(top).toBe(bottom)

  const pill = declared('Pill.module.css', '.pill')
  expect(pill['padding-block']).toBe(top)
  expect(pill['padding-inline']).toBe(`${right} ${left}`)
  expect(pill['padding-inline']).toBe('8px 12px')
})

test('Dot: 9px / 11px circles, per the prototype rather than specs.md §2.6', () => {
  // Owner's ruling 2026-09-29: the prototype wins (CLAUDE.md invariant 5).
  // The two places it differs from specs.md are asserted explicitly: the 11px
  // dot's border is 2.5px, and a dot not yet won is filled --sunken, not
  // transparent.
  expect(declared('Dot.module.css', '.dot')).toStrictEqual({
    display: 'inline-block',
    border: '2px solid #241c17',
    'border-radius': '50%',
    background: '#f0e2c8',
  })
  expect(declared('Dot.module.css', ".dot[data-size='sm']")).toStrictEqual({
    'inline-size': '9px',
    'block-size': '9px',
  })
  expect(declared('Dot.module.css', ".dot[data-size='md']")).toStrictEqual({
    'inline-size': '11px',
    'block-size': '11px',
    'border-width': '2.5px',
  })
  expect(declared('Dot.module.css', ".dot[data-won='true']")).toStrictEqual({
    background: '#ffc93c',
  })
})

test('the four primitives are presentational: no press, no "use client", no inline style', () => {
  // specs.md §1: Button is the only primitive that composes press. §2.6: no
  // `"use client"`, no inline `style`, no colour literal in a .tsx.
  for (const name of ['Panel', 'Card', 'Pill', 'Dot']) {
    const css = read(`packages/ui/src/primitives/${name}.module.css`)
    // Code only: the header comments are allowed to *name* what the code must not do.
    const tsx = stripComments(read(`packages/ui/src/primitives/${name}.tsx`)).replace(
      /^\s*\/\/.*$/gm,
      '',
    )
    expect(stripComments(css), `${name}.module.css`).not.toMatch(/composes|:active/)
    expect(tsx, `${name}.tsx`).not.toMatch(/['"]use client['"]/)
    expect(tsx, `${name}.tsx`).not.toMatch(/style=\{/)
    expect(tsx, `${name}.tsx`).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i)
  }
})
