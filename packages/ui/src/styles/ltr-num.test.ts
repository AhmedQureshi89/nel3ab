import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

// REQ-2.7, verification.md Gate 2. See specs/phase-2/specs.md §2.4.
//
// `.ltr-num` is the one rule in base.css with no reference to compare against —
// the prototypes are single-purpose demos where the bidi hazard never surfaces
// (requirements.md REQ-2.7) — so unlike base.test.ts this file asserts the rule
// against the requirement's own three declarations rather than against design/.
//
// The failure it exists to catch is the plausible one: `direction: ltr` kept and
// `unicode-bidi: isolate` dropped. That still renders Latin order, looks right in
// every isolated sample, and reorders neighbouring Arabic punctuation in exactly
// the sentence the utility is for.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const SHIPPED = readFileSync(fileURLToPath(new URL('./base.css', import.meta.url)), 'utf8')

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Every rule body whose selector list is exactly `.ltr-num`. */
const ltrNumBodies = (css: string) =>
  [...stripComments(css).matchAll(/(?<=^|[{}])\s*([^{}]+?)\s*\{([^{}]*)\}/g)]
    .filter(([, prelude]) => prelude!.trim() === '.ltr-num')
    .map(([, , body]) => body!)

const declarations = (body: string) => {
  const out: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
    out[name!.trim()] = value!.trim()
  }
  return out
}

test('base.css declares `.ltr-num` exactly once', () => {
  // Once, not "at least once": a second rule further down could quietly
  // override `unicode-bidi` and the first rule would still read correctly.
  expect(ltrNumBodies(SHIPPED)).toHaveLength(1)
})

test('`.ltr-num` sets Archivo, ltr and isolation — all three, and nothing else', () => {
  // Exact equality rather than three `toHaveProperty` checks: it also pins that
  // `font-variant-numeric` is absent (requirements.md §4 — `tabular-nums` is a
  // design amendment, not a bug fix) without naming a list of banned properties.
  expect(declarations(ltrNumBodies(SHIPPED)[0]!)).toStrictEqual({
    'font-family': 'var(--font-en)',
    direction: 'ltr',
    'unicode-bidi': 'isolate',
  })
})

test('the isolation is `isolate`, not a weaker bidi mode', () => {
  // `embed` and `bidi-override` both look like bidi handling in review and
  // neither isolates the run from the surrounding paragraph. Stated separately
  // from the equality above so a failure names the half that was dropped.
  expect(declarations(ltrNumBodies(SHIPPED)[0]!)['unicode-bidi']).toBe('isolate')
})
