import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

// REQ-2.8, verification.md Gate 2. See specs/phase-2/specs.md §2.5 and §2.11.
//
// requirements.md §1.1 records three (rest, travel, pressed) pairs measured from
// the prototypes and asserts one invariant over them:
//
//   pressed offset = rest offset - travel
//
// This test does not trust that table. It re-derives every triple from
// design/designs/*.dc.html at run time and checks the invariant against what the
// prototypes actually say, because mission.md §5.3 makes the prototype the
// specification — if the table and the prototypes ever disagree, the table is
// what is wrong, and a test that hard-codes the table would never notice.
//
// It keeps holding after this phase ends (NFR-2.6). design/ is never written
// (CLAUDE.md invariant 5), so the only way to green is to correct the code.
//
// Paths resolve from import.meta.url, NOT process.cwd(): each Vitest project
// sets its own `root` in vitest.config.ts, so cwd is not the repo root.
const repoRoot = (relative: string) =>
  fileURLToPath(new URL(`../../../../${relative}`, import.meta.url))

const PROTOTYPE_DIR = repoRoot('design/designs')
const PRESS_CSS = readFileSync(repoRoot('packages/ui/src/styles/press.module.css'), 'utf8')

/** specs.md §2.11: "the three `design/designs/*.dc.html` files". */
const PROTOTYPE_FILE_COUNT = 3

/** requirements.md §1.1, as `rest,travel,pressed`. Expected values, not implementation. */
const RECORDED_TRIPLES = ['6,4,2', '5,3,2', '4,3,1']

// --- reading the prototypes ---------------------------------------------------
// The exports style every element inline: a `style` attribute carries the rest
// state and a sibling `style-active` attribute carries the pressed state. That
// pairing is the whole extraction — no HTML parser required, and adding one for
// two attributes would be a dependency this phase does not need.

type Press = { file: string; rest: number; travel: number; pressed: number }

const PRESSABLE_TAG = /<[^<>]*\bstyle-active\s*=\s*"([^"]*)"[^<>]*>/g
/** `style="…"`, and never `style-active="…"` / `style-hover="…"` — those fail the `\s*=`. */
const STYLE_ATTRIBUTE = /\sstyle\s*=\s*"([^"]*)"/
/** Zero blur, zero spread, always --stroke: `mission.md` §3. Only the offset varies. */
const SHADOW_OFFSET = /box-shadow\s*:\s*0\s+([\d.]+)px\s+0/
const TRAVEL = /translateY\(\s*([\d.]+)px\s*\)/

const px = (source: string, pattern: RegExp, what: string, where: string) => {
  const match = pattern.exec(source)
  expect(match, `${where}: no ${what}`).not.toBeNull()
  return Number(match![1])
}

const prototypeFiles = readdirSync(PROTOTYPE_DIR)
  .filter((name) => name.endsWith('.dc.html'))
  .sort()

const presses: Press[] = prototypeFiles.flatMap((file) => {
  const html = readFileSync(`${PROTOTYPE_DIR}/${file}`, 'utf8')

  return [...html.matchAll(PRESSABLE_TAG)].map(([tag, active], index) => {
    const where = `${file} pressable #${index + 1}`
    const rest = STYLE_ATTRIBUTE.exec(tag)?.[1] ?? ''

    return {
      file,
      rest: px(rest, SHADOW_OFFSET, 'rest box-shadow', where),
      travel: px(active!, TRAVEL, 'translateY travel', where),
      pressed: px(active!, SHADOW_OFFSET, 'pressed box-shadow', where),
    }
  })
})

// --- the prototypes hold the invariant ----------------------------------------

test('the extraction really read all three prototypes — it is not passing vacuously', () => {
  expect(prototypeFiles).toHaveLength(PROTOTYPE_FILE_COUNT)

  // Per file, not just in total. One export is far larger than the other two, so
  // a regex that happened to work only on that one would still look like a full
  // sweep if only the total were asserted (verification.md §9).
  for (const file of prototypeFiles) {
    const found = presses.filter((press) => press.file === file)
    expect(found.length, `${file} contributed no pressable element`).toBeGreaterThan(0)
  }
})

test('every pressable element in the prototypes satisfies pressed = rest - travel', () => {
  for (const { file, rest, travel, pressed } of presses) {
    expect(pressed, `${file}: rest ${rest}px, travel ${travel}px`).toBe(rest - travel)
  }
})

test('the three triples requirements.md §1.1 records are among the ones measured', () => {
  const measured = new Set(
    presses.map(({ rest, travel, pressed }) => `${rest},${travel},${pressed}`),
  )

  // This is the anti-vacuity guard verification.md's box names. Without it, an
  // extraction that found one triple would satisfy the invariant test above and
  // report a green suite over almost nothing.
  for (const triple of RECORDED_TRIPLES) {
    expect(
      [...measured],
      `requirements.md §1.1 records (${triple}) but no element has it`,
    ).toContain(triple)
  }
})

// --- the implementation computes rather than restates -------------------------

test('press.module.css computes the pressed offset from rest and travel', () => {
  expect(PRESS_CSS).toContain('calc(var(--press-rest) - var(--press-travel))')
})

test('press.module.css changes only transform and box-shadow', () => {
  // mission.md §3 names three techniques as the ways the press gets lost. The
  // check is over the whole file text, comments included, which is why
  // press.module.css documents this exclusion without writing the words.
  for (const banned of ['scale(', 'opacity', 'filter']) {
    expect(PRESS_CSS, `press.module.css must not contain ${banned}`).not.toContain(banned)
  }
})

test('no rule anywhere in packages/ui writes a pressed offset as a literal', () => {
  // The box's third clause — "no variant anywhere writes a pressed offset as a
  // literal" — has nothing to bite on yet: the variants are STEP 4's. Asserted
  // as a standing rule rather than as a claim about today, so that Button and
  // Pill land against it instead of being trusted.
  //
  // A literal REST offset is correct and expected (Panel is `0 4px 0`). It is
  // the PRESSED offset that must be arithmetic, and the pressed offset is the
  // one inside an :active rule.
  const cssRoot = repoRoot('packages/ui/src')
  const cssFiles = readdirSync(cssRoot, { recursive: true, encoding: 'utf8' }).filter((name) =>
    name.endsWith('.css'),
  )

  const activeRules = cssFiles.flatMap((name) => {
    const text = readFileSync(`${cssRoot}/${name}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

    return [...text.matchAll(/([^{}]*:active[^{}]*)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
      where: `${name} — ${selector!.trim()}`,
      body: body!,
    }))
  })

  expect(activeRules.length, 'no :active rule found at all').toBeGreaterThan(0)

  for (const { where, body } of activeRules) {
    const shadow = /box-shadow\s*:([^;]*)/.exec(body)
    if (shadow === null) continue
    expect(shadow[1], `${where} writes a pressed box-shadow without calc()`).toContain('calc(')
  }
})
