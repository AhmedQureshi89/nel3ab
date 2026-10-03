import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

// specs/phase-5/specs.md §2.12, `host-source.test.ts` — greps over apps/web's non-test source.
//
// REQ-5.14 (verification.md Gate 4, "The catalog"): no question, answer, accepted variant, hint or
// fact of the prototype's occurs in any non-test source file under apps/web (DECIDED 2026-10-02:
// placeholder questions until Phase 8's review gate). The strings are not written into this file:
// they are read from the prototype's `CATS` — every `qs` entry's `q`, `a`, `alts`, `h` and `f` —
// in design/designs/Nel3ab - Arcade.dc.html when the test runs, each kind's count asserted, so an
// extraction that finds nothing fails rather than passing vacuously. design/ is never edited
// (CLAUDE.md invariant 5), so this file goes red only when apps/web's source changes.
//
// "Occurs" is a whole-token match: the string, with no letter, combining mark or digit (any
// script) immediately before or after it. A question pasted into source is found in its quotes,
// its template literal or its JSX text alike; but the answer `Au` is not found inside the English
// word "Author", nor `١٩٤٥` inside a longer number, nor `جوي` inside `جوية`. The liveness test
// shows the matcher finds every one of the strings in the prototype's own `CATS` block.
//
// "Non-test source" is every file under apps/web with a source extension (.ts, .tsx, .js, .jsx,
// .mjs, .cjs, .css, .json) that is not a `.test.ts` / `.test.tsx`, outside `node_modules` and any
// dot-directory (`.next`). The walk reads the disk, not git's index, so a file not yet committed
// is scanned too. Paths resolve from import.meta.url: each Vitest project sets its own `root`.

const WEB_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const PROTOTYPE = readFileSync(
  fileURLToPath(new URL('../../../../design/designs/Nel3ab - Arcade.dc.html', import.meta.url)),
  'utf8',
)

/** Every match of a global pattern, in source order. */
const all = (source: string, pattern: RegExp): RegExpExecArray[] => [...source.matchAll(pattern)]

/** A capture group the pattern makes mandatory: its absence means the pattern itself is wrong. */
const group = (match: RegExpExecArray, index: number): string => {
  const captured = match[index]
  if (captured === undefined) {
    throw new Error(`no capture group ${index} in ${JSON.stringify(match[0])}`)
  }
  return captured
}

/** The single-quoted strings of a list's text, in order. */
const quoted = (text: string): string[] => all(text, /'([^']*)'/g).map((m) => group(m, 1))

// --- the prototype's question content ------------------------------------------------------

/** `const CATS = [` … `];`, the prototype's category list, capturing its body. */
const CATS_BLOCKS = all(PROTOTYPE, /^const CATS = \[\n([\s\S]*?)^\];$/gm)
const cats = CATS_BLOCKS[0]?.[1] ?? ''

/** One `qs` entry, `{q:'…', a:'…', alts:[…], h:[…], f:'…'}`, capturing each part. */
const QUESTION =
  /\{\s*q\s*:\s*'([^']*)'\s*,\s*a\s*:\s*'([^']*)'\s*,\s*alts\s*:\s*\[([^\]]*)\]\s*,\s*h\s*:\s*\[([^\]]*)\]\s*,\s*f\s*:\s*'([^']*)'\s*\}/g
/** Every `{q:` the block opens — so a question the full pattern misses cannot go unnoticed. */
const QUESTION_OPENINGS = /\{\s*q\s*:/g

const questions = all(cats, QUESTION)

/** The five kinds of REQ-5.14, each a list in the prototype's order. */
const CONTENT = {
  question: questions.map((m) => group(m, 1)),
  answer: questions.map((m) => group(m, 2)),
  variant: questions.flatMap((m) => quoted(group(m, 3))),
  hint: questions.flatMap((m) => quoted(group(m, 4))),
  fact: questions.map((m) => group(m, 5)),
} as const

const STRINGS = Object.entries(CONTENT).flatMap(([kind, texts]) =>
  texts.map((text) => ({ kind, text })),
)

// --- the matcher -----------------------------------------------------------------------------

const WORD_CHARACTER = '[\\p{L}\\p{M}\\p{N}]'
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tokenPattern = (text: string): RegExp =>
  new RegExp(`(?<!${WORD_CHARACTER})${escapeRegExp(text)}(?!${WORD_CHARACTER})`, 'u')

/** Whether `text` occurs in `haystack` as a whole token (this file's header). */
const occurs = (text: string, haystack: string): boolean => tokenPattern(text).test(haystack)

// --- apps/web's non-test source ----------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json'])
const isTestFile = (name: string): boolean => /\.test\.tsx?$/.test(name)

/** Every non-test source file under `directory`, as an absolute path. */
const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((dirent) => {
    const path = join(directory, dirent.name)
    if (dirent.isDirectory()) {
      return dirent.name === 'node_modules' || dirent.name.startsWith('.') ? [] : sourceFiles(path)
    }
    return dirent.isFile() &&
      SOURCE_EXTENSIONS.has(extname(dirent.name)) &&
      !isTestFile(dirent.name)
      ? [path]
      : []
  })

/** apps/web's non-test source, as `[path relative to apps/web, with '/', contents]`. */
const SOURCE: readonly (readonly [string, string])[] = sourceFiles(WEB_ROOT)
  .map(
    (path) => [relative(WEB_ROOT, path).split(sep).join('/'), readFileSync(path, 'utf8')] as const,
  )
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

describe("REQ-5.14: none of the prototype's question content is in apps/web's non-test source", () => {
  test("the extraction: the prototype's 33 questions — 33 answers, 34 variants, 66 hints, 33 facts", () => {
    expect(CATS_BLOCKS).toHaveLength(1)
    expect(all(cats, QUESTION_OPENINGS)).toHaveLength(33)
    expect(questions).toHaveLength(33)
    expect(CONTENT.question).toHaveLength(33)
    expect(CONTENT.answer).toHaveLength(33)
    expect(CONTENT.variant).toHaveLength(34)
    expect(CONTENT.hint).toHaveLength(66)
    expect(CONTENT.fact).toHaveLength(33)
    expect(STRINGS).toHaveLength(199)
    expect(STRINGS.filter(({ text }) => text.trim() === '')).toStrictEqual([])
    // The first and last question, so a pattern that reads the wrong field is visible.
    expect(CONTENT.question[0]).toBe('ما هي الدولة الأكثر إنتاجاً للنفط الخام في العالم؟')
    expect(CONTENT.fact[32]).toBe('يملك أعلى بركان في المجموعة الشمسية.')
  })

  test("the matcher is live: it finds every one of the 199 strings in the prototype's own CATS block", () => {
    expect(STRINGS.filter(({ text }) => !occurs(text, cats))).toStrictEqual([])
    // A whole token, not a substring.
    expect(occurs('Au', "alts:['Au']")).toBe(true)
    expect(occurs('Au', 'Author')).toBe(false)
    expect(occurs('١٩٤٥', 'عام ١٩٤٥.')).toBe(true)
    expect(occurs('١٩٤٥', '١٩٤٥٠')).toBe(false)
    expect(occurs('جوي', 'جوية')).toBe(false)
  })

  test("the scan covers apps/web's non-test source — the catalog included — and no test file", () => {
    const paths = SOURCE.map(([path]) => path)
    expect(paths).toEqual(
      expect.arrayContaining([
        'app/host/_lib/catalog.ts',
        'app/layout.tsx',
        'app/page.tsx',
        'app/globals.css',
        'app/styleguide/page.tsx',
        'next.config.ts',
        'package.json',
      ]),
    )
    expect(paths.filter((path) => isTestFile(path))).toStrictEqual([])
    expect(paths.filter((path) => /(^|\/)(node_modules|\.[^/]+)\//.test(path))).toStrictEqual([])
  })

  test("0 of the prototype's question, answer, variant, hint and fact strings occur in any of it", () => {
    const found = SOURCE.flatMap(([path, contents]) =>
      STRINGS.filter(({ text }) => occurs(text, contents)).map(({ kind, text }) => ({
        path,
        kind,
        text,
      })),
    )
    expect(found).toStrictEqual([])
  })
})
