// TEMPORARY — Phase 8 replaces this file with @nel3ab/content, and Phase 11 with the server's list.
//
// REQ-5.14 — specs/phase-5/specs.md §2.9, `catalog.ts`. The judge app's categories until real
// content exists: the prototype's eleven tiles, in the prototype's order, with its names, emoji
// and locks (ثقافة، فن، أفلام locked), and three placeholder questions per tile whose text says
// plainly that it is a placeholder.
//
// DECIDED 2026-10-02 (requirements.md REQ-5.14): no question, answer, accepted variant, hint or
// fact of the prototype's appears in any non-test source under apps/web — and nothing of its
// `desc` or `chips` either (requirements.md §4). No unchecked fact enters the repository before
// Phase 8's human-verification gate (mission.md A-3) exists. `host-source.test.ts` greps every
// non-test source file under apps/web for the prototype's question strings, read from
// design/designs/Nel3ab - Arcade.dc.html at run time.
//
// The ids are this file's; Phase 8 chooses the content's. A lock here is content, not
// entitlement: the engine records any category it is told to pick (requirements.md, reading 6),
// the setup screen refuses to pick a locked tile, and Phase 20 enforces locks on the server.
//
// Framework-free: no React import (specs.md §1).

import type { CategoryId, Question } from '@nel3ab/game'

export interface CatalogEntry {
  readonly id: CategoryId
  readonly name: string
  readonly emoji: string
  readonly locked: boolean
  readonly questions: readonly [Question, ...Question[]]
}

/** The three placeholder questions every entry carries, `d` = ١، ٢، ٣ in turn (specs.md §2.9). */
function placeholderQuestions(name: string): readonly [Question, Question, Question] {
  const question = (d: string): Question => ({
    q: `سؤال تجريبي ${d} — ${name}`,
    a: `إجابة تجريبية ${d}`,
    alts: [],
    h: ['تلميح تجريبي ١', 'تلميح تجريبي ٢'],
    f: 'معلومة تجريبية — الأسئلة الحقيقية في المرحلة ٨',
  })
  return [question('١'), question('٢'), question('٣')]
}

const entry = (id: CategoryId, name: string, emoji: string, locked: boolean): CatalogEntry => ({
  id,
  name,
  emoji,
  locked,
  questions: placeholderQuestions(name),
})

/** The eleven tiles, in the prototype's order (its `CATS`); specs.md §2.9's table. */
export const CATALOG: readonly CatalogEntry[] = [
  entry('industry', 'صناعة', '🏭', false),
  entry('animals', 'حيوانات', '🦁', false),
  entry('nature', 'طبيعة', '🌋', false),
  entry('society', 'إنسان ومجتمع', '🌍', false),
  entry('culture', 'ثقافة', '🎎', true),
  entry('proverbs', 'أمثال', '💬', false),
  entry('history', 'تاريخ', '🏛️', false),
  entry('religion', 'دين', '🕌', false),
  entry('art', 'فن', '🎨', true),
  entry('movies', 'أفلام', '🎬', true),
  entry('science', 'علوم', '🔬', false),
]

/** The catalog's entry for `id`; a `RangeError` for an id the catalog does not hold. */
export function catalogEntry(id: CategoryId): CatalogEntry {
  const found = CATALOG.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new RangeError(`catalogEntry: no category with id ${JSON.stringify(id)}`)
  }
  return found
}
