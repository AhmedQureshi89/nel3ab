import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import RootLayout from './app/layout'

// REQ-1.4, verification.md Gate 4. The gate's primary evidence is `next build`
// + `next start` + curl against the served page (recorded in verification.md);
// this test is the re-checkable form of the same assertion, so CI catches a
// regression without standing a server up.
//
// It asserts the WHOLE opening tag, not the two attributes separately: a
// substring check for `lang="ar"` would still pass on `<html lang="ar">` with
// `dir` dropped, which is the exact failure Gate 4's second box exists to
// exclude. Measured against the served HTML, this string is byte-identical.
//
// Phase 2 (specs/phase-2/specs.md §2.13): the tag now also carries the two
// next/font variable classes, and still carries NO `data-theme` (REQ-2.5,
// decided 2026-08-20: follow the device). The whole-tag form is kept for the
// same reason as before, and it now also catches a `data-theme` creeping onto
// the root, or one of the two font variables being dropped.
//
// next/font/local cannot run here. It is a build-time loader: Next's compiler
// rewrites each call into a generated module, and the runtime function it
// replaces is literally `throw new Error()` (node_modules/next/dist/compiled/
// @next/font/dist/local/index.js). So the loader is stubbed, and the stub
// derives each class from the CSS variable the call declares. The expected
// string therefore names `--font-baloo` and `--font-archivo` — the two
// variables tokens.css resolves `--font` / `--font-en` through — rather than a
// build hash that would change with every font or config edit. The real,
// hashed tag is measured against the served page (verification.md Gate 4).
vi.mock('next/font/local', () => ({
  default: (options: { variable?: string }) => ({
    className: '',
    style: { fontFamily: '' },
    variable: `__variable${String(options.variable)}`,
  }),
}))

test('the root layout renders <html lang="ar" dir="rtl"> with both font variables and no data-theme', () => {
  const markup = renderToStaticMarkup(RootLayout({ children: null }))
  const openingTag = markup.match(/<html[^>]*>/)?.[0]

  expect(openingTag).toBe(
    '<html lang="ar" dir="rtl" class="__variable--font-baloo __variable--font-archivo">',
  )
})
