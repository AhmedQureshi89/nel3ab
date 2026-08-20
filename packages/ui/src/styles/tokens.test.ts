import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

// REQ-2.4 / REQ-2.5, verification.md Gate 2. See specs/phase-2/specs.md §2.11.
//
// This is THE fidelity mechanism of Phase 2. mission.md §5.3 makes the prototype
// the specification, and a mistyped hex or a radius rounded from 2.5px to 2px
// fails no test, appears in no diff review, and is a regression by the
// constitution's own definition. So the token contract is not reviewed, it is
// asserted: this test reads design/arcade-tokens.css from disk at run time and
// compares it to the shipped file. design/ is never edited (CLAUDE.md invariant
// 5, NFR-2.1), so the only way to make this test green is to correct the port.
//
// It keeps holding after this phase ends — a Phase 5 change that drifts a token
// fails CI rather than shipping (NFR-2.6).
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const read = (relativeToRepoRoot: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8')

const REFERENCE = read('design/arcade-tokens.css')
const SHIPPED = read('packages/ui/src/styles/tokens.css')

// The counts are knowable in advance, and asserting them is what stops this
// whole file passing vacuously (verification.md §9): a regex that fails to match
// yields zero pairs, and "every one of zero tokens matched" is green.
const REFERENCE_LIGHT_TOKENS = 44
const REFERENCE_DARK_TOKENS = 7

// --- a deliberately small CSS reader -----------------------------------------
// Enough to find `selector { --name: value; }` blocks and no more. A real
// parser would be a new dependency for four assertions.

type Block = {
  selector: string
  atRules: string[]
  declarations: Map<string, string>
}

/** Quote style and run length are formatting; Prettier owns both. Values are not. */
const normalise = (text: string) => text.replaceAll('"', "'").replace(/\s+/g, ' ').trim()

const customProperties = (body: string) => {
  const declarations = new Map<string, string>()
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    declarations.set(name!, normalise(value!))
  }
  return declarations
}

const parseBlocks = (css: string) => {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks: Block[] = []
  const open: { prelude: string; bodyStart: number }[] = []
  let preludeStart = 0

  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') {
      open.push({ prelude: source.slice(preludeStart, i).trim(), bodyStart: i + 1 })
      preludeStart = i + 1
    } else if (source[i] === '}') {
      const frame = open.pop()
      preludeStart = i + 1
      if (!frame || frame.prelude.startsWith('@')) continue
      blocks.push({
        selector: normalise(frame.prelude),
        atRules: open.filter((f) => f.prelude.startsWith('@')).map((f) => normalise(f.prelude)),
        declarations: customProperties(source.slice(frame.bodyStart, i)),
      })
    }
  }
  return blocks.filter((block) => block.declarations.size > 0)
}

const find = (css: string, predicate: (block: Block) => boolean, label: string) => {
  const matches = parseBlocks(css).filter(predicate)
  expect(matches, `expected exactly one ${label} block`).toHaveLength(1)
  return matches[0]!
}

const referenceLight = find(REFERENCE, (b) => b.selector === ':root', 'reference light')
const referenceDark = find(REFERENCE, (b) => b.selector === "[data-theme='dark']", 'reference dark')

const shippedLight = find(
  SHIPPED,
  (b) => b.selector.includes(':root,') && b.selector.includes("[data-theme='light']"),
  'shipped light',
)
const shippedDarkMedia = find(
  SHIPPED,
  (b) => b.atRules.some((at) => at.includes('prefers-color-scheme: dark')),
  'shipped dark @media',
)
const shippedDarkAttribute = find(
  SHIPPED,
  (b) => b.selector === "[data-theme='dark']" && b.atRules.length === 0,
  'shipped dark [data-theme]',
)

// --- the named exemption ------------------------------------------------------
// specs.md §2.3 routes the first family of --font / --font-en through the CSS
// variable next/font/local defines, so that apps/web can supply the hashed
// family while the file still works standalone. That is the ONLY permitted
// difference from the reference, and it is named here rather than skipped
// silently: the fallback stack must still be intact, byte for byte.
const FONT_INDIRECTION: Readonly<Record<string, string>> = {
  '--font': '--font-baloo',
  '--font-en': '--font-archivo',
}

const expectedShippedValue = (name: string, referenceValue: string) => {
  const indirection = FONT_INDIRECTION[name]
  if (indirection === undefined) return referenceValue
  return referenceValue.replace(/^[^,]+/, (family) => `var(${indirection}, ${family.trim()})`)
}

// --- the contract -------------------------------------------------------------

test('the reference itself parses — this test is not passing vacuously', () => {
  expect(referenceLight.declarations.size).toBe(REFERENCE_LIGHT_TOKENS)
  expect(referenceDark.declarations.size).toBe(REFERENCE_DARK_TOKENS)
})

test('every reference :root token is ported to the shipped light block, value for value', () => {
  expect(shippedLight.declarations.size).toBe(REFERENCE_LIGHT_TOKENS)

  for (const [name, value] of referenceLight.declarations) {
    expect(shippedLight.declarations.get(name), `--${name} missing from the light block`).toBe(
      expectedShippedValue(name, value),
    )
  }
})

test('every reference dark token is ported to BOTH shipped dark blocks, value for value', () => {
  for (const block of [shippedDarkMedia, shippedDarkAttribute]) {
    expect(block.declarations.size).toBe(REFERENCE_DARK_TOKENS)

    for (const [name, value] of referenceDark.declarations) {
      expect(block.declarations.get(name), `${name} missing from ${block.selector}`).toBe(value)
    }
  }
})

test('the two shipped dark blocks are identical to each other', () => {
  // They are written out twice on purpose (specs.md §2.3). Duplication that
  // nothing checks is duplication that drifts.
  expect([...shippedDarkMedia.declarations]).toStrictEqual([...shippedDarkAttribute.declarations])
})

test('the port adds nothing the reference does not declare', () => {
  // "Adds nothing" is the half that is easy to skip and matters most: a token
  // invented at 1am is a design decision, and by the time a screen uses it, it
  // is load-bearing (requirements.md REQ-2.4, §4).
  const extra = [...shippedLight.declarations.keys()].filter(
    (name) => !referenceLight.declarations.has(name),
  )
  const missing = [...referenceLight.declarations.keys()].filter(
    (name) => !shippedLight.declarations.has(name),
  )

  expect(extra, 'tokens invented by the port').toStrictEqual([])
  expect(missing, 'reference tokens dropped by the port').toStrictEqual([])
})
