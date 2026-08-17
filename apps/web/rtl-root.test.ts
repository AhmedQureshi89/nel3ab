import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

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
test('the root layout renders <html lang="ar" dir="rtl">', () => {
  const markup = renderToStaticMarkup(RootLayout({ children: null }))
  const openingTag = markup.match(/<html[^>]*>/)?.[0]

  expect(openingTag).toBe('<html lang="ar" dir="rtl">')
})
