import { describe, expect, test } from 'vitest'

import { CATALOG, catalogEntry } from './catalog'

// REQ-5.14 — specs/phase-5/verification.md Gate 4, "The catalog". See specs.md §2.9
// (`catalog.ts`) and §2.12 (this file's row).
//
// The table below is specs.md §2.9's, row for row: the prototype's eleven tiles in its own order,
// with this file's ids. The questions are asserted to be exactly the placeholder text specs.md
// §2.9 writes — never anything of the prototype's, which host-source.test.ts checks against the
// prototype itself. That the names, emoji and locks are the prototype's, read from it at run time,
// is REQ-5.22's extraction W7 (host-prototype.test.ts).

/** specs.md §2.9's table: `[id, name, emoji, locked]`, in order. */
const TABLE: readonly (readonly [string, string, string, boolean])[] = [
  ['industry', 'صناعة', '🏭', false],
  ['animals', 'حيوانات', '🦁', false],
  ['nature', 'طبيعة', '🌋', false],
  ['society', 'إنسان ومجتمع', '🌍', false],
  ['culture', 'ثقافة', '🎎', true],
  ['proverbs', 'أمثال', '💬', false],
  ['history', 'تاريخ', '🏛️', false],
  ['religion', 'دين', '🕌', false],
  ['art', 'فن', '🎨', true],
  ['movies', 'أفلام', '🎬', true],
  ['science', 'علوم', '🔬', false],
]

/** The placeholder's numbering, `d` = ١، ٢، ٣ in turn (specs.md §2.9). */
const DIGITS = ['١', '٢', '٣'] as const

describe('REQ-5.14: the catalog', () => {
  test("eleven entries, in the prototype's order, with specs.md §2.9's ids, names, emoji and locks", () => {
    expect(CATALOG).toHaveLength(11)
    expect(CATALOG.map(({ id, name, emoji, locked }) => [id, name, emoji, locked])).toStrictEqual(
      TABLE,
    )
    // The three locked tiles are ثقافة، فن، أفلام — the 5th, 9th and 10th.
    expect(CATALOG.filter((entry) => entry.locked).map((entry) => entry.name)).toStrictEqual([
      'ثقافة',
      'فن',
      'أفلام',
    ])
    // The one emoji with a variation selector keeps it: U+1F3DB U+FE0F, as the prototype writes it.
    expect([...(CATALOG[6]?.emoji ?? '')].map((c) => c.codePointAt(0))).toStrictEqual([
      0x1f3db, 0xfe0f,
    ])
  })

  test('ids are unique, and so are names', () => {
    expect(new Set(CATALOG.map((entry) => entry.id)).size).toBe(11)
    expect(new Set(CATALOG.map((entry) => entry.name)).size).toBe(11)
  })

  test('every entry holds three placeholder questions of two hints each, of exactly the placeholder text', () => {
    for (const entry of CATALOG) {
      expect(entry.questions).toStrictEqual(
        DIGITS.map((d) => ({
          q: `سؤال تجريبي ${d} — ${entry.name}`,
          a: `إجابة تجريبية ${d}`,
          alts: [],
          h: ['تلميح تجريبي ١', 'تلميح تجريبي ٢'],
          f: 'معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨',
        })),
      )
      expect(new Set(entry.questions.map((question) => question.q)).size).toBe(3)
    }
    // Spelled out once, for the first tile, so the template above is not the only witness.
    expect(CATALOG[0]?.questions[2]).toStrictEqual({
      q: 'سؤال تجريبي ٣ — صناعة',
      a: 'إجابة تجريبية ٣',
      alts: [],
      h: ['تلميح تجريبي ١', 'تلميح تجريبي ٢'],
      f: 'معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨',
    })
    // Thirty-three questions in all, no two with the same text.
    const questions = CATALOG.flatMap((entry) => entry.questions)
    expect(questions).toHaveLength(33)
    expect(new Set(questions.map((question) => question.q)).size).toBe(33)
  })

  test('every text a question carries says plainly that it is a placeholder', () => {
    const texts = CATALOG.flatMap((entry) =>
      entry.questions.flatMap((question) => [question.q, question.a, ...question.h, question.f]),
    )
    // 11 entries × 3 questions × (question, answer, two hints, fact).
    expect(texts).toHaveLength(11 * 3 * 5)
    // تجريبي / تجريبية — "trial": in every question, answer, hint and fact.
    expect(texts.filter((text) => !text.includes('تجريبي'))).toStrictEqual([])
    // No accepted variants: a placeholder answer has nothing to vary.
    expect(CATALOG.flatMap((entry) => entry.questions.flatMap((q) => q.alts))).toStrictEqual([])
  })

  test('catalogEntry finds every entry by id, and throws RangeError for an id the catalog does not hold', () => {
    for (const entry of CATALOG) expect(catalogEntry(entry.id)).toBe(entry)
    for (const id of ['ghost', '', 'c0', 'Industry']) {
      expect(() => catalogEntry(id)).toThrow(RangeError)
    }
    expect(() => catalogEntry('ghost')).toThrow('catalogEntry: no category with id "ghost"')
  })
})
