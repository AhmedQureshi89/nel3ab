import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

// REQ-2.6, verification.md Gate 2. See specs/phase-2/specs.md §2.4.
//
// Same fidelity mechanism as tokens.test.ts, pointed at the globals block: the
// reference is read from disk at run time and compared to the shipped file, so
// a mistyped alpha or a keyframe stop dropped from 7px to 5px fails CI rather
// than passing review. design/ is never edited (CLAUDE.md invariant 5,
// NFR-2.1), so the only way to green is to correct the port.
//
// `ring` is animated by nothing yet. It is asserted anyway — an unused keyframe
// is exactly the one that gets quietly dropped, and REQ-2.4 says the port is
// complete, not selective.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const read = (relativeToRepoRoot: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../${relativeToRepoRoot}`, import.meta.url)), 'utf8')

const REFERENCE = read('design/arcade-tokens.css')
const SHIPPED = read('packages/ui/src/styles/base.css')

// Knowable in advance, and asserted for the reason verification.md §9 gives: a
// regex that matches nothing yields an empty map, and "every one of zero rules
// matched" is green.
const GLOBAL_SELECTORS = [
  ':focus',
  ':focus-visible',
  '::selection',
  "[aria-disabled='true'],:disabled",
]
const KEYFRAME_NAMES = ['pop', 'bob', 'ring', 'slidein']

// --- formatting is Prettier's and Stylelint's; values are not ----------------
// Quote style, whitespace, the space after a comma, the leading zero on a
// decimal and legacy-vs-modern colour notation are all imposed by the
// toolchain: stylelint-config-standard rewrites the reference's
// `rgba(255,201,60,.55)` to `rgb(255 201 60 / 55%)`, and NFR-2.2 is explicit
// that new CSS conforms to stylelint.config.mjs rather than the reverse.
// Normalising them is not loosening the assertion — every channel and every
// alpha still has to match, as the mutation runs in this phase's commit show.

/** Both notations to one canonical `rgb(r g b / a)`, alpha as a 0–1 number. */
const canonicalColour = (text: string) =>
  text.replace(/rgba?\(([^)]+)\)/g, (_match, inner: string) => {
    const parts = inner.split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return _match
    const [red, green, blue, rawAlpha = '1'] = parts as [string, string, string, string?]
    const alpha = rawAlpha.endsWith('%')
      ? Number.parseFloat(rawAlpha) / 100
      : Number.parseFloat(rawAlpha)
    return `rgb(${red} ${green} ${blue} / ${alpha})`
  })

const normalise = (text: string) =>
  canonicalColour(
    text
      .replaceAll('"', "'")
      .replace(/(^|[\s,:(])\.(\d)/g, '$10.$2')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim(),
  )

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Brace-matched body for the rule whose prelude satisfies `match`. */
const bodyOf = (css: string, match: (prelude: string) => boolean) => {
  const source = stripComments(css)
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '{') continue
    const prelude = source.slice(source.lastIndexOf('}', i - 1) + 1, i)
    if (!match(normalise(prelude))) continue
    let depth = 0
    for (let j = i; j < source.length; j++) {
      if (source[j] === '{') depth++
      else if (source[j] === '}' && --depth === 0) return source.slice(i + 1, j)
    }
  }
  return null
}

const declarations = (body: string) => {
  const out = new Map<string, string>()
  // No terminator required: the reference omits the final `;` before `}`
  // (`opacity: 0 }`), and a regex that demands one silently drops the last
  // declaration of every keyframe stop — which reads as a passing test.
  for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
    out.set(name!.trim(), normalise(value!))
  }
  return out
}

/** Selector lists differ only by whitespace across the two files. */
const canonicalSelector = (prelude: string) =>
  normalise(prelude)
    .split(',')
    .map((part) => part.trim())
    .join(',')

const globalRule = (css: string, selector: string) => {
  const body = bodyOf(css, (prelude) => canonicalSelector(prelude) === selector)
  return body === null ? null : declarations(body)
}

/** A keyframes body parsed into `stop -> declarations`. */
const keyframeStops = (css: string, name: string) => {
  const body = bodyOf(css, (prelude) => canonicalSelector(prelude) === `@keyframes ${name}`)
  if (body === null) return null
  const stops = new Map<string, Map<string, string>>()
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '{') continue
    const stop = canonicalSelector(body.slice(body.lastIndexOf('}', i - 1) + 1, i))
    const end = body.indexOf('}', i)
    stops.set(stop, declarations(body.slice(i + 1, end)))
    i = end
  }
  return stops
}

test.each(GLOBAL_SELECTORS)('the shipped `%s` rule matches the reference exactly', (selector) => {
  const reference = globalRule(REFERENCE, selector)
  const shipped = globalRule(SHIPPED, selector)

  // Not `toBeTruthy()`: if the reference stopped containing this rule the port
  // would have nothing to be faithful to, and a green run would mean nothing.
  expect(reference, `design/arcade-tokens.css no longer declares ${selector}`).not.toBeNull()
  expect(reference!.size).toBeGreaterThan(0)

  expect(shipped, `base.css does not declare ${selector}`).not.toBeNull()
  expect(Object.fromEntries(shipped!)).toStrictEqual(Object.fromEntries(reference!))
})

test.each(KEYFRAME_NAMES)('@keyframes %s is ported stop for stop', (name) => {
  const reference = keyframeStops(REFERENCE, name)
  const shipped = keyframeStops(SHIPPED, name)

  expect(reference, `design/arcade-tokens.css no longer defines @keyframes ${name}`).not.toBeNull()
  expect(reference!.size).toBeGreaterThan(0)

  expect(shipped, `base.css does not define @keyframes ${name}`).not.toBeNull()
  expect(shipped!.size).toBe(reference!.size)
  for (const [stop, decls] of reference!) {
    expect(Object.fromEntries(shipped!.get(stop) ?? new Map())).toStrictEqual(
      Object.fromEntries(decls),
    )
  }
})

test('the focus ring is a real ring, at the reference’s exact geometry', () => {
  // design/README.md: "Never leave a default browser focus ring." The pair is
  // load-bearing as a pair — `:focus { outline: none }` without a
  // `:focus-visible` replacement is not a port, it is a keyboard-accessibility
  // regression, and it would satisfy a per-rule diff review.
  expect(globalRule(SHIPPED, ':focus')!.get('outline')).toBe('none')

  const visible = globalRule(SHIPPED, ':focus-visible')!
  expect(visible.get('outline')).toBe('3px solid var(--red)')
  expect(visible.get('outline-offset')).toBe('3px')
})

test('base.css does not port the .press instance', () => {
  // specs.md §2.5: the reference's `.press:active` is one instance of the press
  // invariant, not the invariant. It ships as press.module.css (REQ-2.8), and
  // a copy landing here too would be a second, drifting definition.
  expect(stripComments(SHIPPED)).not.toMatch(/\.press/)
})
