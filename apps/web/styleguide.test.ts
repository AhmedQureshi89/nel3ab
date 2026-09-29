import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import StyleguidePage from './app/styleguide/page'

// REQ-2.11, verification.md Gate 4. See specs/phase-2/specs.md §2.11 / §2.14.
//
// Static markup only, like rtl-root.test.ts: this proves the page PUTS every
// primitive inside both a light and a dark subtree. It proves nothing about how
// they look — no CSS is applied here — which is Gate 6's human pass.
//
// Primitives are recognised by the `data-*` attributes they emit (the same
// attributes their CSS keys off), never by CSS-Module class names, which are
// hashed and — under Vitest's default `css: false` — may be empty.

afterEach(() => {
  vi.unstubAllEnvs()
})

/** The inner markup of the one `<section data-theme="…">` for `theme`. */
const section = (markup: string, theme: 'light' | 'dark') => {
  const found = [
    ...markup.matchAll(/<section\b[^>]*\bdata-theme="(light|dark)"[^>]*>([\s\S]*?)<\/section>/g),
  ].filter(([, name]) => name === theme)
  // Exactly one per theme — two would mean a subtree is nested or duplicated,
  // zero would make every assertion below vacuous.
  expect(found, `sections with data-theme="${theme}"`).toHaveLength(1)
  return found[0]![2]!
}

/** Opening tags of `tag` matching every entry: a string is an exact value, `true` means present, `null` absent. */
const tags = (html: string, tag: string, attributes: Record<string, string | true | null>) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))]
    .map(([open]) => open)
    .filter((open) =>
      Object.entries(attributes).every(([name, value]) =>
        value === null
          ? !open.includes(` ${name}=`)
          : value === true
            ? open.includes(` ${name}=`)
            : open.includes(` ${name}="${value}"`),
      ),
    )

// Each primitive's signature, from packages/ui/src/primitives/*.tsx. A Card IS
// a Panel with `data-size`, so a bare Panel is a div with `data-raised` and NO
// `data-size`.
const PRIMITIVES = {
  Panel: (html: string) => tags(html, 'div', { 'data-raised': true, 'data-size': null }).length,
  Card: (html: string) =>
    tags(html, 'div', { 'data-size': 'md' }).length +
    tags(html, 'div', { 'data-size': 'lg' }).length,
  Pill: (html: string) => tags(html, 'span', { 'data-tone': true }).length,
  Dot: (html: string) => tags(html, 'span', { 'data-won': true }).length,
  Button: (html: string) => tags(html, 'button', { 'data-variant': true }).length,
}

describe('outside production', () => {
  // Vitest runs with NODE_ENV=test, so the guard does not fire here.
  const markup = renderToStaticMarkup(StyleguidePage())

  test('renders exactly one light and one dark subtree, side by side', () => {
    expect(section(markup, 'light')).not.toBe('')
    expect(section(markup, 'dark')).not.toBe('')
    // No theme on anything but the two sections: the page must not pin one.
    expect(markup.match(/data-theme="/g)).toHaveLength(2)
  })

  describe.each(['light', 'dark'] as const)('the %s subtree', (theme) => {
    const html = () => section(markup, theme)

    test.each(Object.keys(PRIMITIVES) as (keyof typeof PRIMITIVES)[])('contains %s', (name) => {
      // Signature matchers must not see a primitive as another: Panel's
      // requires data-raised WITHOUT data-size, so it does not count Cards.
      expect(PRIMITIVES[name](html())).toBeGreaterThan(0)
    })

    test('every variant: Panel raised/flat, Card md/lg, Pill 4 tones × selected, Dot sm/md × won', () => {
      const h = html()
      expect(tags(h, 'div', { 'data-raised': 'true', 'data-size': null })).not.toHaveLength(0)
      expect(tags(h, 'div', { 'data-raised': 'false', 'data-size': null })).not.toHaveLength(0)
      expect(tags(h, 'div', { 'data-size': 'md' })).not.toHaveLength(0)
      expect(tags(h, 'div', { 'data-size': 'lg' })).not.toHaveLength(0)
      for (const tone of ['panel', 'red', 'sky', 'yellow']) {
        for (const selected of ['true', 'false']) {
          expect(
            tags(h, 'span', { 'data-tone': tone, 'data-selected': selected }),
            `Pill ${tone} selected=${selected}`,
          ).toHaveLength(1)
        }
      }
      for (const size of ['sm', 'md']) {
        for (const won of ['true', 'false']) {
          expect(
            tags(h, 'span', { 'data-size': size, 'data-won': won }),
            `Dot ${size} won=${won}`,
          ).toHaveLength(1)
        }
      }
    })

    test('every Button variant, enabled and disabled', () => {
      const h = html()
      for (const variant of ['primary', 'secondary', 'action']) {
        expect(
          tags(h, 'button', { 'data-variant': variant, disabled: null }),
          `${variant} enabled`,
        ).not.toHaveLength(0)
        expect(
          tags(h, 'button', { 'data-variant': variant, disabled: '', 'aria-disabled': 'true' }),
          `${variant} disabled`,
        ).not.toHaveLength(0)
      }
    })

    test('an .ltr-num run inside an Arabic sentence, and a plain focus target', () => {
      const h = html()
      expect(h).toMatch(/<p\b[^>]*>رمز الغرفة <span class="ltr-num">SKZJ62<\/span>/)
      expect(tags(h, 'a', { href: `#theme-${theme}` })).toHaveLength(1)
    })
  })
})

describe('in production', () => {
  test('the route is notFound(): the guard is present and fires', () => {
    vi.stubEnv('NODE_ENV', 'production')
    // notFound() throws Next's 404 control-flow error; its digest is how the
    // App Router recognises it and renders the 404 page.
    let thrown: unknown
    try {
      StyleguidePage()
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error & { digest?: string }).digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})
