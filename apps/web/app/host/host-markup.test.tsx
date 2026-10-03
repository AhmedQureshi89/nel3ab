import { reduce } from '@nel3ab/game'
import type { Action, RoomState } from '@nel3ab/game'
import press from '@nel3ab/ui/press.module.css'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { CATALOG, catalogEntry } from './_lib/catalog'
import { SEED_PICKED, seedRoom } from './_lib/seed'
import { readyView, setupView } from './_lib/view'
import type { ReadyView, SetupView } from './_lib/view'
import { HostApp } from './HostApp'
import HostPage from './page'
import { PendingScreen } from './PendingScreen'
import { ReadyScreen } from './ReadyScreen'
import { SetupScreen } from './SetupScreen'

// REQ-5.15 – REQ-5.20 — specs/phase-5/verification.md Gate 4, "The markup". See specs.md §2.12
// (this file's row): the static markup of each screen for given views — its text, the attributes
// the stylesheets key on (`data-team`, `data-selected`, `data-locked`, `data-on`, `data-flash`,
// `disabled`), the ready CTA's `data-size="md"`, `.ltr-num` on the room code — and `HostApp`'s
// server markup: no debug bar, and identical under two different random sources (REQ-5.10;
// specs.md §4, R4).
//
// Rendered in Node with `renderToStaticMarkup`, as rtl-root.test.ts does: no DOM, so nothing here
// clicks (specs.md §4, R2 — the wiring is Gate 5's). Elements are found by their tag, text and
// `data-*` / ARIA attributes, never by CSS Module class names, which are hashed. The words below
// are the prototype's as specs.md §2.11 and the W table name them; host-prototype.test.ts reads
// the same words from design/designs/Nel3ab - Arcade.dc.html at run time (W1–W3).

afterEach(() => {
  vi.restoreAllMocks()
})

// --- reading markup --------------------------------------------------------------------------

type Attributes = Readonly<Record<string, string>>

/** A start tag's attributes, by name; a valueless attribute maps to ''. */
const attributesOf = (startTag: string): Attributes =>
  Object.fromEntries(
    [...startTag.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)].map((m) => [m[1] ?? '', m[2] ?? '']),
  )

/** Every `<tag …>` start tag in `markup`, as its attributes. */
const startTags = (markup: string, tag: string): Attributes[] =>
  [...markup.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map((m) => attributesOf(m[1] ?? ''))

/** Every `<button>` in `markup` — buttons do not nest — with its attributes and its text. */
const buttons = (markup: string): { attributes: Attributes; text: string }[] =>
  [...markup.matchAll(/<button(\s[^>]*)?>([\s\S]*?)<\/button>/g)].map((m) => ({
    attributes: attributesOf(m[1] ?? ''),
    text: (m[2] ?? '').replace(/<[^>]*>/g, ''),
  }))

/** The text between tags, in document order: every run, whitespace collapsed, empty ones dropped. */
const textRuns = (markup: string): string[] =>
  [...markup.matchAll(/>([^<]*)</g)]
    .map((m) => (m[1] ?? '').replace(/\s+/g, ' ').trim())
    .filter((run) => run !== '')

/** How many times `text` is a whole run. */
const runCount = (markup: string, text: string): number =>
  textRuns(markup).filter((run) => run === text).length

/** Whether `expected` occur as runs of `markup` in this order, others allowed between them. */
const inOrder = (markup: string, expected: readonly string[]): boolean => {
  const runs = textRuns(markup)
  let from = 0
  for (const text of expected) {
    const index = runs.indexOf(text, from)
    if (index === -1) return false
    from = index + 1
  }
  return true
}

// --- the screens, for given views ------------------------------------------------------------------

const noop = (): void => undefined

const setupMarkup = (view: SetupView): string =>
  renderToStaticMarkup(
    <SetupScreen
      view={view}
      onShuffleTeamName={noop}
      onRenameTeam={noop}
      onSwapTeam={noop}
      onRemovePlayer={noop}
      onSetJudge={noop}
      onSetRotateJudge={noop}
      onPickCategory={noop}
      onOpenRoom={noop}
    />,
  )

const readyMarkup = (view: ReadyView, shareLabel: string | null = null): string =>
  renderToStaticMarkup(
    <ReadyScreen view={view} shareLabel={shareLabel} onShare={noop} onStart={noop} onBack={noop} />,
  )

/** The room after `actions`, each reduced in turn from `from`. */
const after = (from: RoomState, ...actions: Action[]): RoomState =>
  actions.reduce((state, action) => reduce(state, action), from)

const SEED = seedRoom('SKZJ62')
const READY = after(SEED, { type: 'openRoom' })
const SEED_SETUP = setupView(SEED, CATALOG)
const NOTHING_PICKED = after(
  SEED,
  ...SEED_PICKED.map((categoryId): Action => ({ type: 'pickCategory', categoryId, picked: false })),
)

describe('REQ-5.16 – REQ-5.19: SetupScreen, for the seed', () => {
  const markup = setupMarkup(SEED_SETUP)

  test("every literal text of the prototype's setup block (W1), in order, and every view value", () => {
    const literals = [
      'يلا نلعب',
      'فريقان، حكم واحد، وأسئلة معلومات — كل شي جاهز، عدّل اللي تبيه بس.',
      'الفرق',
      'فريق ١',
      '↺',
      'فريق ٢',
      '↺',
      '↔',
      '✕',
      'الحكم',
      'الحكم يشوف الإجابة الصحيحة — بقية الشاشات لا.',
      'الفئات',
      'ابدأ اللعبة',
      '▶',
    ]
    expect(inOrder(markup, literals)).toBe(true)
    expect(
      buttons(markup)
        .filter(({ text }) => text.includes('بدّل الحكم كل جولة'))
        .map(({ text }) => text),
    ).toStrictEqual([SEED_SETUP.rotateLabel])
    // The heading, the lede, the three titles, the judge line and the CTA's two parts once each;
    // ↺ once per team tile; ↔ and ✕ once per chip.
    for (const text of literals.filter((t) => !['↺', '↔', '✕'].includes(t))) {
      expect(runCount(markup, text), text).toBe(1)
    }
    expect(runCount(markup, '↺')).toBe(2)
    expect(runCount(markup, '↔')).toBe(5)
    expect(runCount(markup, '✕')).toBe(5)

    // The view's values, as setupView gives them for the seed.
    expect(
      inOrder(markup, [
        '5 لاعبين',
        'ريم، نورة، ماجد',
        'سعد، خالد',
        'ريم',
        'سعد',
        'نورة',
        'خالد',
        'ماجد',
        'العدد فردي — يفضّل التبديل',
        // The toggle's glyph is its own run since Gate 5 (setup.module.css, `.glyph`); the
        // button's whole text is still the view's label — asserted below.
        '○',
        'بدّل الحكم كل جولة',
        '8 من 11 مختارة',
        ...SEED_SETUP.tiles.flatMap(({ emoji, name, tag }) =>
          tag ? [emoji, name, tag] : [emoji, name],
        ),
        'الحكم يشوف الإجابات · 45 ثانية لكل فريق · ما تحتاج تسجّل دخول',
      ]),
    ).toBe(true)
    // The team names are the fields' values, not text.
    expect(startTags(markup, 'input')).toStrictEqual([
      { class: expect.any(String) as string, 'aria-label': 'فريق ١', value: 'النمور' },
      { class: expect.any(String) as string, 'aria-label': 'فريق ٢', value: 'الصقور' },
    ])
  })

  test('the three titles of W2, each also the button’s accessible name; no other titled element', () => {
    const titled = buttons(markup).filter(({ attributes }) => 'title' in attributes)
    expect(titled.map(({ attributes }) => attributes.title)).toStrictEqual([
      'اسم ثاني',
      'اسم ثاني',
      ...SEED_SETUP.chips.flatMap(() => ['بدّل الفريق', 'حذف']),
    ])
    for (const { attributes } of titled) {
      expect(attributes['aria-label']).toBe(attributes.title)
      expect(attributes.type).toBe('button')
    }
    expect(titled.map(({ text }) => text)).toStrictEqual([
      '↺',
      '↺',
      ...SEED_SETUP.chips.flatMap(() => ['↔', '✕']),
    ])
    expect(markup.match(/\stitle="/g)).toHaveLength(12)
  })

  test('data-team on the two team tiles and on every chip, the chips in their team’s tone', () => {
    const tiles = startTags(markup, 'div').filter((a) => 'data-team' in a)
    expect(tiles.map((a) => a['data-team'])).toStrictEqual(['a', 'b'])
    const chips = startTags(markup, 'span').filter((a) => 'data-team' in a)
    expect(chips.map((a) => [a['data-team'], a['data-tone']])).toStrictEqual([
      ['a', 'red'],
      ['b', 'sky'],
      ['a', 'red'],
      ['b', 'sky'],
      ['a', 'red'],
    ])
  })

  test('data-selected on ماجد’s choice alone, and on the eight picked tiles', () => {
    const choices = buttons(markup).filter(
      ({ attributes }) => 'data-selected' in attributes && !('data-locked' in attributes),
    )
    expect(
      choices.map(({ text, attributes }) => [text, attributes['data-selected']]),
    ).toStrictEqual([
      ['ريم', 'false'],
      ['سعد', 'false'],
      ['نورة', 'false'],
      ['خالد', 'false'],
      ['ماجد', 'true'],
    ])
    for (const { attributes } of choices) {
      expect(attributes['aria-pressed']).toBe(attributes['data-selected'])
    }

    const tiles = buttons(markup).filter(({ attributes }) => 'data-locked' in attributes)
    expect(tiles).toHaveLength(11)
    expect(
      tiles
        .filter(({ attributes }) => attributes['data-selected'] === 'true')
        .map(({ text }) => text),
    ).toStrictEqual(
      SEED_PICKED.map((id) => `${catalogEntry(id).emoji}${catalogEntry(id).name}مختارة`),
    )
    for (const { attributes } of tiles) {
      expect(attributes['aria-pressed']).toBe(attributes['data-selected'])
    }
  })

  test('data-locked on three tiles — ثقافة، فن، أفلام — and no tile carries disabled or aria-disabled', () => {
    const tiles = buttons(markup).filter(({ attributes }) => 'data-locked' in attributes)
    expect(
      tiles
        .filter(({ attributes }) => attributes['data-locked'] === 'true')
        .map(({ text }) => text),
    ).toStrictEqual(['🎎ثقافة🔒 مدفوعة', '🎨فن🔒 مدفوعة', '🎬أفلام🔒 مدفوعة'])
    expect(tiles.filter(({ attributes }) => attributes['data-locked'] === 'false')).toHaveLength(8)
    for (const { attributes } of tiles) {
      expect('disabled' in attributes).toBe(false)
      expect('aria-disabled' in attributes).toBe(false)
    }
    // A locked tile picked by the engine (it has no locks) is selected and still locked.
    const culture = buttons(
      setupMarkup(
        setupView(
          after(SEED, { type: 'pickCategory', categoryId: 'culture', picked: true }),
          CATALOG,
        ),
      ),
    ).find(({ text }) => text.includes('ثقافة'))
    expect(culture?.attributes).toMatchObject({ 'data-locked': 'true', 'data-selected': 'true' })
  })

  test('data-on on the rotation toggle: false on the seed, true with rotation on', () => {
    const toggle = (view: SetupView) =>
      buttons(setupMarkup(view)).find(({ attributes }) => 'data-on' in attributes)
    expect(toggle(SEED_SETUP)).toStrictEqual({
      attributes: expect.objectContaining({
        'data-on': 'false',
        'aria-pressed': 'false',
      }) as Attributes,
      text: '○ بدّل الحكم كل جولة',
    })
    expect(
      toggle(setupView(after(SEED, { type: 'setRotateJudge', rotate: true }), CATALOG)),
    ).toStrictEqual({
      attributes: expect.objectContaining({
        'data-on': 'true',
        'aria-pressed': 'true',
      }) as Attributes,
      text: '✔ بدّل الحكم كل جولة',
    })
  })

  test('the CTA: the 20px primary, enabled on the seed; disabled when canStart is false', () => {
    const cta = (view: SetupView) =>
      buttons(setupMarkup(view)).find(({ attributes }) => 'data-variant' in attributes)
    const enabled = cta(SEED_SETUP)
    expect(enabled?.text).toBe('ابدأ اللعبة▶')
    expect(enabled?.attributes).toMatchObject({ 'data-variant': 'primary', 'data-size': 'lg' })
    expect('disabled' in (enabled?.attributes ?? {})).toBe(false)
    expect('aria-disabled' in (enabled?.attributes ?? {})).toBe(false)

    const view = setupView(NOTHING_PICKED, CATALOG)
    expect(view.canStart).toBe(false)
    const disabled = cta(view)
    expect(disabled?.attributes).toMatchObject({
      'data-variant': 'primary',
      disabled: '',
      'aria-disabled': 'true',
    })
    expect(runCount(setupMarkup(view), '0 من 11 مختارة')).toBe(1)
    // The only disabled element on the screen is the CTA.
    expect(setupMarkup(view).match(/\sdisabled=""/g)).toHaveLength(1)
  })
})

describe('REQ-5.20, REQ-5.21: ReadyScreen, for the seed on ready', () => {
  const view = readyView(READY)
  const markup = readyMarkup(view)

  test("every literal text of the prototype's ready block (W3), in order, with the code and the chips", () => {
    expect(
      inOrder(markup, [
        '🎉',
        'الغرفة جاهزة!',
        'كود الانضمام — شاركه مع اللاعبين',
        'SKZJ62',
        '⤴',
        'مشاركة',
        'في الغرفة',
        'الحكم: ماجد',
        'ريم',
        'سعد',
        'نورة',
        'خالد',
        'ماجد',
        'ابدأ الجولة الأولى',
        '▶',
        'رجوع للإعداد',
      ]),
    ).toBe(true)
    expect(textRuns(markup)).toHaveLength(16)
    // The 🎉 and the ⤴ are decoration.
    expect(markup).toMatch(/aria-hidden="true">🎉<\/div>/)
    // The ⤴ sits in a system-font span inside the aria-hidden one since Gate 5 (ready.module.css,
    // `.glyph`); it is still decoration.
    expect(markup).toMatch(/aria-hidden="true"><span[^>]*>⤴<\/span><\/span>/)
    // With no players, the judge is '—'.
    expect(runCount(readyMarkup({ ...view, judgeName: '—', chips: [] }), 'الحكم: —')).toBe(1)
  })

  test('.ltr-num on the room code', () => {
    const code = /<div class="([^"]*)">SKZJ62<\/div>/.exec(markup)
    expect(code?.[1]?.split(' ')).toContain('ltr-num')
  })

  test('data-flash on share: false with no label, true with one — and share carries the shared press', () => {
    const share = (label: string | null) =>
      buttons(readyMarkup(view, label)).find(({ attributes }) => 'data-flash' in attributes)
    expect(share(null)).toMatchObject({
      attributes: { 'data-flash': 'false', type: 'button' },
      text: '⤴مشاركة',
    })
    expect(share('نُسخ الرابط ✔')).toMatchObject({
      attributes: { 'data-flash': 'true' },
      text: '⤴نُسخ الرابط ✔',
    })
    expect(share('الكود: SKZJ62')?.text).toBe('⤴الكود: SKZJ62')
    // The one press rule, the class Button carries (@nel3ab/ui/press.module.css).
    expect(press.press).toBeTruthy()
    expect(share(null)?.attributes.class?.split(' ')).toContain(press.press)
  })

  test('data-team on every chip; the start CTA is data-size="md"; back is the secondary Button', () => {
    expect(
      startTags(markup, 'span')
        .filter((a) => 'data-team' in a)
        .map((a) => a['data-team']),
    ).toStrictEqual(['a', 'b', 'a', 'b', 'a'])
    const [, start, back] = buttons(markup)
    expect(start).toMatchObject({
      attributes: { 'data-variant': 'primary', 'data-size': 'md' },
      text: 'ابدأ الجولة الأولى▶',
    })
    expect(start?.attributes.class?.split(' ')).toContain(press.press)
    expect(back).toMatchObject({
      attributes: { 'data-variant': 'secondary' },
      text: 'رجوع للإعداد',
    })
    expect(buttons(markup)).toHaveLength(3)
    expect(markup).not.toMatch(/\sdisabled/)
  })
})

describe('REQ-5.15: PendingScreen, the placeholder on play, roundEnd and match', () => {
  const play = after(READY, {
    type: 'startMatch',
    categoryId: 'proverbs',
    questions: catalogEntry('proverbs').questions,
  })

  test('the screen key in .ltr-num, the round, both teams’ clocks and tallies — and no button, no question', () => {
    const markup = renderToStaticMarkup(<PendingScreen state={play} />)
    expect(markup).toContain('<span class="ltr-num">play</span>')
    expect(textRuns(markup)).toStrictEqual([
      'play',
      'الجولة',
      '1',
      'النمور — الوقت',
      '45',
      '· الجولات',
      '0',
      'الصقور — الوقت',
      '45',
      '· الجولات',
      '0',
    ])
    expect(markup).not.toContain('<button')
    for (const { q, a, h, f } of catalogEntry('proverbs').questions) {
      for (const text of [q, a, ...h, f]) expect(markup).not.toContain(text)
    }
    const roundEnd = renderToStaticMarkup(
      <PendingScreen state={after(play, { type: 'tick', ms: 45_000 })} />,
    )
    expect(textRuns(roundEnd)).toStrictEqual([
      'roundEnd',
      'الجولة',
      '1',
      'النمور — الوقت',
      '0',
      '· الجولات',
      '0',
      'الصقور — الوقت',
      '45',
      '· الجولات',
      '1',
    ])
  })
})

describe('REQ-5.15, REQ-5.10: HostApp — the frame, no debug bar, the same markup for any random source', () => {
  /** HostApp's server markup with `Math.random` always returning `value`, and its call count. */
  const hostMarkup = (value: number): { markup: string; calls: number } => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(value)
    const markup = renderToStaticMarkup(<HostApp />)
    const calls = random.mock.calls.length
    random.mockRestore()
    return { markup, calls }
  }

  test('the frame on setup: data-screen, the header — "نلعب" and "إعداد" — then the setup screen', () => {
    const { markup } = hostMarkup(0.5)
    expect(startTags(markup, 'div')[0]?.['data-screen']).toBe('setup')
    expect(textRuns(markup).slice(0, 3)).toStrictEqual(['نلعب', 'إعداد', 'يلا نلعب'])
    // The setup screen, exactly as rendered alone for the seed: the room code is not on it.
    expect(markup).toContain(setupMarkup(setupView(seedRoom('ANY000'), CATALOG)))
  })

  test('no debug bar: no "شاشة الحكم", "شاشة لاعب", "نهاري", "ليلي" or "Nel3ab trivia", and no data-theme', () => {
    const { markup } = hostMarkup(0.5)
    for (const text of ['شاشة الحكم', 'شاشة لاعب', 'نهاري', 'ليلي', 'Nel3ab trivia']) {
      expect(markup).not.toContain(text)
    }
    expect(markup).not.toContain('data-theme')
  })

  test('identical server markup for two different random sources — and neither room code in it', () => {
    const low = hostMarkup(0)
    const high = hostMarkup(0.999)
    // Each room drew its code from its own source: six calls, AAAAAA and 999999 (Table T6).
    expect([low.calls, high.calls]).toStrictEqual([6, 6])
    expect(low.markup).toBe(high.markup)
    expect(low.markup).not.toContain('AAAAAA')
    expect(high.markup).not.toContain('999999')
    // And under the real Math.random.
    expect(renderToStaticMarkup(<HostApp />)).toBe(low.markup)
  })

  test('/host renders HostApp', () => {
    expect(renderToStaticMarkup(<HostPage />)).toBe(hostMarkup(0.5).markup)
  })
})
